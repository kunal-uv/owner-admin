import { createTheme, type MantineColorsTuple } from "@mantine/core";

const brand: MantineColorsTuple = [
	"#eff6ff",
	"#dbeafe",
	"#bfdbfe",
	"#93c5fd",
	"#60a5fa",
	"#3b82f6",
	"#2563eb",
	"#1d4ed8",
	"#1e40af",
	"#1e3a8a",
];

export const theme = createTheme({
	primaryColor: "brand",
	primaryShade: 6,
	colors: { brand },
	fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
	fontFamilyMonospace: "var(--font-geist-mono), ui-monospace, monospace",
	defaultRadius: "md",
	headings: { fontWeight: "600" },
	components: {
		Button: { defaultProps: { fw: 500 } },
		Modal: { defaultProps: { centered: true, overlayProps: { backgroundOpacity: 0.35, blur: 2 } } },
		Drawer: { defaultProps: { overlayProps: { backgroundOpacity: 0.25 } } },
		Badge: { defaultProps: { radius: "sm", tt: "none", fw: 500 } },
		Paper: { defaultProps: { withBorder: true } },
		Tooltip: { defaultProps: { withArrow: true, openDelay: 300 } },
	},
});
