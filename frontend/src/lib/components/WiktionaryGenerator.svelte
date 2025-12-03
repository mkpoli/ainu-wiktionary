<script lang="ts">
  import { renderWikitext, type AinuEntry, type PartOfSpeech, type LinkMeta } from '$lib/utils/wikitext';
  import * as m from '$lib/paraglide/messages';
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

  let copied = $state(false);

  function parseLinkMeta(input: string): LinkMeta[] {
    if (!input) return [];
    return input.split(',').map(s => {
      const match = s.trim().match(/^([^(]+)(?:\(([^)]+)\))?$/);
      if (match) {
        return { term: match[1].trim(), tran: match[2]?.trim() };
      }
      return { term: s.trim() };
    }).filter(l => l.term);
  }

  // Derived state for the entry object
  let entry = $derived<AinuEntry>({
    lemma,
    pos,
    pos_args: {
      transitivity: pos === 'verb' ? transitivityCode : undefined,
      plural: pos === 'verb' && pluralForm ? pluralForm : undefined,
      possessive: pos === 'noun' && possessiveForm ? possessiveForm : undefined,
    },
    sub_type: subType || undefined,
    etymology: parseLinkMeta(etymologyInput),
    derived: parseLinkMeta(derivedInput),
    related: parseLinkMeta(relatedInput),
    synonyms: parseLinkMeta(synonymsInput),
    antonyms: parseLinkMeta(antonymsInput),
    dialects: dialectsInput ? dialectsInput.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    usage: usageInput || undefined,
    definitions: definitionsInput
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => ({ gloss: line.trim() })),
    pronunciation: { ipa: true }
  });

  let wikitext = $derived(renderWikitext(entry));

  function copyToClipboard() {
    navigator.clipboard.writeText(wikitext).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }
</script>

<div class="flex flex-col lg:flex-row h-screen bg-gray-50 text-gray-900 font-sans">
  <!-- Left Column: Input Editor -->
  <div class="w-full lg:w-1/2 p-6 overflow-y-auto border-r border-gray-200 bg-white">
    <header class="mb-8 flex justify-between items-start">
      <div>
        <h1 class="text-2xl font-bold text-indigo-600">{m.title()}</h1>
        <p class="text-sm text-gray-500 mt-1">{m.subtitle()}</p>
      </div>
      <div class="flex flex-col items-end space-y-2">
          <LanguageSwitcher />
          <!-- Placeholder for Parse Term button -->
          <button disabled class="text-xs bg-gray-100 text-gray-400 px-3 py-1 rounded cursor-not-allowed" title="Not yet implemented">
            {m.parse_term_todo()}
          </button>
      </div>
    </header>

    <div class="space-y-8">
      <!-- Basic Info Section -->
      <section>
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{m.basic_info()}</h2>
        
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- Lemma -->
          <div class="sm:col-span-2">
            <label for="lemma" class="block text-sm font-medium text-gray-700 mb-1">{m.lemma_label()}</label>
            <input
              type="text"
              id="lemma"
              bind:value={lemma}
              placeholder="e.g. omante"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <!-- Part of Speech -->
          <div>
            <label for="pos" class="block text-sm font-medium text-gray-700 mb-1">{m.pos_label()}</label>
            <select
              id="pos"
              bind:value={pos}
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white"
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
          </div>

          <!-- Sub Type -->
          <div>
            <label for="subType" class="block text-sm font-medium text-gray-700 mb-1">{m.sub_type_label()}</label>
            <input
              type="text"
              id="subType"
              bind:value={subType}
              placeholder="e.g. 位置名詞, 格助詞"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
      </section>

      <!-- POS Specific Section -->
      {#if pos === 'verb'}
      <section class="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
        <h2 class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">{m.verb_details()}</h2>
        
        <div class="space-y-4">
          <div>
            <span class="block text-sm font-medium text-gray-700 mb-2">{m.transitivity_label()}</span>
            <div class="flex flex-wrap gap-4">
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={0} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">{m.trans_complete()}</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={1} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">{m.trans_intr()}</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={2} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">{m.trans_trans()}</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={3} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">{m.trans_ditrans()}</span>
              </label>
            </div>
          </div>

          <div>
            <label for="plural" class="block text-sm font-medium text-gray-700 mb-1">{m.plural_label()}</label>
            <input
              type="text"
              id="plural"
              bind:value={pluralForm}
              placeholder="e.g. oman"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>
      </section>
      {/if}

      {#if pos === 'noun'}
      <section class="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
        <h2 class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">{m.noun_details()}</h2>
        <div>
            <label for="possessive" class="block text-sm font-medium text-gray-700 mb-1">{m.possessive_label()}</label>
            <input
              type="text"
              id="possessive"
              bind:value={possessiveForm}
              placeholder="e.g. ku-..."
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
        </div>
      </section>
      {/if}

      <!-- Etymology & Definitions -->
      <section>
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pt-4 border-t border-gray-100">{m.content_section()}</h2>
        
        <div class="space-y-4">
          <div>
            <label for="etymology" class="block text-sm font-medium text-gray-700 mb-1">{m.etymology_label()}</label>
            <input
              type="text"
              id="etymology"
              bind:value={etymologyInput}
              placeholder="e.g. oman, -te"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
            <p class="mt-1 text-xs text-gray-500">{m.etymology_hint()}</p>
          </div>

          <div>
            <label for="definitions" class="block text-sm font-medium text-gray-700 mb-1">{m.definitions_label()}</label>
            <textarea
              id="definitions"
              bind:value={definitionsInput}
              rows="4"
              placeholder={m.definitions_placeholder()}
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            ></textarea>
          </div>
          
          <div>
            <label for="usage" class="block text-sm font-medium text-gray-700 mb-1">{m.usage_label()}</label>
            <textarea
              id="usage"
              bind:value={usageInput}
              rows="3"
              placeholder={m.usage_placeholder()}
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Related Terms -->
      <section>
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pt-4 border-t border-gray-100">{m.related_terms_section()}</h2>
        <p class="text-xs text-gray-500 mb-4">{m.related_terms_hint()}</p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
                <label for="derived" class="block text-sm font-medium text-gray-700 mb-1">{m.derived_label()}</label>
                <input type="text" id="derived" bind:value={derivedInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
                <label for="related" class="block text-sm font-medium text-gray-700 mb-1">{m.related_label()}</label>
                <input type="text" id="related" bind:value={relatedInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
                <label for="synonyms" class="block text-sm font-medium text-gray-700 mb-1">{m.synonyms_label()}</label>
                <input type="text" id="synonyms" bind:value={synonymsInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
                <label for="antonyms" class="block text-sm font-medium text-gray-700 mb-1">{m.antonyms_label()}</label>
                <input type="text" id="antonyms" bind:value={antonymsInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
        </div>
      </section>
      
      <!-- Metadata -->
      <section>
          <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pt-4 border-t border-gray-100">{m.metadata_section()}</h2>
          <div>
            <label for="dialects" class="block text-sm font-medium text-gray-700 mb-1">{m.dialects_label()}</label>
            <input
              type="text"
              id="dialects"
              bind:value={dialectsInput}
              placeholder={m.dialects_placeholder()}
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>
      </section>
    </div>
  </div>

  <!-- Right Column: Output Preview -->
  <div class="w-full lg:w-1/2 bg-gray-900 text-gray-100 flex flex-col h-screen overflow-hidden">
    <div class="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 shadow-sm z-10">
      <h2 class="text-sm font-semibold tracking-wide text-gray-300">{m.preview_title()}</h2>
      <button
        onclick={copyToClipboard}
        class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
      >
        {#if copied}
          <svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {m.copied()}
        {:else}
          <svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {m.copy_code()}
        {/if}
      </button>
    </div>
    
    <div class="flex-1 p-6 overflow-auto custom-scrollbar">
      <pre class="font-mono text-sm leading-relaxed text-gray-300 whitespace-pre-wrap break-all">{wikitext}</pre>
    </div>
  </div>
</div>

<style>
  /* Custom scrollbar for the dark theme preview area */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #1f2937; 
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #4b5563; 
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #6b7280; 
  }
</style>
