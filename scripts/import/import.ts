// Turn data/achieve-cde-content.xlsx into the import model for Drupal.
//
//   npm run import                    check the sheet, export CSVs, write drupal/import/model.json
//   npm run import -- --file other.xlsx
//
// Then load it into Drupal (idempotent):
//   cd drupal && ddev drush achieve:import          locally
//   vendor/bin/drush achieve:import                 on the server (model.json is committed:
//                                                   the server has no Node.js)
// The report is written to scripts/import/reports/latest.md (git-ignored).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { exportCsv } from './export.ts';
import { toModelFile } from './model.ts';
import { readWorkbook } from './read.ts';
import { renderReport } from './report.ts';
import { transform } from './transform.ts';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const fileArg = args.indexOf('--file');
const xlsx = resolve(root, fileArg >= 0 ? args[fileArg + 1] : 'data/achieve-cde-content.xlsx');
const modelPath = resolve(root, 'drupal/import/model.json');

const model = transform(await readWorkbook(xlsx));
const csvs = await exportCsv(xlsx, resolve(root, 'data/export'));
const sha256 = createHash('sha256').update(readFileSync(xlsx)).digest('hex');
mkdirSync(resolve(root, 'drupal/import'), { recursive: true });
writeFileSync(modelPath, toModelFile(model, { source: relative(root, xlsx), sha256 }));

const report = renderReport(model, { mode: 'sheet check and model export', source: relative(root, xlsx), csvs: [...csvs, modelPath].map((c) => relative(root, c)) });
mkdirSync(resolve(root, 'scripts/import/reports'), { recursive: true });
writeFileSync(resolve(root, 'scripts/import/reports/latest.md'), report.full);
console.log(report.summary);
console.log(`\nFull report: scripts/import/reports/latest.md`);
console.log(`Load into Drupal: cd drupal && ddev drush achieve:import`);
