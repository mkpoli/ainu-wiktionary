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

    expect(output).toContain('==Ainu==');
    expect(output).toContain('===Pronunciation===');
    expect(output).toContain('===Etymology===');
    expect(output).toContain('===Suffix===');
    expect(output).toContain('====Usage====');

    // Check specific content
    expect(output).toContain('{{affix|ain|-re|-e}}');
    expect(output).toContain('{{head|ain|suffix}}');
    expect(output).toContain('# causative suffix');
  });

  it('renders Japanese style correctly', () => {
    const output = renderWikitext(entry, 'ja');

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
