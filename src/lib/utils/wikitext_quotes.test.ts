import { describe, it, expect } from 'bun:test';
import { renderWikitext, type AinuEntry } from './wikitext';

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
    const expectedRef = '|ref=<ref>{{citation|author=Author Name|title=Book Title|publisher=Publisher Name|year=2023|url=http://example.com}}</ref>';
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
});
