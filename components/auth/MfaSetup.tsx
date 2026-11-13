"use client";

import React, { useEffect, useState } from "react";
import { Alert, Button, Code, Group, Image, PinInput, Stack, Text } from "@mantine/core";
import { useStore } from "@/lib/store";

/** Scan-a-QR-code TOTP enrolment, used both when forced and from Settings. */
export function MfaSetup({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
	const { mfaSetup, mfaEnable } = useStore();
	const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let live = true;
		mfaSetup().then((s) => {
			if (live && s) setSetup(s);
		});
		return () => {
			live = false;
		};
	}, [mfaSetup]);

	const submit = async () => {
		setSaving(true);
		const err = await mfaEnable(code);
		setSaving(false);
		if (err) {
			setError(err);
			setCode("");
		} else onDone?.();
	};

	return (
		<Stack gap="sm">
			<Text size="sm">1. Scan this code with an authenticator app (Google Authenticator, 1Password, Authy…).</Text>
			{setup ? (
				<>
					<Image src={setup.qrDataUrl} alt="Two-factor QR code" w={180} h={180} />
					<Text size="xs" c="dimmed">
						Can&apos;t scan? Enter this key: <Code>{setup.secret}</Code>
					</Text>
				</>
			) : (
				<Text size="sm" c="dimmed">
					Preparing…
				</Text>
			)}
			<Text size="sm">2. Enter the 6-digit code it shows.</Text>
			<PinInput length={6} type="number" oneTimeCode value={code} onChange={setCode} aria-label="Authentication code" />
			{error && (
				<Alert color="red" variant="light" py={8}>
					{error}
				</Alert>
			)}
			<Group justify="flex-end">
				{onCancel && (
					<Button variant="default" onClick={onCancel}>
						Cancel
					</Button>
				)}
				<Button disabled={!setup || code.length !== 6} loading={saving} onClick={submit}>
					Turn on
				</Button>
			</Group>
		</Stack>
	);
}
