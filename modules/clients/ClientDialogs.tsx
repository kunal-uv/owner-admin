"use client";

import React, { useState } from "react";
import { Alert, Button, Group, Modal, Radio, SegmentedControl, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { AlertTriangle } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { clientPrice, date, effectiveLimits, limitFields, limitLabel, money, planOf } from "@/lib/domain";
import type { BillingCycle } from "@/lib/types";

export type StatusTarget = "active" | "suspended" | "cancelled";

const copy: Record<StatusTarget, { title: string; body: string; cta: string; color: string; needsReason: boolean }> = {
	suspended: {
		title: "Suspend client",
		body: "The client's admin and storefront go read-only straight away. Data is kept. You can reactivate at any time.",
		cta: "Suspend client",
		color: "red",
		needsReason: true,
	},
	active: {
		title: "Reactivate client",
		body: "Access is restored. If the paid period has ended, a new period starts today and its invoice is issued.",
		cta: "Reactivate",
		color: "green",
		needsReason: false,
	},
	cancelled: {
		title: "Cancel subscription",
		body: "The tenant goes read-only now and any scheduled plan change is dropped. Invoices already issued stay payable.",
		cta: "Cancel subscription",
		color: "red",
		needsReason: true,
	},
};

export function StatusChangeModal({ clientId, to, onClose }: { clientId: string; to: StatusTarget; onClose: () => void }) {
	const db = useDb();
	const { setClientStatus, busy } = useStore();
	const client = db.clients.find((c) => c.id === clientId);
	const [reason, setReason] = useState("");
	if (!client) return null;
	const isTrialConversion = to === "active" && client.status === "trial";
	const c = isTrialConversion
		? { ...copy.active, title: "Convert trial to paid", body: "The paid period starts today and the first invoice is issued now.", cta: "Convert to paid" }
		: copy[to];

	return (
		<Modal opened onClose={onClose} title={<Text fw={600}>{c.title}</Text>}>
			<Stack gap="md">
				<Text size="sm">
					<b>{client.name}</b> — {c.body}
				</Text>
				{c.needsReason && (
					<Textarea label="Reason" description="Stored in the change log." required minRows={2} value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
				)}
				<Group justify="flex-end">
					<Button variant="default" onClick={onClose}>
						Keep as is
					</Button>
					<Button
						color={c.color}
						loading={busy}
						disabled={c.needsReason && reason.trim().length < 3}
						onClick={async () => {
							const res = await setClientStatus(clientId, to, reason.trim() || undefined);
							if (!res) return;
							notifications.show({
								color: c.color,
								message: `${client.name}: ${c.cta.toLowerCase()} done.${res.invoice ? ` Invoice ${res.invoice.number} issued.` : ""}`,
							});
							onClose();
						}}
					>
						{c.cta}
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

/**
 * "Sign in as owner". The API mints a single-use 60-second token; the product's
 * admin exchanges it server-side for a support session with a banner.
 */
export function ImpersonateModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
	const db = useDb();
	const { impersonate, busy } = useStore();
	const client = db.clients.find((c) => c.id === clientId);
	const [reason, setReason] = useState("");
	const needsReason = db.settings.security.impersonationNeedsReason;
	if (!client) return null;
	const blocked = client.status === "cancelled";

	return (
		<Modal opened onClose={onClose} title={<Text fw={600}>Sign in as {client.name}</Text>}>
			<Stack gap="md">
				<Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
					You&apos;ll act as the client&apos;s owner. Everything you do there is recorded against your name, and the client can see it in their activity log.
				</Alert>
				<TextInput
					label="Reason"
					placeholder="e.g. Ticket #312 — set up custom domain"
					required={needsReason}
					value={reason}
					onChange={(e) => setReason(e.currentTarget.value)}
				/>
				{blocked && (
					<Text size="sm" c="red">
						Cancelled tenants can&apos;t be signed in to.
					</Text>
				)}
				<Group justify="flex-end">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						loading={busy}
						disabled={blocked || (needsReason && reason.trim().length < 3)}
						onClick={async () => {
							// Open the tab synchronously so pop-up blockers allow it, then point it at the link.
							const tab = window.open("about:blank", "_blank");
							const url = await impersonate(clientId, reason.trim());
							if (url && tab) {
								tab.opener = null;
								tab.location.href = url;
								onClose();
							} else if (url) {
								window.location.href = url;
							} else tab?.close();
						}}
					>
						Start session
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}

export function ChangePlanModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
	const db = useDb();
	const { changePlan, busy } = useStore();
	const client = db.clients.find((c) => c.id === clientId)!;
	const current = planOf(db, client);
	const [planId, setPlanId] = useState(client.pendingPlanId ?? client.planId);
	const [cycle, setCycle] = useState<BillingCycle>(client.pendingBillingCycle ?? client.billingCycle);
	const plans = db.plans.filter((p) => p.productId === client.productId && (p.status === "active" || p.id === client.planId)).sort((a, b) => a.sortOrder - b.sortOrder);
	const next = db.plans.find((p) => p.id === planId);
	const paying = client.status === "active" || client.status === "past_due";

	const overages = next
		? limitFields.filter((f) => {
				const limit = effectiveLimits(next, client);
				return limit[f.key] >= 0 && client.usage[f.key] > limit[f.key];
			})
		: [];

	const monthly = (p: typeof next, c: BillingCycle) => (p ? (c === "yearly" ? p.priceYearly / 12 : p.priceMonthly) : 0);
	const scheduled = paying && (cycle !== client.billingCycle || monthly(next, cycle) < monthly(current, client.billingCycle));
	const upgrade = paying && !scheduled && monthly(next, cycle) > monthly(current, client.billingCycle);
	const unchanged = planId === client.planId && cycle === client.billingCycle;

	return (
		<Modal opened onClose={onClose} title={<Text fw={600}>Change plan</Text>} size="lg">
			<Stack gap="md">
				<SegmentedControl
					value={cycle}
					onChange={(v) => setCycle(v as BillingCycle)}
					data={[
						{ value: "monthly", label: "Monthly" },
						{ value: "yearly", label: "Yearly" },
					]}
					w={220}
				/>
				<Radio.Group value={planId} onChange={setPlanId}>
					<Stack gap="xs">
						{plans.map((p) => (
							<Radio.Card key={p.id} value={p.id} p="sm" radius="md" style={{ borderColor: p.id === planId ? "var(--mantine-color-brand-6)" : undefined }}>
								<Group justify="space-between" wrap="nowrap">
									<Group gap="sm" wrap="nowrap">
										<Radio.Indicator />
										<div>
											<Text size="sm" fw={600}>
												{p.name}
												{p.id === client.planId ? " · current" : ""}
												{p.id === client.pendingPlanId ? " · scheduled" : ""}
												{p.status === "archived" ? " · archived" : ""}
											</Text>
											<Text size="xs" c="dimmed">
												{limitFields
													.map((f) => `${limitLabel(p.limits[f.key])} ${f.label.toLowerCase()}`)
													.slice(0, 3)
													.join(" · ")}
											</Text>
										</div>
									</Group>
									<Text size="sm" fw={600}>
										{money(clientPrice(p, cycle), p.currency)}
										<Text span size="xs" c="dimmed">
											/{cycle === "yearly" ? "yr" : "mo"}
										</Text>
									</Text>
								</Group>
							</Radio.Card>
						))}
					</Stack>
				</Radio.Group>
				{overages.length > 0 && !unchanged && (
					<Alert color="orange" variant="light" icon={<AlertTriangle size={16} />}>
						Current usage is over the new plan&apos;s limit for {overages.map((o) => o.label.toLowerCase()).join(", ")}. The client keeps existing records but can&apos;t add more until
						they&apos;re under the limit.
					</Alert>
				)}
				{!unchanged && (
					<Text size="sm" c="dimmed">
						{!paying
							? "Takes effect now. No invoice — the client isn't on a paid period."
							: scheduled
								? `Takes effect at renewal on ${date(client.currentPeriodEnd)}. The client keeps ${current?.name} until then.`
								: upgrade
									? "Takes effect now. The difference for the rest of this period is invoiced immediately."
									: "Takes effect now. Same price, so no invoice."}
					</Text>
				)}
				<Group justify="flex-end">
					<Button variant="default" onClick={onClose}>
						Cancel
					</Button>
					<Button
						loading={busy}
						disabled={unchanged}
						onClick={async () => {
							const res = await changePlan(clientId, planId, cycle);
							if (!res) return;
							notifications.show({
								color: "green",
								message:
									res.effect === "scheduled"
										? `${client.name} moves to ${next?.name} (${cycle}) on ${date(client.currentPeriodEnd)}.`
										: `${client.name} is now on ${next?.name} (${cycle}).${res.invoice ? ` Prorated invoice ${res.invoice.number} issued.` : ""}`,
							});
							onClose();
						}}
					>
						{scheduled ? "Schedule change" : "Change plan"}
					</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
