// Form actions for feedback and sign-ups, shared by every page with a prompt.

import { createHash } from 'node:crypto';
import { fail, type RequestEvent } from '@sveltejs/kit';
import { parseFeedback, parseSignup, type FeedbackContext, type Stream } from '#lib/feedback/form.ts';
import { write } from './drupal.ts';

// Light abuse protection: at most 10 submissions per address per 10 minutes.
// The address is hashed, kept in memory only, and never stored or logged.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;
const hits = new Map<string, number[]>();

function tooMany(event: RequestEvent): boolean {
	let ip = 'unknown';
	try {
		ip = event.getClientAddress();
	} catch {
		/* not available in some environments */
	}
	const key = createHash('sha256').update(ip).digest('hex').slice(0, 16);
	const now = Date.now();
	const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
	recent.push(now);
	hits.set(key, recent);
	if (hits.size > 10_000) hits.clear();
	return recent.length > LIMIT;
}

/** Handle a feedback form. `form` names the prompt on the page, so its result shows in the right place. */
export async function feedbackAction(event: RequestEvent, form: string, ctx: FeedbackContext, stream?: Stream) {
	const data = await event.request.formData();
	if (tooMany(event)) return fail(429, { form, errors: { form: 'You have sent several answers in a short time. Please try again in a few minutes.' }, values: {} });
	const parsed = parseFeedback(data, ctx, { stream });
	if (!parsed.ok) return fail(400, { form, errors: parsed.errors, values: parsed.values });
	if (!parsed.spam && !(await write('feedback', parsed.payload))) {
		return fail(503, { form, errors: { form: 'Your answer could not be saved just now. Please try again later.' }, values: Object.fromEntries([...data].map(([k, v]) => [k, String(v)])) });
	}
	return { form, sent: true };
}

export async function signupAction(event: RequestEvent, locale: string) {
	const data = await event.request.formData();
	if (tooMany(event)) return fail(429, { form: 'join', errors: { form: 'Please try again in a few minutes.' }, values: {} });
	const parsed = parseSignup(data, locale);
	if (!parsed.ok) return fail(400, { form: 'join', errors: parsed.errors, values: parsed.values });
	if (!parsed.spam && !(await write('signup', parsed.payload))) {
		return fail(503, { form: 'join', errors: { form: 'Your sign-up could not be saved just now. Please try again later.' }, values: parsed.ok ? {} : {} });
	}
	return { form: 'join', sent: true };
}
