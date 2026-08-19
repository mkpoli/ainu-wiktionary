import { json } from '@sveltejs/kit';
import { exampleSearchTerms, stripUnmatchedAsciiDoubleQuote } from '$lib/utils/examples';
import type { RequestHandler } from './$types';

const MAX_CANDIDATES_PER_INDEX = 200;
const MAX_EXAMPLES = 100;

export const GET: RequestHandler = async ({ params, platform, url }) => {
	const terms = exampleSearchTerms(params.term, url.searchParams.getAll('term'));
	const db = platform?.env?.DB;

	if (!db) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	if (terms === null) {
		return json({ error: 'Too many or overly long search terms' }, { status: 400 });
	}

	if (terms.length === 0) {
		return json({ examples: [] });
	}

	const placeholders = terms.map(() => '?').join(', ');

	const examples = await db
		.prepare(
			`
			WITH token_hits AS MATERIALIZED (
				SELECT sentence_id FROM tokens INDEXED BY idx_tokens_token
				WHERE token IN (${placeholders}) LIMIT ?
			),
			lemma_hits AS MATERIALIZED (
				SELECT sentence_id FROM tokens INDEXED BY idx_tokens_lemma
				WHERE lemma IN (${placeholders}) LIMIT ?
			),
			candidate_ids AS MATERIALIZED (
				SELECT sentence_id FROM token_hits
				UNION
				SELECT sentence_id FROM lemma_hits
			)
			SELECT
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
			FROM candidate_ids c
			CROSS JOIN sentences s ON s.id = c.sentence_id
			CROSS JOIN documents d ON d.id = s.document_id
			LIMIT ?
		`
		)
		.bind(...terms, MAX_CANDIDATES_PER_INDEX, ...terms, MAX_CANDIDATES_PER_INDEX, MAX_EXAMPLES)
		.all();

	return json(
		{
			examples: examples.results.map((example) => ({
				...example,
				ain: stripUnmatchedAsciiDoubleQuote(String(example.ain ?? '')),
				jpn: stripUnmatchedAsciiDoubleQuote(String(example.jpn ?? ''))
			}))
		},
		{ headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } }
	);
};
