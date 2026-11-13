"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Anchor, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDb } from "@/lib/store";
import { clientMrr, clientStatusMeta, daysUntil, healthMeta, leadStatusMeta, money, planOf, relative } from "@/lib/domain";
import { Card, EmptyState, EntityAvatar, PageHeader, Stat, StatusPill } from "@/components/ui";

/** Invoiced revenue per calendar month — one series, one hue, hover for values. */
function RevenueChart({ months }: { months: { label: string; total: number; count: number }[] }) {
	const [hover, setHover] = useState<number | null>(null);
	const max = Math.max(1, ...months.map((m) => m.total));
	const W = 560;
	const H = 180;
	const pad = { l: 44, r: 8, t: 12, b: 24 };
	const innerW = W - pad.l - pad.r;
	const innerH = H - pad.t - pad.b;
	const slot = innerW / months.length;
	const barW = Math.min(36, slot * 0.5);
	const ticks = [0, 0.5, 1].map((f) => f * max);

	return (
		<div style={{ position: "relative" }}>
			<svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Invoiced revenue by month">
				{ticks.map((t) => {
					const y = pad.t + innerH - (t / max) * innerH;
					return (
						<g key={t}>
							<line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="#eef0f3" />
							<text x={pad.l - 6} y={y + 4} fontSize="10" textAnchor="end" fill="#6b7280">
								{money(t, "USD", true)}
							</text>
						</g>
					);
				})}
				{months.map((m, i) => {
					const h = (m.total / max) * innerH;
					const x = pad.l + slot * i + (slot - barW) / 2;
					const y = pad.t + innerH - h;
					const r = Math.min(4, h / 2);
					return (
						<g key={m.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
							{/* hit target larger than the mark */}
							<rect x={pad.l + slot * i} y={pad.t} width={slot} height={innerH} fill="transparent" />
							{h > 0 && (
								<path
									d={`M${x},${pad.t + innerH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${pad.t + innerH} Z`}
									fill={hover === null || hover === i ? "#2563eb" : "#93c5fd"}
								/>
							)}
							<text x={pad.l + slot * i + slot / 2} y={H - 6} fontSize="10" textAnchor="middle" fill="#6b7280">
								{m.label}
							</text>
						</g>
					);
				})}
				<line x1={pad.l} x2={W - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="#d1d5db" />
			</svg>
			{hover !== null && (
				<div
					style={{
						position: "absolute",
						top: 0,
						left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%`,
						transform: "translateX(-50%)",
						background: "#111827",
						color: "#fff",
						fontSize: 12,
						padding: "6px 8px",
						borderRadius: 6,
						pointerEvents: "none",
						whiteSpace: "nowrap",
					}}
				>
					<b>{money(months[hover].total)}</b> · {months[hover].count} invoice{months[hover].count === 1 ? "" : "s"}
				</div>
			)}
		</div>
	);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Overview() {
	const db = useDb();

	const stats = useMemo(() => {
		const mrr = db.clients.reduce((s, c) => s + clientMrr(db, c), 0);
		const paying = db.clients.filter((c) => ["active", "past_due"].includes(c.status)).length;
		const trials = db.clients.filter((c) => c.status === "trial");
		const pastDue = db.clients.filter((c) => c.status === "past_due").length;
		const overdue = db.invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.total, 0);
		const outstanding = db.invoices.filter((i) => i.status === "open").reduce((s, i) => s + i.total, 0);
		return { mrr, arr: mrr * 12, paying, trials, pastDue, overdue, outstanding, arpa: paying ? mrr / paying : 0 };
	}, [db]);

	const months = useMemo(() => {
		const now = new Date();
		return Array.from({ length: 6 }, (_, k) => {
			const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
			const inMonth = db.invoices.filter((i) => {
				const at = new Date(i.issuedAt);
				return i.status !== "void" && at.getFullYear() === d.getFullYear() && at.getMonth() === d.getMonth();
			});
			return { label: d.toLocaleDateString("en-US", { month: "short" }), total: inMonth.reduce((s, i) => s + i.total, 0), count: inMonth.length };
		});
	}, [db.invoices]);

	const byPlan = useMemo(() => {
		const rows = db.plans
			.map((p) => {
				const clients = db.clients.filter((c) => c.planId === p.id && c.status !== "cancelled");
				return { plan: p, count: clients.length, mrr: clients.reduce((s, c) => s + clientMrr(db, c), 0) };
			})
			.filter((r) => r.count > 0)
			.sort((a, b) => b.mrr - a.mrr);
		return rows;
	}, [db]);
	const maxPlanMrr = Math.max(1, ...byPlan.map((r) => r.mrr));

	const attention = [
		...db.clients.filter((c) => c.status === "past_due").map((c) => ({ c, why: "Payment overdue", color: "orange" })),
		...db.clients.filter((c) => c.status === "trial" && daysUntil(c.trialEndsAt) <= 7).map((c) => ({ c, why: `Trial ends in ${daysUntil(c.trialEndsAt)} days`, color: "cyan" })),
		...db.clients.filter((c) => ["degraded", "down"].includes(c.health.state)).map((c) => ({ c, why: `Health: ${healthMeta[c.health.state].label.toLowerCase()}`, color: "red" })),
	];

	return (
		<>
			<PageHeader
				title="Overview"
				description={[plural(db.products.length, "product"), plural(db.clients.length, "client"), plural(db.plans.filter((p) => p.status === "active").length, "active plan")].join(" · ")}
			/>

			<SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mb="md">
				<Stat label="MRR" value={money(stats.mrr)} hint={`ARR ${money(stats.arr, "USD", true)}`} />
				<Stat label="Paying clients" value={stats.paying} hint={`Avg ${money(stats.arpa)} / client`} />
				<Stat label="In trial" value={stats.trials.length} hint={stats.trials.length ? "Convert before day 14" : "No open trials"} />
				<Stat
					label="Overdue"
					value={money(stats.overdue)}
					hint={stats.pastDue ? `${stats.pastDue} client${stats.pastDue === 1 ? "" : "s"} past due` : "Nothing overdue"}
					tone={stats.overdue > 0 ? "bad" : "good"}
				/>
			</SimpleGrid>

			<SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md" mb="md">
				<div className="oa-span-2">
					<Card title="Invoiced revenue" description="Last 6 months, excluding voided invoices.">
						{months.some((m) => m.total > 0) ? <RevenueChart months={months} /> : <EmptyState title="No invoices in the last 6 months">Revenue shows here once clients are invoiced.</EmptyState>}
					</Card>
				</div>
				<Card title="MRR by plan">
					{byPlan.length === 0 ? (
						<EmptyState title="No paying clients yet" />
					) : (
						<Stack gap="sm">
							{byPlan.map((r) => (
								<div key={r.plan.id}>
									<Group justify="space-between" gap="xs">
										<Text size="sm">
											{r.plan.name}{" "}
											<Text span size="xs" c="dimmed">
												· {db.products.find((p) => p.id === r.plan.productId)?.name} · {r.count} client{r.count === 1 ? "" : "s"}
											</Text>
										</Text>
										<Text size="sm" fw={500}>
											{money(r.mrr)}
										</Text>
									</Group>
									<div style={{ height: 6, background: "#eef0f3", borderRadius: 4, marginTop: 4 }}>
										<div style={{ height: 6, width: `${(r.mrr / maxPlanMrr) * 100}%`, background: "#2563eb", borderRadius: 4 }} />
									</div>
								</div>
							))}
						</Stack>
					)}
				</Card>
			</SimpleGrid>

			<SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
				<Card title="Needs attention" actions={<Anchor component={Link} href="/clients" size="xs">All clients</Anchor>}>
					{attention.length === 0 ? (
						<EmptyState title="All clear" />
					) : (
						<Stack gap={0}>
							{attention.map(({ c, why, color }) => (
								<Group key={`${c.id}-${why}`} renderRoot={(props) => <Link href={`/clients/${c.id}`} {...props} />} gap="sm" py={8} wrap="nowrap" style={{ borderBottom: "1px solid var(--oa-border)" }}>
									<EntityAvatar name={c.name} size={26} />
									<div style={{ minWidth: 0 }}>
										<Text size="sm" truncate>
											{c.name}
										</Text>
										<Text size="xs" c={`${color}.7`}>
											{why}
										</Text>
									</div>
								</Group>
							))}
						</Stack>
					)}
				</Card>

				<Card title="New leads" actions={<Anchor component={Link} href="/leads" size="xs">All leads</Anchor>}>
					{db.leads.filter((l) => !["won", "lost"].includes(l.status)).length === 0 ? (
						<EmptyState title="No open leads" />
					) : (
						<Stack gap={0}>
							{db.leads
								.filter((l) => !["won", "lost"].includes(l.status))
								.slice(0, 5)
								.map((l) => (
									<Group key={l.id} justify="space-between" py={8} wrap="nowrap" style={{ borderBottom: "1px solid var(--oa-border)" }}>
										<div style={{ minWidth: 0 }}>
											<Text size="sm" truncate>
												{l.company || l.name}
											</Text>
											<Text size="xs" c="dimmed">
												{l.source} · {relative(l.createdAt)}
											</Text>
										</div>
										<StatusPill label={leadStatusMeta[l.status].label} color={leadStatusMeta[l.status].color} />
									</Group>
								))}
						</Stack>
					)}
				</Card>

				<Card title="Recent changes" actions={<Anchor component={Link} href="/changelog" size="xs">Change log</Anchor>}>
					<Stack gap={0}>
						{db.audit.slice(0, 6).map((a) => (
							<div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--oa-border)" }}>
								<Text size="sm" lineClamp={1}>
									{a.entityName ? <b>{a.entityName}: </b> : null}
									{a.summary}
								</Text>
								<Text size="xs" c="dimmed">
									{a.actorName} · {relative(a.at)}
								</Text>
							</div>
						))}
					</Stack>
				</Card>
			</SimpleGrid>

			<div style={{ height: 16 }} />
			<Card title="Clients by status" padding={16}>
				<Group gap="lg" mt={4}>
					{Object.entries(clientStatusMeta).map(([key, m]) => {
						const n = db.clients.filter((c) => c.status === key).length;
						return (
							<Group key={key} gap={6}>
								<StatusPill label={m.label} color={m.color} />
								<Text size="sm" fw={600}>
									{n}
								</Text>
							</Group>
						);
					})}
					<Text size="xs" c="dimmed" ml="auto">
						Highest-value client: {(() => {
							const top = [...db.clients].sort((a, b) => clientMrr(db, b) - clientMrr(db, a))[0];
							return top ? `${top.name} (${money(clientMrr(db, top))}/mo, ${planOf(db, top)?.name})` : "—";
						})()}
					</Text>
				</Group>
			</Card>
		</>
	);
}
