<script lang="ts">
	import { getLocale, setLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	function toggleLanguage() {
		const current = getLocale();
		const next = current === 'en' ? 'ja' : 'en';
		setLocale(next);
	}
</script>

<button
	onclick={toggleLanguage}
	class="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
	title={m.switch_language_tooltip?.() ?? 'Switch Language'}
>
	<span class="uppercase">{getLocale()}</span>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="h-4 w-4 text-gray-500"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
		/>
	</svg>
</button>
