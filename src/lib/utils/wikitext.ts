export type PartOfSpeech =
	| 'noun'
	| 'verb'
	| 'adj'
	| 'adv'
	| 'participle'
	| 'aux'
	| 'particle'
	| 'pron'
	| 'prep'
	| 'conj'
	| 'interj'
	| 'root'
	| 'prefix'
	| 'suffix';

export interface LinkMeta {
	term: string;
	alt?: string;
	tran?: string;
	pos?: string;
}

export interface Definition {
	gloss: string;
	examples?: Example[];
}

export interface Example {
	text: string;
	translation: string;
	transliteration?: string;
	ref?: string;
	source?: {
		template?: 'citation' | 'Cite book' | 'Cite web';
		author?: string;
		title?: string;
		book?: string;
		publisher?: string;
		year?: string;
		url?: string;
	};
}

function renderReferenceTemplate(source: NonNullable<Example['source']>): string {
	const publisher = source.publisher ?? source.book;
	const template = source.template ?? (source.url || publisher ? 'citation' : 'Cite book');
	const params: string[] = [];

	if (template === 'Cite book') {
		if (source.title) params.push(`title=${source.title}`);
		if (source.author) params.push(`author=${source.author}`);
		if (source.year) params.push(`year=${source.year}`);
		if (publisher) params.push(`publisher=${publisher}`);
		if (source.url) params.push(`url=${source.url}`);
	} else if (template === 'Cite web') {
		if (source.title) params.push(`title=${source.title}`);
		if (source.author) params.push(`author=${source.author}`);
		if (source.url) params.push(`url=${source.url}`);
		if (source.year) params.push(`date=${source.year}`);
		if (publisher) params.push(`website=${publisher}`);
	} else {
		if (source.author) params.push(`author=${source.author}`);
		if (source.title) params.push(`title=${source.title}`);
		if (publisher) params.push(`publisher=${publisher}`);
		if (source.year) params.push(`year=${source.year}`);
		if (source.url) params.push(`url=${source.url}`);
	}

	return `<ref>{{${template}|${params.join('|')}}}</ref>`;
}

export interface AinuEntry {
	lemma: string;
	accentPosition?: number;
	pos: PartOfSpeech;
	pos_args?: {
		transitivity?: 0 | 1 | 2 | 3; // 0: complete, 1: intransitive, 2: transitive, 3: ditransitive
		plural?: string;
		possessive?: string;
	};
	sub_type?: string;
	etymology?: LinkMeta[];
	derived?: LinkMeta[];
	related?: LinkMeta[];
	synonyms?: LinkMeta[];
	antonyms?: LinkMeta[];
	dialects?: string[];
	usage?: string;
	definitions: Definition[];
	pronunciation?: {
		ipa?: boolean;
		accentKnown?: boolean;
	};
	addSeparator?: boolean;
}

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

function escapeTemplatePositionalValue(value: string): string {
	return value.replaceAll('=', '{{=}}');
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
	const accentKnown = entry.pronunciation?.accentKnown !== false;
	const hasReferences =
		entry.definitions.some((def) =>
			(def.examples ?? []).some((ex) => Boolean(ex.ref || ex.source))
		) || Boolean(entry.usage?.includes('<ref>'));

	// 1. Header & Script
	if (isEn) {
		pushHeader(parts, 2, 'Ainu', style);
	} else {
		pushHeader(parts, 2, '{{L|ain}}', style);
		parts.push(`{{ain-kana}}`);
	}

	// 2. Pronunciation
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

	// 3. Etymology
	if (entry.etymology && entry.etymology.length > 0) {
		pushHeader(parts, 3, isEn ? 'Etymology' : '{{etym}}', style);

		if (isEn) {
			const params = ['ain'];
			entry.etymology.forEach((meta) => params.push(meta.term));
			entry.etymology.forEach((meta, i) => {
				if (meta.alt) params.push(`alt${i + 1}=${meta.alt}`);
				if (meta.tran) params.push(`t${i + 1}=${meta.tran}`);
				if (meta.pos) params.push(`pos${i + 1}=${meta.pos}`);
			});
			parts.push(`{{affix|${params.join('|')}}}`);
		} else {
			const params = ['ain'];
			entry.etymology.forEach((meta) => params.push(meta.term));
			entry.etymology.forEach((meta, i) => {
				if (meta.alt) params.push(`alt${i + 1}=${meta.alt}`);
				if (meta.tran) params.push(`t${i + 1}=${meta.tran}`);
				if (meta.pos) params.push(`pos${i + 1}=${meta.pos}`);
			});
			parts.push(`{{affix|${params.join('|')}}}`);
		}
	}

	// 4. Part of Speech Header
	let posHeader: string = entry.pos;
	if (isEn) {
		const posMap: Record<string, string> = {
			noun: 'Noun',
			verb: 'Verb',
			adj: 'Adjective',
			adv: 'Adverb',
			participle: 'Participle',
			aux: 'Auxiliary verb',
			particle: 'Particle',
			pron: 'Pronoun',
			prep: 'Preposition',
			conj: 'Conjunction',
			interj: 'Interjection',
			root: 'Root',
			prefix: 'Prefix',
			suffix: 'Suffix'
		};
		posHeader = posMap[entry.pos] || entry.pos;
		pushHeader(parts, 3, posHeader, style);
	} else {
		pushHeader(parts, 3, `{{${entry.pos}}}`, style);
	}

	// 5. Headword & Context
	let headParams = ['ain'];
	let headTemplate = 'head';

	if (entry.pos === 'verb' && entry.pos_args?.transitivity !== undefined) {
		headTemplate = 'ain-verb';
		headParams = [entry.pos_args.transitivity.toString()];
		if (entry.pos_args.plural) {
			headParams.push(`pl=${entry.pos_args.plural}`);
		}
	} else {
		headParams.push(entry.pos);
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
				const escapedText = escapeTemplatePositionalValue(ex.text);
				const escapedTranslation = escapeTemplatePositionalValue(ex.translation);
				const escapedTransliteration = ex.transliteration
					? escapeTemplatePositionalValue(ex.transliteration)
					: undefined;
				const renderedRef = ex.ref
					? ex.ref
					: ex.source
						? renderReferenceTemplate(ex.source)
						: undefined;
				if (isEn) {
					if (ex.ref || ex.source?.template) {
						let uxParams = `|ain|${escapedText}|${escapedTranslation}`;
						if (escapedTransliteration) uxParams += `|tr=${escapedTransliteration}`;
						if (renderedRef) uxParams += `|ref=${renderedRef}`;
						parts.push(`#: {{ux${uxParams}}}`);
					} else if (ex.source) {
						let qParams = ['ain'];
						if (ex.source.year) qParams.push(`year=${ex.source.year}`);
						if (ex.source.author) qParams.push(`author=${ex.source.author}`);
						const sourceTitle = ex.source.book ?? ex.source.publisher;

						// Determine title and chapter
						// If book is present, use it as title. If title is also present, use it as chapter.
						// If only title is present, use it as title.
						if (sourceTitle) {
							qParams.push(`title=${sourceTitle}`);
							if (ex.source.title) qParams.push(`chapter=${ex.source.title}`);
						} else if (ex.source.title) {
							qParams.push(`title=${ex.source.title}`);
						}

						if (ex.source.url) qParams.push(`url=${ex.source.url}`);

						qParams.push(`text=${ex.text}`);
						if (ex.transliteration) qParams.push(`tr=${ex.transliteration}`);
						qParams.push(`t=${ex.translation}`);
						parts.push(`#* {{quote-book|${qParams.join('|')}}}`);
					} else {
						let uxParams = `|ain|${escapedText}|${escapedTranslation}`;
						if (escapedTransliteration) uxParams += `|tr=${escapedTransliteration}`;
						if (renderedRef) uxParams += `|ref=${renderedRef}`;
						parts.push(`#: {{ux${uxParams}}}`);
					}
				} else {
					let qText = escapedText;
					let qTrans = escapedTranslation;
					let qRef = renderedRef ? `|ref=${renderedRef}` : '';
					const qTr = escapedTransliteration ? `|tr=${escapedTransliteration}` : '';
					parts.push(`#* {{quote|ain|${qText}|${qTrans}${qTr}${qRef}}}`);
				}
			});
		}
	});

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

			const listItems = items.map((item) => {
				let link = `{{l|ain|${item.term}}}`;
				if (item.tran) link += ` (${item.tran})`;
				return `* ${link}`;
			});
			parts.push(listItems.join('\n'));
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
