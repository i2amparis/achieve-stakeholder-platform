<script lang="ts">
	import { goto } from '$app/navigation';
	import ActorIcon from '#lib/components/ActorIcon.svelte';
	import FeedbackPrompt from '#lib/components/FeedbackPrompt.svelte';
	import OutputCard from '#lib/components/OutputCard.svelte';
	import { monthYear, principleColour } from '#lib/format.ts';
	import { href } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const h = (p: string) => href(p, data.locale);
	const a = $derived(data.actor);
	const roadmapYear = $derived(data.roadmap?.due?.slice(0, 4) ?? '2027');
	const statusLabel: Record<string, string> = { in_preparation: 'In preparation', draft_for_comment: 'Draft for comment', final: 'Final' };

	// Chips are links (shareable, work without JavaScript). With JavaScript they
	// update the list in place, keeping focus on the chip; the count is announced.
	function chip(event: MouseEvent) {
		const link = event.currentTarget as HTMLAnchorElement;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
		event.preventDefault();
		goto(link.href, { reset: false });
	}
	const resultLabel = $derived(
		`${data.showingAll ? `Showing all ${data.resultCount}` : `Showing ${data.results.length} featured of ${data.resultCount}`} published ${data.resultCount === 1 ? 'output' : 'outputs'}${data.selectedLabel ? ` · ${data.selectedLabel}` : ''}`
	);
</script>

<svelte:head>
	<title>{a.name} · ACHIEVE stakeholder platform</title>
	<meta name="description" content={`ACHIEVE findings, key messages and upcoming work for ${a.name.toLowerCase()}.`} />
</svelte:head>

<section class="hero" aria-labelledby="hub-title">
	<div class="wrap hero__inner">
		<nav aria-label="Breadcrumb" class="breadcrumb">
			<ol>
				<li><a href={h('/')}>Home</a></li>
				<li><a href={h('/') + '#actors'}>Actor hubs</a></li>
				<li aria-current="page">{a.name}</li>
			</ol>
		</nav>
		<div class="row" style="--row-gap: 32px; --col-gap: 56px; margin-top: 32px; align-items: flex-end;">
			<div class="grow">
				<p class="eyebrow">Actor hub</p>
				<h1 id="hub-title" class="title title--hub" style="margin-top: 4px;"><ActorIcon slug={a.slug} size={64} />{a.name}</h1>
				{#if a.intro}
					<div class="lede" style="margin-top: 20px;">{#if a.description}<p>{a.description}.</p>{/if}{@html a.intro}</div>
				{:else if a.description}
					<p class="lede" style="margin-top: 20px;">{a.description}.</p>
				{/if}
			</div>
			<dl class="stats panel side">
				<div><dt>Published</dt><dd>{data.counts.published}</dd></div>
				<div><dt>Coming</dt><dd>{data.counts.coming}</dd></div>
				<div><dt>Roadmap</dt><dd style="font-size: 20px;">{roadmapYear}</dd></div>
			</dl>
		</div>
	</div>
</section>

{#if data.groups.length}
	<section class="section" aria-labelledby="msg-title">
		<div class="wrap">
			<h2 id="msg-title" class="h2">What ACHIEVE has found for {a.name.toLowerCase() === 'ccis' ? 'CCIs' : a.name.toLowerCase()}</h2>
			<p class="intro" style="margin-top: 10px; font-size: 18px;">Key messages from across our reports and articles, grouped by the main integrity principle of each output. Each links to the output it comes from.</p>
			<div style="margin-top: 32px; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 40px 48px;">
				{#each data.groups as g (g.code)}
					<section aria-labelledby="km-{g.code}" style="border-top: 6px solid {principleColour(g.code)}; padding-top: 16px; min-width: 0;">
						<h3 id="km-{g.code}" class="h3" style="display: flex; align-items: baseline; gap: 10px;">{g.label} <span class="muted" style="font-family: var(--font-sans); font-size: 14px;">{g.items.length === 1 ? '1 message' : `${g.items.length} messages`}</span></h3>
						<ul style="list-style: none; padding: 0; margin: 8px 0 0;">
							{#each g.items as m (m.slug)}
								<li style="border-top: 1px solid var(--grey); padding: 16px 0;">
									<p style="font-size: 18px; line-height: 27px;">{m.text}</p>
									<p class="muted" style="margin-top: 8px; font-size: 14px; line-height: 20px;">From <a href={h(`/library/${m.slug}`)}>{m.source}</a></p>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</div>
	</section>
{/if}

{#if data.prompt}
	<div class="wrap" style="padding-bottom: 64px;" id="feedback">
		<FeedbackPrompt
			id="challenge"
			action="?/challenge"
			kicker="Share a challenge"
			question={data.prompt.question}
			note={`Anonymous. Read by the authors of the ${a.name} roadmap, who will reflect common challenges in it.`}
			placeholder="For example: we lack reliable emissions data for our transport sector"
			result={form}
			fullFormHref={h('/have-your-say?stream=share_challenge')}
		/>
	</div>
{/if}

<section id="outputs" class="section section--tint" aria-labelledby="all-title" tabindex="-1">
	<div class="wrap">
		<div class="row row--between" style="--row-gap: 8px;">
			<h2 id="all-title" class="h2--sm">Outputs for {a.name}</h2>
			<a href={data.libraryHref} style="font-size: 16px; line-height: 44px;">Open this view in the library</a>
		</div>
		<nav aria-label="Filter by integrity principle" class="chips" style="margin-top: 20px;">
			<a class="chip" href={data.allHref.replace(/\?[^#]*/, '')} aria-current={data.view.principle.length || data.view.actor.length ? undefined : 'true'} onclick={chip}>All principles <span class="chip__count">{data.counts.published}</span></a>
			{#each data.principleChips as c (c.value)}
				<a class="chip" href={c.href} aria-current={c.selected ? 'true' : undefined} onclick={chip}><span class="swatch" style:background={principleColour(c.value)} aria-hidden="true"></span>{c.label} <span class="chip__count">{c.count}</span></a>
			{/each}
			{#each data.subChips as c (c.value)}
				<a class="chip" href={c.href} aria-current={c.selected ? 'true' : undefined} onclick={chip}>{c.label} <span class="chip__count">{c.count}</span></a>
			{/each}
		</nav>
		{#if data.dimensionChips.length}
			<nav aria-label="Filter by dimension" class="chips" style="gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--green-medium); align-items: center;">
				<span class="muted" style="font-size: 15px; margin-right: 4px;">Dimensions:</span>
				{#each data.dimensionChips as d (d.value)}
					<a class="chip chip--small" href={d.href} aria-current={d.selected ? 'true' : undefined} onclick={chip}>{d.label.charAt(0).toUpperCase() + d.label.slice(1)} ({d.count})</a>
				{/each}
			</nav>
		{/if}
		<p aria-live="polite" class="muted" style="margin-top: 18px; font-size: 15px; line-height: 22px;">{resultLabel}</p>
		<ul class="cards" style="margin-top: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));">
			{#each data.results as card (card.id)}
				<OutputCard {card} locale={data.locale} principleNames={data.principleNames} actorNames={data.actorNames} hideActor={a.slug} />
			{/each}
		</ul>
		{#if data.resultCount > 3}
			<a class="ach-btn ach-btn-secondary ach-btn--sm" style="margin-top: 24px;" href={data.showingAll ? data.seeLessHref : data.seeAllHref} onclick={chip}>{data.showingAll ? 'Show only the featured' : `See all ${data.resultCount} outputs`}</a>
		{/if}
	</div>
</section>

<section class="section" aria-labelledby="soon-title">
	<div class="wrap row" style="--row-gap: 40px; --col-gap: 40px;">
		<div class="grow" style="flex-basis: 600px;">
			<h2 id="soon-title" class="h2--sm">Coming soon</h2>
			{#if data.upcoming.length}
				<p style="margin-top: 8px; font-size: 17px; line-height: 26px;">{data.upcoming.length === 1 ? 'One more output' : `${data.upcoming.length} more outputs`} for {a.name} {data.upcoming.length === 1 ? 'is' : 'are'} due by {monthYear(data.upcoming[data.upcoming.length - 1].date, true)}. Tell the authors what they should answer.</p>
				<ol style="list-style: none; padding: 0; margin: 24px 0 0;">
					{#each data.upcoming as c, i (c.id)}
						<li style="display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 16px; padding: 16px 0; border-top: 1px solid var(--grey); {i === data.upcoming.length - 1 ? 'border-bottom: 1px solid var(--grey);' : ''}">
							<span style="font-weight: 600; color: var(--green-dark);">{monthYear(c.date)}</span>
							<span><a href={h(`/library/${c.slug}`)}><strong>{[c.code, c.title].filter(Boolean).join(' ')}.</strong></a> {c.teaser?.replace(/^Coming [A-Z][a-z]+ \d{4}: /, '') ?? ''}</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p style="margin-top: 8px;">No upcoming outputs are scheduled for {a.name} yet.</p>
			{/if}
		</div>
		<aside class="side panel--strong stack" style="--stack: 16px; align-self: flex-start;" aria-labelledby="rm-title">
			<p><span class="badge">{statusLabel[data.roadmap?.status ?? 'in_preparation']}</span></p>
			<h2 id="rm-title" class="h3" style="font-size: 24px; line-height: 31px;">Roadmap for {a.name}</h2>
			<p style="font-size: 16px; line-height: 24px;">Milestones, integrity issues, barriers, and recommendations: who should do what, by when.</p>
			<ol aria-label="Roadmap horizons" style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); font-size: 14px; line-height: 20px;">
				<li style="border-top: 4px solid var(--navy); padding-top: 10px;"><strong style="display: block; font-size: 16px; color: var(--navy);">Next 1–2 years</strong>Short term</li>
				<li style="border-top: 4px solid var(--green-dark); padding-top: 10px;"><strong style="display: block; font-size: 16px; color: var(--navy);">2030</strong>Mid term</li>
				<li style="border-top: 4px solid var(--green); padding-top: 10px;"><strong style="display: block; font-size: 16px; color: var(--navy);">2050</strong>Long term</li>
			</ol>
			<p class="muted" style="font-size: 15px; line-height: 22px;">Draft open for comment in {roadmapYear}{data.roadmap?.due ? `; final ${monthYear(data.roadmap.due, true)}` : ''}.</p>
			<a href={h('/have-your-say/thank-you') + '#join'} style="font-size: 16px;">Tell me when the draft is open</a>
		</aside>
	</div>
</section>
