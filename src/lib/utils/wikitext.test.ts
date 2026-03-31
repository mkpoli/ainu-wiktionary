import { describe, it, expect } from 'bun:test';
import { renderWikitext, type AinuEntry } from './wikitext';

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

		// Check for References section
		expect(output).toContain('\n\n===References===');
		expect(output).toContain('{{reflist}}');

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
});
