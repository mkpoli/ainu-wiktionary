<script lang="ts">
  import { renderWikitext, type AinuEntry, type PartOfSpeech, type LinkMeta } from '$lib/utils/wikitext';

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
    <header class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-indigo-600">Ainu Wiktionary Helper</h1>
        <p class="text-sm text-gray-500 mt-1">Generate standard Wiktionary entries.</p>
      </div>
      <!-- Placeholder for Parse Term button -->
      <button disabled class="text-xs bg-gray-100 text-gray-400 px-3 py-1 rounded cursor-not-allowed" title="Not yet implemented">
        Parse Term (TODO)
      </button>
    </header>

    <div class="space-y-8">
      <!-- Basic Info Section -->
      <section>
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Basic Info</h2>
        
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- Lemma -->
          <div class="sm:col-span-2">
            <label for="lemma" class="block text-sm font-medium text-gray-700 mb-1">Word (Lemma)</label>
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
            <label for="pos" class="block text-sm font-medium text-gray-700 mb-1">Part of Speech</label>
            <select
              id="pos"
              bind:value={pos}
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white"
            >
              <option value="noun">Noun</option>
              <option value="verb">Verb</option>
              <option value="adj">Adjective</option>
              <option value="adv">Adverb</option>
              <option value="participle">Participle</option>
              <option value="aux">Auxiliary</option>
              <option value="particle">Particle</option>
              <option value="pron">Pronoun</option>
              <option value="prep">Preposition</option>
              <option value="conj">Conjunction</option>
              <option value="interj">Interjection</option>
              <option value="root">Root</option>
              <option value="prefix">Prefix</option>
              <option value="suffix">Suffix</option>
            </select>
          </div>

          <!-- Sub Type -->
          <div>
            <label for="subType" class="block text-sm font-medium text-gray-700 mb-1">Sub Type / Context</label>
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
        <h2 class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Verb Details</h2>
        
        <div class="space-y-4">
          <div>
            <span class="block text-sm font-medium text-gray-700 mb-2">Transitivity</span>
            <div class="flex flex-wrap gap-4">
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={0} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">0 (Complete)</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={1} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">1 (Intr)</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={2} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">2 (Trans)</span>
              </label>
              <label class="inline-flex items-center">
                <input type="radio" bind:group={transitivityCode} value={3} class="text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                <span class="ml-2 text-sm text-gray-700">3 (Ditrans)</span>
              </label>
            </div>
          </div>

          <div>
            <label for="plural" class="block text-sm font-medium text-gray-700 mb-1">Plural Form</label>
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
        <h2 class="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Noun Details</h2>
        <div>
            <label for="possessive" class="block text-sm font-medium text-gray-700 mb-1">Possessive Form</label>
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
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pt-4 border-t border-gray-100">Content</h2>
        
        <div class="space-y-4">
          <div>
            <label for="etymology" class="block text-sm font-medium text-gray-700 mb-1">Etymology Components</label>
            <input
              type="text"
              id="etymology"
              bind:value={etymologyInput}
              placeholder="e.g. oman, -te"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>

          <div>
            <label for="definitions" class="block text-sm font-medium text-gray-700 mb-1">Definitions</label>
            <textarea
              id="definitions"
              bind:value={definitionsInput}
              rows="4"
              placeholder="Enter definitions, one per line..."
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            ></textarea>
          </div>
          
          <div>
            <label for="usage" class="block text-sm font-medium text-gray-700 mb-1">Usage Notes</label>
            <textarea
              id="usage"
              bind:value={usageInput}
              rows="3"
              placeholder="Usage notes..."
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            ></textarea>
          </div>
        </div>
      </section>

      <!-- Related Terms -->
      <section>
        <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pt-4 border-t border-gray-100">Related Terms</h2>
        <p class="text-xs text-gray-500 mb-4">Format: term (translation), term2</p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
                <label for="derived" class="block text-sm font-medium text-gray-700 mb-1">Derived Terms</label>
                <input type="text" id="derived" bind:value={derivedInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
                <label for="related" class="block text-sm font-medium text-gray-700 mb-1">Related Terms</label>
                <input type="text" id="related" bind:value={relatedInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
                <label for="synonyms" class="block text-sm font-medium text-gray-700 mb-1">Synonyms</label>
                <input type="text" id="synonyms" bind:value={synonymsInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
            <div>
                <label for="antonyms" class="block text-sm font-medium text-gray-700 mb-1">Antonyms</label>
                <input type="text" id="antonyms" bind:value={antonymsInput} class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border" />
            </div>
        </div>
      </section>
      
      <!-- Metadata -->
      <section>
          <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 pt-4 border-t border-gray-100">Metadata</h2>
          <div>
            <label for="dialects" class="block text-sm font-medium text-gray-700 mb-1">Dialects</label>
            <input
              type="text"
              id="dialects"
              bind:value={dialectsInput}
              placeholder="e.g. 沙流, 千歳"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
            />
          </div>
      </section>
    </div>
  </div>

  <!-- Right Column: Output Preview -->
  <div class="w-full lg:w-1/2 bg-gray-900 text-gray-100 flex flex-col h-screen overflow-hidden">
    <div class="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700 shadow-sm z-10">
      <h2 class="text-sm font-semibold tracking-wide text-gray-300">PREVIEW</h2>
      <button
        onclick={copyToClipboard}
        class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
      >
        {#if copied}
          <svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        {:else}
          <svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Copy Code
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
