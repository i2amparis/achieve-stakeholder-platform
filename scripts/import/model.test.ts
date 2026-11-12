import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toModelFile } from './model.ts';
import { readWorkbook } from './read.ts';
import { transform } from './transform.ts';

describe('model file for Drupal', async () => {
	const model = transform(await readWorkbook(resolve(import.meta.dirname, '../../data/achieve-cde-content.xlsx')));
	const src = { source: 'data/achieve-cde-content.xlsx', sha256: 'abc' };

	it('is deterministic, so content changes show as readable diffs', async () => {
		const again = transform(await readWorkbook(resolve(import.meta.dirname, '../../data/achieve-cde-content.xlsx')));
		expect(toModelFile(again, src)).toBe(toModelFile(model, src));
	});

	it('holds what Drupal imports, and nothing editorial', () => {
		const file = JSON.parse(toModelFile(model, src));
		expect(file.version).toBe(1);
		expect(file.outputs).toHaveLength(34);
		expect(Object.keys(file)).toEqual(['version', 'source', 'sha256', 'taxonomies', 'webinars', 'visuals', 'outputs']);
		expect(JSON.stringify(file)).not.toMatch(/Draft basis|"flags"/);
	});
});
