<script lang="ts">
	import CopyButton from '#lib/components/CopyButton.svelte';
	import FeedbackPrompt from '#lib/components/FeedbackPrompt.svelte';
	import KeyMessages from '#lib/components/KeyMessages.svelte';
	import OutputCard from '#lib/components/OutputCard.svelte';
	import { principleColour } from '#lib/format.ts';
	import { href } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const h = (p: string) => href(p, data.locale);
	const c = $derived(data.c);
	const upcoming = $derived(c.status === 'upcoming');
</script>

<svelte:head>
	<title>{[c.code, c.title].filter(Boolean).join(' ')} · ACHIEVE stakeholder platform</title>
	{#if c.teaser}<meta name="description" content={c.teaser} />{/if}
</svelte:head>

<section class="hero" aria-labelledby="out-title">
	<div class="wrap hero__inner" style="padding-bottom: 48px;">
		<nav aria-label="Breadcrumb" class="breadcrumb">
			<ol>
				<li><a href={h('/')}>Home</a></li>
				<li><a href={h('/library')}>Library</a></li>
				<li aria-current="page">{c.code ?? c.title}</li>
			</ol>
		</nav>
		<div class="row" style="--row-gap: 32px; --col-gap: 56px; margin-top: 28px;">
			<div class="grow stack" style="flex-basis: 600px; --stack: 20px;">
				<p class="eyebrow">{data.eyebrow}</p>
				<h1 id="out-title" class="title" style="margin-top: 4px; max-width: 28ch;">{c.title}</h1>
				{#if c.teaser}<p class="lede" style="font-size: 21px; line-height: 31px; max-width: 58ch;">{c.teaser}</p>{/if}
				<div class="row" style="--row-gap: 14px; --col-gap: 14px; padding-top: 8px;">
					{#if data.link && data.linkLabel}
						<a class="ach-btn ach-btn-primary" href={data.link} rel="noopener">
							<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{#if data.linkLabel.startsWith('Download')}<path d="M12 4v11M7 10l5 5 5-5M5 20h14"></path>{:else}<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>{/if}</svg>
							{data.linkLabel}
						</a>
					{/if}
					{#if data.citation}<a class="ach-btn ach-btn-secondary" href="#cite">Cite this {data.what}</a>{/if}
					{#if upcoming && data.prompt}<a class="ach-btn ach-btn-secondary" href="#feedback">Tell the authors what to answer</a>{/if}
				</div>
			</div>
			<dl class="facts panel side" style="padding: 24px; align-self: flex-start; flex-basis: 280px;">
				{#each data.facts as [label, value] (label)}
					<dt>{label}</dt>
					<dd>{#if label === 'Status'}<span class="dot" style:background={upcoming ? 'var(--lavender)' : 'var(--green-dark)'} aria-hidden="true"></span>{/if}{value}</dd>
				{/each}
			</dl>
		</div>
		<div class="row" style="--row-gap: 16px; --col-gap: 40px; margin-top: 32px; font-size: 15px; line-height: 22px;">
			<div class="row" style="--row-gap: 8px; --col-gap: 8px; align-items: center;">
				<span class="muted" style="margin-right: 4px;">For</span>
				{#each data.actors as a, i (a.slug)}
					<a class="pill-link" href={a.href} style:font-weight={i === 0 ? 600 : 400}>{a.name}</a>
				{/each}
			</div>
			<div class="row" style="--row-gap: 8px; --col-gap: 16px; align-items: center;">
				<span class="muted">Principles</span>
				{#each data.principles as p (p.code)}
					<a href={p.href} style="display: inline-flex; align-items: center; gap: 6px; color: var(--web-ink);"><span class="swatch" style="width: 12px; height: 12px;" style:background={principleColour(p.code)} aria-hidden="true"></span>{p.label}</a>
				{/each}
				{#if data.dimensions.length}
					<span class="muted" aria-hidden="true">·</span>
					<span><span class="visually-hidden">Dimensions: </span>{data.dimensions.map((d, i) => (i === 0 ? d.charAt(0).toUpperCase() + d.slice(1) : d)).join(' · ')}</span>
				{/if}
			</div>
		</div>
	</div>
</section>

{#if data.messages.length}
	<section class="section" style="padding: 56px 0;" aria-labelledby="km-title">
		<div class="wrap">
			<h2 id="km-title" class="h2--sm">Key messages by actor</h2>
			<KeyMessages messages={data.messages} />
		</div>
	</section>
{/if}

{#if data.visuals.length}
	<section class="section section--tint" style="padding: 56px 0;" aria-labelledby="vis-title">
		<div class="wrap">
			<h2 id="vis-title" class="h2--sm">{data.visuals.length === 1 ? 'The infographic' : `The findings in ${data.visuals.length} infographics`}</h2>
			<p style="margin-top: 8px; font-size: 17px; line-height: 26px;">Each infographic is described in text, so its content is available to everyone.</p>
			<ol style="list-style: none; padding: 0; margin: 28px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px;">
				{#each data.visuals as v, i (v.filename)}
					<li class="panel stack" style="--stack: 10px; border-color: var(--grey); padding: 24px;">
						<p class="kicker" style="color: var(--navy);">Part {i + 1} of {data.visuals.length}</p>
						<h3 class="h4">{v.filename.replace(/[_-]+/g, ' ').replace(/\.(pdf|png|svg)$/i, '')}</h3>
						{#if v.html}
							<div class="prose" style="font-size: 16px; line-height: 24px;">{@html v.html}</div>
						{:else if v.altText}
							<p style="font-size: 16px; line-height: 24px;">{v.altText}</p>
						{:else}
							<p class="muted">A text description of this infographic is in preparation.</p>
						{/if}
					</li>
				{/each}
			</ol>
		</div>
	</section>
{/if}

<section class="section" style="padding: 56px 0;" aria-labelledby="abs-title">
	<div class="wrap row" style="--row-gap: 40px; --col-gap: 64px;">
		<div class="grow" style="flex-basis: 600px;">
			<h2 id="abs-title" class="h2--sm">About this {data.what}</h2>
			{#if data.abstractLead}
				<div class="prose" style="margin-top: 16px;">{@html data.abstractLead}</div>
				{#if data.abstractMore}
					<details style="margin-top: 14px;">
						<summary style="cursor: pointer; color: var(--navy-link); text-decoration: underline; font-size: 17px; min-height: 44px; display: inline-flex; align-items: center;">Read the full summary</summary>
						<div class="prose" style="margin-top: 14px;">{@html data.abstractMore}</div>
					</details>
				{/if}
			{:else}
				<p style="margin-top: 16px; font-size: 18px; line-height: 28px;">{upcoming ? 'The summary will be added when the work is published.' : 'A summary will be added soon.'}</p>
			{/if}
			{#if data.formats.length || data.relations.length || data.webinar}
				<ul style="margin: 24px 0 0; padding-left: 20px; font-size: 16px; line-height: 26px;">
					{#each data.formats as f (f.title)}
						<li>Also available as a {f.type?.toLowerCase() ?? 'second format'}: {#if f.link}<a href={f.link} rel="noopener">{f.title}</a>{:else}{f.title}{/if}</li>
					{/each}
					{#each data.relations as r (r.slug + r.direction)}
						<li>
							{#if r.type === 'supersedes'}{r.note ? `${r.note.charAt(0).toUpperCase()}${r.note.slice(1)} ` : ''}{r.direction === 'out' ? (r.note ? 'supersedes' : 'Supersedes') : r.note ? 'superseded by' : 'Superseded by'}:{:else}Related:{/if}
							<a href={h(`/library/${r.slug}`)}>{r.title}</a>
						</li>
					{/each}
					{#if data.webinar}<li><a href={data.webinar.url} rel="noopener">{data.webinar.title ?? 'Webinar on this work'}</a></li>{/if}
				</ul>
			{/if}
		</div>
		{#if data.citation}
			<aside id="cite" class="side panel--outline stack" style="--stack: 14px; align-self: flex-start; flex-basis: 320px;" aria-labelledby="cite-title" tabindex="-1">
				<h2 id="cite-title" class="h3">Cite this {data.what}</h2>
				<p style="font-size: 15px; line-height: 23px; background: var(--surface-tint); padding: 14px; overflow-wrap: anywhere;">{data.citation}</p>
				<CopyButton text={data.citation} />
			</aside>
		{/if}
	</div>
</section>

{#if data.prompt}
	<div class="wrap" style="padding-bottom: 56px;" id="feedback">
		{#if upcoming}
			<FeedbackPrompt id="feedback" action="?/feedback" kicker="Suggest research" question={data.prompt.question} note="Anonymous. Read by the authors before publication." result={form} fullFormHref={h('/have-your-say?stream=suggest_research')} />
		{:else}
			<FeedbackPrompt id="feedback" action="?/feedback" kicker="Comment on our work" question={data.prompt.question} note={`Anonymous. Read by the ${data.what}'s authors.`} messageLabel="What is missing?" withUsefulness withRole result={form} />
		{/if}
	</div>
{/if}

{#if data.related.length}
	<section class="section" style="border-top: 1px solid var(--grey); padding: 56px 0 72px;" aria-labelledby="rel-title">
		<div class="wrap">
			<h2 id="rel-title" class="h2--sm">Related</h2>
			<ul class="cards" style="margin-top: 24px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));">
				{#each data.related as r (r.id)}
					<OutputCard card={r} locale={data.locale} principleNames={data.principleNames} actorNames={data.actorNames} />
				{/each}
			</ul>
		</div>
	</section>
{/if}
