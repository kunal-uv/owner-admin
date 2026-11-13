import type {
	Client,
	ClientStatus,
	Database,
	HealthState,
	InvoiceStatus,
	LeadStatus,
	Limits,
	Plan,
	Product,
	ProductStatus,
	StaffRole,
	TicketPriority,
	TicketStatus,
} from "./types";

export const uid = (prefix: string) =>
	`${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const slugify = (value: string) =>
	value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);

export const initials = (name: string) =>
	name
		.replace(/\(.*?\)/g, "")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join("");

export const money = (amount: number, currency = "USD", compact = false) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		maximumFractionDigits: compact || Number.isInteger(amount) ? 0 : 2,
		notation: compact && amount >= 10_000 ? "compact" : "standard",
	}).format(amount);

export const date = (value?: string) =>
	value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export const dateTime = (value?: string) =>
	value
		? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
		: "—";

export const relative = (value?: string) => {
	if (!value) return "—";
	const diff = new Date(value).getTime() - Date.now();
	const abs = Math.abs(diff);
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	if (abs < 60_000) return "just now";
	if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
	if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
	if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
	return date(value);
};

export const daysUntil = (value?: string) =>
	value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000) : 0;

export const limitLabel = (n: number | undefined) => (n === undefined ? "—" : n < 0 ? "Unlimited" : n.toLocaleString());

export const limitFields: { key: keyof Limits; label: string; unit?: string }[] = [
	{ key: "stores", label: "Stores" },
	{ key: "staffUsers", label: "Staff users" },
	{ key: "products", label: "Products" },
	{ key: "ordersPerMonth", label: "Orders / month" },
	{ key: "storageGb", label: "Storage", unit: "GB" },
];

/* ─── Lookups ─────────────────────────────────────────────────────────────── */

export const planOf = (db: Database, client: Pick<Client, "planId">) => db.plans.find((p) => p.id === client.planId);
export const productOf = (db: Database, id: string) => db.products.find((p) => p.id === id);
export const clientOf = (db: Database, id: string) => db.clients.find((c) => c.id === id);

/* ─── Entitlements ────────────────────────────────────────────────────────── */

/**
 * What a tenant is actually allowed to use: the plan's features, plus any
 * per-tenant overrides. Core features cannot be removed.
 */
export function effectiveFeatures(product: Product | undefined, plan: Plan | undefined, client: Client) {
	const enabled = new Set(plan?.features ?? []);
	for (const [key, on] of Object.entries(client.featureOverrides)) {
		if (on) enabled.add(key);
		else enabled.delete(key);
	}
	product?.features.filter((f) => f.core).forEach((f) => enabled.add(f.key));
	return enabled;
}

export function effectiveLimits(plan: Plan | undefined, client: Client): Limits {
	const base: Limits = plan?.limits ?? { stores: 0, staffUsers: 0, products: 0, ordersPerMonth: 0, storageGb: 0 };
	return { ...base, ...client.limitOverrides };
}

/** Mirrors GET /v1/integration/tenants/{slug}/entitlements in owner-admin-api. */
export function entitlementPayload(db: Database, client: Client) {
	const plan = planOf(db, client);
	const product = productOf(db, client.productId);
	return {
		tenant: client.slug,
		product: product?.key,
		status: client.status,
		plan: plan?.code,
		features: Array.from(effectiveFeatures(product, plan, client)).sort(),
		limits: effectiveLimits(plan, client),
		trialEndsAt: client.trialEndsAt ?? null,
		currentPeriodEnd: client.currentPeriodEnd,
		readOnly: ["suspended", "cancelled"].includes(client.status),
		maintenance: db.settings.maintenanceMode,
		adminHost: client.adminHost,
		storefronts: client.storefronts.filter((s) => s.verified).map((s) => ({ host: s.host, primary: s.primary })),
	};
}

/** Monthly recurring revenue contributed by a tenant (yearly is normalised). */
export function clientMrr(db: Database, client: Client) {
	if (!["active", "past_due"].includes(client.status)) return 0;
	const plan = planOf(db, client);
	if (!plan) return 0;
	const gross = client.billingCycle === "yearly" ? plan.priceYearly / 12 : plan.priceMonthly;
	return gross * (1 - client.discountPct / 100);
}

export const clientPrice = (plan: Plan | undefined, cycle: Client["billingCycle"]) =>
	plan ? (cycle === "yearly" ? plan.priceYearly : plan.priceMonthly) : 0;

/* ─── Status metadata ─────────────────────────────────────────────────────── */

type Meta = { label: string; color: string };

export const clientStatusMeta: Record<ClientStatus, Meta> = {
	provisioning: { label: "Provisioning", color: "blue" },
	trial: { label: "Trial", color: "cyan" },
	active: { label: "Active", color: "green" },
	past_due: { label: "Past due", color: "orange" },
	suspended: { label: "Suspended", color: "red" },
	cancelled: { label: "Cancelled", color: "gray" },
};

export const leadStatusMeta: Record<LeadStatus, Meta> = {
	new: { label: "New", color: "blue" },
	contacted: { label: "Contacted", color: "violet" },
	demo_scheduled: { label: "Demo scheduled", color: "cyan" },
	won: { label: "Won", color: "green" },
	lost: { label: "Lost", color: "gray" },
};

export const invoiceStatusMeta: Record<InvoiceStatus, Meta> = {
	draft: { label: "Draft", color: "gray" },
	open: { label: "Open", color: "blue" },
	paid: { label: "Paid", color: "green" },
	overdue: { label: "Overdue", color: "red" },
	void: { label: "Void", color: "gray" },
};

export const productStatusMeta: Record<ProductStatus, Meta> = {
	live: { label: "Live", color: "green" },
	beta: { label: "Beta", color: "violet" },
	coming_soon: { label: "Coming soon", color: "blue" },
	retired: { label: "Retired", color: "gray" },
};

export const healthMeta: Record<HealthState, Meta> = {
	up: { label: "Healthy", color: "green" },
	degraded: { label: "Degraded", color: "orange" },
	down: { label: "Down", color: "red" },
	unknown: { label: "Not checked", color: "gray" },
};

export const ticketStatusMeta: Record<TicketStatus, Meta> = {
	open: { label: "Open", color: "blue" },
	pending: { label: "Waiting on client", color: "orange" },
	resolved: { label: "Resolved", color: "green" },
};

export const ticketPriorityMeta: Record<TicketPriority, Meta> = {
	low: { label: "Low", color: "gray" },
	normal: { label: "Normal", color: "blue" },
	high: { label: "High", color: "orange" },
	urgent: { label: "Urgent", color: "red" },
};

/* ─── Staff permissions ───────────────────────────────────────────────────── */

export type Permission =
	| "clients.write"
	| "clients.lifecycle"
	| "clients.impersonate"
	| "plans.write"
	| "products.write"
	| "billing.write"
	| "leads.write"
	| "support.write"
	| "website.write"
	| "settings.write"
	| "team.write";

const matrix: Record<StaffRole, Permission[] | "*"> = {
	owner: "*",
	admin: [
		"clients.write",
		"clients.lifecycle",
		"clients.impersonate",
		"plans.write",
		"products.write",
		"billing.write",
		"leads.write",
		"support.write",
		"website.write",
	],
	billing: ["billing.write", "plans.write", "clients.lifecycle"],
	support: ["support.write", "clients.impersonate", "leads.write"],
	viewer: [],
};

export const can = (role: StaffRole | undefined, permission: Permission) => {
	if (!role) return false;
	const allowed = matrix[role];
	return allowed === "*" || allowed.includes(permission);
};

export const roleLabels: Record<StaffRole, string> = {
	owner: "Owner",
	admin: "Admin",
	billing: "Billing",
	support: "Support",
	viewer: "Read-only",
};

export const roleDescriptions: Record<StaffRole, string> = {
	owner: "Everything, including platform settings and the team.",
	admin: "Clients, plans, products, billing, leads, support and website.",
	billing: "Invoices, plans and suspending/reactivating clients.",
	support: "Support tickets, leads and signing in as a client.",
	viewer: "Can look at everything, change nothing.",
};
