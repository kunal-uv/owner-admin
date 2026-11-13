"use client";

import React, { useState } from "react";
import {
	ActionIcon,
	Alert,
	Badge,
	Code,
	CopyButton,
	Button,
	ColorInput,
	Drawer,
	Group,
	Select,
	SimpleGrid,
	Stack,
	Switch,
	Text,
	TextInput,
} from "@mantine/core";
import { Package, Plus, Trash2 } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { clientMrr, money, productStatusMeta, slugify, uid } from "@/lib/domain";
import type { FeatureDef, Product, ProductStatus } from "@/lib/types";
import { Card, PageHeader, StatusPill } from "@/components/ui";

export function Products() {
	const db = useDb();
	const { allowed } = useStore();
	const [editing, setEditing] = useState<Product | null>(null);

	const blank = (): Product => ({
		id: uid("prd"),
		key: "",
		name: "",
		tagline: "",
		status: "coming_soon",
		color: "#2563eb",
		adminHostPattern: `{slug}-admin.${db.settings.rootDomain}`,
		storefrontHostPattern: `{slug}.${db.settings.rootDomain}`,
		features: [{ key: "dashboard", name: "Dashboard", group: "Core", core: true }],
		createdAt: new Date().toISOString(),
	});

	return (
		<>
			<PageHeader
				title="Products"
				description="Everything you sell. Each product declares the features its app can switch on per client; plans pick from that list."
				actions={
					<Button leftSection={<Plus size={15} />} onClick={() => setEditing(blank())} disabled={!allowed("products.write")}>
						New product
					</Button>
				}
			/>
			<SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
				{db.products.map((p) => {
					const clients = db.clients.filter((c) => c.productId === p.id);
					const mrr = clients.reduce((s, c) => s + clientMrr(db, c), 0);
					const plans = db.plans.filter((pl) => pl.productId === p.id && pl.status === "active");
					const meta = productStatusMeta[p.status];
					return (
						<Card key={p.id}>
							<Group justify="space-between" align="flex-start" wrap="nowrap">
								<Group gap="sm" wrap="nowrap">
									<div style={{ width: 38, height: 38, borderRadius: 10, background: p.color, display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>
										<Package size={18} />
									</div>
									<div>
										<Group gap={6}>
											<Text fw={600}>{p.name}</Text>
											<StatusPill label={meta.label} color={meta.color} />
										</Group>
										<Text size="sm" c="dimmed">
											{p.tagline}
										</Text>
									</div>
								</Group>
								<Button size="xs" variant="default" onClick={() => setEditing(p)}>
									Edit
								</Button>
							</Group>
							<SimpleGrid cols={4} mt="md">
								{[
									["Clients", clients.length],
									["MRR", money(mrr)],
									["Plans", plans.length],
									["Features", p.features.length],
								].map(([label, value]) => (
									<div key={label as string}>
										<Text size="xs" c="dimmed">
											{label}
										</Text>
										<Text fw={600}>{value}</Text>
									</div>
								))}
							</SimpleGrid>
							<Text size="xs" c="dimmed" mt="md">
								New tenants get <code>{p.adminHostPattern}</code> and <code>{p.storefrontHostPattern}</code>
							</Text>
							<Group gap={4} mt="sm">
								{p.features.slice(0, 10).map((f) => (
									<Badge key={f.key} size="sm" variant="light" color="gray">
										{f.name}
									</Badge>
								))}
								{p.features.length > 10 && (
									<Badge size="sm" variant="transparent" color="gray">
										+{p.features.length - 10} more
									</Badge>
								)}
							</Group>
						</Card>
					);
				})}
			</SimpleGrid>
			{editing && <ProductEditor product={editing} onClose={() => setEditing(null)} />}
		</>
	);
}

function ProductEditor({ product, onClose }: { product: Product; onClose: () => void }) {
	const db = useDb();
	const { saveProduct, issueServiceKey, allowed, busy } = useStore();
	const [issuedKey, setIssuedKey] = useState<string | null>(null);
	const [draft, setDraft] = useState<Product>(product);
	const [newFeature, setNewFeature] = useState({ name: "", group: "" });
	const isNew = !db.products.some((p) => p.id === product.id);
	const set = (patch: Partial<Product>) => setDraft((d) => ({ ...d, ...patch }));
	const usedKeys = new Set(db.plans.filter((p) => p.productId === product.id).flatMap((p) => p.features));
	const keyTaken = db.products.some((p) => p.key === draft.key && p.id !== draft.id);
	const valid = draft.name.trim() && draft.key && !keyTaken && draft.adminHostPattern.includes("{slug}");

	const setFeature = (i: number, patch: Partial<FeatureDef>) => set({ features: draft.features.map((f, j) => (j === i ? { ...f, ...patch } : f)) });

	return (
		<Drawer opened onClose={onClose} position="right" size={560} title={<Text fw={600}>{isNew ? "New product" : `Edit ${product.name}`}</Text>}>
			<Stack gap="md">
				<SimpleGrid cols={2}>
					<TextInput label="Name" required value={draft.name} onChange={(e) => set({ name: e.currentTarget.value, key: isNew ? slugify(e.currentTarget.value) : draft.key })} />
					<TextInput label="Key" description="Sent in entitlements; fixed after create" value={draft.key} disabled={!isNew} onChange={(e) => set({ key: slugify(e.currentTarget.value) })} error={keyTaken ? "Key already used" : undefined} />
				</SimpleGrid>
				<TextInput label="Tagline" value={draft.tagline} onChange={(e) => set({ tagline: e.currentTarget.value })} />
				<SimpleGrid cols={2}>
					<Select
						label="Status"
						value={draft.status}
						onChange={(v) => set({ status: (v ?? "live") as ProductStatus })}
						data={Object.entries(productStatusMeta).map(([value, m]) => ({ value, label: m.label }))}
					/>
					<ColorInput label="Colour" value={draft.color} onChange={(color) => set({ color })} />
				</SimpleGrid>
				<TextInput label="Admin address pattern" description="{slug} is replaced with the client slug" value={draft.adminHostPattern} onChange={(e) => set({ adminHostPattern: e.currentTarget.value })} error={!draft.adminHostPattern.includes("{slug}") ? "Must contain {slug}" : undefined} />
				<TextInput label="Storefront address pattern" value={draft.storefrontHostPattern} onChange={(e) => set({ storefrontHostPattern: e.currentTarget.value })} />

				<div>
					<Text fw={600} size="sm">
						Feature catalogue
					</Text>
					<Text size="xs" c="dimmed" mb="xs">
						Keys must match the flags the product's app checks. Core features are always on.
					</Text>
					<Stack gap={6}>
						{draft.features.map((f, i) => (
							<Group key={f.key} gap={6} wrap="nowrap">
								<TextInput size="xs" value={f.name} onChange={(e) => setFeature(i, { name: e.currentTarget.value })} style={{ flex: 2 }} aria-label="Feature name" />
								<TextInput size="xs" value={f.group} onChange={(e) => setFeature(i, { group: e.currentTarget.value })} style={{ flex: 1 }} aria-label="Group" />
								<Text size="xs" c="dimmed" w={110} truncate>
									{f.key}
								</Text>
								<Switch size="xs" label="core" checked={!!f.core} onChange={(e) => setFeature(i, { core: e.currentTarget.checked })} />
								<ActionIcon
									variant="subtle"
									color="red"
									size="sm"
									disabled={usedKeys.has(f.key)}
									title={usedKeys.has(f.key) ? "Used by a plan — remove it from plans first" : "Remove"}
									onClick={() => set({ features: draft.features.filter((_, j) => j !== i) })}
								>
									<Trash2 size={14} />
								</ActionIcon>
							</Group>
						))}
					</Stack>
					<Group gap={6} mt="sm" wrap="nowrap">
						<TextInput size="xs" placeholder="New feature name" value={newFeature.name} onChange={(e) => setNewFeature({ ...newFeature, name: e.currentTarget.value })} style={{ flex: 2 }} />
						<TextInput size="xs" placeholder="Group" value={newFeature.group} onChange={(e) => setNewFeature({ ...newFeature, group: e.currentTarget.value })} style={{ flex: 1 }} />
						<Button
							size="xs"
							variant="default"
							disabled={!newFeature.name.trim() || draft.features.some((f) => f.key === slugify(newFeature.name).replace(/-/g, "_"))}
							onClick={() => {
								set({ features: [...draft.features, { key: slugify(newFeature.name).replace(/-/g, "_"), name: newFeature.name.trim(), group: newFeature.group.trim() || "Other" }] });
								setNewFeature({ name: "", group: newFeature.group });
							}}
						>
							Add
						</Button>
					</Group>
				</div>
				{!isNew && (
					<div>
						<Text fw={600} size="sm">
							Service API key
						</Text>
						<Text size="xs" c="dimmed" mb="xs">
							{product.name}&apos;s backend sends this as <code>Authorization: Bearer …</code> to read entitlements, report usage, exchange sign-in tokens and open support tickets.
						</Text>
						{issuedKey ? (
							<Alert color="orange" variant="light" title="Copy it now — it won't be shown again">
								<Group gap="xs" wrap="nowrap">
									<Code style={{ overflowWrap: "anywhere", flex: 1 }}>{issuedKey}</Code>
									<CopyButton value={issuedKey}>
										{({ copied, copy }) => (
											<Button size="xs" variant="default" onClick={copy}>
												{copied ? "Copied" : "Copy"}
											</Button>
										)}
									</CopyButton>
								</Group>
							</Alert>
						) : (
							<Group gap="sm">
								<Text size="sm">{product.serviceKeyHint ? `Active key ends in …${product.serviceKeyHint}` : "No key issued yet."}</Text>
								<Button
									size="xs"
									variant="light"
									color={product.serviceKeyHint ? "orange" : undefined}
									loading={busy}
									disabled={!allowed("products.write")}
									onClick={async () => {
										if (product.serviceKeyHint && !window.confirm("Rotate the key? The current key stops working immediately.")) return;
										setIssuedKey(await issueServiceKey(product.id));
									}}
								>
									{product.serviceKeyHint ? "Rotate key" : "Generate key"}
								</Button>
							</Group>
						)}
					</div>
				)}
				<Group justify="flex-end" mt="md">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={!valid || !allowed("products.write")}
						loading={busy}
						onClick={async () => {
							if (await saveProduct(draft, isNew)) onClose();
						}}
					>
						{isNew ? "Add product" : "Save changes"}
					</Button>
				</Group>
			</Stack>
		</Drawer>
	);
}
