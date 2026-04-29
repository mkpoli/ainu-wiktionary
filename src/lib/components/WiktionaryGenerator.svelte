<script lang="ts">
	import {
		analyzeAinuLemma,
		renderWikitext,
		splitAinuSyllables,
		type AinuEntry,
		type PartOfSpeech,
		type LinkMeta,
		type Example,
		type Definition
	} from '$lib/utils/wikitext';
	import {
		applyAinuEtymologyPreset,
		parseAinuEtymologyInput,
		suggestAinuLemmaEtymology
	} from '$lib/utils/ainuEtymology';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import { browser } from '$app/environment';

	type CitationMode = 'template' | 'raw';
	type ManualExampleInput = {
		id: number;
		text: string;
		translation: string;
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

	let nextManualExampleId = 1;

	function createManualExample(id = nextManualExampleId++): ManualExampleInput {
		return {
			id,
			text: '',
			translation: '',
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

	let lemma = $state('');
	let manualAccentPosition = $state<number | undefined>();
	let accentUnknown = $state(false);
	let pos = $state<PartOfSpeech>('noun');

	// Verb specific
	let transitivityCode = $state<0 | 1 | 2 | 3>(2);
	let pluralForm = $state('');

	// Noun specific
	let possessiveForm = $state('');

	// General
	let subType = $state('');
	let etymologyTerms = $state<LinkMeta[]>([{ term: '' }]);
	let etymologyQuickParse = $state('');
	let definitionsInput = $state('');
	let usageInput = $state('');
	let dialectsInput = $state('');

	let manualExamples = $state<ManualExampleInput[]>([createManualExample()]);

	// Related Terms
	let derivedInput = $state('');
	let relatedInput = $state('');
	let synonymsInput = $state('');
	let antonymsInput = $state('');

	let addSeparator = $state(false);
	let outputTab = $state<'code' | 'preview'>('code');

	let copied = $state(false);

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
					if (data.transitivityCode !== undefined) transitivityCode = data.transitivityCode;
					if (data.pluralForm !== undefined) pluralForm = data.pluralForm;
					if (data.possessiveForm !== undefined) possessiveForm = data.possessiveForm;
					if (data.subType !== undefined) subType = data.subType;
					if (data.etymologyTerms !== undefined) etymologyTerms = data.etymologyTerms;
					if (data.etymologyQuickParse !== undefined)
						etymologyQuickParse = data.etymologyQuickParse;
					if (data.definitionsInput !== undefined) definitionsInput = data.definitionsInput;
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
				transitivityCode,
				pluralForm,
				possessiveForm,
				subType,
				etymologyTerms: $state.snapshot(etymologyTerms),
				etymologyQuickParse,
				definitionsInput,
				usageInput,
				manualExamples: $state.snapshot(manualExamples),
				dialectsInput,
				derivedInput,
				relatedInput,
				synonymsInput,
				antonymsInput,
				addSeparator
			};
			sessionStorage.setItem('wiktionary_state', JSON.stringify(state));
		}
	});

	function parseLinkMeta(input: string): LinkMeta[] {
		if (!input) return [];
		return input
			.split(',')
			.map((s) => {
				const match = s.trim().match(/^([^(]+)(?:\(([^)]+)\))?$/);
				if (match) {
					return { term: match[1].trim(), tran: match[2]?.trim() };
				}
				return { term: s.trim() };
			})
			.filter((l) => l.term);
	}

	function quickParseEtymology() {
		const parsed = parseAinuEtymologyInput(etymologyQuickParse);
		if (parsed.length > 0) {
			etymologyTerms = [...etymologyTerms, ...parsed];
			etymologyQuickParse = '';
		}
	}

	function updateEtymologyTerm(index: number, patch: Partial<LinkMeta>, shouldApplyPreset = false) {
		etymologyTerms = etymologyTerms.map((term, i) => {
			if (i !== index) return term;
			const nextTerm = { ...term, ...patch };
			return shouldApplyPreset ? applyAinuEtymologyPreset(nextTerm) : nextTerm;
		});
	}

	function hasEtymologyTermValue(term: LinkMeta): boolean {
		return Boolean(term.term.trim() || term.alt?.trim() || term.tran?.trim() || term.pos?.trim());
	}

	function parseEtymologyFromLemma() {
		if (etymologyHasInput || lemmaEtymologySuggestions.length === 0) return;
		etymologyTerms = lemmaEtymologySuggestions;
	}

	function removeEtymologyTerm(index: number) {
		const nextTerms = etymologyTerms.filter((_, idx) => idx !== index);
		etymologyTerms = nextTerms.length > 0 ? nextTerms : [{ term: '' }];
	}

	function addManualExample() {
		manualExamples = [...manualExamples, createManualExample()];
	}

	function removeManualExample(id: number) {
		const nextExamples = manualExamples.filter((example) => example.id !== id);
		manualExamples = nextExamples.length > 0 ? nextExamples : [createManualExample()];
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
				text,
				translation,
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
			text,
			translation,
			transliteration: transliteration || undefined,
			source: Object.values(source).some(Boolean) ? source : undefined
		};
	}

	let fetchedExamples = $state<Example[]>([]);
	let isFetching = $state(false);
	let showFetchedExamples = $state(false);
	let showManualExamples = $state(true);
	let manualExamplesOutput = $derived.by(() => {
		const output: Example[] = [];
		for (const example of manualExamples) {
			const normalized = normalizeManualExample(example);
			if (normalized) output.push(normalized);
		}
		return output;
	});
	let allExamples = $derived([...manualExamplesOutput, ...fetchedExamples]);
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

	// Derived state for the entry object
	let entry = $derived<AinuEntry>({
		lemma,
		accentPosition,
		pos,
		pos_args: {
			transitivity: pos === 'verb' ? transitivityCode : undefined,
			plural: pos === 'verb' && pluralForm ? pluralForm : undefined,
			possessive: pos === 'noun' && possessiveForm ? possessiveForm : undefined
		},
		sub_type: subType || undefined,
		etymology: etymologyTerms.filter((t) => t.term.trim() !== ''),
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
			const defs: Definition[] = definitionsInput
				.split('\n')
				.filter((line) => line.trim() !== '')
				.map((line) => ({ gloss: line.trim() }));

			if (defs.length === 0 && allExamples.length > 0) {
				defs.push({ gloss: '{{rfdef|ain}}' });
			}

			if (defs.length > 0 && allExamples.length > 0) {
				// Attach examples to the first definition
				defs[0].examples = allExamples;
			}

			return defs;
		})(),
		pronunciation: { ipa: true, accentKnown: !accentUnknown },
		addSeparator
	});

	async function fetchExamples(term: string) {
		if (!term) {
			fetchedExamples = [];
			return;
		}
		isFetching = true;
		try {
			const res = await fetch(`/api/examples/${encodeURIComponent(term)}`);
			if (!res.ok) throw new Error('Failed to fetch');
			const data = (await res.json()) as { examples: any[] };
			fetchedExamples = data.examples.map((ex: any) => ({
				text: ex.ain,
				translation: ex.jpn,
				source: {
					author: ex.author || undefined,
					title: ex.title || undefined,
					book: ex.book || undefined,
					year: ex.date ? String(ex.date) : undefined,
					url: ex.url || undefined
				}
			}));
		} catch (e) {
			console.error('Failed to fetch examples', e);
			fetchedExamples = [];
		} finally {
			isFetching = false;
		}
	}

	let debounceTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const term = lemmaAnalysis.pageLemma; // capture dependency
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchExamples(term);
		}, 500);
		return () => clearTimeout(debounceTimer);
	});

	let wikitext = $derived(renderWikitext(entry, getLocale()));
	let editUrl = $derived(
		`https://${getLocale()}.wiktionary.org/w/index.php?title=${lemmaAnalysis.pageLemma}&action=edit`
	);
	let isEnglish = $derived(getLocale() === 'en');
	let previewLabels = $derived({
		code: isEnglish ? 'Code' : 'コード',
		preview: isEnglish ? 'Preview' : 'プレビュー',
		language: isEnglish ? 'Ainu' : 'アイヌ語',
		pronunciation: isEnglish ? 'Pronunciation' : '発音',
		etymology: isEnglish ? 'Etymology' : '語源',
		usage: isEnglish ? 'Usage' : '用法',
		examples: isEnglish ? 'Examples' : '例文',
		references: isEnglish ? 'References' : '出典',
		noContent: isEnglish
			? 'Fill in the form to see a preview.'
			: 'フォームを入力するとプレビューが表示されます。'
	});
	let previewEtymology = $derived(entry.etymology?.filter((item) => item.term.trim()) ?? []);
	let previewDefinitions = $derived(entry.definitions.filter((item) => item.gloss.trim()));
	let previewRelatedGroups = $derived([
		{ title: m.derived_label(), items: entry.derived ?? [] },
		{ title: m.related_label(), items: entry.related ?? [] },
		{ title: m.synonyms_label(), items: entry.synonyms ?? [] },
		{ title: m.antonyms_label(), items: entry.antonyms ?? [] }
	]);
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
			case 'verb':
				return m.pos_verb();
			case 'adj':
				return m.pos_adj();
			case 'adv':
				return m.pos_adv();
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
		}
	}

	function getTransitivityQualifier(code: 0 | 1 | 2 | 3): string[] {
		if (isEnglish) {
			switch (code) {
				case 0:
					return ['complete verb'];
				case 1:
					return ['intransitive', 'class 1'];
				case 2:
					return ['transitive', 'class 2'];
				case 3:
					return ['ditransitive', 'class 3'];
			}
		}

		switch (code) {
			case 0:
				return ['完全'];
			case 1:
				return ['自動詞', '1項動詞'];
			case 2:
				return ['他動詞', '2項動詞'];
			case 3:
				return ['二重他動詞', '3項動詞'];
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

	function getExampleReferenceNumber(definitionIndex: number, exampleIndex: number): number | null {
		let count = 0;
		for (let i = 0; i <= definitionIndex; i += 1) {
			const definition = previewDefinitions[i];
			if (!definition?.examples) continue;
			for (let j = 0; j < definition.examples.length; j += 1) {
				const example = definition.examples[j];
				if (!formatReferenceLabel(example)) continue;
				count += 1;
				if (i === definitionIndex && j === exampleIndex) {
					return count;
				}
			}
		}
		return null;
	}

	function getTermUrl(term: string): string {
		return `https://${getLocale()}.wiktionary.org/wiki/${encodeURIComponent(term.replaceAll(' ', '_'))}`;
	}

	let previewReferenceItems = $derived(
		previewDefinitions.flatMap((definition) =>
			(definition.examples ?? [])
				.map((example) => formatReferenceLabel(example))
				.filter((label) => label.trim())
		)
	);

	function copyToClipboard() {
		navigator.clipboard.writeText(wikitext).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}
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
					<button
						disabled
						class="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
						title="Reserved for Wiktionary entry parsing"
					>
						{m.parse_term_todo()}
					</button>
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
												{#each syllables as syllable}
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
						<div>
							<label for="pos" class="mb-2 block text-sm font-semibold text-slate-700"
								>{m.pos_label()}</label
							>
							<div class="relative">
								<select
									id="pos"
									bind:value={pos}
									class="w-full appearance-none rounded-lg border border-slate-300 bg-white px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
								>
									<option value="noun">{m.pos_noun()}</option>
									<option value="verb">{m.pos_verb()}</option>
									<option value="adj">{m.pos_adj()}</option>
									<option value="adv">{m.pos_adv()}</option>
									<option value="participle">{m.pos_participle()}</option>
									<option value="aux">{m.pos_aux()}</option>
									<option value="particle">{m.pos_particle()}</option>
									<option value="pron">{m.pos_pron()}</option>
									<option value="prep">{m.pos_prep()}</option>
									<option value="conj">{m.pos_conj()}</option>
									<option value="interj">{m.pos_interj()}</option>
									<option value="root">{m.pos_root()}</option>
									<option value="prefix">{m.pos_prefix()}</option>
									<option value="suffix">{m.pos_suffix()}</option>
								</select>
								<div
									class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500"
								>
									<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 9l-7 7-7-7"
										></path></svg
									>
								</div>
							</div>
						</div>

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
					</div>
				</section>

				<!-- POS Specific Section -->
				{#if pos === 'verb'}
					<section
						class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 transition-all duration-300 ease-in-out"
					>
						<h2 class="mb-6 text-xs font-bold tracking-widest text-indigo-500 uppercase">
							{m.verb_details()}
						</h2>

						<div class="space-y-6">
							<div>
								<span class="mb-3 block text-sm font-semibold text-slate-700"
									>{m.transitivity_label()}</span
								>
								<div class="flex flex-wrap gap-3">
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
						</div>
					</section>
				{/if}

				{#if pos === 'noun'}
					<section
						class="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 transition-all duration-300 ease-in-out"
					>
						<h2 class="mb-6 text-xs font-bold tracking-widest text-indigo-500 uppercase">
							{m.noun_details()}
						</h2>
						<div>
							<label for="possessive" class="mb-2 block text-sm font-semibold text-slate-700"
								>{m.possessive_label()}</label
							>
							<input
								type="text"
								id="possessive"
								bind:value={possessiveForm}
								placeholder={m.possessive_placeholder()}
								class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
						</div>
					</section>
				{/if}

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

						<div class="space-y-4">
							{#each etymologyTerms as term, i}
								<div
									class="flex items-start gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-300"
								>
									<div class="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
												for="ety-alt-{i}"
												class="mb-1 block text-xs font-semibold text-slate-500"
												>{m.etym_alt_label()}</label
											>
											<input
												id="ety-alt-{i}"
												type="text"
												bind:value={term.alt}
												placeholder="-TE"
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
												bind:value={term.tran}
												placeholder="causative"
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
												bind:value={term.pos}
												placeholder="suffix"
												class="w-full rounded border border-slate-300 px-3 py-2 text-sm transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
											/>
										</div>
									</div>
									<button
										onclick={() => removeEtymologyTerm(i)}
										class="mt-6 text-slate-400 transition-colors hover:text-red-500"
										title={m.etym_remove_term_title()}
									>
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</div>
							{/each}
						</div>

						<div
							class="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<button
								onclick={() => (etymologyTerms = [...etymologyTerms, { term: '' }])}
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
											>{fetchedExamples.length}</span
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

								<div class="divide-y divide-slate-200 border-t border-slate-200 px-5 py-2">
									{#if isFetching}
										<div class="py-5 text-sm text-slate-500">{m.fetched_examples_loading()}</div>
									{:else if fetchedExamples.length > 0}
										{#each fetchedExamples as example}
											<article class="py-5 first:pt-3 last:pb-3">
												<p class="text-sm font-semibold text-slate-800">{example.text}</p>
												<p class="mt-2 text-sm text-slate-600">{example.translation}</p>
												{#if formatReferenceLabel(example)}
													<p class="mt-3 text-xs leading-relaxed text-slate-500">
														{formatReferenceLabel(example)}
													</p>
												{/if}
											</article>
										{/each}
									{:else}
										<div class="py-5 text-sm text-slate-500">{m.fetched_examples_empty()}</div>
									{/if}
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
											>{manualExamples.length}</span
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
									<div
										class="flex items-center justify-between gap-3 border-b border-slate-200 pb-4"
									>
										<p class="text-sm font-semibold text-slate-700">{m.manual_examples_label()}</p>
										<button
											type="button"
											onclick={addManualExample}
											class="inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
										>
											<svg
												class="mr-1.5 h-3.5 w-3.5"
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
											{m.manual_example_add_btn()}
										</button>
									</div>

									<div class="divide-y divide-slate-200">
										{#each manualExamples as example, index (example.id)}
											<article class="py-5 first:pt-4 last:pb-2">
												<div class="flex items-start justify-between gap-4">
													<div>
														<p class="text-sm font-semibold text-slate-800">
															{m.manual_examples_label()} #{index + 1}
														</p>
														<p class="mt-1 text-xs text-slate-500">
															{m.manual_example_reference_hint()}
														</p>
													</div>
													<button
														type="button"
														onclick={() => removeManualExample(example.id)}
														class="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
														title={m.manual_example_remove_title()}
													>
														<svg
															class="h-5 w-5"
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
													</button>
												</div>

												<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

													<div class="border-t border-slate-200 pt-4 sm:col-span-2">
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
											</article>
										{/each}
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
				{m.preview_title()}
			</h2>
			<div class="flex flex-wrap items-center gap-3 sm:gap-4 lg:justify-end">
				{#if lemma}
					<a
						href={editUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="border-b border-transparent pb-0.5 text-xs font-medium text-indigo-400 transition-colors hover:border-indigo-300 hover:text-indigo-300"
					>
						{m.edit_on_wiktionary()}
					</a>
				{/if}
				<label class="group inline-flex cursor-pointer items-center">
					<input
						type="checkbox"
						bind:checked={addSeparator}
						class="form-checkbox h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 transition duration-150 ease-in-out focus:ring-indigo-500 focus:ring-offset-slate-900"
					/>
					<span
						class="ml-2 text-xs font-medium text-slate-400 transition-colors group-hover:text-slate-300"
						>{m.add_separator()}</span
					>
				</label>
				<button
					onclick={copyToClipboard}
					class="inline-flex transform items-center rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-xs font-bold tracking-wide text-white uppercase shadow-lg transition-all duration-200 hover:scale-105 hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none active:scale-95"
				>
					{#if copied}
						<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
						{m.copied()}
					{:else}
						<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
							/>
						</svg>
						{m.copy_code()}
					{/if}
				</button>
			</div>
		</div>

		<div
			class="custom-scrollbar relative flex-1 overflow-visible bg-slate-900 p-4 sm:p-6 lg:overflow-auto lg:p-8"
		>
			<div class="pointer-events-none sticky top-0 z-20 -mt-2 mb-4 flex justify-end">
				<div
					class="pointer-events-auto inline-flex rounded-lg border border-slate-700/60 bg-slate-900/85 p-1 shadow-lg shadow-slate-950/30 backdrop-blur"
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
			{#if outputTab === 'code'}
				<pre
					class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-slate-300 selection:bg-indigo-500/30 selection:text-indigo-200">{wikitext}</pre>
			{:else if hasPreviewContent}
				<div class="wiktionary-preview p-2 sm:p-4">
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
															<span class="Latn e-quotation" lang="ain">{example.text}</span>
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
																<dd><span class="e-translation">{example.translation}</span></dd>
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

	.wiktionary-preview .usage-note {
		white-space: pre-wrap;
	}

	.wiktionary-preview .etymology-separator {
		color: var(--wiki-muted);
	}
</style>
