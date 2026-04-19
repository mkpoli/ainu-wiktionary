import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const term = params.term;
	const db = platform?.env?.DB;

	if (!db) {
		return json({ error: 'Database not available' }, { status: 500 });
	}

	const examples = await db
		.prepare(`
			SELECT DISTINCT
				s.ain,
				s.jpn,
				s.dialect as sentence_dialect,
				d.title,
				d.book,
				d.author,
				d.year,
				d.url,
				d.dialect as doc_dialect
			FROM tokens t
			JOIN sentences s ON t.sentence_id = s.id
			JOIN documents d ON s.document_id = d.id
			WHERE t.token = ? OR t.lemma = ?
		`)
		.bind(term, term)
		.all();

	return json({ examples: examples.results });
};
