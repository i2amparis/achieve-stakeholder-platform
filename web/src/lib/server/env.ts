// Server-only settings. In production they come from the environment; in local
// development, missing values are read from the repository's .env (git-ignored).

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

/** Directus base URL, reachable from the SvelteKit server. */
export const DIRECTUS_URL = (get('DIRECTUS_URL') ?? 'http://localhost:8055').replace(/\/$/, '');

/** Write-only token of the "Website service" account (feedback and sign-ups). */
export const DIRECTUS_FEEDBACK_TOKEN = get('DIRECTUS_FEEDBACK_TOKEN');

/** Seconds to cache public content in memory (0 disables the cache). */
export const CONTENT_CACHE_SECONDS = Number(get('CONTENT_CACHE_SECONDS') ?? 60);
