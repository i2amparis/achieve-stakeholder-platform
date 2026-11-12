// Drupal access for the SvelteKit server.
// Reads use the public JSON:API without credentials: the site sees exactly what anonymous
// visitors may see (published content, no internal fields). Writes go to the feedback
// endpoint with the shared secret, from the server only, so visitors' IP addresses never
// reach Drupal.

import { error } from '@sveltejs/kit';
import { CONTENT_CACHE_SECONDS, DRUPAL_FEEDBACK_SECRET, DRUPAL_URL } from './env.ts';

export interface Resource {
	type: string;
	id: string;
	attributes: Record<string, any>;
	relationships: Record<string, { data: { type: string; id: string; meta?: Record<string, any> } | { type: string; id: string }[] | null }>;
}
export interface Doc {
	data: Resource[];
	included: Resource[];
}

const cache = new Map<string, { at: number; value: Doc }>();

async function get(url: string): Promise<any> {
	let res: Response;
	try {
		res = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } });
	} catch {
		error(503, 'The content service is not reachable right now. Please try again in a few minutes.');
	}
	if (!res.ok) error(res.status === 403 || res.status === 404 ? 404 : 503, 'Content could not be loaded.');
	return res.json();
}

/**
 * Read a JSON:API collection, following "next" links, with its included resources.
 * `path` is relative to /jsonapi; `langPrefix` selects a translation ('' for English).
 */
export async function read(path: string, langPrefix = ''): Promise<Doc> {
	const first = `${DRUPAL_URL}${langPrefix}/jsonapi${path}`;
	const hit = cache.get(first);
	if (hit && Date.now() - hit.at < CONTENT_CACHE_SECONDS * 1000) return hit.value;
	const doc: Doc = { data: [], included: [] };
	let url: string | undefined = first;
	for (let page = 0; url && page < 50; page++) {
		const json: any = await get(url);
		doc.data.push(...(Array.isArray(json.data) ? json.data : json.data ? [json.data] : []));
		doc.included.push(...(json.included ?? []));
		url = json.links?.next?.href;
	}
	cache.set(first, { at: Date.now(), value: doc });
	return doc;
}

/** Build a JSON:API query string. */
export function q(params: Record<string, string | number | undefined>): string {
	const s = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v !== undefined) s.set(k, String(v));
	return `?${s}`;
}

/** Ids of a relationship, in order (an empty list when unset). */
export function relIds(r: Resource, field: string): string[] {
	const d = r.relationships[field]?.data;
	if (!d) return [];
	return (Array.isArray(d) ? d : [d]).filter((x) => x.id !== 'missing' && x.id !== 'virtual').map((x) => x.id);
}

/** Send a feedback response or sign-up to Drupal. Returns false if Drupal refused it. */
export async function write(kind: 'feedback' | 'signup', payload: object): Promise<boolean> {
	if (!DRUPAL_FEEDBACK_SECRET) throw new Error('DRUPAL_FEEDBACK_SECRET is not set');
	const res = await fetch(`${DRUPAL_URL}/api/achieve/${kind}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Achieve-Secret': DRUPAL_FEEDBACK_SECRET },
		body: JSON.stringify(payload)
	}).catch(() => null);
	if (!res?.ok) {
		// Log the reason, never the submitted content (it may hold personal data).
		console.error(`feedback: Drupal refused ${kind} (${res?.status ?? 'no response'})`);
		return false;
	}
	return true;
}
