"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Anchor, Badge, Button, Group, SegmentedControl, SimpleGrid, Tabs, Text, TextInput } from "@mantine/core";
import { Download, Search } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { clientMrr, clientPrice, clientStatusMeta, date, daysUntil, invoiceStatusMeta, money, planOf } from "@/lib/domain";
import { Card, EmptyState, PageHeader, Stat, StatusPill } from "@/components/ui";

export function Billing() {
	const db = useDb();
	const { setInvoiceStatus, allowed } = useStore();
	const [tab, setTab] = useState<string | null>("invoices");
	const [status, setStatus] = useState("all");
	const [query, setQuery] = useState("");
	const canBill = allowed("billing.write");

	const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? "Deleted client";

	const invoices = useMemo(() => {
		const q = query.trim().toLowerCase();
		return db.invoices.filter((i) => (status === "all" || i.status === status) && (!q || `${i.number} ${clientName(i.clientId)}`.toLowerCase().includes(q)));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [db.invoices, status, query]);

	const now = new Date();
	const collected = db.invoices
		.filter((i) => i.paidAt && new Date(i.paidAt).getMonth() === now.getMonth() && new Date(i.paidAt).getFullYear() === now.getFullYear())
		.reduce((s, i) => s + i.total, 0);
	const open = db.invoices.filter((i) => i.status === "open").reduce((s, i) => s + i.total, 0);
	const overdue = db.invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.total, 0);
	const mrr = db.clients.reduce((s, c) => s + clientMrr(db, c), 0);

	const exportCsv = () => {
		const header = ["number", "client", "status", "currency", "subtotal", "discount", "tax", "total", "issued", "due", "paid"];
		const lines = invoices.map((i) =>
			[i.number, clientName(i.clientId), i.status, i.currency, i.subtotal, i.discount, i.tax, i.total, i.issuedAt, i.dueAt, i.paidAt ?? ""]
				.map((v) => `"${String(v).replace(/"/g, '""')}"`)
				.join(","),
		);
		const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(a.href);
	};

	return (
		<>
			<PageHeader title="Billing" description={`Dunning: retry every ${db.settings.dunning.retryEveryDays} days, suspend after ${db.settings.dunning.suspendAfterDays}, cancel after ${db.settings.dunning.cancelAfterDays}.`} />
			<SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
				<Stat label="MRR" value={money(mrr)} />
				<Stat label="Collected this month" value={money(collected)} />
				<Stat label="Open" value={money(open)} hint={`${db.invoices.filter((i) => i.status === "open").length} invoices`} />
				<Stat label="Overdue" value={money(overdue)} tone={overdue ? "bad" : "good"} hint={overdue ? "Dunning in progress" : "Nothing overdue"} />
			</SimpleGrid>

			<Tabs value={tab} onChange={setTab}>
				<Tabs.List mb="md">
					<Tabs.Tab value="invoices">Invoices</Tabs.Tab>
					<Tabs.Tab value="subscriptions">Subscriptions</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="invoices">
					<Card>
						<Group justify="space-between" mb="sm" wrap="wrap">
							<Group gap="xs" wrap="wrap">
								<TextInput size="sm" w={240} placeholder="Invoice number or client" leftSection={<Search size={14} />} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
								<SegmentedControl
									size="xs"
									value={status}
									onChange={setStatus}
									data={[
										{ value: "all", label: "All" },
										{ value: "open", label: "Open" },
										{ value: "overdue", label: "Overdue" },
										{ value: "paid", label: "Paid" },
										{ value: "void", label: "Void" },
									]}
								/>
							</Group>
							<Button size="xs" variant="default" leftSection={<Download size={14} />} onClick={exportCsv} disabled={!invoices.length}>
								Export CSV
							</Button>
						</Group>
						{invoices.length === 0 ? (
							<EmptyState title="No invoices match" />
						) : (
							<div className="oa-table-wrap">
								<table className="oa-table">
									<thead>
										<tr>
											<th>Number</th>
											<th>Client</th>
											<th>Issued</th>
											<th>Due</th>
											<th style={{ textAlign: "right" }}>Total</th>
											<th>Status</th>
											<th />
										</tr>
									</thead>
									<tbody>
										{invoices.map((i) => (
											<tr key={i.id}>
												<td>{i.number}</td>
												<td>
													<Anchor component={Link} href={`/clients/${i.clientId}`} size="sm">
														{clientName(i.clientId)}
													</Anchor>
												</td>
												<td>{date(i.issuedAt)}</td>
												<td>{date(i.dueAt)}</td>
												<td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(i.total, i.currency)}</td>
												<td>
													<StatusPill label={invoiceStatusMeta[i.status].label} color={invoiceStatusMeta[i.status].color} />
												</td>
												<td style={{ textAlign: "right" }}>
													{["open", "overdue"].includes(i.status) && (
														<Group gap={4} justify="flex-end" wrap="nowrap">
															<Button size="xs" variant="light" color="green" disabled={!canBill} onClick={() => setInvoiceStatus(i.id, "paid")}>
																Mark paid
															</Button>
															<Button size="xs" variant="subtle" color="gray" disabled={!canBill} onClick={() => setInvoiceStatus(i.id, "void")}>
																Void
															</Button>
														</Group>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</Card>
				</Tabs.Panel>

				<Tabs.Panel value="subscriptions">
					<Card>
						<div className="oa-table-wrap">
							<table className="oa-table">
								<thead>
									<tr>
										<th>Client</th>
										<th>Plan</th>
										<th>Status</th>
										<th style={{ textAlign: "right" }}>Price</th>
										<th style={{ textAlign: "right" }}>MRR</th>
										<th>Renews / trial ends</th>
									</tr>
								</thead>
								<tbody>
									{db.clients.map((c) => {
										const plan = planOf(db, c);
										const end = c.status === "trial" ? c.trialEndsAt : c.currentPeriodEnd;
										const d = daysUntil(end);
										return (
											<tr key={c.id}>
												<td>
													<Anchor component={Link} href={`/clients/${c.id}`} size="sm">
														{c.name}
													</Anchor>
												</td>
												<td>
													<Badge variant="light" color="violet">
														{plan?.name}
													</Badge>{" "}
													<Text span size="xs" c="dimmed">
														{c.billingCycle}
													</Text>
												</td>
												<td>
													<StatusPill label={clientStatusMeta[c.status].label} color={clientStatusMeta[c.status].color} />
												</td>
												<td style={{ textAlign: "right" }}>{money(clientPrice(plan, c.billingCycle), plan?.currency)}</td>
												<td style={{ textAlign: "right" }}>{money(clientMrr(db, c), plan?.currency)}</td>
												<td>
													{date(end)}{" "}
													<Text span size="xs" c={d < 0 ? "red.7" : d <= 7 ? "orange.7" : "dimmed"}>
														({d < 0 ? `${-d} days ago` : `in ${d} days`})
													</Text>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</Card>
				</Tabs.Panel>
			</Tabs>
		</>
	);
}
