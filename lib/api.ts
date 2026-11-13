/**
 * Thin JSON client for owner-admin-api. Requests go to /api/* on this origin,
 * which Next.js proxies to the API (see next.config.mjs), so the httpOnly
 * session cookie is first-party and never readable from JavaScript.
 */

export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`, {
			method,
			credentials: "same-origin",
			headers: body !== undefined ? { "content-type": "application/json" } : undefined,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			cache: "no-store",
		});
	} catch {
		throw new ApiError(0, "network", "Can't reach the server. Check your connection and try again.");
	}
	const text = await res.text();
	let data: unknown = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		// A proxy error page or similar — not our JSON.
		throw new ApiError(res.status, "bad_response", res.status >= 500 ? "The server isn't responding. Is owner-admin-api running?" : `Unexpected response (${res.status}).`);
	}
	if (!res.ok) {
		const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
		throw new ApiError(res.status, err?.code ?? "error", err?.message ?? `Request failed (${res.status}).`);
	}
	return data as T;
}
