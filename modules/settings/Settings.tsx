"use client";

import React, { useEffect, useState } from "react";
import {
	Alert,
	Button,
	Code,
	CopyButton,
	Group,
	Menu,
	Modal,
	NumberInput,
	PasswordInput,
	PinInput,
	Select,
	SimpleGrid,
	Stack,
	Switch,
	Tabs,
	Text,
	Textarea,
	TextInput,
	ActionIcon,
} from "@mantine/core";
import { MoreVertical, UserPlus } from "lucide-react";
import { useDb, useStore, type ActivityLog } from "@/lib/store";
import { dateTime, relative, roleDescriptions, roleLabels } from "@/lib/domain";
import type { PlatformSettings, StaffRole } from "@/lib/types";
import { Card, EmptyState, EntityAvatar, PageHeader, StatusPill } from "@/components/ui";
import { MfaSetup } from "@/components/auth/MfaSetup";
import { MarketingSite } from "@/modules/website/MarketingSite";

export function Settings() {
	const db = useDb();
	const { saveSettings, allowed, runBillingChecks, busy } = useStore();
	const [draft, setDraft] = useState<PlatformSettings>(db.settings);
	const [tab, setTab] = useState<string | null>("general");
	const canEdit = allowed("settings.write");
	const dirty = JSON.stringify(draft) !== JSON.stringify(db.settings);
	const set = (patch: Partial<PlatformSettings>) => setDraft((d) => ({ ...d, ...patch }));

	// Take the server's copy after a save (keyed on content, so a background
	// refresh with unchanged settings doesn't wipe what you're typing).
	const savedJson = JSON.stringify(db.settings);
	useEffect(() => setDraft(JSON.parse(savedJson)), [savedJson]);

	const saveBar = (
		<Group justify="flex-end" mt="md">
			<Button variant="default" disabled={!dirty} onClick={() => setDraft(db.settings)}>
				Discard
			</Button>
			<Button loading={busy} disabled={!dirty || !canEdit || draft.dunning.cancelAfterDays <= draft.dunning.suspendAfterDays} onClick={() => saveSettings(draft)}>
				Save
			</Button>
		</Group>
	);

	return (
		<>
			<PageHeader title="Settings" description={canEdit ? undefined : "Only the Owner role can change platform settings. You can still manage your own account under Security."} />
			<Tabs value={tab} onChange={setTab} keepMounted={false}>
				<Tabs.List mb="lg">
					<Tabs.Tab value="general">General</Tabs.Tab>
					<Tabs.Tab value="billing">Billing</Tabs.Tab>
					<Tabs.Tab value="team">Team & roles</Tabs.Tab>
					<Tabs.Tab value="security">Security</Tabs.Tab>
					<Tabs.Tab value="integrations">Integrations</Tabs.Tab>
					<Tabs.Tab value="marketing">Marketing site</Tabs.Tab>
				</Tabs.List>

				<Tabs.Panel value="general">
					<Card title="Console & platform">
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							<TextInput label="Brand name" description="Shown in the sidebar and emails." value={draft.brandName} onChange={(e) => set({ brandName: e.currentTarget.value })} disabled={!canEdit} />
							<TextInput label="Console subtitle" value={draft.consoleSubtitle} onChange={(e) => set({ consoleSubtitle: e.currentTarget.value })} disabled={!canEdit} />
							<TextInput label="Root domain" description="Tenant sub-domains are created under this." value={draft.rootDomain} onChange={(e) => set({ rootDomain: e.currentTarget.value })} disabled={!canEdit} />
							<TextInput label="Support email" value={draft.supportEmail} onChange={(e) => set({ supportEmail: e.currentTarget.value })} disabled={!canEdit} />
						</SimpleGrid>
						<Switch
							mt="md"
							color="orange"
							label="Maintenance mode"
							description="Sent to every product in the entitlements payload (maintenance: true) so client admins and storefronts show a maintenance page. The owner console keeps working."
							checked={draft.maintenanceMode}
							onChange={(e) => set({ maintenanceMode: e.currentTarget.checked })}
							disabled={!canEdit}
						/>
						{saveBar}
					</Card>
				</Tabs.Panel>

				<Tabs.Panel value="billing">
					<Stack gap="md">
						<Card title="Invoices">
							<SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
								<Select label="Default currency" value={draft.defaultCurrency} data={["USD", "CAD", "GBP", "EUR", "AUD", "INR", "AED"]} onChange={(v) => v && set({ defaultCurrency: v })} disabled={!canEdit} />
								<NumberInput label="Tax rate" suffix="%" min={0} max={50} decimalScale={2} value={draft.taxRatePct} onChange={(v) => set({ taxRatePct: Number(v) || 0 })} disabled={!canEdit} />
								<TextInput label="Invoice prefix" value={draft.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.currentTarget.value })} disabled={!canEdit} />
								<NumberInput label="Payment terms" suffix=" days" min={0} max={120} value={draft.paymentTermsDays} onChange={(v) => set({ paymentTermsDays: Number(v) || 0 })} disabled={!canEdit} />
							</SimpleGrid>
							<TextInput
								mt="sm"
								label="Billing email"
								description="Named in invoice and dunning emails."
								value={draft.billingEmail}
								onChange={(e) => set({ billingEmail: e.currentTarget.value })}
								maw={360}
								disabled={!canEdit}
							/>
						</Card>
						<Card
							title="Dunning"
							description="What happens when an invoice isn't paid. The billing job runs automatically every few minutes."
							actions={
								<Button size="xs" variant="light" loading={busy} disabled={!allowed("billing.write")} onClick={() => runBillingChecks()}>
									Run billing checks now
								</Button>
							}
						>
							<SimpleGrid cols={{ base: 1, sm: 3 }}>
								<NumberInput
									label="Remind every"
									suffix=" days"
									min={1}
									max={30}
									value={draft.dunning.retryEveryDays}
									onChange={(v) => set({ dunning: { ...draft.dunning, retryEveryDays: Number(v) || 1 } })}
									disabled={!canEdit}
								/>
								<NumberInput
									label="Suspend after"
									description="days past the due date"
									suffix=" days"
									min={1}
									max={180}
									value={draft.dunning.suspendAfterDays}
									onChange={(v) => set({ dunning: { ...draft.dunning, suspendAfterDays: Number(v) || 1 } })}
									disabled={!canEdit}
								/>
								<NumberInput
									label="Cancel after"
									description="days past the due date"
									suffix=" days"
									min={2}
									max={365}
									value={draft.dunning.cancelAfterDays}
									onChange={(v) => set({ dunning: { ...draft.dunning, cancelAfterDays: Number(v) || 2 } })}
									disabled={!canEdit}
								/>
							</SimpleGrid>
							{draft.dunning.cancelAfterDays <= draft.dunning.suspendAfterDays && (
								<Text size="xs" c="red" mt="xs">
									Cancel must come after suspend.
								</Text>
							)}
							{saveBar}
						</Card>
					</Stack>
				</Tabs.Panel>

				<Tabs.Panel value="team">
					<Team />
				</Tabs.Panel>

				<Tabs.Panel value="security">
					<Stack gap="md">
						<MyAccount />
						<Card title="Owner console security" description={canEdit ? undefined : "Only owners can change these."}>
							<Stack gap="md">
								{db.capabilities.twoFactor && (
									<Switch
										label="Require two-factor authentication"
										description="Members without 2FA must set it up before they can use the console."
										checked={draft.security.enforce2fa}
										onChange={(e) => set({ security: { ...draft.security, enforce2fa: e.currentTarget.checked } })}
										disabled={!canEdit}
									/>
								)}
								<Switch
									label="Require a reason to sign in as a client"
									description="Recorded in the change log and passed to the product."
									checked={draft.security.impersonationNeedsReason}
									onChange={(e) => set({ security: { ...draft.security, impersonationNeedsReason: e.currentTarget.checked } })}
									disabled={!canEdit}
								/>
								<NumberInput
									label="Session length"
									description="Applies to new sign-ins."
									suffix=" hours"
									min={1}
									max={72}
									w={220}
									value={draft.security.sessionHours}
									onChange={(v) => set({ security: { ...draft.security, sessionHours: Number(v) || 8 } })}
									disabled={!canEdit}
								/>
								<Textarea
									label="IP allow-list"
									description="One IP or CIDR range per line. Empty allows any address. Saving a list that doesn't include your own address is refused."
									placeholder={"203.0.113.0/24\n198.51.100.7"}
									minRows={3}
									maw={420}
									value={draft.security.ipAllowlist}
									onChange={(e) => set({ security: { ...draft.security, ipAllowlist: e.currentTarget.value } })}
									disabled={!canEdit}
								/>
							</Stack>
							{saveBar}
						</Card>
					</Stack>
				</Tabs.Panel>

				<Tabs.Panel value="integrations">
					<Stack gap="md">
						<Card
							title="Webhooks"
							description="Signed events (client.created, client.status_changed, entitlements.changed, invoice.paid, ticket.created …) are POSTed here. Verify X-Platform-Signature with your WEBHOOK_SECRET."
						>
							{!db.capabilities.webhooks && (
								<Alert color="orange" variant="light" mb="sm" py={8}>
									WEBHOOK_SECRET isn&apos;t set on the API server, so no events are sent.
								</Alert>
							)}
							<TextInput placeholder="https://hooks.example.com/platform" value={draft.webhookUrl} onChange={(e) => set({ webhookUrl: e.currentTarget.value.trim() })} maw={480} disabled={!canEdit} />
							{saveBar}
						</Card>
						{canEdit && <Activity />}
					</Stack>
				</Tabs.Panel>

				<Tabs.Panel value="marketing">
					<MarketingSite />
				</Tabs.Panel>
			</Tabs>

		</>
	);
}

function MyAccount() {
	const db = useDb();
	const { me, mfaDisable, changePassword, busy } = useStore();
	const [mode, setMode] = useState<null | "mfa-on" | "mfa-off" | "password">(null);
	const [code, setCode] = useState("");
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	if (!me) return null;

	const close = () => {
		setMode(null);
		setCode("");
		setCurrent("");
		setNext("");
	};

	return (
		<Card title="Your account" description={`${me.name} · ${me.email} · ${roleLabels[me.role]}`}>
			<Group gap="lg">
				{db.capabilities.twoFactor && (
					<>
						<Group gap="xs">
							<Text size="sm">Two-factor authentication</Text>
							{me.twoFactor ? <StatusPill label="On" color="green" /> : <StatusPill label="Off" color="orange" />}
						</Group>
						{me.twoFactor ? (
							<Button size="xs" variant="subtle" color="red" disabled={db.settings.security.enforce2fa} onClick={() => setMode("mfa-off")}>
								Turn off
							</Button>
						) : (
							<Button size="xs" variant="light" onClick={() => setMode("mfa-on")}>
								Set up
							</Button>
						)}
					</>
				)}
				<Button size="xs" variant="default" onClick={() => setMode("password")}>
					Change password
				</Button>
			</Group>

			<Modal opened={mode === "mfa-on"} onClose={close} title={<Text fw={600}>Set up two-factor authentication</Text>}>
				<MfaSetup onDone={close} onCancel={close} />
			</Modal>

			<Modal opened={mode === "mfa-off"} onClose={close} title={<Text fw={600}>Turn off two-factor authentication</Text>}>
				<Stack>
					<Text size="sm">Enter a current code from your authenticator app to confirm.</Text>
					<PinInput length={6} type="number" oneTimeCode value={code} onChange={setCode} aria-label="Authentication code" />
					<Group justify="flex-end">
						<Button variant="default" onClick={close}>
							Cancel
						</Button>
						<Button
							color="red"
							loading={busy}
							disabled={code.length !== 6}
							onClick={async () => {
								if (await mfaDisable(code)) close();
								else setCode("");
							}}
						>
							Turn off
						</Button>
					</Group>
				</Stack>
			</Modal>

			<Modal opened={mode === "password"} onClose={close} title={<Text fw={600}>Change password</Text>}>
				<Stack>
					<PasswordInput label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.currentTarget.value)} />
					<PasswordInput label="New password" description="At least 10 characters. Your other devices will be signed out." autoComplete="new-password" value={next} onChange={(e) => setNext(e.currentTarget.value)} />
					<Group justify="flex-end">
						<Button variant="default" onClick={close}>
							Cancel
						</Button>
						<Button
							loading={busy}
							disabled={!current || next.length < 10}
							onClick={async () => {
								if (await changePassword(current, next)) close();
							}}
						>
							Change password
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Card>
	);
}

function Activity() {
	const { loadActivity } = useStore();
	const [log, setLog] = useState<ActivityLog | null>(null);
	const [loading, setLoading] = useState(true);

	const load = async () => {
		setLoading(true);
		setLog(await loadActivity());
		setLoading(false);
	};
	useEffect(() => {
		void load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<SimpleGrid cols={{ base: 1, lg: 2 }}>
			<Card
				title="Recent webhook deliveries"
				actions={
					<Button size="xs" variant="subtle" loading={loading} onClick={load}>
						Refresh
					</Button>
				}
			>
				{!log?.webhooks.length ? (
					<EmptyState title="No events sent yet" />
				) : (
					<Stack gap={0}>
						{log.webhooks.map((w) => (
							<Group key={w.id} justify="space-between" py={6} wrap="nowrap" style={{ borderBottom: "1px solid var(--oa-border)" }}>
								<div style={{ minWidth: 0 }}>
									<Text size="sm">
										<code>{w.event}</code>
									</Text>
									<Text size="xs" c={w.lastError ? "red.7" : "dimmed"} truncate>
										{w.lastError ? `${w.lastError} · ` : ""}
										{w.attempts} attempt{w.attempts === 1 ? "" : "s"} · {relative(w.createdAt)}
									</Text>
								</div>
								<StatusPill label={w.status} color={w.status === "delivered" ? "green" : w.status === "failed" ? "red" : "orange"} />
							</Group>
						))}
					</Stack>
				)}
			</Card>
			<Card title="Recent emails" description={log ? undefined : "Loading…"}>
				{!log?.emails.length ? (
					<EmptyState title="No emails yet" />
				) : (
					<Stack gap={0}>
						{log.emails.map((e) => (
							<Group key={e.id} justify="space-between" py={6} wrap="nowrap" style={{ borderBottom: "1px solid var(--oa-border)" }}>
								<div style={{ minWidth: 0 }}>
									<Text size="sm" truncate>
										{e.subject}
									</Text>
									<Text size="xs" c={e.error ? "red.7" : "dimmed"} truncate>
										{e.to} · {dateTime(e.createdAt)}
										{e.error ? ` · ${e.error}` : ""}
									</Text>
								</div>
								<StatusPill label={e.status === "logged" ? "logged only" : e.status} color={e.status === "sent" ? "green" : e.status === "failed" ? "red" : "gray"} />
							</Group>
						))}
					</Stack>
				)}
			</Card>
		</SimpleGrid>
	);
}

function Team() {
	const db = useDb();
	const { inviteStaff, updateStaff, staffLink, resetStaffMfa, allowed, me, busy } = useStore();
	const [inviting, setInviting] = useState(false);
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [role, setRole] = useState<StaffRole>("support");
	const [link, setLink] = useState<{ email: string; url: string; purpose: string } | null>(null);
	const canEdit = allowed("team.write");
	const owners = db.staff.filter((s) => s.role === "owner" && s.status === "active").length;
	const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !db.staff.some((s) => s.email.toLowerCase() === email.trim().toLowerCase());

	return (
		<Stack gap="md">
			<Card
				title="Team"
				description="People who can sign in to this console. This is separate from each client's own staff."
				actions={
					<Button size="xs" leftSection={<UserPlus size={14} />} disabled={!canEdit} onClick={() => setInviting(true)}>
						Invite member
					</Button>
				}
			>
				<div className="oa-table-wrap">
					<table className="oa-table">
						<thead>
							<tr>
								<th>Member</th>
								<th>Role</th>
								{db.capabilities.twoFactor && <th>2FA</th>}
								<th>Status</th>
								<th>Last active</th>
								<th aria-label="Actions" />
							</tr>
						</thead>
						<tbody>
							{db.staff.map((s) => {
								const self = s.id === me?.id;
								const lastOwner = s.role === "owner" && s.status === "active" && owners <= 1;
								return (
									<tr key={s.id}>
										<td>
											<Group gap="sm" wrap="nowrap">
												<EntityAvatar name={s.name} size={26} />
												<div>
													<Text size="sm" fw={500}>
														{s.name}
														{self ? " (you)" : ""}
													</Text>
													<Text size="xs" c="dimmed">
														{s.email}
													</Text>
												</div>
											</Group>
										</td>
										<td>
											<Select
												size="xs"
												w={130}
												value={s.role}
												disabled={!canEdit || lastOwner || self}
												data={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))}
												onChange={(v) => v && v !== s.role && updateStaff(s.id, { role: v as StaffRole }, `${s.name} is now ${roleLabels[v as StaffRole]}.`)}
												aria-label={`Role for ${s.name}`}
											/>
										</td>
										{db.capabilities.twoFactor && <td>{s.twoFactor ? <StatusPill label="On" color="green" /> : <StatusPill label="Off" color="orange" />}</td>}
										<td>
											<StatusPill label={s.status} color={s.status === "active" ? "green" : s.status === "invited" ? "blue" : "gray"} />
										</td>
										<td>{relative(s.lastActiveAt)}</td>
										<td style={{ textAlign: "right" }}>
											<Menu position="bottom-end" width={220} shadow="md">
												<Menu.Target>
													<ActionIcon variant="subtle" color="gray" disabled={!canEdit} aria-label={`Actions for ${s.name}`}>
														<MoreVertical size={16} />
													</ActionIcon>
												</Menu.Target>
												<Menu.Dropdown>
													{s.status !== "disabled" && (
														<Menu.Item
															onClick={async () => {
																const r = await staffLink(s.id);
																if (r) setLink({ email: s.email, url: r.link, purpose: r.purpose });
															}}
														>
															{s.status === "invited" ? "Resend invitation" : "Send password-reset link"}
														</Menu.Item>
													)}
													{db.capabilities.twoFactor && s.twoFactor && (
														<Menu.Item disabled={self} onClick={() => resetStaffMfa(s.id)}>
															Reset two-factor
														</Menu.Item>
													)}
													<Menu.Divider />
													{s.status === "disabled" ? (
														<Menu.Item onClick={() => updateStaff(s.id, { status: "active" }, `${s.name} can sign in again.`)}>Enable access</Menu.Item>
													) : (
														<Menu.Item
															color="red"
															disabled={self || lastOwner || s.status === "invited"}
															onClick={() => updateStaff(s.id, { status: "disabled" }, `${s.name} was signed out and can't sign in.`)}
														>
															Disable access
														</Menu.Item>
													)}
												</Menu.Dropdown>
											</Menu>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</Card>
			<Card title="Roles">
				<SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
					{(Object.keys(roleLabels) as StaffRole[]).map((r) => (
						<div key={r}>
							<Text size="sm" fw={600}>
								{roleLabels[r]}
							</Text>
							<Text size="xs" c="dimmed">
								{roleDescriptions[r]}
							</Text>
						</div>
					))}
				</SimpleGrid>
			</Card>

			<Modal opened={inviting} onClose={() => setInviting(false)} title={<Text fw={600}>Invite team member</Text>}>
				<Stack>
					<TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
					<TextInput label="Work email" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} error={email && !emailValid ? "Enter a new, valid email" : undefined} />
					<Select label="Role" value={role} data={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} onChange={(v) => v && setRole(v as StaffRole)} description={roleDescriptions[role]} />
					<Group justify="flex-end">
						<Button variant="default" onClick={() => setInviting(false)}>
							Cancel
						</Button>
						<Button
							loading={busy}
							disabled={!emailValid || !name.trim()}
							onClick={async () => {
								const url = await inviteStaff({ name: name.trim(), email: email.trim(), role });
								if (!url) return;
								setLink({ email: email.trim(), url, purpose: "invite" });
								setInviting(false);
								setEmail("");
								setName("");
							}}
						>
							Send invite
						</Button>
					</Group>
				</Stack>
			</Modal>

			<Modal opened={!!link} onClose={() => setLink(null)} title={<Text fw={600}>{link?.purpose === "invite" ? "Invitation ready" : "Reset link ready"}</Text>}>
				{link && (
					<Stack>
						<Text size="sm">
							{db.capabilities.smtp ? `We emailed this link to ${link.email}.` : `Email isn't configured on the server, so send this link to ${link.email} yourself.`} It works once and expires in 72 hours.
						</Text>
						<Code block style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
							{link.url}
						</Code>
						<Group justify="flex-end">
							<CopyButton value={link.url}>
								{({ copied, copy }) => (
									<Button variant="default" onClick={copy}>
										{copied ? "Copied" : "Copy link"}
									</Button>
								)}
							</CopyButton>
							<Button onClick={() => setLink(null)}>Done</Button>
						</Group>
					</Stack>
				)}
			</Modal>
		</Stack>
	);
}

