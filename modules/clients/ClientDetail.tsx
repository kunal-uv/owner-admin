"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	ActionIcon,
	Anchor,
	Badge,
	Button,
	CopyButton,
	Group,
	Menu,
	NumberInput,
	SimpleGrid,
	Stack,
	Switch,
	Tabs,
	TagsInput,
	Text,
	Textarea,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
	Activity,
	ArrowLeft,
	Check,
	Copy,
	ExternalLink,
	LogIn,
	MoreVertical,
	PauseCircle,
	PlayCircle,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import {
	clientMrr,
	clientPrice,
	clientStatusMeta,
	date,
	dateTime,
	daysUntil,
	effectiveFeatures,
	effectiveLimits,
	entitlementPayload,
	healthMeta,
	invoiceStatusMeta,
	limitFields,
	limitLabel,
	money,
	planOf,
	productOf,
	relative,
} from "@/lib/domain";
import type { Client, Limits } from "@/lib/types";
import { Card, EmptyState, EntityAvatar, KeyValue, PageHeader, StatusPill, UsageBar } from "@/components/ui";
import { ChangePlanModal, ImpersonateModal, StatusChangeModal, type StatusTarget } from "./ClientDialogs";
import { ConnectCard } from "@/modules/website/ClientWebsites";

export function ClientDetail({ id }: { id: string }) {
	const db = useDb();
	const store = useStore();
	const router = useRouter();
	const client = db.clients.find((c) => c.id === id);
	const initialTab = useSearchParams()?.get("tab");
	const [tab, setTab] = useState<string | null>(initialTab && ["overview", "features", "domains", "billing", "activity", "config", "settings"].includes(initialTab) ? initialTab : "overview");
	const [statusTo, setStatusTo] = useState<StatusTarget | null>(null);
	const [planOpen, setPlanOpen] = useState(false);
	const [impersonate, setImpersonate] = useState(false);
	const [checking, setChecking] = useState(false);

	if (!client) {
		return (
			<EmptyState title="Client not found">
				It may have been deleted. <Anchor component={Link} href="/clients">Back to clients</Anchor>
			</EmptyState>
		);
	}

	const plan = planOf(db, client);
	const product = productOf(db, client.productId);
	const meta = clientStatusMeta[client.status];

	return (
		<>
			<PageHeader
				back={
					<Anchor component={Link} href="/clients" size="sm" c="dimmed" mb={8} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
						<ArrowLeft size={14} /> Clients
					</Anchor>
				}
				title={
					<Group gap="sm" component="span">
						<EntityAvatar name={client.name} size={34} />
						{client.name}
					</Group>
				}
				badge={<StatusPill label={meta.label} color={meta.color} />}
				description={
					<>
						{product?.name} · {plan?.name} ({client.billingCycle}) · {client.adminHost}
					</>
				}
				actions={
					<>
						<Button
							variant="default"
							leftSection={<ExternalLink size={15} />}
							component="a"
							href={`https://${client.adminHost}`}
							target="_blank"
							rel="noreferrer"
						>
							Open admin
						</Button>
						<Button leftSection={<LogIn size={15} />} disabled={!store.allowed("clients.impersonate")} onClick={() => setImpersonate(true)}>
							Sign in as owner
						</Button>
						<Menu position="bottom-end" width={220} shadow="md">
							<Menu.Target>
								<ActionIcon variant="default" size={36} aria-label="More actions">
									<MoreVertical size={16} />
								</ActionIcon>
							</Menu.Target>
							<Menu.Dropdown>
								<Menu.Item onClick={() => setPlanOpen(true)} disabled={!store.allowed("clients.write")}>
									Change plan
								</Menu.Item>
								<Menu.Item
									leftSection={<Activity size={14} />}
									onClick={async () => {
										setChecking(true);
										await store.runHealthChecks([client.id]);
										setChecking(false);
									}}
								>
									Run health check
								</Menu.Item>
								<Menu.Divider />
								{client.status === "trial" && (
									<Menu.Item leftSection={<PlayCircle size={14} />} onClick={() => setStatusTo("active")} disabled={!store.allowed("clients.lifecycle")}>
										Convert trial to paid
									</Menu.Item>
								)}
								{client.status === "suspended" || client.status === "cancelled" ? (
									<Menu.Item leftSection={<PlayCircle size={14} />} onClick={() => setStatusTo("active")} disabled={!store.allowed("clients.lifecycle")}>
										Reactivate
									</Menu.Item>
								) : (
									<Menu.Item color="red" leftSection={<PauseCircle size={14} />} onClick={() => setStatusTo("suspended")} disabled={!store.allowed("clients.lifecycle")}>
										Suspend
									</Menu.Item>
								)}
								{client.status !== "cancelled" && (
									<Menu.Item color="red" onClick={() => setStatusTo("cancelled")} disabled={!store.allowed("clients.lifecycle")}>
										Cancel subscription
									</Menu.Item>
								)}
							</Menu.Dropdown>
						</Menu>
					</>
				}
			/>

			{client.status === "suspended" && client.suspendedReason && (
				<Text size="sm" c="red.7" mb="md">
					Suspended: {client.suspendedReason}
				</Text>
			)}

			<Tabs value={tab} onChange={setTab} keepMounted={false}>
				<Tabs.List mb="lg">
					<Tabs.Tab value="overview">Overview</Tabs.Tab>
					<Tabs.Tab value="features">Features & limits</Tabs.Tab>
					<Tabs.Tab value="domains">Domains</Tabs.Tab>
					<Tabs.Tab value="billing">Billing</Tabs.Tab>
					<Tabs.Tab value="activity">Activity</Tabs.Tab>
					<Tabs.Tab value="config">Tenant config</Tabs.Tab>
					<Tabs.Tab value="settings">Profile & settings</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="overview">
					<Overview client={client} checking={checking} onChangePlan={() => setPlanOpen(true)} />
				</Tabs.Panel>
				<Tabs.Panel value="features">
					<FeaturesTab client={client} />
				</Tabs.Panel>
				<Tabs.Panel value="domains">
					<DomainsTab client={client} />
				</Tabs.Panel>
				<Tabs.Panel value="billing">
					<BillingTab client={client} />
				</Tabs.Panel>
				<Tabs.Panel value="activity">
					<ActivityTab client={client} />
				</Tabs.Panel>
				<Tabs.Panel value="config">
					<ConfigTab client={client} />
				</Tabs.Panel>
				<Tabs.Panel value="settings">
					<SettingsTab
						client={client}
						onDeleted={() => {
							router.replace("/clients");
						}}
					/>
				</Tabs.Panel>
			</Tabs>

			{statusTo && <StatusChangeModal clientId={client.id} to={statusTo} onClose={() => setStatusTo(null)} />}
			{planOpen && <ChangePlanModal clientId={client.id} onClose={() => setPlanOpen(false)} />}
			{impersonate && <ImpersonateModal clientId={client.id} onClose={() => setImpersonate(false)} />}
		</>
	);
}

function Overview({ client, checking, onChangePlan }: { client: Client; checking: boolean; onChangePlan: () => void }) {
	const db = useDb();
	const { allowed, cancelPendingChange, busy } = useStore();
	const pendingPlan = client.pendingPlanId ? db.plans.find((p) => p.id === client.pendingPlanId) : undefined;
	const plan = planOf(db, client);
	const limits = effectiveLimits(plan, client);
	const health = healthMeta[client.health.state];
	const openBalance = db.invoices.filter((i) => i.clientId === client.id && ["open", "overdue"].includes(i.status)).reduce((s, i) => s + i.total, 0);
	const trialDays = daysUntil(client.trialEndsAt);

	return (
		<SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
			<Card
				title="Subscription"
				actions={
					<Button size="xs" variant="light" onClick={onChangePlan} disabled={!allowed("clients.write")}>
						Change plan
					</Button>
				}
			>
				<KeyValue label="Plan">
					<Badge variant="light" color="violet">
						{plan?.name}
					</Badge>
				</KeyValue>
				<KeyValue label="Price">
					{money(clientPrice(plan, client.billingCycle), plan?.currency)} / {client.billingCycle === "yearly" ? "year" : "month"}
					{client.discountPct ? ` (−${client.discountPct}%)` : ""}
				</KeyValue>
				<KeyValue label="MRR">{money(clientMrr(db, client), plan?.currency)}</KeyValue>
				{client.status === "trial" ? (
					<KeyValue label="Trial ends">
						<Text size="sm" c={trialDays <= 3 ? "orange.7" : undefined}>
							{date(client.trialEndsAt)} ({trialDays} day{trialDays === 1 ? "" : "s"})
						</Text>
					</KeyValue>
				) : (
					<KeyValue label="Renews">{date(client.currentPeriodEnd)}</KeyValue>
				)}
				<KeyValue label="Open balance">
					<Text size="sm" c={openBalance > 0 ? "orange.7" : undefined}>
						{money(openBalance)}
					</Text>
				</KeyValue>
				<KeyValue label="Client since">{date(client.createdAt)}</KeyValue>
				{(client.pendingPlanId || client.pendingBillingCycle) && (
					<Group justify="space-between" mt="sm" p={8} bg="blue.0" style={{ borderRadius: 8 }} wrap="nowrap">
						<Text size="xs">
							Switching to <b>{pendingPlan?.name ?? plan?.name}</b> ({client.pendingBillingCycle ?? client.billingCycle}) on {date(client.currentPeriodEnd)}
						</Text>
						<Button size="compact-xs" variant="subtle" loading={busy} disabled={!allowed("clients.write")} onClick={() => cancelPendingChange(client.id)}>
							Keep current plan
						</Button>
					</Group>
				)}
			</Card>

			<Card title="Usage" description={client.usageReportedAt ? `Reported by the product ${relative(client.usageReportedAt)}.` : "Not reported by the product yet."}>
				<Stack gap="sm">
					{limitFields.map((f) => (
						<UsageBar key={f.key} label={f.label} used={client.usage[f.key]} limit={limits[f.key]} unit={f.unit} />
					))}
				</Stack>
			</Card>

			<Card title="Contact & health">
				<KeyValue label="Contact">{client.contact.name || "—"}</KeyValue>
				<KeyValue label="Email">{client.contact.email ? <Anchor href={`mailto:${client.contact.email}`} size="sm">{client.contact.email}</Anchor> : "—"}</KeyValue>
				<KeyValue label="Phone">{client.contact.phone || "—"}</KeyValue>
				<KeyValue label="Region">
					{client.company.country} · {client.company.timezone}
				</KeyValue>
				<KeyValue label="Health">
					{checking ? (
						"Checking…"
					) : (
						<Group gap={6} justify="flex-end" wrap="nowrap">
							<StatusPill label={health.label} color={health.color} />
							<Text size="xs" c="dimmed">
								{client.health.latencyMs ? `${client.health.latencyMs} ms` : ""}
							</Text>
						</Group>
					)}
				</KeyValue>
				<KeyValue label="App version">{client.health.version ?? "—"}</KeyValue>
				{client.health.checkedAt && (
					<Text size="xs" c={client.health.error ? "red.7" : "dimmed"} mt={6}>
						{client.health.error ? `${client.health.error} · ` : ""}checked {relative(client.health.checkedAt)}
					</Text>
				)}
				{client.tags.length > 0 && (
					<Group gap={4} mt="sm">
						{client.tags.map((t) => (
							<Badge key={t} variant="outline" color="gray" size="sm">
								{t}
							</Badge>
						))}
					</Group>
				)}
			</Card>
		</SimpleGrid>
	);
}

function FeaturesTab({ client }: { client: Client }) {
	const db = useDb();
	const { updateClient, allowed } = useStore();
	const plan = planOf(db, client);
	const product = productOf(db, client.productId);
	const enabled = effectiveFeatures(product, plan, client);
	const canEdit = allowed("clients.write");
	const groups = useMemo(() => {
		const map = new Map<string, NonNullable<typeof product>["features"]>();
		product?.features.forEach((f) => map.set(f.group, [...(map.get(f.group) ?? []), f]));
		return Array.from(map.entries());
	}, [product]);

	const toggle = (key: string, name: string, on: boolean) => {
		const inPlan = plan?.features.includes(key) ?? false;
		const overrides = { ...client.featureOverrides };
		// Matching the plan again clears the override rather than storing a no-op.
		if (on === inPlan) delete overrides[key];
		else overrides[key] = on;
		void updateClient(client.id, { featureOverrides: overrides }, `${name} turned ${on ? "on" : "off"}.`);
	};

	const [limitDraft, setLimitDraft] = useState<Partial<Limits>>(client.limitOverrides);
	const overrideCount = Object.keys(client.featureOverrides).length;

	return (
		<Stack gap="md">
			<Card
				title="Feature toggles"
				description={`Starts from the ${plan?.name} plan. Changing a switch adds an override for this client only. ${overrideCount} override${overrideCount === 1 ? "" : "s"} active.`}
				actions={
					overrideCount > 0 && (
						<Button size="xs" variant="subtle" color="gray" disabled={!canEdit} onClick={() => updateClient(client.id, { featureOverrides: {} }, "Back to the plan's features.")}>
							Reset to plan
						</Button>
					)
				}
			>
				<SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
					{groups.map(([group, features]) => (
						<Stack key={group} gap={6}>
							<Text size="xs" fw={600} c="dimmed" tt="uppercase">
								{group}
							</Text>
							{features.map((f) => {
								const override = client.featureOverrides[f.key];
								return (
									<Group key={f.key} justify="space-between" wrap="nowrap" py={4}>
										<Group gap={6} wrap="nowrap">
											<Text size="sm">{f.name}</Text>
											{override !== undefined && (
												<Badge size="xs" variant="light" color={override ? "green" : "red"}>
													override
												</Badge>
											)}
										</Group>
										{f.core ? (
											<Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
												Always on
											</Text>
										) : (
											<Switch
												checked={enabled.has(f.key)}
												disabled={!canEdit}
												onChange={(e) => toggle(f.key, f.name, e.currentTarget.checked)}
												aria-label={f.name}
											/>
										)}
									</Group>
								);
							})}
						</Stack>
					))}
				</SimpleGrid>
			</Card>

			<Card title="Limit overrides" description="Leave blank to use the plan limit. Use -1 for unlimited.">
				<SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
					{limitFields.map((f) => (
						<NumberInput
							key={f.key}
							label={f.label}
							description={`Plan: ${limitLabel(plan?.limits[f.key])}`}
							min={-1}
							allowDecimal={f.key === "storageGb"}
							value={limitDraft[f.key] ?? ""}
							onChange={(v) =>
								setLimitDraft((d) => {
									const next = { ...d };
									if (v === "" || v === undefined) delete next[f.key];
									else next[f.key] = Number(v);
									return next;
								})
							}
							disabled={!canEdit}
						/>
					))}
				</SimpleGrid>
				<Group justify="flex-end" mt="md">
					<Button
						disabled={!canEdit || JSON.stringify(limitDraft) === JSON.stringify(client.limitOverrides)}
						onClick={() => updateClient(client.id, { limitOverrides: limitDraft }, "Limits saved.")}
					>
						Save limits
					</Button>
				</Group>
			</Card>
		</Stack>
	);
}

function DomainsTab({ client }: { client: Client }) {
	const db = useDb();
	const { updateClient, verifyDomain, allowed } = useStore();
	const plan = planOf(db, client);
	const product = productOf(db, client.productId);
	const customAllowed = effectiveFeatures(product, plan, client).has("custom_domain");
	const [host, setHost] = useState("");
	const [adminHost, setAdminHost] = useState(client.adminHost);
	const canEdit = allowed("clients.write");
	const valid = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host.trim());
	const isPlatformHost = host.trim().endsWith(`.${db.settings.rootDomain}`);

	const setStorefronts = (storefronts: Client["storefronts"], success: string) => updateClient(client.id, { storefronts }, success);

	return (
		<Stack gap="md">
			<Card title="Admin address" description="Where the client's staff sign in. Changing it takes effect after DNS propagates.">
				<Group align="flex-end" wrap="wrap">
					<TextInput value={adminHost} onChange={(e) => setAdminHost(e.currentTarget.value.toLowerCase())} w={340} disabled={!canEdit} />
					<Button variant="default" disabled={!canEdit || adminHost === client.adminHost || !adminHost} onClick={() => updateClient(client.id, { adminHost }, `Admin address changed to ${adminHost}.`)}>
						Save
					</Button>
				</Group>
			</Card>

			<Card title="Storefront addresses" description="Public shop addresses. One is primary; the others redirect to it.">
				<div className="oa-table-wrap">
					<table className="oa-table">
						<thead>
							<tr>
								<th>Host</th>
								<th>DNS</th>
								<th>SSL</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{client.storefronts.map((s, i) => (
								<tr key={s.host}>
									<td>
										<Group gap={6}>
											<Text size="sm">{s.host}</Text>
											{s.primary && (
												<Badge size="xs" variant="light">
													primary
												</Badge>
											)}
										</Group>
									</td>
									<td>
										{s.verified ? (
											<StatusPill label="Verified" color="green" />
										) : (
											<Stack gap={2}>
												<StatusPill label="Waiting for DNS" color="orange" />
												<Text size="xs" c="dimmed">
													CNAME {s.host} → edge.{db.settings.rootDomain}
												</Text>
											</Stack>
										)}
									</td>
									<td>
										<StatusPill label={s.sslStatus === "active" ? "Active" : s.sslStatus === "pending" ? "Pending" : "Failed"} color={s.sslStatus === "active" ? "green" : s.sslStatus === "pending" ? "orange" : "red"} />
									</td>
									<td style={{ textAlign: "right" }}>
										<Group gap={4} justify="flex-end" wrap="nowrap">
											{!s.verified && (
												<>
													<Button size="xs" variant="light" disabled={!canEdit} onClick={() => verifyDomain(client.id, s.host)}>
														Check DNS
													</Button>
													<Tooltip label="Use when DNS is managed another way and you've confirmed it">
														<Button size="xs" variant="subtle" color="gray" disabled={!canEdit} onClick={() => verifyDomain(client.id, s.host, true)}>
															Mark verified
														</Button>
													</Tooltip>
												</>
											)}
											{!s.primary && s.verified && (
												<Button size="xs" variant="subtle" disabled={!canEdit} onClick={() => setStorefronts(client.storefronts.map((x, j) => ({ ...x, primary: j === i })), `Made ${s.host} primary`)}>
													Make primary
												</Button>
											)}
											<Tooltip label={s.primary ? "Make another address primary first" : "Remove"}>
												<ActionIcon
													variant="subtle"
													color="red"
													disabled={!canEdit || s.primary}
													onClick={() => setStorefronts(client.storefronts.filter((_, j) => j !== i), `Removed ${s.host}`)}
													aria-label={`Remove ${s.host}`}
												>
													<Trash2 size={15} />
												</ActionIcon>
											</Tooltip>
										</Group>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<Group mt="md" align="flex-start" wrap="wrap">
					<TextInput
						placeholder={`shop.example.com or name.${db.settings.rootDomain}`}
						value={host}
						onChange={(e) => setHost(e.currentTarget.value.toLowerCase())}
						w={340}
						error={host && !valid ? "Enter a hostname like shop.example.com" : !customAllowed && host && valid && !isPlatformHost ? "Custom domains aren't in this client's plan" : undefined}
						disabled={!canEdit}
					/>
					<Button
						leftSection={<Plus size={15} />}
						variant="default"
						disabled={!canEdit || !valid || (!customAllowed && !isPlatformHost) || client.storefronts.some((s) => s.host === host.trim())}
						onClick={async () => {
							const platform = isPlatformHost;
							const added = host.trim();
							if (
								await setStorefronts(
									[...client.storefronts, { host: added, verified: platform, primary: client.storefronts.length === 0, sslStatus: platform ? "active" : "pending" }],
									platform ? `${added} added.` : `${added} added. Point its DNS at edge.${db.settings.rootDomain}, then check DNS.`,
								)
							)
								setHost("");
						}}
					>
						Add address
					</Button>
				</Group>
			</Card>
		</Stack>
	);
}

function BillingTab({ client }: { client: Client }) {
	const db = useDb();
	const { setInvoiceStatus, issueInvoice, updateClient, allowed } = useStore();
	const invoices = db.invoices.filter((i) => i.clientId === client.id);
	const [discount, setDiscount] = useState<number | string>(client.discountPct);
	const canBill = allowed("billing.write");

	return (
		<Stack gap="md">
			<Card
				title="Invoices"
				actions={
					<Button size="xs" variant="light" disabled={!canBill || client.status === "trial"} onClick={() => issueInvoice(client.id)}>
						Issue invoice now
					</Button>
				}
			>
				{invoices.length === 0 ? (
					<EmptyState title="No invoices yet">Trials are invoiced when they convert to paid.</EmptyState>
				) : (
					<div className="oa-table-wrap">
						<table className="oa-table">
							<thead>
								<tr>
									<th>Number</th>
									<th>Period</th>
									<th>Total</th>
									<th>Status</th>
									<th>Due</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{invoices.map((inv) => {
									const m = invoiceStatusMeta[inv.status];
									return (
										<tr key={inv.id}>
											<td>{inv.number}</td>
											<td>
												{date(inv.periodStart)} – {date(inv.periodEnd)}
											</td>
											<td>{money(inv.total, inv.currency)}</td>
											<td>
												<StatusPill label={m.label} color={m.color} />
											</td>
											<td>{inv.paidAt ? `Paid ${date(inv.paidAt)}` : date(inv.dueAt)}</td>
											<td style={{ textAlign: "right" }}>
												{["open", "overdue"].includes(inv.status) && (
													<Group gap={4} justify="flex-end" wrap="nowrap">
														<Button size="xs" variant="light" color="green" disabled={!canBill} onClick={() => setInvoiceStatus(inv.id, "paid")}>
															Mark paid
														</Button>
														<Button size="xs" variant="subtle" color="gray" disabled={!canBill} onClick={() => setInvoiceStatus(inv.id, "void")}>
															Void
														</Button>
													</Group>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>
			<Card title="Discount" description="Applied to every future invoice for this client.">
				<Group align="flex-end">
					<NumberInput value={discount} onChange={setDiscount} min={0} max={100} suffix="%" w={140} disabled={!canBill} />
					<Button
						variant="default"
						disabled={!canBill || Number(discount) === client.discountPct}
						onClick={() => updateClient(client.id, { discountPct: Number(discount) || 0 }, "Discount saved. It applies to invoices issued from now on.")}
					>
						Save
					</Button>
				</Group>
			</Card>
		</Stack>
	);
}

function ActivityTab({ client }: { client: Client }) {
	const db = useDb();
	const entries = db.audit.filter((a) => a.entityId === client.id || (a.entityType === "invoice" && db.invoices.find((i) => i.id === a.entityId)?.clientId === client.id));
	return (
		<Card title="Activity" description="Every change made to this client from the owner console.">
			{entries.length === 0 ? (
				<EmptyState title="Nothing recorded yet" />
			) : (
				<Stack gap={0}>
					{entries.map((e) => (
						<Group key={e.id} justify="space-between" align="flex-start" py={10} style={{ borderBottom: "1px solid var(--oa-border)" }} wrap="nowrap">
							<div>
								<Text size="sm">{e.summary}</Text>
								<Text size="xs" c="dimmed">
									{e.actorName} · <code>{e.action}</code>
									{e.reason ? ` · “${e.reason}”` : ""}
								</Text>
							</div>
							<Tooltip label={dateTime(e.at)}>
								<Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
									{relative(e.at)}
								</Text>
							</Tooltip>
						</Group>
					))}
				</Stack>
			)}
		</Card>
	);
}

function ConfigTab({ client }: { client: Client }) {
	const db = useDb();
	const payload = JSON.stringify(entitlementPayload(db, client), null, 2);
	return (
		<Card
			title="Entitlements payload"
			description={`What the ${productOf(db, client.productId)?.name} app receives from GET /v1/integration/tenants/${client.slug}/entitlements (with its service key) at boot and whenever an entitlements.changed webhook arrives. It hides modules and enforces quotas from this.`}
			actions={
				<CopyButton value={payload}>
					{({ copied, copy }) => (
						<Button size="xs" variant="default" leftSection={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy}>
							{copied ? "Copied" : "Copy JSON"}
						</Button>
					)}
				</CopyButton>
			}
		>
			<pre className="oa-code">{payload}</pre>
		</Card>
	);
}

const profileOf = (c: Client) => ({ name: c.name, company: c.company, contact: c.contact, tags: c.tags, notes: c.notes, healthUrl: c.healthUrl ?? "" });

function SettingsTab({ client, onDeleted }: { client: Client; onDeleted: () => void }) {
	const { updateClient, deleteClient, allowed, busy } = useStore();
	const [draft, setDraft] = useState(() => profileOf(client));
	const [confirm, setConfirm] = useState("");
	const syncAfterSave = useRef(false);
	const canEdit = allowed("clients.write");
	const saved = profileOf(client);
	const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
	const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }));

	// After a save, take the server's normalised values (trimmed, lower-cased email…).
	useEffect(() => {
		if (syncAfterSave.current) {
			syncAfterSave.current = false;
			setDraft(profileOf(client));
		}
	}, [client]);

	return (
		<Stack gap="md">
			<ConnectCard client={client} compact />

			<Card title="Profile">
				<SimpleGrid cols={{ base: 1, sm: 2 }}>
					<TextInput label="Display name" value={draft.name} onChange={(e) => set({ name: e.currentTarget.value })} disabled={!canEdit} />
					<TextInput label="Legal name" value={draft.company.legalName} onChange={(e) => set({ company: { ...draft.company, legalName: e.currentTarget.value } })} disabled={!canEdit} />
					<TextInput label="Contact name" value={draft.contact.name} onChange={(e) => set({ contact: { ...draft.contact, name: e.currentTarget.value } })} disabled={!canEdit} />
					<TextInput label="Contact email" type="email" value={draft.contact.email} onChange={(e) => set({ contact: { ...draft.contact, email: e.currentTarget.value } })} disabled={!canEdit} />
					<TextInput label="Phone" value={draft.contact.phone} onChange={(e) => set({ contact: { ...draft.contact, phone: e.currentTarget.value } })} disabled={!canEdit} />
					<TextInput label="Tax ID" value={draft.company.taxId} onChange={(e) => set({ company: { ...draft.company, taxId: e.currentTarget.value } })} disabled={!canEdit} />
					<TextInput label="Country" value={draft.company.country} onChange={(e) => set({ company: { ...draft.company, country: e.currentTarget.value } })} disabled={!canEdit} />
					<TextInput label="Time zone" value={draft.company.timezone} onChange={(e) => set({ company: { ...draft.company, timezone: e.currentTarget.value } })} disabled={!canEdit} />
				</SimpleGrid>
				<TextInput
					label="Health check URL"
					description={`Leave empty to use https://${client.adminHost}/api/health`}
					placeholder={`https://${client.adminHost}/api/health`}
					mt="sm"
					value={draft.healthUrl}
					onChange={(e) => set({ healthUrl: e.currentTarget.value.trim() })}
					disabled={!canEdit}
				/>
				<TagsInput label="Tags" mt="sm" value={draft.tags} onChange={(tags) => set({ tags })} disabled={!canEdit} />
				<Textarea label="Internal notes" description="Only visible to the owner team." mt="sm" minRows={3} value={draft.notes} onChange={(e) => set({ notes: e.currentTarget.value })} disabled={!canEdit} />
				<Group justify="flex-end" mt="md">
					<Button variant="default" disabled={!dirty} onClick={() => setDraft(saved)} leftSection={<X size={14} />}>
						Discard
					</Button>
					<Button
						loading={busy}
						disabled={!dirty || !canEdit || !draft.name.trim()}
						onClick={async () => {
							syncAfterSave.current = true;
							if (!(await updateClient(client.id, draft, "Profile saved."))) syncAfterSave.current = false;
						}}
					>
						Save profile
					</Button>
				</Group>
			</Card>

			<Card title="Danger zone" description="Deleting removes the client and its addresses from the platform and tells the product (client.deleted webhook). Invoices, tickets and the change log are kept. This can't be undone.">
				<Group align="flex-end" wrap="wrap">
					<TextInput label={`Type ${client.slug} to confirm`} value={confirm} onChange={(e) => setConfirm(e.currentTarget.value)} w={260} />
					<Button
						color="red"
						loading={busy}
						disabled={confirm !== client.slug || !allowed("clients.lifecycle")}
						onClick={async () => {
							if (await deleteClient(client.id, confirm)) onDeleted();
						}}
					>
						Delete client
					</Button>
				</Group>
			</Card>
		</Stack>
	);
}
