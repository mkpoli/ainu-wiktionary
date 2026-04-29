import { describe, it, expect } from 'bun:test';
import {
	analyzeAinuLemma,
	highlightHeadwordSegments,
	highlightTranslationSegments,
	renderWikitext,
	segmentJapaneseTranslation,
	splitAinuSyllables,
	stripAccentAndWhitespace,
	type AinuEntry
} from './wikitext';
import {
	applyAinuEtymologyPreset,
	mergeAinuEtymologyTerms,
	parseAinuEtymologyInput,
	splitAinuEtymologyTerm,
	suggestAinuLemmaEtymology
} from './ainuEtymology';

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

	it('escapes equals signs in affix positional parameters', () => {
		const output = renderWikitext(
			{
				lemma: 'iyaynu',
				pos: 'verb',
				definitions: [{ gloss: '{{rfdef|ain}}' }],
				etymology: [{ term: 'i=', tran: 'ものを/人を', pos: '一般目的語接頭辞' }, { term: 'yaynu' }]
			},
			'ja'
		);

		expect(output).toContain('{{affix|ain|i{{=}}|yaynu|t1=ものを/人を|pos1=一般目的語接頭辞}}');
	});

	it('renders global and per-component affix parameters', () => {
		const output = renderWikitext(
			{
				lemma: 'test',
				pos: 'noun',
				definitions: [{ gloss: '{{rfdef|ain}}' }],
				etymologyOptions: { pos: 'nouns', lit: 'literal value', nocat: '1' },
				etymology: [
					{
						term: 'yay-',
						tran: '自分を',
						pos: '再帰接頭辞',
						alt: 'yay',
						tr: 'yay',
						q: 'rare'
					},
					{ term: 'nu', lit: 'hear' },
					{ term: '-re', type: 'suffix' }
				]
			},
			'ja'
		);

		expect(output).toContain(
			'{{affix|ain|yay-|nu|-re|pos=nouns|lit=literal value|nocat=1|alt1=yay|t1=自分を|tr1=yay|pos1=再帰接頭辞|q1=rare|lit2=hear|type3=suffix}}'
		);
	});

	it('adds Japanese intransitive verb conjugation', () => {
		const output = renderWikitext(
			{
				lemma: 'arpa',
				pos: 'verb',
				pos_args: { transitivity: 1 },
				definitions: [{ gloss: 'to go' }]
			},
			'ja'
		);

		expect(output).toContain('===={{conjugation}}====');
		expect(output).toContain('{{ain-conj-intr}}');
	});

	it('adds English intransitive verb conjugation', () => {
		const output = renderWikitext(
			{
				lemma: 'arpa',
				pos: 'verb',
				pos_args: { transitivity: 1 },
				definitions: [{ gloss: 'to go' }]
			},
			'en'
		);

		expect(output).toContain('====Conjugation====');
		expect(output).toContain('{{ain-conj-intr}}');
	});

	it('adds Japanese transitive and ditransitive verb conjugation', () => {
		const transitiveOutput = renderWikitext(
			{
				lemma: 'kore',
				pos: 'verb',
				pos_args: { transitivity: 2 },
				definitions: [{ gloss: 'to have' }]
			},
			'ja'
		);
		const ditransitiveOutput = renderWikitext(
			{
				lemma: 'omap',
				pos: 'verb',
				pos_args: { transitivity: 3 },
				definitions: [{ gloss: 'to give something to someone' }]
			},
			'ja'
		);

		expect(transitiveOutput).toContain('===={{conjugation}}====');
		expect(transitiveOutput).toContain('{{ain-conj-tran}}');
		expect(ditransitiveOutput).toContain('===={{conjugation}}====');
		expect(ditransitiveOutput).toContain('{{ain-conj-tran}}');
	});

	it('adds English transitive and ditransitive verb conjugation', () => {
		const transitiveOutput = renderWikitext(
			{
				lemma: 'kore',
				pos: 'verb',
				pos_args: { transitivity: 2 },
				definitions: [{ gloss: 'to have' }]
			},
			'en'
		);
		const ditransitiveOutput = renderWikitext(
			{
				lemma: 'omap',
				pos: 'verb',
				pos_args: { transitivity: 3 },
				definitions: [{ gloss: 'to give something to someone' }]
			},
			'en'
		);

		expect(transitiveOutput).toContain('====Conjugation====');
		expect(transitiveOutput).toContain('{{ain-conj-tran}}');
		expect(ditransitiveOutput).toContain('====Conjugation====');
		expect(ditransitiveOutput).toContain('{{ain-conj-tran}}');
	});

	it('adds Japanese tritransitive verb conjugation', () => {
		const output = renderWikitext(
			{
				lemma: 'kore',
				pos: 'verb',
				pos_args: { transitivity: 4 },
				definitions: [{ gloss: 'to cause someone to give something to someone' }]
			},
			'ja'
		);

		expect(output).toContain('===={{conjugation}}====');
		expect(output).toContain('{{ain-conj-tran}}');
	});

	it('adds English tritransitive verb conjugation', () => {
		const output = renderWikitext(
			{
				lemma: 'kore',
				pos: 'verb',
				pos_args: { transitivity: 4 },
				definitions: [{ gloss: 'to cause someone to give something to someone' }]
			},
			'en'
		);

		expect(output).toContain('====Conjugation====');
		expect(output).toContain('{{ain-conj-tran}}');
	});

	it('omits Japanese conjugation for complete verbs', () => {
		const output = renderWikitext(
			{
				lemma: 'ki',
				pos: 'verb',
				pos_args: { transitivity: 0 },
				definitions: [{ gloss: 'to do completely' }]
			},
			'ja'
		);

		expect(output).not.toContain('===={{conjugation}}====');
		expect(output).not.toContain('{{ain-conj-intr}}');
		expect(output).not.toContain('{{ain-conj-tran}}');
	});

	it('omits English conjugation for complete verbs', () => {
		const output = renderWikitext(
			{
				lemma: 'ki',
				pos: 'verb',
				pos_args: { transitivity: 0 },
				definitions: [{ gloss: 'to do completely' }]
			},
			'en'
		);

		expect(output).not.toContain('====Conjugation====');
		expect(output).not.toContain('{{ain-conj-intr}}');
		expect(output).not.toContain('{{ain-conj-tran}}');
	});
});

describe('Ainu etymology presets', () => {
	it('fills blank gloss and POS fields without overwriting manual values', () => {
		expect(applyAinuEtymologyPreset({ term: 'i{{=}}' })).toEqual({
			term: 'i=',
			tran: 'ものを/人を',
			pos: '一般目的語接頭辞'
		});
		expect(applyAinuEtymologyPreset({ term: '-re', tran: 'make', pos: 'suffix' })).toEqual({
			term: '-re',
			tran: 'make',
			pos: 'suffix'
		});
	});

	it('parses comma and plus separated etymology input with presets', () => {
		expect(parseAinuEtymologyInput('i= + yay- + nu + -re')).toEqual([
			{ term: 'i=', tran: 'ものを/人を', pos: '一般目的語接頭辞' },
			{ term: 'yay-', tran: '自分を/自分で', pos: '再帰接頭辞' },
			{ term: 'nu' },
			{ term: '-re', tran: 'させる', pos: '使役接尾辞' }
		]);
	});

	it('leaves double articulation choices to explicit user input', () => {
		expect(parseAinuEtymologyInput('i= + yaynure')).toEqual([
			{ term: 'i=', tran: 'ものを/人を', pos: '一般目的語接頭辞' },
			{ term: 'yaynure' }
		]);
		expect(parseAinuEtymologyInput('yay- + nure')).toEqual([
			{ term: 'yay-', tran: '自分を/自分で', pos: '再帰接頭辞' },
			{ term: 'nure' }
		]);
		expect(parseAinuEtymologyInput('yaynu + -re')).toEqual([
			{ term: 'yaynu' },
			{ term: '-re', tran: 'させる', pos: '使役接尾辞' }
		]);
	});

	it('suggests an initial editable parse from the lemma', () => {
		expect(suggestAinuLemmaEtymology('yaynure')).toEqual([
			{ term: 'yay-', tran: '自分を/自分で', pos: '再帰接頭辞' },
			{ term: 'nu' },
			{ term: '-re', tran: 'させる', pos: '使役接尾辞' }
		]);
		expect(suggestAinuLemmaEtymology('i=yaynure')).toEqual([
			{ term: 'i=', tran: 'ものを/人を', pos: '一般目的語接頭辞' },
			{ term: 'yay-', tran: '自分を/自分で', pos: '再帰接頭辞' },
			{ term: 'nu' },
			{ term: '-re', tran: 'させる', pos: '使役接尾辞' }
		]);
	});

	it('merges and splits etymology components', () => {
		expect(mergeAinuEtymologyTerms({ term: 'yay-' }, { term: 'nu' })).toEqual({ term: 'yaynu' });
		expect(mergeAinuEtymologyTerms({ term: 'nu' }, { term: '-re' })).toEqual({ term: 'nure' });
		expect(splitAinuEtymologyTerm({ term: 'yaynure' })).toEqual([
			{ term: 'yay-', tran: '自分を/自分で', pos: '再帰接頭辞' },
			{ term: 'nu' },
			{ term: '-re', tran: 'させる', pos: '使役接尾辞' }
		]);
		expect(splitAinuEtymologyTerm({ term: 'yaynure' }, 'yaynu + -re')).toEqual([
			{ term: 'yaynu' },
			{ term: '-re', tran: 'させる', pos: '使役接尾辞' }
		]);
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

	it('renders Sentoku letter examples with Cyrillic text and bibliography ref', () => {
		const sentokuEntry: AinuEntry = {
			lemma: 'omante',
			pos: 'verb',
			definitions: [
				{
					gloss: 'to send',
					examples: [
						{
							id: 'fetched-116998',
							text: 'nani hospi sonko cokay omante rusuy yahka',
							transliteration: '',
							translation: '我々はすぐに返信を送りたかったのですが、',
							highlightedTranslationParts: ['送り'],
							source: {
								author: '千徳 太郎治',
								title: '第1の手紙',
								book: '千徳太郎治のピウスツキ宛書簡',
								year: '',
								url: 'https://opac.ll.chiba-u.jp/da/curator/900023326/'
							}
						},
						{
							id: 'fetched-117001',
							text: 'kampi omante yahka nispa oman hemaka te',
							translation: '手紙を送ってもニシパが去ってしまったから',
							source: {
								author: '千徳 太郎治',
								title: '第1の手紙',
								book: '千徳太郎治のピウスツキ宛書簡',
								url: 'https://opac.ll.chiba-u.jp/da/curator/900023326/'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		const output = renderWikitext(sentokuEntry, 'en');
		const expected = `#* {{quote-book|ain|year=1906|author=[[:w:千徳太郎治|千徳太郎治]]|text=нані хосьбі сонко цокай '''оманде''' русуй яхка|title=千徳太郎治のピウスツキ宛書簡|chapter=第1の手紙<ref name="ain-ex-fetched-116998">{{citation|author2=丹菊 逸治|author1=荻原 眞子|chapter=第1の手紙|title=千徳太郎治のピウスツキ宛書簡|journal=千葉大学 ユーラシア言語文化論集|volume=4|date=2001|pages=187-226|url=https://opac.ll.chiba-u.jp/da/curator/900023326/}}</ref>|tr=nani hospi sonko cokay '''omante''' rusuy yahka|t=我々はすぐに返信を'''送り'''たかったのですが、|q=樺太アイヌ語}}`;

		expect(output).toContain(expected);
		expect(output).toContain(
			`#* {{quote-book|ain|year=1906|author=[[:w:千徳太郎治|千徳太郎治]]|text=кампі '''оманде''' яхка нисьпа оман хемакаде|title=千徳太郎治のピウスツキ宛書簡|chapter=第1の手紙<ref name="ain-ex-fetched-117001">{{citation|author2=丹菊 逸治|author1=荻原 眞子|chapter=第1の手紙|title=千徳太郎治のピウスツキ宛書簡|journal=千葉大学 ユーラシア言語文化論集|volume=4|date=2001|pages=187-226|url=https://opac.ll.chiba-u.jp/da/curator/900023326/}}</ref>|tr=kampi '''omante''' yahka nispa oman hemaka te|t=手紙を送ってもニシパが去ってしまったから|q=樺太アイヌ語}}`
		);
		expect(renderWikitext(sentokuEntry, 'ja')).toContain(expected);
	});

	it('renders Asai Take examples with detailed book metadata and modern transcription', () => {
		const asaiEntry: AinuEntry = {
			lemma: "si'omante",
			pos: 'verb',
			definitions: [
				{
					gloss: 'to go',
					examples: [
						{
							id: 'fetched-155143',
							text: "hanka si'omante kusu",
							translation: '私は行きませんよ。',
							highlightedTranslationParts: ['行き'],
							source: {
								author: '浅井 タケ',
								title: 'チッポ虫',
								book: '浅井タケ昔話全集 I, II',
								year: '1989-01-07',
								url: 'http://www.aa.tufs.ac.jp/~mmine/kiki_gen/murasaki/at32aj.html'
							}
						}
					]
				}
			],
			addSeparator: false
		};

		const expected = `#* {{quote-book|ain|author=浅井 タケ|title=浅井タケ昔話全集 I, II|chapter=チッポ虫<ref name="ain-ex-fetched-155143">{{citation|author=浅井 タケ|editor=村崎 恭子|editor2=峰岸 真琴|title=浅井タケ昔話全集|publisher=大阪学院大学情報学部|date=2001-03|series=ELPR publication series|volume=A2-007|id={{NCID|BA52699362}}}}</ref>|text=hanka '''si'omante''' kusu|tr=hanka '''siomante''' kusu|t=私は'''行き'''ませんよ。|q=樺太アイヌ語}}`;

		expect(renderWikitext(asaiEntry, 'en')).toContain(expected);
		expect(renderWikitext(asaiEntry, 'ja')).toContain(expected);
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

	it('highlights selected translation parts in generated examples', () => {
		const highlightedEntry: AinuEntry = {
			lemma: 'test',
			pos: 'noun',
			definitions: [
				{
					gloss: 'test definition',
					examples: [
						{
							text: 'a',
							translation: '彼は学校へ行く',
							highlightedTranslationIndexes: [2, 4]
						}
					]
				}
			],
			addSeparator: false
		};

		expect(renderWikitext(highlightedEntry, 'ja')).toContain(
			"#* {{quote|ain|a|彼は'''学校'''へ'''行く'''}}"
		);
		expect(renderWikitext(highlightedEntry, 'en')).toContain(
			"#: {{ux|ain|a|彼は'''学校'''へ'''行く'''}}"
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

	it('reuses named references when the same example is attached to multiple definitions', () => {
		const sharedExample = {
			id: 'shared-example',
			text: 'a',
			translation: 'b',
			source: {
				author: 'Author',
				title: 'Book',
				year: '2024'
			}
		};

		const output = renderWikitext(
			{
				lemma: 'test',
				pos: 'noun',
				definitions: [
					{ gloss: 'first sense', examples: [sharedExample] },
					{ gloss: 'second sense', examples: [sharedExample] }
				],
				addSeparator: false
			},
			'ja'
		);

		expect(output).toContain(
			'#* {{quote|ain|a|b|ref=<ref name="ain-ex-shared-example">{{Cite book|title=Book|author=Author|year=2024}}</ref>}}'
		);
		expect(output).toContain('#* {{quote|ain|a|b|ref=<ref name="ain-ex-shared-example" />}}');
	});

	it('adds named refs to raw ref markup only once when examples are reused', () => {
		const repeatedOutput = renderWikitext(
			{
				lemma: 'test',
				pos: 'noun',
				definitions: [
					{
						gloss: 'sense one',
						examples: [{ id: 'dup-raw', text: 'a', translation: 'b', ref: '<ref>Raw Ref</ref>' }]
					},
					{
						gloss: 'sense two',
						examples: [{ id: 'dup-raw', text: 'a', translation: 'b', ref: '<ref>Raw Ref</ref>' }]
					}
				],
				addSeparator: false
			},
			'en'
		);

		expect(repeatedOutput).toContain('ref=<ref name="ain-ex-dup-raw">Raw Ref</ref>');
		expect(repeatedOutput).toContain('ref=<ref name="ain-ex-dup-raw" />');
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

describe('translation highlighting', () => {
	it('segments Japanese translations into word-like parts', () => {
		expect(segmentJapaneseTranslation('彼は学校へ行く')).toEqual([
			{ text: '彼', index: 0, isWordLike: true, isHighlighted: false },
			{ text: 'は', index: 1, isWordLike: true, isHighlighted: false },
			{ text: '学校', index: 2, isWordLike: true, isHighlighted: false },
			{ text: 'へ', index: 3, isWordLike: true, isHighlighted: false },
			{ text: '行く', index: 4, isWordLike: true, isHighlighted: false }
		]);
	});

	it('highlights selected translation indexes positionally without losing surrounding text', () => {
		expect(highlightTranslationSegments('学校で学校を学ぶ', [2])).toEqual([
			{ text: '学校で', index: 0, isWordLike: true, isHighlighted: false },
			{ text: '学校', index: 2, isWordLike: true, isHighlighted: true },
			{ text: 'を学ぶ', index: 3, isWordLike: true, isHighlighted: false }
		]);
	});

	it('merges adjacent highlighted tokens into one bold run', () => {
		expect(highlightTranslationSegments('彼は学校へ行く', [2, 3, 4])).toEqual([
			{ text: '彼は', index: 0, isWordLike: true, isHighlighted: false },
			{ text: '学校へ行く', index: 2, isWordLike: true, isHighlighted: true }
		]);
	});
});
