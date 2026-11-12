// Load KEY=value pairs from the repository's .env into process.env (without overriding).

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadDotEnv(path = resolve(import.meta.dirname, '../../.env')): void {
	if (!existsSync(path)) return;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
		if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
	}
}
