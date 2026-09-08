export interface SitemapAlternate {
	hreflang: string;
	href: string;
}

const escapeXml = (value: string) =>
	value.replace(/[<>&"']/g, (character) => {
		return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]!;
	});

export function sitemapXml(groups: readonly (readonly SitemapAlternate[])[]): string {
	const count = groups.reduce(
		(total, alternates) =>
			total + alternates.filter(({ hreflang }) => hreflang !== 'x-default').length,
		0
	);
	if (count === 0 || count > 50_000) throw new Error('Invalid sitemap URL count');
	const urls = groups.flatMap((alternates) => {
		const links = alternates
			.map(
				({ hreflang, href }) =>
					`\t\t<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}" />`
			)
			.join('\n');
		return alternates
			.filter(({ hreflang }) => hreflang !== 'x-default')
			.map(({ href }) => `\t<url>\n\t\t<loc>${escapeXml(href)}</loc>\n${links}\n\t</url>`);
	});
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
	if (new TextEncoder().encode(body).byteLength > 50 * 1024 * 1024) {
		throw new Error('Sitemap exceeds the uncompressed size limit');
	}
	return body;
}

export function sitemapResponse(body: string, url: URL): Response {
	if (url.search || url.pathname !== '/sitemap.xml') {
		return new Response(null, { status: 308, headers: { Location: '/sitemap.xml' } });
	}
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
