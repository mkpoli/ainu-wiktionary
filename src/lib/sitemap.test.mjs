import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sitemapResponse, sitemapXml } from './sitemap.ts';
import { GET } from '../routes/sitemap.xml/+server.ts';

describe('sitemap', () => {
	it('lists exactly the canonical Japanese and English landing pages', async () => {
		const response = GET({ url: new URL('https://preview.test/sitemap.xml') });
		assert.equal(response.status, 200);
		assert.equal(response.headers.get('Content-Type'), 'application/xml; charset=utf-8');
		assert.match(response.headers.get('Cache-Control'), /public/);
		const xml = await response.text();
		assert.deepEqual(
			[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
			['https://wikt.aynu.org/', 'https://wikt.aynu.org/en']
		);
		assert.equal((xml.match(/hreflang="ja" href="https:\/\/wikt.aynu.org\/"/g) ?? []).length, 2);
		assert.equal((xml.match(/hreflang="en" href="https:\/\/wikt.aynu.org\/en"/g) ?? []).length, 2);
		assert.equal(
			(xml.match(/hreflang="x-default" href="https:\/\/wikt.aynu.org\/"/g) ?? []).length,
			2
		);
		assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'));
		assert.ok(xml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'));
		assert.ok(!xml.includes('<lastmod>'));
	});

	it('rejects empty URL sets and escapes XML', () => {
		assert.throws(() => sitemapXml([]), /URL count/);
		const alternate = { hreflang: 'ja', href: 'https://example.org/?a=1&b="2"' };
		assert.ok(sitemapXml([[alternate]]).includes('?a=1&amp;b=&quot;2&quot;'));
		assert.throws(() => sitemapXml([Array(50_001).fill(alternate)]), /URL count/);
	});

	it('redirects query variants and advertises the sitemap in robots', () => {
		const response = sitemapResponse('', new URL('https://preview.test/sitemap.xml?q=1'));
		assert.equal(response.status, 308);
		assert.equal(response.headers.get('Location'), '/sitemap.xml');
		const robots = readFileSync(new URL('../../static/robots.txt', import.meta.url), 'utf8');
		assert.match(robots, /Disallow:\n/);
		assert.match(robots, /Sitemap: https:\/\/wikt.aynu.org\/sitemap.xml/);
	});
});
