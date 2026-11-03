<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import FeedbackPrompt from '#lib/components/FeedbackPrompt.svelte';
	import { cardMeta, monthYear, principleColour } from '#lib/format.ts';
	import { href } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const base = $derived(href('/library', data.locale));
	const countLabel = $derived(`${data.results.length === 1 ? 'output' : 'outputs'}${data.anyActive ? ` of ${data.total}` : ''}`);

	// With JavaScript, apply each change at once and keep focus where it is.
	// Without it, the "Apply filters" button submits the same form.
	function apply(event: Event) {
		const formEl = (event.currentTarget as HTMLFormElement | null) ?? (document.getElementById('lib') as HTMLFormElement);
		const params = new URLSearchParams();
		for (const [k, v] of new FormData(formEl)) if (typeof v === 'string' && v.trim() !== '' && !(k === 'sort' && v === 'new')) params.append(k, v.trim());
		const qs = params.toString();
		goto(`${base}${qs ? `?${qs}` : ''}`, { reset: false });
	}
	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		apply(event);
	}
</script>

<svelte:head>
	<title>Library · ACHIEVE stakeholder platform</title>
	<meta name="description" content="Every ACHIEVE output: deliverables, articles, policy briefs and reports, filtered by actor group, integrity principle and dimension." />
</svelte:head>

<section class="hero" aria-labelledby="lib-title">
	<div class="wrap hero__inner stack" style="padding-top: 40px; padding-bottom: 40px;">
		<p class="eyebrow">Library</p>
		<h1 id="lib-title" class="title">Every ACHIEVE output</h1>
		<p class="intro">Deliverables, articles, policy briefs, and reports, published and upcoming. Filter by your actor group and by the part of integrity that matters most to you.</p>
		<div role="search" class="row" style="--row-gap: 12px; --col-gap: 12px; max-width: 760px; padding-top: 12px;">
			<label for="search" class="visually-hidden">Search the library</label>
			<input id="search" class="input" type="search" name="q" form="lib" value={data.filters.q} placeholder="Search titles and summaries, e.g. offsets, Article 6, cities" style="flex: 1 1 380px; min-width: 0; min-height: 52px; border: 2px solid var(--navy); font-size: 18px;" />
			<button type="submit" form="lib" class="ach-btn ach-btn-primary">Search</button>
		</div>
	</div>
</section>

<section class="section" style="padding-top: 32px;" aria-label="Results">
	<div class="wrap row" style="--row-gap: 32px; --col-gap: 40px; align-items: flex-start;">
		<form id="lib" method="GET" action={base} class="side" style="flex-basis: 260px;" onsubmit={onSubmit} onchange={apply}>
			<div class="row row--between" style="align-items: center; padding-bottom: 8px;">
				<h2 class="h3">Filters</h2>
				{#if data.anyActive}<a href={data.clearHref} style="font-size: 15px; line-height: 44px;">Clear all</a>{/if}
			</div>
			{#each data.facets as f (f.facet)}
				{#if f.options.length}
					<fieldset style="border: 0; border-top: 1px solid var(--grey); margin: 0; padding: 14px 0 12px;">
						<legend style="float: left; width: 100%; padding: 0; margin-bottom: 8px; font-size: 16px; font-weight: 600;">{f.label}</legend>
						<div style="clear: both; display: flex; flex-direction: column; gap: 2px;">
							{#each f.options as o (o.value)}
								<label class="check" style="min-height: 40px; align-items: center; font-size: 15px; line-height: 20px;">
									<input type="checkbox" name={f.facet} value={o.value} checked={o.selected} />
									{#if f.facet === 'principle'}<span class="swatch" style:background={principleColour(o.value)} aria-hidden="true"></span>{/if}
									<span style="flex: 1 1 auto;">{o.label}</span>
									<span class="muted" style="font-size: 14px;"><span class="visually-hidden">(</span>{o.count}<span class="visually-hidden"> outputs)</span></span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}
			{/each}
			<div style="border-top: 1px solid var(--grey); padding-top: 14px;">
				<label class="label" for="sort">Sort by</label>
				<select id="sort" name="sort" class="select" style="margin-top: 8px;">
					<option value="new" selected={data.filters.sort === 'new'}>Newest first</option>
					<option value="old" selected={data.filters.sort === 'old'}>Oldest first</option>
					<option value="title" selected={data.filters.sort === 'title'}>Title A–Z</option>
				</select>
			</div>
			<noscript><button type="submit" class="ach-btn ach-btn-primary ach-btn--sm" style="margin-top: 16px;">Apply filters</button></noscript>
		</form>

		<div class="grow" style="flex-basis: 600px;">
			<p aria-live="polite" style="font-size: 18px; line-height: 26px;"><strong>{data.results.length}</strong> {countLabel}</p>
			{#if data.active.length || data.filters.q}
				<div class="row" style="--row-gap: 8px; --col-gap: 8px; align-items: center; margin-top: 14px;">
					<span class="muted" style="font-size: 14px;">Active:</span>
					{#each data.active as a (a.facet + a.value)}
						<a class="chip chip--small" aria-current="true" href={a.href}><span class="visually-hidden">Remove filter </span>{a.label} <span aria-hidden="true">×</span></a>
					{/each}
					{#if data.filters.q}<span class="badge">“{data.filters.q}”</span>{/if}
				</div>
				<p class="muted" style="font-size: 13px; margin-top: 10px;">Link to this view: <code style="background: var(--surface-tint); padding: 2px 6px; word-break: break-all;">{page.url.pathname}{data.query}</code></p>
			{/if}

			{#if data.results.length}
				<ol class="results">
					{#each data.results as r (r.id)}
						<li class="result" style:--card-colour={principleColour(r.principles[0])}>
							<p class="card__meta">{#if r.status === 'upcoming'}<span class="badge">Coming {monthYear(r.date)}</span>{' '}{/if}{cardMeta(r)}</p>
							<h3><a href={href(`/library/${r.slug}`, data.locale)}>{r.title}</a></h3>
							{#if r.teaser}<p style="font-size: 16px; line-height: 24px; max-width: 72ch;">{r.teaser}</p>{/if}
							<p class="card__tags">
								<span class="muted">{r.actors.map((a) => data.actorNames[a]).filter(Boolean).join(' · ')}</span>
								{#each r.principles as p (p)}<span><span class="swatch" style:background={principleColour(p)} aria-hidden="true"></span>{data.principleNames[p]}</span>{/each}
							</p>
						</li>
					{/each}
				</ol>
			{:else}
				<p style="border-top: 1px solid var(--grey); margin-top: 20px; padding: 32px 0; font-size: 18px; line-height: 27px;">No outputs match these filters yet. Try removing one, or tell us what you were looking for below.</p>
			{/if}

			{#if data.prompt}
				<div style="margin-top: 28px;">
					<FeedbackPrompt
						id="suggest"
						action="?/suggest"
						kicker="Suggest research"
						question={data.prompt.question}
						note="Anonymous. Your active filters are sent with your suggestion so our team knows the context."
						messageLabel="Your suggestion"
						result={form}
						hidden={{ view: data.query }}
						headingLevel={2}
					/>
				</div>
			{/if}
		</div>
	</div>
</section>
