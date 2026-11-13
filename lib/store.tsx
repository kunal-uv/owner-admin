"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { api, ApiError } from "./api";
import { can, type Permission } from "./domain";
import type { ClientSite, SiteDoc, SiteState } from "./site";
import type {
	BillingCycle,
	Client,
	ClientStatus,
	Database,
	Invoice,
	Lead,
	Me,
	Plan,
	PlatformSettings,
	Product,
	StaffMember,
	StaffRole,
	Ticket,
	WebsiteConfig,
} from "./types";

/**
 * The console's single source of data. It loads the whole control-plane state
 * from owner-admin-api (GET /admin/state), and every action calls the API and
 * then reloads the state, so what's on screen is always what the server holds.
 */

export type Phase = "loading" | "signed_out" | "mfa" | "mfa_setup" | "ready" | "error";

export type NewClientInput = {
	name: string;
	slug: string;
	productId: string;
	planId: string;
	billingCycle: BillingCycle;
	trialDays: number;
	contact: Client["contact"];
	company: Partial<Client["company"]>;
	notes: string;
	leadId?: string;
	apiBaseUrl?: string;
	platformKey?: string;
};

export type ClientPatch = Partial<
	Pick<Client, "name" | "contact" | "company" | "adminHost" | "storefronts" | "featureOverrides" | "limitOverrides" | "discountPct" | "tags" | "notes"> & {
		healthUrl: string;
		apiBaseUrl: string;
		/** Write-only; "" removes it. */
		platformKey: string;
	}
>;

export type ActivityLog = {
	webhooks: { id: string; event: string; url: string; status: string; attempts: number; lastError?: string | null; createdAt: string; deliveredAt?: string }[];
	emails: { id: string; to: string; subject: string; status: string; error?: string | null; createdAt: string }[];
};

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const ok = <T,>(result: T | null) => result !== null;

function useStoreValue() {
	const [db, setDb] = useState<Database | null>(null);
	const [me, setMe] = useState<Me | undefined>();
	const [phase, setPhase] = useState<Phase>("loading");
	const [bootError, setBootError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const busyRef = useRef(false);

	const signedOut = useCallback(() => {
		setDb(null);
		setMe(undefined);
		setPhase("signed_out");
	}, []);

	/** Reacts to "you're not signed in" style errors. Returns true if handled. */
	const handleAuthError = useCallback(
		(err: unknown) => {
			if (!(err instanceof ApiError)) return false;
			if (err.status === 401 && err.code === "mfa_required") {
				setPhase("mfa");
				return true;
			}
			if (err.status === 401) {
				signedOut();
				return true;
			}
			if (err.status === 403 && err.code === "mfa_setup_required") {
				setPhase("mfa_setup");
				return true;
			}
			return false;
		},
		[signedOut],
	);

	const loadState = useCallback(async () => {
		const state = await api<Database>("GET", "/admin/state");
		setDb(state);
		setMe(state.me);
		setPhase("ready");
	}, []);

	const boot = useCallback(async () => {
		setBootError(null);
		try {
			const res = await api<{ me: Me }>("GET", "/admin/auth/me");
			setMe(res.me);
			if (res.me.mfaSetupRequired) {
				setPhase("mfa_setup");
				return;
			}
			await loadState();
		} catch (err) {
			if (!handleAuthError(err)) {
				setBootError(message(err));
				setPhase("error");
			}
		}
	}, [handleAuthError, loadState]);

	useEffect(() => {
		void boot();
	}, [boot]);

	// Pick up teammates' changes when coming back to the tab.
	useEffect(() => {
		const onFocus = () => {
			if (phase === "ready" && !busyRef.current) loadState().catch(handleAuthError);
		};
		window.addEventListener("focus", onFocus);
		return () => window.removeEventListener("focus", onFocus);
	}, [phase, loadState, handleAuthError]);

	/**
	 * Runs one mutation: ignores double-submits while another is in flight,
	 * reports errors, and reloads the state afterwards. Resolves to the call's
	 * result, or null if it failed.
	 */
	const run = useCallback(
		async <T,>(call: () => Promise<T>, opts: { success?: string; reload?: boolean } = {}): Promise<T | null> => {
			if (busyRef.current) return null;
			busyRef.current = true;
			setBusy(true);
			try {
				const result = await call();
				if (opts.reload !== false) await loadState().catch((e) => handleAuthError(e));
				if (opts.success) notifications.show({ color: "green", message: opts.success });
				return result ?? (true as T);
			} catch (err) {
				if (!handleAuthError(err)) notifications.show({ color: "red", title: "That didn't work", message: message(err) });
				return null;
			} finally {
				busyRef.current = false;
				setBusy(false);
			}
		},
		[handleAuthError, loadState],
	);

	/* ─── Session ─────────────────────────────────────────────────────────── */

	const login = useCallback(
		async (email: string, password: string): Promise<{ error?: string; mfa?: boolean }> => {
			try {
				const res = await api<{ mfaRequired: boolean }>("POST", "/admin/auth/login", { email, password });
				if (res.mfaRequired) {
					setPhase("mfa");
					return { mfa: true };
				}
				await boot();
				return {};
			} catch (err) {
				return { error: message(err) };
			}
		},
		[boot],
	);

	const verifyMfa = useCallback(
		async (code: string): Promise<string | null> => {
			try {
				await api("POST", "/admin/auth/mfa/verify", { code });
				await boot();
				return null;
			} catch (err) {
				if (err instanceof ApiError && (err.status === 429 || err.code === "unauthorized")) signedOut();
				return message(err);
			}
		},
		[boot, signedOut],
	);

	const logout = useCallback(async () => {
		try {
			await api("POST", "/admin/auth/logout");
		} catch {
			/* signing out locally is what matters */
		}
		signedOut();
	}, [signedOut]);

	const mfaSetup = useCallback(async () => {
		try {
			return await api<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("POST", "/admin/auth/mfa/setup");
		} catch (err) {
			if (!handleAuthError(err)) notifications.show({ color: "red", message: message(err) });
			return null;
		}
	}, [handleAuthError]);

	const mfaEnable = useCallback(
		async (code: string): Promise<string | null> => {
			try {
				await api("POST", "/admin/auth/mfa/enable", { code });
				await boot();
				notifications.show({ color: "green", message: "Two-factor authentication is on." });
				return null;
			} catch (err) {
				return message(err);
			}
		},
		[boot],
	);

	const mfaDisable = useCallback((code: string) => run(() => api("POST", "/admin/auth/mfa/disable", { code }), { success: "Two-factor authentication is off." }).then(ok), [run]);

	const changePassword = useCallback(
		(currentPassword: string, newPassword: string) =>
			run(() => api("POST", "/admin/auth/password", { currentPassword, newPassword }), { success: "Password changed. Other devices were signed out.", reload: false }).then(ok),
		[run],
	);

	/* ─── Clients ─────────────────────────────────────────────────────────── */

	const createClient = useCallback((input: NewClientInput) => run(() => api<{ client: Client; invoice: Invoice | null }>("POST", "/admin/clients", input)), [run]);

	const updateClient = useCallback(
		(id: string, patch: ClientPatch, success?: string) => run(() => api<{ client: Client }>("PATCH", `/admin/clients/${id}`, patch), { success }).then(ok),
		[run],
	);

	const setClientStatus = useCallback(
		(id: string, status: Extract<ClientStatus, "active" | "suspended" | "cancelled">, reason?: string) =>
			run(() => api<{ client: Client; invoice: Invoice | null }>("POST", `/admin/clients/${id}/status`, { status, reason })),
		[run],
	);

	const changePlan = useCallback(
		(id: string, planId: string, billingCycle: BillingCycle) =>
			run(() => api<{ client: Client; effect: "applied" | "scheduled"; invoice: Invoice | null }>("POST", `/admin/clients/${id}/plan`, { planId, billingCycle })),
		[run],
	);

	const cancelPendingChange = useCallback((id: string) => run(() => api("DELETE", `/admin/clients/${id}/pending-change`), { success: "Scheduled change cancelled." }).then(ok), [run]);

	const verifyDomain = useCallback(
		(id: string, host: string, manual = false) =>
			run(() => api("POST", `/admin/clients/${id}/domains/verify`, { host, manual }), { success: manual ? `${host} marked verified.` : `${host} verified.` }).then(ok),
		[run],
	);

	const runHealthChecks = useCallback(
		async (ids?: string[]) => {
			try {
				await api("POST", "/admin/clients/health-check", ids ? { ids } : {});
				await loadState();
				return true;
			} catch (err) {
				if (!handleAuthError(err)) notifications.show({ color: "red", message: message(err) });
				return false;
			}
		},
		[handleAuthError, loadState],
	);

	const impersonate = useCallback((id: string, reason: string) => run(() => api<{ url: string }>("POST", `/admin/clients/${id}/impersonate`, { reason })).then((r) => r?.url ?? null), [run]);

	const deleteClient = useCallback((id: string, confirmSlug: string) => run(() => api("DELETE", `/admin/clients/${id}`, { confirmSlug }), { success: "Client deleted." }).then(ok), [run]);

	/* ─── Catalogue ───────────────────────────────────────────────────────── */

	const savePlan = useCallback(
		(plan: Plan, isNew: boolean) => {
			const { id, status: _s, createdAt: _c, ...body } = plan;
			return run(() => (isNew ? api("POST", "/admin/plans", body) : api("PUT", `/admin/plans/${id}`, body)), { success: `${plan.name} saved.` }).then(ok);
		},
		[run],
	);

	const setPlanStatus = useCallback(
		(id: string, status: Plan["status"]) => run(() => api("POST", `/admin/plans/${id}/status`, { status }), { success: status === "archived" ? "Plan archived." : "Plan restored." }).then(ok),
		[run],
	);

	const saveProduct = useCallback(
		(product: Product, isNew: boolean) => {
			const { id, createdAt: _c, serviceKeyHint: _h, ...body } = product;
			return run(() => (isNew ? api("POST", "/admin/products", body) : api("PUT", `/admin/products/${id}`, body)), { success: `${product.name} saved.` }).then(ok);
		},
		[run],
	);

	const issueServiceKey = useCallback((productId: string) => run(() => api<{ key: string }>("POST", `/admin/products/${productId}/service-key`)).then((r) => r?.key ?? null), [run]);

	/* ─── Leads, billing, support ─────────────────────────────────────────── */

	const saveLead = useCallback(
		(lead: Lead, isNew: boolean, success?: string) => {
			const body = {
				name: lead.name,
				company: lead.company,
				email: lead.email,
				phone: lead.phone,
				productId: lead.productId,
				planId: lead.planId ?? null,
				source: lead.source,
				status: lead.status,
				message: lead.message,
				assigneeId: lead.assigneeId ?? null,
				lostReason: lead.lostReason ?? null,
			};
			return run(() => (isNew ? api("POST", "/admin/leads", body) : api("PUT", `/admin/leads/${lead.id}`, body)), { success }).then(ok);
		},
		[run],
	);

	const setInvoiceStatus = useCallback(
		(id: string, status: "paid" | "void") => run(() => api("POST", `/admin/invoices/${id}/status`, { status }), { success: status === "paid" ? "Marked paid." : "Invoice voided." }).then(ok),
		[run],
	);

	const issueInvoice = useCallback(
		(clientId: string) =>
			run(() => api<{ invoice: Invoice }>("POST", `/admin/clients/${clientId}/invoices`)).then((r) => {
				if (r) notifications.show({ color: "green", message: `${r.invoice.number} issued.` });
				return !!r;
			}),
		[run],
	);

	const updateTicket = useCallback(
		(id: string, patch: Partial<Pick<Ticket, "status" | "priority">> & { assigneeId?: string | null }, reply?: string) =>
			run(() => api("PATCH", `/admin/tickets/${id}`, { ...patch, ...(reply ? { reply } : {}) }), { success: reply ? "Reply sent." : undefined }).then(ok),
		[run],
	);

	/* ─── Team, website, settings ─────────────────────────────────────────── */

	const inviteStaff = useCallback(
		(input: { name: string; email: string; role: StaffRole }) => run(() => api<{ staff: StaffMember; link: string }>("POST", "/admin/staff/invite", input)).then((r) => r?.link ?? null),
		[run],
	);

	const updateStaff = useCallback(
		(id: string, patch: Partial<Pick<StaffMember, "name" | "role">> & { status?: "active" | "disabled" }, success?: string) =>
			run(() => api("PATCH", `/admin/staff/${id}`, patch), { success }).then(ok),
		[run],
	);

	const staffLink = useCallback((id: string) => run(() => api<{ link: string; purpose: string }>("POST", `/admin/staff/${id}/link`)), [run]);

	const resetStaffMfa = useCallback(
		(id: string) => run(() => api("POST", `/admin/staff/${id}/reset-mfa`), { success: "Two-factor reset. They'll set it up again at their next sign-in." }).then(ok),
		[run],
	);

	const saveWebsite = useCallback((website: WebsiteConfig) => run(() => api("PUT", "/admin/website", website), { success: "Website changes published." }).then(ok), [run]);

	const saveSettings = useCallback((settings: PlatformSettings) => run(() => api("PUT", "/admin/settings", settings), { success: "Settings saved." }).then(ok), [run]);

	const runBillingChecks = useCallback(
		() =>
			run(() => api<{ report: Record<string, number> }>("POST", "/admin/lifecycle/run")).then((r) => {
				if (r) {
					const changes = Object.entries(r.report).filter(([, n]) => n > 0);
					notifications.show({
						color: "green",
						message: changes.length
							? `Billing checks done: ${changes.map(([k, n]) => `${n} ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`).join(", ")}.`
							: "Billing checks done — nothing needed changing.",
					});
				}
				return !!r;
			}),
		[run],
	);

	const loadActivity = useCallback(async () => {
		try {
			return await api<ActivityLog>("GET", "/admin/activity");
		} catch (err) {
			if (!handleAuthError(err)) notifications.show({ color: "red", message: message(err) });
			return null;
		}
	}, [handleAuthError]);


	/* ─── Client websites (in the client's own product backend) ───────────── */

	/** Throws on failure — the Websites screen shows the reason in place. */
	const loadClientSite = useCallback((id: string) => api<ClientSite>("GET", `/admin/clients/${id}/site`), []);

	const saveSiteDraft = useCallback(
		(id: string, content: SiteDoc) => run(() => api<SiteState>("PUT", `/admin/clients/${id}/site/draft`, { content }), { success: "Draft saved. The website doesn't change until you publish." }),
		[run],
	);

	const publishSite = useCallback((id: string) => run(() => api<SiteState>("POST", `/admin/clients/${id}/site/publish`), { success: "Published. Visitors see the changes within about a minute." }), [run]);

	const discardSite = useCallback((id: string) => run(() => api<SiteState>("POST", `/admin/clients/${id}/site/discard`), { success: "Draft discarded — the editor matches the live website again." }), [run]);

	const sitePreviewToken = useCallback(
		async (id: string) => {
			try {
				return (await api<{ token: string }>("POST", `/admin/clients/${id}/site/preview-token`)).token;
			} catch (err) {
				if (!handleAuthError(err)) notifications.show({ color: "red", title: "Preview unavailable", message: message(err) });
				return null;
			}
		},
		[handleAuthError],
	);

	const uploadSiteImage = useCallback(
		async (id: string, file: File): Promise<string | null> => {
			const form = new FormData();
			form.append("image", file);
			try {
				const res = await fetch(`/api/v1/admin/clients/${id}/site/upload`, { method: "POST", body: form, credentials: "same-origin" });
				const data = (await res.json().catch(() => null)) as { path?: string; error?: { message?: string } } | null;
				if (!res.ok || !data?.path) throw new Error(data?.error?.message ?? `Upload failed (${res.status}).`);
				return data.path;
			} catch (err) {
				notifications.show({ color: "red", title: "Upload failed", message: message(err) });
				return null;
			}
		},
		[],
	);

	const allowed = useCallback((permission: Permission) => can(me?.role, permission), [me]);

	return {
		db,
		me,
		phase,
		bootError,
		ready: phase === "ready" && db !== null,
		busy,
		allowed,
		boot,
		refresh: loadState,
		login,
		verifyMfa,
		logout,
		mfaSetup,
		mfaEnable,
		mfaDisable,
		changePassword,
		createClient,
		updateClient,
		setClientStatus,
		changePlan,
		cancelPendingChange,
		verifyDomain,
		runHealthChecks,
		impersonate,
		deleteClient,
		savePlan,
		setPlanStatus,
		saveProduct,
		issueServiceKey,
		saveLead,
		setInvoiceStatus,
		issueInvoice,
		updateTicket,
		inviteStaff,
		updateStaff,
		staffLink,
		resetStaffMfa,
		saveWebsite,
		saveSettings,
		runBillingChecks,
		loadActivity,
		loadClientSite,
		saveSiteDraft,
		publishSite,
		discardSite,
		sitePreviewToken,
		uploadSiteImage,
	};
}

type StoreValue = ReturnType<typeof useStoreValue>;
const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
	const value = useStoreValue();
	return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
	const value = useContext(StoreContext);
	if (!value) throw new Error("useStore must be used inside <StoreProvider>");
	return value;
}

/** For screens rendered only after the console shell has confirmed the state is loaded. */
export function useDb(): Database {
	const { db } = useStore();
	if (!db) throw new Error("State not loaded");
	return db;
}
