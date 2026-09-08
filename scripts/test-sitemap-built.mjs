import assert from 'node:assert/strict';
import { Server } from '../.svelte-kit/output/server/index.js';
import { manifest } from '../.svelte-kit/output/server/manifest.js';

const server = new Server(manifest);
await server.init({ env: {} });
const get = (path) =>
	server.respond(
		new Request(`https://wikt.aynu.org${path}`, {
			headers: { 'accept-language': 'en', cookie: 'PARAGLIDE_LOCALE=en' }
		}),
		{ getClientAddress: () => '127.0.0.1' }
	);
const response = await get('/sitemap.xml');
assert.equal(response.status, 200);
assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
const xml = await response.text();
assert.deepEqual(
	[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
	['https://wikt.aynu.org/', 'https://wikt.aynu.org/en']
);
for (const [path, locale] of [
	['/', 'ja'],
	['/en', 'en']
]) {
	const page = await get(path);
	assert.equal(page.status, 200, path);
	assert.ok((await page.text()).includes(`<html lang="${locale}">`));
}
for (const path of ['/sitemap.xml?test=1', '/en/sitemap.xml']) {
	const redirect = await get(path);
	assert.equal(redirect.status, 308);
	assert.equal(redirect.headers.get('location'), '/sitemap.xml');
}
console.log(
	`Sitemap integration passed: 2 URLs, ${Buffer.byteLength(xml)} bytes; both localized pages return 200 with correct language.`
);
