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
		etymology: [{ term: '-re' }, { term: '-e' }],
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
		expect(output).toContain('{{affix|ain|-re|-e}}');
		expect(output).toContain('{{head|ain|suffix}}');
		expect(output).toContain('# causative suffix');
	});

	it('renders Japanese style correctly', () => {
		const output = renderWikitext(entry, 'ja');

		// Check that we DO NOT have double newlines before headers (default behavior)
		// Note: The first header might not have a preceding newline, but subsequent ones might just be \n
		// Actually, our implementation uses parts.join('\n'), so normal separation is \n.
		// If empty_line_before_headings is false, we don't push '', so we get \n.
		// If true, we push '', so we get \n\n.

		expect(output).not.toContain('\n\n==={{pron}}===');
		expect(output).toContain('\n==={{pron}}===');

		expect(output).toContain('=={{L|ain}}==');
		expect(output).toContain('{{ain-kana}}');
		expect(output).toContain('==={{pron}}===');
		expect(output).toContain('==={{etym}}===');
		expect(output).toContain('==={{suffix}}===');
		expect(output).toContain('===={{usage}}====');

		// Check specific content
		expect(output).toContain('{{affix|ain|-re|-e}}');
		expect(output).toContain('{{head|ain|suffix}}');
		expect(output).toContain('# causative suffix');
	});
});
