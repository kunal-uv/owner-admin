"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	ActionIcon,
	Badge,
	Button,
	Checkbox,
	Drawer,
	Group,
	Menu,
	NumberInput,
	SegmentedControl,
	SimpleGrid,
	Stack,
	Switch,
	Tabs,
	Text,
	Textarea,
	TextInput,
} from "@mantine/core";
import { Archive, ArchiveRestore, CopyPlus, MoreVertical, Pencil, Plus } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { limitFields, limitLabel, money, slugify, uid } from "@/lib/domain";
import type { Plan } from "@/lib/types";
import { Card, CountPill, EmptyState, PageHeader } from "@/components/ui";

export function Plans() {
	const db = useDb();
	const { setPlanStatus, allowed } = useStore();
	const params = useSearchParams();
	const router = useRouter();
	const [productId, setProductId] = useState<string | null>(db.products[0]?.id ?? null);
	const [showArchived, setShowArchived] = useState(false);
	const [editing, setEditing] = useState<Plan | null>(null);

	// Deep link from the command palette: /plans?edit=<id>
	useEffect(() => {
		const id = params?.get("edit");
		const plan = id && db.plans.find((p) => p.id === id);
		if (plan) {
			setProductId(plan.productId);
			setEditing(plan);
			router.replace("/plans");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [params]);

	const product = db.products.find((p) => p.id === productId);
	const plans = db.plans
		.filter((p) => p.productId === productId && (showArchived || p.status === "active"))
		.sort((a, b) => a.sortOrder - b.sortOrder);
	const subscribers = (id: string) => db.clients.filter((c) => c.planId === id && c.status !== "cancelled").length;

	const blank = (): Plan => ({
		id: uid("pl"),
		productId: productId!,
		name: "",
		code: "",
		description: "",
		currency: db.settings.defaultCurrency,
		priceMonthly: 0,
		priceYearly: 0,
		trialDays: 14,
		limits: { stores: 1, staffUsers: 5, products: 500, ordersPerMonth: -1, storageGb: 5 },
		features: product?.features.filter((f) => f.core).map((f) => f.key) ?? [],
		status: "active",
		isPublic: true,
		sortOrder: plans.length + 1,
		createdAt: new Date().toISOString(),
	});

	const duplicate = (p: Plan): Plan => ({ ...structuredClone(p), id: uid("pl"), name: `${p.name} copy`, code: `${p.code}-copy`, isPublic: false, highlighted: false, createdAt: new Date().toISOString() });

	return (
		<>
			<PageHeader
				title="Plans"
				badge={<CountPill color="violet">{`${db.plans.filter((p) => p.status === "active").length} active`}</CountPill>}
				description="What each product costs and what it includes. Changing a plan updates every client on it, except their own overrides."
				actions={
					<Button leftSection={<Plus size={15} />} onClick={() => setEditing(blank())} disabled={!allowed("plans.write") || !product}>
						New plan
					</Button>
				}
			/>

			<Group justify="space-between" mb="md" wrap="wrap">
				<Tabs value={productId} onChange={setProductId} variant="pills">
					<Tabs.List>
						{db.products.map((p) => (
							<Tabs.Tab key={p.id} value={p.id}>
								{p.name}
							</Tabs.Tab>
						))}
					</Tabs.List>
				</Tabs>
				<Switch label="Show archived" checked={showArchived} onChange={(e) => setShowArchived(e.currentTarget.checked)} size="sm" />
			</Group>

			{plans.length === 0 ? (
				<Card>
					<EmptyState title="No plans for this product yet">Create a plan so clients can subscribe to {product?.name}.</EmptyState>
				</Card>
			) : (
				<SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
					{plans.map((p) => (
						<div key={p.id} className="oa-card" style={{ opacity: p.status === "archived" ? 0.6 : 1, borderColor: p.highlighted ? "var(--mantine-color-brand-4)" : undefined }}>
							<Group justify="space-between" align="flex-start" wrap="nowrap">
								<div>
									<Group gap={6}>
										<Text fw={600}>{p.name}</Text>
										{p.highlighted && (
											<Badge size="xs" variant="light">
												most popular
											</Badge>
										)}
										{!p.isPublic && (
											<Badge size="xs" variant="light" color="gray">
												private
											</Badge>
										)}
										{p.status === "archived" && (
											<Badge size="xs" variant="light" color="gray">
												archived
											</Badge>
										)}
									</Group>
									<Text size="xs" c="dimmed">
										{p.code}
									</Text>
								</div>
								<Menu position="bottom-end" shadow="md" width={180}>
									<Menu.Target>
										<ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${p.name}`}>
											<MoreVertical size={16} />
										</ActionIcon>
									</Menu.Target>
									<Menu.Dropdown>
										<Menu.Item leftSection={<Pencil size={14} />} onClick={() => setEditing(p)}>
											Edit
										</Menu.Item>
										<Menu.Item leftSection={<CopyPlus size={14} />} onClick={() => setEditing(duplicate(p))} disabled={!allowed("plans.write")}>
											Duplicate
										</Menu.Item>
										{p.status === "active" ? (
											<Menu.Item leftSection={<Archive size={14} />} color="red" disabled={!allowed("plans.write")} onClick={() => setPlanStatus(p.id, "archived")}>
												Archive
											</Menu.Item>
										) : (
											<Menu.Item leftSection={<ArchiveRestore size={14} />} disabled={!allowed("plans.write")} onClick={() => setPlanStatus(p.id, "active")}>
												Restore
											</Menu.Item>
										)}
									</Menu.Dropdown>
								</Menu>
							</Group>
							<Text fz={26} fw={600} mt="sm">
								{money(p.priceMonthly, p.currency)}
								<Text span size="sm" c="dimmed">
									/mo
								</Text>
							</Text>
							<Text size="xs" c="dimmed">
								{money(p.priceYearly, p.currency)}/yr{p.trialDays ? ` · ${p.trialDays}-day trial` : " · no trial"}
							</Text>
							<Text size="sm" mt="sm" mih={40}>
								{p.description}
							</Text>
							<Stack gap={4} mt="sm" pt="sm" style={{ borderTop: "1px solid var(--oa-border)" }}>
								{limitFields.map((f) => (
									<Group key={f.key} justify="space-between">
										<Text size="xs" c="dimmed">
											{f.label}
										</Text>
										<Text size="xs" fw={500}>
											{limitLabel(p.limits[f.key])}
											{f.unit && p.limits[f.key] >= 0 ? ` ${f.unit}` : ""}
										</Text>
									</Group>
								))}
								<Group justify="space-between">
									<Text size="xs" c="dimmed">
										Features
									</Text>
									<Text size="xs" fw={500}>
										{p.features.length} / {product?.features.length}
									</Text>
								</Group>
							</Stack>
							<Group justify="space-between" mt="md">
								<Text size="xs" c="dimmed">
									{subscribers(p.id)} client{subscribers(p.id) === 1 ? "" : "s"}
								</Text>
								<Button size="xs" variant="light" onClick={() => setEditing(p)}>
									Edit plan
								</Button>
							</Group>
						</div>
					))}
				</SimpleGrid>
			)}

			<div style={{ height: 16 }} />
			{product && (
				<Card title="Feature matrix" description="Compare what each plan includes." padding={16}>
					<FeatureMatrix productId={product.id} plans={plans} />
				</Card>
			)}

			{editing && <PlanEditor plan={editing} onClose={() => setEditing(null)} />}
		</>
	);
}

function FeatureMatrix({ productId, plans }: { productId: string; plans: Plan[] }) {
	const db = useDb();
	const product = db.products.find((p) => p.id === productId)!;
	return (
		<div className="oa-table-wrap" style={{ marginTop: 8 }}>
			<table className="oa-table">
				<thead>
					<tr>
						<th>Feature</th>
						{plans.map((p) => (
							<th key={p.id} style={{ textAlign: "center" }}>
								{p.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{product.features.map((f) => (
						<tr key={f.key}>
							<td>
								<Text size="sm">{f.name}</Text>
								<Text size="xs" c="dimmed">
									{f.group}
								</Text>
							</td>
							{plans.map((p) => (
								<td key={p.id} style={{ textAlign: "center" }} aria-label={p.features.includes(f.key) ? "Included" : "Not included"}>
									{p.features.includes(f.key) ? <Text c="green.7">✓</Text> : <Text c="gray.4">—</Text>}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function PlanEditor({ plan, onClose }: { plan: Plan; onClose: () => void }) {
	const db = useDb();
	const { savePlan, allowed, busy } = useStore();
	const [draft, setDraft] = useState<Plan>(plan);
	const product = db.products.find((p) => p.id === draft.productId)!;
	const isNew = !db.plans.some((p) => p.id === plan.id);
	const canEdit = allowed("plans.write");
	const set = (patch: Partial<Plan>) => setDraft((d) => ({ ...d, ...patch }));
	const subs = db.clients.filter((c) => c.planId === plan.id && c.status !== "cancelled").length;

	const groups = useMemo(() => {
		const map = new Map<string, typeof product.features>();
		product.features.forEach((f) => map.set(f.group, [...(map.get(f.group) ?? []), f]));
		return Array.from(map.entries());
	}, [product]);

	const codeTaken = db.plans.some((p) => p.code === draft.code && p.id !== draft.id);
	const valid = draft.name.trim() && draft.code.trim() && !codeTaken && draft.priceMonthly >= 0;
	const yearlySaving = draft.priceMonthly > 0 ? Math.round((1 - draft.priceYearly / (draft.priceMonthly * 12)) * 100) : 0;

	return (
		<Drawer opened onClose={onClose} position="right" size={560} title={<Text fw={600}>{isNew ? "New plan" : `Edit ${plan.name}`}</Text>}>
			<Stack gap="md">
				{!isNew && subs > 0 && (
					<Text size="xs" c="orange.8" bg="orange.0" p={8} style={{ borderRadius: 6 }}>
						{subs} client{subs === 1 ? " is" : "s are"} on this plan. Feature and limit changes apply to them immediately; price changes apply from their next renewal.
					</Text>
				)}
				<SimpleGrid cols={2}>
					<TextInput
						label="Name"
						required
						value={draft.name}
						onChange={(e) => {
							const name = e.currentTarget.value;
							set({ name, code: isNew ? `${product.key.slice(0, 3)}-${slugify(name)}` : draft.code });
						}}
					/>
					<TextInput label="Code" description="Used by billing & the API" required value={draft.code} onChange={(e) => set({ code: slugify(e.currentTarget.value) })} error={codeTaken ? "Code already used" : undefined} />
				</SimpleGrid>
				<Textarea label="Description" minRows={2} value={draft.description} onChange={(e) => set({ description: e.currentTarget.value })} />
				<SimpleGrid cols={3}>
					<NumberInput label="Monthly price" prefix="$" min={0} value={draft.priceMonthly} onChange={(v) => set({ priceMonthly: Number(v) || 0 })} />
					<NumberInput
						label="Yearly price"
						prefix="$"
						min={0}
						value={draft.priceYearly}
						onChange={(v) => set({ priceYearly: Number(v) || 0 })}
						description={yearlySaving > 0 ? `${yearlySaving}% off monthly` : undefined}
					/>
					<NumberInput label="Trial days" min={0} max={90} value={draft.trialDays} onChange={(v) => set({ trialDays: Number(v) || 0 })} />
				</SimpleGrid>
				<Group>
					<Switch label="Show on pricing page" checked={draft.isPublic} onChange={(e) => set({ isPublic: e.currentTarget.checked })} />
					<Switch label="Mark as most popular" checked={!!draft.highlighted} onChange={(e) => set({ highlighted: e.currentTarget.checked })} />
				</Group>

				<div>
					<Text fw={600} size="sm" mb={4}>
						Limits
					</Text>
					<Text size="xs" c="dimmed" mb="xs">
						-1 means unlimited.
					</Text>
					<SimpleGrid cols={{ base: 2, sm: 3 }}>
						{limitFields.map((f) => (
							<NumberInput
								key={f.key}
								label={f.label}
								min={-1}
								allowDecimal={f.key === "storageGb"}
								value={draft.limits[f.key]}
								onChange={(v) => set({ limits: { ...draft.limits, [f.key]: v === "" ? 0 : Number(v) } })}
							/>
						))}
					</SimpleGrid>
				</div>

				<div>
					<Group justify="space-between" mb="xs">
						<Text fw={600} size="sm">
							Features ({draft.features.length}/{product.features.length})
						</Text>
						<SegmentedControl
							size="xs"
							data={["None", "All"]}
							value=""
							onChange={(v) => set({ features: v === "All" ? product.features.map((f) => f.key) : product.features.filter((f) => f.core).map((f) => f.key) })}
						/>
					</Group>
					<Stack gap="sm">
						{groups.map(([group, features]) => (
							<div key={group}>
								<Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
									{group}
								</Text>
								<SimpleGrid cols={2} spacing={6}>
									{features.map((f) => (
										<Checkbox
											key={f.key}
											size="sm"
											label={f.name}
											disabled={f.core}
											checked={f.core || draft.features.includes(f.key)}
											onChange={(e) =>
												set({
													features: e.currentTarget.checked ? [...draft.features, f.key] : draft.features.filter((k) => k !== f.key),
												})
											}
										/>
									))}
								</SimpleGrid>
							</div>
						))}
					</Stack>
				</div>
			</Stack>
			<Group
				justify="flex-end"
				py="md"
				mt="md"
				style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid var(--oa-border)", zIndex: 2 }}
			>
				<Button variant="default" onClick={onClose}>
					Cancel
				</Button>
				<Button
					disabled={!valid || !canEdit}
					loading={busy}
					onClick={async () => {
						if (await savePlan({ ...draft, name: draft.name.trim() }, isNew)) onClose();
					}}
				>
					{isNew ? "Create plan" : "Save changes"}
				</Button>
			</Group>
		</Drawer>
	);
}
