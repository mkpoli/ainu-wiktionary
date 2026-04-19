<script lang="ts">
	import { browser } from '$app/environment';
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	const localeOptions = [
		{ value: 'ja', label: '日本語' },
		{ value: 'en', label: 'EN' }
	] as const;

	async function switchLanguage(next: 'ja' | 'en') {
		if (next === getLocale()) return;
		await setLocale(next);
		if (browser) {
			window.location.reload();
		}
	}
</script>

<div
	class="inline-flex rounded-full border border-slate-200 bg-white/90 p-1 shadow-sm"
	role="group"
	aria-label={m.switch_language_tooltip()}
>
	{#each localeOptions as option}
		<button
			type="button"
			on:click={() => switchLanguage(option.value)}
			class={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
				getLocale() === option.value
					? 'bg-slate-900 text-white shadow-sm'
					: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
			}`}
			aria-pressed={getLocale() === option.value}
		>
			{option.label}
		</button>
	{/each}
</div>
