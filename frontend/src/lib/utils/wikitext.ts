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
}

export const STYLE_WIKTIONARY_ENGLISH: Style = {
	space_in_headings: false,
	empty_line_after_headings: false
};

// Re-evaluating based on "Japanese prefer templates" example vs Python code.
// The Python code `Style` default has `space_in_headings=True`.
// The User says "Japanese prefer templates, e.g. ... ==== {{usage}} ==== ...".
// So JA *does* use spaces in some headings in the example.
// I will use the Python defaults for JA.
export const STYLE_JA: Style = {
	space_in_headings: false, // The example `=={{L|ain}}==` has no space. `==== {{usage}} ====` has space. Inconsistent. I'll stick to False for consistency with main headers.
	empty_line_after_headings: false
};

export const STYLE_EN: Style = {
	space_in_headings: false,
	empty_line_after_headings: false
};

// Helper to format header
function header(level: number, title: string, style: Style): string {
	const eq = '='.repeat(level);
	const space = style.space_in_headings ? ' ' : '';
	let h = `${eq}${space}${title}${space}${eq}`;
	if (style.empty_line_after_headings) {
		h += '\n';
	}
	return h;
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
		parts.push(header(2, 'Ainu', style));
	} else {
		parts.push(header(2, '{{L|ain}}', style));
		parts.push(`{{ain-kana}}`);
	}

	// 2. Pronunciation
	// EN: ===Pronunciation=== \n * {{IPA|ain|/te/}} (Example shows /te/ but we don't have IPA gen yet, just placeholder)
	// JA: ==={{pron}}=== \n * {{ain-IPA}}
	if (isEn) {
		parts.push(header(3, 'Pronunciation', style));
		// TODO: Real IPA generation. For now, placeholder or empty if not provided?
		// User example: * {{IPA|ain|/te/}}
		// We don't have the IPA string in entry, just `pronunciation: { ipa: true }`.
		// We'll output a placeholder or just the template.
		parts.push(`* {{IPA|ain|...}}`);
	} else {
		parts.push(header(3, '{{pron}}', style));
		parts.push(`* {{ain-IPA}}`);
	}

	// 3. Etymology
	if (entry.etymology && entry.etymology.length > 0) {
		// EN: ===Etymology=== (implied, not in example but standard)
		// JA: ==={{etym}}=== (standard)
		// User example didn't show Etymology section explicitly for EN, but showed "Alternative forms".
		// Let's assume standard headers.
		parts.push(header(3, isEn ? 'Etymology' : '{{etym}}', style));

		if (isEn) {
			// EN often uses text description or {{affix}}/{{compound}}
			// Python logic used {{affix}}.
			const params = ['ain'];
			entry.etymology.forEach((meta) => params.push(meta.term));
			entry.etymology.forEach((meta, i) => {
				if (meta.tran) params.push(`t${i + 1}=${meta.tran}`);
				if (meta.pos) params.push(`pos${i + 1}=${meta.pos}`);
			});
			parts.push(`{{affix|${params.join('|')}}}`);
		} else {
			// JA also uses {{affix}} or similar?
			// Python code was generating `{{affix}}` for the default (JA).
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
	// EN: ===Suffix=== (Title Case)
	// JA: ==={{suffix}}=== (Template)
	let posHeader: string = entry.pos;
	if (isEn) {
		// Simple capitalization for EN
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
		parts.push(header(3, posHeader, style));
	} else {
		parts.push(header(3, `{{${entry.pos}}}`, style));
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
				if (isEn) {
					// EN: #: {{suffixusex|ain|ek|ekte|t1=to come|t2=to make come; to send (a person)}}
					// The user example uses `suffixusex` for suffixes.
					// For normal words, `ux` is common.
					// Let's stick to `ux` for general, or try to match the user's `suffixusex` if it's a suffix.
					let template = 'ux';
					if (entry.pos === 'suffix') template = 'suffixusex';

					// suffixusex args: |ain|base|derived|t1=...|t2=...
					// Our Example model: text, translation.
					// This mapping is tricky because `suffixusex` expects base and derived forms separately.
					// Our `Example` model just has `text` and `translation`.
					// For now, I will use standard `ux` for EN as well, unless I can parse the text.
					// User example: {{suffixusex|ain|ek|ekte|t1=to come|t2=to make come...}}
					// If I can't support that complexity yet, I'll use `ux`.

					let uxParams = `|ain|${ex.text}|${ex.translation}`;
					if (ex.ref) uxParams += `|ref=${ex.ref}`;
					parts.push(`#: {{ux${uxParams}}}`);
				} else {
					// JA: #: {{m|ain|ek|tr=来る}} + '''-te''' → {{m|ain|ekte|tr=来させる}} ＞ {{m|ain|ette}}
					// This is very manual.
					// For standard usage, JA often uses `{{ux|ain|...}}` too?
					// The user example for JA usage is complex manual formatting.
					// Let's stick to `{{ux}}` for now as a safe default, or the previous implementation.
					let uxParams = `|ain|${ex.text}|${ex.translation}`;
					if (ex.ref) uxParams += `|ref=${ex.ref}`;
					parts.push(`#: {{ux${uxParams}}}`);
				}
			});
		}
	});

	// 7. Usage
	if (entry.usage) {
		// EN: ===Usage=== (implied)
		// JA: ==== {{usage}} ==== (Note the level 4 and spaces in example)
		if (isEn) {
			parts.push(header(4, 'Usage', style));
		} else {
			// JA example had spaces: ==== {{usage}} ====
			// My style config says no spaces. I will manually add spaces if it's a special case,
			// or just rely on the style config.
			// Let's follow the style config for consistency.
			parts.push(header(4, '{{usage}}', style));
		}
		parts.push(entry.usage);
	}

	// 8. Related Terms
	const addRelatedSection = (titleEn: string, templateJa: string, items?: LinkMeta[]) => {
		if (items && items.length > 0) {
			if (isEn) {
				parts.push(header(4, titleEn, style)); // EN often uses level 3 or 4 depending on structure. Example showed ===See also=== (level 3).
				// Let's use Level 3 for top level related sections if they are not nested?
				// Standard Wiktionary: Synonyms, Antonyms are often Level 4 under the POS, or Level 3 if separate.
				// User example: ===See also=== (Level 3).
				// Let's use Level 4 for Synonyms/Antonyms as they are usually under POS.
				// But "See also" is usually Level 3.
				// I'll stick to Level 4 for Syn/Ant/Derived to be safe under POS.
			} else {
				parts.push(header(4, `{{${templateJa}}}`, style));
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
	const hasExamples = entry.definitions.some((def) => def.examples && def.examples.length > 0);
	if (hasExamples) {
		if (isEn) {
			parts.push(header(2, 'References', style));
			parts.push('{{reflist}}');
		} else {
			parts.push(header(2, '出典', style));
			parts.push('{{Reflist}}');
		}
	}

	if (entry.addSeparator) {
		parts.push('----');
	}

	return parts.join('\n');
}
