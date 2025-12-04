import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const term = params.term;
	const db = platform?.env?.DB;

	if (!db) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	// 1. Find sentence IDs containing the term
	const tokenResults = await db
		.prepare('SELECT sentence_id FROM tokens WHERE token = ? OR lemma = ?')
		.bind(term, term)
		.all();

	if (!tokenResults.results || tokenResults.results.length === 0) {
		return json({ examples: [] });
	}

	const sentenceIds = tokenResults.results.map((r: any) => r.sentence_id);

	// 2. Fetch sentences and documents
	const placeholders = sentenceIds.map(() => '?').join(',');
	const query = `
    SELECT s.ain, s.jpn, s.dialect as sentence_dialect, 
           d.title, d.book, d.author, d.year, d.url, d.dialect as doc_dialect
    FROM sentences s
    JOIN documents d ON s.document_id = d.id
    WHERE s.id IN (${placeholders})
  `;

	const examples = await db
		.prepare(query)
		.bind(...sentenceIds)
		.all();

	return json({ examples: examples.results });
};
