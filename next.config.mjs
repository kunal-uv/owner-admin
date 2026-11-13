const isDev = process.env.NODE_ENV !== "production";

/**
 * The browser only ever talks to this origin: /api/* is proxied to
 * owner-admin-api (OWNER_API_URL), so the session cookie stays first-party and
 * the CSP can keep connect-src to 'self'.
 */
const ownerApiUrl = (process.env.OWNER_API_URL || "http://localhost:4100").replace(/\/$/, "");

const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
	"style-src 'self' 'unsafe-inline'",
	"font-src 'self' data:",
	// Client images (their CDN) and client website previews (iframes) live on the clients' own hosts.
	`img-src 'self' data: blob: https:${isDev ? " http://localhost:* http://127.0.0.1:*" : ""}`,
	`frame-src https:${isDev ? " http://localhost:* http://127.0.0.1:*" : ""}`,
	`connect-src 'self'${isDev ? " ws: http://localhost:*" : ""}`,
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"object-src 'none'",
].join("; ");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: csp },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
	// The owner console must never be indexed.
	{ key: "X-Robots-Tag", value: "noindex, nofollow" },
];

if (!isDev) {
	securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
}

export default {
	reactStrictMode: true,
	poweredByHeader: false,
	eslint: { ignoreDuringBuilds: true },
	experimental: { optimizePackageImports: ["@mantine/core", "@mantine/hooks", "lucide-react"] },
	async rewrites() {
		return [{ source: "/api/:path*", destination: `${ownerApiUrl}/:path*` }];
	},
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
};
