/*
 * A client's website content, as RentBuddyz declares it (rent-buddyz-backend
 * app/site/schema) and stores it: a document of overrides over each field's
 * default. Same model as the RentBuddyz admin's Website Customization.
 */

export type FieldType = "text" | "textarea" | "blocks" | "image" | "url" | "color" | "toggle" | "number" | "select" | "icon" | "list";

export interface Field {
	key: string;
	label: string;
	type: FieldType;
	default: unknown;
	help?: string;
	max?: number;
	min?: number;
	options?: { value: string; label: string }[];
	fields?: Field[];
	itemLabel?: string;
}

export interface Section {
	key: string;
	label: string;
	description?: string;
	hideable?: boolean;
	hiddenByDefault?: boolean;
	fields: Field[];
}

export interface PageDef {
	key: string;
	label: string;
	group: string;
	path?: string;
	description?: string;
	seo?: { title: string; description: string };
	reorderable?: boolean;
	sections: Section[];
}

export interface Schema {
	pages: PageDef[];
	icons: string[];
	fonts: string[];
}

export interface Block {
	type: "heading" | "paragraph" | "list" | "image" | "button" | "quote" | "divider";
	text?: string;
	level?: 2 | 3;
	items?: string[];
	ordered?: boolean;
	url?: string;
	alt?: string;
	caption?: string;
}

export interface CustomPage {
	id: string;
	slug: string;
	title: string;
	subtitle?: string;
	hero_image?: string;
	blocks: Block[];
	seo_title?: string;
	seo_description?: string;
	show_in_navbar?: boolean;
	show_in_footer?: boolean;
	published: boolean;
}

export interface SectionOverride {
	hidden?: boolean;
	values?: Record<string, unknown>;
}

export interface PageOverride {
	seo?: { title?: string; description?: string };
	order?: string[];
	sections?: Record<string, SectionOverride>;
}

export interface SiteDoc {
	version: 1;
	pages: Record<string, PageOverride>;
	custom_pages: CustomPage[];
}

export interface SiteState {
	draft: SiteDoc;
	published: SiteDoc;
	has_unpublished_changes: boolean;
	draft_updated_at: string | null;
	published_at: string | null;
}

/** What the website publishes (GET /site-content): every value resolved. */
export interface ResolvedSite {
	version: 1;
	pages: Record<string, { seo: { title: string; description: string } | null; order: string[]; sections: Record<string, { hidden: boolean; values: Record<string, unknown> }> }>;
	custom_pages: CustomPage[];
	published_at: string | null;
}

export type ClientSite =
	| { mode: "managed"; websiteUrl: string | null; site: SiteState & { schema: Schema } }
	| { mode: "public"; websiteUrl: string | null; published: ResolvedSite };

export const EMPTY_DOC: SiteDoc = { version: 1, pages: {}, custom_pages: [] };

export const GROUP_ORDER = ["Site-wide", "Shop", "Company", "Help", "Account", "Orders & payments"];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Normalises whatever the backend stored into a full document. */
export function asDoc(raw: unknown): SiteDoc {
	const d = (raw && typeof raw === "object" ? raw : {}) as Partial<SiteDoc>;
	return { version: 1, pages: d.pages && typeof d.pages === "object" ? d.pages : {}, custom_pages: Array.isArray(d.custom_pages) ? d.custom_pages : [] };
}

export function getValue(doc: SiteDoc, page: string, section: string, field: Field): unknown {
	const v = doc.pages[page]?.sections?.[section]?.values?.[field.key];
	return v === undefined ? field.default : v;
}

export const isChanged = (doc: SiteDoc, page: string, section: string, field: string) => doc.pages[page]?.sections?.[section]?.values?.[field] !== undefined;

function entries(next: SiteDoc, page: string, section?: string) {
	const p: PageOverride = next.pages[page] ?? {};
	next.pages[page] = p;
	if (!section) return { p, s: undefined };
	const sections = p.sections ?? {};
	p.sections = sections;
	const s: SectionOverride = sections[section] ?? {};
	sections[section] = s;
	return { p, s };
}

export function setValue(doc: SiteDoc, page: string, section: string, field: string, value: unknown): SiteDoc {
	const next = clone(doc);
	const { s } = entries(next, page, section);
	s!.values = { ...(s!.values ?? {}), [field]: value };
	return next;
}

export function resetValue(doc: SiteDoc, page: string, section: string, field: string): SiteDoc {
	const next = clone(doc);
	const s = next.pages[page]?.sections?.[section];
	if (s?.values) {
		delete s.values[field];
		if (!Object.keys(s.values).length) delete s.values;
	}
	return next;
}

export function isHidden(doc: SiteDoc, page: string, section: Section): boolean {
	if (section.hideable === false) return false;
	return doc.pages[page]?.sections?.[section.key]?.hidden ?? section.hiddenByDefault ?? false;
}

export function setHidden(doc: SiteDoc, page: string, section: string, hidden: boolean): SiteDoc {
	const next = clone(doc);
	entries(next, page, section).s!.hidden = hidden;
	return next;
}

export function sectionOrder(doc: SiteDoc, def: PageDef): string[] {
	const keys = def.sections.map((s) => s.key);
	const saved = doc.pages[def.key]?.order;
	if (!def.reorderable || !saved) return keys;
	return [...saved.filter((k) => keys.includes(k)), ...keys.filter((k) => !saved.includes(k))];
}

export function setOrder(doc: SiteDoc, page: string, order: string[]): SiteDoc {
	const next = clone(doc);
	entries(next, page).p.order = order;
	return next;
}

export function setSeo(doc: SiteDoc, page: string, key: "title" | "description", value: string): SiteDoc {
	const next = clone(doc);
	const { p } = entries(next, page);
	p.seo = { ...(p.seo ?? {}), [key]: value };
	return next;
}

export function changeCount(doc: SiteDoc, page: string): number {
	const p = doc.pages[page];
	if (!p) return 0;
	let n = (p.order ? 1 : 0) + (p.seo?.title ? 1 : 0) + (p.seo?.description ? 1 : 0);
	for (const s of Object.values(p.sections ?? {})) n += Object.keys(s.values ?? {}).length + (s.hidden !== undefined ? 1 : 0);
	return n;
}

export const newItem = (field: Field): Record<string, unknown> => Object.fromEntries((field.fields ?? []).map((f) => [f.key, clone(f.default)]));

export const slugify = (text: string): string =>
	text
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);

/** "about_us" / "aboutUs" → "About us" (for read-only views without the schema). */
export const humanize = (key: string) => {
	const words = key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
		.toLowerCase();
	return words.charAt(0).toUpperCase() + words.slice(1);
};

/** An image value as a URL the console can display. */
export function imageUrl(value: unknown, websiteUrl: string | null, apiBaseUrl?: string): string {
	if (typeof value !== "string" || !value) return "";
	if (/^https?:\/\//i.test(value)) return value;
	if (value.startsWith("/")) return websiteUrl ? `${websiteUrl}${value}` : "";
	try {
		return apiBaseUrl ? `${new URL(apiBaseUrl).origin}/cdn/${value}` : "";
	} catch {
		return "";
	}
}
