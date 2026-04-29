import {
	analyzeAinuLemma,
	stripAccentAndWhitespace,
	type AffixTemplateOptions,
	type AinuEntry,
	type Example,
	type LinkMeta,
	type PartOfSpeech
} from './wikitext';

type ParsedTemplate = {
	name: string;
	positional: string[];
	named: Record<string, string>;
};

const POS_HEADER_MAP: Record<string, PartOfSpeech> = {
	noun: 'noun',
	'{{noun}}': 'noun',
	verb: 'verb',
	'{{verb}}': 'verb',
	adjective: 'adj',
	adj: 'adj',
	'{{adj}}': 'adj',
	adverb: 'adv',
	adv: 'adv',
	'{{adv}}': 'adv',
	participle: 'participle',
	'{{participle}}': 'participle',
	auxiliaryverb: 'aux',
	auxiliary: 'aux',
	aux: 'aux',
	'{{aux}}': 'aux',
	particle: 'particle',
	'{{particle}}': 'particle',
	pronoun: 'pron',
	pron: 'pron',
	'{{pron}}': 'pron',
	preposition: 'prep',
	prep: 'prep',
	'{{prep}}': 'prep',
	conjunction: 'conj',
	conj: 'conj',
	'{{conj}}': 'conj',
	interjection: 'interj',
	interj: 'interj',
	'{{interj}}': 'interj',
	root: 'root',
	'{{root}}': 'root',
	prefix: 'prefix',
	'{{prefix}}': 'prefix',
	suffix: 'suffix',
	'{{suffix}}': 'suffix'
};

const RELATED_SECTION_MAP = {
	'{{drv}}': 'derived',
	derivedterms: 'derived',
	'{{rel}}': 'related',
	relatedterms: 'related',
	'{{syn}}': 'synonyms',
	synonyms: 'synonyms',
	'{{ant}}': 'antonyms',
	antonyms: 'antonyms'
} as const;

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

const AFFIX_PART_PARAM_MAP: Record<string, Exclude<keyof LinkMeta, 'dialects'> | 'tran'> = {
	alt: 'alt',
	t: 'tran',
	tr: 'tr',
	ts: 'ts',
	g: 'g',
	id: 'id',
	pos: 'pos',
	lit: 'lit',
	type: 'type',
	q: 'q',
	qq: 'qq',
	l: 'l',
	ll: 'll',
	infl: 'infl',
	ref: 'ref',
	lang: 'lang',
	sc: 'sc'
};

function normalizeHeadingTitle(value: string): string {
	return value.replace(/\s+/g, '').toLowerCase();
}

function decodeTemplateValue(value: string): string {
	return value.replaceAll('{{!}}', '|').replaceAll('{{=}}', '=').trim();
}

function cleanBoldMarkup(value: string): string {
	return value.replaceAll("'''", '').trim();
}

function matchHeading(line: string): { level: number; title: string } | null {
	const trimmed = line.trim();
	const match = trimmed.match(/^(=+)\s*(.*?)\s*\1$/);
	if (!match) return null;
	return { level: match[1].length, title: match[2].trim() };
}

function extractAinuSection(wikitext: string): string[] {
	const lines = wikitext.split(/\r?\n/u);
	let startIndex = -1;

	for (let index = 0; index < lines.length; index += 1) {
		const heading = matchHeading(lines[index]);
		if (!heading || heading.level !== 2) continue;
		const title = normalizeHeadingTitle(heading.title);
		if (title === 'ainu' || title === '{{l|ain}}' || title === '{{ain}}') {
			startIndex = index + 1;
			break;
		}
	}

	if (startIndex === -1) {
		throw new Error('Ainu section not found');
	}

	let endIndex = lines.length;
	for (let index = startIndex; index < lines.length; index += 1) {
		const heading = matchHeading(lines[index]);
		if (heading?.level === 2) {
			endIndex = index;
			break;
		}
	}

	return lines.slice(startIndex, endIndex);
}

function splitTopLevel(value: string, delimiter: string): string[] {
	const parts: string[] = [];
	let current = '';
	let templateDepth = 0;
	let linkDepth = 0;

	for (let index = 0; index < value.length; index += 1) {
		const pair = value.slice(index, index + 2);
		if (pair === '{{') {
			templateDepth += 1;
			current += pair;
			index += 1;
			continue;
		}
		if (pair === '}}') {
			templateDepth = Math.max(0, templateDepth - 1);
			current += pair;
			index += 1;
			continue;
		}
		if (pair === '[[') {
			linkDepth += 1;
			current += pair;
			index += 1;
			continue;
		}
		if (pair === ']]') {
			linkDepth = Math.max(0, linkDepth - 1);
			current += pair;
			index += 1;
			continue;
		}

		if (value[index] === delimiter && templateDepth === 0 && linkDepth === 0) {
			parts.push(current);
			current = '';
			continue;
		}

		current += value[index];
	}

	parts.push(current);
	return parts;
}

function extractTopLevelTemplates(value: string): string[] {
	const templates: string[] = [];
	let depth = 0;
	let startIndex = -1;

	for (let index = 0; index < value.length - 1; index += 1) {
		const pair = value.slice(index, index + 2);
		if (pair === '{{') {
			if (depth === 0) {
				startIndex = index;
			}
			depth += 1;
			index += 1;
			continue;
		}
		if (pair === '}}') {
			depth -= 1;
			if (depth === 0 && startIndex !== -1) {
				templates.push(value.slice(startIndex, index + 2));
				startIndex = -1;
			}
			index += 1;
		}
	}

	return templates;
}

function parseTemplate(templateText: string): ParsedTemplate | null {
	if (!templateText.startsWith('{{') || !templateText.endsWith('}}')) return null;
	const inner = templateText.slice(2, -2);
	const segments = splitTopLevel(inner, '|').map((segment) => segment.trim());
	const [name = '', ...rest] = segments;
	if (!name) return null;

	const positional: string[] = [];
	const named: Record<string, string> = {};

	for (const segment of rest) {
		const equalsIndex = splitTopLevel(segment, '=').length > 1 ? segment.indexOf('=') : -1;
		if (equalsIndex === -1) {
			positional.push(decodeTemplateValue(segment));
			continue;
		}
		const key = segment.slice(0, equalsIndex).trim();
		const value = segment.slice(equalsIndex + 1).trim();
		named[key] = decodeTemplateValue(value);
	}

	return {
		name: name.trim().toLowerCase(),
		positional,
		named
	};
}

function isParsedTemplate(value: ParsedTemplate | null | undefined): value is ParsedTemplate {
	return Boolean(value);
}

function parseAffixTemplate(template: ParsedTemplate): {
	terms: LinkMeta[];
	options?: AffixTemplateOptions;
} {
	const terms: LinkMeta[] = template.positional.slice(1).map((term) => ({ term }));
	const options: AffixTemplateOptions = {};

	for (const [key, value] of Object.entries(template.named)) {
		if (AFFIX_GLOBAL_PARAMS.includes(key as keyof AffixTemplateOptions)) {
			options[key as keyof AffixTemplateOptions] = value;
			continue;
		}

		const match = key.match(/^([a-z]+)(\d+)$/i);
		if (!match) continue;

		const [, rawParamName, rawIndex] = match;
		const paramName = rawParamName.toLowerCase();
		const targetIndex = Number(rawIndex) - 1;
		const mappedParam = AFFIX_PART_PARAM_MAP[paramName];
		if (!mappedParam || !terms[targetIndex]) continue;

		if (mappedParam === 'tran') {
			terms[targetIndex].tran = value;
			continue;
		}

		terms[targetIndex][mappedParam] = value;
	}

	return { terms, options: Object.keys(options).length > 0 ? options : undefined };
}

function parseLinkListItem(line: string): LinkMeta | null {
	const template = extractTopLevelTemplates(line)
		.map(parseTemplate)
		.find((candidate) => candidate?.name === 'l' || candidate?.name === 'l/ain');
	if (!template) return null;
	const term = template.name === 'l/ain' ? template.positional[0] : template.positional[1];
	if ((template.name === 'l' && template.positional[0] !== 'ain') || !term) return null;

	const suffix = line.slice(line.lastIndexOf('}}') + 2).trim();
	const tranMatch = suffix.match(/^\((.*)\)$/);
	const dialects = template.named.dialects
		?.split(',')
		.map((value) => value.trim())
		.filter(Boolean);

	return {
		term,
		dialects: dialects && dialects.length > 0 ? dialects : undefined,
		tran: tranMatch?.[1]?.trim() || undefined
	};
}

function parseInlineAinuLinks(line: string): LinkMeta[] {
	const items: LinkMeta[] = [];

	for (const templateText of extractTopLevelTemplates(line)) {
		const template = parseTemplate(templateText);
		if (!template || template.name !== 'l' || template.positional[0] !== 'ain') continue;
		const startIndex = line.indexOf(templateText);
		const suffix = startIndex === -1 ? '' : line.slice(startIndex + templateText.length);
		const tranMatch = suffix.match(/^「([^」]+)」/);
		items.push({
			term: template.positional[1] ?? '',
			tran: tranMatch?.[1]?.trim() || undefined
		});
	}

	return items.filter((item) => item.term.trim());
}

function parseReferenceValue(value?: string): Pick<Example, 'ref' | 'source'> {
	if (!value?.trim()) return {};
	return { ref: value.trim() };
}

function parseExampleTemplate(line: string): Example | null {
	const template = extractTopLevelTemplates(line).map(parseTemplate).find(isParsedTemplate);
	if (!template) return null;

	if ((template.name === 'quote' || template.name === 'ux') && template.positional[0] === 'ain') {
		const text = cleanBoldMarkup(template.positional[1] ?? '');
		const translation = cleanBoldMarkup(template.positional[2] ?? '');
		if (!text || !translation) return null;
		return {
			text,
			translation,
			transliteration: template.named.tr?.trim() || undefined,
			...parseReferenceValue(template.named.ref)
		};
	}

	if (template.name.startsWith('quote-') && template.positional[0] === 'ain') {
		const text = cleanBoldMarkup(template.named.text ?? '');
		const translation = cleanBoldMarkup(template.named.t ?? '');
		if (!text || !translation) return null;
		return {
			text,
			translation,
			transliteration: template.named.tr?.trim() || undefined,
			source: {
				template: template.name,
				author: template.named.author?.trim() || undefined,
				title: template.named.chapter?.trim() || undefined,
				book: template.named.title?.trim() || undefined,
				year: template.named.year?.trim() || undefined,
				url: template.named.url?.trim() || undefined
			}
		};
	}

	return null;
}

function parseHeadwordLine(line: string): {
	accentPosition?: number;
	transitivity?: 0 | 1 | 2 | 3 | 4;
	plural?: string;
	possessive?: string;
	subType?: string;
	dialects?: string[];
} {
	const templates = extractTopLevelTemplates(line).map(parseTemplate).filter(isParsedTemplate);
	const result: {
		accentPosition?: number;
		transitivity?: 0 | 1 | 2 | 3 | 4;
		plural?: string;
		possessive?: string;
		subType?: string;
		dialects?: string[];
	} = {};

	for (const template of templates) {
		if (template.name === 'head' && template.positional[0] === 'ain') {
			const accentedHead = template.named.head?.trim();
			if (accentedHead) {
				const analysis = analyzeAinuLemma(accentedHead);
				if (analysis.explicitAccent && analysis.accentPosition) {
					result.accentPosition = analysis.accentPosition;
				}
			}
		}

		if (template.name === 'ain-verb') {
			const transitivity = Number(template.positional[0]);
			if ([0, 1, 2, 3, 4].includes(transitivity)) {
				result.transitivity = transitivity as 0 | 1 | 2 | 3 | 4;
			}
			if (template.named.pl?.trim()) {
				result.plural = template.named.pl.trim();
			}
		}

		if (template.name === 'context') {
			const qualifiers = template.positional.filter(Boolean);
			for (const qualifier of qualifiers) {
				const normalizedQualifier = qualifier.trim().toLowerCase();
				if (normalizedQualifier === 'ain') continue;
				if (normalizedQualifier === 'transitive') {
					result.transitivity = result.transitivity ?? 2;
					continue;
				}
				if (normalizedQualifier === 'intransitive') {
					result.transitivity = result.transitivity ?? 1;
					continue;
				}
				result.subType = qualifier.trim() || result.subType;
			}
		}

		if (template.name === 'tlb' && template.positional[0] === 'ain') {
			result.dialects = template.positional
				.slice(1)
				.map((value) => value.trim())
				.filter(Boolean);
		}
	}

	const possessiveMatch = line.match(/\bpossessive\s*=\s*([^|}]+)/i);
	if (possessiveMatch?.[1]) {
		result.possessive = decodeTemplateValue(possessiveMatch[1]);
	}

	return result;
}

export function parseWiktionaryEntry(wikitext: string, pageTitle?: string): AinuEntry {
	const lines = extractAinuSection(wikitext);
	let lemma = '';
	let accentPosition: number | undefined;
	let accentKnown = true;
	let pos: PartOfSpeech | null = null;
	let transitivity: 0 | 1 | 2 | 3 | 4 | undefined;
	let pluralForm = '';
	let possessiveForm = '';
	let subType = '';
	let etymology: LinkMeta[] = [];
	let etymologyOptions: AffixTemplateOptions | undefined;
	let usageLines: string[] = [];
	const definitions: Array<{ gloss: string; examples: Example[] }> = [];
	const alternatives: LinkMeta[] = [];
	const derived: LinkMeta[] = [];
	const related: LinkMeta[] = [];
	const synonyms: LinkMeta[] = [];
	const antonyms: LinkMeta[] = [];
	let dialects: string[] = [];
	let currentSection:
		| 'pronunciation'
		| 'alternatives'
		| 'etymology'
		| 'usage'
		| 'derived'
		| 'related'
		| 'synonyms'
		| 'antonyms'
		| 'pos'
		| null = null;
	let selectedPos = false;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		const heading = matchHeading(line);
		if (heading) {
			const normalizedTitle = normalizeHeadingTitle(heading.title);
			if (heading.level === 3) {
				if (
					normalizedTitle === '{{pron}}' ||
					normalizedTitle === '{{pron|ain}}' ||
					normalizedTitle === 'pronunciation'
				) {
					currentSection = 'pronunciation';
					continue;
				}
				if (normalizedTitle === '{{etym}}' || normalizedTitle === 'etymology') {
					currentSection = 'etymology';
					continue;
				}
				if (normalizedTitle === '{{alter}}' || normalizedTitle === 'alternativeforms') {
					currentSection = 'alternatives';
					continue;
				}

				const nextPos = POS_HEADER_MAP[normalizedTitle];
				if (nextPos) {
					if (selectedPos) break;
					pos = nextPos;
					selectedPos = true;
					currentSection = 'pos';
					continue;
				}
			}

			if (heading.level === 4) {
				if (normalizedTitle === '{{usage}}' || normalizedTitle === 'usage') {
					currentSection = 'usage';
					continue;
				}
				const relatedSection =
					RELATED_SECTION_MAP[normalizedTitle as keyof typeof RELATED_SECTION_MAP];
				if (relatedSection) {
					currentSection = relatedSection;
					continue;
				}
			}

			currentSection = null;
			continue;
		}

		if (!line) {
			if (currentSection === 'usage' && usageLines.length > 0) {
				usageLines.push('');
			}
			continue;
		}

		if (currentSection === 'pronunciation' && line.includes('{{ain-IPA')) {
			const template = extractTopLevelTemplates(line)
				.map(parseTemplate)
				.find((candidate) => candidate?.name === 'ain-ipa');
			const accentedLemma = template?.positional[0]?.trim();
			if (accentedLemma) {
				lemma = stripAccentAndWhitespace(accentedLemma);
				const analysis = analyzeAinuLemma(accentedLemma);
				accentPosition = analysis.explicitAccent
					? (analysis.accentPosition ?? undefined)
					: undefined;
			} else {
				accentKnown = false;
			}
			continue;
		}

		if (currentSection === 'etymology') {
			if (line.includes('{{affix|')) {
				const template = extractTopLevelTemplates(line)
					.map(parseTemplate)
					.find((candidate) => candidate?.name === 'affix');
				if (template?.positional[0] === 'ain') {
					const parsed = parseAffixTemplate(template);
					etymology = parsed.terms;
					etymologyOptions = parsed.options;
				}
			} else if (etymology.length === 0) {
				etymology = parseInlineAinuLinks(line);
			}
			continue;
		}

		if (currentSection === 'pos') {
			if (line.startsWith('{{head|') || line.startsWith('{{ain-verb|')) {
				const headword = parseHeadwordLine(line);
				accentPosition = accentPosition ?? headword.accentPosition;
				transitivity = headword.transitivity ?? transitivity;
				pluralForm = headword.plural ?? pluralForm;
				possessiveForm = headword.possessive ?? possessiveForm;
				subType = headword.subType ?? subType;
				dialects = headword.dialects ?? dialects;
				continue;
			}

			if (line.startsWith('#') && !line.startsWith('#*') && !line.startsWith('#:')) {
				definitions.push({ gloss: line.replace(/^#+\s*/, '').trim(), examples: [] });
				continue;
			}

			if ((line.startsWith('#* ') || line.startsWith('#: ')) && definitions.length > 0) {
				const example = parseExampleTemplate(line.slice(3));
				if (example) {
					definitions[definitions.length - 1].examples.push(example);
				}
				continue;
			}
		}

		if (currentSection === 'usage') {
			usageLines.push(line);
			continue;
		}

		if (currentSection === 'alternatives') {
			if (!line.startsWith('* ')) continue;
			const item = parseLinkListItem(line);
			if (item) alternatives.push(item);
			continue;
		}

		if (
			currentSection === 'derived' ||
			currentSection === 'related' ||
			currentSection === 'synonyms' ||
			currentSection === 'antonyms'
		) {
			if (!line.startsWith('* ')) continue;
			const item = parseLinkListItem(line);
			if (!item) continue;

			if (currentSection === 'derived') derived.push(item);
			if (currentSection === 'related') related.push(item);
			if (currentSection === 'synonyms') synonyms.push(item);
			if (currentSection === 'antonyms') antonyms.push(item);
		}
	}

	if (!lemma) {
		const headTemplateLine = lines.find(
			(line) => line.includes('{{head|') || line.includes('{{ain-verb|')
		);
		if (headTemplateLine) {
			const headTemplate = extractTopLevelTemplates(headTemplateLine)
				.map(parseTemplate)
				.find((template) => template && (template.name === 'head' || template.name === 'ain-verb'));
			const explicitHead = headTemplate?.named.head?.trim();
			lemma = stripAccentAndWhitespace(explicitHead ?? '');
		}
	}

	if (!lemma && pageTitle) {
		lemma = stripAccentAndWhitespace(pageTitle.replaceAll('_', ' '));
	}

	if (!lemma) {
		throw new Error('Could not determine lemma from Wiktionary entry');
	}

	if (!pos) {
		throw new Error('Could not determine part of speech from Wiktionary entry');
	}

	if (definitions.length === 0) {
		throw new Error('No definitions found in Wiktionary entry');
	}

	return {
		lemma,
		accentPosition,
		pos,
		pos_args: {
			transitivity: pos === 'verb' ? transitivity : undefined,
			plural: pos === 'verb' && pluralForm ? pluralForm : undefined,
			possessive: pos === 'noun' && possessiveForm ? possessiveForm : undefined
		},
		sub_type: subType || undefined,
		etymology: etymology.length > 0 ? etymology : undefined,
		etymologyOptions,
		alternatives: alternatives.length > 0 ? alternatives : undefined,
		derived: derived.length > 0 ? derived : undefined,
		related: related.length > 0 ? related : undefined,
		synonyms: synonyms.length > 0 ? synonyms : undefined,
		antonyms: antonyms.length > 0 ? antonyms : undefined,
		dialects: dialects.length > 0 ? dialects : undefined,
		usage: usageLines.join('\n').trim() || undefined,
		definitions: definitions.map((definition) => ({
			gloss: definition.gloss,
			examples: definition.examples.length > 0 ? definition.examples : undefined
		})),
		pronunciation: { ipa: true, accentKnown }
	};
}
