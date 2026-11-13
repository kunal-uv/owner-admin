"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Badge,
	Button,
	Checkbox,
	Group,
	Loader,
	Modal,
	NumberInput,
	PasswordInput,
	Radio,
	SegmentedControl,
	Select,
	SimpleGrid,
	Stack,
	Stepper,
	Text,
	Textarea,
	TextInput,
} from "@mantine/core";
import { CheckCircle2 } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { clientPrice, date, limitFields, limitLabel, money, slugify } from "@/lib/domain";
import type { BillingCycle, Client, Invoice } from "@/lib/types";
import { Card, KeyValue, PageHeader } from "@/components/ui";

const RESERVED = new Set(["www", "admin", "api", "app", "mail", "status", "docs", "owner", "platform"]);

export function NewClient() {
	const db = useDb();
	const { createClient, allowed, busy } = useStore();
	const router = useRouter();
	const params = useSearchParams();
	const lead = db.leads.find((l) => l.id === params?.get("lead"));

	const [active, setActive] = useState(0);
	const [productId, setProductId] = useState(lead?.productId ?? db.products.find((p) => p.status === "live")?.id ?? db.products[0]?.id);
	const [planId, setPlanId] = useState<string>(lead?.planId ?? "");
	const [cycle, setCycle] = useState<BillingCycle>("monthly");
	const [startTrial, setStartTrial] = useState(true);
	const [trialDays, setTrialDays] = useState<number | string>(14);
	const [name, setName] = useState(lead?.company ?? "");
	const [legalName, setLegalName] = useState("");
	const [contactName, setContactName] = useState(lead?.name ?? "");
	const [email, setEmail] = useState(lead?.email ?? "");
	const [phone, setPhone] = useState(lead?.phone ?? "");
	const [country, setCountry] = useState("US");
	const [timezone, setTimezone] = useState("America/New_York");
	const [slug, setSlug] = useState(lead ? slugify(lead.company) : "");
	const [slugTouched, setSlugTouched] = useState(false);
	const [notes, setNotes] = useState(lead?.message ?? "");
	const [created, setCreated] = useState<{ client: Client; invoice: Invoice | null } | null>(null);
	const [apiBaseUrl, setApiBaseUrl] = useState("");
	const [platformKey, setPlatformKey] = useState("");
	// "Continue" turns into "Create" in the same spot; ignore a double-click's second half.
	const [reviewArmedAt, setReviewArmedAt] = useState(0);

	const product = db.products.find((p) => p.id === productId);
	const plans = db.plans.filter((p) => p.productId === productId && p.status === "active").sort((a, b) => a.sortOrder - b.sortOrder);
	const plan = db.plans.find((p) => p.id === planId);

	useEffect(() => {
		if (!plans.some((p) => p.id === planId)) setPlanId(plans.find((p) => p.highlighted)?.id ?? plans[0]?.id ?? "");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [productId]);

	useEffect(() => {
		if (plan) {
			setTrialDays(plan.trialDays || 14);
			setStartTrial(plan.trialDays > 0);
		}
	}, [plan]);

	useEffect(() => {
		if (!slugTouched) setSlug(slugify(name));
	}, [name, slugTouched]);

	const slugError = useMemo(() => {
		if (!slug) return "Required";
		if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return "3–40 lowercase letters, numbers or dashes";
		if (RESERVED.has(slug)) return "Reserved name";
		if (db.clients.some((c) => c.slug === slug)) return "Already taken by another client";
		return null;
	}, [slug, db.clients]);

	const adminHost = product?.adminHostPattern.replace("{slug}", slug || "slug") ?? "";
	const storefrontHost = product?.storefrontHostPattern.replace("{slug}", slug || "slug") ?? "";
	const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

	const connectionValid = (!apiBaseUrl || /^https?:\/\/[^\s/]+/i.test(apiBaseUrl)) && (!platformKey || platformKey.length >= 32) && (!platformKey || !!apiBaseUrl);
	const stepValid = [!!product && !!plan, name.trim().length > 1 && contactName.trim().length > 1 && emailValid, !slugError && connectionValid, true];

	const submit = async () => {
		if (!product || !plan || created || Date.now() < reviewArmedAt) return;
		const res = await createClient({
			name: name.trim(),
			slug,
			productId: product.id,
			planId: plan.id,
			billingCycle: cycle,
			trialDays: startTrial ? Math.max(0, Number(trialDays) || 0) : 0,
			contact: { name: contactName.trim(), email: email.trim(), phone: phone.trim() },
			company: { legalName: legalName.trim() || name.trim(), country, timezone, currency: plan.currency },
			notes: notes.trim(),
			leadId: lead?.id,
			...(apiBaseUrl ? { apiBaseUrl } : {}),
			...(platformKey ? { platformKey } : {}),
		});
		if (res) setCreated(res);
	};

	return (
		<>
			<PageHeader
				title="New client"
				description={lead ? `Converting lead: ${lead.company || lead.name}` : "Provision a tenant on one of your products."}
			/>
			<Card padding={24}>
				<Stepper active={active} onStepClick={(s) => s < active && setActive(s)} size="sm" allowNextStepsSelect={false}>
					<Stepper.Step label="Product & plan">
						<Stack gap="md" mt="lg">
							<Radio.Group label="Product" value={productId} onChange={setProductId}>
								<SimpleGrid cols={{ base: 1, sm: 2 }} mt={6}>
									{db.products
										.filter((p) => p.status !== "retired")
										.map((p) => (
											<Radio.Card key={p.id} value={p.id} p="sm" disabled={p.status === "coming_soon"} style={{ borderColor: p.id === productId ? "var(--mantine-color-brand-6)" : undefined }}>
												<Group wrap="nowrap" align="flex-start">
													<Radio.Indicator mt={2} />
													<div>
														<Group gap={6}>
															<Text fw={600} size="sm">
																{p.name}
															</Text>
															{p.status !== "live" && (
																<Badge size="xs" variant="light" color="violet">
																	{p.status.replace("_", " ")}
																</Badge>
															)}
														</Group>
														<Text size="xs" c="dimmed">
															{p.tagline}
														</Text>
													</div>
												</Group>
											</Radio.Card>
										))}
								</SimpleGrid>
							</Radio.Group>

							<Group justify="space-between" align="flex-end">
								<Text fw={500} size="sm">
									Plan
								</Text>
								<SegmentedControl
									size="xs"
									value={cycle}
									onChange={(v) => setCycle(v as BillingCycle)}
									data={[
										{ value: "monthly", label: "Monthly" },
										{ value: "yearly", label: "Yearly" },
									]}
								/>
							</Group>
							<Radio.Group value={planId} onChange={setPlanId}>
								<SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
									{plans.map((p) => (
										<Radio.Card key={p.id} value={p.id} p="md" style={{ borderColor: p.id === planId ? "var(--mantine-color-brand-6)" : undefined }}>
											<Group justify="space-between" mb={4}>
												<Text fw={600} size="sm">
													{p.name}
												</Text>
												{!p.isPublic && (
													<Badge size="xs" color="gray" variant="light">
														private
													</Badge>
												)}
											</Group>
											<Text fz={20} fw={600}>
												{money(clientPrice(p, cycle), p.currency)}
												<Text span size="xs" c="dimmed">
													/{cycle === "yearly" ? "yr" : "mo"}
												</Text>
											</Text>
											<Text size="xs" c="dimmed" mt={4}>
												{p.description}
											</Text>
											<Stack gap={2} mt="xs">
												{limitFields.slice(0, 3).map((f) => (
													<Text size="xs" key={f.key}>
														{limitLabel(p.limits[f.key])} {f.label.toLowerCase()}
													</Text>
												))}
												<Text size="xs">{p.features.length} features</Text>
											</Stack>
										</Radio.Card>
									))}
								</SimpleGrid>
							</Radio.Group>
							<Group>
								<Checkbox label="Start with a free trial" checked={startTrial} onChange={(e) => setStartTrial(e.currentTarget.checked)} />
								{startTrial && <NumberInput size="xs" w={110} min={1} max={90} value={trialDays} onChange={setTrialDays} suffix=" days" />}
							</Group>
						</Stack>
					</Stepper.Step>

					<Stepper.Step label="Business">
						<SimpleGrid cols={{ base: 1, sm: 2 }} mt="lg">
							<TextInput label="Business name" required value={name} onChange={(e) => setName(e.currentTarget.value)} />
							<TextInput label="Legal name" placeholder="Same as business name" value={legalName} onChange={(e) => setLegalName(e.currentTarget.value)} />
							<TextInput label="Owner's name" required value={contactName} onChange={(e) => setContactName(e.currentTarget.value)} />
							<TextInput label="Owner's email" description="Receives the invite to set a password." required type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} error={email && !emailValid ? "Enter a valid email" : undefined} />
							<TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
							<Select label="Country" value={country} onChange={(v) => setCountry(v ?? "US")} data={["US", "CA", "GB", "AU", "IN", "AE", "DE"]} />
							<Select
								label="Time zone"
								value={timezone}
								onChange={(v) => setTimezone(v ?? "UTC")}
								searchable
								data={["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Dubai", "Australia/Sydney", "UTC"]}
							/>
						</SimpleGrid>
						<Textarea label="Internal notes" mt="sm" minRows={2} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
					</Stepper.Step>

					<Stepper.Step label="Addresses">
						<Stack gap="md" mt="lg" maw={560}>
							<TextInput
								label="Client slug"
								description="Used in their addresses and API. Can't be changed later."
								value={slug}
								onChange={(e) => {
									setSlugTouched(true);
									setSlug(e.currentTarget.value.toLowerCase());
								}}
								error={slugError}
							/>
							<KeyValue label="Admin address">{adminHost}</KeyValue>
							<KeyValue label="Storefront address">{storefrontHost}</KeyValue>
							<Text size="xs" c="dimmed">
								Custom domains can be added from the client's Domains tab once they're on a plan that includes them.
							</Text>
							<TextInput
								label="Product API address (optional)"
								description="Where this client's RentBuddyz backend runs, e.g. https://rent-buddy-api.example.com/api. Needed for its website and health checks; you can add it later."
								placeholder="https://api.client-domain.com/api"
								value={apiBaseUrl}
								onChange={(e) => setApiBaseUrl(e.currentTarget.value.trim())}
								error={apiBaseUrl && !/^https?:\/\/[^\s/]+/i.test(apiBaseUrl) ? "Enter a full address starting with https://" : undefined}
							/>
							<PasswordInput
								label="Platform key (optional)"
								description="The backend's PLATFORM_API_KEY, so you can edit the client's website from here. Stored encrypted."
								value={platformKey}
								onChange={(e) => setPlatformKey(e.currentTarget.value.trim())}
								error={platformKey && platformKey.length < 32 ? "At least 32 characters" : undefined}
								disabled={!db.capabilities.secrets}
								autoComplete="off"
							/>
						</Stack>
					</Stepper.Step>

					<Stepper.Step label="Review">
						<SimpleGrid cols={{ base: 1, md: 2 }} mt="lg">
							<Card title="Subscription">
								<KeyValue label="Product">{product?.name}</KeyValue>
								<KeyValue label="Plan">{plan?.name}</KeyValue>
								<KeyValue label="Billing">
									{money(clientPrice(plan, cycle), plan?.currency)} / {cycle === "yearly" ? "year" : "month"}
								</KeyValue>
								<KeyValue label="Starts as">{startTrial ? `${trialDays}-day trial` : "Paid — first invoice issued now"}</KeyValue>
							</Card>
							<Card title="Tenant">
								<KeyValue label="Name">{name}</KeyValue>
								<KeyValue label="Owner">
									{contactName} · {email}
								</KeyValue>
								<KeyValue label="Admin">{adminHost}</KeyValue>
								<KeyValue label="Storefront">{storefrontHost}</KeyValue>
							</Card>
						</SimpleGrid>
						<Text size="xs" c="dimmed" mt="md">
							{db.settings.webhookUrl
								? `${product?.name} is told about the new client by the client.created webhook and sets up the tenant and the owner's login.`
								: "No webhook URL is set in Settings → Integrations, so the product won't hear about this client automatically — set up the tenant in the product yourself."}
						</Text>
					</Stepper.Step>
				</Stepper>

				<Group justify="space-between" mt="xl">
					<Button variant="default" onClick={() => (active === 0 ? router.back() : setActive((s) => s - 1))}>
						{active === 0 ? "Cancel" : "Back"}
					</Button>
					{active < 3 ? (
						<Button
							key="continue"
							disabled={!stepValid[active]}
							onClick={() => {
								if (active === 2) setReviewArmedAt(Date.now() + 700);
								setActive((s) => s + 1);
							}}
						>
							Continue
						</Button>
					) : (
						<Button key="create" loading={busy} disabled={!stepValid.every(Boolean) || !allowed("clients.write") || !!created} onClick={submit}>
							Create client
						</Button>
					)}
				</Group>
			</Card>

			<Modal opened={!!created} onClose={() => created && router.replace(`/clients/${created.client.id}`)} title={<Text fw={600}>{created?.client.name} is set up</Text>}>
				{created && (
					<Stack gap="sm">
						{[
							`Client record created (${created.client.slug})`,
							`Admin address reserved: ${created.client.adminHost}`,
							`Storefront address reserved: ${created.client.storefronts[0]?.host ?? "—"}`,
							created.invoice
								? `First invoice ${created.invoice.number} issued for ${money(created.invoice.total, created.invoice.currency)}`
								: `Trial running until ${date(created.client.trialEndsAt)} — no invoice until it converts`,
							lead ? `Lead marked won` : null,
							db.settings.webhookUrl ? "client.created event queued for the product" : null,
						]
							.filter(Boolean)
							.map((line) => (
								<Group key={line} gap="sm" wrap="nowrap">
									<CheckCircle2 size={16} color="var(--mantine-color-green-6)" style={{ flexShrink: 0 }} />
									<Text size="sm">{line}</Text>
								</Group>
							))}
						<Group justify="flex-end" mt="sm">
							<Button onClick={() => router.replace(`/clients/${created.client.id}`)}>Open client</Button>
						</Group>
					</Stack>
				)}
			</Modal>
		</>
	);
}
