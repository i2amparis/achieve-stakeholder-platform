import { describe, expect, it } from 'vitest';
import { CONSENT_VERSIONS, parseFeedback, parseSignup } from './form.ts';

const fd = (o: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
};
const ctx = { page_path: '/library/d2-2', context_output: 5, prompt: 1 };
const now = new Date('2026-11-03T10:00:00Z');

describe('feedback form', () => {
	it('is anonymous by default and keeps the page context', () => {
		const r = parseFeedback(fd({ message: '  Lorem ipsum.  ' }), ctx, { stream: 'comment', now });
		expect(r.ok && r.payload).toMatchObject({ stream: 'comment', message: 'Lorem ipsum.', context_output: 5, page_path: '/library/d2-2', followup_email: null, followup_requested: false });
	});

	it('accepts a usefulness rating on its own', () => {
		const r = parseFeedback(fd({ usefulness: 'somewhat' }), ctx, { stream: 'comment', now });
		expect(r.ok && r.payload).toMatchObject({ usefulness: 'somewhat', message: null });
	});

	it('rejects an empty answer, with a message for the visitor', () => {
		const r = parseFeedback(fd({ message: '   ' }), ctx, { stream: 'comment', now });
		expect(r.ok).toBe(false);
		expect(!r.ok && r.errors.message).toMatch(/write your answer/);
	});

	it('stores an email only with the consent box ticked, with the time and wording version', () => {
		const without = parseFeedback(fd({ message: 'Lorem', email: 'a@example.org' }), ctx, { stream: 'comment', now });
		expect(without.ok && without.payload).toMatchObject({ followup_email: null, followup_consent_at: null, followup_requested: false });
		const withConsent = parseFeedback(fd({ message: 'Lorem', followup: 'yes', email: 'a@example.org' }), ctx, { stream: 'comment', now });
		expect(withConsent.ok && withConsent.payload).toMatchObject({
			followup_email: 'a@example.org', followup_consent_at: '2026-11-03T10:00:00.000Z', consent_text_version: CONSENT_VERSIONS.followup, followup_requested: true
		});
	});

	it('asks for a valid email when follow-up is ticked', () => {
		const r = parseFeedback(fd({ message: 'Lorem', followup: 'yes', email: 'not-an-email' }), ctx, { stream: 'comment', now });
		expect(!r.ok && r.errors.email).toBeTruthy();
	});

	it('takes the stream from the form only where the visitor chooses it', () => {
		expect(parseFeedback(fd({ message: 'x', stream: 'share_challenge' }), ctx).ok).toBe(true);
		const bad = parseFeedback(fd({ message: 'x', stream: 'other' }), ctx);
		expect(!bad.ok && bad.errors.stream).toBeTruthy();
		const fixed = parseFeedback(fd({ message: 'x', stream: 'share_challenge' }), ctx, { stream: 'comment' });
		expect(fixed.ok && fixed.payload.stream).toBe('comment');
	});

	it('drops unknown option values instead of storing them', () => {
		const r = parseFeedback(fd({ message: 'x', actor_type: 'astronaut', region: 'europe', usefulness: 'brilliant' }), ctx, { stream: 'comment' });
		expect(r.ok && r.payload).toMatchObject({ respondent_actor_type: null, respondent_region: 'europe', usefulness: null });
	});

	it('marks honeypot submissions as spam', () => {
		const r = parseFeedback(fd({ message: 'x', website: 'http://spam' }), ctx, { stream: 'comment' });
		expect(r.ok && r.spam).toBe(true);
	});

	it('never takes context from the form', () => {
		const r = parseFeedback(fd({ message: 'x', context_output: '999', page_path: '/elsewhere' }), ctx, { stream: 'comment' });
		expect(r.ok && r.payload).toMatchObject({ context_output: 5, page_path: '/library/d2-2' });
	});
});

describe('community sign-up', () => {
	it('needs an email and the consent box', () => {
		const r = parseSignup(fd({ email: 'a@example.org' }), 'en', now);
		expect(!r.ok && r.errors.consent).toBeTruthy();
		const ok = parseSignup(fd({ email: 'a@example.org', consent: 'yes' }), 'en', now);
		expect(ok.ok && ok.payload).toEqual({ email: 'a@example.org', consent_at: '2026-11-03T10:00:00.000Z', consent_text_version: CONSENT_VERSIONS.community, locale: 'en' });
	});
});
