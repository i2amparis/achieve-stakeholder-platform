// Directus access for the SvelteKit server.
// Reads use no token: the site sees exactly what the public role allows (published
// content only). Writes use the write-only "Website service" token, from the server
// only, so visitors' IP addresses never reach Directus.

import { error } from '@sveltejs/kit';
import { CONTENT_CACHE_SECONDS, DIRECTUS_FEEDBACK_TOKEN, DIRECTUS_URL } from './env.ts';

const cache = new Map<string, { at: number; value: unknown }>();

/** Build a query string, JSON-encoding object values (filter, deep…). */
export function qs(params: Record<string, unknown>): string {
	const s = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== undefined) s.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
	return `?${s}`;
}

/** Public read from /items, cached briefly in memory. */
export async function read<T>(path: string): Promise<T> {
	const hit = cache.get(path);
	if (hit && Date.now() - hit.at < CONTENT_CACHE_SECONDS * 1000) return hit.value as T;
	let res: Response;
	try {
		res = await fetch(`${DIRECTUS_URL}${path}`);
	} catch {
		error(503, 'The content service is not reachable right now. Please try again in a few minutes.');
	}
	if (!res.ok) error(res.status === 403 ? 404 : 503, 'Content could not be loaded.');
	const value = ((await res.json()) as { data: T }).data;
	cache.set(path, { at: Date.now(), value });
	return value;
}

/** Store an item with the write-only website token. Returns false if Directus refused it. */
export async function write(collection: 'feedback_responses' | 'community_signups', payload: object): Promise<boolean> {
	if (!DIRECTUS_FEEDBACK_TOKEN) throw new Error('DIRECTUS_FEEDBACK_TOKEN is not set');
	const res = await fetch(`${DIRECTUS_URL}/items/${collection}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DIRECTUS_FEEDBACK_TOKEN}` },
		body: JSON.stringify(payload)
	}).catch(() => null);
	if (!res?.ok) {
		// Log the reason, never the submitted content (it may hold personal data).
		console.error(`feedback: Directus refused ${collection} (${res?.status ?? 'no response'})`);
		return false;
	}
	return true;
}
