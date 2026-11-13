"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	ActionIcon,
	Alert,
	Anchor,
	Badge,
	Box,
	Button,
	Group,
	Loader,
	PasswordInput,
	ScrollArea,
	SegmentedControl,
	Select,
	SimpleGrid,
	Stack,
	Switch,
	Tabs,
	Text,
	Textarea,
	TextInput,
	Tooltip,
} from "@mantine/core";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Globe, Plus, RefreshCw, Rocket, RotateCcw, Save, Trash2 } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { dateTime } from "@/lib/domain";
import {
	asDoc,
	changeCount,
	getValue,
	GROUP_ORDER,
	humanize,
	imageUrl,
	isChanged,
	isHidden,
	resetValue,
	sectionOrder,
	setHidden,
	setOrder,
	setSeo,
	setValue,
	slugify,
	type ClientSite,
	type CustomPage,
	type PageDef,
	type Schema,
	type SiteDoc,
	type SiteState,
} from "@/lib/site";
import type { Client } from "@/lib/types";
import { Card, EmptyState, EntityAvatar, PageHeader, StatusPill } from "@/components/ui";
import { BlocksEditor, EditorContext, FieldInput, ImageField } from "./fields";

const CUSTOM = "__custom_pages__";

/* ─────────────────────────────────────────────────────────────────────────── */

export function ClientWebsites() {
	const db = useDb();
	const router = useRouter();
	const params = useSearchParams();
	const fromUrl = params?.get("client");
	const clients = db.clients;
	const fallback = clients.find((c) => c.apiBaseUrl)?.id ?? clients[0]?.id ?? null;
	const selectedId = fromUrl && clients.some((c) => c.id === fromUrl) ? fromUrl : fallback;
	const client = clients.find((c) => c.id === selectedId);
	const [dirty, setDirty] = useState(false);

	const choose = (id: string | null) => {
		if (!id || id === selectedId) return;
		if (dirty && !window.confirm("You have unsaved changes on this website. Leave without saving?")) return;
		setDirty(false);
		router.replace(`/website?client=${id}`);
	};

	return (
		<>
			<PageHeader
				title="Websites"
				description="Each client's own website, page by page — straight from the client's RentBuddyz backend."
				actions={
					clients.length > 0 && (
						<Select
							w={300}
							searchable
							allowDeselect={false}
							placeholder="Choose a client"
							value={selectedId}
							onChange={choose}
							data={clients.map((c) => ({ value: c.id, label: c.apiBaseUrl ? c.name : `${c.name} (not connected)` }))}
							leftSection={client ? <EntityAvatar name={client.name} size={20} /> : <Globe size={14} />}
						/>
					)
				}
			/>
			{!client ? (
				<Card>
					<EmptyState icon={<Globe size={28} />} title="No clients yet">
						Websites appear here once you have clients. <Anchor component={Link} href="/clients/new">Create a client</Anchor>, then connect it to its RentBuddyz backend.
					</EmptyState>
				</Card>
			) : !client.apiBaseUrl ? (
				<ConnectCard client={client} />
			) : (
				<SiteWorkspace key={`${client.id}:${client.apiBaseUrl}:${client.platformKeyHint ?? ""}`} client={client} onDirty={setDirty} />
			)}
		</>
	);
}

/* ─── Connecting a client to its backend ──────────────────────────────────── */

export function ConnectCard({ client, compact }: { client: Client; compact?: boolean }) {
	const db = useDb();
	const { updateClient, allowed, busy } = useStore();
	const [apiBaseUrl, setApiBaseUrl] = useState(client.apiBaseUrl ?? "");
	const [platformKey, setPlatformKey] = useState("");
	const canEdit = allowed("clients.write");
	const changed = apiBaseUrl.trim() !== (client.apiBaseUrl ?? "") || platformKey.length > 0;

	useEffect(() => setApiBaseUrl(client.apiBaseUrl ?? ""), [client.apiBaseUrl]);

	return (
		<Card
			title={compact ? "Product connection" : `Connect ${client.name}'s website`}
			description={
				compact
					? "Where this client's RentBuddyz backend runs, and the key that lets this console manage it."
					: "Enter the address of the client's RentBuddyz backend. With just the address you can see what the website publishes; add its platform key to edit and publish from here."
			}
		>
			<Stack gap="sm" maw={560}>
				<TextInput
					label="API address"
					description="The RentBuddyz API base, the same value as the client admin's NEXT_PUBLIC_API_URL — e.g. https://rent-buddy-api.example.com/api"
					placeholder="https://api.client-domain.com/api"
					value={apiBaseUrl}
					onChange={(e) => setApiBaseUrl(e.currentTarget.value)}
					disabled={!canEdit}
				/>
				<PasswordInput
					label="Platform key"
					description={
						client.platformKeyHint
							? `A key ending in …${client.platformKeyHint} is stored. Enter a new one to replace it.`
							: "The PLATFORM_API_KEY set on the client's RentBuddyz backend (at least 32 characters). Stored encrypted; never shown again."
					}
					placeholder={client.platformKeyHint ? "Leave empty to keep the stored key" : "Paste the key"}
					value={platformKey}
					onChange={(e) => setPlatformKey(e.currentTarget.value.trim())}
					disabled={!canEdit || !db.capabilities.secrets}
					error={!db.capabilities.secrets ? "SECRETS_KEY isn't set on the API server, so keys can't be stored." : undefined}
					autoComplete="off"
				/>
				<Group justify="space-between">
					{client.platformKeyHint ? (
						<Anchor component="button" type="button" size="xs" c="red" disabled={!canEdit || busy} onClick={() => updateClient(client.id, { platformKey: "" }, "Platform key removed.")}>
							Remove stored key
						</Anchor>
					) : (
						<span />
					)}
					<Button
						loading={busy}
						disabled={!canEdit || !changed || !apiBaseUrl.trim()}
						onClick={async () => {
							const ok = await updateClient(client.id, { apiBaseUrl: apiBaseUrl.trim(), ...(platformKey ? { platformKey } : {}) }, "Connection saved.");
							if (ok) setPlatformKey("");
						}}
					>
						Save connection
					</Button>
				</Group>
			</Stack>
		</Card>
	);
}

/* ─── Loading the site ────────────────────────────────────────────────────── */

function SiteWorkspace({ client, onDirty }: { client: Client; onDirty: (dirty: boolean) => void }) {
	const { loadClientSite } = useStore();
	const [data, setData] = useState<ClientSite | null>(null);
	const [error, setError] = useState<{ message: string; code?: string } | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setData(await loadClientSite(client.id));
		} catch (err) {
			const e = err as Error & { code?: string };
			setError({ message: e.message, code: e.code });
		} finally {
			setLoading(false);
		}
	}, [client.id, loadClientSite]);

	useEffect(() => {
		void load();
	}, [load]);

	if (loading && !data) {
		return (
			<Card>
				<Group justify="center" py="xl" gap="sm">
					<Loader size="sm" />
					<Text size="sm" c="dimmed">
						Loading {client.name}&apos;s website from {client.apiBaseUrl}…
					</Text>
				</Group>
			</Card>
		);
	}

	if (error) {
		return (
			<Stack gap="md">
				<Alert color="red" variant="light" title="Couldn't load this website">
					<Text size="sm">{error.message}</Text>
					<Button size="xs" mt="sm" variant="default" leftSection={<RefreshCw size={13} />} onClick={load}>
						Try again
					</Button>
				</Alert>
				<ConnectCard client={client} compact />
			</Stack>
		);
	}

	if (!data) return null;
	if (data.mode === "public") return <PublicView client={client} data={data} onReload={load} />;
	return <ManagedEditor client={client} websiteUrl={data.websiteUrl} initial={data.site} onReload={load} onDirty={onDirty} />;
}

/* ─── Live preview ────────────────────────────────────────────────────────── */

function Preview({ websiteUrl, path, token, onRefresh, refreshing, stamp }: { websiteUrl: string | null; path: string; token: string | null; onRefresh: () => void; refreshing: boolean; stamp: number }) {
	if (!websiteUrl) {
		return (
			<Card title="Preview">
				<Text size="sm" c="dimmed">
					Add a verified storefront address on the client&apos;s Domains tab to see the website here.
				</Text>
			</Card>
		);
	}
	const url = `${websiteUrl}${path}${token ? `${path.includes("?") ? "&" : "?"}preview=${encodeURIComponent(token)}` : ""}`;
	return (
		<div className="oa-card" style={{ padding: 0, position: "sticky", top: 70 }}>
			<Group justify="space-between" px="sm" py={8} style={{ borderBottom: "1px solid var(--oa-border)" }} wrap="nowrap">
				<Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
					<Badge size="xs" variant="light" color={token ? "orange" : "green"}>
						{token ? "Draft" : "Live"}
					</Badge>
					<Text size="xs" c="dimmed" truncate>
						{websiteUrl}
						{path}
					</Text>
				</Group>
				<Group gap={2} wrap="nowrap">
					<Tooltip label="Reload preview">
						<ActionIcon variant="subtle" color="gray" onClick={onRefresh} loading={refreshing} aria-label="Reload preview">
							<RefreshCw size={14} />
						</ActionIcon>
					</Tooltip>
					<Tooltip label="Open in a new tab">
						<ActionIcon component="a" href={url} target="_blank" rel="noopener noreferrer" variant="subtle" color="gray" aria-label="Open in a new tab">
							<ExternalLink size={14} />
						</ActionIcon>
					</Tooltip>
				</Group>
			</Group>
			<iframe
				key={`${url}#${stamp}`}
				src={url}
				title="Website preview"
				style={{ width: "100%", height: "calc(100vh - 240px)", minHeight: 480, border: 0, display: "block", borderRadius: "0 0 12px 12px", background: "#fff" }}
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
				referrerPolicy="no-referrer"
			/>
		</div>
	);
}

/* ─── Read-only (no platform key) ─────────────────────────────────────────── */

function renderValue(value: unknown, websiteUrl: string | null, apiBaseUrl?: string): React.ReactNode {
	if (value === null || value === undefined || value === "") return <Text size="sm" c="dimmed">—</Text>;
	if (typeof value === "boolean") return <Text size="sm">{value ? "On" : "Off"}</Text>;
	if (typeof value === "number") return <Text size="sm">{value}</Text>;
	if (typeof value === "string") {
		const img = /\.(png|jpe?g|webp|gif|svg)$/i.test(value) ? imageUrl(value, websiteUrl, apiBaseUrl) : "";
		if (img) {
			// eslint-disable-next-line @next/next/no-img-element
			return <img src={img} alt="" style={{ maxHeight: 60, maxWidth: 160, objectFit: "contain" }} />;
		}
		if (/^#[0-9a-f]{3,8}$/i.test(value)) {
			return (
				<Group gap={6}>
					<span style={{ width: 14, height: 14, borderRadius: 3, background: value, border: "1px solid var(--oa-border)" }} />
					<Text size="sm">{value}</Text>
				</Group>
			);
		}
		return (
			<Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} lineClamp={6}>
				{value}
			</Text>
		);
	}
	if (Array.isArray(value)) {
		return (
			<Stack gap={4}>
				{value.length === 0 && <Text size="sm" c="dimmed">None</Text>}
				{value.map((item, i) => (
					// eslint-disable-next-line react/no-array-index-key
					<Box key={i} pl="xs" style={{ borderLeft: "2px solid var(--oa-border)" }}>
						{item && typeof item === "object" ? (
							<Stack gap={2}>
								{Object.entries(item as Record<string, unknown>)
									.filter(([, v]) => v !== "" && v !== undefined)
									.map(([k, v]) => (
										<Group key={k} gap={6} align="flex-start" wrap="nowrap">
											<Text size="xs" c="dimmed" w={110} style={{ flexShrink: 0 }}>
												{humanize(k)}
											</Text>
											<Box style={{ minWidth: 0 }}>{renderValue(v, websiteUrl, apiBaseUrl)}</Box>
										</Group>
									))}
							</Stack>
						) : (
							renderValue(item, websiteUrl, apiBaseUrl)
						)}
					</Box>
				))}
			</Stack>
		);
	}
	return (
		<Text size="xs" c="dimmed">
			{JSON.stringify(value).slice(0, 200)}
		</Text>
	);
}

function PublicView({ client, data, onReload }: { client: Client; data: Extract<ClientSite, { mode: "public" }>; onReload: () => void }) {
	const pages = Object.entries(data.published.pages ?? {});
	const [tab, setTab] = useState<string | null>(pages[0]?.[0] ?? null);
	const [stamp, setStamp] = useState(0);
	const page = pages.find(([k]) => k === tab)?.[1];

	return (
		<Stack gap="md">
			<Alert color="blue" variant="light" title="Read-only: what the website publishes now">
				<Text size="sm">
					Add {client.name}&apos;s platform key to edit pages, save drafts and publish from here.{" "}
					<Anchor component={Link} href={`/clients/${client.id}?tab=settings`} size="sm">
						Add the key
					</Anchor>
					{data.published.published_at ? ` · Last published ${dateTime(data.published.published_at)}` : ""}
				</Text>
			</Alert>
			{pages.length === 0 ? (
				<Card>
					<EmptyState title="The website hasn't published any content yet" />
				</Card>
			) : (
				<Tabs value={tab} onChange={setTab} variant="outline">
					<ScrollArea type="auto" offsetScrollbars>
						<Tabs.List style={{ flexWrap: "nowrap" }}>
							{pages.map(([key]) => (
								<Tabs.Tab key={key} value={key} style={{ whiteSpace: "nowrap" }}>
									{humanize(key)}
								</Tabs.Tab>
							))}
						</Tabs.List>
					</ScrollArea>
				</Tabs>
			)}
			{page && (
				<div className="oa-site-grid">
					<Stack gap="md">
						{page.seo && (
							<Card title="Search engines">
								<Text size="xs" c="dimmed">
									Title
								</Text>
								<Text size="sm">{page.seo.title}</Text>
								<Text size="xs" c="dimmed" mt="xs">
									Description
								</Text>
								<Text size="sm">{page.seo.description}</Text>
							</Card>
						)}
						{page.order
							.filter((k) => page.sections[k])
							.map((key) => {
								const sec = page.sections[key];
								return (
									<Card key={key} title={humanize(key)} actions={sec.hidden ? <Badge color="gray" variant="light">Hidden</Badge> : undefined}>
										<Stack gap={8}>
											{Object.entries(sec.values).map(([k, v]) => (
												<Group key={k} gap="sm" align="flex-start" wrap="nowrap">
													<Text size="xs" c="dimmed" w={140} style={{ flexShrink: 0 }} pt={2}>
														{humanize(k)}
													</Text>
													<Box style={{ minWidth: 0, flex: 1 }}>{renderValue(v, data.websiteUrl, client.apiBaseUrl)}</Box>
												</Group>
											))}
										</Stack>
									</Card>
								);
							})}
					</Stack>
					<Preview websiteUrl={data.websiteUrl} path="/" token={null} onRefresh={() => setStamp((s) => s + 1)} refreshing={false} stamp={stamp} />
				</div>
			)}
			<Group>
				<Button variant="subtle" size="xs" leftSection={<RefreshCw size={13} />} onClick={onReload}>
					Reload from the website
				</Button>
			</Group>
		</Stack>
	);
}

/* ─── Full editor (with platform key) ─────────────────────────────────────── */

function ManagedEditor({
	client,
	websiteUrl,
	initial,
	onReload,
	onDirty,
}: {
	client: Client;
	websiteUrl: string | null;
	initial: SiteState & { schema: Schema };
	onReload: () => void;
	onDirty: (dirty: boolean) => void;
}) {
	const { allowed, busy, saveSiteDraft, publishSite, discardSite, sitePreviewToken, uploadSiteImage } = useStore();
	const schema = initial.schema;
	const canEdit = allowed("website.write");
	const [state, setState] = useState<SiteState>(initial);
	const [doc, setDoc] = useState<SiteDoc>(() => asDoc(initial.draft));
	const [savedJson, setSavedJson] = useState(() => JSON.stringify(asDoc(initial.draft)));
	const groups = useMemo(() => {
		const present = new Set(schema.pages.map((p) => p.group));
		return [...GROUP_ORDER.filter((g) => present.has(g)), ...[...present].filter((g) => !GROUP_ORDER.includes(g))];
	}, [schema]);
	const [group, setGroup] = useState<string>(groups[0] ?? "");
	const pagesInGroup = schema.pages.filter((p) => p.group === group);
	const [tab, setTab] = useState<string>(schema.pages[0]?.key ?? CUSTOM);
	const [mode, setMode] = useState<"draft" | "live">("live");
	const [token, setToken] = useState<string | null>(null);
	const [stamp, setStamp] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const dirty = JSON.stringify(doc) !== savedJson;

	useEffect(() => onDirty(dirty), [dirty, onDirty]);

	// Leaving the page with unsaved edits asks first.
	useEffect(() => {
		if (!dirty) return undefined;
		const warn = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const apply = (next: SiteState) => {
		const d = asDoc(next.draft);
		setState(next);
		setDoc(d);
		setSavedJson(JSON.stringify(d));
	};

	const refreshPreview = async (as: "draft" | "live" = mode) => {
		setRefreshing(true);
		if (as === "draft") setToken(await sitePreviewToken(client.id));
		else setToken(null);
		setStamp((s) => s + 1);
		setRefreshing(false);
	};

	const save = async () => {
		const next = await saveSiteDraft(client.id, doc);
		if (!next) return false;
		apply(next);
		setMode("draft");
		await refreshPreview("draft");
		return true;
	};

	const publish = async () => {
		if (!window.confirm(`Publish these changes to ${client.name}'s live website now?`)) return;
		if (dirty && !(await save())) return;
		const next = await publishSite(client.id);
		if (next) {
			apply(next);
			setMode("live");
			await refreshPreview("live");
		}
	};

	const discard = async () => {
		if (!window.confirm("Throw away every change that isn't published yet? This can't be undone.")) return;
		const next = await discardSite(client.id);
		if (next) {
			apply(next);
			setMode("live");
			await refreshPreview("live");
		}
	};

	const env = useMemo(
		() => ({
			icons: schema.icons ?? [],
			disabled: !canEdit || busy,
			upload: (file: File) => uploadSiteImage(client.id, file),
			imageUrl: (v: unknown) => imageUrl(v, websiteUrl, client.apiBaseUrl),
		}),
		[schema.icons, canEdit, busy, uploadSiteImage, client.id, client.apiBaseUrl, websiteUrl],
	);

	const def = schema.pages.find((p) => p.key === tab);
	const previewPath = tab === CUSTOM ? "/" : def?.path ?? "/";

	return (
		<EditorContext.Provider value={env}>
			<Stack gap="md">
				<div className="oa-card" style={{ padding: "10px 16px" }}>
					<Group justify="space-between" wrap="wrap" gap="sm">
						<Group gap="sm" wrap="wrap">
							{dirty ? (
								<StatusPill label="Unsaved edits" color="orange" />
							) : state.has_unpublished_changes ? (
								<StatusPill label="Draft not published" color="blue" />
							) : (
								<StatusPill label="Up to date" color="green" />
							)}
							<Text size="xs" c="dimmed">
								{state.published_at ? `Published ${dateTime(state.published_at)}` : "Never published from the editor"}
								{state.draft_updated_at ? ` · Draft saved ${dateTime(state.draft_updated_at)}` : ""}
							</Text>
							{websiteUrl && (
								<Anchor href={websiteUrl} target="_blank" rel="noopener noreferrer" size="xs">
									{websiteUrl.replace(/^https:\/\//, "")} <ExternalLink size={11} style={{ verticalAlign: -1 }} />
								</Anchor>
							)}
						</Group>
						<Group gap="xs">
							<Tooltip label="Reload what the backend holds (drops unsaved edits)">
								<ActionIcon variant="default" size={30} disabled={busy} onClick={() => (!dirty || window.confirm("Drop your unsaved edits and reload?")) && onReload()} aria-label="Reload">
									<RefreshCw size={14} />
								</ActionIcon>
							</Tooltip>
							<Button size="xs" variant="default" color="red" leftSection={<RotateCcw size={13} />} disabled={!canEdit || busy || (!state.has_unpublished_changes && !dirty)} onClick={discard}>
								Discard draft
							</Button>
							<Button size="xs" variant="default" leftSection={<Save size={13} />} loading={busy} disabled={!canEdit || !dirty} onClick={save}>
								Save draft
							</Button>
							<Button size="xs" leftSection={<Rocket size={13} />} disabled={!canEdit || busy || (!dirty && !state.has_unpublished_changes)} onClick={publish}>
								Publish
							</Button>
						</Group>
					</Group>
				</div>

				{!canEdit && (
					<Alert color="gray" variant="light" py={8}>
						Your role can view this website but not change it.
					</Alert>
				)}

				<Group justify="space-between" wrap="wrap" gap="sm">
					<SegmentedControl
						size="xs"
						value={tab === CUSTOM ? CUSTOM : group}
						onChange={(g) => {
							if (g === CUSTOM) {
								setTab(CUSTOM);
								return;
							}
							setGroup(g);
							setTab(schema.pages.find((p) => p.group === g)?.key ?? CUSTOM);
						}}
						data={[...groups.map((g) => ({ value: g, label: g })), { value: CUSTOM, label: `Custom pages (${doc.custom_pages.length})` }]}
					/>
					<SegmentedControl
						size="xs"
						value={mode}
						onChange={(m) => {
							setMode(m as "draft" | "live");
							void refreshPreview(m as "draft" | "live");
						}}
						data={[
							{ value: "live", label: "Preview: live" },
							{ value: "draft", label: "Preview: saved draft" },
						]}
					/>
				</Group>

				{tab !== CUSTOM && (
					<Tabs value={tab} onChange={(v) => v && setTab(v)} variant="outline">
						<ScrollArea type="auto" offsetScrollbars>
							<Tabs.List style={{ flexWrap: "nowrap" }}>
								{pagesInGroup.map((p) => {
									const n = changeCount(doc, p.key);
									return (
										<Tabs.Tab
											key={p.key}
											value={p.key}
											style={{ whiteSpace: "nowrap" }}
											rightSection={
												n > 0 ? (
													<Badge size="xs" variant="light" circle>
														{n}
													</Badge>
												) : undefined
											}
										>
											{p.label}
										</Tabs.Tab>
									);
								})}
							</Tabs.List>
						</ScrollArea>
					</Tabs>
				)}

				<div className="oa-site-grid">
					<div style={{ minWidth: 0 }}>{tab === CUSTOM ? <CustomPagesEditor doc={doc} onChange={setDoc} websiteUrl={websiteUrl} /> : def ? <PageEditor def={def} doc={doc} onChange={setDoc} /> : null}</div>
					<Preview websiteUrl={websiteUrl} path={previewPath} token={mode === "draft" ? token : null} onRefresh={() => refreshPreview()} refreshing={refreshing} stamp={stamp} />
				</div>
				{mode === "draft" && dirty && (
					<Text size="xs" c="dimmed" ta="right">
						The preview shows the last saved draft — save to see your latest edits.
					</Text>
				)}
			</Stack>
		</EditorContext.Provider>
	);
}

function PageEditor({ def, doc, onChange }: { def: PageDef; doc: SiteDoc; onChange: (d: SiteDoc) => void }) {
	const disabled = React.useContext(EditorContext).disabled;
	const order = sectionOrder(doc, def);
	const sections = order.map((k) => def.sections.find((s) => s.key === k)!).filter(Boolean);
	const seo = doc.pages[def.key]?.seo ?? {};

	return (
		<Stack gap="md">
			{(def.description || def.path) && (
				<Text size="sm" c="dimmed">
					{def.description}
					{def.path ? ` Shown at ${def.path}.` : ""}
				</Text>
			)}
			{def.seo && (
				<Card title="Search engines" description="How this page appears in Google and when shared. Empty uses the default.">
					<Stack gap="sm">
						<TextInput label="Page title" placeholder={def.seo.title} value={seo.title ?? ""} maxLength={70} disabled={disabled} onChange={(e) => onChange(setSeo(doc, def.key, "title", e.currentTarget.value))} />
						<Textarea
							label="Search description"
							placeholder={def.seo.description}
							value={seo.description ?? ""}
							maxLength={170}
							autosize
							minRows={2}
							disabled={disabled}
							onChange={(e) => onChange(setSeo(doc, def.key, "description", e.currentTarget.value))}
						/>
					</Stack>
				</Card>
			)}
			{sections.map((section, i) => {
				const hidden = isHidden(doc, def.key, section);
				return (
					<Card
						key={section.key}
						title={section.label}
						description={section.description}
						actions={
							<Group gap={4} wrap="nowrap">
								{def.reorderable && (
									<>
										<ActionIcon
											size="sm"
											variant="subtle"
											color="gray"
											disabled={disabled || i === 0}
											aria-label="Move section up"
											onClick={() => {
												const next = [...order];
												[next[i - 1], next[i]] = [next[i], next[i - 1]];
												onChange(setOrder(doc, def.key, next));
											}}
										>
											<ArrowUp size={14} />
										</ActionIcon>
										<ActionIcon
											size="sm"
											variant="subtle"
											color="gray"
											disabled={disabled || i === sections.length - 1}
											aria-label="Move section down"
											onClick={() => {
												const next = [...order];
												[next[i + 1], next[i]] = [next[i], next[i + 1]];
												onChange(setOrder(doc, def.key, next));
											}}
										>
											<ArrowDown size={14} />
										</ActionIcon>
									</>
								)}
								{section.hideable !== false && (
									<Tooltip label={hidden ? "Hidden on the website — click to show" : "Shown on the website — click to hide"}>
										<ActionIcon size="sm" variant={hidden ? "light" : "subtle"} color={hidden ? "orange" : "gray"} disabled={disabled} onClick={() => onChange(setHidden(doc, def.key, section.key, !hidden))} aria-label={hidden ? "Show section" : "Hide section"}>
											{hidden ? <EyeOff size={14} /> : <Eye size={14} />}
										</ActionIcon>
									</Tooltip>
								)}
							</Group>
						}
					>
						<Stack gap="md" style={{ opacity: hidden ? 0.55 : 1 }}>
							{section.fields.map((field) => (
								<FieldInput
									key={field.key}
									field={field}
									value={getValue(doc, def.key, section.key, field)}
									changed={isChanged(doc, def.key, section.key, field.key)}
									onReset={() => onChange(resetValue(doc, def.key, section.key, field.key))}
									onChange={(v) => onChange(setValue(doc, def.key, section.key, field.key, v))}
								/>
							))}
						</Stack>
					</Card>
				);
			})}
		</Stack>
	);
}

function CustomPagesEditor({ doc, onChange, websiteUrl }: { doc: SiteDoc; onChange: (d: SiteDoc) => void; websiteUrl: string | null }) {
	const disabled = React.useContext(EditorContext).disabled;
	const pages = doc.custom_pages;
	const [editing, setEditing] = useState<string | null>(pages[0]?.id ?? null);
	const [slugTouched, setSlugTouched] = useState<Record<string, boolean>>({});
	const page = pages.find((p) => p.id === editing);
	const update = (id: string, patch: Partial<CustomPage>) => onChange({ ...doc, custom_pages: pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

	const add = () => {
		const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		let n = pages.length + 1;
		while (pages.some((p) => p.slug === `new-page-${n}`)) n += 1;
		onChange({
			...doc,
			custom_pages: [
				...pages,
				{ id, slug: `new-page-${n}`, title: `New page ${n}`, subtitle: "", hero_image: "", blocks: [{ type: "paragraph", text: "" }], seo_title: "", seo_description: "", show_in_navbar: false, show_in_footer: false, published: false },
			],
		});
		setEditing(id);
	};

	return (
		<Stack gap="md">
			<Card
				title="Custom pages"
				description="Extra pages like policies or landing pages, published at /page/<address> and optionally linked from the navbar or footer."
				actions={
					<Button size="xs" leftSection={<Plus size={13} />} disabled={disabled || pages.length >= 50} onClick={add}>
						New page
					</Button>
				}
			>
				{pages.length === 0 ? (
					<EmptyState title="No custom pages" />
				) : (
					<Stack gap={4}>
						{pages.map((p) => (
							<Group
								key={p.id}
								justify="space-between"
								wrap="nowrap"
								px="sm"
								py={6}
								onClick={() => setEditing(p.id)}
								style={{ cursor: "pointer", borderRadius: 8, background: p.id === editing ? "var(--mantine-color-brand-0)" : undefined }}
							>
								<div style={{ minWidth: 0 }}>
									<Text size="sm" fw={500} truncate>
										{p.title || "Untitled"}
									</Text>
									<Text size="xs" c="dimmed">
										/page/{p.slug}
									</Text>
								</div>
								<Group gap={6} wrap="nowrap">
									<StatusPill label={p.published ? "Visible" : "Hidden"} color={p.published ? "green" : "orange"} />
									{websiteUrl && p.published && (
										<ActionIcon component="a" href={`${websiteUrl}/page/${p.slug}`} target="_blank" rel="noopener noreferrer" size="sm" variant="subtle" color="gray" aria-label="Open on website" onClick={(e) => e.stopPropagation()}>
											<ExternalLink size={13} />
										</ActionIcon>
									)}
								</Group>
							</Group>
						))}
					</Stack>
				)}
			</Card>

			{page && (
				<Card
					title={page.title || "Untitled page"}
					actions={
						<Button
							size="xs"
							variant="subtle"
							color="red"
							leftSection={<Trash2 size={13} />}
							disabled={disabled}
							onClick={() => {
								if (!window.confirm(`Delete “${page.title}”? It disappears from the website when you publish.`)) return;
								onChange({ ...doc, custom_pages: pages.filter((p) => p.id !== page.id) });
								setEditing(null);
							}}
						>
							Delete
						</Button>
					}
				>
					<Stack gap="md">
						<Switch label={page.published ? "Visible on the website" : "Hidden (draft page)"} checked={page.published} disabled={disabled} onChange={(e) => update(page.id, { published: e.currentTarget.checked })} />
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<TextInput
								label="Title"
								value={page.title}
								disabled={disabled}
								onChange={(e) => {
									const title = e.currentTarget.value;
									update(page.id, slugTouched[page.id] ? { title } : { title, slug: slugify(title) || page.slug });
								}}
							/>
							<TextInput
								label="Address"
								description={`${websiteUrl ?? "https://website"}/page/${page.slug}`}
								value={page.slug}
								disabled={disabled}
								onChange={(e) => {
									setSlugTouched({ ...slugTouched, [page.id]: true });
									update(page.id, { slug: slugify(e.currentTarget.value) });
								}}
							/>
						</SimpleGrid>
						<Textarea label="Subtitle" autosize minRows={1} value={page.subtitle ?? ""} disabled={disabled} onChange={(e) => update(page.id, { subtitle: e.currentTarget.value })} />
						<ImageField label="Banner image" value={page.hero_image ?? ""} onChange={(v) => update(page.id, { hero_image: v })} />
						<div>
							<Text size="sm" fw={500} mb={4}>
								Content
							</Text>
							<BlocksEditor value={page.blocks} onChange={(blocks) => update(page.id, { blocks })} />
						</div>
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<TextInput label="Page title (search engines)" value={page.seo_title ?? ""} maxLength={70} disabled={disabled} onChange={(e) => update(page.id, { seo_title: e.currentTarget.value })} />
							<TextInput label="Search description" value={page.seo_description ?? ""} maxLength={170} disabled={disabled} onChange={(e) => update(page.id, { seo_description: e.currentTarget.value })} />
						</SimpleGrid>
						<Group>
							<Switch label="Link in the navbar" checked={!!page.show_in_navbar} disabled={disabled} onChange={(e) => update(page.id, { show_in_navbar: e.currentTarget.checked })} />
							<Switch label="Link in the footer" checked={!!page.show_in_footer} disabled={disabled} onChange={(e) => update(page.id, { show_in_footer: e.currentTarget.checked })} />
						</Group>
					</Stack>
				</Card>
			)}
		</Stack>
	);
}
