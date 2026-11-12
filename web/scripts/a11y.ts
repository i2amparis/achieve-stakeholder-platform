// Browser checks for the demo pages (WCAG 2.1 AA with axe-core, console errors,
// keyboard use of the filters), at the desktop and mobile widths of the design.
//
//   npm run build && node build &      (or npm run dev)
//   BASE_URL=http://localhost:4173 npm run test:a11y
//   BASE_URL=https://<demo> DEMO_PASSWORD=… npm run test:a11y      (deployed demo)
//
// Screenshots go to SCREENSHOT_DIR when set.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, type Page } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
// For a password-protected demo: DEMO_USER / DEMO_PASSWORD (HTTP basic auth).
const httpCredentials = process.env.DEMO_PASSWORD ? { username: process.env.DEMO_USER ?? 'achieve', password: process.env.DEMO_PASSWORD } : undefined;
const SHOTS = process.env.SCREENSHOT_DIR;
const PAGES = ['/', '/actors/cities', '/library', '/library?actor=cities&principle=p2', '/library/d2-2', '/library/d3-6', '/have-your-say', '/have-your-say/thank-you?sent=1', '/principles'];
const WIDTHS = { desktop: 1440, mobile: 390 };

let failures = 0;
const fail = (msg: string) => {
	failures++;
	console.log(`  ✗ ${msg}`);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const browser = await chromium.launch();
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

for (const [label, width] of Object.entries(WIDTHS)) {
	const context = await browser.newContext({ viewport: { width, height: 900 }, httpCredentials });
	for (const path of PAGES) {
		const page = await context.newPage();
		const errors: string[] = [];
		page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
		page.on('pageerror', (e) => errors.push(e.message));
		const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
		console.log(`${label} ${path} (${res?.status()})`);
		const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
		if (axe.violations.length) for (const v of axe.violations) fail(`axe ${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`);
		else ok(`axe: no WCAG 2.1 A/AA violations (${axe.passes.length} rules passed)`);
		const real = errors.filter((e) => !/404|Failed to load resource/.test(e) || path !== '/principles');
		if (real.length) fail(`console: ${real.slice(0, 3).join(' | ')}`);
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		if (overflow > 1) fail(`horizontal scroll: page is ${overflow}px wider than the viewport`);
		if (SHOTS) await page.screenshot({ path: join(SHOTS, `${label}${path.replace(/[/?&=]+/g, '_') || '_home'}.png`), fullPage: true });
		await page.close();
	}
	await context.close();
}

// Keyboard: hub principle chips update the list in place, keep focus, announce the count.
async function keyboardHub(page: Page) {
	await page.goto(BASE + '/actors/cities', { waitUntil: 'networkidle' });
	const chip = page.locator('nav[aria-label="Filter by integrity principle"] a', { hasText: 'P2' });
	await chip.focus();
	await page.keyboard.press('Enter');
	await page.waitForURL(/principle=p2/);
	await page.waitForTimeout(300);
	const live = await page.locator('#outputs [aria-live="polite"]').innerText();
	const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
	const current = await page.locator('nav[aria-label="Filter by integrity principle"] a[aria-current="true"]').innerText();
	live.includes('P2') ? ok(`hub chip: live region says "${live}"`) : fail(`hub chip: live region not updated ("${live}")`);
	focused.includes('P2') ? ok('hub chip: focus stays on the chip') : fail(`hub chip: focus moved to "${focused}"`);
	current.includes('P2') ? ok('hub chip: selected chip marked aria-current') : fail('hub chip: selection not marked');
	const dims = await page.locator('nav[aria-label="Filter by dimension"] a').count();
	dims > 0 ? ok(`hub chip: ${dims} dimension chips revealed`) : fail('hub chip: no dimension chips');
}

// Keyboard: library checkboxes apply at once, keep focus and give a shareable URL.
async function keyboardLibrary(page: Page) {
	await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
	const box = page.getByRole('checkbox', { name: /^Cities/ });
	await box.focus();
	await page.keyboard.press('Space');
	await page.waitForURL(/actor=cities/);
	await page.waitForTimeout(300);
	const focusedName = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.value ?? '');
	const live = await page.locator('[aria-live="polite"]').first().innerText();
	focusedName === 'cities' ? ok('library: focus stays on the checkbox') : fail(`library: focus on "${focusedName}"`);
	/of 34/.test(live) ? ok(`library: live region says "${live}"`) : fail(`library: live region "${live}"`);
	ok(`library: shareable URL ${new URL(page.url()).search}`);
}

const kb = await browser.newPage({ viewport: { width: 1440, height: 900 }, httpCredentials });
console.log('keyboard');
await keyboardHub(kb);
await keyboardLibrary(kb);
await browser.close();

console.log(failures ? `\n${failures} problem(s) found` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
