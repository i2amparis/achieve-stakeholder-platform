// Import data/achieve-cde-content.xlsx into Directus (idempotent).
//
//   npm run import                 import, export CSVs, print the report
//   npm run import -- --dry-run    show what would change, write nothing to Directus
//   npm run import -- --offline    no Directus: check the sheet, export CSVs, report flags
//   npm run import -- --file other.xlsx
//
// Needs DIRECTUS_IMPORT_TOKEN (created by `npm run setup`, stored in .env).
// The full report is written to scripts/import/reports/latest.md (git-ignored).

import { mkdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { Directus, loadDotEnv } from '../../directus/setup/lib/client.ts';
import { apply, type ApplyResult } from './apply.ts';
import { exportCsv } from './export.ts';
import { readWorkbook } from './read.ts';
import { renderReport } from './report.ts';
import { transform } from './transform.ts';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const fileArg = args.indexOf('--file');
const xlsx = resolve(root, fileArg >= 0 ? args[fileArg + 1] : 'data/achieve-cde-content.xlsx');
const dryRun = flag('--dry-run');
const offline = flag('--offline');

loadDotEnv();
const model = transform(await readWorkbook(xlsx));
const csvs = await exportCsv(xlsx, resolve(root, 'data/export'));

let result: ApplyResult | null = null;
if (!offline) {
	const token = process.env.DIRECTUS_IMPORT_TOKEN;
	if (!token) throw new Error('DIRECTUS_IMPORT_TOKEN is not set. Run `npm run setup` first (it writes the token to .env).');
	result = await apply(model, new Directus(token), { dryRun });
}

const mode = offline ? 'offline check' : dryRun ? 'dry run (nothing written to Directus)' : 'import';
const report = renderReport(model, result, { mode, source: relative(root, xlsx), csvs: csvs.map((c) => relative(root, c)) });
mkdirSync(resolve(root, 'scripts/import/reports'), { recursive: true });
writeFileSync(resolve(root, 'scripts/import/reports/latest.md'), report.full);
console.log(report.summary);
console.log(`\nFull report: scripts/import/reports/latest.md`);
