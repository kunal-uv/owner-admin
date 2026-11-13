"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Anchor, Button, Drawer, Group, Modal, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { Inbox, Plus } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { date, leadStatusMeta, relative, uid } from "@/lib/domain";
import type { Lead, LeadSource, LeadStatus } from "@/lib/types";
import { Card, CountPill, EmptyState, KeyValue, PageHeader, StatusPill } from "@/components/ui";

const sources: LeadSource[] = ["website", "referral", "sales", "event", "partner"];

export function Leads() {
	const db = useDb();
	const { allowed } = useStore();
	const [filter, setFilter] = useState("open");
	const [openId, setOpenId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);

	const rows = useMemo(
		() =>
			db.leads.filter((l) => {
				if (filter === "open") return !["won", "lost"].includes(l.status);
				if (filter === "all") return true;
				return l.status === filter;
			}),
		[db.leads, filter],
	);
	const fresh = db.leads.filter((l) => l.status === "new").length;

	return (
		<>
			<PageHeader
				title="New leads"
				badge={<CountPill color="blue">{`${fresh} new`}</CountPill>}
				description="Prospects from the website form, referrals and sales. Convert a lead to provision a client with their details filled in."
				actions={
					<Button leftSection={<Plus size={15} />} onClick={() => setCreating(true)} disabled={!allowed("leads.write")}>
						Add lead
					</Button>
				}
			/>
			<Card>
				<SegmentedControl
					mb="sm"
					size="xs"
					value={filter}
					onChange={setFilter}
					data={[
						{ value: "open", label: "Open" },
						{ value: "new", label: "New" },
						{ value: "won", label: "Won" },
						{ value: "lost", label: "Lost" },
						{ value: "all", label: "All" },
					]}
				/>
				{rows.length === 0 ? (
					<EmptyState icon={<Inbox size={28} />} title="No leads here">
						Website enquiries land here automatically when the lead form is on.
					</EmptyState>
				) : (
					<div className="oa-table-wrap">
						<table className="oa-table">
							<thead>
								<tr>
									<th>Lead</th>
									<th>Interested in</th>
									<th>Source</th>
									<th>Status</th>
									<th>Owner</th>
									<th>Received</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((l) => {
									const plan = db.plans.find((p) => p.id === l.planId);
									const product = db.products.find((p) => p.id === l.productId);
									return (
										<tr key={l.id} data-clickable="true" onClick={() => setOpenId(l.id)}>
											<td>
												<Text size="sm" fw={500}>
													{l.company || l.name}
												</Text>
												<Text size="xs" c="dimmed">
													{l.name} · {l.email}
												</Text>
											</td>
											<td>
												{product?.name}
												{plan ? ` · ${plan.name}` : ""}
											</td>
											<td style={{ textTransform: "capitalize" }}>{l.source}</td>
											<td>
												<StatusPill label={leadStatusMeta[l.status].label} color={leadStatusMeta[l.status].color} />
											</td>
											<td>{db.staff.find((s) => s.id === l.assigneeId)?.name ?? <Text size="sm" c="dimmed">Unassigned</Text>}</td>
											<td>{relative(l.createdAt)}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>
			{openId && <LeadDrawer id={openId} onClose={() => setOpenId(null)} />}
			{creating && <NewLeadModal onClose={() => setCreating(false)} />}
		</>
	);
}

function LeadDrawer({ id, onClose }: { id: string; onClose: () => void }) {
	const db = useDb();
	const { saveLead, allowed } = useStore();
	const router = useRouter();
	const lead = db.leads.find((l) => l.id === id);
	const [lostReason, setLostReason] = useState("");
	const [losing, setLosing] = useState(false);
	if (!lead) return null;
	const canEdit = allowed("leads.write");
	// The change log records what changed; no toast for every dropdown.
	const update = (patch: Partial<Lead>, _summary?: string) => saveLead({ ...lead, ...patch }, false);
	const client = lead.clientId && db.clients.find((c) => c.id === lead.clientId);

	return (
		<Drawer opened onClose={onClose} position="right" size={460} title={<Text fw={600}>{lead.company || lead.name}</Text>}>
			<Stack gap="md">
				<div>
					<KeyValue label="Contact">{lead.name}</KeyValue>
					<KeyValue label="Email">
						<Anchor href={`mailto:${lead.email}`} size="sm">
							{lead.email}
						</Anchor>
					</KeyValue>
					<KeyValue label="Phone">{lead.phone || "—"}</KeyValue>
					<KeyValue label="Source">{lead.source}</KeyValue>
					<KeyValue label="Received">{date(lead.createdAt)}</KeyValue>
				</div>
				<Text size="sm" bg="gray.0" p="sm" style={{ borderRadius: 8 }}>
					{lead.message || "No message."}
				</Text>
				<SimpleGrid cols={2}>
					<Select
						label="Status"
						value={lead.status}
						disabled={!canEdit || lead.status === "won"}
						data={Object.entries(leadStatusMeta)
							.filter(([k]) => k !== "won" && k !== "lost")
							.map(([value, m]) => ({ value, label: m.label }))
							.concat(lead.status === "won" || lead.status === "lost" ? [{ value: lead.status, label: leadStatusMeta[lead.status].label }] : [])}
						onChange={(v) => v && update({ status: v as LeadStatus }, `Status → ${leadStatusMeta[v as LeadStatus].label}`)}
					/>
					<Select
						label="Owner"
						clearable
						disabled={!canEdit}
						value={lead.assigneeId ?? null}
						data={db.staff.filter((s) => s.status === "active").map((s) => ({ value: s.id, label: s.name }))}
						onChange={(v) => update({ assigneeId: v ?? undefined }, `Assigned to ${db.staff.find((s) => s.id === v)?.name ?? "nobody"}`)}
					/>
					<Select
						label="Product"
						disabled={!canEdit}
						value={lead.productId}
						data={db.products.map((p) => ({ value: p.id, label: p.name }))}
						onChange={(v) => v && update({ productId: v, planId: undefined }, "Changed product of interest")}
					/>
					<Select
						label="Plan"
						clearable
						disabled={!canEdit}
						value={lead.planId ?? null}
						data={db.plans.filter((p) => p.productId === lead.productId && p.status === "active").map((p) => ({ value: p.id, label: p.name }))}
						onChange={(v) => update({ planId: v ?? undefined }, "Changed plan of interest")}
					/>
				</SimpleGrid>
				{lead.status === "lost" && lead.lostReason && (
					<Text size="sm" c="dimmed">
						Lost: {lead.lostReason}
					</Text>
				)}
				{client ? (
					<Button component={Link} href={`/clients/${client.id}`} variant="light">
						Open client {client.name}
					</Button>
				) : (
					<Group grow>
						<Button variant="default" color="red" disabled={!canEdit || lead.status === "lost"} onClick={() => setLosing(true)}>
							Mark lost
						</Button>
						<Button disabled={!allowed("clients.write") || lead.status === "lost"} onClick={() => router.push(`/clients/new?lead=${lead.id}`)}>
							Convert to client
						</Button>
					</Group>
				)}
				{losing && (
					<Stack gap="xs">
						<Textarea label="Why was it lost?" value={lostReason} onChange={(e) => setLostReason(e.currentTarget.value)} />
						<Group justify="flex-end">
							<Button size="xs" variant="default" onClick={() => setLosing(false)}>
								Cancel
							</Button>
							<Button
								size="xs"
								color="red"
								disabled={lostReason.trim().length < 3}
								onClick={async () => {
									if (await update({ status: "lost", lostReason: lostReason.trim() })) setLosing(false);
								}}
							>
								Mark lost
							</Button>
						</Group>
					</Stack>
				)}
			</Stack>
		</Drawer>
	);
}

function NewLeadModal({ onClose }: { onClose: () => void }) {
	const db = useDb();
	const { saveLead, busy } = useStore();
	const [lead, setLead] = useState<Lead>({
		id: uid("ld"),
		name: "",
		company: "",
		email: "",
		phone: "",
		productId: db.products[0]?.id ?? "",
		source: "sales",
		status: "new",
		message: "",
		createdAt: new Date().toISOString(),
	});
	const set = (patch: Partial<Lead>) => setLead((l) => ({ ...l, ...patch }));
	const valid = lead.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email);

	return (
		<Modal opened onClose={onClose} title={<Text fw={600}>Add lead</Text>} size="lg">
			<Stack>
				<SimpleGrid cols={2}>
					<TextInput label="Name" required value={lead.name} onChange={(e) => set({ name: e.currentTarget.value })} />
					<TextInput label="Company" value={lead.company} onChange={(e) => set({ company: e.currentTarget.value })} />
					<TextInput label="Email" required type="email" value={lead.email} onChange={(e) => set({ email: e.currentTarget.value })} />
					<TextInput label="Phone" value={lead.phone} onChange={(e) => set({ phone: e.currentTarget.value })} />
					<Select label="Product" value={lead.productId} data={db.products.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => v && set({ productId: v })} />
					<Select label="Source" value={lead.source} data={sources} onChange={(v) => v && set({ source: v as LeadSource })} />
				</SimpleGrid>
				<Textarea label="Notes" value={lead.message} onChange={(e) => set({ message: e.currentTarget.value })} />
				<Group justify="flex-end">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid}
						loading={busy}
						onClick={async () => {
							if (await saveLead(lead, true, "Lead added.")) onClose();
						}}
					>
						Add lead
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
