import { describe, expect, it } from 'bun:test';
import { parseWiktionaryEntry } from './wiktionaryEntry';

describe('parseWiktionaryEntry', () => {
	it('parses a generated Japanese Ainu entry', () => {
		const parsed = parseWiktionaryEntry(`=={{L|ain}}==
{{ain-kana}}
==={{pron}}===
* {{ain-IPA|a\u0301rpa}}
==={{etym}}===
{{affix|ain|ar|-pa|t1=one thing|pos1=root|t2=plural}}
==={{verb}}===
{{ain-verb|1|pl=arpaan}} {{context|rare|lang=ain}} {{tlb|ain|Saru|Chitose}}
# to go
#* {{quote|ain|'''arpa''' an|行く|tr=arpa an|ref=<ref>Source</ref>}}
===={{usage}}====
Used in examples.
===={{drv}}====
* {{l|ain|arpaan}} (plural)
===={{rel}}====
* {{l|ain|ar}} (motion)
===={{syn}}====
* {{l|ain|oman}} (to go)
===={{ant}}====
* {{l|ain|as}} (to stand)
===出典===
{{Reflist}}`);

		expect(parsed.lemma).toBe('arpa');
		expect(parsed.accentPosition).toBe(1);
		expect(parsed.pos).toBe('verb');
		expect(parsed.pos_args?.transitivity).toBe(1);
		expect(parsed.pos_args?.plural).toBe('arpaan');
		expect(parsed.sub_type).toBe('rare');
		expect(parsed.dialects).toEqual(['Saru', 'Chitose']);
		expect(parsed.etymology).toEqual([
			{ term: 'ar', tran: 'one thing', pos: 'root' },
			{ term: '-pa', tran: 'plural' }
		]);
		expect(parsed.definitions[0]).toEqual({
			gloss: 'to go',
			examples: [
				{
					text: 'arpa an',
					translation: '行く',
					transliteration: 'arpa an',
					ref: '<ref>Source</ref>'
				}
			]
		});
		expect(parsed.usage).toBe('Used in examples.');
		expect(parsed.derived).toEqual([{ term: 'arpaan', tran: 'plural' }]);
		expect(parsed.related).toEqual([{ term: 'ar', tran: 'motion' }]);
		expect(parsed.synonyms).toEqual([{ term: 'oman', tran: 'to go' }]);
		expect(parsed.antonyms).toEqual([{ term: 'as', tran: 'to stand' }]);
	});

	it('parses canonical and redirect Japanese part-of-speech templates', () => {
		for (const [header, expectedPos] of [
			['{{name}}', 'proper_noun'],
			['固有名詞', 'proper_noun'],
			['{{adjective}}', 'adj'],
			['{{adj}}', 'adj'],
			['{{adverb}}', 'adv'],
			['{{adv}}', 'adv'],
			['連体詞', 'adnominal'],
			['{{numeral}}', 'numeral'],
			['数詞', 'numeral'],
			['{{pronoun}}', 'pron'],
			['{{preposition}}', 'prep'],
			['{{prep}}', 'prep'],
			['{{conjunction}}', 'conj'],
			['{{conj}}', 'conj'],
			['{{interjection}}', 'interj'],
			['{{interj}}', 'interj'],
			['語根', 'root'],
			['{{pref}}', 'prefix'],
			['{{prefix}}', 'prefix'],
			['連語', 'colloc']
		] as const) {
			const parsed = parseWiktionaryEntry(
				`=={{L|ain}}==
==={{pron}}===
* {{ain-IPA}}
===${header}===
{{head|ain|noun}}
# test`,
				'test'
			);

			expect(parsed.pos).toBe(expectedPos);
		}
	});

	it('parses an English Ainu entry with quote-book example', () => {
		const parsed = parseWiktionaryEntry(
			`==Ainu==

===Pronunciation===
* {{IPA|ain|...}}

===Etymology===
{{affix|ain|yay-|nu|-re|t1=self|pos1=prefix|t3=make|pos3=suffix}}

===Verb===
{{ain-verb|2|pl=yaynurecik}}
# to make hear
#* {{quote-book|ain|year=2023|author=Author|title=Book|chapter=Chapter|url=https://example.com|text='''yaynure'''|tr=yaynure|t=聞かせる}}

====Derived terms====
* {{l|ain|yaynurehe}} (causative)`,
			'yaynure'
		);

		expect(parsed.pos).toBe('verb');
		expect(parsed.pos_args?.transitivity).toBe(2);
		expect(parsed.etymology).toEqual([
			{ term: 'yay-', tran: 'self', pos: 'prefix' },
			{ term: 'nu' },
			{ term: '-re', tran: 'make', pos: 'suffix' }
		]);
		expect(parsed.definitions[0]?.examples?.[0]).toEqual({
			text: 'yaynure',
			translation: '聞かせる',
			transliteration: 'yaynure',
			source: {
				template: 'quote-book',
				author: 'Author',
				title: 'Chapter',
				book: 'Book',
				year: '2023',
				url: 'https://example.com'
			}
		});
	});

	it('parses a real-style Japanese entry like omante', () => {
		const parsed = parseWiktionaryEntry(
			`=={{L|ain}}==
{{ain-kana}}
==={{pron|ain}}===
* {{ain-IPA}}
==={{etym}}===
{{l|ain|oman}}「行く」+ {{l|ain|-te}}「させる」（使役接辞）＝「行かせる」→「送る」
==={{verb}}===
{{head|ain|verb}} {{context|transitive|lang=ain}}
#{{おくりがな2|送|おく|る|おくる}}。
#* {{l|ain|iomante}}「イオマンテ（儀式）」
#* {{l|ain|sonkoomante}}「手紙を送る」`,
			'omante'
		);

		expect(parsed.lemma).toBe('omante');
		expect(parsed.pronunciation?.accentKnown).toBe(false);
		expect(parsed.pos).toBe('verb');
		expect(parsed.pos_args?.transitivity).toBe(2);
		expect(parsed.etymology).toEqual([
			{ term: 'oman', tran: '行く' },
			{ term: '-te', tran: 'させる' }
		]);
		expect(parsed.definitions).toEqual([
			{
				gloss: '{{おくりがな2|送|おく|る|おくる}}。',
				examples: undefined
			}
		]);
	});

	it('parses alternative forms immediately after ain-kana', () => {
		const parsed = parseWiktionaryEntry(
			`=={{L|ain}}==
{{ain-kana}}
==={{alter}}===
* {{l/ain|yahka|dialects=樺太アイヌ語}}
==={{pron|ain}}===
* {{ain-IPA}}
==={{verb}}===
{{head|ain|verb}}
# even if`,
			'yakka'
		);

		expect(parsed.alternatives).toEqual([{ term: 'yahka', dialects: ['樺太アイヌ語'] }]);
	});
});
