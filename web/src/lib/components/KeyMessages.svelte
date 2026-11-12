<script lang="ts">
	// Key messages by actor. Without JavaScript: one section per actor.
	// With it: ARIA tabs (arrow keys, Home/End), as in the platform screens.
	import { onMount } from 'svelte';
	import { leadFigure } from '#lib/format.ts';

	let { messages, id = 'km' }: { messages: { actor: string; name: string; message: string }[]; id?: string } = $props();
	let enhanced = $state(false);
	let current = $state(0);
	const tabs: HTMLButtonElement[] = [];

	onMount(() => (enhanced = messages.length > 1));

	function onKey(event: KeyboardEvent) {
		const last = messages.length - 1;
		const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: last }[event.key];
		if (next === undefined) return;
		event.preventDefault();
		current = (next + messages.length) % messages.length;
		tabs[current]?.focus();
	}
</script>

{#if enhanced}
	<div role="tablist" aria-label="Choose an actor group" class="tablist" style="margin-top: 20px;" tabindex="-1" onkeydown={onKey}>
		{#each messages as m, i (m.actor)}
			<button
				bind:this={tabs[i]}
				type="button"
				role="tab"
				class="tab"
				id="{id}-tab-{m.actor}"
				aria-controls="{id}-panel"
				aria-selected={i === current}
				tabindex={i === current ? 0 : -1}
				onclick={() => (current = i)}>{m.name}</button
			>
		{/each}
	</div>
	<div role="tabpanel" id="{id}-panel" aria-labelledby="{id}-tab-{messages[current].actor}" tabindex="0" class="row" style="--row-gap: 24px; --col-gap: 48px; padding: 32px 0 8px; align-items: flex-start;">
		{@render panel(messages[current])}
	</div>
{:else}
	{#each messages as m (m.actor)}
		<div style="border-top: 1px solid var(--grey); margin-top: 20px; padding-top: 16px;">
			<h3 class="h3">{m.name}</h3>
			<div class="row" style="--row-gap: 16px; --col-gap: 48px; padding-top: 12px; align-items: flex-start;">{@render panel(m)}</div>
		</div>
	{/each}
{/if}

{#snippet panel(m: { message: string })}
	{@const fig = leadFigure(m.message)}
	{#if fig}<p aria-hidden="true" style="flex: 1 1 140px; font-family: var(--font-display); font-size: 64px; line-height: 64px; font-weight: 700; color: var(--green-dark);">{fig}</p>{/if}
	<p style="flex: 999 1 560px; min-width: 0; font-size: 24px; line-height: 34px;">{m.message}</p>
{/snippet}
