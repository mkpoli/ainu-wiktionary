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

  let addSeparator = $state(false);

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
    pronunciation: { ipa: true },
    addSeparator
  });

  let wikitext = $derived(renderWikitext(entry));

  function copyToClipboard() {
    navigator.clipboard.writeText(wikitext).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }
</script>

<div class="flex flex-col lg:flex-row h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
  <!-- Left Column: Input Editor -->
  <div class="w-full lg:w-1/2 flex flex-col h-screen border-r border-slate-200 bg-white shadow-xl z-10">
    <div class="flex-1 overflow-y-auto p-8 custom-scrollbar-light">
      <header class="mb-10 flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">{m.title()}</h1>
          <p class="text-sm text-slate-500 mt-2 font-medium">{m.subtitle()}</p>
        </div>
        <div class="flex flex-col items-end space-y-3">
            <LanguageSwitcher />
            <!-- Placeholder for Parse Term button -->
            <button disabled class="text-xs font-semibold bg-slate-100 text-slate-400 px-3 py-1.5 rounded-full cursor-not-allowed border border-slate-200" title="Not yet implemented">
              {m.parse_term_todo()}
            </button>
        </div>
      </header>

      <div class="space-y-10">
        <!-- Basic Info Section -->
        <section>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">{m.basic_info()}</h2>
          
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <!-- Lemma -->
            <div class="sm:col-span-2">
              <label for="lemma" class="block text-sm font-semibold text-slate-700 mb-2">{m.lemma_label()}</label>
              <input
                type="text"
                id="lemma"
                bind:value={lemma}
                placeholder="e.g. omante"
                class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out"
              />
            </div>

            <!-- Part of Speech -->
            <div>
              <label for="pos" class="block text-sm font-semibold text-slate-700 mb-2">{m.pos_label()}</label>
              <div class="relative">
                <select
                  id="pos"
                  bind:value={pos}
                  class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border bg-white appearance-none transition-colors duration-200 ease-in-out"
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
                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <!-- Sub Type -->
            <div>
              <label for="subType" class="block text-sm font-semibold text-slate-700 mb-2">{m.sub_type_label()}</label>
              <input
                type="text"
                id="subType"
                bind:value={subType}
                placeholder="e.g. 位置名詞, 格助詞"
                class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out"
              />
            </div>
          </div>
        </section>

      <!-- POS Specific Section -->
      {#if pos === 'verb'}
      <section class="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 transition-all duration-300 ease-in-out">
        <h2 class="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-6">{m.verb_details()}</h2>
        
        <div class="space-y-6">
          <div>
            <span class="block text-sm font-semibold text-slate-700 mb-3">{m.transitivity_label()}</span>
            <div class="flex flex-wrap gap-3">
              <label class="inline-flex items-center cursor-pointer group">
                <input type="radio" bind:group={transitivityCode} value={0} class="text-indigo-600 focus:ring-indigo-500 border-slate-300 transition duration-150 ease-in-out" />
                <span class="ml-2 text-sm text-slate-700 group-hover:text-indigo-700 transition-colors">{m.trans_complete()}</span>
              </label>
              <label class="inline-flex items-center cursor-pointer group">
                <input type="radio" bind:group={transitivityCode} value={1} class="text-indigo-600 focus:ring-indigo-500 border-slate-300 transition duration-150 ease-in-out" />
                <span class="ml-2 text-sm text-slate-700 group-hover:text-indigo-700 transition-colors">{m.trans_intr()}</span>
              </label>
              <label class="inline-flex items-center cursor-pointer group">
                <input type="radio" bind:group={transitivityCode} value={2} class="text-indigo-600 focus:ring-indigo-500 border-slate-300 transition duration-150 ease-in-out" />
                <span class="ml-2 text-sm text-slate-700 group-hover:text-indigo-700 transition-colors">{m.trans_trans()}</span>
              </label>
              <label class="inline-flex items-center cursor-pointer group">
                <input type="radio" bind:group={transitivityCode} value={3} class="text-indigo-600 focus:ring-indigo-500 border-slate-300 transition duration-150 ease-in-out" />
                <span class="ml-2 text-sm text-slate-700 group-hover:text-indigo-700 transition-colors">{m.trans_ditrans()}</span>
              </label>
            </div>
          </div>

          <div>
            <label for="plural" class="block text-sm font-semibold text-slate-700 mb-2">{m.plural_label()}</label>
            <input
              type="text"
              id="plural"
              bind:value={pluralForm}
              placeholder="e.g. oman"
              class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out"
            />
          </div>
        </div>
      </section>
      {/if}

      {#if pos === 'noun'}
      <section class="bg-indigo-50/50 p-6 rounded-xl border border-indigo-100 transition-all duration-300 ease-in-out">
        <h2 class="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-6">{m.noun_details()}</h2>
        <div>
            <label for="possessive" class="block text-sm font-semibold text-slate-700 mb-2">{m.possessive_label()}</label>
            <input
              type="text"
              id="possessive"
              bind:value={possessiveForm}
              placeholder="e.g. ku-..."
              class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out"
            />
        </div>
      </section>
      {/if}

      <!-- Etymology & Definitions -->
      <section class="space-y-6">
        <div>
          <label for="etymology" class="block text-sm font-semibold text-slate-700 mb-2">{m.etymology_label()}</label>
          <input
            type="text"
            id="etymology"
            bind:value={etymologyInput}
            placeholder="e.g. japan(rice)"
            class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out"
          />
        </div>

        <div>
          <label for="definitions" class="block text-sm font-semibold text-slate-700 mb-2">{m.definitions_label()}</label>
          <textarea
            id="definitions"
            bind:value={definitionsInput}
            rows="4"
            placeholder="One definition per line"
            class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-3 border transition-colors duration-200 ease-in-out"
          ></textarea>
        </div>

        <div>
          <label for="usage" class="block text-sm font-semibold text-slate-700 mb-2">{m.usage_label()}</label>
          <textarea
            id="usage"
            bind:value={usageInput}
            rows="3"
            class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-3 border transition-colors duration-200 ease-in-out"
          ></textarea>
        </div>
      </section>

      <!-- Related Terms -->
      <section>
        <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">{m.related_header()}</h2>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
                <label for="derived" class="block text-sm font-semibold text-slate-700 mb-2">{m.derived_label()}</label>
                <input type="text" id="derived" bind:value={derivedInput} class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out" />
            </div>
            <div>
                <label for="related" class="block text-sm font-semibold text-slate-700 mb-2">{m.related_label()}</label>
                <input type="text" id="related" bind:value={relatedInput} class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out" />
            </div>
            <div>
                <label for="synonyms" class="block text-sm font-semibold text-slate-700 mb-2">{m.synonyms_label()}</label>
                <input type="text" id="synonyms" bind:value={synonymsInput} class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out" />
            </div>
            <div>
                <label for="antonyms" class="block text-sm font-semibold text-slate-700 mb-2">{m.antonyms_label()}</label>
                <input type="text" id="antonyms" bind:value={antonymsInput} class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out" />
            </div>
        </div>
      </section>
      
      <!-- Metadata -->
      <section>
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">{m.metadata_section()}</h2>
          <div>
            <label for="dialects" class="block text-sm font-semibold text-slate-700 mb-2">{m.dialects_label()}</label>
            <input
              type="text"
              id="dialects"
              bind:value={dialectsInput}
              placeholder={m.dialects_placeholder()}
              class="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2.5 border transition-colors duration-200 ease-in-out"
            />
          </div>
      </section>
      </div> <!-- End space-y-10 -->
    </div> <!-- End scroll-wrapper -->
  </div> <!-- End left column -->

  <!-- Right Column: Output Preview -->
  <div class="w-full lg:w-1/2 bg-slate-900 text-slate-100 flex flex-col h-screen overflow-hidden border-l border-slate-800 shadow-2xl z-20">
    <div class="flex items-center justify-between px-8 py-5 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-sm z-10">
      <h2 class="text-xs font-bold tracking-widest text-slate-400 uppercase">{m.preview_title()}</h2>
      <div class="flex items-center space-x-6">
        <label class="inline-flex items-center cursor-pointer group">
            <input type="checkbox" bind:checked={addSeparator} class="form-checkbox h-4 w-4 text-indigo-500 transition duration-150 ease-in-out bg-slate-800 border-slate-600 rounded focus:ring-offset-slate-900 focus:ring-indigo-500" />
            <span class="ml-2 text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">{m.add_separator()}</span>
        </label>
        <button
            onclick={copyToClipboard}
            class="inline-flex items-center px-4 py-2 border border-transparent text-xs font-bold uppercase tracking-wide rounded-lg shadow-lg text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all duration-200 transform hover:scale-105 active:scale-95"
        >
            {#if copied}
            <svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            {m.copied()}
            {:else}
            <svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {m.copy_code()}
            {/if}
        </button>
      </div>
    </div>
    
    <div class="flex-1 p-8 overflow-auto custom-scrollbar bg-slate-900">
      <pre class="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap break-all selection:bg-indigo-500/30 selection:text-indigo-200">{wikitext}</pre>
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
