<script>
  import { m } from '$lib/paraglide/messages';
  import WiktionaryGenerator from '$lib/components/WiktionaryGenerator.svelte';
</script>

<svelte:head>
    <title>{m.title()}</title>
</svelte:head>

<WiktionaryGenerator />
