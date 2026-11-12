import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A fake Drupal: each call takes the next scripted answer (a status, or 'down' for a network error).
function fakeDrupal(script: (number | 'down')[]) {
	const calls: string[] = [];
	vi.stubGlobal('fetch', async (url: string) => {
		calls.push(url);
		const next = script.shift() ?? 200;
		if (next === 'down') throw new TypeError('fetch failed');
		return new Response(next === 200 ? JSON.stringify({ data: [{ id: `n${calls.length}`, type: 'node--output', attributes: {} }] }) : 'busy', { status: next });
	});
	return calls;
}

async function load() {
	vi.resetModules(); // a fresh content cache per test
	return import('./drupal.ts');
}

describe('Drupal reads', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('retries a busy Drupal once', async () => {
		const calls = fakeDrupal([503, 200]);
		const { read } = await load();
		expect((await read('/node/output')).data).toHaveLength(1);
		expect(calls).toHaveLength(2);
	});

	it('retries a network error once', async () => {
		const calls = fakeDrupal(['down', 200]);
		const { read } = await load();
		expect((await read('/node/output')).data).toHaveLength(1);
		expect(calls).toHaveLength(2);
	});

	it('gives up after the retry with a 503', async () => {
		fakeDrupal([502, 502]);
		const { read } = await load();
		await expect(read('/node/output')).rejects.toMatchObject({ status: 503 });
	});

	it('does not retry a 404', async () => {
		const calls = fakeDrupal([404]);
		const { read } = await load();
		await expect(read('/node/output')).rejects.toMatchObject({ status: 404 });
		expect(calls).toHaveLength(1);
	});

	it('serves the expired copy when Drupal is down', async () => {
		fakeDrupal([200, 'down', 'down']);
		const { read } = await load();
		const first = await read('/node/output');
		vi.setSystemTime(Date.now() + 3_600_000); // cache expired
		expect(await read('/node/output')).toBe(first);
	});
});
