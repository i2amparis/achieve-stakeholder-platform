import { describe, expect, it } from 'vitest';
import {
	blank, codeSlug, isoDate, matchKey, parseActorMessages, parseAltText, parsePid, partnerCode, publicationSlug, rowRefs, splitCodeTitle,
	splitContributors, splitMulti, toHtml, yesNo
} from './parse.ts';

describe('multi-value cells', () => {
	it('split on "; " and keep the order', () => {
		expect(splitMulti('Carbon markets; Business; Cities; CCIs')).toEqual(['Carbon markets', 'Business', 'Cities', 'CCIs']);
	});
	it('tolerate missing spaces, trailing separators and placeholders', () => {
		expect(splitMulti('P1;P3; ')).toEqual(['P1', 'P3']);
		expect(splitMulti('-')).toEqual([]);
		expect(splitMulti(null)).toEqual([]);
	});
	it('treat "-", "Not applicable" and empty as blank', () => {
		for (const v of ['', ' ', '-', 'Not applicable', 'N/A', null]) expect(blank(v), String(v)).toBe(true);
		expect(blank('No')).toBe(false);
	});
});

describe('deliverable titles', () => {
	it('split the code from the title', () => {
		expect(splitCodeTitle('D2.2 - Integrity of carbon credits')).toEqual({ code: 'D2.2', title: 'Integrity of carbon credits', kind: 'deliverable' });
		expect(splitCodeTitle('MS9 - Visualise results of transition pathways analysis')).toMatchObject({ code: 'MS9', kind: 'milestone' });
	});
	it('keep a dash inside the title', () => {
		expect(splitCodeTitle('D3.7 - Interim report on expert survey / outline')?.title).toBe('Interim report on expert survey / outline');
	});
	it('return null without a code', () => {
		expect(splitCodeTitle('Integrity of carbon credits')).toBeNull();
	});
});

describe('partner codes', () => {
	it('keep only the acronym', () => {
		expect(partnerCode('WWF+3:20')).toEqual({ code: 'WWF', changed: true });
		expect(partnerCode('RU (Sander, Sebastian)')).toEqual({ code: 'RU', changed: true });
		expect(partnerCode('OEKO')).toEqual({ code: 'OEKO', changed: false });
		expect(partnerCode('Lead ')).toEqual({ code: 'LEAD', changed: true });
	});
	it('split contributors on commas', () => {
		expect(splitContributors('NCI, OEKO')).toEqual(['NCI', 'OEKO']);
		expect(splitContributors('CATIE')).toEqual(['CATIE']);
		expect(splitContributors(null)).toEqual([]);
	});
});

describe('PIDs', () => {
	it('normalise bare DOIs to doi.org links', () => {
		expect(parsePid('10.5281/zenodo.17762777', 'DOI')).toMatchObject({ link: 'https://doi.org/10.5281/zenodo.17762777', pid_type: 'doi' });
	});
	it('recognise doi.org links as DOIs', () => {
		expect(parsePid('https://doi.org/10.1038/s44168-024-00106-4', 'DOI')).toEqual({ link: 'https://doi.org/10.1038/s44168-024-00106-4', pid_type: 'doi' });
	});
	it('flag a declared DOI that is not one', () => {
		expect(parsePid('https://zenodo.org/records/17582801', 'DOI')?.note).toMatch(/says DOI/);
	});
	it('trim stray whitespace', () => {
		expect(parsePid('https://example.org/a ', 'URL')).toEqual({ link: 'https://example.org/a', pid_type: 'url' });
	});
});

describe('key messages', () => {
	const labels = ['Business', 'Cities', 'Regulators', 'Carbon markets', 'CCIs'];
	it('split "Actor: message" lines in order, keeping colons inside the message', () => {
		const r = parseActorMessages('Carbon markets: 89% of reductions: very high risk.\nCities: 24% of cities.', labels);
		expect(r.entries).toEqual([
			{ actor: 'Carbon markets', message: '89% of reductions: very high risk.' },
			{ actor: 'Cities', message: '24% of cities.' }
		]);
	});
	it('return lines that are not "Actor: message"', () => {
		expect(parseActorMessages('See row 15 (same paper; proposed to merge).', labels).unparsed).toHaveLength(1);
	});
});

describe('alt text', () => {
	it('split "file: text" entries, even when the text has colons', () => {
		const v = 'a.pdf: Infographic: four principles.\n\nb.png: Diagram of the framework.';
		const { alt } = parseAltText(v, ['a.pdf', 'b.png']);
		expect(alt.get('a.pdf')).toBe('Infographic: four principles.');
		expect(alt.get('b.png')).toBe('Diagram of the framework.');
	});
	it('report text that matches no file', () => {
		expect(parseAltText('x.pdf: text', ['a.pdf']).unmatched).toHaveLength(1);
	});
});

describe('slugs', () => {
	it('use the code for deliverables', () => {
		expect(codeSlug('D2.2')).toBe('d2-2');
		expect(codeSlug('MS9')).toBe('ms9');
	});
	it('shorten publication titles', () => {
		expect(publicationSlug('Net zero or zero sense: three reasons to rethink')).toBe('net-zero-or-zero-sense');
		expect(publicationSlug('Bridging Levels: Advancing Climate Action Through Multilevel Governance')).toBe('bridging-levels');
		expect(publicationSlug('Fixing the broken governance chain- Aligning Private Finance with the Paris Agreement')).toBe('fixing-the-broken-governance-chain');
		expect(publicationSlug('The EU\'s 2040 climate target: Assessment')).toBe('eus-2040-climate-target');
	});
	it('stay within 6 words and 50 characters, without a trailing stop word', () => {
		const s = publicationSlug('Conditions for Using International Carbon Credits towards the EU’s 2040 Climate Target');
		expect(s.split('-').length).toBeLessThanOrEqual(6);
		expect(s.length).toBeLessThanOrEqual(50);
		expect(s).not.toMatch(/-(of|for|the|and|to)$/);
	});
});

describe('other cells', () => {
	it('match titles regardless of quotes, case and spacing', () => {
		expect(matchKey('Conditions for Using International Carbon Credits towards the EU’s 2040 Climate Target'))
			.toBe(matchKey("conditions for using international carbon credits towards the EU's  2040 climate target"));
	});
	it('turn text into paragraphs, joining PDF line wraps', () => {
		expect(toHtml('First line\nwraps here.\n\nSecond <para> & more.')).toBe('<p>First line wraps here.</p>\n<p>Second &lt;para&gt; &amp; more.</p>');
	});
	it('read yes/no and dates', () => {
		expect([yesNo('Yes'), yesNo(' no '), yesNo('Not applicable'), yesNo('maybe')]).toEqual([true, false, null, null]);
		expect(isoDate(new Date(Date.UTC(2025, 11, 1)))).toBe('2025-12-01');
	});
	it('find row references in "Platform relation" notes', () => {
		expect(rowRefs('Main platform item. Second format: row 18 (policy brief).')).toEqual([18]);
	});
});
