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
	ref?: string;
}

export interface AinuEntry {
	lemma: string;
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
	empty_line_before_headings: false,
};

export const STYLE_EN: Style = {
	space_in_headings: false,
	empty_line_after_headings: false,
	empty_line_before_headings: true,
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

export function renderWikitext(entry: AinuEntry, locale: string = 'ja'): string {
	const isEn = locale === 'en';
	const style = isEn ? STYLE_EN : STYLE_JA;
	const parts: string[] = [];

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
		parts.push(`* {{ain-IPA}}`);
	}

	// 3. Etymology
	if (entry.etymology && entry.etymology.length > 0) {
		pushHeader(parts, 3, isEn ? 'Etymology' : '{{etym}}', style);

		if (isEn) {
			const params = ['ain'];
			entry.etymology.forEach((meta) => params.push(meta.term));
			entry.etymology.forEach((meta, i) => {
				if (meta.tran) params.push(`t${i + 1}=${meta.tran}`);
				if (meta.pos) params.push(`pos${i + 1}=${meta.pos}`);
			});
			parts.push(`{{affix|${params.join('|')}}}`);
		} else {
			const params = ['ain'];
			entry.etymology.forEach((meta) => params.push(meta.term));
			entry.etymology.forEach((meta, i) => {
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
			noun: 'Noun', verb: 'Verb', adj: 'Adjective', adv: 'Adverb',
			participle: 'Participle', aux: 'Auxiliary verb', particle: 'Particle',
			pron: 'Pronoun', prep: 'Preposition', conj: 'Conjunction',
			interj: 'Interjection', root: 'Root', prefix: 'Prefix', suffix: 'Suffix'
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
		headParams = [entry.pos_args.transitivity.toString()]
		if (entry.pos_args.plural) {
			headParams.push(`pl=${entry.pos_args.plural}`);
		}
	} else {
		headParams.push(entry.pos);
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
				let uxParams = `|ain|${ex.text}|${ex.translation}`;
				if (ex.ref) uxParams += `|ref=${ex.ref}`;
				parts.push(`#: {{ux${uxParams}}}`);
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

			const listItems = items.map(item => {
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

	// 9. References (EN only)
	if (isEn) {
		pushHeader(parts, 3, 'References', style);
		parts.push('{{reflist}}');
	}

	if (entry.addSeparator) {
		parts.push('----');
	}

	return parts.join('\n');
}
