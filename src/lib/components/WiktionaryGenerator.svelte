<script lang="ts">
	import { Slider, type SliderValueChangeDetails } from '@ark-ui/svelte/slider';
	import PosSelect from '$lib/components/PosSelect.svelte';
	import { Switch } from '@ark-ui/svelte/switch';
	import {
		analyzeAinuLemma,
		highlightHeadwordSegments,
		highlightTranslationSegments,
		renderWikitext,
		segmentJapaneseTranslation,
		splitAinuSyllables,
		renderFormWikitext,
		stripAccentAndWhitespace,
		type AinuEntry,
		type AinuFormEntry,
		type Definition,
		type PartOfSpeech,
		type LinkMeta,
		type AffixTemplateOptions,
		type Example,
		type TranslationSegment
	} from '$lib/utils/wikitext';
	import {
		applyAinuEtymologyPreset,
		mergeAinuEtymologyTerms,
		parseAinuEtymologyInput,
		splitAinuEtymologyTerm,
		suggestAinuLemmaEtymology
	} from '$lib/utils/ainuEtymology';
	import {
		getPossessiveForms,
		getPossessiveRowsByAnyForm,
		getPossessiveRowsByLemma,
		type PossessiveRow
	} from '$lib/utils/possessive';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { browser } from '$app/environment';

	type CitationMode = 'template' | 'raw';
	type ExampleSourceKind = 'manual' | 'fetched';
	type DefinitionDraft = {
		id: string;
		gloss: string;
	};
	type ManualExampleInput = {
		id: number;
		assignedDefinitionId: string | null;
		text: string;
		translation: string;
		highlightedTranslationIndexes: number[];
		highlightedTranslationParts?: string[];
		transliteration: string;
		referenceMarkup: string;
		citationMode: CitationMode;
		source: {
			raw: string;
			template: string;
			extraParams: string;
			author: string;
			title: string;
			book: string;
			year: string;
			url: string;
		};
	};
	type EtymologyTermInput = LinkMeta & { uid: number };
	type ExampleDraft = Example & {
		id: string;
		assignedDefinitionId: string | null;
		sourceKind: ExampleSourceKind;
	};
	type FetchedExampleResponse = {
		id: string | number;
		ain: string;
		jpn: string;
		author?: string | null;
		title?: string | null;
		book?: string | null;
		date?: string | number | null;
		url?: string | null;
	};
	type GeneratedPage = {
		term: string;
		url: string;
		wikitext: string;
		kind: 'main' | AinuFormEntry['kind'];
		formEntry?: AinuFormEntry;
	};
	type WiktionaryParseResponse = {
		entry: AinuEntry;
		wikitext: string;
	};

	const etymologyGlobalParams: Array<keyof AffixTemplateOptions> = [
		'pos',
		'lit',
		'sort',
		'sc',
		'nocat',
		'type',
		'nocap',
		'notext'
	];
	const etymologyComponentParams: Array<keyof LinkMeta> = [
		'alt',
		'tr',
		'ts',
		'g',
		'id',
		'lit',
		'type',
		'q',
		'qq',
		'l',
		'll',
		'infl',
		'ref',
		'lang',
		'sc'
	];
	const etymologyGlobalParamHelp: Record<keyof AffixTemplateOptions, string> = {
		pos: 'Plural part of speech used in affix categories, separate from per-component posN.',
		lit: 'Literal meaning of the whole derived term.',
		sort: 'Category sort key. Usually unnecessary.',
		sc: 'Script code for the whole template. Usually auto-detected.',
		nocat: 'Set to 1 to suppress categories.',
		type: 'Compound subtype such as bahuvrihi or alliterative.',
		nocap: 'Set to 1 to avoid capitalizing generated type text.',
		notext: 'Set to 1 to suppress generated type text while keeping categories.'
	};
	const etymologyComponentParamHelp: Partial<Record<keyof LinkMeta, string>> = {
		term: 'The component surface linked by {{affix}}.',
		alt: 'Alternative display form for this component.',
		tran: 'Gloss shown after this component, emitted as tN.',
		tr: 'Transliteration for this component.',
		ts: 'Transcription for this component.',
		g: 'Gender or grammar code for this component.',
		id: 'Sense ID for this component and its affix category.',
		pos: 'Clarifying part-of-speech label shown after this component.',
		lit: 'Literal meaning of this component.',
		type: 'Override affix type for this component, e.g. prefix or suffix.',
		q: 'Qualifier shown before this component.',
		qq: 'Qualifier shown after this component.',
		l: 'Labels shown before this component.',
		ll: 'Labels shown after this component.',
		infl: 'Inflection tags shown after this component.',
		ref: 'Reference text shown after this component.',
		lang: 'Language code override for this component.',
		sc: 'Script code override for this component.'
	};

	let nextManualExampleId = 1;
	let nextEtymologyTermId = 1;
	let nextDefinitionId = 1;

	function createEtymologyTerm(term: LinkMeta = { term: '' }): EtymologyTermInput {
		return { ...term, uid: nextEtymologyTermId++ };
	}

	function normalizeEtymologyTerms(terms: LinkMeta[]): EtymologyTermInput[] {
		const normalizedTerms = terms.map((term) => createEtymologyTerm(term));
		return normalizedTerms.length > 0 ? normalizedTerms : [createEtymologyTerm()];
	}

	function stripEtymologyTermUid(term: EtymologyTermInput): LinkMeta {
		const { uid: _uid, ...linkMeta } = term;
		return linkMeta;
	}

	function createDefinitionDraft(gloss: string, id = `def-${nextDefinitionId++}`): DefinitionDraft {
		return { id, gloss };
	}

	function parseDefinitionLines(input: string): string[] {
		return input
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
	}

	function reconcileDefinitionDrafts(
		previous: DefinitionDraft[],
		nextGlosses: string[]
	): DefinitionDraft[] {
		const remaining = previous.map((draft, index) => ({ ...draft, index }));
		return nextGlosses.map((gloss, index) => {
			let matchIndex = remaining.findIndex(
				(draft) => draft.index === index && draft.gloss === gloss
			);
			if (matchIndex === -1) {
				matchIndex = remaining.findIndex((draft) => draft.gloss === gloss);
			}

			if (matchIndex !== -1) {
				const [match] = remaining.splice(matchIndex, 1);
				return { id: match.id, gloss };
			}

			return createDefinitionDraft(gloss);
		});
	}

	function sameDefinitionDrafts(a: DefinitionDraft[], b: DefinitionDraft[]): boolean {
		return (
			a.length === b.length &&
			a.every((draft, index) => draft.id === b[index]?.id && draft.gloss === b[index]?.gloss)
		);
	}

	function filterValidDefinitionId(
		id: string | null | undefined,
		validDefinitionIds: Set<string>
	): string | null {
		return id && validDefinitionIds.has(id) ? id : null;
	}

	function buildDefinitionExampleCounts(
		definitions: DefinitionDraft[],
		examples: ExampleDraft[]
	): Record<string, number> {
		const counts = Object.fromEntries(
			definitions.map((definition) => [definition.id, 0])
		) as Record<string, number>;
		for (const example of examples) {
			if (!example.assignedDefinitionId) continue;
			counts[example.assignedDefinitionId] = (counts[example.assignedDefinitionId] ?? 0) + 1;
		}
		return counts;
	}

	function buildReferenceNumbers(definitions: typeof previewDefinitions): Record<string, number> {
		const seen: Record<string, number> = {};
		let count = 0;
		for (const definition of definitions) {
			for (const example of definition.examples ?? []) {
				if (!formatReferenceLabel(example)) continue;
				const key = getExampleReferenceKey(example);
				if (!(key in seen)) {
					count += 1;
					seen[key] = count;
				}
			}
		}
		return seen;
	}

	function buildPreviewReferenceItems(definitions: typeof previewDefinitions): string[] {
		const seen: Record<string, true> = {};
		const items: string[] = [];
		for (const definition of definitions) {
			for (const example of definition.examples ?? []) {
				const label = formatReferenceLabel(example).trim();
				if (!label) continue;
				const key = getExampleReferenceKey(example);
				if (seen[key]) continue;
				seen[key] = true;
				items.push(label);
			}
		}
		return items;
	}

	function createManualExample(id = nextManualExampleId++): ManualExampleInput {
		return {
			id,
			assignedDefinitionId: null,
			text: '',
			translation: '',
			highlightedTranslationIndexes: [],
			transliteration: '',
			referenceMarkup: '',
			citationMode: 'template',
			source: {
				raw: '',
				template: '',
				extraParams: '',
				author: '',
				title: '',
				book: '',
				year: '',
				url: ''
			}
		};
	}

	function normalizeManualExampleInput(
		value: Partial<ManualExampleInput> & {
			id?: number;
			ref?: string;
			referenceMode?: CitationMode;
			source?: Partial<ManualExampleInput['source']> & { publisher?: string };
		}
	): ManualExampleInput {
		const source: Partial<ManualExampleInput['source']> & { publisher?: string } =
			value.source ?? {};
		const referenceMarkup = value.referenceMarkup ?? value.ref ?? source.raw ?? '';
		return {
			...createManualExample(value.id),
			...value,
			assignedDefinitionId:
				typeof value.assignedDefinitionId === 'string' ? value.assignedDefinitionId : null,
			highlightedTranslationIndexes: Array.isArray(value.highlightedTranslationIndexes)
				? value.highlightedTranslationIndexes.filter(
						(index): index is number => Number.isInteger(index) && index >= 0
					)
				: [],
			highlightedTranslationParts: Array.isArray(value.highlightedTranslationParts)
				? value.highlightedTranslationParts.filter(
						(part): part is string => typeof part === 'string' && part.trim().length > 0
					)
				: undefined,
			transliteration: value.transliteration ?? '',
			referenceMarkup,
			citationMode:
				value.citationMode ?? value.referenceMode ?? (referenceMarkup.trim() ? 'raw' : 'template'),
			source: {
				raw: source.raw ?? '',
				template: source.template ?? '',
				extraParams: source.extraParams ?? '',
				author: source.author ?? '',
				title: source.title ?? '',
				book: source.book ?? source.publisher ?? '',
				year: source.year ?? '',
				url: source.url ?? ''
			}
		};
	}

	function resetEntryExamples() {
		const emptyExample = createManualExample();
		manualExamples = [emptyExample];
		openManualExampleIds = [emptyExample.id];
		fetchedExamples = [];
		showFetchedExamples = false;
		showManualExamples = true;
		selectedUnassignedExampleIds = [];
		fetchedExampleAssignments = {};
		fetchedExampleHighlightedTranslationIndexes = {};
		fetchedExampleHighlightedTranslationParts = {};
	}

	function createManualExampleFromParsedExample(
		example: Example,
		assignedDefinitionId: string | null
	): ManualExampleInput {
		const manualExample = createManualExample();
		return {
			...manualExample,
			assignedDefinitionId,
			text: example.text,
			translation: example.translation,
			highlightedTranslationIndexes: example.highlightedTranslationIndexes ?? [],
			highlightedTranslationParts: example.highlightedTranslationParts,
			transliteration: example.transliteration ?? '',
			referenceMarkup: example.ref ?? example.source?.raw ?? '',
			citationMode: example.ref || example.source?.raw ? 'raw' : 'template',
			source: {
				raw: example.source?.raw ?? '',
				template: example.source?.template ?? '',
				extraParams: example.source?.extraParams ?? '',
				author: example.source?.author ?? '',
				title: example.source?.title ?? '',
				book: example.source?.book ?? example.source?.publisher ?? '',
				year: example.source?.year ?? '',
				url: example.source?.url ?? ''
			}
		};
	}

	function formatLinkMetaList(items: LinkMeta[] | undefined): string {
		return (items ?? [])
			.map((item) => {
				const params = [escapeTemplatePositionalValue(item.term)];
				if (item.alt) params.push(`alt=${escapeTemplateNamedValue(item.alt)}`);
				if (item.tran) params.push(`t=${escapeTemplateNamedValue(item.tran)}`);
				if (item.dialects?.length)
					params.push(`dialects=${escapeTemplateNamedValue(item.dialects.join(', '))}`);
				return `{{l/ain|${params.join('|')}}}`;
			})
			.join(', ');
	}

	function escapeTemplatePositionalValue(value: string): string {
		return value.replaceAll('=', '{{=}}');
	}

	function escapeTemplateNamedValue(value: string): string {
		return value.replaceAll('|', '{{!}}').replaceAll('=', '{{=}}');
	}

	function parseTemplateParams(value: string): {
		positional: string[];
		named: Record<string, string>;
	} {
		const segments: string[] = [];
		let current = '';
		let templateDepth = 0;

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
			if (value[index] === '|' && templateDepth === 0) {
				segments.push(current);
				current = '';
				continue;
			}
			current += value[index];
		}

		segments.push(current);
		const positional: string[] = [];
		const named: Record<string, string> = {};

		for (const rawSegment of segments) {
			const trimmedSegment = rawSegment.trim();
			const equalsIndex = getTopLevelEqualsIndex(trimmedSegment);
			const segment = trimmedSegment.replaceAll('{{=}}', '=').replaceAll('{{!}}', '|');
			if (equalsIndex === -1) {
				positional.push(segment);
				continue;
			}
			named[trimmedSegment.slice(0, equalsIndex).trim()] = trimmedSegment
				.slice(equalsIndex + 1)
				.trim()
				.replaceAll('{{=}}', '=')
				.replaceAll('{{!}}', '|');
		}

		return { positional, named };
	}

	function getTopLevelEqualsIndex(value: string): number {
		let templateDepth = 0;
		for (let index = 0; index < value.length; index += 1) {
			const pair = value.slice(index, index + 2);
			if (pair === '{{') {
				templateDepth += 1;
				index += 1;
				continue;
			}
			if (pair === '}}') {
				templateDepth = Math.max(0, templateDepth - 1);
				index += 1;
				continue;
			}
			if (value[index] === '=' && templateDepth === 0) return index;
		}
		return -1;
	}

	function applyParsedEntry(parsedEntry: AinuEntry) {
		lemma = stripAccentAndWhitespace(parsedEntry.lemma);
		manualAccentPosition =
			parsedEntry.pronunciation?.accentKnown === false ? undefined : parsedEntry.accentPosition;
		accentUnknown = parsedEntry.pronunciation?.accentKnown === false;
		pos = parsedEntry.pos;
		transitivityCode = parsedEntry.pos_args?.transitivity ?? 2;
		pluralForm = parsedEntry.pos_args?.plural ?? '';
		possessiveForm = Array.isArray(parsedEntry.pos_args?.possessive)
			? parsedEntry.pos_args.possessive.join(', ')
			: (parsedEntry.pos_args?.possessive ?? '');
		subType = parsedEntry.sub_type ?? '';
		etymologyTerms = normalizeEtymologyTerms(parsedEntry.etymology ?? []);
		etymologyOptions = parsedEntry.etymologyOptions ?? {};
		etymologyQuickParse = '';
		definitionDrafts = parsedEntry.definitions.map((definition) =>
			createDefinitionDraft(definition.gloss)
		);
		definitionsInput = parsedEntry.definitions.map((definition) => definition.gloss).join('\n');
		usageInput = parsedEntry.usage ?? '';
		alternativeFormInput = formatLinkMetaList(parsedEntry.alternatives);
		dialectsInput = (parsedEntry.dialects ?? []).join(', ');
		derivedInput = formatLinkMetaList(parsedEntry.derived);
		relatedInput = formatLinkMetaList(parsedEntry.related);
		synonymsInput = formatLinkMetaList(parsedEntry.synonyms);
		antonymsInput = formatLinkMetaList(parsedEntry.antonyms);
		addSeparator = parsedEntry.addSeparator ?? false;
		resetEntryExamples();

		const assignedExamples: ManualExampleInput[] = [];
		parsedEntry.definitions.forEach((definition: Definition, index: number) => {
			const definitionId = definitionDrafts[index]?.id ?? null;
			for (const example of definition.examples ?? []) {
				assignedExamples.push(createManualExampleFromParsedExample(example, definitionId));
			}
		});

		if (assignedExamples.length > 0) {
			manualExamples = assignedExamples;
			openManualExampleIds = assignedExamples.map((example) => example.id);
		}
	}

	async function parseWiktionaryEntryForLemma() {
		const term = lemmaAnalysis.pageLemma || stripAccentAndWhitespace(lemma);
		if (!term) {
			wiktionaryParseError = 'Enter a lemma first.';
			return;
		}

		isParsingWiktionaryEntry = true;
		wiktionaryParseError = '';

		try {
			const response = await fetch(
				`/api/wiktionary/${encodeURIComponent(term)}?locale=${encodeURIComponent(getLocale())}`
			);
			const payload = (await response.json()) as
				| WiktionaryParseResponse
				| { error?: string; wikitext?: string };

			if (!response.ok || !('entry' in payload)) {
				const message = 'error' in payload ? payload.error : undefined;
				throw new Error(message || 'Failed to parse Wiktionary entry');
			}

			applyParsedEntry(payload.entry);
		} catch (error) {
			wiktionaryParseError =
				error instanceof Error ? error.message : 'Failed to parse Wiktionary entry';
		} finally {
			isParsingWiktionaryEntry = false;
		}
	}

	let lemma = $state('');
	let manualAccentPosition = $state<number | undefined>();
	let accentUnknown = $state(false);
	let pos = $state<PartOfSpeech>('noun');
	let alternativeFormInput = $state('');

	// Verb specific
	let transitivityCode = $state<0 | 1 | 2 | 3 | 4>(2);
	let pluralForm = $state('');

	// Noun specific
	let possessiveForm = $state('');
	let lastAutomaticPossessiveForm = $state('');
	let possessiveAlienable = $state(false);

	// General
	let subType = $state('');
	let etymologyTerms = $state<EtymologyTermInput[]>([createEtymologyTerm()]);
	let etymologyOptions = $state<AffixTemplateOptions>({});
	let etymologyQuickParse = $state('');
	let etymologySplitInputs = $state<Record<number, string>>({});
	let draggedEtymologyIndex = $state<number | null>(null);
	let etymologyDropIndex = $state<number | null>(null);
	let definitionsInput = $state('');
	let definitionDrafts = $state<DefinitionDraft[]>([]);
	let usageInput = $state('');
	let dialectsInput = $state('');

	let manualExamples = $state<ManualExampleInput[]>([createManualExample()]);

	// Related Terms
	let derivedInput = $state('');
	let relatedInput = $state('');
	let synonymsInput = $state('');
	let antonymsInput = $state('');

	let addSeparator = $state(false);
	let entrySeparators = $state<Record<string, boolean>>({});
	let outputTab = $state<'code' | 'preview'>('code');
	let showOnlyUnassignedExamples = $state(false);
	let selectedUnassignedExampleIds = $state<string[]>([]);
	let openManualExampleIds = $state<number[]>([1]);
	let fetchedExampleAssignments = $state<Record<string, string | null>>({});
	let fetchedExampleHighlightedTranslationIndexes = $state<Record<string, number[]>>({});
	let fetchedExampleHighlightedTranslationParts = $state<Record<string, string[]>>({});
	let fetchedExampleMinWords = $state(7);
	let fetchedExampleMaxWords = $state(28);
	let showHiddenFetchedExamples = $state(false);

	let copiedPageKey = $state<string | null>(null);
	let isParsingWiktionaryEntry = $state(false);
	let wiktionaryParseError = $state('');

	let loaded = false;
	$effect(() => {
		if (!browser) return;
		if (!loaded) {
			const saved = sessionStorage.getItem('wiktionary_state');
			if (saved) {
				try {
					const data = JSON.parse(saved);
					if (data.lemma !== undefined) lemma = data.lemma;
					if (data.manualAccentPosition !== undefined)
						manualAccentPosition = data.manualAccentPosition;
					if (data.accentUnknown !== undefined) accentUnknown = data.accentUnknown;
					if (data.pos !== undefined) pos = data.pos;
					if (data.alternativeFormInput !== undefined)
						alternativeFormInput = data.alternativeFormInput;
					if (data.transitivityCode !== undefined) transitivityCode = data.transitivityCode;
					if (data.pluralForm !== undefined) pluralForm = data.pluralForm;
					if (data.possessiveForm !== undefined) possessiveForm = data.possessiveForm;
					if (data.possessiveAlienable !== undefined)
						possessiveAlienable = data.possessiveAlienable;
					if (data.subType !== undefined) subType = data.subType;
					if (data.etymologyTerms !== undefined)
						etymologyTerms = normalizeEtymologyTerms(data.etymologyTerms);
					if (data.etymologyOptions !== undefined) etymologyOptions = data.etymologyOptions;
					if (data.etymologyQuickParse !== undefined)
						etymologyQuickParse = data.etymologyQuickParse;
					if (data.definitionsInput !== undefined) definitionsInput = data.definitionsInput;
					if (data.definitionDrafts !== undefined) {
						definitionDrafts = data.definitionDrafts;
						nextDefinitionId =
							Math.max(
								0,
								...definitionDrafts.map((draft) => Number(draft.id?.replace('def-', '')) || 0)
							) + 1;
					}
					if (data.usageInput !== undefined) usageInput = data.usageInput;
					if (data.manualExamples !== undefined) {
						manualExamples =
							data.manualExamples.length > 0
								? data.manualExamples.map(normalizeManualExampleInput)
								: [createManualExample()];
						nextManualExampleId =
							Math.max(0, ...manualExamples.map((example) => Number(example.id) || 0)) + 1;
					}
					if (data.dialectsInput !== undefined) dialectsInput = data.dialectsInput;
					if (data.derivedInput !== undefined) derivedInput = data.derivedInput;
					if (data.relatedInput !== undefined) relatedInput = data.relatedInput;
					if (data.synonymsInput !== undefined) synonymsInput = data.synonymsInput;
					if (data.antonymsInput !== undefined) antonymsInput = data.antonymsInput;
					if (data.addSeparator !== undefined) addSeparator = data.addSeparator;
					if (data.entrySeparators !== undefined) entrySeparators = data.entrySeparators;
					if (data.showOnlyUnassignedExamples !== undefined) {
						showOnlyUnassignedExamples = data.showOnlyUnassignedExamples;
					}
					if (data.selectedUnassignedExampleIds !== undefined) {
						selectedUnassignedExampleIds = data.selectedUnassignedExampleIds;
					}
					if (data.fetchedExampleAssignments !== undefined) {
						fetchedExampleAssignments = data.fetchedExampleAssignments;
					}
					if (data.fetchedExampleHighlightedTranslationIndexes !== undefined) {
						fetchedExampleHighlightedTranslationIndexes =
							data.fetchedExampleHighlightedTranslationIndexes;
					}
					if (data.fetchedExampleHighlightedTranslationParts !== undefined) {
						fetchedExampleHighlightedTranslationParts =
							data.fetchedExampleHighlightedTranslationParts;
					}
					if (data.fetchedExampleMinWords !== undefined) {
						fetchedExampleMinWords = data.fetchedExampleMinWords;
					}
					if (data.fetchedExampleMaxWords !== undefined) {
						fetchedExampleMaxWords = data.fetchedExampleMaxWords;
					}
					if (data.showHiddenFetchedExamples !== undefined) {
						showHiddenFetchedExamples = data.showHiddenFetchedExamples;
					}
				} catch (e) {
					console.error('Failed to restore state', e);
				}
			}
			loaded = true;
		}
	});

	$effect(() => {
		if (browser && loaded) {
			const state = {
				lemma,
				manualAccentPosition,
				accentUnknown,
				pos,
				alternativeFormInput,
				transitivityCode,
				pluralForm,
				possessiveForm,
				possessiveAlienable,
				subType,
				etymologyTerms: $state.snapshot(etymologyTerms).map(stripEtymologyTermUid),
				etymologyOptions: $state.snapshot(etymologyOptions),
				etymologyQuickParse,
				definitionsInput,
				definitionDrafts: $state.snapshot(definitionDrafts),
				usageInput,
				manualExamples: $state.snapshot(manualExamples),
				dialectsInput,
				derivedInput,
				relatedInput,
				synonymsInput,
				antonymsInput,
				addSeparator,
				entrySeparators: $state.snapshot(entrySeparators),
				showOnlyUnassignedExamples,
				selectedUnassignedExampleIds: $state.snapshot(selectedUnassignedExampleIds),
				fetchedExampleAssignments: $state.snapshot(fetchedExampleAssignments),
				fetchedExampleHighlightedTranslationIndexes: $state.snapshot(
					fetchedExampleHighlightedTranslationIndexes
				),
				fetchedExampleHighlightedTranslationParts: $state.snapshot(
					fetchedExampleHighlightedTranslationParts
				),
				fetchedExampleMinWords,
				fetchedExampleMaxWords,
				showHiddenFetchedExamples
			};
			sessionStorage.setItem('wiktionary_state', JSON.stringify(state));
		}
	});

	function parseLinkMeta(input: string): LinkMeta[] {
		if (!input) return [];

		const segments: string[] = [];
		let segment = '';
		let parenthesesDepth = 0;
		let templateDepth = 0;

		for (let index = 0; index < input.length; index += 1) {
			const char = input[index];
			const pair = input.slice(index, index + 2);
			if (pair === '{{') {
				templateDepth += 1;
				segment += pair;
				index += 1;
				continue;
			}
			if (pair === '}}') {
				templateDepth = Math.max(0, templateDepth - 1);
				segment += pair;
				index += 1;
				continue;
			}
			if (char === '(') {
				parenthesesDepth += 1;
			} else if (char === ')' && parenthesesDepth > 0) {
				parenthesesDepth -= 1;
			}

			if ((char === ',' || char === '+') && parenthesesDepth === 0 && templateDepth === 0) {
				segments.push(segment);
				segment = '';
				continue;
			}

			segment += char;
		}

		segments.push(segment);

		return segments
			.map((s) => {
				const trimmed = s.trim();
				const lAinMatch = trimmed.match(/^\{\{l\/ain\|(.+)\}\}(?:\(([^)]+)\))?$/);
				if (lAinMatch) {
					const template = parseTemplateParams(lAinMatch[1]);
					const dialects = template.named.dialects
						?.split(',')
						.map((value) => value.trim())
						.filter(Boolean);
					return {
						term: template.positional[0]?.trim() ?? '',
						alt: template.named.alt || undefined,
						dialects: dialects && dialects.length > 0 ? dialects : undefined,
						tran: template.named.t || lAinMatch[2]?.trim()
					};
				}
				const match = trimmed.match(/^([^(]+)(?:\(([^)]+)\))?$/);
				if (match) {
					return { term: match[1].trim(), tran: match[2]?.trim() };
				}
				return { term: trimmed };
			})
			.filter((l) => l.term);
	}

	function splitFormInput(input: string): string[] {
		if (!input) return [];
		return input
			.split(/[、,，;；\n]+/u)
			.map((part) => part.trim())
			.filter(Boolean);
	}

	function dedupeLinkMeta(items: LinkMeta[]): LinkMeta[] {
		const seen = new Set<string>();
		const result: LinkMeta[] = [];
		for (const item of items) {
			const key = item.term.trim();
			if (!key || seen.has(key)) continue;
			seen.add(key);
			result.push({ ...item, term: key });
		}
		return result;
	}

	function dedupeTerms(terms: string[]): string[] {
		return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
	}

	function getRowsForPossessiveForm(rows: PossessiveRow[], form: string): PossessiveRow[] {
		return rows.filter((row) => row.shortForm === form || row.longForm === form);
	}

	function getPossessedSourceTerms(
		form: string,
		rows: PossessiveRow[],
		sourceLemma: string,
		fallbackGloss?: string
	): Array<{ lemma: string; gloss?: string }> {
		const rowTerms = getRowsForPossessiveForm(rows, form).map((row) => ({
			lemma: row.lemma,
			gloss: row.gloss || fallbackGloss
		}));
		const sourceTerms =
			rowTerms.length > 0 ? rowTerms : [{ lemma: sourceLemma, gloss: fallbackGloss }];
		const seen = new Set<string>();
		return sourceTerms.filter((term) => {
			const key = `${term.lemma}\u0000${term.gloss ?? ''}`;
			if (!term.lemma || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	function getGeneratedPageKey(kind: GeneratedPage['kind'], term: string): string {
		return `${kind}:${term}`;
	}

	function isEntrySeparatorEnabled(kind: GeneratedPage['kind'], term: string): boolean {
		return entrySeparators[getGeneratedPageKey(kind, term)] ?? false;
	}

	function setEntrySeparator(kind: GeneratedPage['kind'], term: string, value: boolean) {
		entrySeparators = { ...entrySeparators, [getGeneratedPageKey(kind, term)]: value };
	}

	function quickParseEtymology() {
		const parsed = parseAinuEtymologyInput(etymologyQuickParse);
		if (parsed.length > 0) {
			const parsedTerms = parsed.map((term) => createEtymologyTerm(term));
			etymologyTerms = etymologyHasInput ? [...etymologyTerms, ...parsedTerms] : parsedTerms;
			etymologyQuickParse = '';
		}
	}

	function updateEtymologyOptions(patch: Partial<AffixTemplateOptions>) {
		etymologyOptions = { ...etymologyOptions, ...patch };
	}

	function updateEtymologyOptionField(param: keyof AffixTemplateOptions, value: string) {
		etymologyOptions = { ...etymologyOptions, [param]: value };
	}

	function updateEtymologyTerm(index: number, patch: Partial<LinkMeta>, shouldApplyPreset = false) {
		etymologyTerms = etymologyTerms.map((term, i) => {
			if (i !== index) return term;
			const nextTerm = { ...term, ...patch };
			return shouldApplyPreset
				? { ...applyAinuEtymologyPreset(nextTerm), uid: term.uid }
				: nextTerm;
		});
	}

	function updateEtymologyTermField(index: number, param: keyof LinkMeta, value: string) {
		updateEtymologyTerm(index, { [param]: value });
	}

	function hasEtymologyTermValue(term: LinkMeta): boolean {
		return Object.entries(term).some(([key, value]) => key !== 'uid' && value?.trim());
	}

	function parseEtymologyFromLemma() {
		if (etymologyHasInput || lemmaEtymologySuggestions.length === 0) return;
		etymologyTerms = lemmaEtymologySuggestions.map((term) => createEtymologyTerm(term));
	}

	function removeEtymologyTerm(index: number) {
		const nextTerms = etymologyTerms.filter((_, idx) => idx !== index);
		etymologyTerms = nextTerms.length > 0 ? nextTerms : [createEtymologyTerm()];
	}

	function moveEtymologyTerm(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		const nextTerms = [...etymologyTerms];
		const [movedTerm] = nextTerms.splice(fromIndex, 1);
		nextTerms.splice(toIndex, 0, movedTerm);
		etymologyTerms = nextTerms;
	}

	function finishEtymologyDrag() {
		draggedEtymologyIndex = null;
		etymologyDropIndex = null;
	}

	function mergeEtymologyTerm(index: number) {
		const nextTerm = etymologyTerms[index + 1];
		if (!nextTerm) return;
		etymologyTerms = [
			...etymologyTerms.slice(0, index),
			createEtymologyTerm(mergeAinuEtymologyTerms(etymologyTerms[index], nextTerm)),
			...etymologyTerms.slice(index + 2)
		];
	}

	function splitEtymologyTerm(index: number) {
		const termUid = etymologyTerms[index].uid;
		const splitInput = etymologySplitInputs[termUid];
		const splitTerms = splitAinuEtymologyTerm(etymologyTerms[index], splitInput);
		etymologyTerms = [
			...etymologyTerms.slice(0, index),
			...splitTerms.map((term) => createEtymologyTerm(term)),
			...etymologyTerms.slice(index + 1)
		];
		etymologySplitInputs = { ...etymologySplitInputs, [termUid]: '' };
	}

	function addManualExample() {
		const example = createManualExample();
		manualExamples = [...manualExamples, example];
		openManualExampleIds = [example.id];
	}

	function removeManualExample(id: number) {
		const nextExamples = manualExamples.filter((example) => example.id !== id);
		manualExamples = nextExamples.length > 0 ? nextExamples : [createManualExample()];
		openManualExampleIds = openManualExampleIds.filter((openId) => openId !== id);
	}

	function toggleManualExampleOpen(id: number) {
		openManualExampleIds = openManualExampleIds.includes(id)
			? openManualExampleIds.filter((openId) => openId !== id)
			: [...openManualExampleIds, id];
	}

	function setCitationMode(id: number, mode: CitationMode) {
		manualExamples = manualExamples.map((example) =>
			example.id === id ? { ...example, citationMode: mode } : example
		);
	}

	function normalizeManualExample(example: ManualExampleInput): Example | null {
		const text = example.text.trim();
		const translation = example.translation.trim();
		const transliteration = example.transliteration.trim();
		if (!text || !translation) return null;

		const referenceMarkup = example.referenceMarkup.trim();
		if (example.citationMode === 'raw') {
			const raw = referenceMarkup || example.source.raw.trim();
			return {
				id: `manual-${example.id}`,
				text,
				translation,
				highlightedTranslationIndexes: example.highlightedTranslationIndexes,
				highlightedTranslationParts: example.highlightedTranslationParts,
				transliteration: transliteration || undefined,
				source: raw ? { raw } : undefined
			};
		}

		const source = {
			template: example.source.template.trim(),
			extraParams: example.source.extraParams.trim(),
			author: example.source.author.trim(),
			title: example.source.title.trim(),
			book: example.source.book.trim(),
			year: example.source.year.trim(),
			url: example.source.url.trim()
		};

		return {
			id: `manual-${example.id}`,
			text,
			translation,
			highlightedTranslationIndexes: example.highlightedTranslationIndexes,
			highlightedTranslationParts: example.highlightedTranslationParts,
			transliteration: transliteration || undefined,
			source: Object.values(source).some(Boolean) ? source : undefined
		};
	}

	let fetchedExamples = $state<ExampleDraft[]>([]);
	let isFetching = $state(false);
	let showFetchedExamples = $state(false);
	let showManualExamples = $state(true);
	let manualExamplesOutput = $derived.by(() => {
		const output: ExampleDraft[] = [];
		for (const example of manualExamples) {
			const normalized = normalizeManualExample(example);
			if (normalized) {
				output.push({
					id: normalized.id ?? `manual-${example.id}`,
					...normalized,
					assignedDefinitionId: example.assignedDefinitionId,
					sourceKind: 'manual'
				});
			}
		}
		return output;
	});
	let examplePool = $derived([...manualExamplesOutput, ...fetchedExamples]);
	let definitionExampleCounts = $derived(
		buildDefinitionExampleCounts(definitionDrafts, examplePool)
	);
	let fetchedExampleWordCountSliderMax = $derived(
		Math.max(28, ...fetchedExamples.map((example) => getSentenceWordCount(example.text)))
	);
	let filteredFetchedExamples = $derived(
		showOnlyUnassignedExamples
			? fetchedExamples.filter((example) => !example.assignedDefinitionId)
			: fetchedExamples
	);
	let visibleFetchedExamples = $derived(
		filteredFetchedExamples.filter((example) => isWithinFetchedExampleWordRange(example.text))
	);
	let hiddenFetchedExamples = $derived(
		filteredFetchedExamples.filter((example) => !isWithinFetchedExampleWordRange(example.text))
	);
	let visibleManualExamples = $derived(
		showOnlyUnassignedExamples
			? manualExamples.filter((example) => !example.assignedDefinitionId)
			: manualExamples
	);
	let visibleUnassignedExamples = $derived(
		visibleFetchedExamples.filter((example) => !example.assignedDefinitionId)
	);
	let typedLemmaAnalysis = $derived(analyzeAinuLemma(lemma));
	let syllables = $derived(splitAinuSyllables(lemma));
	let accentPosition = $derived(
		accentUnknown || typedLemmaAnalysis.explicitAccent ? undefined : manualAccentPosition
	);
	let lemmaAnalysis = $derived(analyzeAinuLemma(lemma, accentPosition));
	let accentDisplayLabel = $derived(
		accentUnknown
			? `${m.syllable_label()} ${m.accent_unknown_label()}`
			: lemmaAnalysis.accentPosition
				? `${m.syllable_label()} ${lemmaAnalysis.accentPosition}`
				: null
	);
	let etymologyHasInput = $derived(etymologyTerms.some(hasEtymologyTermValue));
	let lemmaEtymologySuggestions = $derived(
		suggestAinuLemmaEtymology(lemmaAnalysis.pageLemma || lemma)
	);

	$effect(() => {
		const nextDrafts = reconcileDefinitionDrafts(
			definitionDrafts,
			parseDefinitionLines(definitionsInput)
		);
		if (!sameDefinitionDrafts(nextDrafts, definitionDrafts)) {
			definitionDrafts = nextDrafts;
		}
	});

	$effect(() => {
		const validDefinitionIds = new Set(definitionDrafts.map((definition) => definition.id));

		const nextManualExamples = manualExamples.map((example) => {
			const assignedDefinitionId = filterValidDefinitionId(
				example.assignedDefinitionId,
				validDefinitionIds
			);
			return assignedDefinitionId === example.assignedDefinitionId
				? example
				: { ...example, assignedDefinitionId };
		});
		if (nextManualExamples.some((example, index) => example !== manualExamples[index])) {
			manualExamples = nextManualExamples;
		}

		const nextFetchedExamples = fetchedExamples.map((example) => {
			const assignedDefinitionId = filterValidDefinitionId(
				example.assignedDefinitionId,
				validDefinitionIds
			);
			return assignedDefinitionId === example.assignedDefinitionId
				? example
				: { ...example, assignedDefinitionId };
		});
		if (nextFetchedExamples.some((example, index) => example !== fetchedExamples[index])) {
			fetchedExamples = nextFetchedExamples;
		}

		const nextFetchedAssignments = Object.fromEntries(
			Object.entries(fetchedExampleAssignments)
				.map(([exampleId, definitionId]) => [
					exampleId,
					filterValidDefinitionId(definitionId, validDefinitionIds)
				])
				.filter(([, definitionId]) => definitionId)
		) as Record<string, string>;
		if (JSON.stringify(nextFetchedAssignments) !== JSON.stringify(fetchedExampleAssignments)) {
			fetchedExampleAssignments = nextFetchedAssignments;
		}

		const nextFetchedHighlightedTranslationIndexes = Object.fromEntries(
			Object.entries(fetchedExampleHighlightedTranslationIndexes)
				.map(([exampleId, indexes]) => {
					const example = fetchedExamples.find((item) => item.id === exampleId);
					if (!example) return [exampleId, []] as const;
					const validIndexes = new Set(
						getTranslationSegments(example.translation)
							.filter((segment) => segment.isWordLike && segment.index !== null)
							.map((segment) => segment.index as number)
					);
					return [exampleId, indexes.filter((index) => validIndexes.has(index))] as const;
				})
				.filter(([, indexes]) => indexes.length > 0)
		) as Record<string, number[]>;
		if (
			JSON.stringify(nextFetchedHighlightedTranslationIndexes) !==
			JSON.stringify(fetchedExampleHighlightedTranslationIndexes)
		) {
			fetchedExampleHighlightedTranslationIndexes = nextFetchedHighlightedTranslationIndexes;
		}
	});

	$effect(() => {
		const nextManualExamples = manualExamples.map((example) => {
			const validIndexes = new Set(
				getTranslationSegments(example.translation)
					.filter((segment) => segment.isWordLike && segment.index !== null)
					.map((segment) => segment.index as number)
			);
			const highlightedTranslationIndexes = example.highlightedTranslationIndexes.filter((index) =>
				validIndexes.has(index)
			);
			return highlightedTranslationIndexes.length === example.highlightedTranslationIndexes.length
				? example
				: { ...example, highlightedTranslationIndexes };
		});
		if (nextManualExamples.some((example, index) => example !== manualExamples[index])) {
			manualExamples = nextManualExamples;
		}

		const nextFetchedExamples = fetchedExamples.map((example) => {
			const validIndexes = new Set(
				getTranslationSegments(example.translation)
					.filter((segment) => segment.isWordLike && segment.index !== null)
					.map((segment) => segment.index as number)
			);
			const currentIndexes = example.highlightedTranslationIndexes ?? [];
			const highlightedTranslationIndexes = currentIndexes.filter((index) =>
				validIndexes.has(index)
			);
			return highlightedTranslationIndexes.length === currentIndexes.length
				? example
				: { ...example, highlightedTranslationIndexes };
		});
		if (nextFetchedExamples.some((example, index) => example !== fetchedExamples[index])) {
			fetchedExamples = nextFetchedExamples;
		}
	});

	$effect(() => {
		const validExampleIds = new Set(visibleUnassignedExamples.map((example) => example.id));
		const nextSelectedIds = selectedUnassignedExampleIds.filter((id) => validExampleIds.has(id));
		if (nextSelectedIds.length !== selectedUnassignedExampleIds.length) {
			selectedUnassignedExampleIds = nextSelectedIds;
		}
	});

	$effect(() => {
		const sliderMax = fetchedExampleWordCountSliderMax;
		const nextMin = Math.min(Math.max(1, fetchedExampleMinWords), sliderMax);
		const nextMax = Math.min(Math.max(1, fetchedExampleMaxWords), sliderMax);

		if (nextMin !== fetchedExampleMinWords) {
			fetchedExampleMinWords = nextMin;
		}
		if (nextMax !== fetchedExampleMaxWords) {
			fetchedExampleMaxWords = nextMax;
		}
		if (nextMin > nextMax) {
			fetchedExampleMaxWords = nextMin;
		}
	});

	$effect(() => {
		if (typedLemmaAnalysis.explicitAccent && accentUnknown) {
			accentUnknown = false;
		}

		if (typedLemmaAnalysis.explicitAccent && manualAccentPosition !== undefined) {
			manualAccentPosition = undefined;
			return;
		}

		if (manualAccentPosition !== undefined && manualAccentPosition > syllables.length) {
			manualAccentPosition = undefined;
		}
	});

	function handleLemmaInput(event: Event) {
		lemma = (event.currentTarget as HTMLInputElement).value;
		accentUnknown = false;
	}

	function setManualAccentPosition(position?: number) {
		lemma = lemmaAnalysis.pageLemma;
		accentUnknown = false;
		if (position === undefined) {
			manualAccentPosition = undefined;
			return;
		}

		manualAccentPosition = manualAccentPosition === position ? undefined : position;
	}

	function setUnknownAccent() {
		lemma = lemmaAnalysis.pageLemma;
		manualAccentPosition = undefined;
		accentUnknown = !accentUnknown;
	}

	function updateExampleAssignment(
		sourceKind: ExampleSourceKind,
		exampleId: string,
		assignedDefinitionId: string | null
	) {
		if (sourceKind === 'manual') {
			const numericId = Number(exampleId.replace('manual-', ''));
			manualExamples = manualExamples.map((example) => {
				if (example.id !== numericId) return example;
				return assignedDefinitionId === example.assignedDefinitionId
					? example
					: { ...example, assignedDefinitionId };
			});
			return;
		}

		fetchedExamples = fetchedExamples.map((example) => {
			if (example.id !== exampleId) return example;
			return assignedDefinitionId === example.assignedDefinitionId
				? example
				: { ...example, assignedDefinitionId };
		});
		fetchedExampleAssignments = {
			...fetchedExampleAssignments,
			[exampleId]: assignedDefinitionId
		};
	}

	function getTranslationSegments(translation: string): TranslationSegment[] {
		return segmentJapaneseTranslation(translation);
	}

	function toggleTranslationSegment(
		sourceKind: ExampleSourceKind,
		exampleId: string,
		segmentIndex: number | null
	) {
		if (segmentIndex === null) return;

		if (sourceKind === 'manual') {
			const numericId = Number(exampleId.replace('manual-', ''));
			manualExamples = manualExamples.map((example) => {
				if (example.id !== numericId) return example;
				const highlightedTranslationIndexes = example.highlightedTranslationIndexes.includes(
					segmentIndex
				)
					? example.highlightedTranslationIndexes.filter((value) => value !== segmentIndex)
					: [...example.highlightedTranslationIndexes, segmentIndex];
				return { ...example, highlightedTranslationIndexes };
			});
			return;
		}

		fetchedExamples = fetchedExamples.map((example) => {
			if (example.id !== exampleId) return example;
			const currentIndexes = example.highlightedTranslationIndexes ?? [];
			const highlightedTranslationIndexes = currentIndexes.includes(segmentIndex)
				? currentIndexes.filter((value) => value !== segmentIndex)
				: [...currentIndexes, segmentIndex];
			return { ...example, highlightedTranslationIndexes };
		});
		const currentPersistedIndexes = fetchedExampleHighlightedTranslationIndexes[exampleId] ?? [];
		fetchedExampleHighlightedTranslationIndexes = {
			...fetchedExampleHighlightedTranslationIndexes,
			[exampleId]: currentPersistedIndexes.includes(segmentIndex)
				? currentPersistedIndexes.filter((value) => value !== segmentIndex)
				: [...currentPersistedIndexes, segmentIndex]
		};
	}

	function setDefinitionAssignment(
		sourceKind: ExampleSourceKind,
		exampleId: string,
		definitionId: string | null
	) {
		const currentExample =
			sourceKind === 'manual'
				? manualExamples.find((example) => `manual-${example.id}` === exampleId)
				: fetchedExamples.find((example) => example.id === exampleId);
		const nextDefinitionId =
			currentExample?.assignedDefinitionId === definitionId ? null : definitionId;
		updateExampleAssignment(sourceKind, exampleId, nextDefinitionId);
	}

	function toggleUnassignedExampleSelection(exampleId: string) {
		selectedUnassignedExampleIds = selectedUnassignedExampleIds.includes(exampleId)
			? selectedUnassignedExampleIds.filter((id) => id !== exampleId)
			: [...selectedUnassignedExampleIds, exampleId];
	}

	function selectAllVisibleUnassignedExamples() {
		selectedUnassignedExampleIds = visibleUnassignedExamples.map((example) => example.id);
	}

	function clearSelectedUnassignedExamples() {
		selectedUnassignedExampleIds = [];
	}

	function getSentenceWordCount(text: string): number {
		const trimmed = text.trim();
		return trimmed ? trimmed.split(/\s+/u).length : 0;
	}

	function isWithinFetchedExampleWordRange(text: string): boolean {
		const wordCount = getSentenceWordCount(text);
		return wordCount >= fetchedExampleMinWords && wordCount <= fetchedExampleMaxWords;
	}

	function buildExampleSearchTerms(primaryTerm: string, alternatives: LinkMeta[]): string[] {
		const terms: string[] = [];

		for (const rawTerm of [primaryTerm, ...alternatives.map((alternative) => alternative.term)]) {
			const term = rawTerm.trim();
			if (!term) continue;
			if (!terms.includes(term)) terms.push(term);

			const unaccentedTerm = stripAccentAndWhitespace(term);
			if (unaccentedTerm && !terms.includes(unaccentedTerm)) {
				terms.push(unaccentedTerm);
			}
		}

		return terms;
	}

	function setFetchedExampleWordRange(value: number[]) {
		const [minValue = fetchedExampleMinWords, maxValue = fetchedExampleMaxWords] = value;
		const nextMin = Math.min(
			Math.max(1, Math.round(minValue) || 1),
			fetchedExampleWordCountSliderMax
		);
		const nextMax = Math.min(
			Math.max(1, Math.round(maxValue) || 1),
			fetchedExampleWordCountSliderMax
		);
		fetchedExampleMinWords = Math.min(nextMin, nextMax);
		fetchedExampleMaxWords = Math.max(nextMin, nextMax);
	}

	function handleFetchedExampleWordRangeChange(details: SliderValueChangeDetails) {
		setFetchedExampleWordRange(details.value);
	}

	function applyAssignmentToSelectedUnassignedExamples(definitionId: string) {
		for (const exampleId of selectedUnassignedExampleIds) {
			updateExampleAssignment('fetched', exampleId, definitionId);
		}
		selectedUnassignedExampleIds = [];
	}

	function toOutputExample(example: ExampleDraft): Example {
		return {
			id: example.id,
			text: example.text,
			translation: example.translation,
			highlightedTranslationIndexes: example.highlightedTranslationIndexes,
			highlightedTranslationParts: example.highlightedTranslationParts,
			transliteration: example.transliteration,
			ref: example.ref,
			source: example.source
		};
	}

	let alternativeForms = $derived.by(() => {
		const terms = parseLinkMeta(alternativeFormInput);
		const pageLemma = lemmaAnalysis.pageLemma;
		if (pageLemma.startsWith('uwe')) terms.push({ term: `ue${pageLemma.slice(3)}` });
		if (pageLemma.startsWith('iye')) terms.push({ term: `iy${pageLemma.slice(3)}` });
		return dedupeLinkMeta(terms.filter((item) => item.term !== pageLemma));
	});

	let manualPossessiveForms = $derived(
		dedupeTerms(splitFormInput(pos === 'noun' ? possessiveForm : ''))
	);
	let possessiveRowsForLemma = $derived(
		pos === 'noun' ? getPossessiveRowsByLemma(lemmaAnalysis.pageLemma) : []
	);
	let possessiveRowsForAnyForm = $derived(
		pos === 'noun' ? getPossessiveRowsByAnyForm(lemmaAnalysis.pageLemma) : []
	);
	let automaticPossessiveForms = $derived(getPossessiveForms(possessiveRowsForLemma));
	let possessiveForms = $derived(
		manualPossessiveForms.length > 0 ? manualPossessiveForms : automaticPossessiveForms
	);
	let declensionPossessiveForms = $derived.by(() => {
		const tableForms = getPossessiveForms(
			possessiveRowsForLemma.length > 0 ? possessiveRowsForLemma : possessiveRowsForAnyForm
		);
		return tableForms.length > 0 ? tableForms : possessiveForms;
	});
	let pluralPageLemma = $derived(pos === 'verb' ? pluralForm.trim() : '');
	let mainPageKey = $derived(getGeneratedPageKey('main', lemmaAnalysis.pageLemma));

	$effect(() => {
		const nextAutomaticPossessiveForm = pos === 'noun' ? automaticPossessiveForms.join(', ') : '';
		if (
			nextAutomaticPossessiveForm !== lastAutomaticPossessiveForm &&
			(possessiveForm.trim() === '' || possessiveForm === lastAutomaticPossessiveForm)
		) {
			possessiveForm = nextAutomaticPossessiveForm;
		}
		lastAutomaticPossessiveForm = nextAutomaticPossessiveForm;
	});

	// Derived state for the entry object
	let entry = $derived<AinuEntry>({
		lemma,
		accentPosition,
		pos,
		pos_args: {
			transitivity: pos === 'verb' ? transitivityCode : undefined,
			plural: pos === 'verb' && pluralForm ? pluralForm : undefined,
			possessive: pos === 'noun' && possessiveForms.length > 0 ? possessiveForms : undefined
		},
		sub_type: subType || undefined,
		etymology: etymologyTerms.filter((t) => t.term.trim() !== '').map(stripEtymologyTermUid),
		etymologyOptions,
		alternatives: alternativeForms,
		derived: parseLinkMeta(derivedInput),
		related: parseLinkMeta(relatedInput),
		synonyms: parseLinkMeta(synonymsInput),
		antonyms: parseLinkMeta(antonymsInput),
		dialects: dialectsInput
			? dialectsInput
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			: undefined,
		usage: usageInput || undefined,
		definitions: (() => {
			return definitionDrafts.map((definitionDraft) => {
				const examples = examplePool
					.filter((example) => example.assignedDefinitionId === definitionDraft.id)
					.map(toOutputExample);
				return {
					gloss: definitionDraft.gloss,
					examples: examples.length > 0 ? examples : undefined
				};
			});
		})(),
		declension:
			pos === 'noun' && declensionPossessiveForms.length > 0
				? { forms: declensionPossessiveForms, alienable: possessiveAlienable }
				: undefined,
		pronunciation: { ipa: true, accentKnown: !accentUnknown },
		addSeparator: entrySeparators[mainPageKey] ?? false
	});

	async function fetchExamples(terms: string[]) {
		const [primaryTerm, ...extraTerms] = terms;
		if (!primaryTerm) {
			fetchedExamples = [];
			return;
		}
		isFetching = true;
		try {
			const queryString = extraTerms.map((term) => `term=${encodeURIComponent(term)}`).join('&');
			const res = await fetch(
				`/api/examples/${encodeURIComponent(primaryTerm)}${queryString ? `?${queryString}` : ''}`
			);
			if (!res.ok) throw new Error('Failed to fetch');
			const data = (await res.json()) as { examples: FetchedExampleResponse[] };
			fetchedExamples = data.examples.map((ex) => {
				const id = `fetched-${String(ex.id)}`;
				return {
					id,
					text: ex.ain,
					translation: ex.jpn,
					highlightedTranslationIndexes: fetchedExampleHighlightedTranslationIndexes[id] ?? [],
					highlightedTranslationParts: fetchedExampleHighlightedTranslationParts[id] ?? [],
					sourceKind: 'fetched',
					assignedDefinitionId: fetchedExampleAssignments[id] ?? null,
					source: {
						author: ex.author || undefined,
						title: ex.title || undefined,
						book: ex.book || undefined,
						year: ex.date ? String(ex.date) : undefined,
						url: ex.url || undefined
					}
				};
			});
		} catch (e) {
			console.error('Failed to fetch examples', e);
			fetchedExamples = [];
		} finally {
			isFetching = false;
		}
	}

	let debounceTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const terms = buildExampleSearchTerms(lemmaAnalysis.pageLemma, alternativeForms);
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchExamples(terms);
		}, 500);
		return () => clearTimeout(debounceTimer);
	});

	let wikitext = $derived(renderWikitext(entry, getLocale()));
	let editUrl = $derived(
		`https://${getLocale()}.wiktionary.org/w/index.php?title=${lemmaAnalysis.pageLemma}&action=edit`
	);
	function getEditUrl(term: string): string {
		return `https://${getLocale()}.wiktionary.org/w/index.php?title=${encodeURIComponent(term)}&action=edit`;
	}

	let generatedPages = $derived.by<GeneratedPage[]>(() => {
		const pages: GeneratedPage[] = [
			{
				term: lemmaAnalysis.pageLemma,
				url: editUrl,
				wikitext,
				kind: 'main'
			}
		];
		const sourceLemma = lemmaAnalysis.pageLemma;
		const firstGloss = definitionDrafts.find((definition) => definition.gloss.trim())?.gloss.trim();

		for (const alternative of alternativeForms) {
			const pageKey = getGeneratedPageKey('alternative', alternative.term);
			const formEntry: AinuFormEntry = {
				kind: 'alternative',
				lemma: alternative.term,
				sourceLemma,
				pos,
				gloss: alternative.tran ?? firstGloss,
				addSeparator: entrySeparators[pageKey] ?? false
			};
			pages.push({
				term: alternative.term,
				url: getEditUrl(alternative.term),
				wikitext: renderFormWikitext(formEntry, getLocale()),
				kind: 'alternative',
				formEntry
			});
		}

		if (pluralPageLemma) {
			const pageKey = getGeneratedPageKey('verbPlural', pluralPageLemma);
			const formEntry: AinuFormEntry = {
				kind: 'verbPlural',
				lemma: pluralPageLemma,
				sourceLemma,
				gloss: firstGloss,
				addSeparator: entrySeparators[pageKey] ?? false
			};
			pages.push({
				term: pluralPageLemma,
				url: getEditUrl(pluralPageLemma),
				wikitext: renderFormWikitext(formEntry, getLocale()),
				kind: 'verbPlural',
				formEntry
			});
		}

		for (const possessive of possessiveForms) {
			const pageKey = getGeneratedPageKey('possessed', possessive);
			const sourceTerms = getPossessedSourceTerms(
				possessive,
				possessiveRowsForLemma,
				sourceLemma,
				firstGloss
			);
			const formEntry: AinuFormEntry = {
				kind: 'possessed',
				lemma: possessive,
				sourceLemma,
				gloss: firstGloss,
				sourceTerms,
				addSeparator: entrySeparators[pageKey] ?? false
			};
			pages.push({
				term: possessive,
				url: getEditUrl(possessive),
				wikitext: renderFormWikitext(formEntry, getLocale()),
				kind: 'possessed',
				formEntry
			});
		}

		return pages;
	});
	let isEnglish = $derived(getLocale() === 'en');
	let previewLabels = $derived({
		code: isEnglish ? 'Code' : 'コード',
		preview: isEnglish ? 'Preview' : 'プレビュー',
		language: isEnglish ? 'Ainu' : 'アイヌ語',
		pronunciation: isEnglish ? 'Pronunciation' : '発音',
		etymology: isEnglish ? 'Etymology' : '語源',
		declension: isEnglish ? 'Declension' : '曲用',
		usage: isEnglish ? 'Usage' : '用法',
		examples: isEnglish ? 'Examples' : '例文',
		references: isEnglish ? 'References' : '出典',
		noContent: isEnglish
			? 'Fill in the form to see a preview.'
			: 'フォームを入力するとプレビューが表示されます。'
	});
	const editIconPath =
		'M15.232 5.232l3.536 3.536M4 20h4.768a2 2 0 001.414-.586l9.192-9.192a2.5 2.5 0 00-3.536-3.536l-9.192 9.192A2 2 0 006.06 17.292V20H4z';
	const copyIconPath =
		'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3';
	let previewEtymology = $derived(entry.etymology?.filter((item) => item.term.trim()) ?? []);
	let previewDefinitions = $derived(entry.definitions.filter((item) => item.gloss.trim()));
	let previewRelatedGroups = $derived([
		{ title: m.derived_label(), items: entry.derived ?? [] },
		{ title: m.related_label(), items: entry.related ?? [] },
		{ title: m.synonyms_label(), items: entry.synonyms ?? [] },
		{ title: m.antonyms_label(), items: entry.antonyms ?? [] }
	]);
	let hasAnyEditorInput = $derived(
		Boolean(
			lemma.trim() ||
			definitionsInput.trim() ||
			usageInput.trim() ||
			dialectsInput.trim() ||
			derivedInput.trim() ||
			relatedInput.trim() ||
			synonymsInput.trim() ||
			antonymsInput.trim() ||
			subType.trim() ||
			pluralForm.trim() ||
			possessiveForm.trim() ||
			etymologyQuickParse.trim() ||
			etymologyTerms.some(hasEtymologyTermValue) ||
			manualExamples.some(
				(example) =>
					example.text.trim() ||
					example.translation.trim() ||
					example.transliteration.trim() ||
					example.referenceMarkup.trim() ||
					Object.values(example.source).some((value) => value.trim())
			)
		)
	);
	let hasPreviewContent = $derived(
		Boolean(
			lemmaAnalysis.pageLemma ||
			previewDefinitions.length ||
			previewEtymology.length ||
			entry.usage?.trim() ||
			previewRelatedGroups.some((group) => group.items.length > 0)
		)
	);

	function getPosLabel(value: PartOfSpeech): string {
		switch (value) {
			case 'noun':
				return m.pos_noun();
			case 'proper_noun':
				return m.pos_proper_noun();
			case 'verb':
				return m.pos_verb();
			case 'adj':
				return m.pos_adj();
			case 'adv':
				return m.pos_adv();
			case 'postadv':
				return m.pos_postadv();
			case 'adnominal':
				return m.pos_adnominal();
			case 'numeral':
				return m.pos_numeral();
			case 'participle':
				return m.pos_participle();
			case 'aux':
				return m.pos_aux();
			case 'particle':
				return m.pos_particle();
			case 'pron':
				return m.pos_pron();
			case 'prep':
				return m.pos_prep();
			case 'conj':
				return m.pos_conj();
			case 'interj':
				return m.pos_interj();
			case 'root':
				return m.pos_root();
			case 'prefix':
				return m.pos_prefix();
			case 'suffix':
				return m.pos_suffix();
			case 'colloc':
				return m.pos_colloc();
		}
	}

	function getTransitivityQualifier(code: 0 | 1 | 2 | 3 | 4): string[] {
		if (isEnglish) {
			switch (code) {
				case 0:
					return ['impersonal', 'avalent'];
				case 1:
					return ['intransitive', 'monovalent'];
				case 2:
					return ['monotransitive', 'divalent'];
				case 3:
					return ['ditransitive', 'trivalent'];
				case 4:
					return ['tritransitive', 'quadrivalent'];
			}
		}

		switch (code) {
			case 0:
				return ['0項動詞', '完全動詞'];
			case 1:
				return ['自動詞', '1項動詞'];
			case 2:
				return ['単他動詞', '2項動詞'];
			case 3:
				return ['複他動詞', '3項動詞'];
			case 4:
				return ['三重他動詞', '4項動詞'];
		}
	}

	function getHeadwordQualifiers(): string[] {
		const qualifiers: string[] = [];
		if (entry.pos === 'verb' && entry.pos_args?.transitivity !== undefined) {
			qualifiers.push(...getTransitivityQualifier(entry.pos_args.transitivity));
		}
		if (entry.sub_type?.trim()) {
			qualifiers.push(entry.sub_type.trim());
		}
		if (entry.dialects?.length) {
			qualifiers.push(...entry.dialects);
		}
		return qualifiers;
	}

	function getGeneratedPageLabel(kind: GeneratedPage['kind']): string {
		if (kind === 'main') return '';
		if (kind === 'alternative') return m.alternative_form_page_label();
		if (kind === 'verbPlural') return m.plural_form_page_label();
		return m.possessed_form_page_label();
	}

	function getEditTitle(page: Pick<GeneratedPage, 'term' | 'kind'>): string {
		return `${m.edit_on_wiktionary()}: ${page.term || getGeneratedPageLabel(page.kind)}`;
	}

	function getCopyTitle(page: Pick<GeneratedPage, 'term' | 'kind'>): string {
		return `${m.copy_code()}: ${page.term || getGeneratedPageLabel(page.kind)}`;
	}

	function getPageKey(page: Pick<GeneratedPage, 'term' | 'kind'>): string {
		return `${page.kind}:${page.term}`;
	}

	function getFormPreviewPos(formEntry: AinuFormEntry): PartOfSpeech {
		if (formEntry.kind === 'verbPlural') return 'verb';
		if (formEntry.kind === 'possessed') return 'noun';
		return formEntry.pos;
	}

	function getFormPreviewDefinitions(formEntry: AinuFormEntry): string[] {
		if (formEntry.kind === 'alternative') {
			const gloss = formEntry.gloss ? `「${formEntry.gloss}」` : '';
			return [`${gloss} の別形。`];
		}
		if (formEntry.kind === 'verbPlural') {
			const gloss = formEntry.gloss ? `「${formEntry.gloss}」` : '';
			return [`${gloss} の複数。`];
		}
		const sourceTerms = formEntry.sourceTerms?.length
			? formEntry.sourceTerms
			: [{ lemma: formEntry.sourceLemma, gloss: formEntry.gloss }];
		return sourceTerms.map((term) => {
			const gloss = term.gloss ? `「${term.gloss}」` : '';
			return `${gloss} の所属形。`;
		});
	}

	function formatReferenceLabel(example: Example): string {
		if (example.source) {
			const parts = [
				example.source.author,
				example.source.title,
				example.source.publisher ?? example.source.book,
				example.source.year
			].filter(Boolean);
			if (example.source.raw) {
				return example.source.raw;
			}
			if (parts.length > 0) {
				return parts.join(', ');
			}
			if (example.source.url) {
				return example.source.url;
			}
		}
		return example.ref ?? '';
	}

	function getExampleReferenceKey(example: Example): string {
		return (
			example.id ??
			`${example.text}\u0000${example.translation}\u0000${formatReferenceLabel(example)}`
		);
	}

	function getExampleReferenceNumber(definitionIndex: number, exampleIndex: number): number | null {
		const example = previewDefinitions[definitionIndex]?.examples?.[exampleIndex];
		if (!example || !formatReferenceLabel(example)) return null;
		const referenceNumbers = buildReferenceNumbers(previewDefinitions);
		return referenceNumbers[getExampleReferenceKey(example)] ?? null;
	}

	function getTermUrl(term: string): string {
		return `https://${getLocale()}.wiktionary.org/wiki/${encodeURIComponent(term.replaceAll(' ', '_'))}`;
	}

	let previewReferenceItems = $derived(buildPreviewReferenceItems(previewDefinitions));

	function copyGeneratedPage(page: GeneratedPage) {
		const pageKey = getPageKey(page);
		navigator.clipboard.writeText(page.wikitext).then(() => {
			copiedPageKey = pageKey;
			setTimeout(() => {
				if (copiedPageKey === pageKey) copiedPageKey = null;
			}, 2000);
		});
	}

	const assignmentChipBaseClass =
		'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors';
	const translationToggleBaseClass =
		'inline cursor-pointer appearance-none border-0 bg-transparent p-0 text-inherit align-baseline leading-inherit';
</script>

<div
	class="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 lg:h-screen lg:flex-row"
>
	<!-- Left Column: Input Editor -->
	<div
		class="z-10 flex min-h-screen w-full flex-col border-b border-slate-200 bg-white shadow-xl lg:h-screen lg:w-1/2 lg:border-r lg:border-b-0"
	>
		<div class="custom-scrollbar-light flex-1 overflow-y-visible p-5 sm:p-8 lg:overflow-y-auto">
			<header
				class="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between"
			>
				<div>
					<h1 class="text-3xl font-extrabold tracking-tight text-slate-900">{m.title()}</h1>
					<p class="mt-2 text-sm font-medium text-slate-500">{m.subtitle()}</p>
				</div>
				<div class="flex flex-col items-end space-y-3">
					<LanguageSwitcher />
					{#if hasAnyEditorInput}
						<button
							type="button"
							onclick={parseWiktionaryEntryForLemma}
							disabled={isParsingWiktionaryEntry || !lemmaAnalysis.pageLemma}
							class={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
								isParsingWiktionaryEntry || !lemmaAnalysis.pageLemma
									? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
									: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100'
							}`}
							title="Fetch and parse the current Wiktionary entry"
						>
							{m.parse_term_todo()}
						</button>
					{/if}
					{#if wiktionaryParseError}
						<p class="max-w-xs text-right text-xs font-medium text-rose-600">
							{wiktionaryParseError}
						</p>
					{/if}
				</div>
			</header>

			<div class="space-y-10">
				<!-- Basic Info Section -->
				<section>
					<h2
						class="mb-6 border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase"
					>
						{m.basic_info()}
					</h2>

					<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div class="sm:col-span-2">
							<div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
								<div class="flex flex-col gap-4">
									<div>
										<label for="lemma" class="mb-2 block text-sm font-semibold text-slate-700"
											>{m.lemma_label()}</label
										>
										<input
											type="text"
											id="lemma"
											value={lemma}
											oninput={handleLemmaInput}
											placeholder={m.lemma_placeholder()}
											class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
										/>
									</div>

									<div>
										<div class="mb-2 flex items-center justify-between gap-3">
											<div class="flex items-baseline gap-2">
												<span class="block text-sm font-semibold text-slate-700"
													>{m.accent_position_label()}</span
												>
												{#if accentDisplayLabel}
													<span class="text-xs text-slate-500">({accentDisplayLabel})</span>
												{/if}
											</div>
											<button
												type="button"
												onclick={setUnknownAccent}
												class={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
													accentUnknown
														? 'bg-slate-900 text-white'
														: 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100'
												}`}
											>
												{m.accent_unknown_label()}
											</button>
										</div>
										<div class="flex flex-wrap gap-2">
											{#if syllables.length > 0}
												{#each syllables as syllable (syllable.index)}
													<button
														type="button"
														onclick={() => setManualAccentPosition(syllable.index)}
														class={`rounded-full border px-3 py-2 text-sm font-semibold transition-all ${
															!accentUnknown && lemmaAnalysis.accentPosition === syllable.index
																? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
																: 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
														}`}
														aria-pressed={!accentUnknown &&
															lemmaAnalysis.accentPosition === syllable.index}
													>
														{syllable.text}
													</button>
												{/each}
											{:else}
												<div
													class="rounded-full bg-white px-3 py-2 text-sm text-slate-400 ring-1 ring-slate-200"
												>
													{m.lemma_placeholder()}
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Part of Speech -->
						<PosSelect bind:value={pos} id="pos" />

						<!-- Sub Type -->
						<div>
							<label for="subType" class="mb-2 block text-sm font-semibold text-slate-700"
								>{m.sub_type_label()}</label
							>
							<input
								type="text"
								id="subType"
								bind:value={subType}
								placeholder={m.sub_type_placeholder()}
								class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
						</div>

						<div>
							<label for="alternativeForms" class="mb-2 block text-sm font-semibold text-slate-700"
								>{m.alternative_forms_label()}</label
							>
							<input
								type="text"
								id="alternativeForms"
								bind:value={alternativeFormInput}
								placeholder={m.alternative_forms_placeholder()}
								class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
						</div>

						{#if pos === 'noun'}
							<div class="sm:col-span-2">
								<div class="mb-2 flex flex-wrap items-center justify-between gap-3">
									<label for="possessive" class="block text-sm font-semibold text-slate-700"
										>{m.possessive_label()}</label
									>
									<Switch.Root
										checked={possessiveAlienable}
										onCheckedChange={(details) => (possessiveAlienable = details.checked)}
										class="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600"
									>
										<Switch.HiddenInput />
										<Switch.Control
											class={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
												possessiveAlienable
													? 'border-indigo-600 bg-indigo-600'
													: 'border-slate-300 bg-slate-200'
											}`}
										>
											<Switch.Thumb
												class={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
													possessiveAlienable ? 'translate-x-4' : 'translate-x-0.5'
												}`}
											/>
										</Switch.Control>
										<Switch.Label>
											{possessiveAlienable
												? m.declension_alienable_label()
												: m.declension_inalienable_label()}
										</Switch.Label>
									</Switch.Root>
								</div>
								<input
									type="text"
									id="possessive"
									bind:value={possessiveForm}
									placeholder={m.possessive_placeholder()}
									class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								/>
							</div>
						{/if}

						{#if pos === 'verb'}
							<div class="sm:col-span-2">
								<span class="mb-2 block text-sm font-semibold text-slate-700"
									>{m.transitivity_label()}</span
								>
								<div
									class="flex flex-wrap gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 shadow-sm"
								>
									<label class="group inline-flex cursor-pointer items-center">
										<input
											type="radio"
											bind:group={transitivityCode}
											value={0}
											class="border-slate-300 text-indigo-600 transition duration-150 ease-in-out focus:ring-indigo-500"
										/>
										<span
											class="ml-2 text-sm text-slate-700 transition-colors group-hover:text-indigo-700"
											>{m.trans_complete()}</span
										>
									</label>
									<label class="group inline-flex cursor-pointer items-center">
										<input
											type="radio"
											bind:group={transitivityCode}
											value={1}
											class="border-slate-300 text-indigo-600 transition duration-150 ease-in-out focus:ring-indigo-500"
										/>
										<span
											class="ml-2 text-sm text-slate-700 transition-colors group-hover:text-indigo-700"
											>{m.trans_intr()}</span
										>
									</label>
									<label class="group inline-flex cursor-pointer items-center">
										<input
											type="radio"
											bind:group={transitivityCode}
											value={2}
											class="border-slate-300 text-indigo-600 transition duration-150 ease-in-out focus:ring-indigo-500"
										/>
										<span
											class="ml-2 text-sm text-slate-700 transition-colors group-hover:text-indigo-700"
											>{m.trans_trans()}</span
										>
									</label>
									<label class="group inline-flex cursor-pointer items-center">
										<input
											type="radio"
											bind:group={transitivityCode}
											value={3}
											class="border-slate-300 text-indigo-600 transition duration-150 ease-in-out focus:ring-indigo-500"
										/>
										<span
											class="ml-2 text-sm text-slate-700 transition-colors group-hover:text-indigo-700"
											>{m.trans_ditrans()}</span
										>
									</label>
									<label class="group inline-flex cursor-pointer items-center">
										<input
											type="radio"
											bind:group={transitivityCode}
											value={4}
											class="border-slate-300 text-indigo-600 transition duration-150 ease-in-out focus:ring-indigo-500"
										/>
										<span
											class="ml-2 text-sm text-slate-700 transition-colors group-hover:text-indigo-700"
											>{m.trans_tritrans()}</span
										>
									</label>
								</div>
							</div>

							<div>
								<label for="plural" class="mb-2 block text-sm font-semibold text-slate-700"
									>{m.plural_label()}</label
								>
								<input
									type="text"
									id="plural"
									bind:value={pluralForm}
									placeholder={m.plural_placeholder()}
									class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								/>
							</div>
						{/if}
					</div>
				</section>

				<!-- Etymology & Definitions -->
				<section class="space-y-6">
					<div>
						<div class="mb-2 flex items-center justify-between">
							<span class="block text-sm font-semibold text-slate-700">{m.etymology_label()}</span>
							{#if !etymologyHasInput && lemmaEtymologySuggestions.length > 0}
								<button
									onclick={parseEtymologyFromLemma}
									class="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
								>
									{m.etym_parse_lemma_btn()}
								</button>
							{/if}
						</div>

						<details class="mb-4 rounded-lg border border-slate-200 bg-white p-3">
							<summary class="cursor-pointer text-xs font-semibold text-slate-600">
								{m.etym_template_params()}
							</summary>
							<div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
								{#each etymologyGlobalParams as param (param)}
									<div>
										<label
											for="ety-global-{param}"
											title={etymologyGlobalParamHelp[param]}
											class="mb-1 block text-xs font-semibold text-slate-500">{param}</label
										>
										<input
											id="ety-global-{param}"
											type="text"
											value={etymologyOptions[param] ?? ''}
											title={etymologyGlobalParamHelp[param]}
											oninput={(e) =>
												updateEtymologyOptionField(
													param,
													(e.currentTarget as HTMLInputElement).value
												)}
											class="w-full rounded border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
										/>
									</div>
								{/each}
							</div>
						</details>

						<div class="space-y-4">
							{#each etymologyTerms as term, i (term.uid)}
								<div
									role="listitem"
									draggable="true"
									ondragstart={() => {
										draggedEtymologyIndex = i;
										etymologyDropIndex = i;
									}}
									ondragenter={() => (etymologyDropIndex = i)}
									ondragover={(e) => {
										e.preventDefault();
										etymologyDropIndex = i;
									}}
									ondrop={() => {
										if (draggedEtymologyIndex !== null) moveEtymologyTerm(draggedEtymologyIndex, i);
										finishEtymologyDrag();
									}}
									ondragend={finishEtymologyDrag}
									class={`flex items-start gap-4 rounded-lg border bg-slate-50 p-4 transition-colors focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-300 ${
										etymologyDropIndex === i && draggedEtymologyIndex !== null
											? 'border-t-4 border-indigo-400 bg-indigo-50 shadow-md'
											: 'border-slate-200'
									}`}
								>
									<div class="mt-7 cursor-grab text-slate-400" title={m.etym_drag_title()}>::</div>
									<div class="flex-1 space-y-3">
										<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
											<div>
												<label
													for="ety-term-{i}"
													class="mb-1 block text-xs font-semibold text-slate-500"
													>{m.etym_term_label()}</label
												>
												<input
													id="ety-term-{i}"
													type="text"
													value={term.term}
													oninput={(e) =>
														updateEtymologyTerm(
															i,
															{ term: (e.currentTarget as HTMLInputElement).value },
															true
														)}
													placeholder="-re"
													class="w-full rounded border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
												/>
											</div>
											<div>
												<label
													for="ety-tran-{i}"
													class="mb-1 block text-xs font-semibold text-slate-500"
													>{m.etym_tran_label()}</label
												>
												<input
													id="ety-tran-{i}"
													type="text"
													value={term.tran ?? ''}
													oninput={(e) =>
														updateEtymologyTerm(i, {
															tran: (e.currentTarget as HTMLInputElement).value
														})}
													placeholder="させる"
													class="w-full rounded border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
												/>
											</div>
											<div>
												<label
													for="ety-pos-{i}"
													class="mb-1 block text-xs font-semibold text-slate-500"
													>{m.etym_pos_label()}</label
												>
												<input
													id="ety-pos-{i}"
													type="text"
													value={term.pos ?? ''}
													oninput={(e) =>
														updateEtymologyTerm(i, {
															pos: (e.currentTarget as HTMLInputElement).value
														})}
													placeholder="使役接尾辞"
													class="w-full rounded border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
												/>
											</div>
										</div>
										<div class="flex flex-wrap gap-2">
											<button
												onclick={() => mergeEtymologyTerm(i)}
												disabled={i >= etymologyTerms.length - 1}
												class="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
												>{m.etym_merge_next_btn()}</button
											>
											<input
												type="text"
												value={etymologySplitInputs[term.uid] ?? ''}
												oninput={(e) =>
													(etymologySplitInputs = {
														...etymologySplitInputs,
														[term.uid]: (e.currentTarget as HTMLInputElement).value
													})}
												placeholder={m.etym_split_placeholder()}
												class="min-w-48 flex-1 rounded border border-slate-300 px-2.5 py-1 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
											/>
											<button
												onclick={() => splitEtymologyTerm(i)}
												class="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
												>{m.etym_split_btn()}</button
											>
										</div>
										<details class="rounded border border-slate-200 bg-white p-3">
											<summary class="cursor-pointer text-xs font-semibold text-slate-600"
												>{m.etym_component_params()}</summary
											>
											<div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
												{#each etymologyComponentParams as param (param)}
													<div>
														<label
															for="ety-{param}-{i}"
															title={etymologyComponentParamHelp[param]}
															class="mb-1 block text-xs font-semibold text-slate-500">{param}</label
														>
														<input
															id="ety-{param}-{i}"
															type="text"
															value={term[param] ?? ''}
															title={etymologyComponentParamHelp[param]}
															oninput={(e) =>
																updateEtymologyTermField(
																	i,
																	param,
																	(e.currentTarget as HTMLInputElement).value
																)}
															class="w-full rounded border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
														/>
													</div>
												{/each}
											</div>
										</details>
									</div>
									<button
										onclick={() => removeEtymologyTerm(i)}
										class="mt-7 text-slate-400 transition-colors hover:text-red-500"
										title={m.etym_remove_term_title()}
									>
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/></svg
										>
									</button>
								</div>
							{/each}
						</div>

						<div
							class="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<button
								onclick={() => (etymologyTerms = [...etymologyTerms, createEtymologyTerm()])}
								class="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
							>
								<svg
									class="mr-2 -ml-1 h-4 w-4 text-slate-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4v16m8-8H4"
									/>
								</svg>
								{m.etym_add_term_btn()}
							</button>

							<div class="flex flex-1 items-center justify-end gap-2">
								<input
									type="text"
									bind:value={etymologyQuickParse}
									onkeydown={(e) => {
										if (e.key === 'Enter') quickParseEtymology();
									}}
									placeholder={m.etym_quick_add_placeholder()}
									class="w-full max-w-sm rounded border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
								/>
								<button
									onclick={quickParseEtymology}
									class="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
								>
									{m.etym_quick_add_btn()}
								</button>
							</div>
						</div>
					</div>

					<div>
						<label for="definitions" class="mb-2 block text-sm font-semibold text-slate-700"
							>{m.definitions_label()}</label
						>
						<textarea
							id="definitions"
							bind:value={definitionsInput}
							rows="4"
							placeholder={m.definitions_placeholder()}
							class="w-full rounded-lg border border-slate-300 px-4 py-3 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
						></textarea>
						{#if definitionDrafts.length > 0}
							<div class="mt-3 border-t border-slate-200 pt-3">
								<div class="flex items-center justify-between gap-3">
									<p class="text-xs font-bold tracking-widest text-slate-400 uppercase">
										{m.definitions_example_assignment_label()}
									</p>
									<span class="text-xs text-slate-500">{definitionDrafts.length}</span>
								</div>
								<div class="mt-2 space-y-1.5">
									{#each definitionDrafts as definition, index (definition.id)}
										<div class="flex items-start justify-between gap-4 py-1">
											<p class="min-w-0 text-sm text-slate-700">{index + 1}. {definition.gloss}</p>
											<span class="shrink-0 text-xs text-slate-500"
												>{definitionExampleCounts[definition.id] ?? 0}</span
											>
										</div>
									{/each}
								</div>
							</div>
						{:else}
							<p class="mt-3 text-sm text-slate-500">{m.examples_assign_no_definitions()}</p>
						{/if}
					</div>

					<div>
						<label for="usage" class="mb-2 block text-sm font-semibold text-slate-700"
							>{m.usage_label()}</label
						>
						<textarea
							id="usage"
							bind:value={usageInput}
							rows="3"
							class="w-full rounded-lg border border-slate-300 px-4 py-3 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
						></textarea>
					</div>

					<section class="space-y-5">
						<div>
							<h2 class="text-xs font-bold tracking-widest text-slate-400 uppercase">
								{m.examples_section()}
							</h2>
							<p class="mt-2 text-sm text-slate-500">{m.examples_section_hint()}</p>
						</div>

						<div class="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
							<div>
								<p class="text-sm font-semibold text-slate-800">
									{m.definitions_example_assignment_label()}
								</p>
								<p class="mt-1 text-xs text-slate-500">{m.examples_assignment_hint()}</p>
							</div>
							<label class="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
								<input
									type="checkbox"
									bind:checked={showOnlyUnassignedExamples}
									class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
								/>
								<span>{m.examples_unassigned_filter_label()}</span>
							</label>
						</div>

						{#if definitionDrafts.length > 0 && visibleUnassignedExamples.length > 0}
							<div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 text-sm">
								<button
									type="button"
									onclick={selectAllVisibleUnassignedExamples}
									class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
								>
									{m.examples_bulk_select_all_label()}
								</button>
								<button
									type="button"
									onclick={clearSelectedUnassignedExamples}
									disabled={selectedUnassignedExampleIds.length === 0}
									class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{m.examples_bulk_clear_selection_label()}
								</button>
								<span class="ml-1 text-xs text-slate-500">
									{selectedUnassignedExampleIds.length}
									{m.examples_bulk_selected_count_label()}
								</span>
								<div class="ml-auto flex flex-wrap gap-2">
									{#each definitionDrafts as definition, index (definition.id)}
										<button
											type="button"
											onclick={() => applyAssignmentToSelectedUnassignedExamples(definition.id)}
											disabled={selectedUnassignedExampleIds.length === 0}
											class="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{m.examples_bulk_assign_prefix()}
											{String.fromCharCode(97 + index)}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<div class="space-y-4">
							<details
								bind:open={showFetchedExamples}
								class="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/80 shadow-sm"
							>
								<summary
									class="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4"
								>
									<div>
										<p class="text-sm font-semibold text-slate-800">{m.fetched_examples_label()}</p>
										<p class="mt-1 text-xs text-slate-500">{m.fetched_examples_hint()}</p>
									</div>
									<div class="flex items-center gap-2">
										<span
											class="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
											>{visibleFetchedExamples.length}</span
										>
										<span class="rounded-full bg-white p-2 text-slate-400 ring-1 ring-slate-200">
											<svg
												class={`h-4 w-4 transition-transform ${showFetchedExamples ? 'rotate-180' : ''}`}
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</span>
									</div>
								</summary>

								<div class="border-t border-slate-200 px-5 py-4">
									<Slider.Root
										class="mb-4 flex flex-col gap-3"
										min={1}
										max={fetchedExampleWordCountSliderMax}
										step={1}
										value={[fetchedExampleMinWords, fetchedExampleMaxWords]}
										aria-label={[
											m.fetched_examples_length_filter_min_label(),
											m.fetched_examples_length_filter_max_label()
										]}
										onValueChange={handleFetchedExampleWordRangeChange}
									>
										<Slider.Label class="text-xs font-medium text-slate-600">
											{m.fetched_examples_length_filter_label()}
										</Slider.Label>
										<Slider.Control class="relative flex h-8 items-center px-2">
											<Slider.Track class="relative h-2 flex-1 rounded-full bg-slate-200">
												<Slider.Range class="absolute h-full rounded-full bg-indigo-500" />
											</Slider.Track>
											<Slider.Thumb
												index={0}
												class="relative z-10 h-5 w-5 rounded-full border-2 border-indigo-600 bg-white shadow-sm transition outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
											>
												<Slider.HiddenInput />
											</Slider.Thumb>
											<Slider.Thumb
												index={1}
												class="relative z-10 h-5 w-5 rounded-full border-2 border-indigo-600 bg-white shadow-sm transition outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
											>
												<Slider.HiddenInput />
											</Slider.Thumb>
										</Slider.Control>
										<Slider.ValueText class="text-center text-xs font-semibold text-slate-800">
											{fetchedExampleMinWords}-{fetchedExampleMaxWords}
											{m.fetched_examples_length_filter_word_unit()}
										</Slider.ValueText>
									</Slider.Root>

									<div class="divide-y divide-slate-200">
										{#if isFetching}
											<div class="py-5 text-sm text-slate-500">{m.fetched_examples_loading()}</div>
										{:else if visibleFetchedExamples.length > 0 || hiddenFetchedExamples.length > 0}
											{#each visibleFetchedExamples as example (example.id)}
												<article class="py-5 first:pt-3 last:pb-3">
													<div class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3">
														{#if !example.assignedDefinitionId}
															<label class="mt-0.5 flex items-center text-slate-600">
																<input
																	type="checkbox"
																	checked={selectedUnassignedExampleIds.includes(example.id)}
																	onchange={() => toggleUnassignedExampleSelection(example.id)}
																	class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
																/>
															</label>
														{:else}
															<span></span>
														{/if}
														<div>
															<p class="text-sm font-semibold text-slate-800">
																{#each highlightHeadwordSegments(example.text, lemmaAnalysis.pageLemma) as segment}
																	<span
																		class:example-headword={segment.isHeadword}
																		class:text-amber-900={segment.isHeadword}
																		class:underline={segment.isHeadword}
																		class:decoration-amber-400={segment.isHeadword}
																		class:decoration-2={segment.isHeadword}
																		class:underline-offset-2={segment.isHeadword}
																		>{segment.text}</span
																	>
																{/each}
															</p>
															<p class="mt-2 text-sm leading-relaxed text-slate-600">
																{#each getTranslationSegments(example.translation) as segment}
																	{#if segment.isWordLike}
																		<button
																			type="button"
																			onclick={() =>
																				toggleTranslationSegment(
																					example.sourceKind,
																					example.id,
																					segment.index
																				)}
																			class={`${translationToggleBaseClass} transition-colors focus:outline-none ${
																				(example.highlightedTranslationIndexes ?? []).includes(
																					segment.index ?? -1
																				)
																					? 'font-semibold text-amber-900 underline decoration-amber-400 decoration-2 underline-offset-2'
																					: 'text-slate-600 hover:underline hover:decoration-slate-300 hover:decoration-2 hover:underline-offset-2'
																			}`}
																		>
																			{segment.text}
																		</button>
																	{:else}
																		<span>{segment.text}</span>
																	{/if}
																{/each}
															</p>
															{#if formatReferenceLabel(example)}
																<p class="mt-3 text-xs leading-relaxed text-slate-500">
																	{formatReferenceLabel(example)}
																</p>
															{/if}
															{#if definitionDrafts.length > 0}
																<div class="mt-3 flex flex-wrap gap-2">
																	{#each definitionDrafts as definition (definition.id)}
																		<button
																			type="button"
																			onclick={() =>
																				setDefinitionAssignment(
																					example.sourceKind,
																					example.id,
																					definition.id
																				)}
																			class={`${assignmentChipBaseClass} ${
																				example.assignedDefinitionId === definition.id
																					? 'border-indigo-600 bg-indigo-600 text-white'
																					: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
																			}`}
																		>
																			{definition.gloss}
																		</button>
																	{/each}
																</div>
															{:else}
																<p class="mt-3 text-sm text-slate-500">
																	{m.examples_assign_no_definitions()}
																</p>
															{/if}
														</div>
													</div>
												</article>
											{/each}
											{#if hiddenFetchedExamples.length > 0}
												<details bind:open={showHiddenFetchedExamples} class="py-4 first:pt-3">
													<summary
														class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700"
													>
														<span
															>{hiddenFetchedExamples.length}
															{m.fetched_examples_hidden_label()}</span
														>
														<span
															class="rounded-full bg-white p-2 text-slate-400 ring-1 ring-slate-200"
														>
															<svg
																class={`h-4 w-4 transition-transform ${showHiddenFetchedExamples ? 'rotate-180' : ''}`}
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M19 9l-7 7-7-7"
																/>
															</svg>
														</span>
													</summary>
													<div
														class="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4 py-1"
													>
														{#each hiddenFetchedExamples as example (example.id)}
															<article class="py-4 first:pt-3 last:pb-3">
																<div
																	class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3"
																>
																	{#if !example.assignedDefinitionId}
																		<label class="mt-0.5 flex items-center text-slate-600">
																			<input
																				type="checkbox"
																				checked={selectedUnassignedExampleIds.includes(example.id)}
																				onchange={() =>
																					toggleUnassignedExampleSelection(example.id)}
																				class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
																			/>
																		</label>
																	{:else}
																		<span></span>
																	{/if}
																	<div>
																		<p
																			class="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800"
																		>
																			<span>
																				{#each highlightHeadwordSegments(example.text, lemmaAnalysis.pageLemma) as segment}
																					<span
																						class:example-headword={segment.isHeadword}
																						class:text-amber-900={segment.isHeadword}
																						class:underline={segment.isHeadword}
																						class:decoration-amber-400={segment.isHeadword}
																						class:decoration-2={segment.isHeadword}
																						class:underline-offset-2={segment.isHeadword}
																						>{segment.text}</span
																					>
																				{/each}
																			</span>
																			<span
																				class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200"
																			>
																				{getSentenceWordCount(example.text)}
																				{m.fetched_examples_length_filter_word_unit()}
																			</span>
																		</p>
																		<p class="mt-2 text-sm leading-relaxed text-slate-600">
																			{#each getTranslationSegments(example.translation) as segment}
																				{#if segment.isWordLike}
																					<button
																						type="button"
																						onclick={() =>
																							toggleTranslationSegment(
																								example.sourceKind,
																								example.id,
																								segment.index
																							)}
																						class={`${translationToggleBaseClass} transition-colors focus:outline-none ${
																							(
																								example.highlightedTranslationIndexes ?? []
																							).includes(segment.index ?? -1)
																								? 'font-semibold text-amber-900 underline decoration-amber-400 decoration-2 underline-offset-2'
																								: 'text-slate-600 hover:underline hover:decoration-slate-300 hover:decoration-2 hover:underline-offset-2'
																						}`}
																					>
																						{segment.text}
																					</button>
																				{:else}
																					<span>{segment.text}</span>
																				{/if}
																			{/each}
																		</p>
																		{#if formatReferenceLabel(example)}
																			<p class="mt-3 text-xs leading-relaxed text-slate-500">
																				{formatReferenceLabel(example)}
																			</p>
																		{/if}
																		{#if definitionDrafts.length > 0}
																			<div class="mt-3 flex flex-wrap gap-2">
																				{#each definitionDrafts as definition (definition.id)}
																					<button
																						type="button"
																						onclick={() =>
																							setDefinitionAssignment(
																								example.sourceKind,
																								example.id,
																								definition.id
																							)}
																						class={`${assignmentChipBaseClass} ${
																							example.assignedDefinitionId === definition.id
																								? 'border-indigo-600 bg-indigo-600 text-white'
																								: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
																						}`}
																					>
																						{definition.gloss}
																					</button>
																				{/each}
																			</div>
																		{:else}
																			<p class="mt-3 text-sm text-slate-500">
																				{m.examples_assign_no_definitions()}
																			</p>
																		{/if}
																	</div>
																</div>
															</article>
														{/each}
													</div>
												</details>
											{/if}
										{:else}
											<div class="py-5 text-sm text-slate-500">{m.fetched_examples_empty()}</div>
										{/if}
									</div>
								</div>
							</details>

							<details
								bind:open={showManualExamples}
								class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100"
							>
								<summary
									class="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4"
								>
									<div>
										<p class="text-sm font-semibold text-slate-800">{m.manual_examples_label()}</p>
										<p class="mt-1 text-xs text-slate-500">{m.manual_example_reference_hint()}</p>
									</div>
									<div class="flex items-center gap-2">
										<span
											class="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
											>{visibleManualExamples.length}</span
										>
										<span class="rounded-full bg-white p-2 text-slate-400 ring-1 ring-slate-200">
											<svg
												class={`h-4 w-4 transition-transform ${showManualExamples ? 'rotate-180' : ''}`}
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</span>
									</div>
								</summary>

								<div class="border-t border-slate-200 px-5 py-4">
									<div class="-mx-5 divide-y divide-slate-300">
										{#each visibleManualExamples as example, index (example.id)}
											<details
												open={openManualExampleIds.includes(example.id)}
												class="px-5 py-5 first:pt-4 last:pb-2"
											>
												<summary
													class="flex cursor-pointer list-none items-start justify-between gap-4"
													onclick={(event) => {
														event.preventDefault();
														toggleManualExampleOpen(example.id);
													}}
												>
													<div class="min-w-0">
														<p class="text-sm font-semibold text-slate-800">
															{m.manual_examples_label()} #{index + 1}
														</p>
														<p class="mt-1 line-clamp-2 text-sm text-slate-500">
															{example.text.trim() || m.manual_example_text_placeholder()}
														</p>
													</div>
													<div class="flex items-center gap-2">
														<button
															type="button"
															onclick={(event) => {
																event.stopPropagation();
																removeManualExample(example.id);
															}}
															class="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
														>
															<svg
																class="h-3.5 w-3.5 shrink-0"
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
																/>
															</svg>
															{m.manual_example_remove_title()}
														</button>
														<span class="rounded-full bg-slate-100 p-2 text-slate-400">
															<svg
																class={`h-4 w-4 transition-transform ${openManualExampleIds.includes(example.id) ? 'rotate-180' : ''}`}
																fill="none"
																viewBox="0 0 24 24"
																stroke="currentColor"
															>
																<path
																	stroke-linecap="round"
																	stroke-linejoin="round"
																	stroke-width="2"
																	d="M19 9l-7 7-7-7"
																/>
															</svg>
														</span>
													</div>
												</summary>
												{#if openManualExampleIds.includes(example.id)}
													<div class="mt-5 space-y-5">
														<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
															<div class="sm:col-span-2">
																<label
																	class="mb-2 block text-sm font-semibold text-slate-700"
																	for="manual-text-{example.id}"
																>
																	{m.manual_example_text_label()}
																</label>
																<textarea
																	id="manual-text-{example.id}"
																	bind:value={example.text}
																	rows="2"
																	placeholder={m.manual_example_text_placeholder()}
																	class="w-full rounded-2xl border border-slate-300 px-4 py-3 shadow-sm transition-colors focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
																></textarea>
															</div>

															<div class="sm:col-span-2">
																<label
																	class="mb-2 block text-sm font-semibold text-slate-700"
																	for="manual-translation-{example.id}"
																>
																	{m.manual_example_translation_label()}
																</label>
																<textarea
																	id="manual-translation-{example.id}"
																	bind:value={example.translation}
																	rows="2"
																	placeholder={m.manual_example_translation_placeholder()}
																	class="w-full rounded-2xl border border-slate-300 px-4 py-3 shadow-sm transition-colors focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
																></textarea>
																<p class="mt-3 text-sm leading-relaxed text-slate-600">
																	{#each getTranslationSegments(example.translation) as segment}
																		{#if segment.isWordLike}
																			<button
																				type="button"
																				onclick={() =>
																					toggleTranslationSegment(
																						'manual',
																						`manual-${example.id}`,
																						segment.index
																					)}
																				class={`${translationToggleBaseClass} transition-colors focus:outline-none ${
																					example.highlightedTranslationIndexes.includes(
																						segment.index ?? -1
																					)
																						? 'font-semibold text-amber-900 underline decoration-amber-400 decoration-2 underline-offset-2'
																						: 'text-slate-600 hover:underline hover:decoration-slate-300 hover:decoration-2 hover:underline-offset-2'
																				}`}
																			>
																				{segment.text}
																			</button>
																		{:else}
																			<span>{segment.text}</span>
																		{/if}
																	{/each}
																</p>
															</div>

															<div class="sm:col-span-2">
																<label
																	class="mb-2 block text-sm font-semibold text-slate-700"
																	for="manual-transliteration-{example.id}"
																>
																	{m.manual_example_transliteration_label()}
																</label>
																<input
																	id="manual-transliteration-{example.id}"
																	type="text"
																	bind:value={example.transliteration}
																	class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
																/>
															</div>
														</div>

														<div class="border-t border-slate-200 pt-5">
															<p class="text-sm font-semibold text-slate-800">
																{m.definitions_example_assignment_label()}
															</p>
															<p class="mt-1 text-xs text-slate-500">
																{m.examples_assignment_hint()}
															</p>
															{#if definitionDrafts.length > 0}
																<div class="mt-3 flex flex-wrap gap-2">
																	{#each definitionDrafts as definition (definition.id)}
																		<button
																			type="button"
																			onclick={() =>
																				setDefinitionAssignment(
																					'manual',
																					`manual-${example.id}`,
																					definition.id
																				)}
																			class={`${assignmentChipBaseClass} ${
																				example.assignedDefinitionId === definition.id
																					? 'border-indigo-600 bg-indigo-600 text-white'
																					: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
																			}`}
																		>
																			{definition.gloss}
																		</button>
																	{/each}
																</div>
															{:else}
																<p class="mt-3 text-sm text-slate-500">
																	{m.examples_assign_no_definitions()}
																</p>
															{/if}
														</div>

														<div class="border-t border-slate-200 pt-5">
															<div
																class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
															>
																<div>
																	<p class="text-sm font-semibold text-slate-800">
																		{m.bibliography_label()}
																	</p>
																	<p class="mt-1 text-xs text-slate-500">
																		{example.citationMode === 'template'
																			? m.bibliography_template_hint()
																			: m.bibliography_raw_hint()}
																	</p>
																</div>
																<div
																	class="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"
																>
																	<button
																		type="button"
																		onclick={() => setCitationMode(example.id, 'template')}
																		class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
																			example.citationMode === 'template'
																				? 'bg-slate-900 text-white shadow-sm'
																				: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
																		}`}
																	>
																		{m.bibliography_mode_template()}
																	</button>
																	<button
																		type="button"
																		onclick={() => setCitationMode(example.id, 'raw')}
																		class={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
																			example.citationMode === 'raw'
																				? 'bg-indigo-600 text-white shadow-sm'
																				: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
																		}`}
																	>
																		{m.bibliography_mode_raw()}
																	</button>
																</div>
															</div>

															{#if example.citationMode === 'template'}
																<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
																	<div>
																		<label
																			class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
																			for="manual-template-{example.id}"
																		>
																			{m.bibliography_template_name_label()}
																		</label>
																		<input
																			id="manual-template-{example.id}"
																			type="text"
																			bind:value={example.source.template}
																			placeholder={m.bibliography_template_name_placeholder()}
																			class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
																		/>
																	</div>
																	<div>
																		<label
																			class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
																			for="manual-author-{example.id}"
																		>
																			{m.bibliography_author_label()}
																		</label>
																		<input
																			id="manual-author-{example.id}"
																			type="text"
																			bind:value={example.source.author}
																			class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
																		/>
																	</div>
																	<div>
																		<label
																			class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
																			for="manual-title-{example.id}"
																		>
																			{m.bibliography_title_label()}
																		</label>
																		<input
																			id="manual-title-{example.id}"
																			type="text"
																			bind:value={example.source.title}
																			class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
																		/>
																	</div>
																	<div>
																		<label
																			class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
																			for="manual-book-{example.id}"
																		>
																			{m.bibliography_book_label()}
																		</label>
																		<input
																			id="manual-book-{example.id}"
																			type="text"
																			bind:value={example.source.book}
																			class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
																		/>
																	</div>
																	<div
																		class="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)]"
																	>
																		<div>
																			<label
																				class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
																				for="manual-year-{example.id}"
																			>
																				{m.bibliography_year_label()}
																			</label>
																			<input
																				id="manual-year-{example.id}"
																				type="text"
																				bind:value={example.source.year}
																				class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
																			/>
																		</div>
																		<div>
																			<label
																				class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
																				for="manual-url-{example.id}"
																			>
																				{m.bibliography_url_label()}
																			</label>
																			<input
																				id="manual-url-{example.id}"
																				type="url"
																				bind:value={example.source.url}
																				class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
																			/>
																		</div>
																	</div>
																	<div class="sm:col-span-2">
																		<label
																			class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase"
																			for="manual-extra-params-{example.id}"
																		>
																			{m.bibliography_extra_params_label()}
																		</label>
																		<textarea
																			id="manual-extra-params-{example.id}"
																			bind:value={example.source.extraParams}
																			rows="2"
																			placeholder={m.bibliography_extra_params_placeholder()}
																			class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-indigo-500"
																		></textarea>
																	</div>
																</div>
															{:else}
																<textarea
																	id="manual-raw-{example.id}"
																	bind:value={example.referenceMarkup}
																	rows="4"
																	placeholder={m.bibliography_raw_placeholder()}
																	class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm shadow-sm transition-colors focus:border-indigo-500 focus:ring-indigo-500"
																></textarea>
															{/if}
														</div>
													</div>
												{/if}
											</details>
										{/each}
									</div>

									<div class="-mx-5 mt-4 border-t border-slate-300 px-5 pt-4">
										<button
											type="button"
											onclick={addManualExample}
											class="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900"
										>
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M12 4v16m8-8H4"
												/>
											</svg>
											<span>{m.manual_example_add_btn()}</span>
										</button>
									</div>
								</div>
							</details>
						</div>
					</section>

					<!-- Related Terms -->
					<section>
						<h2
							class="mb-6 border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase"
						>
							{m.related_header()}
						</h2>
						<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
							<div>
								<label for="derived" class="mb-2 block text-sm font-semibold text-slate-700"
									>{m.derived_label()}</label
								>
								<input
									type="text"
									id="derived"
									bind:value={derivedInput}
									class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								/>
							</div>
							<div>
								<label for="related" class="mb-2 block text-sm font-semibold text-slate-700"
									>{m.related_label()}</label
								>
								<input
									type="text"
									id="related"
									bind:value={relatedInput}
									class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								/>
							</div>
							<div>
								<label for="synonyms" class="mb-2 block text-sm font-semibold text-slate-700"
									>{m.synonyms_label()}</label
								>
								<input
									type="text"
									id="synonyms"
									bind:value={synonymsInput}
									class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								/>
							</div>
							<div>
								<label for="antonyms" class="mb-2 block text-sm font-semibold text-slate-700"
									>{m.antonyms_label()}</label
								>
								<input
									type="text"
									id="antonyms"
									bind:value={antonymsInput}
									class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								/>
							</div>
						</div>
					</section>

					<!-- Metadata -->
					<section>
						<h2
							class="mb-6 border-b border-slate-100 pb-2 text-xs font-bold tracking-widest text-slate-400 uppercase"
						>
							{m.metadata_section()}
						</h2>
						<div>
							<label for="dialects" class="mb-2 block text-sm font-semibold text-slate-700"
								>{m.dialects_label()}</label
							>
							<input
								type="text"
								id="dialects"
								bind:value={dialectsInput}
								placeholder={m.dialects_placeholder()}
								class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
						</div>
					</section>
				</section>
			</div>
			<!-- End space-y-10 -->
		</div>
		<!-- End scroll-wrapper -->
	</div>
	<!-- End left column -->

	<!-- Right Column: Output Preview -->
	<div
		class="z-20 flex min-h-screen w-full flex-col overflow-hidden border-t border-slate-800 bg-slate-900 text-slate-100 shadow-2xl lg:h-screen lg:w-1/2 lg:border-t-0 lg:border-l"
	>
		<div
			class="z-10 flex flex-col gap-4 border-b border-slate-800 bg-slate-900/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-5"
		>
			<h2 class="text-xs font-bold tracking-widest text-slate-400 uppercase">
				{m.output_title()}
			</h2>
			<div
				class="inline-flex self-start rounded-lg border border-slate-700/60 bg-slate-950/45 p-1 shadow-lg shadow-slate-950/20 lg:self-auto"
			>
				<button
					type="button"
					onclick={() => (outputTab = 'code')}
					class={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold tracking-[0.14em] uppercase transition-all ${
						outputTab === 'code'
							? 'bg-slate-200 text-slate-950 shadow-sm'
							: 'text-slate-300 hover:bg-slate-800/90 hover:text-slate-50'
					}`}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.8"
							d="M8 9l-3 3 3 3m8-6l3 3-3 3M13 7l-2 10"
						/>
					</svg>
					<span>{previewLabels.code}</span>
				</button>
				<button
					type="button"
					onclick={() => (outputTab = 'preview')}
					class={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold tracking-[0.14em] uppercase transition-all ${
						outputTab === 'preview'
							? 'bg-[#c8d7e6] text-slate-950 shadow-sm'
							: 'text-slate-300 hover:bg-slate-800/90 hover:text-slate-50'
					}`}
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.8"
							d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m-9 4h8a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
					<span>{previewLabels.preview}</span>
				</button>
			</div>
		</div>

		<div
			class="custom-scrollbar relative flex-1 overflow-visible bg-slate-900 p-4 sm:p-6 lg:overflow-auto lg:p-8"
		>
			{#if outputTab === 'code'}
				<div class="space-y-6">
					{#each generatedPages as page (page.kind + ':' + page.term)}
						<section class="generated-entry-block">
							<div class="generated-entry-titlebar">
								<div>
									<div class="generated-entry-title-line">
										<h3>{page.term || '...'}</h3>
									</div>
									{#if getGeneratedPageLabel(page.kind)}
										<div class="generated-entry-note">{getGeneratedPageLabel(page.kind)}</div>
									{/if}
								</div>
								<div class="generated-entry-actions">
									<label class="generated-entry-separator-toggle">
										<input
											type="checkbox"
											checked={isEntrySeparatorEnabled(page.kind, page.term)}
											onchange={(event) =>
												setEntrySeparator(page.kind, page.term, event.currentTarget.checked)}
										/>
										<span>{m.add_separator()}</span>
									</label>
									<a
										href={page.url}
										target="_blank"
										rel="noopener noreferrer"
										title={getEditTitle(page)}
										class="generated-entry-action generated-entry-action-secondary"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.8"
												d={editIconPath}
											/>
										</svg>
										{m.edit_on_wiktionary()}
									</a>
									<button
										type="button"
										onclick={() => copyGeneratedPage(page)}
										title={getCopyTitle(page)}
										class="generated-entry-action generated-entry-action-primary"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.8"
												d={copyIconPath}
											/>
										</svg>
										{copiedPageKey === getPageKey(page) ? m.copied() : m.copy_code()}
									</button>
								</div>
							</div>
							<pre
								class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-slate-300 selection:bg-indigo-500/30 selection:text-indigo-200">{page.wikitext}</pre>
						</section>
					{/each}
				</div>
			{:else if hasPreviewContent}
				<div class="wiktionary-preview p-2 sm:p-4">
					<div class="generated-page-heading">
						<div>
							<div class="generated-entry-title-line">
								<h3>{lemmaAnalysis.pageLemma || '...'}</h3>
							</div>
						</div>
						<div class="generated-entry-actions">
							<label class="generated-entry-separator-toggle">
								<input
									type="checkbox"
									checked={isEntrySeparatorEnabled(generatedPages[0].kind, generatedPages[0].term)}
									onchange={(event) =>
										setEntrySeparator(
											generatedPages[0].kind,
											generatedPages[0].term,
											event.currentTarget.checked
										)}
								/>
								<span>{m.add_separator()}</span>
							</label>
							<a
								href={editUrl}
								target="_blank"
								rel="noopener noreferrer"
								title={getEditTitle({ term: lemmaAnalysis.pageLemma, kind: 'main' })}
								class="generated-entry-action generated-entry-action-secondary"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.8"
										d={editIconPath}
									/>
								</svg>
								{m.edit_on_wiktionary()}
							</a>
							<button
								type="button"
								onclick={() => copyGeneratedPage(generatedPages[0])}
								title={getCopyTitle(generatedPages[0])}
								class="generated-entry-action generated-entry-action-primary"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.8"
										d={copyIconPath}
									/>
								</svg>
								{copiedPageKey === getPageKey(generatedPages[0]) ? m.copied() : m.copy_code()}
							</button>
						</div>
					</div>
					<div class="mw-content-ltr mw-parser-output" lang={isEnglish ? 'en' : 'ja'} dir="ltr">
						<div class="mw-heading mw-heading2">
							<h2>{previewLabels.language}</h2>
						</div>

						{#if !isEnglish}
							<p>
								<a href={editUrl} target="_blank" rel="noopener noreferrer">カナ表記</a>
								<span class="ain-kana-sample">{lemmaAnalysis.pageLemma || '...'}</span>
							</p>
						{/if}

						<div class="mw-heading mw-heading3">
							<h3>{previewLabels.pronunciation}</h3>
						</div>
						<ul>
							<li>
								{#if isEnglish}
									<a
										href="https://en.wikipedia.org/wiki/International_Phonetic_Alphabet"
										target="_blank"
										rel="noopener noreferrer">IPA</a
									>:
									<span
										>{(accentUnknown ? lemmaAnalysis.pageLemma : lemmaAnalysis.accentedLemma) ||
											'...'}</span
									>
								{:else}
									<a
										href="https://ja.wikipedia.org/wiki/%E5%9B%BD%E9%9A%9B%E9%9F%B3%E5%A3%B0%E8%A8%98%E5%8F%B7"
										target="_blank"
										rel="noopener noreferrer">IPA</a
									>:
									<span
										>{(accentUnknown ? lemmaAnalysis.pageLemma : lemmaAnalysis.accentedLemma) ||
											'...'}</span
									>
								{/if}
							</li>
						</ul>

						{#if alternativeForms.length > 0}
							<div class="mw-heading mw-heading3">
								<h3>{isEnglish ? 'Alternative forms' : '別形'}</h3>
							</div>
							<ul>
								{#each alternativeForms as item}
									<li>
										<a href={getTermUrl(item.term)} target="_blank" rel="noopener noreferrer">
											<span class="Latn wikilink" lang="ain">{item.term}</span>
										</a>
										{#if item.tran}<span class="mention-gloss-double-quote">"</span><span
												class="mention-gloss">{item.tran}</span
											><span class="mention-gloss-double-quote">"</span>{/if}
									</li>
								{/each}
							</ul>
						{/if}

						{#if previewEtymology.length > 0}
							<div class="mw-heading mw-heading3">
								<h3>{previewLabels.etymology}</h3>
							</div>
							<p class="etymology-line">
								{#each previewEtymology as item, index}
									<a href={getTermUrl(item.term)} target="_blank" rel="noopener noreferrer">
										<i class="Latn mention wikilink" lang="ain">{item.alt || item.term}</i>
									</a>
									{#if item.pos}
										<span class="annotation-paren">(</span><span class="ann-pos">{item.pos}</span
										><span class="annotation-paren">)</span>
									{/if}
									{#if item.tran}
										<span class="mention-gloss-double-quote">"</span><span class="mention-gloss"
											>{item.tran}</span
										><span class="mention-gloss-double-quote">"</span>
									{/if}
									{#if index < previewEtymology.length - 1}
										<span class="etymology-separator"> + </span>
									{/if}
								{/each}
							</p>
						{/if}

						<div class="mw-heading mw-heading3">
							<h3>{getPosLabel(pos)}</h3>
						</div>
						<p>
							<strong class="Latn headword" lang="ain"
								>{(!accentUnknown && lemmaAnalysis.explicitException
									? lemmaAnalysis.accentedLemma
									: lemmaAnalysis.pageLemma) || '...'}</strong
							>
							{#if getHeadwordQualifiers().length > 0}
								<span class="ib-brac"> (</span>
								<span class="ib-content">{getHeadwordQualifiers().join(', ')}</span>
								<span class="ib-brac">)</span>
							{/if}
						</p>

						{#if previewDefinitions.length > 0}
							<ol>
								{#each previewDefinitions as definition, definitionIndex}
									<li>
										{definition.gloss}
										{#if definition.examples && definition.examples.length > 0}
											<ul>
												{#each definition.examples as example, exampleIndex}
													<li>
														<div class="h-quotation">
															<span class="Latn e-quotation" lang="ain">
																{#each highlightHeadwordSegments(example.text, lemmaAnalysis.pageLemma) as segment}
																	<span class:example-headword={segment.isHeadword}
																		>{segment.text}</span
																	>
																{/each}
															</span>
															{#if getExampleReferenceNumber(definitionIndex, exampleIndex)}
																<sup class="reference"
																	>[{getExampleReferenceNumber(definitionIndex, exampleIndex)}]</sup
																>
															{/if}
															<dl>
																{#if example.transliteration}
																	<dd>
																		<span class="e-transliteration">{example.transliteration}</span>
																	</dd>
																{/if}
																<dd>
																	<span class="e-translation">
																		{#each highlightTranslationSegments(example.translation, example.highlightedTranslationIndexes, example.highlightedTranslationParts) as segment}
																			<span
																				class:example-translation-highlight={segment.isHighlighted}
																				>{segment.text}</span
																			>
																		{/each}
																	</span>
																</dd>
															</dl>
														</div>
													</li>
												{/each}
											</ul>
										{/if}
									</li>
								{/each}
							</ol>
						{/if}

						{#if entry.declension?.forms.length}
							<div class="mw-heading mw-heading4">
								<h4>{previewLabels.declension}</h4>
							</div>
							<div class="declension-preview">
								<div class="declension-preview-title">
									{entry.declension.alienable
										? m.declension_alienable_label()
										: m.declension_inalienable_label()}
								</div>
								<div class="declension-preview-template">
									{`{{${entry.declension.alienable ? 'ain-decl-alnb' : 'ain-decl-inal'}|${entry.declension.forms.join('|')}}}`}
								</div>
							</div>
						{/if}

						{#if entry.usage}
							<div class="mw-heading mw-heading4">
								<h4>{previewLabels.usage}</h4>
							</div>
							<p class="usage-note">{entry.usage}</p>
						{/if}

						{#each previewRelatedGroups as group}
							{#if group.items.length > 0}
								<div class="mw-heading mw-heading4">
									<h4>{group.title}</h4>
								</div>
								<ul>
									{#each group.items as item}
										<li>
											<a href={getTermUrl(item.term)} target="_blank" rel="noopener noreferrer">
												<span class="Latn wikilink" lang="ain">{item.term}</span>
											</a>{#if item.tran}<span class="mention-gloss-double-quote">"</span><span
													class="mention-gloss">{item.tran}</span
												><span class="mention-gloss-double-quote">"</span>{/if}
										</li>
									{/each}
								</ul>
							{/if}
						{/each}

						{#if previewReferenceItems.length > 0}
							<div class="mw-heading mw-heading3">
								<h3>{previewLabels.references}</h3>
							</div>
							<div class="reflist">
								<ol class="references">
									{#each previewReferenceItems as reference}
										<li>{reference}</li>
									{/each}
								</ol>
							</div>
						{/if}
					</div>

					{#each generatedPages.slice(1) as page (page.kind + ':' + page.term)}
						{#if page.formEntry}
							{@const formEntry = page.formEntry}
							{@const formLemma = analyzeAinuLemma(formEntry.lemma)}
							{@const formPos = getFormPreviewPos(formEntry)}
							<div class="generated-page-heading generated-page-heading-spaced">
								<div>
									<div class="generated-entry-title-line">
										<h3>{page.term}</h3>
									</div>
									<div class="generated-entry-note">{getGeneratedPageLabel(page.kind)}</div>
								</div>
								<div class="generated-entry-actions">
									<label class="generated-entry-separator-toggle">
										<input
											type="checkbox"
											checked={isEntrySeparatorEnabled(page.kind, page.term)}
											onchange={(event) =>
												setEntrySeparator(page.kind, page.term, event.currentTarget.checked)}
										/>
										<span>{m.add_separator()}</span>
									</label>
									<a
										href={page.url}
										target="_blank"
										rel="noopener noreferrer"
										title={getEditTitle(page)}
										class="generated-entry-action generated-entry-action-secondary"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.8"
												d={editIconPath}
											/>
										</svg>
										{m.edit_on_wiktionary()}
									</a>
									<button
										type="button"
										onclick={() => copyGeneratedPage(page)}
										title={getCopyTitle(page)}
										class="generated-entry-action generated-entry-action-primary"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="1.8"
												d={copyIconPath}
											/>
										</svg>
										{copiedPageKey === getPageKey(page) ? m.copied() : m.copy_code()}
									</button>
								</div>
							</div>
							<div class="mw-content-ltr mw-parser-output" lang={isEnglish ? 'en' : 'ja'} dir="ltr">
								<div class="mw-heading mw-heading2">
									<h2>{previewLabels.language}</h2>
								</div>

								{#if !isEnglish}
									<p>
										<a href={page.url} target="_blank" rel="noopener noreferrer">カナ表記</a>
										<span class="ain-kana-sample">{formLemma.pageLemma || '...'}</span>
									</p>
								{/if}

								<div class="mw-heading mw-heading3">
									<h3>{previewLabels.pronunciation}</h3>
								</div>
								<ul>
									<li>
										<a
											href={isEnglish
												? 'https://en.wikipedia.org/wiki/International_Phonetic_Alphabet'
												: 'https://ja.wikipedia.org/wiki/%E5%9B%BD%E9%9A%9B%E9%9F%B3%E5%A3%B0%E8%A8%98%E5%8F%B7'}
											target="_blank"
											rel="noopener noreferrer">IPA</a
										>:
										<span>{formLemma.accentedLemma || formLemma.pageLemma || '...'}</span>
									</li>
								</ul>

								<div class="mw-heading mw-heading3">
									<h3>{getPosLabel(formPos)}</h3>
								</div>
								<p>
									<strong class="Latn headword" lang="ain">{formLemma.pageLemma || '...'}</strong>
								</p>
								<ol>
									{#each getFormPreviewDefinitions(formEntry) as definition, index}
										{@const sourceTerm =
											formEntry.kind === 'possessed' && formEntry.sourceTerms?.[index]
												? formEntry.sourceTerms[index]
												: { lemma: formEntry.sourceLemma }}
										<li>
											<a
												href={getTermUrl(sourceTerm.lemma)}
												target="_blank"
												rel="noopener noreferrer"
											>
												<i class="Latn mention" lang="ain">{sourceTerm.lemma}</i>
											</a>
											{definition}
										</li>
									{/each}
								</ol>
							</div>
						{/if}
					{/each}
				</div>
			{:else}
				<div
					class="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-sm text-slate-500"
				>
					{previewLabels.noContent}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Custom scrollbar for the dark theme preview area */
	.custom-scrollbar::-webkit-scrollbar {
		width: 10px;
		height: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #0f172a;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #334155;
		border-radius: 5px;
		border: 2px solid #0f172a;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #475569;
	}

	/* Light scrollbar for editor */
	.custom-scrollbar-light::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}
	.custom-scrollbar-light::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar-light::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 4px;
	}
	.custom-scrollbar-light::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}

	.wiktionary-preview {
		--wiki-text: #dbe4ef;
		--wiki-muted: #a7b4c3;
		--wiki-rule: rgba(167, 180, 195, 0.28);
		--wiki-link: #9ebfe0;
		--wiki-link-hover: #c2d7ec;
		--wiki-accent: #e8eef5;
		font-family: Georgia, 'Times New Roman', Times, serif;
		line-height: 1.6;
		background: transparent;
		color: var(--wiki-text);
	}

	.wiktionary-preview .mw-parser-output {
		max-width: 60rem;
		margin: 0 auto;
		background: transparent;
	}

	.wiktionary-preview .generated-page-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		max-width: 60rem;
		margin: 0 auto 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(51, 65, 85, 0.85);
	}

	.wiktionary-preview .generated-page-heading-spaced {
		margin-top: 2rem;
		padding-top: 1.25rem;
		border-top: 1px solid rgba(51, 65, 85, 0.85);
	}

	.generated-entry-block {
		border-top: 1px solid rgba(71, 85, 105, 0.78);
		padding-top: 1.15rem;
		padding-bottom: 1.65rem;
	}

	.generated-entry-block:first-child {
		border-top: 0;
		padding-top: 0;
	}

	.generated-entry-titlebar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.generated-entry-title-line {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.generated-entry-title-line h3 {
		margin: 0;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 1rem;
		font-weight: 650;
		line-height: 1.25;
		color: #f8fafc;
	}

	.generated-entry-note {
		margin-top: 0.2rem;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #94a3b8;
	}

	.generated-entry-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.generated-entry-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.42rem;
		min-height: 2rem;
		border-radius: 0.55rem;
		padding: 0.45rem 0.75rem;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 0.72rem;
		font-weight: 750;
		line-height: 1;
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		transition:
			background-color 140ms ease,
			border-color 140ms ease,
			color 140ms ease;
	}

	.generated-entry-action-primary {
		border: 1px solid rgb(99 102 241);
		background: rgb(79 70 229);
		color: white;
	}

	.generated-entry-action-primary:hover {
		background: rgb(99 102 241);
		color: white;
	}

	.generated-entry-action-secondary {
		border: 1px solid rgb(71 85 105);
		background: rgba(15, 23, 42, 0.72);
		color: #c7d2fe;
	}

	.generated-entry-action-secondary:hover {
		border-color: rgb(129 140 248);
		background: rgba(30, 41, 59, 0.95);
		color: #e0e7ff;
	}

	.generated-entry-separator-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2rem;
		border: 1px solid rgba(71, 85, 105, 0.82);
		border-radius: 0.55rem;
		padding: 0.4rem 0.65rem;
		font-family: ui-sans-serif, system-ui, sans-serif;
		font-size: 0.72rem;
		font-weight: 650;
		color: #cbd5e1;
		cursor: pointer;
	}

	.generated-entry-separator-toggle input {
		width: 0.85rem;
		height: 0.85rem;
		accent-color: rgb(99 102 241);
	}

	@media (max-width: 640px) {
		.generated-entry-titlebar,
		.wiktionary-preview .generated-page-heading {
			flex-direction: column;
			align-items: stretch;
		}

		.generated-entry-actions {
			justify-content: flex-start;
		}
	}

	.wiktionary-preview h2,
	.wiktionary-preview h3,
	.wiktionary-preview h4 {
		margin: 0;
		font-weight: 400;
		line-height: 1.3;
		color: var(--wiki-accent);
	}

	.wiktionary-preview .mw-heading2,
	.wiktionary-preview .mw-heading3,
	.wiktionary-preview .mw-heading4 {
		border-bottom: 1px solid var(--wiki-rule);
		margin-top: 1rem;
		padding-bottom: 0.2rem;
	}

	.wiktionary-preview .mw-heading2 {
		margin-top: 0;
	}

	.wiktionary-preview .mw-heading2 h2 {
		letter-spacing: 0.01em;
	}

	.wiktionary-preview .mw-heading3 h3,
	.wiktionary-preview .mw-heading4 h4 {
		font-weight: 600;
	}

	.wiktionary-preview h2 {
		font-size: 1.5rem;
	}

	.wiktionary-preview h3 {
		font-size: 1.15rem;
	}

	.wiktionary-preview h4 {
		font-size: 1rem;
	}

	.wiktionary-preview p,
	.wiktionary-preview ul,
	.wiktionary-preview ol,
	.wiktionary-preview dl {
		margin: 0.5rem 0 0;
	}

	.wiktionary-preview ul,
	.wiktionary-preview ol {
		padding-left: 1.5rem;
	}

	.wiktionary-preview li + li {
		margin-top: 0.35rem;
	}

	.wiktionary-preview a {
		color: var(--wiki-link);
		text-decoration: none;
	}

	.wiktionary-preview a:hover {
		color: var(--wiki-link-hover);
		text-decoration: underline;
	}

	.wiktionary-preview .headword {
		font-size: 1.25rem;
		font-weight: 700;
		color: #f2f6fb;
	}

	.wiktionary-preview .ain-kana-sample {
		display: inline-block;
		margin-left: 0.5rem;
		color: var(--wiki-muted);
	}

	.wiktionary-preview .ib-brac,
	.wiktionary-preview .ib-content,
	.wiktionary-preview .annotation-paren,
	.wiktionary-preview .mention-gloss-double-quote {
		color: var(--wiki-muted);
	}

	.wiktionary-preview .ann-pos,
	.wiktionary-preview .mention-gloss,
	.wiktionary-preview .e-translation {
		color: var(--wiki-accent);
	}

	.wiktionary-preview .e-transliteration {
		color: var(--wiki-muted);
		font-style: italic;
	}

	.wiktionary-preview .example-headword {
		font-weight: 700;
		color: #f2f6fb;
	}

	.wiktionary-preview .Latn,
	.wiktionary-preview .mention,
	.wiktionary-preview .e-quotation {
		font-style: italic;
	}

	.wiktionary-preview .wikilink {
		color: var(--wiki-link);
	}

	.wiktionary-preview .h-quotation {
		margin-top: 0.35rem;
	}

	.wiktionary-preview .h-quotation dl {
		margin-top: 0.2rem;
	}

	.wiktionary-preview .h-quotation dd {
		margin-left: 1rem;
	}

	.wiktionary-preview .reference {
		margin-left: 0.2rem;
		color: var(--wiki-link);
		font-style: normal;
	}

	.wiktionary-preview .reflist {
		font-size: 0.95rem;
	}

	.wiktionary-preview .reflist ol {
		padding-left: 1.75rem;
	}

	.wiktionary-preview .declension-preview {
		margin-top: 0.6rem;
		border: 1px solid var(--wiki-rule);
		border-radius: 0.45rem;
		padding: 0.65rem 0.8rem;
		background: rgba(15, 23, 42, 0.34);
		font-family: ui-sans-serif, system-ui, sans-serif;
	}

	.wiktionary-preview .declension-preview-title {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--wiki-muted);
	}

	.wiktionary-preview .declension-preview-template {
		margin-top: 0.35rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.82rem;
		color: var(--wiki-accent);
		overflow-wrap: anywhere;
	}

	.wiktionary-preview .usage-note {
		white-space: pre-wrap;
	}

	.wiktionary-preview .etymology-separator {
		color: var(--wiki-muted);
	}
</style>
