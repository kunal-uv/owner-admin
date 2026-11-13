"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Anchor, Button, Center, Loader, PasswordInput, PinInput, Stack, Text, TextInput } from "@mantine/core";
import { useStore } from "@/lib/store";
import { AuthCard } from "@/components/auth/AuthCard";

function LoginForm() {
	const { login, verifyMfa, logout, phase, boot } = useStore();
	const router = useRouter();
	const params = useSearchParams();
	const next = params?.get("next");
	const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (phase === "ready" || phase === "mfa_setup") router.replace(target);
	}, [phase, router, target]);

	if (phase === "loading" || phase === "ready" || phase === "mfa_setup") {
		return (
			<Center h="100vh">
				<Loader size="sm" />
			</Center>
		);
	}

	if (phase === "mfa") {
		return (
			<AuthCard title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app.">
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						setSubmitting(true);
						setError(await verifyMfa(code));
						setSubmitting(false);
						setCode("");
					}}
				>
					<Stack gap="md">
						{error && (
							<Alert color="red" variant="light" py={8}>
								{error}
							</Alert>
						)}
						<PinInput length={6} type="number" oneTimeCode autoFocus value={code} onChange={setCode} aria-label="Authentication code" />
						<Button type="submit" fullWidth disabled={code.length !== 6} loading={submitting}>
							Verify
						</Button>
						<Anchor component="button" type="button" size="sm" c="dimmed" onClick={() => logout()}>
							Use a different account
						</Anchor>
					</Stack>
				</form>
			</AuthCard>
		);
	}

	return (
		<AuthCard title="Sign in to the owner console" subtitle="Platform owner access only. Client admins sign in on their own address.">
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					setSubmitting(true);
					const res = await login(email, password);
					setSubmitting(false);
					setError(res.error ?? null);
					if (res.error) setPassword("");
				}}
			>
				<Stack gap="md">
					{phase === "error" && (
						<Alert color="orange" variant="light" py={8}>
							Can&apos;t reach the server. Is owner-admin-api running?{" "}
							<Anchor component="button" type="button" size="sm" onClick={() => boot()}>
								Retry
							</Anchor>
						</Alert>
					)}
					{error && (
						<Alert color="red" variant="light" py={8}>
							{error}
						</Alert>
					)}
					<TextInput label="Work email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
					<PasswordInput label="Password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
					<Button type="submit" fullWidth loading={submitting}>
						Sign in
					</Button>
					<Text size="xs" c="dimmed">
						Forgot your password? Ask an owner to send you a reset link from Settings → Team & roles.
					</Text>
				</Stack>
			</form>
		</AuthCard>
	);
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm />
		</Suspense>
	);
}
