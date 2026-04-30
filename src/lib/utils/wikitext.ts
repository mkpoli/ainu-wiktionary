import { escapeAinuAffixTerm } from './ainuEtymology';

export type PartOfSpeech =
	| 'noun'
	| 'proper_noun'
	| 'verb'
	| 'adj'
	| 'adv'
	| 'postadv'
	| 'adnominal'
	| 'numeral'
	| 'participle'
	| 'aux'
	| 'particle'
	| 'pron'
	| 'prep'
	| 'conj'
	| 'interj'
	| 'root'
	| 'prefix'
	| 'suffix'
	| 'colloc';

export interface LinkMeta {
	term: string;
	alt?: string;
	tran?: string;
	dialects?: string[];
	tr?: string;
	ts?: string;
	g?: string;
	id?: string;
	pos?: string;
	lit?: string;
	type?: string;
	q?: string;
	qq?: string;
	l?: string;
	ll?: string;
	infl?: string;
	ref?: string;
	lang?: string;
	sc?: string;
}

export interface AffixTemplateOptions {
	pos?: string;
	lit?: string;
	sort?: string;
	sc?: string;
	nocat?: string;
	type?: string;
	nocap?: string;
	notext?: string;
}

export interface Definition {
	gloss: string;
	examples?: Example[];
}

export interface Example {
	id?: string;
	text: string;
	translation: string;
	highlightedTranslationIndexes?: number[];
	highlightedTranslationParts?: string[];
	transliteration?: string;
	ref?: string;
	source?: {
		raw?: string;
		template?: string;
		extraParams?: string;
		author?: string;
		title?: string;
		book?: string;
		publisher?: string;
		year?: string;
		url?: string;
	};
}

function renderReferenceTemplate(source: NonNullable<Example['source']>, refName?: string): string {
	const publisher = source.publisher ?? source.book;
	const template = source.template?.trim() || (source.url || publisher ? 'citation' : 'Cite book');
	const params: string[] = [];

	if (template === 'Cite book') {
		if (source.title) params.push(`title=${escapeTemplateNamedValue(source.title)}`);
		if (source.author) params.push(`author=${escapeTemplateNamedValue(source.author)}`);
		if (source.year) params.push(`year=${source.year}`);
		if (publisher) params.push(`publisher=${escapeTemplateNamedValue(publisher)}`);
		if (source.url) params.push(`url=${escapeTemplateNamedValue(source.url)}`);
	} else if (template === 'Cite web') {
		if (source.title) params.push(`title=${escapeTemplateNamedValue(source.title)}`);
		if (source.author) params.push(`author=${escapeTemplateNamedValue(source.author)}`);
		if (source.url) params.push(`url=${escapeTemplateNamedValue(source.url)}`);
		if (source.year) params.push(`date=${source.year}`);
		if (publisher) params.push(`website=${escapeTemplateNamedValue(publisher)}`);
	} else {
		if (source.author) params.push(`author=${escapeTemplateNamedValue(source.author)}`);
		if (source.title) params.push(`title=${escapeTemplateNamedValue(source.title)}`);
		if (publisher) params.push(`publisher=${escapeTemplateNamedValue(publisher)}`);
		if (source.year) params.push(`year=${source.year}`);
		if (source.url) params.push(`url=${escapeTemplateNamedValue(source.url)}`);
	}

	params.push(...parseAdditionalTemplateParams(source.extraParams));

	const nameAttr = refName ? ` name="${refName}"` : '';
	return `<ref${nameAttr}>{{${template}|${params.join('|')}}}</ref>`;
}

export interface AinuEntry {
	lemma: string;
	accentPosition?: number;
	pos: PartOfSpeech;
	pos_args?: {
		transitivity?: 0 | 1 | 2 | 3 | 4; // 0: impersonal/avalent, 1: intransitive/monovalent, 2: monotransitive/divalent, 3: ditransitive/trivalent, 4: tritransitive/quadrivalent
		plural?: string;
		possessive?: string | string[];
	};
	sub_type?: string;
	etymology?: LinkMeta[];
	etymologyOptions?: AffixTemplateOptions;
	alternatives?: LinkMeta[];
	derived?: LinkMeta[];
	related?: LinkMeta[];
	synonyms?: LinkMeta[];
	antonyms?: LinkMeta[];
	dialects?: string[];
	usage?: string;
	definitions: Definition[];
	declension?: {
		forms: string[];
		alienable?: boolean;
	};
	pronunciation?: {
		ipa?: boolean;
		accentKnown?: boolean;
	};
	addSeparator?: boolean;
}

export type AinuFormEntry =
	| {
			kind: 'alternative';
			lemma: string;
			sourceLemma: string;
			pos: PartOfSpeech;
			gloss?: string;
			accentPosition?: number;
			addSeparator?: boolean;
	  }
	| {
			kind: 'verbPlural';
			lemma: string;
			sourceLemma: string;
			gloss?: string;
			accentPosition?: number;
			addSeparator?: boolean;
	  }
	| {
			kind: 'possessed';
			lemma: string;
			sourceLemma: string;
			gloss?: string;
			sourceTerms?: FormSourceTerm[];
			accentPosition?: number;
			addSeparator?: boolean;
	  };

export type FormSourceTerm = {
	lemma: string;
	gloss?: string;
};

export interface Style {
	space_in_headings: boolean;
	empty_line_after_headings: boolean;
	empty_line_before_headings: boolean;
}

export const STYLE_JA: Style = {
	space_in_headings: false,
	empty_line_after_headings: false,
	empty_line_before_headings: false
};

export const STYLE_EN: Style = {
	space_in_headings: false,
	empty_line_after_headings: false,
	empty_line_before_headings: true
};

// Helper to format header string
function formatHeaderString(level: number, title: string, style: Style): string {
	const eq = '='.repeat(level);
	const space = style.space_in_headings ? ' ' : '';
	let h = `${eq}${space}${title}${space}${eq}`;
	if (style.empty_line_after_headings) {
		h += '\n';
	}
	return h;
}

// Helper to push header to parts with correct spacing
function pushHeader(parts: string[], level: number, title: string, style: Style) {
	if (style.empty_line_before_headings && parts.length > 0) {
		parts.push('');
	}
	parts.push(formatHeaderString(level, title, style));
}

// TODO: Implement WASM/Vibrato based sentence formatting
export function format_sentence(sentence: string): string {
	// Placeholder for future implementation
	return sentence;
}

export interface HeadwordSegment {
	text: string;
	isHeadword: boolean;
}

export interface TranslationSegment {
	text: string;
	index: number | null;
	isWordLike: boolean;
	isHighlighted: boolean;
}

let japaneseWordSegmenter: Intl.Segmenter | null | undefined;

function getJapaneseWordSegmenter(): Intl.Segmenter | null {
	if (japaneseWordSegmenter !== undefined) return japaneseWordSegmenter;
	if (typeof Intl === 'undefined' || typeof Intl.Segmenter === 'undefined') {
		japaneseWordSegmenter = null;
		return japaneseWordSegmenter;
	}
	japaneseWordSegmenter = new Intl.Segmenter('ja', { granularity: 'word' });
	return japaneseWordSegmenter;
}

export function segmentJapaneseTranslation(text: string): TranslationSegment[] {
	if (!text) return [];
	const normalizedText = text.normalize('NFC');

	const segmenter = getJapaneseWordSegmenter();
	if (!segmenter) {
		let wordIndex = 0;
		return normalizedText
			.split(/(\s+)/)
			.filter((segment) => segment.length > 0)
			.map((segment) => ({
				text: segment,
				index: /\s+/.test(segment) ? null : wordIndex++,
				isWordLike: !/\s+/.test(segment),
				isHighlighted: false
			}));
	}

	const segments: TranslationSegment[] = [];
	let wordIndex = 0;
	for (const segment of segmenter.segment(normalizedText)) {
		const isWordLike = Boolean(segment.isWordLike);
		segments.push({
			text: segment.segment,
			index: isWordLike ? wordIndex++ : null,
			isWordLike,
			isHighlighted: false
		});
	}
	return segments;
}

export function highlightTranslationSegments(
	translation: string,
	highlightedIndexes: number[] | undefined,
	legacyHighlightedParts?: string[] | undefined
): TranslationSegment[] {
	const baseSegments = segmentJapaneseTranslation(translation);
	if (baseSegments.length === 0) return [];

	const highlightedIndexSet = new Set<number>(highlightedIndexes ?? []);
	if ((!highlightedIndexes || highlightedIndexes.length === 0) && legacyHighlightedParts?.length) {
		const remainingLegacyParts = [...legacyHighlightedParts];
		for (const segment of baseSegments) {
			if (!segment.isWordLike || segment.index === null) continue;
			const legacyIndex = remainingLegacyParts.findIndex((part) => part === segment.text);
			if (legacyIndex === -1) continue;
			highlightedIndexSet.add(segment.index);
			remainingLegacyParts.splice(legacyIndex, 1);
		}
	}

	const highlightedSegments = baseSegments.map((segment) => ({
		...segment,
		isHighlighted:
			segment.isWordLike && segment.index !== null && highlightedIndexSet.has(segment.index)
	}));

	const mergedSegments: TranslationSegment[] = [];
	for (const segment of highlightedSegments) {
		const previous = mergedSegments[mergedSegments.length - 1];
		if (previous && previous.isHighlighted === segment.isHighlighted) {
			previous.text += segment.text;
			continue;
		}
		mergedSegments.push({ ...segment });
	}

	return mergedSegments;
}

export function highlightTranslationInExample(
	translation: string,
	highlightedIndexes: number[] | undefined,
	legacyHighlightedParts?: string[] | undefined
): string {
	return highlightTranslationSegments(translation, highlightedIndexes, legacyHighlightedParts)
		.map((segment) => (segment.isHighlighted ? `'''${segment.text}'''` : segment.text))
		.join('');
}

function escapeTemplatePositionalValue(value: string): string {
	return value.replaceAll('=', '{{=}}');
}

function escapeTemplateNamedValue(value: string): string {
	return value.replaceAll('|', '{{!}}').replaceAll('=', '{{=}}');
}

function hasExplicitAccent(value: string): boolean {
	return value.normalize('NFD').includes('\u0301');
}

function parseAdditionalTemplateParams(value?: string): string[] {
	if (!value?.trim()) return [];
	return value
		.split('|')
		.map((part) => part.trim())
		.filter(Boolean);
}

function isQuoteTemplate(template?: string): boolean {
	return template?.trim().toLowerCase().startsWith('quote') ?? false;
}

const SENTOKU_LETTERS_BOOK = '千徳太郎治のピウスツキ宛書簡';
const SENTOKU_LETTERS_CITATION =
	'{{citation|author2=丹菊 逸治|author1=荻原 眞子|chapter=第1の手紙|title=千徳太郎治のピウスツキ宛書簡|journal=千葉大学 ユーラシア言語文化論集|volume=4|date=2001|pages=187-226|url=https://opac.ll.chiba-u.jp/da/curator/900023326/}}';

const SENTOKU_CYRILLIC_TEXTS: Record<string, string> = {
	'nani hospi sonko cokay omante rusuy yahka': 'нані хосьбі сонко цокай оманде русуй яхка',
	'kampi omante yahka nispa oman hemaka te': 'кампі оманде яхка нисьпа оман хемакаде'
};

const ASAI_TAKE_BOOK = '浅井タケ昔話全集 I, II';
const ASAI_TAKE_CITATION =
	'{{citation|author=浅井 タケ|editor=村崎 恭子|editor2=峰岸 真琴|title=浅井タケ昔話全集|publisher=大阪学院大学情報学部|date=2001-03|series=ELPR publication series|volume=A2-007|id={{NCID|BA52699362}}}}';

function removeApostrophes(value: string): string {
	return value
		.replaceAll("'''", '\u0000BOLD\u0000')
		.replaceAll("'", '')
		.replaceAll('\u0000BOLD\u0000', "'''");
}

function getHighlightedTokenIndexes(text: string): Set<number> {
	const highlightedIndexes = new Set<number>();
	const tokenMatches = text.matchAll(/'''([\p{L}\p{M}\p{N}'-]+)'''|[\p{L}\p{M}\p{N}'-]+/gu);
	let tokenIndex = 0;

	for (const match of tokenMatches) {
		if (match[1]) {
			highlightedIndexes.add(tokenIndex);
		}
		tokenIndex += 1;
	}

	return highlightedIndexes;
}

function applyParallelTokenHighlights(text: string, highlightedParallelText: string): string {
	const highlightedIndexes = getHighlightedTokenIndexes(highlightedParallelText);
	if (highlightedIndexes.size === 0) return text;

	let tokenIndex = 0;
	return text.replace(/[\p{L}\p{M}\p{N}'-]+/gu, (token) => {
		const rendered = highlightedIndexes.has(tokenIndex) ? `'''${token}'''` : token;
		tokenIndex += 1;
		return rendered;
	});
}

function renderSentokuLetterQuoteBook(
	example: Example,
	highlightedText: string,
	highlightedTranslation: string
): string | null {
	if (example.source?.book !== SENTOKU_LETTERS_BOOK) return null;

	const cyrillicText = SENTOKU_CYRILLIC_TEXTS[example.text.trim()];
	if (!cyrillicText) return null;

	const refName = example.id
		? `ain-ex-${example.id.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'ref'}`
		: 'ain-ex-sentoku-letter';
	const chapter = example.source.title || '第1の手紙';
	const originalText = applyParallelTokenHighlights(cyrillicText, highlightedText);
	const qParams = [
		'ain',
		'year=1906',
		'author=[[:w:千徳太郎治|千徳太郎治]]',
		`text=${escapeTemplateNamedValue(originalText)}`,
		'title=千徳太郎治のピウスツキ宛書簡',
		`chapter=${chapter}<ref name="${refName}">${SENTOKU_LETTERS_CITATION}</ref>`,
		`tr=${escapeTemplateNamedValue(highlightedText)}`,
		`t=${escapeTemplateNamedValue(highlightedTranslation)}`,
		'q=樺太アイヌ語'
	];

	return `#* {{quote-book|${qParams.join('|')}}}`;
}

function renderAsaiTakeQuoteBook(
	example: Example,
	highlightedText: string,
	highlightedTranslation: string
): string | null {
	if (example.source?.book !== ASAI_TAKE_BOOK) return null;

	const refName = example.id
		? `ain-ex-${example.id.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'ref'}`
		: 'ain-ex-asai-take';
	const qParams = [
		'ain',
		'author=浅井 タケ',
		'title=浅井タケ昔話全集 I, II',
		example.source.title
			? `chapter=${escapeTemplateNamedValue(example.source.title)}<ref name="${refName}">${ASAI_TAKE_CITATION}</ref>`
			: `ref=<ref name="${refName}">${ASAI_TAKE_CITATION}</ref>`,
		`text=${escapeTemplateNamedValue(highlightedText)}`,
		`tr=${escapeTemplateNamedValue(removeApostrophes(highlightedText))}`,
		`t=${escapeTemplateNamedValue(highlightedTranslation)}`,
		'q=樺太アイヌ語'
	];

	return `#* {{quote-book|${qParams.join('|')}}}`;
}

const AFFIX_GLOBAL_PARAMS: Array<keyof AffixTemplateOptions> = [
	'pos',
	'lit',
	'sort',
	'sc',
	'nocat',
	'type',
	'nocap',
	'notext'
];

const AFFIX_PART_PARAMS: Array<[Exclude<keyof LinkMeta, 'dialects'>, string]> = [
	['alt', 'alt'],
	['tran', 't'],
	['tr', 'tr'],
	['ts', 'ts'],
	['g', 'g'],
	['id', 'id'],
	['pos', 'pos'],
	['lit', 'lit'],
	['type', 'type'],
	['q', 'q'],
	['qq', 'qq'],
	['l', 'l'],
	['ll', 'll'],
	['infl', 'infl'],
	['ref', 'ref'],
	['lang', 'lang'],
	['sc', 'sc']
];

function pushAffixNamedParam(params: string[], name: string, value?: string) {
	if (value !== undefined && value.trim() !== '') {
		params.push(`${name}=${escapeTemplateNamedValue(value.trim())}`);
	}
}

function renderAffixTemplate(etymology: LinkMeta[], options?: AffixTemplateOptions): string {
	const params = ['ain'];
	etymology.forEach((meta) => params.push(escapeAinuAffixTerm(meta.term)));
	AFFIX_GLOBAL_PARAMS.forEach((name) => pushAffixNamedParam(params, name, options?.[name]));
	etymology.forEach((meta, i) => {
		AFFIX_PART_PARAMS.forEach(([key, name]) =>
			pushAffixNamedParam(params, `${name}${i + 1}`, meta[key])
		);
	});
	return `{{affix|${params.join('|')}}}`;
}

function getReusableReferenceName(example: Example): string | null {
	if (!example.id || (!example.ref && !example.source)) return null;
	const reusableInlineRef = example.ref?.trim();
	const reusableRawSource = example.source?.raw?.trim();

	if (reusableInlineRef && /^<ref\b[^>]*\bname\s*=/.test(reusableInlineRef)) {
		return null;
	}

	if (reusableRawSource && /^<ref\b[^>]*\bname\s*=/.test(reusableRawSource)) {
		return null;
	}

	return `ain-ex-${example.id.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'ref'}`;
}

function renderNamedReferenceValue(value: string, refName: string, repeated: boolean): string {
	if (repeated) return `<ref name="${refName}" />`;
	if (/^<ref(?=[\s>])/i.test(value)) {
		return value.replace(/^<ref(?=[\s>])/i, `<ref name="${refName}"`);
	}
	return `<ref name="${refName}">${value}</ref>`;
}

function getRenderedExampleReference(
	example: Example,
	seenReferenceNames: Set<string>
): string | undefined {
	const reusableReferenceName = getReusableReferenceName(example);
	const repeated = reusableReferenceName ? seenReferenceNames.has(reusableReferenceName) : false;

	if (reusableReferenceName && !repeated) {
		seenReferenceNames.add(reusableReferenceName);
	}

	if (example.ref?.trim()) {
		return reusableReferenceName
			? renderNamedReferenceValue(example.ref.trim(), reusableReferenceName, repeated)
			: example.ref.trim();
	}

	const rawReference = example.source?.raw?.trim();
	if (rawReference) {
		return reusableReferenceName
			? renderNamedReferenceValue(rawReference, reusableReferenceName, repeated)
			: rawReference;
	}

	if (example.source) {
		if (reusableReferenceName) {
			return repeated
				? `<ref name="${reusableReferenceName}" />`
				: renderReferenceTemplate(example.source, reusableReferenceName);
		}
		return renderReferenceTemplate(example.source);
	}

	return undefined;
}

export function highlightHeadwordSegments(text: string, lemma: string): HeadwordSegment[] {
	const normalizedLemma = stripAccentAndWhitespace(lemma).toLowerCase();
	if (!normalizedLemma) return [{ text, isHeadword: false }];

	const matches = Array.from(text.matchAll(/[\p{L}\p{M}\p{N}'-]+/gu));
	if (matches.length === 0) return [{ text, isHeadword: false }];

	const segments: HeadwordSegment[] = [];
	let lastIndex = 0;

	for (const match of matches) {
		const token = match[0];
		const index = match.index ?? 0;
		const isHeadword = stripAccentAndWhitespace(token).toLowerCase() === normalizedLemma;

		if (!isHeadword) continue;

		if (index > lastIndex) {
			segments.push({ text: text.slice(lastIndex, index), isHeadword: false });
		}
		segments.push({ text: token, isHeadword: true });
		lastIndex = index + token.length;
	}

	if (segments.length === 0) return [{ text, isHeadword: false }];
	if (lastIndex < text.length) {
		segments.push({ text: text.slice(lastIndex), isHeadword: false });
	}

	return segments;
}

export function highlightHeadwordInExample(text: string, lemma: string): string {
	return highlightHeadwordSegments(text, lemma)
		.map((segment) => (segment.isHeadword ? `'''${segment.text}'''` : segment.text))
		.join('');
}

const COMBINING_ACUTE = /\u0301/g;
const VOWEL_PATTERN = /[aeiou]/i;

export interface AinuLemmaAnalysis {
	pageLemma: string;
	accentedLemma: string;
	accentPosition: number | null;
	defaultAccentPosition: number | null;
	explicitAccent: boolean;
	explicitException: boolean;
}

export interface AinuSyllable {
	text: string;
	index: number;
}

export function stripAccentAndWhitespace(value: string): string {
	return value.normalize('NFD').replace(COMBINING_ACUTE, '').replace(/\s+/g, '').normalize('NFC');
}

function getVowelIndices(value: string): number[] {
	const indices: number[] = [];
	for (let i = 0; i < value.length; i += 1) {
		if (VOWEL_PATTERN.test(value[i])) {
			indices.push(i);
		}
	}
	return indices;
}

export function splitAinuSyllables(rawLemma: string): AinuSyllable[] {
	const lemma = stripAccentAndWhitespace(rawLemma);
	const syllables: AinuSyllable[] = [];
	let index = 0;

	while (index < lemma.length) {
		const start = index;

		while (index < lemma.length && !VOWEL_PATTERN.test(lemma[index])) {
			index += 1;
		}

		if (index >= lemma.length) {
			if (syllables.length > 0) {
				syllables[syllables.length - 1].text += lemma.slice(start);
			} else if (lemma.slice(start)) {
				syllables.push({ text: lemma.slice(start), index: 1 });
			}
			break;
		}

		index += 1;

		let consonantClusterEnd = index;
		while (consonantClusterEnd < lemma.length && !VOWEL_PATTERN.test(lemma[consonantClusterEnd])) {
			consonantClusterEnd += 1;
		}

		const consonantClusterLength = consonantClusterEnd - index;
		if (consonantClusterEnd === lemma.length) {
			index = consonantClusterEnd;
		} else if (consonantClusterLength >= 2) {
			index += 1;
		}

		syllables.push({ text: lemma.slice(start, index), index: syllables.length + 1 });
	}

	return syllables;
}

function getExplicitAccentPosition(value: string): number | null {
	const normalized = value.normalize('NFD').replace(/\s+/g, '');
	let syllableIndex = 0;
	for (let i = 0; i < normalized.length; i += 1) {
		const char = normalized[i];
		if (VOWEL_PATTERN.test(char)) {
			syllableIndex += 1;
			if (normalized[i + 1] === '\u0301') {
				return syllableIndex;
			}
		}
	}
	return null;
}

function getDefaultAccentPosition(pageLemma: string): number | null {
	const vowelIndices = getVowelIndices(pageLemma);
	if (vowelIndices.length === 0) return null;
	if (vowelIndices.length === 1) return 1;

	const firstVowelIndex = vowelIndices[0];
	const secondVowelIndex = vowelIndices[1];
	const interveningConsonantCount = secondVowelIndex - firstVowelIndex - 1;

	if (interveningConsonantCount >= 2) {
		return 1;
	}

	return 2;
}

function normalizeAccentPosition(pageLemma: string, accentPosition?: number | null): number | null {
	if (accentPosition === undefined || accentPosition === null) return null;
	const syllableCount = getVowelIndices(pageLemma).length;
	if (accentPosition < 1 || accentPosition > syllableCount) {
		return null;
	}
	return accentPosition;
}

function applyAccentToSyllable(pageLemma: string, accentPosition: number | null): string {
	if (!accentPosition) return pageLemma;

	let syllableIndex = 0;
	for (let i = 0; i < pageLemma.length; i += 1) {
		if (!VOWEL_PATTERN.test(pageLemma[i])) continue;
		syllableIndex += 1;
		if (syllableIndex === accentPosition) {
			return `${pageLemma.slice(0, i + 1)}\u0301${pageLemma.slice(i + 1)}`.normalize('NFC');
		}
	}

	return pageLemma;
}

export function analyzeAinuLemma(
	rawLemma: string,
	explicitAccentPosition?: number | null
): AinuLemmaAnalysis {
	const pageLemma = stripAccentAndWhitespace(rawLemma);
	const defaultAccentPosition = getDefaultAccentPosition(pageLemma);
	const normalizedExplicitAccentPosition = normalizeAccentPosition(
		pageLemma,
		explicitAccentPosition
	);
	const accentFromLemma = getExplicitAccentPosition(rawLemma);
	const explicitAccentPositionResolved = normalizedExplicitAccentPosition ?? accentFromLemma;
	const accentPosition = explicitAccentPositionResolved ?? defaultAccentPosition;
	const explicitAccent =
		normalizedExplicitAccentPosition !== null ? true : accentFromLemma !== null;
	const explicitException = explicitAccent && accentPosition !== defaultAccentPosition;

	return {
		pageLemma,
		accentedLemma: applyAccentToSyllable(pageLemma, accentPosition),
		accentPosition,
		defaultAccentPosition,
		explicitAccent,
		explicitException
	};
}

export function renderWikitext(entry: AinuEntry, locale: string = 'ja'): string {
	const isEn = locale === 'en';
	const style = isEn ? STYLE_EN : STYLE_JA;
	const parts: string[] = [];
	const lemma = analyzeAinuLemma(entry.lemma, entry.accentPosition);
	const verbTransitivity = entry.pos === 'verb' ? entry.pos_args?.transitivity : undefined;
	const accentKnown = entry.pronunciation?.accentKnown !== false;
	const hasReferences =
		entry.definitions.some((def) =>
			(def.examples ?? []).some((ex) => Boolean(ex.ref || ex.source))
		) || Boolean(entry.usage?.includes('<ref>'));
	const seenReferenceNames = new Set<string>();

	// 1. Header & Script
	if (isEn) {
		pushHeader(parts, 2, 'Ainu', style);
	} else {
		pushHeader(parts, 2, '{{L|ain}}', style);
		parts.push(`{{ain-kana}}`);
	}

	// 2. Alternative forms
	if (entry.alternatives && entry.alternatives.length > 0) {
		pushHeader(parts, 3, isEn ? 'Alternative forms' : '{{alter}}', style);
		parts.push(renderLinkList(entry.alternatives, locale));
	}

	// 3. Pronunciation
	if (isEn) {
		pushHeader(parts, 3, 'Pronunciation', style);
		parts.push(`* {{IPA|ain|...}}`);
	} else {
		pushHeader(parts, 3, '{{pron}}', style);
		parts.push(
			accentKnown && lemma.accentedLemma && lemma.accentedLemma !== lemma.pageLemma
				? `* {{ain-IPA|${lemma.accentedLemma}}}`
				: `* {{ain-IPA}}`
		);
	}

	if (entry.etymology && entry.etymology.length > 0) {
		pushHeader(parts, 3, isEn ? 'Etymology' : '{{etym}}', style);
		parts.push(renderAffixTemplate(entry.etymology, entry.etymologyOptions));
	}

	// 4. Part of Speech Header
	let posHeader: string = entry.pos;
	if (isEn) {
		const posMap: Record<PartOfSpeech, string> = {
			noun: 'Noun',
			proper_noun: 'Proper noun',
			verb: 'Verb',
			adj: 'Adjective',
			adv: 'Adverb',
			postadv: 'Postpositional adverb',
			adnominal: 'Adnominal',
			numeral: 'Numeral',
			participle: 'Participle',
			aux: 'Auxiliary verb',
			particle: 'Particle',
			pron: 'Pronoun',
			prep: 'Preposition',
			conj: 'Conjunction',
			interj: 'Interjection',
			root: 'Root',
			prefix: 'Prefix',
			suffix: 'Suffix',
			colloc: 'Collocation'
		};
		posHeader = posMap[entry.pos];
		pushHeader(parts, 3, posHeader, style);
	} else {
		pushHeader(parts, 3, getJapanesePosHeader(entry.pos), style);
	}

	// 5. Headword & Context
	let headParams = ['ain'];
	let headTemplate = 'head';

	if (verbTransitivity !== undefined) {
		headTemplate = 'ain-verb';
		headParams = [verbTransitivity.toString()];
		const plural = entry.pos_args?.plural;
		if (plural) {
			headParams.push(`pl=${plural}`);
		}
	} else {
		headParams.push(getHeadwordPosParam(entry.pos));
		const possessive = entry.pos === 'noun' ? entry.pos_args?.possessive : undefined;
		if (possessive) {
			const possessiveForms = Array.isArray(possessive) ? possessive : [possessive];
			headParams.push('所属形');
			possessiveForms.forEach((form, index) => {
				if (index > 0) headParams.push('or');
				headParams.push(form);
			});
		}
	}

	if (accentKnown && lemma.explicitException && lemma.accentedLemma !== lemma.pageLemma) {
		headParams.push(`head=${lemma.accentedLemma}`);
	}

	let headLine = `{{${headTemplate}|${headParams.join('|')}}}`;

	// Context / Subtype
	if (entry.sub_type) {
		headLine += ` {{context|${entry.sub_type}|lang=ain}}`;
	}

	// Dialects
	if (entry.dialects && entry.dialects.length > 0) {
		headLine += ` {{tlb|ain|${entry.dialects.join('|')}}}`;
	}

	parts.push(headLine);

	// 6. Definitions & Examples
	entry.definitions.forEach((def) => {
		parts.push(`# ${def.gloss}`);
		if (def.examples) {
			def.examples.forEach((ex) => {
				const highlightedText = highlightHeadwordInExample(ex.text, entry.lemma);
				const highlightedTranslation = highlightTranslationInExample(
					ex.translation,
					ex.highlightedTranslationIndexes,
					ex.highlightedTranslationParts
				);
				const escapedText = escapeTemplatePositionalValue(highlightedText);
				const escapedTranslation = escapeTemplatePositionalValue(highlightedTranslation);
				const escapedTransliteration = ex.transliteration
					? escapeTemplatePositionalValue(ex.transliteration)
					: undefined;
				const rawReference = ex.source?.raw?.trim();
				const renderedRef = getRenderedExampleReference(ex, seenReferenceNames);
				const specialQuoteBook = renderSentokuLetterQuoteBook(
					ex,
					highlightedText,
					highlightedTranslation
				);
				if (specialQuoteBook) {
					parts.push(specialQuoteBook);
					return;
				}
				const asaiTakeQuoteBook = renderAsaiTakeQuoteBook(
					ex,
					highlightedText,
					highlightedTranslation
				);
				if (asaiTakeQuoteBook) {
					parts.push(asaiTakeQuoteBook);
					return;
				}
				if (isEn) {
					if (ex.ref) {
						let uxParams = `|ain|${escapedText}|${escapedTranslation}`;
						if (escapedTransliteration) uxParams += `|tr=${escapedTransliteration}`;
						if (renderedRef) uxParams += `|ref=${renderedRef}`;
						parts.push(`#: {{ux${uxParams}}}`);
					} else if (rawReference) {
						let quoteParams = `|ain|${escapedText}|${escapedTranslation}`;
						if (escapedTransliteration) quoteParams += `|tr=${escapedTransliteration}`;
						quoteParams += `|ref=${rawReference}`;
						parts.push(`#* {{quote${quoteParams}}}`);
					} else if (ex.source) {
						const structuredTemplate = ex.source.template?.trim();
						if (structuredTemplate && !isQuoteTemplate(structuredTemplate)) {
							let uxParams = `|ain|${escapedText}|${escapedTranslation}`;
							if (escapedTransliteration) uxParams += `|tr=${escapedTransliteration}`;
							if (renderedRef) uxParams += `|ref=${renderedRef}`;
							parts.push(`#: {{ux${uxParams}}}`);
							return;
						}

						const quoteTemplate = structuredTemplate || 'quote-book';
						const qParams = ['ain'];
						if (ex.source.year) qParams.push(`year=${ex.source.year}`);
						if (ex.source.author)
							qParams.push(`author=${escapeTemplateNamedValue(ex.source.author)}`);

						// Determine title and chapter
						// If book is present, use it as title. If title is also present, use it as chapter.
						// If only title is present, use it as title.
						if (ex.source.book) {
							qParams.push(`title=${escapeTemplateNamedValue(ex.source.book)}`);
							if (ex.source.title)
								qParams.push(`chapter=${escapeTemplateNamedValue(ex.source.title)}`);
						} else if (ex.source.title) {
							qParams.push(`title=${escapeTemplateNamedValue(ex.source.title)}`);
						}

						if (ex.source.url) qParams.push(`url=${escapeTemplateNamedValue(ex.source.url)}`);
						qParams.push(...parseAdditionalTemplateParams(ex.source.extraParams));

						qParams.push(`text=${escapeTemplateNamedValue(highlightedText)}`);
						if (ex.transliteration)
							qParams.push(`tr=${escapeTemplateNamedValue(ex.transliteration)}`);
						qParams.push(`t=${escapeTemplateNamedValue(highlightedTranslation)}`);
						parts.push(`#* {{${quoteTemplate}|${qParams.join('|')}}}`);
					} else {
						let uxParams = `|ain|${escapedText}|${escapedTranslation}`;
						if (escapedTransliteration) uxParams += `|tr=${escapedTransliteration}`;
						if (renderedRef) uxParams += `|ref=${renderedRef}`;
						parts.push(`#: {{ux${uxParams}}}`);
					}
				} else {
					let qRef = '';
					if (ex.ref) {
						qRef = `|ref=${ex.ref}`;
					} else if (rawReference) {
						qRef = `|ref=${rawReference}`;
					} else if (renderedRef) {
						qRef = `|ref=${renderedRef}`;
					}
					const qTr = escapedTransliteration ? `|tr=${escapedTransliteration}` : '';
					parts.push(`#* {{quote|ain|${escapedText}|${escapedTranslation}${qTr}${qRef}}}`);
				}
			});
		}
	});

	if (entry.pos === 'noun' && entry.declension?.forms.length) {
		pushHeader(parts, 4, isEn ? 'Declension' : '曲用', style);
		parts.push(renderPossessiveDeclension(entry.declension.forms, entry.declension.alienable));
	}

	if (verbTransitivity !== undefined && verbTransitivity !== 0) {
		pushHeader(parts, 4, isEn ? 'Conjugation' : '{{conjugation}}', style);
		parts.push(verbTransitivity === 1 ? '{{ain-conj-intr}}' : '{{ain-conj-tran}}');
	}

	// 7. Usage
	if (entry.usage) {
		if (isEn) {
			pushHeader(parts, 4, 'Usage', style);
		} else {
			pushHeader(parts, 4, '{{usage}}', style);
		}
		parts.push(entry.usage);
	}

	// 8. Related Terms
	const addRelatedSection = (titleEn: string, templateJa: string, items?: LinkMeta[]) => {
		if (items && items.length > 0) {
			if (isEn) {
				pushHeader(parts, 4, titleEn, style);
			} else {
				pushHeader(parts, 4, `{{${templateJa}}}`, style);
			}

			parts.push(renderLinkList(items, locale));
		}
	};

	addRelatedSection('Derived terms', 'drv', entry.derived);
	addRelatedSection('Related terms', 'rel', entry.related);
	addRelatedSection('Synonyms', 'syn', entry.synonyms);
	addRelatedSection('Antonyms', 'ant', entry.antonyms);

	// 9. References
	if (hasReferences) {
		if (isEn) {
			pushHeader(parts, 3, 'References', style);
			parts.push('{{reflist}}');
		} else {
			pushHeader(parts, 3, '出典', style);
			parts.push('{{Reflist}}');
		}
	}

	if (entry.addSeparator) {
		parts.push('----');
	}

	return parts.join('\n');
}

function renderAinuLink(item: LinkMeta, locale: string): string {
	const rawTerm = item.term.trim();
	const term = hasExplicitAccent(rawTerm) ? stripAccentAndWhitespace(rawTerm) : rawTerm;
	const params = [escapeTemplatePositionalValue(term)];

	if (locale === 'en') {
		let link = item.dialects?.length
			? `{{l/ain|${params[0]}|dialects=${escapeTemplateNamedValue(item.dialects.join(', '))}}}`
			: `{{l|ain|${params[0]}}}`;
		if (item.tran) link += ` (${item.tran})`;
		return link;
	}

	if (item.alt || term !== rawTerm)
		params.push(`alt=${escapeTemplateNamedValue(item.alt ?? rawTerm)}`);
	if (item.tran) params.push(`t=${escapeTemplateNamedValue(item.tran)}`);
	if (item.dialects?.length)
		params.push(`dialects=${escapeTemplateNamedValue(item.dialects.join(', '))}`);

	return `{{l/ain|${params.join('|')}}}`;
}

function renderLinkList(items: LinkMeta[], locale: string): string {
	return items
		.map((item) => {
			const link = renderAinuLink(item, locale);
			return `* ${link}`;
		})
		.join('\n');
}

export function renderFormWikitext(entry: AinuFormEntry, locale: string = 'ja'): string {
	const isEn = locale === 'en';
	const style = isEn ? STYLE_EN : STYLE_JA;
	const parts: string[] = [];
	const lemma = analyzeAinuLemma(entry.lemma, entry.accentPosition);
	const pos =
		entry.kind === 'verbPlural' ? 'verb' : entry.kind === 'possessed' ? 'noun' : entry.pos;

	if (isEn) {
		pushHeader(parts, 2, 'Ainu', style);
	} else {
		pushHeader(parts, 2, '{{L|ain}}', style);
		parts.push('{{ain-kana}}');
	}

	pushHeader(parts, 3, isEn ? 'Pronunciation' : '{{pron}}', style);
	parts.push(
		lemma.accentedLemma && lemma.accentedLemma !== lemma.pageLemma
			? `* {{ain-IPA|${lemma.accentedLemma}}}`
			: '* {{ain-IPA}}'
	);

	pushHeader(parts, 3, isEn ? getEnglishPosHeader(pos) : getJapanesePosHeader(pos), style);
	parts.push(renderFormHeadword(entry, pos, lemma));
	for (const definition of renderFormDefinitions(entry)) {
		parts.push(`# ${definition}`);
	}

	if (entry.addSeparator) {
		parts.push('----');
	}

	return parts.join('\n');
}

function getEnglishPosHeader(pos: PartOfSpeech): string {
	const posMap: Record<PartOfSpeech, string> = {
		noun: 'Noun',
		proper_noun: 'Proper noun',
		verb: 'Verb',
		adj: 'Adjective',
		adv: 'Adverb',
		postadv: 'Postpositional adverb',
		adnominal: 'Adnominal',
		numeral: 'Numeral',
		participle: 'Participle',
		aux: 'Auxiliary verb',
		particle: 'Particle',
		pron: 'Pronoun',
		prep: 'Preposition',
		conj: 'Conjunction',
		interj: 'Interjection',
		root: 'Root',
		prefix: 'Prefix',
		suffix: 'Suffix',
		colloc: 'Collocation'
	};
	return posMap[pos];
}

function getJapanesePosHeader(pos: PartOfSpeech): string {
	const posMap: Record<PartOfSpeech, string> = {
		noun: '{{noun}}',
		proper_noun: '{{name}}',
		verb: '{{verb}}',
		adj: '{{adj}}',
		adv: '{{adv}}',
		postadv: '後置副詞',
		adnominal: '{{adnominal}}',
		numeral: '{{numeral}}',
		participle: '{{participle}}',
		aux: '{{auxverb}}',
		particle: '{{parti}}',
		pron: '{{pronoun}}',
		prep: '{{prep}}',
		conj: '{{conj}}',
		interj: '{{interj}}',
		root: '{{root}}',
		prefix: '{{pref}}',
		suffix: '{{suffix}}',
		colloc: '{{colloc}}'
	};
	return posMap[pos];
}

function getHeadwordPosParam(pos: PartOfSpeech): string {
	const posMap: Record<PartOfSpeech, string> = {
		noun: 'noun',
		proper_noun: '固有名詞',
		verb: 'verb',
		adj: 'adj',
		adv: 'adv',
		postadv: '後置副詞',
		adnominal: 'adnominal',
		numeral: '数詞',
		participle: 'participle',
		aux: 'auxverb',
		particle: 'parti',
		pron: 'pronoun',
		prep: 'prep',
		conj: 'conj',
		interj: 'interj',
		root: 'root',
		prefix: 'prefix',
		suffix: 'suffix',
		colloc: 'colloc'
	};
	return posMap[pos];
}

function renderFormHeadword(
	entry: AinuFormEntry,
	pos: PartOfSpeech,
	lemma: AinuLemmaAnalysis
): string {
	const params = ['ain', getHeadwordPosParam(pos)];
	if (lemma.explicitException && lemma.accentedLemma !== lemma.pageLemma) {
		params.push(`head=${lemma.accentedLemma}`);
	}
	if (entry.kind === 'verbPlural') {
		params.push('cat2=動詞 複数形');
	}
	return `{{head|${params.join('|')}}}`;
}

function renderFormDefinitions(entry: AinuFormEntry): string[] {
	const gloss = entry.gloss ? `|t=${escapeTemplateNamedValue(entry.gloss)}` : '';
	if (entry.kind === 'alternative') {
		return [`{{alternative form of|ain|${entry.sourceLemma}${gloss}}}`];
	}

	const sourceLemma = escapeTemplatePositionalValue(entry.sourceLemma);
	const transliteration = `{{ain-kana-conv|${sourceLemma}}}`;
	if (entry.kind === 'verbPlural') {
		return [`{{verb form of|ain|${sourceLemma}||p|tr=${transliteration}${gloss}}}`];
	}

	const sourceTerms = entry.sourceTerms?.length
		? entry.sourceTerms
		: [{ lemma: entry.sourceLemma, gloss: entry.gloss }];
	return sourceTerms.map((term) => {
		const escapedLemma = escapeTemplatePositionalValue(term.lemma);
		const termTransliteration = `{{ain-kana-conv|${escapedLemma}}}`;
		const termGloss = term.gloss ? `|t=${escapeTemplateNamedValue(term.gloss)}` : '';
		return `{{noun form of|ain|${escapedLemma}||所属形|tr=${termTransliteration}${termGloss}}}`;
	});
}

function renderPossessiveDeclension(forms: string[], alienable = false): string {
	const uniqueForms = [...new Set(forms.map((form) => form.trim()).filter(Boolean))];
	return `{{${alienable ? 'ain-decl-alnb' : 'ain-decl-inal'}|${uniqueForms.join('|')}}}`;
}
