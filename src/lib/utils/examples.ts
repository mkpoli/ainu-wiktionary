import { stripAccentAndWhitespace } from './wikitext';

export const MAX_EXAMPLE_QUERY_TERMS = 8;
export const MAX_EXAMPLE_TERM_LENGTH = 128;

/** Validated token and lemma keys for the public examples endpoint. */
export function exampleSearchTerms(primaryTerm: string, extraTerms: string[]): string[] | null {
	const values = [primaryTerm, ...extraTerms];
	if (values.length > MAX_EXAMPLE_QUERY_TERMS) return null;
	if (values.some((value) => [...value.trim()].length > MAX_EXAMPLE_TERM_LENGTH)) return null;

	const terms = new Set<string>();
	for (const value of values) {
		const term = value.trim();
		if (!term) continue;
		terms.add(term);

		const unaccentedTerm = stripAccentAndWhitespace(term);
		if (unaccentedTerm) terms.add(unaccentedTerm);
	}
	return [...terms];
}

export function stripUnmatchedAsciiDoubleQuote(value: string): string {
	const quoteCount = [...value].filter((char) => char === '"').length;
	if (quoteCount % 2 === 0) return value;

	if (/^\s*"/u.test(value)) {
		return value.replace(/^(\s*)"/u, '$1');
	}

	if (/"\s*$/u.test(value)) {
		return value.replace(/"(\s*)$/u, '$1');
	}

	return value;
}
