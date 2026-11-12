import { timingSafeEqual } from 'node:crypto';
import type { Handle } from '@sveltejs/kit/hooks';
import { localeOfPath } from '#lib/i18n/locales.ts';
import { DEMO_PASSWORD, DEMO_USER } from '#lib/server/env.ts';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** While DEMO_PASSWORD is set, the whole site asks for the shared demo password. */
function demoAuthorised(header: string | null): boolean {
	if (!DEMO_PASSWORD) return true;
	if (!header?.startsWith('Basic ')) return false;
	const [user, ...rest] = Buffer.from(header.slice(6), 'base64').toString('utf8').split(':');
	return same(user, DEMO_USER) && same(rest.join(':'), DEMO_PASSWORD);
}

// Sets <html lang>, conservative security headers, and (for the demo) a shared password and
// noindex. The site sets no cookies and loads nothing from third parties.
export const handle: Handle = async ({ event, resolve }) => {
	if (!demoAuthorised(event.request.headers.get('authorization'))) {
		return new Response('This demo is password-protected.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="ACHIEVE demo", charset="UTF-8"', 'X-Robots-Tag': 'noindex, nofollow' } });
	}
	const lang = localeOfPath(event.url.pathname);
	const response = await resolve(event, { transformPageChunk: ({ html }) => html.replace('%lang%', lang) });
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	if (DEMO_PASSWORD) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	return response;
};
