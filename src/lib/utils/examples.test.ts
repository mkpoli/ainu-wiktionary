import { describe, expect, it } from 'bun:test';
import { stripUnmatchedAsciiDoubleQuote } from './examples';

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
