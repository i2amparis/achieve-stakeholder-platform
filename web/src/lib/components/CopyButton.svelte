<script lang="ts">
	// Copies text to the clipboard and announces the result. Hidden without JavaScript
	// (the text itself stays selectable).
	import { onMount } from 'svelte';

	let { text, label = 'Copy citation' }: { text: string; label?: string } = $props();
	let available = $state(false);
	let status = $state('');
	onMount(() => (available = !!navigator.clipboard));

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			status = 'Citation copied to clipboard.';
		} catch {
			status = 'Could not copy. Select the citation text instead.';
		}
	}
</script>

{#if available}
	<button type="button" class="ach-btn ach-btn-secondary ach-btn--sm" style="align-self: flex-start;" onclick={copy}>{status.startsWith('Citation') ? 'Copied' : label}</button>
{/if}
<p role="status" style="font-size: 14px; color: var(--green-dark); min-height: 1px;">{status}</p>
