"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Anchor, Button, Center, Loader, PasswordInput, Stack, Text } from "@mantine/core";
import { api } from "@/lib/api";
import { AuthCard } from "@/components/auth/AuthCard";

type Info = { purpose: "invite" | "reset"; email: string; name: string };

function AcceptForm() {
	const token = useSearchParams()?.get("token") ?? "";
	const [info, setInfo] = useState<Info | null>(null);
	const [loadError, setLoadError] = useState<string | null>(token ? null : "This link is missing its token.");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!token) return;
		api<Info>("GET", `/admin/auth/token/${encodeURIComponent(token)}`)
			.then(setInfo)
			.catch((e: Error) => setLoadError(e.message));
	}, [token]);

	if (loadError) {
		return (
			<AuthCard title="Link not valid">
				<Alert color="red" variant="light">
					{loadError}
				</Alert>
				<Anchor component={Link} href="/login" size="sm">
					Go to sign in
				</Anchor>
			</AuthCard>
		);
	}
	if (!info) {
		return (
			<Center h="100vh">
				<Loader size="sm" />
			</Center>
		);
	}
	if (done) {
		return (
			<AuthCard title="Password set" subtitle={`You can now sign in as ${info.email}.`}>
				<Button component={Link} href="/login">
					Sign in
				</Button>
			</AuthCard>
		);
	}

	const mismatch = confirm.length > 0 && confirm !== password;
	return (
		<AuthCard
			title={info.purpose === "invite" ? `Welcome, ${info.name}` : "Choose a new password"}
			subtitle={info.purpose === "invite" ? `Set a password for ${info.email} to join the owner console.` : `For ${info.email}. Other devices will be signed out.`}
		>
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					setSaving(true);
					try {
						await api("POST", "/admin/auth/token/accept", { token, password });
						setDone(true);
					} catch (err) {
						setError((err as Error).message);
					} finally {
						setSaving(false);
					}
				}}
			>
				<Stack gap="md">
					{error && (
						<Alert color="red" variant="light" py={8}>
							{error}
						</Alert>
					)}
					<PasswordInput label="New password" description="At least 10 characters." autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
					<PasswordInput label="Repeat password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.currentTarget.value)} error={mismatch ? "Passwords don't match" : undefined} />
					<Button type="submit" loading={saving} disabled={password.length < 10 || password !== confirm}>
						Set password
					</Button>
					<Text size="xs" c="dimmed">
						This link works once and expires 72 hours after it was sent.
					</Text>
				</Stack>
			</form>
		</AuthCard>
	);
}

export default function AcceptInvitePage() {
	return (
		<Suspense>
			<AcceptForm />
		</Suspense>
	);
}
