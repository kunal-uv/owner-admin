import Link from "next/link";

export default function NotFound() {
	return (
		<div style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 16 }}>
			<div>
				<h1 style={{ fontSize: 20, marginBottom: 8 }}>Page not found</h1>
				<Link href="/" style={{ color: "#2563eb" }}>
					Back to the overview
				</Link>
			</div>
		</div>
	);
}
