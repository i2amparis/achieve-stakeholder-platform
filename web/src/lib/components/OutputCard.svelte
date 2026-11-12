<script lang="ts">
	import type { Card } from '#lib/library/filters.ts';
	import { cardMeta, monthYear, principleColour } from '#lib/format.ts';
	import { href, type Locale } from '#lib/i18n/locales.ts';

	let {
		card,
		locale,
		principleNames,
		actorNames,
		hideActor,
		headingLevel = 3,
		note
	}: {
		card: Card;
		locale: Locale;
		principleNames: Record<string, string>;
		actorNames: Record<string, string>;
		/** On a hub: list the other actors as "Also for". */
		hideActor?: string;
		headingLevel?: 2 | 3;
		note?: string;
	} = $props();

	const others = $derived(card.actors.filter((a) => a !== hideActor).map((a) => actorNames[a]).filter(Boolean));
</script>

<li class="card" class:card--upcoming={card.status === 'upcoming'} style:--card-colour={principleColour(card.principles[0])}>
	<p class="card__meta">
		{#if card.status === 'upcoming'}<span class="badge">Coming {monthYear(card.date)}</span>{' '}{/if}{cardMeta(card)}
	</p>
	<svelte:element this={`h${headingLevel}`} class="card__title"><a href={href(`/library/${card.slug}`, locale)}>{card.title}</a></svelte:element>
	{#if note}<p class="card__teaser">{note}</p>{:else if card.teaser}<p class="card__teaser">{card.teaser}</p>{/if}
	<p class="card__tags">
		<span class="visually-hidden">Integrity principles:</span>
		{#each card.principles as p (p)}<span><span class="swatch" style:background={principleColour(p)} aria-hidden="true"></span>{principleNames[p]}</span>{/each}
	</p>
	{#if hideActor !== undefined}
		{#if others.length}<p class="card__meta">Also for: {others.join(', ')}</p>{/if}
	{:else}
		<p class="card__meta"><span class="visually-hidden">For:</span> {card.actors.map((a) => actorNames[a]).filter(Boolean).join(' · ')}</p>
	{/if}
</li>
