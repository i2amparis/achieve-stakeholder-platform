// Minimal Directus REST client for setup scripts and integration tests.
// Reads DIRECTUS_URL (default http://localhost:8055) and either
// DIRECTUS_ADMIN_TOKEN or ADMIN_EMAIL + ADMIN_PASSWORD from the environment.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const DIRECTUS_URL = process.env.DIRECTUS_URL ?? 'http://localhost:8055';

/** Load KEY=value pairs from the repo's .env into process.env (without overriding). */
export function loadDotEnv(path = resolve(import.meta.dirname, '../../../.env')): void {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
	}
}

export class DirectusError extends Error {
	status: number;
	body: unknown;
	constructor(status: number, body: unknown, what: string) {
		super(`${what} → ${status} ${JSON.stringify(body)}`);
		this.status = status;
		this.body = body;
	}
}

export class Directus {
	url: string;
	token: string | undefined;

	constructor(token?: string, url = DIRECTUS_URL) {
		this.token = token;
		this.url = url;
	}

	/** Admin client from DIRECTUS_ADMIN_TOKEN, or by logging in with ADMIN_EMAIL/ADMIN_PASSWORD. */
	static async admin(): Promise<Directus> {
		loadDotEnv();
		if (process.env.DIRECTUS_ADMIN_TOKEN) return new Directus(process.env.DIRECTUS_ADMIN_TOKEN);
		const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
		if (!email || !password) throw new Error('Set DIRECTUS_ADMIN_TOKEN, or ADMIN_EMAIL and ADMIN_PASSWORD');
		const res = await new Directus().request<{ access_token: string }>('POST', '/auth/login', { email, password });
		return new Directus(res.access_token);
	}

	async request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
		const res = await fetch(this.url + path, {
			method,
			headers: {
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
				...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		if (res.status === 204) return undefined as T;
		const json: any = await res.json().catch(() => null);
		if (!res.ok) throw new DirectusError(res.status, json, `${method} ${path}`);
		return json?.data as T;
	}

	get<T = any>(path: string) {
		return this.request<T>('GET', path);
	}
	post<T = any>(path: string, body: unknown) {
		return this.request<T>('POST', path, body);
	}
	patch<T = any>(path: string, body: unknown) {
		return this.request<T>('PATCH', path, body);
	}
	delete(path: string, body?: unknown) {
		return this.request('DELETE', path, body);
	}
}

/** Build a query string, JSON-encoding object values (filter, deep…). */
export function qs(params: Record<string, unknown>): string {
	const s = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v === undefined) continue;
		s.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
	}
	return '?' + s.toString();
}
