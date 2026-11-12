// Feedback and sign-up forms: validation and the payload sent to Directus.
// Pure functions, shared by every page with a prompt. GDPR rules (CLAUDE.md):
// anonymous by default; an email only with its own, unticked-by-default consent.

export const STREAMS = ['comment', 'suggest_research', 'share_challenge'] as const;
export type Stream = (typeof STREAMS)[number];

export const USEFULNESS = ['very_useful', 'somewhat', 'not_really'] as const;

/** "You work in" options: value → label. */
export const ACTOR_TYPES: [string, string][] = [
	['business', 'Industry or business'],
	['cities', 'City or local government'],
	['regulators', 'Regulation or policy'],
	['carbon-markets', 'Carbon markets'],
	['ccis', 'A cooperative climate initiative'],
	['research-civil-society', 'Research or civil society']
];
export const REGIONS: [string, string][] = [
	['europe', 'Europe'],
	['latin-america', 'Latin America'],
	['elsewhere', 'Elsewhere']
];

/** Versions of the consent wording, stored with each consent. Change when the wording changes. */
export const CONSENT_VERSIONS = { followup: 'followup-2026-11', community: 'community-2026-11' };

export const MAX_MESSAGE = 5000;

/** Page context, set by the server for the page the form sits on, never taken from the form. */
export interface FeedbackContext {
	prompt?: number | null;
	page_path: string;
	context_output?: number | null;
	context_actor?: number | null;
	context_principle?: number | null;
	context_dimension?: number | null;
	context_roadmap?: number | null;
	context_recommendation?: number | null;
	context_filters?: Record<string, unknown> | null;
}

export interface FeedbackPayload extends FeedbackContext {
	stream: Stream;
	message: string | null;
	usefulness: string | null;
	respondent_actor_type: string | null;
	respondent_region: string | null;
	respondent_country: string | null;
	followup_email: string | null;
	followup_consent_at: string | null;
	consent_text_version: string | null;
	followup_requested: boolean;
}

export type Parsed<T> =
	| { ok: true; payload: T; spam: boolean }
	| { ok: false; errors: Record<string, string>; values: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const text = (form: FormData, name: string, max = 500) => {
	const v = form.get(name);
	return typeof v === 'string' ? v.trim().slice(0, max) : '';
};
const oneOf = (v: string, allowed: readonly string[]) => (allowed.includes(v) ? v : null);

/**
 * Validate a feedback form. `stream` is fixed by the page's prompt, or taken from
 * the form when the page lets the visitor choose (/have-your-say).
 */
export function parseFeedback(form: FormData, ctx: FeedbackContext, opts: { stream?: Stream; now?: Date } = {}): Parsed<FeedbackPayload> {
	const values: Record<string, string> = {};
	for (const k of ['stream', 'message', 'usefulness', 'actor_type', 'region', 'country', 'email', 'followup']) values[k] = text(form, k, k === 'message' ? MAX_MESSAGE + 1 : 500);
	const errors: Record<string, string> = {};

	const stream = opts.stream ?? (oneOf(values.stream, STREAMS) as Stream | null);
	if (!stream) errors.stream = 'Choose what you would like to do.';

	const message = values.message || null;
	if (message && message.length > MAX_MESSAGE) errors.message = `Please keep your answer under ${MAX_MESSAGE} characters.`;
	const usefulness = oneOf(values.usefulness, USEFULNESS);
	if (!message && !usefulness) errors.message = 'Please write your answer.';

	const wantsFollowup = values.followup === 'yes';
	const email = values.email || null;
	if (wantsFollowup && (!email || !EMAIL_RE.test(email))) errors.email = 'Enter an email address, for example name@example.org, or untick the box.';

	if (Object.keys(errors).length) return { ok: false, errors, values };

	const now = (opts.now ?? new Date()).toISOString();
	return {
		ok: true,
		spam: text(form, 'website') !== '',
		payload: {
			...ctx,
			stream: stream!,
			message,
			usefulness,
			respondent_actor_type: oneOf(values.actor_type, ACTOR_TYPES.map(([v]) => v)),
			respondent_region: oneOf(values.region, REGIONS.map(([v]) => v)),
			respondent_country: values.country ? values.country.slice(0, 100) : null,
			// without the consent box, an email typed into the field is discarded
			followup_email: wantsFollowup ? email : null,
			followup_consent_at: wantsFollowup ? now : null,
			consent_text_version: wantsFollowup ? CONSENT_VERSIONS.followup : null,
			followup_requested: wantsFollowup
		}
	};
}

export interface SignupPayload {
	email: string;
	consent_at: string;
	consent_text_version: string;
	locale: string;
}

export function parseSignup(form: FormData, locale: string, now = new Date()): Parsed<SignupPayload> {
	const values = { email: text(form, 'email') };
	const errors: Record<string, string> = {};
	if (!EMAIL_RE.test(values.email)) errors.email = 'Enter an email address, for example name@example.org.';
	if (form.get('consent') !== 'yes') errors.consent = 'Tick the box to agree, so we can store your email.';
	if (Object.keys(errors).length) return { ok: false, errors, values };
	return {
		ok: true,
		spam: text(form, 'website') !== '',
		payload: { email: values.email, consent_at: now.toISOString(), consent_text_version: CONSENT_VERSIONS.community, locale }
	};
}
