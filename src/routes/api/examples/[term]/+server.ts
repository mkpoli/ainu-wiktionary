import { json } from '@sveltejs/kit';
import { stripAccentAndWhitespace } from '$lib/utils/wikitext';
import type { RequestHandler } from './$types';

function getSearchTerms(primaryTerm: string, extraTerms: string[]): string[] {
	const terms = new Set<string>();

	for (const value of [primaryTerm, ...extraTerms]) {
		const term = value.trim();
		if (!term) continue;
		terms.add(term);

		const unaccentedTerm = stripAccentAndWhitespace(term);
		if (unaccentedTerm) {
			terms.add(unaccentedTerm);
		}
	}

	return [...terms];
}

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const terms = getSearchTerms(params.term, url.searchParams.getAll('term'));
	const db = platform?.env?.DB;

	if (!db) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	if (terms.length === 0) {
		return json({ examples: [] });
	}

	const placeholders = terms.map(() => '?').join(', ');

	const examples = await db
		.prepare(
			`
			SELECT DISTINCT
				s.id,
				s.ain,
				s.jpn,
				s.dialect as sentence_dialect,
				d.title,
				d.book,
				d.author,
				COALESCE(d.published_at, d.recorded_at, CAST(d.year AS TEXT)) as date,
				d.url,
				d.dialect as doc_dialect
			FROM tokens t
			JOIN sentences s ON t.sentence_id = s.id
			JOIN documents d ON s.document_id = d.id
			WHERE t.token IN (${placeholders}) OR t.lemma IN (${placeholders})
		`
		)
		.bind(...terms, ...terms)
		.all();

	return json({ examples: examples.results });
};
