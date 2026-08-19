import { describe, expect, it } from 'bun:test';
import { GET as examplesEndpoint } from '../../routes/api/examples/[term]/+server';
import {
	MAX_EXAMPLE_QUERY_TERMS,
	MAX_EXAMPLE_TERM_LENGTH,
	exampleSearchTerms,
	stripUnmatchedAsciiDoubleQuote
} from './examples';

describe('exampleSearchTerms', () => {
	it('keeps the requested forms and their folded keys', () => {
		expect(exampleSearchTerms(' ápe ', ['cise'])).toEqual(['ápe', 'ape', 'cise']);
	});

	it('rejects excess query parameters', () => {
		expect(exampleSearchTerms('ape', Array(MAX_EXAMPLE_QUERY_TERMS).fill('cise'))).toBeNull();
	});

	it('rejects a term beyond the length ceiling', () => {
		expect(exampleSearchTerms('a'.repeat(MAX_EXAMPLE_TERM_LENGTH + 1), [])).toBeNull();
	});
});

describe('examples endpoint cost ceiling', () => {
	it('caps both indexed candidate streams and the response', async () => {
		let query = '';
		let bindings: unknown[] = [];
		const statement = {
			bind(...values: unknown[]) {
				bindings = values;
				return statement;
			},
			async all() {
				return { results: [] };
			}
		};
		const response = await examplesEndpoint({
			params: { term: 'ape' },
			url: new URL('https://wikt.aynu.org/api/examples/ape?term=cise'),
			platform: {
				env: {
					DB: {
						prepare(sql: string) {
							query = sql;
							return statement;
						}
					}
				}
			}
		} as never);

		expect(query).toContain('token_hits AS MATERIALIZED');
		expect(query).toContain('lemma_hits AS MATERIALIZED');
		expect(query).toContain('candidate_ids AS MATERIALIZED');
		expect(bindings).toEqual(['ape', 'cise', 200, 'ape', 'cise', 200, 100]);
		expect(response.headers.get('cache-control')).toContain('s-maxage=3600');
	});
});

describe('stripUnmatchedAsciiDoubleQuote', () => {
	it('removes an unmatched opening ASCII quote', () => {
		expect(stripUnmatchedAsciiDoubleQuote('"ciokay anak Otasut un kur ci=ne wa')).toBe(
			'ciokay anak Otasut un kur ci=ne wa'
		);
	});

	it('removes an unmatched closing ASCII quote', () => {
		expect(stripUnmatchedAsciiDoubleQuote('ciokay anak Otasut un kur ci=ne wa"')).toBe(
			'ciokay anak Otasut un kur ci=ne wa'
		);
	});

	it('keeps balanced ASCII quotes', () => {
		expect(stripUnmatchedAsciiDoubleQuote('"ciokay anak"')).toBe('"ciokay anak"');
	});

	it('keeps Japanese quote marks', () => {
		expect(stripUnmatchedAsciiDoubleQuote('「私はオタスッ村の者で')).toBe('「私はオタスッ村の者で');
	});
});
