<script lang="ts">
	import {
		renderWikitext,
		type AinuEntry,
		type PartOfSpeech,
		type LinkMeta,
		type Example,
		type Definition
	} from '$lib/utils/wikitext';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	let lemma = $state('');
	let pos = $state<PartOfSpeech>('noun');

	// Verb specific
	let transitivityCode = $state<0 | 1 | 2 | 3>(2);
	let pluralForm = $state('');

	// Noun specific
	let possessiveForm = $state('');

	// General
	let subType = $state('');
	let etymologyInput = $state('');
	let definitionsInput = $state('');
	let usageInput = $state('');
	let dialectsInput = $state('');

	// Related Terms
	let derivedInput = $state('');
	let relatedInput = $state('');
	let synonymsInput = $state('');
	let antonymsInput = $state('');

	let addSeparator = $state(false);

	let copied = $state(false);

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

	let fetchedExamples = $state<Example[]>([]);
	let isFetching = $state(false);

	// Derived state for the entry object
	let entry = $derived<AinuEntry>({
		lemma,
		pos,
		pos_args: {
			transitivity: pos === 'verb' ? transitivityCode : undefined,
			plural: pos === 'verb' && pluralForm ? pluralForm : undefined,
			possessive: pos === 'noun' && possessiveForm ? possessiveForm : undefined
		},
		sub_type: subType || undefined,
		etymology: parseLinkMeta(etymologyInput),
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

			if (defs.length === 0 && fetchedExamples.length > 0) {
				defs.push({ gloss: '{{rfdef|ain}}' });
			}

			if (defs.length > 0 && fetchedExamples.length > 0) {
				// Attach examples to the first definition
				defs[0].examples = fetchedExamples;
			}

			return defs;
		})(),
		pronunciation: { ipa: true },
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
				ref: ex.title
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
		const term = lemma; // capture dependency
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			fetchExamples(term);
		}, 500);
		return () => clearTimeout(debounceTimer);
	});

	let wikitext = $derived(renderWikitext(entry, getLocale()));

	function copyToClipboard() {
		navigator.clipboard.writeText(wikitext).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}
</script>

<div
	class="flex h-screen flex-col bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 lg:flex-row"
>
	<!-- Left Column: Input Editor -->
	<div
		class="z-10 flex h-screen w-full flex-col border-r border-slate-200 bg-white shadow-xl lg:w-1/2"
	>
		<div class="custom-scrollbar-light flex-1 overflow-y-auto p-8">
			<header class="mb-10 flex items-start justify-between">
				<div>
					<h1 class="text-3xl font-extrabold tracking-tight text-slate-900">{m.title()}</h1>
					<p class="mt-2 text-sm font-medium text-slate-500">{m.subtitle()}</p>
				</div>
				<div class="flex flex-col items-end space-y-3">
					<LanguageSwitcher />
					<!-- Placeholder for Parse Term button -->
					<button
						disabled
						class="cursor-not-allowed rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
						title="Not yet implemented"
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
						<!-- Lemma -->
						<div class="sm:col-span-2">
							<label for="lemma" class="mb-2 block text-sm font-semibold text-slate-700"
								>{m.lemma_label()}</label
							>
							<input
								type="text"
								id="lemma"
								bind:value={lemma}
								placeholder={m.lemma_placeholder()}
								class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
							/>
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
						<label for="etymology" class="mb-2 block text-sm font-semibold text-slate-700"
							>{m.etymology_label()}</label
						>
						<input
							type="text"
							id="etymology"
							bind:value={etymologyInput}
							placeholder={m.etymology_placeholder()}
							class="w-full rounded-lg border border-slate-300 px-4 py-2.5 shadow-sm transition-colors duration-200 ease-in-out focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
						/>
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
			</div>
			<!-- End space-y-10 -->
		</div>
		<!-- End scroll-wrapper -->
	</div>
	<!-- End left column -->

	<!-- Right Column: Output Preview -->
	<div
		class="z-20 flex h-screen w-full flex-col overflow-hidden border-l border-slate-800 bg-slate-900 text-slate-100 shadow-2xl lg:w-1/2"
	>
		<div
			class="z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-8 py-5 shadow-sm backdrop-blur"
		>
			<h2 class="text-xs font-bold tracking-widest text-slate-400 uppercase">
				{m.preview_title()}
			</h2>
			<div class="flex items-center space-x-6">
				{#if lemma}
					<a
						href={`https://ja.wiktionary.org/w/index.php?title=${lemma}&action=edit`}
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

		<div class="custom-scrollbar flex-1 overflow-auto bg-slate-900 p-8">
			<pre
				class="font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-slate-300 selection:bg-indigo-500/30 selection:text-indigo-200">{wikitext}</pre>
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
</style>
