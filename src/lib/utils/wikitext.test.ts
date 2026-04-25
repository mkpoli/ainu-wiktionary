import { describe, it, expect } from 'bun:test';
import {
	analyzeAinuLemma,
	highlightHeadwordSegments,
	renderWikitext,
	splitAinuSyllables,
	stripAccentAndWhitespace,
	type AinuEntry
} from './wikitext';

describe('renderWikitext', () => {
	const entry: AinuEntry = {
		lemma: 'test',
		pos: 'suffix',
		definitions: [
			{
				gloss: 'causative suffix',
				examples: [
					{ text: 'ek', translation: 'to come' },
					{ text: 'ekte', translation: 'to make come' }
				]
			}
		],
		etymology: [{ term: '-re', alt: '-TE', tran: 'causative', pos: 'suffix' }, { term: '-e' }],
		usage: 'Usage note here.',
		addSeparator: false
	};

	it('renders English style correctly', () => {
		const output = renderWikitext(entry, 'en');

		// Check for empty lines before headers (except the first one)
		expect(output).toContain('\n\n===Pronunciation===');
		expect(output).toContain('\n\n===Etymology===');
		expect(output).toContain('\n\n===Suffix===');
		expect(output).toContain('\n\n====Usage====');

		// No references section without refs
		expect(output).not.toContain('\n\n===References===');
		expect(output).not.toContain('{{reflist}}');

		// Check specific content
		expect(output).toContain('==Ainu==');
		expect(output).toContain('{{affix|ain|-re|-e|alt1=-TE|t1=causative|pos1=suffix}}');
		expect(output).toContain('{{head|ain|suffix}}');
		expect(output).toContain('# causative suffix');
	});

	it('renders Japanese style correctly', () => {
		const output = renderWikitext(entry, 'ja');

		// Check that we DO NOT have double newlines before headers (default behavior)
		expect(output).not.toContain('\n\n==={{pron}}===');
		expect(output).toContain('\n==={{pron}}===');

		expect(output).toContain('=={{L|ain}}==');
		expect(output).toContain('{{ain-kana}}');
		expect(output).toContain('==={{pron}}===');
		expect(output).toContain('==={{etym}}===');
		expect(output).toContain('==={{suffix}}===');
		expect(output).toContain('===={{usage}}====');

		// Check specific content
		expect(output).toContain('{{affix|ain|-re|-e|alt1=-TE|t1=causative|pos1=suffix}}');
		expect(output).toContain('{{head|ain|suffix}}');
		expect(output).toContain('# causative suffix');
	});
});

describe('renderWikitext Quotes', () => {
	const entry: AinuEntry = {
		lemma: 'test',
		pos: 'noun',
		definitions: [
			{
				gloss: 'test definition',
				examples: [
					{
						text: 'Simple example',
						translation: 'Simple translation',
						ref: 'Simple Ref'
					},
					{
						text: 'Quote example',
						translation: 'Quote translation',
						source: {
							author: 'Author Name',
							title: 'Book Title',
							book: 'Publisher Name',
							year: '2023',
							url: 'http://example.com'
						}
					}
				]
			}
		],
		addSeparator: false
	};

	it('renders Japanese quotes correctly', () => {
		const output = renderWikitext(entry, 'ja');

		// Simple example should use {{quote}} with simple ref
		expect(output).toContain('#* {{quote|ain|Simple example|Simple translation|ref=Simple Ref}}');

		// Quote example should use {{quote}} with citation ref
		const expectedRef =
			'|ref=<ref>{{citation|author=Author Name|title=Book Title|publisher=Publisher Name|year=2023|url=http://example.com}}</ref>';
		expect(output).toContain(`#* {{quote|ain|Quote example|Quote translation${expectedRef}}}`);
		expect(output).toContain('===出典===');
		expect(output).toContain('{{Reflist}}');
	});

	it('renders English quotes correctly', () => {
		const output = renderWikitext(entry, 'en');

		// Simple example should use {{ux}}
		expect(output).toContain('#: {{ux|ain|Simple example|Simple translation|ref=Simple Ref}}');

		// Quote example should use {{quote-book}}
		const expectedParams = [
			'ain',
			'year=2023',
			'author=Author Name',
			'title=Publisher Name',
			'chapter=Book Title',
			'url=http://example.com',
			'text=Quote example',
			't=Quote translation'
		].join('|');

		expect(output).toContain(`#* {{quote-book|${expectedParams}}}`);
		expect(output).toContain('\n\n===References===');
		expect(output).toContain('{{reflist}}');
	});

	it('renders raw bibliography references without forcing template fields', () => {
		const entryWithRawReference: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'Raw quote example',
							translation: 'Raw quote translation',
							source: {
								raw: 'Raw Source Label'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithRawReference, 'ja')).toContain(
			'#* {{quote|ain|Raw quote example|Raw quote translation|ref=Raw Source Label}}'
		);
		expect(renderWikitext(entryWithRawReference, 'en')).toContain(
			'#* {{quote|ain|Raw quote example|Raw quote translation|ref=Raw Source Label}}'
		);
	});

	it('allows custom template names and extra parameters for structured sources', () => {
		const entryWithCustomTemplates: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'Template example',
							translation: 'Template translation',
							source: {
								template: 'quote-journal',
								extraParams: 'page=12|editor=Editor Name',
								author: 'Author Name',
								title: 'Article Title',
								book: 'Journal Name',
								year: '2023',
								url: 'http://example.com'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithCustomTemplates, 'en')).toContain(
			'#* {{quote-journal|ain|year=2023|author=Author Name|title=Journal Name|chapter=Article Title|url=http://example.com|page=12|editor=Editor Name|text=Template example|t=Template translation}}'
		);
		expect(renderWikitext(entryWithCustomTemplates, 'ja')).toContain(
			'#* {{quote|ain|Template example|Template translation|ref=<ref>{{quote-journal|author=Author Name|title=Article Title|publisher=Journal Name|year=2023|url=http://example.com|page=12|editor=Editor Name}}</ref>}}'
		);
	});

	it('escapes equals signs in positional example parameters', () => {
		const entryWithEquals: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'a=b',
							translation: 'x=y',
							ref: 'Simple Ref'
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithEquals, 'en')).toContain(
			'#: {{ux|ain|a{{=}}b|x{{=}}y|ref=Simple Ref}}'
		);
		expect(renderWikitext(entryWithEquals, 'ja')).toContain(
			'#* {{quote|ain|a{{=}}b|x{{=}}y|ref=Simple Ref}}'
		);
	});

	it('renders transliteration in example templates', () => {
		const entryWithTransliteration: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'aynukar',
							translation: 'I see it',
							transliteration: 'aynu-kar',
							ref: 'Example Ref'
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithTransliteration, 'en')).toContain(
			'#: {{ux|ain|aynukar|I see it|tr=aynu-kar|ref=Example Ref}}'
		);
		expect(renderWikitext(entryWithTransliteration, 'ja')).toContain(
			'#* {{quote|ain|aynukar|I see it|tr=aynu-kar|ref=Example Ref}}'
		);
	});

	it('renders Japanese manual-style book references with Cite book', () => {
		const entryWithSource: AinuEntry = {
			lemma: 'test',
			pos: 'verb',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'echipacipa',
							translation: 'to hope',
							source: {
								title: 'アイヌ語訳新約聖書',
								author: 'ジョン・バチェラー',
								year: '1897'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithSource, 'ja')).toContain(
			'#* {{quote|ain|echipacipa|to hope|ref=<ref>{{Cite book|title=アイヌ語訳新約聖書|author=ジョン・バチェラー|year=1897}}</ref>}}'
		);
	});

	it('prefers raw ref output when present', () => {
		const entryWithRawRef: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'a',
							translation: 'b',
							transliteration: 'c',
							ref: 'blahblah',
							source: {
								template: 'Cite book',
								title: 'x',
								author: 'y'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithRawRef, 'ja')).toContain(
			'#* {{quote|ain|a|b|tr=c|ref=blahblah}}'
		);
	});

	it('renders selected Cite web references', () => {
		const entryWithWebRef: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'a',
							translation: 'b',
							source: {
								template: 'Cite web',
								title: 'x',
								author: 'y',
								year: '2024-01-01',
								url: 'https://example.com',
								publisher: 'Example Site'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithWebRef, 'ja')).toContain(
			'#* {{quote|ain|a|b|ref=<ref>{{Cite web|title=x|author=y|url=https://example.com|date=2024-01-01|website=Example Site}}</ref>}}'
		);
	});

	it('highlights the current headword inside example sentences', () => {
		const highlightedEntry: AinuEntry = {
			lemma: 'kampinuye',
			pos: 'verb',
			definitions: [
				{
					gloss: 'to study',
					examples: [
						{
							text: '"Kayano Sigeru no aynu-go-ziten" or ta ene kampinuye hi:',
							translation: 'It is written as follows in "Kayano Shigeru\'s Ainu dictionary".',
							ref: 'Example Ref'
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(highlightedEntry, 'ja')).toContain(
			`#* {{quote|ain|"Kayano Sigeru no aynu-go-ziten" or ta ene '''kampinuye''' hi:|It is written as follows in "Kayano Shigeru's Ainu dictionary".|ref=Example Ref}}`
		);
		expect(renderWikitext(highlightedEntry, 'en')).toContain(
			`"Kayano Sigeru no aynu-go-ziten" or ta ene '''kampinuye''' hi:`
		);
	});

	it('renders full dates in English quote templates', () => {
		const entryWithDatedQuote: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'a',
							translation: 'b',
							source: {
								author: 'y',
								title: 'x',
								year: '2024-01-01',
								url: 'https://example.com'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(entryWithDatedQuote, 'en')).toContain(
			'#* {{quote-book|ain|year=2024-01-01|author=y|title=x|url=https://example.com|text=a|t=b}}'
		);
	});
});

describe('Ainu accent handling', () => {
	it('normalizes page lemmas by stripping accents and whitespace', () => {
		expect(stripAccentAndWhitespace(' á ca ')).toBe('aca');
	});

	it('splits syllables for live accent selection', () => {
		expect(splitAinuSyllables('aca')).toEqual([
			{ text: 'a', index: 1 },
			{ text: 'ca', index: 2 }
		]);
		expect(splitAinuSyllables('arpa')).toEqual([
			{ text: 'ar', index: 1 },
			{ text: 'pa', index: 2 }
		]);
	});

	it('detects explicit accent marks from the lemma input', () => {
		expect(analyzeAinuLemma('áca')).toEqual({
			pageLemma: 'aca',
			accentedLemma: 'áca',
			accentPosition: 1,
			defaultAccentPosition: 2,
			explicitAccent: true,
			explicitException: true
		});
	});

	it('defaults to the second syllable after an open first syllable', () => {
		expect(analyzeAinuLemma('aca')).toEqual({
			pageLemma: 'aca',
			accentedLemma: 'acá',
			accentPosition: 2,
			defaultAccentPosition: 2,
			explicitAccent: false,
			explicitException: false
		});
	});

	it('defaults to the first syllable after a closed first syllable', () => {
		expect(analyzeAinuLemma('arpa')).toEqual({
			pageLemma: 'arpa',
			accentedLemma: 'árpa',
			accentPosition: 1,
			defaultAccentPosition: 1,
			explicitAccent: false,
			explicitException: false
		});
	});

	it('ignores out-of-range accent overrides and falls back to the default analysis', () => {
		expect(analyzeAinuLemma('aca', 9)).toEqual({
			pageLemma: 'aca',
			accentedLemma: 'acá',
			accentPosition: 2,
			defaultAccentPosition: 2,
			explicitAccent: false,
			explicitException: false
		});
	});

	it('does not treat explicit default accent as a headword exception', () => {
		expect(analyzeAinuLemma('acá')).toEqual({
			pageLemma: 'aca',
			accentedLemma: 'acá',
			accentPosition: 2,
			defaultAccentPosition: 2,
			explicitAccent: true,
			explicitException: false
		});
	});

	it('renders exceptional explicit accent in both head and IPA', () => {
		const output = renderWikitext(
			{
				lemma: 'áca',
				pos: 'noun',
				definitions: [{ gloss: 'test' }]
			},
			'ja'
		);

		expect(output).toContain('* {{ain-IPA|áca}}');
		expect(output).toContain('{{head|ain|noun|head=áca}}');
	});

	it('keeps explicit default accent in IPA only', () => {
		const output = renderWikitext(
			{
				lemma: 'acá',
				pos: 'noun',
				definitions: [{ gloss: 'test' }]
			},
			'ja'
		);

		expect(output).toContain('* {{ain-IPA|acá}}');
		expect(output).toContain('{{head|ain|noun}}');
		expect(output).not.toContain('head=acá');
	});

	it('omits explicit accent markup when accent is unknown', () => {
		const output = renderWikitext(
			{
				lemma: 'áca',
				pos: 'noun',
				definitions: [{ gloss: 'test' }],
				pronunciation: { ipa: true, accentKnown: false }
			},
			'ja'
		);

		expect(output).toContain('* {{ain-IPA}}');
		expect(output).not.toContain('{{head|ain|noun|head=áca}}');
		expect(output).toContain('{{head|ain|noun}}');
	});

	it('renders default accent only in IPA when the user does not mark an exception', () => {
		const output = renderWikitext(
			{
				lemma: 'aca',
				pos: 'noun',
				definitions: [{ gloss: 'test' }]
			},
			'ja'
		);

		expect(output).toContain('* {{ain-IPA|acá}}');
		expect(output).toContain('{{head|ain|noun}}');
		expect(output).not.toContain('head=acá');
	});

	it('treats an accent-position override as explicit for head and IPA', () => {
		const output = renderWikitext(
			{
				lemma: 'aca',
				accentPosition: 1,
				pos: 'noun',
				definitions: [{ gloss: 'test' }]
			},
			'ja'
		);

		expect(output).toContain('* {{ain-IPA|áca}}');
		expect(output).toContain('{{head|ain|noun|head=áca}}');
	});
});

describe('highlightHeadwordSegments', () => {
	it('matches headwords accent-insensitively without bolding partial words', () => {
		expect(highlightHeadwordSegments('sirpirka sir', 'sir')).toEqual([
			{ text: 'sirpirka ', isHeadword: false },
			{ text: 'sir', isHeadword: true }
		]);
	});

	it('matches accented tokens against the current page lemma', () => {
		expect(highlightHeadwordSegments('acá wa aca', 'aca')).toEqual([
			{ text: 'acá', isHeadword: true },
			{ text: ' wa ', isHeadword: false },
			{ text: 'aca', isHeadword: true }
		]);
	});
});
