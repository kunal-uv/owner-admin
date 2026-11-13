"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
	ActionIcon,
	Alert,
	Anchor,
	Badge,
	Box,
	Button,
	Center,
	Group,
	Kbd,
	Loader,
	Menu,
	Modal,
	ScrollArea,
	Stack,
	Text,
	TextInput,
	UnstyledButton,
} from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import {
	Bell,
	ChevronDown,
	CreditCard,
	Globe,
	Headphones,
	History,
	Layers,
	LayoutDashboard,
	LogOut,
	Menu as MenuIcon,
	Package,
	Plus,
	Receipt,
	Search,
	Settings,
	Store,
	AlertTriangle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { initials, roleLabels } from "@/lib/domain";
import { EntityAvatar } from "@/components/ui";
import { AuthCard } from "@/components/auth/AuthCard";
import { MfaSetup } from "@/components/auth/MfaSetup";

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: number; exact?: boolean };

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
	const Icon = item.icon;
	return (
		<Link href={item.href} className="oa-nav-link" data-active={active} onClick={onNavigate}>
			<Icon size={16} strokeWidth={1.8} />
			<span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
				{item.label}
			</span>
			{!!item.badge && (
				<Badge size="xs" variant="filled" color="brand" radius="xl">
					{item.badge}
				</Badge>
			)}
		</Link>
	);
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
	const { db } = useStore();
	const pathname = usePathname() ?? "/";
	if (!db) return null;

	const newLeads = db.leads.filter((l) => l.status === "new").length;
	const openTickets = db.tickets.filter((t) => t.status === "open").length;

	const primary: NavItem[] = [
		{ href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
		{ href: "/leads", label: "New leads", icon: Bell, badge: newLeads },
		{ href: "/clients", label: "Clients", icon: Store, exact: true },
		{ href: "/clients/new", label: "New client", icon: Plus, exact: true },
		{ href: "/products", label: "Products", icon: Package },
		{ href: "/plans", label: "Plans", icon: CreditCard },
		{ href: "/billing", label: "Billing", icon: Receipt },
		{ href: "/website", label: "Websites", icon: Globe },
		{ href: "/changelog", label: "Change log", icon: History },
	];
	const footer: NavItem[] = [
		{ href: "/settings", label: "Settings", icon: Settings },
		{ href: "/support", label: "Support", icon: Headphones, badge: openTickets },
	];

	const isActive = (item: NavItem) =>
		item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
	// "Clients" stays lit on a client's page, but not on "New client".
	const clientsActive = (item: NavItem) =>
		item.href === "/clients" ? pathname === "/clients" || (/^\/clients\/[^/]+$/.test(pathname) && pathname !== "/clients/new") : isActive(item);

	return (
		<aside className="oa-sidebar" data-open={open} aria-label="Main navigation">
			<Group gap={10} px={16} pt={18} pb={14} wrap="nowrap">
				<Center w={34} h={34} bg="brand.6" c="white" style={{ borderRadius: "50%", flexShrink: 0 }}>
					<Layers size={17} strokeWidth={2} />
				</Center>
				<Box style={{ minWidth: 0 }}>
					<Text fw={600} size="sm" lh={1.2} truncate>
						{db.settings.brandName}
					</Text>
					<Text size="xs" c="dimmed" lh={1.3} truncate>
						{db.settings.consoleSubtitle}
					</Text>
				</Box>
			</Group>

			<ScrollArea style={{ flex: 1 }} px={10} type="hover">
				<nav>
					<NavLink item={primary[0]} active={isActive(primary[0])} onNavigate={onNavigate} />
					<NavLink item={primary[1]} active={isActive(primary[1])} onNavigate={onNavigate} />
					<Box h={10} />
					{primary.slice(2).map((item) => (
						<NavLink key={item.href} item={item} active={clientsActive(item)} onNavigate={onNavigate} />
					))}
					<div className="oa-nav-section">Clients</div>
					{db.clients.slice(0, 12).map((c) => (
						<Link
							key={c.id}
							href={`/clients/${c.id}`}
							className="oa-nav-link"
							data-active={pathname === `/clients/${c.id}`}
							onClick={onNavigate}
						>
							<Text component="span" fz={10} fw={700} c="dimmed" w={18} ta="center" style={{ flexShrink: 0 }}>
								{initials(c.name)}
							</Text>
							<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
						</Link>
					))}
					{db.clients.length > 12 && (
						<Link href="/clients" className="oa-nav-link" onClick={onNavigate}>
							<Text size="xs" c="dimmed">
								View all {db.clients.length} clients
							</Text>
						</Link>
					)}
				</nav>
			</ScrollArea>

			<Box px={10} py={12} style={{ borderTop: "1px solid var(--oa-border)" }}>
				{footer.map((item) => (
					<NavLink key={item.href} item={item} active={isActive(item)} onNavigate={onNavigate} />
				))}
			</Box>
		</aside>
	);
}

function CommandPalette({ opened, onClose }: { opened: boolean; onClose: () => void }) {
	const { db } = useStore();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [cursor, setCursor] = useState(0);

	const results = useMemo(() => {
		if (!db) return [];
		const pages = [
			["Overview", "/"],
			["New leads", "/leads"],
			["Clients", "/clients"],
			["New client", "/clients/new"],
			["Products", "/products"],
			["Plans", "/plans"],
			["Billing & invoices", "/billing"],
			["Client websites", "/website"],
			["Change log", "/changelog"],
			["Support tickets", "/support"],
			["Settings", "/settings"],
		].map(([label, href]) => ({ group: "Pages", label, sub: "", href }));
		const clients = db.clients.map((c) => ({
			group: "Clients",
			label: c.name,
			sub: `${c.slug} · ${c.adminHost}`,
			href: `/clients/${c.id}`,
		}));
		const plans = db.plans.map((p) => ({
			group: "Plans",
			label: `${p.name} plan`,
			sub: db.products.find((x) => x.id === p.productId)?.name ?? "",
			href: `/plans?edit=${p.id}`,
		}));
		const leads = db.leads.map((l) => ({ group: "Leads", label: l.company || l.name, sub: l.email, href: "/leads" }));
		const q = query.trim().toLowerCase();
		const all = [...pages, ...clients, ...plans, ...leads];
		return (q ? all.filter((r) => `${r.label} ${r.sub}`.toLowerCase().includes(q)) : [...pages.slice(0, 6), ...clients]).slice(0, 12);
	}, [db, query]);

	useEffect(() => setCursor(0), [query, opened]);

	const go = (href: string) => {
		onClose();
		setQuery("");
		router.push(href);
	};

	return (
		<Modal opened={opened} onClose={onClose} withCloseButton={false} size={560} yOffset="12vh" centered={false} padding={0}>
			<TextInput
				data-autofocus
				placeholder="Search clients, plans, leads and pages"
				leftSection={<Search size={16} />}
				variant="unstyled"
				size="md"
				px="sm"
				value={query}
				onChange={(e) => setQuery(e.currentTarget.value)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") {
						e.preventDefault();
						setCursor((c) => Math.min(c + 1, results.length - 1));
					} else if (e.key === "ArrowUp") {
						e.preventDefault();
						setCursor((c) => Math.max(c - 1, 0));
					} else if (e.key === "Enter" && results[cursor]) {
						go(results[cursor].href);
					}
				}}
				style={{ borderBottom: "1px solid var(--oa-border)" }}
			/>
			<ScrollArea.Autosize mah={380} p={6}>
				{results.length === 0 && (
					<Text size="sm" c="dimmed" ta="center" py="lg">
						Nothing matches “{query}”.
					</Text>
				)}
				{results.map((r, i) => (
					<UnstyledButton
						key={`${r.group}-${r.href}-${r.label}`}
						onClick={() => go(r.href)}
						onMouseEnter={() => setCursor(i)}
						w="100%"
						px="sm"
						py={8}
						style={{ borderRadius: 8, background: i === cursor ? "var(--mantine-color-brand-0)" : undefined }}
					>
						<Group justify="space-between" wrap="nowrap">
							<Box style={{ minWidth: 0 }}>
								<Text size="sm" truncate>
									{r.label}
								</Text>
								{r.sub && (
									<Text size="xs" c="dimmed" truncate>
										{r.sub}
									</Text>
								)}
							</Box>
							<Text size="xs" c="dimmed">
								{r.group}
							</Text>
						</Group>
					</UnstyledButton>
				))}
			</ScrollArea.Autosize>
		</Modal>
	);
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
	const { ready, me, db, logout, phase, bootError, boot } = useStore();
	const router = useRouter();
	const pathname = usePathname();
	const [navOpen, setNavOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);

	useHotkeys([["mod+K", () => setPaletteOpen(true)]]);
	useEffect(() => setNavOpen(false), [pathname]);

	useEffect(() => {
		if (phase === "signed_out" || phase === "mfa") router.replace(`/login?next=${encodeURIComponent(pathname ?? "/")}`);
	}, [phase, router, pathname]);

	if (phase === "error") {
		return (
			<AuthCard title="Can't load the console" subtitle={bootError ?? undefined}>
				<Button onClick={() => boot()}>Try again</Button>
			</AuthCard>
		);
	}

	if (phase === "mfa_setup") {
		return (
			<AuthCard title="Set up two-factor authentication" subtitle="This console requires it for every team member.">
				<MfaSetup />
				<Anchor component="button" type="button" size="sm" c="dimmed" onClick={() => logout()}>
					Sign out
				</Anchor>
			</AuthCard>
		);
	}

	if (!ready || !me || !db) {
		return (
			<Center h="100vh">
				<Loader size="sm" />
			</Center>
		);
	}

	return (
		<div className="oa-shell">
			<Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
			<div className="oa-scrim" data-open={navOpen} onClick={() => setNavOpen(false)} />
			<div className="oa-main">
				<header className="oa-topbar">
					<ActionIcon className="oa-burger" variant="subtle" color="gray" onClick={() => setNavOpen(true)} aria-label="Open navigation">
						<MenuIcon size={18} />
					</ActionIcon>
					<UnstyledButton
						onClick={() => setPaletteOpen(true)}
						style={{
							flex: "0 1 390px",
							minWidth: 0,
							height: 34,
							border: "1px solid var(--oa-border)",
							borderRadius: 8,
							padding: "0 8px 0 10px",
							display: "flex",
							alignItems: "center",
							gap: 8,
							color: "var(--oa-muted)",
						}}
						aria-label="Search"
					>
						<Search size={15} />
						<Text size="sm" c="dimmed" style={{ flex: 1 }} truncate>
							Search clients and pages
						</Text>
						<Kbd size="xs">⌘K</Kbd>
					</UnstyledButton>
					<Box style={{ flex: 1 }} />
					<Menu position="bottom-end" width={240} shadow="md">
						<Menu.Target>
							<UnstyledButton
								style={{ border: "1px solid var(--oa-border)", borderRadius: 999, padding: "4px 10px 4px 4px", display: "flex", alignItems: "center", gap: 8 }}
							>
								<EntityAvatar name={me.name} size={24} />
								<Text size="sm" fw={500} visibleFrom="sm">
									{me.email}
								</Text>
								<ChevronDown size={14} />
							</UnstyledButton>
						</Menu.Target>
						<Menu.Dropdown>
							<Menu.Label>
								{me.name} · {roleLabels[me.role]}
							</Menu.Label>
							<Menu.Item leftSection={<Settings size={14} />} onClick={() => router.push("/settings")}>
								Settings
							</Menu.Item>
							<Menu.Divider />
							<Menu.Item
								color="red"
								leftSection={<LogOut size={14} />}
								onClick={() => {
									void logout().then(() => router.replace("/login"));
								}}
							>
								Sign out
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				</header>
				<main className="oa-content">
					{db.settings.maintenanceMode && (
						<Alert color="orange" icon={<AlertTriangle size={16} />} mb="md" title="Maintenance mode is on">
							Client admins show a maintenance page. Turn it off in Settings → General.
						</Alert>
					)}
					<Stack gap={0}>{children}</Stack>
				</main>
			</div>
			<CommandPalette opened={paletteOpen} onClose={() => setPaletteOpen(false)} />
		</div>
	);
}
