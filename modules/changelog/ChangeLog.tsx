"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Anchor, Button, Group, Select, Text, TextInput, Tooltip } from "@mantine/core";
import { Download, History, Search } from "lucide-react";
import { useDb } from "@/lib/store";
import { dateTime, relative } from "@/lib/domain";
import { Card, EmptyState, PageHeader } from "@/components/ui";

const PAGE = 50;

export function ChangeLog() {
	const db = useDb();
	const [query, setQuery] = useState("");
	const [type, setType] = useState<string | null>(null);
	const [actor, setActor] = useState<string | null>(null);
	const [limit, setLimit] = useState(PAGE);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return db.audit.filter(
			(a) =>
				(!type || a.entityType === type) &&
				(!actor || a.actorId === actor) &&
				(!q || `${a.summary} ${a.entityName ?? ""} ${a.action} ${a.reason ?? ""}`.toLowerCase().includes(q)),
		);
	}, [db.audit, query, type, actor]);

	const exportJson = () => {
		const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `change-log-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const link = (entityType: string, id?: string) => (entityType === "client" && id && db.clients.some((c) => c.id === id) ? `/clients/${id}` : null);

	return (
		<>
			<PageHeader
				title="Change log"
				description="Append-only record of every change made from this console: who, what, when and why."
				actions={
					<Button variant="default" leftSection={<Download size={15} />} onClick={exportJson} disabled={!rows.length}>
						Export
					</Button>
				}
			/>
			<Card>
				<Group gap="xs" mb="sm" wrap="wrap">
					<TextInput size="sm" w={260} placeholder="Search changes" leftSection={<Search size={14} />} value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
					<Select
						size="sm"
						w={160}
						placeholder="Any area"
						clearable
						value={type}
						onChange={setType}
						data={["client", "plan", "product", "lead", "invoice", "ticket", "staff", "website", "settings", "session"]}
					/>
					<Select size="sm" w={170} placeholder="Anyone" clearable value={actor} onChange={setActor} data={db.staff.map((s) => ({ value: s.id, label: s.name }))} />
				</Group>
				{rows.length === 0 ? (
					<EmptyState icon={<History size={28} />} title="No changes match" />
				) : (
					<div className="oa-table-wrap">
						<table className="oa-table">
							<thead>
								<tr>
									<th>When</th>
									<th>Who</th>
									<th>What</th>
									<th>Change</th>
								</tr>
							</thead>
							<tbody>
								{rows.slice(0, limit).map((a) => {
									const href = link(a.entityType, a.entityId);
									return (
										<tr key={a.id}>
											<td style={{ whiteSpace: "nowrap" }}>
												<Tooltip label={dateTime(a.at)}>
													<Text size="sm">{relative(a.at)}</Text>
												</Tooltip>
											</td>
											<td>{a.actorName}</td>
											<td>
												{href ? (
													<Anchor component={Link} href={href} size="sm">
														{a.entityName}
													</Anchor>
												) : (
													<Text size="sm">{a.entityName ?? "—"}</Text>
												)}
												<Text size="xs" c="dimmed">
													<code>{a.action}</code>
												</Text>
											</td>
											<td>
												<Text size="sm">{a.summary}</Text>
												{a.reason && (
													<Text size="xs" c="dimmed">
														Reason: {a.reason}
													</Text>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
				{rows.length > limit && (
					<Group justify="center" mt="md">
						<Button variant="subtle" onClick={() => setLimit((l) => l + PAGE)}>
							Show more ({rows.length - limit} left)
						</Button>
					</Group>
				)}
			</Card>
		</>
	);
}
