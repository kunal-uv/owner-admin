"use client";

import React from "react";
import { Avatar, Badge, Box, Group, Progress, Stack, Text, Title, Tooltip } from "@mantine/core";
import { initials, limitLabel } from "@/lib/domain";

export function PageHeader({
	title,
	badge,
	description,
	actions,
	back,
}: {
	title: React.ReactNode;
	badge?: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	back?: React.ReactNode;
}) {
	return (
		<Box pb="md" mb="lg" style={{ borderBottom: "1px solid var(--oa-border)" }}>
			{back}
			<Group justify="space-between" align="center" wrap="wrap" gap="sm">
				<Stack gap={2}>
					<Group gap="sm" align="center">
						<Title order={2} fz={20}>
							{title}
						</Title>
						{badge}
					</Group>
					{description && (
						<Text size="sm" c="dimmed">
							{description}
						</Text>
					)}
				</Stack>
				{actions && <Group gap="xs">{actions}</Group>}
			</Group>
		</Box>
	);
}

/** The "● Active" pill from the reference design. */
export function StatusPill({ label, color }: { label: string; color: string }) {
	return (
		<Badge
			variant="light"
			color={color}
			size="md"
			leftSection={<span className="oa-dot" />}
			styles={{ root: { paddingInline: 8 } }}
		>
			{label}
		</Badge>
	);
}

export function CountPill({ children, color = "green" }: { children: React.ReactNode; color?: string }) {
	return <StatusPill label={String(children)} color={color} />;
}

export function Card({
	title,
	description,
	actions,
	children,
	padding = 16,
}: {
	title?: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
	children: React.ReactNode;
	padding?: number;
}) {
	return (
		<div className="oa-card" style={{ padding }}>
			{(title || actions) && (
				<Group justify="space-between" align="flex-start" mb="sm" wrap="wrap" gap="xs">
					<Stack gap={2}>
						{title && (
							<Text fw={600} size="sm">
								{title}
							</Text>
						)}
						{description && (
							<Text size="xs" c="dimmed">
								{description}
							</Text>
						)}
					</Stack>
					{actions && <Group gap="xs">{actions}</Group>}
				</Group>
			)}
			{children}
		</div>
	);
}

const avatarColors = ["teal", "violet", "blue", "orange", "pink", "cyan", "grape", "indigo"];
const colorFor = (seed: string) => avatarColors[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];

export function EntityAvatar({ name, size = 30 }: { name: string; size?: number }) {
	return (
		<Avatar size={size} radius="xl" color={colorFor(name)} variant="light" fz={size < 26 ? 9 : 11} fw={600}>
			{initials(name)}
		</Avatar>
	);
}

export function Stat({
	label,
	value,
	hint,
	tone,
}: {
	label: string;
	value: React.ReactNode;
	hint?: React.ReactNode;
	tone?: "good" | "bad";
}) {
	return (
		<div className="oa-card">
			<Text size="xs" c="dimmed" fw={500}>
				{label}
			</Text>
			<Text fz={24} fw={600} mt={4} style={{ fontVariantNumeric: "tabular-nums" }}>
				{value}
			</Text>
			{hint && (
				<Text size="xs" mt={2} c={tone === "good" ? "green.7" : tone === "bad" ? "red.7" : "dimmed"}>
					{hint}
				</Text>
			)}
		</div>
	);
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
	return (
		<Stack align="center" gap={6} py={40} px="md" ta="center">
			{icon && <Box c="gray.5">{icon}</Box>}
			<Text fw={600} size="sm">
				{title}
			</Text>
			{children && (
				<Text size="sm" c="dimmed" maw={420}>
					{children}
				</Text>
			)}
		</Stack>
	);
}

/** Usage against a limit; -1 means unlimited. */
export function UsageBar({ label, used, limit, unit }: { label: string; used: number; limit: number; unit?: string }) {
	const unlimited = limit < 0;
	const pct = unlimited || limit === 0 ? 0 : Math.min(100, (used / limit) * 100);
	const color = pct >= 100 ? "red" : pct >= 80 ? "orange" : "brand";
	return (
		<Stack gap={4}>
			<Group justify="space-between" gap="xs">
				<Text size="xs" c="dimmed">
					{label}
				</Text>
				<Text size="xs" fw={500} style={{ fontVariantNumeric: "tabular-nums" }}>
					{used.toLocaleString()}
					{unit ? ` ${unit}` : ""} / {limitLabel(limit)}
					{!unlimited && unit ? ` ${unit}` : ""}
				</Text>
			</Group>
			<Tooltip label={unlimited ? "Unlimited on this plan" : `${pct.toFixed(0)}% used`}>
				<Progress value={unlimited ? 0 : pct} color={color} size="sm" radius="xl" />
			</Tooltip>
		</Stack>
	);
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<Group justify="space-between" gap="md" wrap="nowrap" py={6} style={{ borderBottom: "1px solid var(--oa-border)" }}>
			<Text size="sm" c="dimmed">
				{label}
			</Text>
			<Box ta="right" fz="sm" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
				{children}
			</Box>
		</Group>
	);
}
