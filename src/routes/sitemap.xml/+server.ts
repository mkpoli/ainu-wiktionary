import type { RequestHandler } from './$types';
import { baseLocale, locales, localizeUrl } from '$lib/paraglide/runtime';
import { sitemapResponse, sitemapXml } from '$lib/sitemap';

const origin = 'https://wikt.aynu.org';
const localizedHome = (locale: (typeof locales)[number]) => {
	const url = localizeUrl(`${origin}/`, { locale });
	if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/$/, '');
	return url.href;
};
const body = sitemapXml([
	[
		...locales.map((locale) => ({ hreflang: locale, href: localizedHome(locale) })),
		{ hreflang: 'x-default', href: localizedHome(baseLocale) }
	]
]);

export const GET: RequestHandler = ({ url }) => sitemapResponse(body, url);
