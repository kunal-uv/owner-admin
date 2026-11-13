"use client";

import React, { createContext, useContext, useRef, useState } from "react";
import { ActionIcon, Anchor, Box, Button, ColorInput, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import {
	ArrowDown,
	ArrowUp,
	Award,
	BadgeCheck,
	BookOpen,
	Briefcase,
	Building2,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Compass,
	Copy,
	CreditCard,
	DollarSign,
	Facebook,
	FileText,
	Gift,
	Globe,
	Headphones,
	Heart,
	Heading,
	HelpCircle,
	Home,
	Image as ImageIcon,
	Instagram,
	Layers,
	Leaf,
	Lightbulb,
	Link2,
	Linkedin,
	List,
	Lock,
	Mail,
	MapPin,
	MessageCircle,
	Minus,
	MousePointerClick,
	Newspaper,
	Package,
	Percent,
	Phone,
	Pilcrow,
	Plus,
	Quote,
	RefreshCw,
	Rocket,
	RotateCcw,
	Send,
	Shield,
	ShieldCheck,
	Smile,
	Sparkles,
	Star,
	Tag,
	Target,
	ThumbsUp,
	Trash2,
	TrendingUp,
	Truck,
	Twitter,
	Upload,
	Users,
	Wallet,
	Wrench,
	Youtube,
	Zap,
	type LucideIcon,
} from "lucide-react";
import { newItem, type Block, type Field } from "@/lib/site";

/** The icons a page can use; names match the RentBuddyz website's icon map. */
export const ICONS: Record<string, LucideIcon> = {
	ShieldCheck, Clock, TrendingUp, Award, Users, CheckCircle2, Percent, Truck, Wrench, Star, Heart, Zap, Sparkles, Home, Package, CreditCard, Smile, ThumbsUp, Leaf, Gift,
	Headphones, Phone, Mail, MapPin, Calendar, RefreshCw, Lock, BadgeCheck, Rocket, Globe, Briefcase, Lightbulb, Target, Layers, DollarSign, Tag, Wallet, Building2, Newspaper,
	MessageCircle, Shield, Compass, BookOpen, Send, HelpCircle, FileText, Facebook, Instagram, Twitter, Linkedin, Youtube,
};

export interface EditorEnv {
	icons: string[];
	disabled: boolean;
	/** Uploads to the client's backend; resolves to the stored path, or null on failure. */
	upload: (file: File) => Promise<string | null>;
	imageUrl: (value: unknown) => string;
}

export const EditorContext = createContext<EditorEnv>({ icons: [], disabled: true, upload: async () => null, imageUrl: () => "" });
const useEnv = () => useContext(EditorContext);

/* ── Image ──────────────────────────────────────────────────────────────── */

export function ImageField({ label, value, onChange, help }: { label: React.ReactNode; value: string; onChange: (v: string) => void; help?: string }) {
	const { disabled, upload, imageUrl } = useEnv();
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [broken, setBroken] = useState(false);
	const preview = imageUrl(value);

	const pick = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		const path = await upload(file);
		setBusy(false);
		if (path) {
			onChange(path);
			setBroken(false);
		}
		if (input.current) input.current.value = "";
	};

	return (
		<div>
			<Text size="sm" fw={500} mb={4}>
				{label}
			</Text>
			<Group align="flex-start" wrap="nowrap" gap="sm">
				<Box w={112} h={80} style={{ flexShrink: 0, border: "1px dashed var(--oa-border)", borderRadius: 8, display: "grid", placeItems: "center", overflow: "hidden", background: "#fafafa" }}>
					{preview && !broken ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={preview} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} onError={() => setBroken(true)} />
					) : (
						<ImageIcon size={20} color="#d1d5db" />
					)}
				</Box>
				<Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
					<TextInput
						size="xs"
						value={value}
						disabled={disabled}
						placeholder="Upload, or paste an https:// link or /assets/… path"
						onChange={(e) => {
							setBroken(false);
							onChange(e.currentTarget.value);
						}}
					/>
					<Group gap="xs">
						<input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => pick(e.target.files?.[0])} />
						<Button size="compact-xs" variant="default" leftSection={<Upload size={12} />} loading={busy} disabled={disabled} onClick={() => input.current?.click()}>
							Upload image
						</Button>
						{value && (
							<Anchor component="button" type="button" size="xs" c="red" disabled={disabled} onClick={() => onChange("")}>
								Remove
							</Anchor>
						)}
					</Group>
					{help && (
						<Text size="xs" c="dimmed">
							{help}
						</Text>
					)}
				</Stack>
			</Group>
		</div>
	);
}

/* ── Rich content (blocks) ──────────────────────────────────────────────── */

const BLOCK_TYPES: { type: Block["type"]; label: string; icon: LucideIcon; make: () => Block }[] = [
	{ type: "heading", label: "Heading", icon: Heading, make: () => ({ type: "heading", text: "", level: 2 }) },
	{ type: "paragraph", label: "Paragraph", icon: Pilcrow, make: () => ({ type: "paragraph", text: "" }) },
	{ type: "list", label: "List", icon: List, make: () => ({ type: "list", items: [""], ordered: false }) },
	{ type: "image", label: "Image", icon: ImageIcon, make: () => ({ type: "image", url: "", alt: "", caption: "" }) },
	{ type: "button", label: "Button", icon: MousePointerClick, make: () => ({ type: "button", text: "Learn more", url: "/" }) },
	{ type: "quote", label: "Quote", icon: Quote, make: () => ({ type: "quote", text: "" }) },
	{ type: "divider", label: "Divider", icon: Minus, make: () => ({ type: "divider" }) },
];

const swap = <T,>(list: T[], i: number, j: number) => {
	const next = [...list];
	[next[i], next[j]] = [next[j], next[i]];
	return next;
};

export function BlocksEditor({ value, onChange }: { value: Block[]; onChange: (v: Block[]) => void }) {
	const { disabled } = useEnv();
	const blocks = Array.isArray(value) ? value : [];
	const update = (i: number, patch: Partial<Block>) => onChange(blocks.map((b, j) => (j === i ? ({ ...b, ...patch } as Block) : b)));

	return (
		<Stack gap="xs">
			{blocks.length === 0 && (
				<Text size="xs" c="dimmed" ta="center" py="sm" style={{ border: "1px dashed var(--oa-border)", borderRadius: 8 }}>
					No content yet. Add a block below.
				</Text>
			)}
			{blocks.map((b, i) => {
				const meta = BLOCK_TYPES.find((t) => t.type === b.type);
				const Icon = meta?.icon ?? Pilcrow;
				return (
					// eslint-disable-next-line react/no-array-index-key
					<Paper key={i} p={0} radius="md">
						<Group gap={6} px={10} py={6} style={{ borderBottom: "1px solid var(--oa-border)" }}>
							<Icon size={13} color="var(--mantine-color-brand-6)" />
							<Text size="xs" fw={600} c="dimmed" tt="uppercase">
								{meta?.label ?? b.type}
							</Text>
							<Group gap={0} ml="auto">
								<ActionIcon size="sm" variant="subtle" color="gray" disabled={disabled || i === 0} onClick={() => onChange(swap(blocks, i, i - 1))} aria-label="Move up">
									<ArrowUp size={13} />
								</ActionIcon>
								<ActionIcon size="sm" variant="subtle" color="gray" disabled={disabled || i === blocks.length - 1} onClick={() => onChange(swap(blocks, i, i + 1))} aria-label="Move down">
									<ArrowDown size={13} />
								</ActionIcon>
								<ActionIcon size="sm" variant="subtle" color="red" disabled={disabled} onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label="Delete block">
									<Trash2 size={13} />
								</ActionIcon>
							</Group>
						</Group>
						<Stack gap="xs" p={10}>
							{b.type === "heading" && (
								<Group gap="xs" wrap="nowrap">
									<TextInput style={{ flex: 1 }} size="xs" value={b.text ?? ""} disabled={disabled} onChange={(e) => update(i, { text: e.currentTarget.value })} placeholder="Heading" />
									<Select
										size="xs"
										w={90}
										data={[
											{ value: "2", label: "Large" },
											{ value: "3", label: "Small" },
										]}
										value={String(b.level ?? 2)}
										disabled={disabled}
										allowDeselect={false}
										onChange={(v) => update(i, { level: v === "3" ? 3 : 2 })}
									/>
								</Group>
							)}
							{(b.type === "paragraph" || b.type === "quote") && (
								<Textarea size="xs" autosize minRows={2} maxRows={12} value={b.text ?? ""} disabled={disabled} onChange={(e) => update(i, { text: e.currentTarget.value })} placeholder="Write here. **bold**, *italic*, [link text](/page)" />
							)}
							{b.type === "list" && (
								<>
									<Textarea size="xs" autosize minRows={2} maxRows={12} value={(b.items ?? []).join("\n")} disabled={disabled} onChange={(e) => update(i, { items: e.currentTarget.value.split("\n") })} placeholder="One item per line" />
									<Switch size="xs" label="Numbered list" checked={!!b.ordered} disabled={disabled} onChange={(e) => update(i, { ordered: e.currentTarget.checked })} />
								</>
							)}
							{b.type === "image" && (
								<>
									<ImageField label="Image" value={b.url ?? ""} onChange={(v) => update(i, { url: v })} />
									<SimpleGrid cols={2} spacing="xs">
										<TextInput size="xs" label="Description (for screen readers)" value={b.alt ?? ""} disabled={disabled} onChange={(e) => update(i, { alt: e.currentTarget.value })} />
										<TextInput size="xs" label="Caption" value={b.caption ?? ""} disabled={disabled} onChange={(e) => update(i, { caption: e.currentTarget.value })} />
									</SimpleGrid>
								</>
							)}
							{b.type === "button" && (
								<SimpleGrid cols={2} spacing="xs">
									<TextInput size="xs" label="Button text" value={b.text ?? ""} disabled={disabled} onChange={(e) => update(i, { text: e.currentTarget.value })} />
									<TextInput size="xs" label="Link" leftSection={<Link2 size={12} />} value={b.url ?? ""} disabled={disabled} onChange={(e) => update(i, { url: e.currentTarget.value })} placeholder="/products or https://…" />
								</SimpleGrid>
							)}
							{b.type === "divider" && <hr style={{ border: 0, borderTop: "1px solid var(--oa-border)", width: "100%" }} />}
						</Stack>
					</Paper>
				);
			})}
			<Group gap={6}>
				{BLOCK_TYPES.map((t) => (
					<Button key={t.type} size="compact-xs" variant="default" leftSection={<Plus size={11} />} disabled={disabled} onClick={() => onChange([...blocks, t.make()])}>
						{t.label}
					</Button>
				))}
			</Group>
		</Stack>
	);
}

/* ── List ───────────────────────────────────────────────────────────────── */

function ListEditor({ field, value, onChange }: { field: Field; value: Record<string, unknown>[]; onChange: (v: Record<string, unknown>[]) => void }) {
	const { disabled } = useEnv();
	const items = Array.isArray(value) ? value : [];
	const [open, setOpen] = useState<number | null>(null);
	const max = field.max ?? 60;
	const nameOf = (item: Record<string, unknown>, i: number) => {
		const v = field.itemLabel ? item[field.itemLabel] : undefined;
		return typeof v === "string" && v.trim() ? v : `Item ${i + 1}`;
	};
	const move = (i: number, d: -1 | 1) => {
		onChange(swap(items, i, i + d));
		if (open === i) setOpen(i + d);
	};

	return (
		<Stack gap={6}>
			{items.map((item, i) => {
				const isOpen = open === i;
				const Icon = typeof item.icon === "string" ? ICONS[item.icon] : undefined;
				return (
					// eslint-disable-next-line react/no-array-index-key
					<Paper key={i} p={0} radius="md" style={{ borderColor: isOpen ? "var(--mantine-color-brand-3)" : undefined }}>
						<Group gap={4} px={8} py={6} wrap="nowrap">
							<Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : i)}>
								{isOpen ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
								{Icon && <Icon size={13} color="var(--mantine-color-brand-6)" />}
								<Text size="sm" fw={500} truncate>
									{nameOf(item, i)}
								</Text>
							</Group>
							<ActionIcon size="sm" variant="subtle" color="gray" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Move up">
								<ArrowUp size={13} />
							</ActionIcon>
							<ActionIcon size="sm" variant="subtle" color="gray" disabled={disabled || i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
								<ArrowDown size={13} />
							</ActionIcon>
							<ActionIcon
								size="sm"
								variant="subtle"
								color="gray"
								disabled={disabled || items.length >= max}
								onClick={() => onChange([...items.slice(0, i + 1), JSON.parse(JSON.stringify(item)), ...items.slice(i + 1)])}
								aria-label="Duplicate"
							>
								<Copy size={13} />
							</ActionIcon>
							<ActionIcon
								size="sm"
								variant="subtle"
								color="red"
								disabled={disabled || items.length <= (field.min ?? 0)}
								onClick={() => {
									onChange(items.filter((_, j) => j !== i));
									setOpen(null);
								}}
								aria-label="Delete"
							>
								<Trash2 size={13} />
							</ActionIcon>
						</Group>
						{isOpen && (
							<Stack gap="sm" p="sm" style={{ borderTop: "1px solid var(--oa-border)" }}>
								{(field.fields ?? []).map((sub) => (
									<FieldInput
										key={sub.key}
										field={sub}
										value={item[sub.key] === undefined ? sub.default : item[sub.key]}
										onChange={(v) => onChange(items.map((it, j) => (j === i ? { ...it, [sub.key]: v } : it)))}
									/>
								))}
							</Stack>
						)}
					</Paper>
				);
			})}
			<Button
				size="compact-sm"
				variant="default"
				leftSection={<Plus size={13} />}
				w="fit-content"
				disabled={disabled || items.length >= max}
				onClick={() => {
					onChange([...items, newItem(field)]);
					setOpen(items.length);
				}}
			>
				Add {field.itemLabel ? field.label.replace(/s$/, "").toLowerCase() : "item"}
			</Button>
		</Stack>
	);
}

/* ── One field ──────────────────────────────────────────────────────────── */

export function FieldInput({ field, value, onChange, changed, onReset }: { field: Field; value: unknown; onChange: (v: unknown) => void; changed?: boolean; onReset?: () => void }) {
	const { icons, disabled } = useEnv();
	const label = (
		<Group gap={8} component="span" style={{ display: "inline-flex" }}>
			{field.label}
			{changed && onReset && (
				<Anchor component="button" type="button" size="xs" onClick={onReset} disabled={disabled} title="Back to the original value" style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
					<RotateCcw size={10} /> Reset
				</Anchor>
			)}
		</Group>
	);
	const description = field.help;
	const str = typeof value === "string" ? value : value == null ? "" : String(value);

	switch (field.type) {
		case "text":
			return <TextInput label={label} description={description} value={str} disabled={disabled} maxLength={field.max ?? 300} onChange={(e) => onChange(e.currentTarget.value)} />;
		case "textarea":
			return <Textarea label={label} description={description} value={str} disabled={disabled} autosize minRows={2} maxRows={14} maxLength={field.max ?? 6000} onChange={(e) => onChange(e.currentTarget.value)} />;
		case "url":
			return (
				<TextInput
					label={label}
					description={description ?? "A site path like /products, or an https:// / mailto: / tel: link."}
					leftSection={<Link2 size={14} />}
					value={str}
					disabled={disabled}
					onChange={(e) => onChange(e.currentTarget.value.trim())}
				/>
			);
		case "color":
			return (
				<ColorInput
					label={label}
					description={description}
					value={str}
					disabled={disabled}
					format="hex"
					onChange={(v) => onChange(v)}
					swatches={["#1c2d39", "#299c8e", "#1e7a6e", "#0f172a", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#ffffff"]}
				/>
			);
		case "toggle":
			return <Switch label={label} description={description} checked={value === true} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />;
		case "number":
			return (
				<NumberInput
					label={label}
					description={description}
					value={typeof value === "number" ? value : Number(str) || 0}
					min={field.min}
					max={field.max}
					disabled={disabled}
					onChange={(v) => onChange(typeof v === "number" ? v : Number(v) || 0)}
				/>
			);
		case "select":
			return <Select label={label} description={description} data={field.options ?? []} value={str} disabled={disabled} allowDeselect={false} searchable onChange={(v) => v && onChange(v)} />;
		case "icon": {
			const Icon = str ? ICONS[str] : undefined;
			return (
				<Select
					label={label}
					description={description}
					data={icons}
					value={str || null}
					disabled={disabled}
					searchable
					clearable
					leftSection={Icon ? <Icon size={14} /> : undefined}
					renderOption={({ option }) => {
						const OptionIcon = ICONS[option.value];
						return (
							<Group gap={8}>
								{OptionIcon && <OptionIcon size={14} />}
								{option.value}
							</Group>
						);
					}}
					onChange={(v) => onChange(v ?? "")}
				/>
			);
		}
		case "image":
			return <ImageField label={label} help={description} value={str} onChange={onChange} />;
		case "blocks":
			return (
				<div>
					<Text size="sm" fw={500} mb={4}>
						{label}
					</Text>
					{description && (
						<Text size="xs" c="dimmed" mb={6}>
							{description}
						</Text>
					)}
					<BlocksEditor value={value as Block[]} onChange={onChange} />
				</div>
			);
		case "list":
			return (
				<div>
					<Text size="sm" fw={500} mb={4}>
						{label}
					</Text>
					{description && (
						<Text size="xs" c="dimmed" mb={6}>
							{description}
						</Text>
					)}
					<ListEditor field={field} value={value as Record<string, unknown>[]} onChange={onChange} />
				</div>
			);
		default:
			return null;
	}
}
