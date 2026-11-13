"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Anchor, Box, Button, Group, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Text, Textarea } from "@mantine/core";
import { Headphones } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { dateTime, relative, ticketPriorityMeta, ticketStatusMeta } from "@/lib/domain";
import type { TicketPriority, TicketStatus } from "@/lib/types";
import { Card, CountPill, EmptyState, PageHeader, StatusPill } from "@/components/ui";

export function Support() {
	const db = useDb();
	const { updateTicket, allowed, busy } = useStore();
	const [filter, setFilter] = useState("active");
	const [selected, setSelected] = useState<string | null>(null);
	const [reply, setReply] = useState("");
	const canEdit = allowed("support.write");

	const tickets = useMemo(
		() =>
			[...db.tickets]
				.filter((t) => (filter === "active" ? t.status !== "resolved" : filter === "all" ? true : t.status === filter))
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
		[db.tickets, filter],
	);
	const ticket = db.tickets.find((t) => t.id === (selected ?? tickets[0]?.id));
	const client = ticket && db.clients.find((c) => c.id === ticket.clientId);
	const open = db.tickets.filter((t) => t.status === "open").length;

	return (
		<>
			<PageHeader
				title="Support"
				badge={<CountPill color="blue">{`${open} open`}</CountPill>}
				description="Tickets raised by client owners from their admin's help menu."
			/>
			<SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
				<Card padding={12}>
					<SegmentedControl
						fullWidth
						size="xs"
						mb="sm"
						value={filter}
						onChange={setFilter}
						data={[
							{ value: "active", label: "Active" },
							{ value: "resolved", label: "Resolved" },
							{ value: "all", label: "All" },
						]}
					/>
					{tickets.length === 0 ? (
						<EmptyState icon={<Headphones size={26} />} title="Inbox zero" />
					) : (
						<Stack gap={4}>
							{tickets.map((t) => {
								const active = t.id === ticket?.id;
								return (
									<Box
										key={t.id}
										component="button"
										onClick={() => {
											setSelected(t.id);
											setReply("");
										}}
										p={10}
										style={{
											textAlign: "left",
											border: `1px solid ${active ? "var(--mantine-color-brand-3)" : "var(--oa-border)"}`,
											background: active ? "var(--mantine-color-brand-0)" : "#fff",
											borderRadius: 8,
											cursor: "pointer",
											font: "inherit",
										}}
									>
										<Group justify="space-between" wrap="nowrap">
											<Text size="sm" fw={500} truncate>
												#{t.number} {t.subject}
											</Text>
										</Group>
										<Group justify="space-between" mt={4}>
											<Text size="xs" c="dimmed" truncate>
												{db.clients.find((c) => c.id === t.clientId)?.name} · {relative(t.updatedAt)}
											</Text>
											<StatusPill label={ticketPriorityMeta[t.priority].label} color={ticketPriorityMeta[t.priority].color} />
										</Group>
									</Box>
								);
							})}
						</Stack>
					)}
				</Card>

				<div className="oa-span-2">
					{ticket ? (
						<Card
							title={`#${ticket.number} ${ticket.subject}`}
							description={
								<>
									{client ? (
										<Anchor component={Link} href={`/clients/${client.id}`} size="xs">
											{client.name}
										</Anchor>
									) : (
										"Deleted client"
									)}{" "}
									· opened {dateTime(ticket.createdAt)}
								</>
							}
							actions={
								<>
									<Select
										size="xs"
										w={110}
										value={ticket.priority}
										disabled={!canEdit}
										data={Object.entries(ticketPriorityMeta).map(([value, m]) => ({ value, label: m.label }))}
										onChange={(v) => v && updateTicket(ticket.id, { priority: v as TicketPriority })}
										aria-label="Priority"
									/>
									<Select
										size="xs"
										w={160}
										value={ticket.status}
										disabled={!canEdit}
										data={Object.entries(ticketStatusMeta).map(([value, m]) => ({ value, label: m.label }))}
										onChange={(v) => v && updateTicket(ticket.id, { status: v as TicketStatus })}
										aria-label="Status"
									/>
								</>
							}
						>
							<ScrollArea.Autosize mah={420}>
								<Stack gap="sm">
									{ticket.messages.map((m) => (
										<Box
											key={m.id}
											p="sm"
											maw="85%"
											ml={m.fromClient ? 0 : "auto"}
											style={{ borderRadius: 10, background: m.fromClient ? "#f3f4f6" : "var(--mantine-color-brand-0)" }}
										>
											<Text size="xs" c="dimmed" mb={2}>
												{m.author} · {relative(m.at)}
											</Text>
											<Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
												{m.body}
											</Text>
										</Box>
									))}
								</Stack>
							</ScrollArea.Autosize>
							<Textarea mt="md" placeholder="Reply to the client…" minRows={3} autosize value={reply} onChange={(e) => setReply(e.currentTarget.value)} disabled={!canEdit} />
							<Group justify="flex-end" mt="xs">
								<Button
									variant="default"
									disabled={!canEdit || !reply.trim()}
									loading={busy}
									onClick={async () => {
										if (await updateTicket(ticket.id, { status: "resolved" }, reply.trim())) setReply("");
									}}
								>
									Reply & resolve
								</Button>
								<Button
									disabled={!canEdit || !reply.trim()}
									loading={busy}
									onClick={async () => {
										if (await updateTicket(ticket.id, { status: "pending" }, reply.trim())) setReply("");
									}}
								>
									Send reply
								</Button>
							</Group>
						</Card>
					) : (
						<Card>
							<EmptyState title="Select a ticket" />
						</Card>
					)}
				</div>
			</SimpleGrid>
		</>
	);
}
