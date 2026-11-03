import type { Handle } from '@sveltejs/kit/hooks';
import { localeOfPath } from '#lib/i18n/locales.ts';

// Sets <html lang> and conservative security headers. The site sets no cookies
// and loads nothing from third parties (fonts and images are self-hosted).
export const handle: Handle = async ({ event, resolve }) => {
	const lang = localeOfPath(event.url.pathname);
	const response = await resolve(event, { transformPageChunk: ({ html }) => html.replace('%lang%', lang) });
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	return response;
};
