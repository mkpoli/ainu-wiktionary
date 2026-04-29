import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseWiktionaryEntry } from '$lib/utils/wiktionaryEntry';

type WiktionaryParseApiResponse = {
	parse?: {
		wikitext?: string;
	};
	error?: {
		info?: string;
	};
};

export const GET: RequestHandler = async ({ params, fetch, url }) => {
	const term = params.term?.trim();
	if (!term) {
		return json({ error: 'Missing term' }, { status: 400 });
	}

	const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'ja';
	const endpoint = new URL(`https://${locale}.wiktionary.org/w/api.php`);
	endpoint.searchParams.set('action', 'parse');
	endpoint.searchParams.set('page', term);
	endpoint.searchParams.set('prop', 'wikitext');
	endpoint.searchParams.set('format', 'json');
	endpoint.searchParams.set('formatversion', '2');
	endpoint.searchParams.set('origin', '*');

	const response = await globalThis.fetch(endpoint.toString(), {
		headers: {
			accept: 'application/json',
			'user-agent': 'ainu-wiktionary/1.0'
		}
	});
	const responseText = await response.text();

	let payload: WiktionaryParseApiResponse;
	try {
		payload = JSON.parse(responseText) as WiktionaryParseApiResponse;
	} catch {
		return json(
			{
				error: 'Wiktionary API returned a non-JSON response',
				upstreamStatus: response.status,
				upstreamContentType: response.headers.get('content-type'),
				upstreamPreview: responseText.slice(0, 200)
			},
			{ status: 502 }
		);
	}

	const wikitext = payload.parse?.wikitext;

	if (!response.ok || !wikitext) {
		return json(
			{
				error: payload.error?.info ?? 'Failed to fetch Wiktionary entry',
				upstreamStatus: response.status
			},
			{ status: response.ok ? 404 : response.status }
		);
	}

	try {
		const entry = parseWiktionaryEntry(wikitext, term);
		return json({ entry, wikitext });
	} catch (error) {
		return json(
			{
				error:
					error instanceof Error ? error.message : 'Failed to parse Wiktionary entry',
				wikitext
			},
			{ status: 422 }
		);
	}
};
