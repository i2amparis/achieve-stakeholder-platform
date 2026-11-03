import { describe, expect, it } from 'vitest';
import { cardMeta, firstPercentage, leadFigure, listJoin, monthYear } from './format.ts';
import { href, localeFromParam, localeOfPath } from './i18n/locales.ts';

describe('format', () => {
	it('shows month-precise dates', () => {
		expect(monthYear('2025-12-01')).toBe('Dec 2025');
		expect(monthYear('2025-12-01', true)).toBe('December 2025');
		expect(monthYear(null)).toBe('');
	});
	it('builds card meta lines', () => {
		expect(cardMeta({ code: 'D2.2', typeName: 'Report', date: '2025-12-01' })).toBe('D2.2 · Report · Dec 2025');
		expect(cardMeta({ code: null, typeName: 'Policy Brief', date: '2026-01-01' })).toBe('Policy Brief · Jan 2026');
	});
	it('finds the leading figure of a key message', () => {
		expect(leadFigure('89% of estimated annual reductions…')).toBe('89%');
		expect(leadFigure('14% of companies used carbon credits')).toBe('14%');
		expect(leadFigure('Of 43 integrity initiatives mapped')).toBeNull();
		expect(leadFigure('Integrity standards still vary')).toBeNull();
	});
	it('finds the first percentage in a teaser', () => {
		expect(firstPercentage('At least 1,935 entities now have net zero targets, but only 7% of companies…')).toBe('7%');
	});
	it('joins lists', () => {
		expect(listJoin(['Business', 'Cities', 'CCIs'])).toBe('Business, Cities and CCIs');
	});
});

describe('locales', () => {
	it('serves English at the root and refuses locales that are not enabled', () => {
		expect(localeFromParam(undefined)).toBe('en');
		expect(localeFromParam('en')).toBeNull(); // no duplicate /en/… URLs
		expect(localeFromParam('es')).toBeNull(); // not enabled yet
		expect(localeFromParam('library')).toBeNull();
	});
	it('builds localised paths', () => {
		expect(href('/library')).toBe('/library');
		expect(href('/library', 'es')).toBe('/es/library');
		expect(href('/', 'pt')).toBe('/pt');
		expect(localeOfPath('/es/library')).toBe('en'); // es not enabled
	});
});
