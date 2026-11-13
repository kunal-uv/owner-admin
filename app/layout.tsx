import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { theme } from "@/lib/theme";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
	title: { default: "Owner console", template: "%s · Owner console" },
	description: "Platform owner console — clients, plans, products and billing.",
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
			<head>
				<ColorSchemeScript defaultColorScheme="light" />
			</head>
			<body>
				<MantineProvider theme={theme} defaultColorScheme="light">
					<Notifications position="bottom-right" />
					<StoreProvider>{children}</StoreProvider>
				</MantineProvider>
			</body>
		</html>
	);
}
