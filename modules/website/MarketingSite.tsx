"use client";

import React, { useEffect, useState } from "react";
import { ActionIcon, Badge, Box, Button, Group, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, Textarea, TextInput, Title } from "@mantine/core";
import { Check, Plus, Trash2 } from "lucide-react";
import { useDb, useStore } from "@/lib/store";
import { limitFields, limitLabel, money } from "@/lib/domain";
import type { WebsiteConfig } from "@/lib/types";
import { Card } from "@/components/ui";

/** Your own marketing site (pricing page, lead form) — served by GET /v1/public/website and /pricing. */
export function MarketingSite() {
	const db = useDb();
	const { saveWebsite, allowed, busy } = useStore();
	const [draft, setDraft] = useState<WebsiteConfig>(db.website);
	// After publishing, show the server's (trimmed) copy; keyed on content so refreshes don't wipe edits.
	const savedJson = JSON.stringify(db.website);
	useEffect(() => setDraft(JSON.parse(savedJson)), [savedJson]);
	const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
	const set = (patch: Partial<WebsiteConfig>) => setDraft((d) => ({ ...d, ...patch }));
	const dirty = JSON.stringify(draft) !== JSON.stringify(db.website);
	const canEdit = allowed("website.write");

	const product = db.products.find((p) => p.id === draft.featuredProductId);
	const plans = db.plans.filter((p) => p.productId === draft.featuredProductId && p.isPublic && p.status === "active").sort((a, b) => a.sortOrder - b.sortOrder);

	return (
		<>
			<Group justify="space-between" mb="md" wrap="wrap">
				<Text size="sm" c="dimmed" maw={640}>
					Your own marketing site&apos;s pricing page and lead form, served to it by the public API (GET /v1/public/website and /v1/public/pricing). Plans appear when they&apos;re active and marked public.
				</Text>
				<Group gap="xs">
					<Button variant="default" disabled={!dirty} onClick={() => setDraft(db.website)}>
						Discard
					</Button>
					<Button loading={busy} disabled={!dirty || !canEdit} onClick={() => void saveWebsite(draft)}>
						Publish
					</Button>
				</Group>
			</Group>
			<SimpleGrid cols={{ base: 1, lg: 5 }} spacing="md">
				<div className="oa-span-2">
					<Stack gap="md">
						<Card title="Hero">
							<Stack gap="sm">
								<TextInput label="Headline" value={draft.headline} onChange={(e) => set({ headline: e.currentTarget.value })} />
								<Textarea label="Sub-headline" autosize minRows={2} value={draft.subheadline} onChange={(e) => set({ subheadline: e.currentTarget.value })} />
								<Select
									label="Featured product"
									value={draft.featuredProductId}
									data={db.products.map((p) => ({ value: p.id, label: p.name }))}
									onChange={(v) => v && set({ featuredProductId: v })}
								/>
							</Stack>
						</Card>
						<Card title="Announcement bar">
							<Stack gap="sm">
								<Switch label="Show announcement" checked={draft.announcementEnabled} onChange={(e) => set({ announcementEnabled: e.currentTarget.checked })} />
								<TextInput value={draft.announcement} onChange={(e) => set({ announcement: e.currentTarget.value })} disabled={!draft.announcementEnabled} />
							</Stack>
						</Card>
						<Card title="Pricing & sign-up">
							<Stack gap="sm">
								<Switch label="Show pricing table" checked={draft.showPricing} onChange={(e) => set({ showPricing: e.currentTarget.checked })} />
								<TextInput label="Yearly discount label" value={draft.yearlyDiscountLabel} onChange={(e) => set({ yearlyDiscountLabel: e.currentTarget.value })} />
								<Switch
									label="Lead form"
									description="“Talk to sales” submissions arrive in New leads."
									checked={draft.leadFormEnabled}
									onChange={(e) => set({ leadFormEnabled: e.currentTarget.checked })}
								/>
								<Switch
									label="Self-serve sign-up"
									description="Visitors start a trial without talking to sales. Provisioning runs automatically."
									checked={draft.selfServeSignup}
									onChange={(e) => set({ selfServeSignup: e.currentTarget.checked })}
								/>
							</Stack>
						</Card>
						<Card
							title="FAQ"
							actions={
								<ActionIcon variant="light" onClick={() => set({ faqs: [...draft.faqs, { q: "", a: "" }] })} aria-label="Add question">
									<Plus size={14} />
								</ActionIcon>
							}
						>
							<Stack gap="sm">
								{draft.faqs.map((f, i) => (
									<Group key={i} align="flex-start" wrap="nowrap" gap={6}>
										<Stack gap={4} style={{ flex: 1 }}>
											<TextInput size="xs" placeholder="Question" value={f.q} onChange={(e) => set({ faqs: draft.faqs.map((x, j) => (j === i ? { ...x, q: e.currentTarget.value } : x)) })} />
											<Textarea size="xs" placeholder="Answer" autosize value={f.a} onChange={(e) => set({ faqs: draft.faqs.map((x, j) => (j === i ? { ...x, a: e.currentTarget.value } : x)) })} />
										</Stack>
										<ActionIcon variant="subtle" color="red" onClick={() => set({ faqs: draft.faqs.filter((_, j) => j !== i) })} aria-label="Remove question">
											<Trash2 size={14} />
										</ActionIcon>
									</Group>
								))}
							</Stack>
						</Card>
					</Stack>
				</div>

				<div className="oa-span-3">
					<Card title="Preview" description="How the pricing page looks with your unpublished changes." padding={0}>
						<Box style={{ borderTop: "1px solid var(--oa-border)" }}>
							{draft.announcementEnabled && draft.announcement && (
								<Text size="xs" ta="center" py={6} bg="brand.6" c="white">
									{draft.announcement}
								</Text>
							)}
							<Stack align="center" gap={6} px="lg" pt={36} pb="lg" ta="center">
								{product && (
									<Badge variant="light" style={{ background: `${product.color}1a`, color: product.color }}>
										{product.name}
									</Badge>
								)}
								<Title order={2} fz={26} maw={520}>
									{draft.headline || "Headline"}
								</Title>
								<Text c="dimmed" maw={480}>
									{draft.subheadline}
								</Text>
							</Stack>
							{draft.showPricing && (
								<Box px="lg" pb="lg">
									<Group justify="center" mb="md">
										<SegmentedControl
											size="xs"
											value={cycle}
											onChange={(v) => setCycle(v as typeof cycle)}
											data={[
												{ value: "monthly", label: "Monthly" },
												{ value: "yearly", label: `Yearly · ${draft.yearlyDiscountLabel}` },
											]}
										/>
									</Group>
									<SimpleGrid cols={{ base: 1, sm: Math.min(3, Math.max(1, plans.length)) }} spacing="sm">
										{plans.map((p) => (
											<div key={p.id} className="oa-card" style={{ borderColor: p.highlighted ? "var(--mantine-color-brand-5)" : undefined, borderWidth: p.highlighted ? 2 : 1 }}>
												<Group justify="space-between">
													<Text fw={600}>{p.name}</Text>
													{p.highlighted && <Badge size="xs">Most popular</Badge>}
												</Group>
												<Text fz={24} fw={700} mt={6}>
													{money(cycle === "yearly" ? p.priceYearly : p.priceMonthly, p.currency)}
													<Text span size="xs" c="dimmed">
														/{cycle === "yearly" ? "yr" : "mo"}
													</Text>
												</Text>
												<Text size="xs" c="dimmed" mih={34}>
													{p.description}
												</Text>
												<Stack gap={4} my="sm">
													{limitFields.slice(0, 3).map((f) => (
														<Group key={f.key} gap={6} wrap="nowrap">
															<Check size={13} color="var(--mantine-color-green-6)" />
															<Text size="xs">
																{limitLabel(p.limits[f.key])} {f.label.toLowerCase()}
															</Text>
														</Group>
													))}
													<Group gap={6} wrap="nowrap">
														<Check size={13} color="var(--mantine-color-green-6)" />
														<Text size="xs">{p.features.length} features</Text>
													</Group>
												</Stack>
												<Button fullWidth size="xs" variant={p.highlighted ? "filled" : "default"}>
													{draft.selfServeSignup ? (p.trialDays ? `Start ${p.trialDays}-day trial` : "Get started") : "Talk to sales"}
												</Button>
											</div>
										))}
									</SimpleGrid>
									{plans.length === 0 && (
										<Text size="sm" c="dimmed" ta="center">
											No public plans for this product.
										</Text>
									)}
								</Box>
							)}
							{draft.faqs.length > 0 && (
								<Box px="lg" pb="lg">
									<Text fw={600} mb="xs">
										Questions
									</Text>
									{draft.faqs.map((f, i) => (
										<Box key={i} py={8} style={{ borderTop: "1px solid var(--oa-border)" }}>
											<Text size="sm" fw={500}>
												{f.q}
											</Text>
											<Text size="sm" c="dimmed">
												{f.a}
											</Text>
										</Box>
									))}
								</Box>
							)}
						</Box>
					</Card>
				</div>
			</SimpleGrid>
		</>
	);
}
