<script lang="ts">
	import StaticPage from '#lib/components/StaticPage.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<StaticPage page={data.page} />
