"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionIcon, Badge, Button, Group, Menu, Modal, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import { Activity, ExternalLink, LogIn, MoreVertical, PauseCircle, PlayCircle, Plus, Search, Store } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { clientStatusMeta, date, healthMeta, planOf, productOf, relative } from "@/lib/domain";
import type { StatusTarget } from "./ClientDialogs";
import { Card, CountPill, EmptyState, EntityAvatar, PageHeader, StatusPill } from "@/components/ui";
import { ImpersonateModal, StatusChangeModal } from "./ClientDialogs";

export function ClientsList() {
	const db = useDb();
	const { runHealthChecks, allowed } = useStore();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState<string>("all");
	const [product, setProduct] = useState<string | null>(null);
	const [healthOpen, setHealthOpen] = useState(false);
	const [checking, setChecking] = useState(false);
	const [statusTarget, setStatusTarget] = useState<{ id: string; to: StatusTarget } | null>(null);
	const [impersonate, setImpersonate] = useState<string | null>(null);

	const active = db.clients.filter((c) => c.status === "active").length;

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return db.clients.filter((c) => {
			if (status !== "all" && c.status !== status) return false;
			if (product && c.productId !== product) return false;
			if (!q) return true;
			return [c.name, c.slug, c.adminHost, c.contact.email, ...c.storefronts.map((s) => s.host)].join(" ").toLowerCase().includes(q);
		});
	}, [db.clients, query, status, product]);

	const checkHealth = async () => {
		setHealthOpen(true);
		setChecking(true);
		await runHealthChecks(db.clients.map((c) => c.id));
		setChecking(false);
	};

	return (
		<>
			<PageHeader
				title="Clients"
				badge={<CountPill>{`${active} active`}</CountPill>}
				actions={
					<>
						<Button variant="default" leftSection={<Activity size={15} />} onClick={checkHealth}>
							Check health
						</Button>
						<Button leftSection={<Plus size={15} />} component={Link} href="/clients/new" disabled={!allowed("clients.write")}>
							New client
						</Button>
					</>
				}
			/>

			<Card title="All clients" description="Open a client to change its status, plan, domains and feature toggles, or to sign in as its owner.">
				<Group gap="xs" mb="sm" wrap="wrap">
					<TextInput
						placeholder="Search name, slug or domain"
						leftSection={<Search size={14} />}
						value={query}
						onChange={(e) => setQuery(e.currentTarget.value)}
						w={260}
						size="sm"
					/>
					<Select
						placeholder="All products"
						clearable
						size="sm"
						w={170}
						data={db.products.map((p) => ({ value: p.id, label: p.name }))}
						value={product}
						onChange={setProduct}
					/>
					<SegmentedControl
						size="xs"
						value={status}
						onChange={setStatus}
						data={[
							{ value: "all", label: "All" },
							{ value: "active", label: "Active" },
							{ value: "trial", label: "Trial" },
							{ value: "past_due", label: "Past due" },
							{ value: "suspended", label: "Suspended" },
						]}
					/>
				</Group>

				{rows.length === 0 ? (
					<EmptyState icon={<Store size={28} />} title={db.clients.length ? "No clients match these filters" : "No clients yet"}>
						{db.clients.length ? "Clear the search or pick another status." : "Create your first client to provision a tenant."}
					</EmptyState>
				) : (
					<div className="oa-table-wrap">
						<table className="oa-table">
							<thead>
								<tr>
									<th>Client</th>
									<th>Product</th>
									<th>Status</th>
									<th>Plan</th>
									<th>Admin address</th>
									<th>Health</th>
									<th>Created</th>
									<th style={{ width: 44 }} aria-label="Actions" />
								</tr>
							</thead>
							<tbody>
								{rows.map((c) => {
									const plan = planOf(db, c);
									const prod = productOf(db, c.productId);
									const meta = clientStatusMeta[c.status];
									const health = healthMeta[c.health.state];
									return (
										<tr key={c.id} data-clickable="true" onClick={() => router.push(`/clients/${c.id}`)}>
											<td>
												<Group gap="sm" wrap="nowrap">
													<EntityAvatar name={c.name} />
													<div>
														<Text size="sm" fw={500}>
															{c.name}
														</Text>
														<Text size="xs" c="dimmed">
															{c.slug}
														</Text>
													</div>
												</Group>
											</td>
											<td>
												<Group gap={6} wrap="nowrap">
													<span className="oa-dot" style={{ color: prod?.color, width: 8, height: 8 }} />
													<Text size="sm">{prod?.name}</Text>
												</Group>
											</td>
											<td>
												<StatusPill label={meta.label} color={meta.color} />
											</td>
											<td>
												<Badge variant="light" color="violet">
													{plan?.name ?? "—"}
												</Badge>
												<Text size="xs" c="dimmed" mt={2}>
													{c.billingCycle}
												</Text>
											</td>
											<td>
												<Text size="sm">{c.adminHost}</Text>
												<Text size="xs" c="dimmed">
													{c.storefronts.length} storefront address{c.storefronts.length === 1 ? "" : "es"}
												</Text>
											</td>
											<td>
												<Text size="sm" c={`${health.color}.7`}>
													{health.label}
												</Text>
												<Text size="xs" c="dimmed">
													{c.health.latencyMs ? `${c.health.latencyMs} ms · ` : ""}
													{relative(c.health.checkedAt)}
												</Text>
											</td>
											<td className="oa-nowrap">
												<Text size="sm">{date(c.createdAt)}</Text>
											</td>
											<td onClick={(e) => e.stopPropagation()}>
												<Menu position="bottom-end" width={210} shadow="md">
													<Menu.Target>
														<ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${c.name}`}>
															<MoreVertical size={16} />
														</ActionIcon>
													</Menu.Target>
													<Menu.Dropdown>
														<Menu.Item component={Link} href={`/clients/${c.id}`}>
															Open client
														</Menu.Item>
														<Menu.Item leftSection={<ExternalLink size={14} />} component="a" href={`https://${c.adminHost}`} target="_blank" rel="noreferrer">
															Open admin address
														</Menu.Item>
														<Menu.Item leftSection={<LogIn size={14} />} disabled={!allowed("clients.impersonate")} onClick={() => setImpersonate(c.id)}>
															Sign in as owner
														</Menu.Item>
														<Menu.Divider />
														{c.status === "suspended" ? (
															<Menu.Item
																leftSection={<PlayCircle size={14} />}
																disabled={!allowed("clients.lifecycle")}
																onClick={() => setStatusTarget({ id: c.id, to: "active" })}
															>
																Reactivate
															</Menu.Item>
														) : (
															<Menu.Item
																color="red"
																leftSection={<PauseCircle size={14} />}
																disabled={!allowed("clients.lifecycle") || c.status === "cancelled"}
																onClick={() => setStatusTarget({ id: c.id, to: "suspended" })}
															>
																Suspend
															</Menu.Item>
														)}
													</Menu.Dropdown>
												</Menu>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>

			<Modal opened={healthOpen} onClose={() => setHealthOpen(false)} title={<Text fw={600}>Health check</Text>} size="lg">
				<Stack gap="xs">
					<Text size="sm" c="dimmed">
						Calls each client's health URL (https://admin-address/api/health unless one is set on the client). Suspended and cancelled tenants are skipped.
					</Text>
					{db.clients.map((c) => {
						const h = healthMeta[c.health.state];
						return (
							<Group key={c.id} justify="space-between" py={6} style={{ borderBottom: "1px solid var(--oa-border)" }} wrap="nowrap">
								<Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
									<EntityAvatar name={c.name} size={24} />
									<div style={{ minWidth: 0 }}>
										<Text size="sm" truncate>
											{c.name}
										</Text>
										<Text size="xs" c={c.health.error && !checking ? "red.7" : "dimmed"} truncate>
											{c.health.error && !checking ? c.health.error : c.adminHost}
										</Text>
									</div>
								</Group>
								{checking ? (
									<Text size="xs" c="dimmed">
										Checking…
									</Text>
								) : (
									<Group gap="xs" wrap="nowrap">
										<Text size="xs" c="dimmed">
											{c.health.latencyMs ? `${c.health.latencyMs} ms` : ""}
										</Text>
										<StatusPill label={h.label} color={h.color} />
									</Group>
								)}
							</Group>
						);
					})}
				</Stack>
			</Modal>

			{statusTarget && <StatusChangeModal clientId={statusTarget.id} to={statusTarget.to} onClose={() => setStatusTarget(null)} />}
			{impersonate && <ImpersonateModal clientId={impersonate} onClose={() => setImpersonate(null)} />}
		</>
	);
}
