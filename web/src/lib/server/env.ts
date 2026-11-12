// Server-only settings. In production they come from the environment (on Hostinger:
// the Node.js app's environment variables); in local development, missing values are
// read from the repository's .env (git-ignored).

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fromDotEnv(): Record<string, string> {
	const path = resolve(process.cwd(), '../.env');
	if (!existsSync(path)) return {};
	return Object.fromEntries(
		readFileSync(path, 'utf8')
			.split('\n')
			.map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
			.filter((m): m is RegExpMatchArray => !!m)
			.map((m) => [m[1], m[2]])
	);
}

const dot = process.env.NODE_ENV === 'production' ? {} : fromDotEnv();
const get = (k: string) => process.env[k] ?? dot[k];

/** Drupal base URL, reachable from the SvelteKit server (the CMS site's address). */
export const DRUPAL_URL = (get('DRUPAL_URL') ?? 'http://achieve-cms.ddev.site:8580').replace(/\/$/, '');

/** Shared secret for Drupal's feedback endpoint (same value as achieve_feedback_secret in Drupal). */
export const DRUPAL_FEEDBACK_SECRET = get('DRUPAL_FEEDBACK_SECRET');

/** Seconds to cache public content in memory (0 disables the cache). */
export const CONTENT_CACHE_SECONDS = Number(get('CONTENT_CACHE_SECONDS') ?? 60);

/** While the site is a demo: a shared password (HTTP basic auth) and no search indexing. */
export const DEMO_USER = get('DEMO_USER') ?? 'achieve';
export const DEMO_PASSWORD = get('DEMO_PASSWORD');
