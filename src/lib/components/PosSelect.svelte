<script lang="ts" module>
	import type { PartOfSpeech } from '$lib/utils/wikitext';

	export type PosGroup = 'word' | 'morphology';

	export interface PosItem {
		label: string;
		value: PartOfSpeech;
		group: PosGroup;
		hint?: string;
	}
</script>

<script lang="ts">
	import { Select, createListCollection } from '@ark-ui/svelte/select';
	import * as m from '$lib/paraglide/messages';

	interface Props {
		value: PartOfSpeech;
		id?: string;
		label?: string;
		placeholder?: string;
	}

	let {
		value = $bindable(),
		id = 'pos',
		label = m.pos_label(),
		placeholder = m.pos_placeholder()
	}: Props = $props();

	const items: PosItem[] = $derived([
		{ label: m.pos_noun(), value: 'noun', group: 'word' },
		{ label: m.pos_verb(), value: 'verb', group: 'word' },
		{ label: m.pos_adj(), value: 'adj', group: 'word' },
		{ label: m.pos_adv(), value: 'adv', group: 'word' },
		{ label: m.pos_participle(), value: 'participle', group: 'word' },
		{ label: m.pos_aux(), value: 'aux', group: 'word' },
		{ label: m.pos_particle(), value: 'particle', group: 'word' },
		{ label: m.pos_pron(), value: 'pron', group: 'word' },
		{ label: m.pos_prep(), value: 'prep', group: 'word' },
		{ label: m.pos_conj(), value: 'conj', group: 'word' },
		{ label: m.pos_interj(), value: 'interj', group: 'word' },
		{ label: m.pos_root(), value: 'root', group: 'morphology' },
		{ label: m.pos_prefix(), value: 'prefix', group: 'morphology' },
		{ label: m.pos_suffix(), value: 'suffix', group: 'morphology' }
	]);

	const collection = $derived(
		createListCollection<PosItem>({
			items,
			itemToString: (item) => item.label,
			itemToValue: (item) => item.value,
			groupBy: (item) => item.group
		})
	);

	const groupLabels: Record<PosGroup, () => string> = {
		word: () => m.pos_group_words(),
		morphology: () => m.pos_group_morphology()
	};

	let selectValue = $state<string[]>([value]);
	let isOpen = $state(false);

	$effect(() => {
		if (selectValue[0] !== value) selectValue = [value];
	});

	function handleValueChange(details: { value: string[] }) {
		const next = details.value[0] as PartOfSpeech | undefined;
		if (next) value = next;
	}

	function handleOpenChange(details: { open: boolean }) {
		isOpen = details.open;
	}
</script>

<Select.Root
	{id}
	{collection}
	bind:value={selectValue}
	onValueChange={handleValueChange}
	onOpenChange={handleOpenChange}
	positioning={{ sameWidth: true, fitViewport: true }}
	class={`relative block ${isOpen ? 'z-[1000]' : 'z-0'}`}
>
	<Select.Label class="mb-2 block text-sm font-semibold text-slate-700">
		{label}
	</Select.Label>
	<Select.Control>
		<Select.Trigger
			type="button"
			class="group flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left text-sm shadow-sm transition-colors duration-200 ease-in-out hover:border-slate-400 focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none data-[state=open]:border-indigo-500 data-[state=open]:ring-2 data-[state=open]:ring-indigo-500"
		>
			<Select.ValueText
				class="truncate text-slate-900 data-[placeholder-shown]:text-slate-400"
				{placeholder}
			/>
			<Select.Indicator
				class="shrink-0 text-slate-500 transition-transform duration-200 ease-out data-[state=open]:rotate-180"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-4 w-4"
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</Select.Indicator>
		</Select.Trigger>
	</Select.Control>
	<Select.Positioner class="z-[1000]" style="z-index: 1000;">
		<Select.Content
			class="max-h-[min(calc(var(--available-height)-1rem),22rem)] w-[var(--reference-width)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
		>
			{#each collection.group() as [groupKey, groupItems] (groupKey)}
				<Select.ItemGroup class="py-1 first:pt-0.5 last:pb-0.5 not-last:mb-1 not-last:border-b not-last:border-slate-100 not-last:pb-2">
					<Select.ItemGroupLabel
						class="px-2 pt-1 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-slate-500 uppercase"
					>
						{groupLabels[groupKey as PosGroup]()}
					</Select.ItemGroupLabel>
					{#each groupItems as item (item.value)}
						<Select.Item
							{item}
							class="relative flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 transition-colors select-none data-[highlighted]:bg-indigo-50 data-[highlighted]:text-indigo-900 data-[state=checked]:font-semibold data-[state=checked]:text-indigo-700 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
						>
							<Select.ItemText>{item.label}</Select.ItemText>
							<Select.ItemIndicator class="text-indigo-600">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="h-4 w-4"
									aria-hidden="true"
								>
									<path d="M20 6 9 17l-5-5" />
								</svg>
							</Select.ItemIndicator>
						</Select.Item>
					{/each}
				</Select.ItemGroup>
			{/each}
		</Select.Content>
	</Select.Positioner>
	<Select.HiddenSelect />
</Select.Root>
