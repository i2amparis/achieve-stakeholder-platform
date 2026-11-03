<script lang="ts">
	import ActorIcon from '#lib/components/ActorIcon.svelte';
	import OutputCard from '#lib/components/OutputCard.svelte';
	import { monthYear, principleColour } from '#lib/format.ts';
	import { href } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const h = (p: string) => href(p, data.locale);
	const arrow = '<path d="M5 12h14M13 6l6 6-6 6"></path>';
</script>

<svelte:head>
	<title>ACHIEVE stakeholder platform</title>
	<meta name="description" content="High-integrity climate action is more than net zero and Paris alignment. Findings, key messages and roadmaps from the Horizon Europe project ACHIEVE." />
</svelte:head>

<section class="hero" aria-labelledby="hero-title">
	<svg class="hero__motif" aria-hidden="true" viewBox="0 0 400 400" style="right: -60px; top: -40px; width: 520px; height: 520px; opacity: 0.08;"><path d="M200 20 380 380H20Z" fill="#283b8d"></path></svg>
	<div class="wrap hero__inner row" style="--row-gap: 40px; --col-gap: 48px; align-items: center; padding-top: 72px; padding-bottom: 80px;">
		<div class="grow stack" style="--stack: 24px;">
			<p class="kicker" style="color: var(--navy); font-family: var(--font-display); font-size: 15px; letter-spacing: 0.08em;">ACHIEVE stakeholder platform</p>
			<h1 id="hero-title" class="title" style="max-width: 16ch;">High-integrity climate action is more than net zero</h1>
			<p class="lede" style="max-width: 58ch;">
				Net-zero targets and Paris alignment are only the starting point. The Horizon Europe project ACHIEVE looks at whether climate pledges from various
				actors are <strong>accountable, fair, good for nature, and genuinely transformative</strong>. Your feedback helps us develop roadmaps for improving
				integrity in climate action.
			</p>
			<div class="row" style="--row-gap: 16px; --col-gap: 16px; padding-top: 8px;">
				<a class="ach-btn ach-btn-primary" href="#actors">Explore findings by actor group</a>
				<a class="ach-btn ach-btn-secondary" href={h('/have-your-say')}>Have your say on our work</a>
			</div>
		</div>
		{#if data.finding}
			<aside class="side panel--navy" aria-label="Key finding">
				<svg aria-hidden="true" viewBox="0 0 120 104" style="position: absolute; right: -10px; bottom: -6px; width: 150px; height: 130px;"><path d="M40 4 76 100H4Z" fill="#27aae1" opacity="0.9"></path><path d="M70 20 112 100H34Z" fill="#11a44f" opacity="0.85"></path><path d="M62 56 82 100H42Z" fill="#4ab467" opacity="0.9"></path></svg>
				{#if data.finding.figure}<p style="font-family: var(--font-display); font-size: 72px; line-height: 76px; font-weight: 700;" aria-hidden="true">{data.finding.figure}</p>{/if}
				<p style="margin-top: 8px; font-size: 18px; line-height: 27px; max-width: 30ch; position: relative;">{data.finding.teaser}</p>
				<p style="margin-top: 20px; font-size: 14px; line-height: 20px; position: relative;"><a href={h(`/library/${data.finding.slug}`)}>{data.finding.title}</a> · {monthYear(data.finding.date)}</p>
			</aside>
		{/if}
	</div>
</section>

<section id="principles" class="section" aria-labelledby="principles-title">
	<div class="wrap">
		<div class="row row--between" style="align-items: flex-end;">
			<div class="grow stack">
				<h2 id="principles-title" class="h2">Four principles of high integrity</h2>
				<p class="intro">What do we mean by integrity? The ACHIEVE framework judges voluntary climate action on four principles, each broken down into five dimensions.</p>
			</div>
			<a href={h('/library')} style="font-size: 17px; line-height: 44px;">Browse outputs by principle</a>
		</div>
		<ul class="tiles" style="margin-top: 36px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));">
			{#each data.principles as p, i (p.code)}
				<li class="principle-card" style:--card-colour={principleColour(p.code)}>
					<span style="font-size: 14px; font-weight: 600; color: var(--ink-muted);">Principle {i + 1}</span>
					<h3 class="h3"><a href={h(`/library?principle=${p.code}`)} style="color: inherit; text-decoration: none;">{p.name}</a></h3>
					<p style="font-size: 15px; line-height: 23px;">{p.dimensions.map((d, j) => (j === 0 ? d.name.charAt(0).toUpperCase() + d.name.slice(1) : d.name)).join(' · ')}</p>
				</li>
			{/each}
		</ul>
	</div>
</section>

<section id="actors" class="section section--tint" aria-labelledby="actors-title">
	<div class="wrap stack">
		<h2 id="actors-title" class="h2">Actor hubs</h2>
		<p class="intro">Each hub brings together ACHIEVE findings, key messages, and upcoming work for one group of actors.</p>
		<ul class="tiles" style="margin-top: 36px;">
			{#each data.hubs as a (a.slug)}
				<li class="tile">
					<a href={h(`/actors/${a.slug}`)}>
						<ActorIcon slug={a.slug} />
						<span class="tile__name">{a.name}</span>
						<span class="tile__text">{a.description}</span>
						<span class="tile__count">{a.published} outputs · {a.coming} coming</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>

<section class="section" aria-labelledby="latest-title">
	<div class="wrap row" style="--row-gap: 40px; --col-gap: 40px;">
		<div class="grow" style="flex-basis: 640px;">
			<div class="row row--between" style="--row-gap: 8px;">
				<h2 id="latest-title" class="h2">Latest from ACHIEVE</h2>
				<a href={h('/library')} style="font-size: 17px; line-height: 44px;">All {data.total} outputs in the library</a>
			</div>
			<ul class="cards" style="margin-top: 28px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));">
				{#each data.latest as card (card.id)}
					<OutputCard {card} locale={data.locale} principleNames={data.principleNames} actorNames={data.actorNames} />
				{/each}
			</ul>
		</div>
		{#if data.next.length}
			<aside class="side panel--tint stack" style="--stack: 16px; align-self: flex-start;" aria-labelledby="next-title">
				<p class="kicker">Coming next · {monthYear(data.next[0].date)}</p>
				<h2 id="next-title" class="h3">{data.next.length === 1 ? data.next[0].title : `${data.next.length} new outputs`}</h2>
				<ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 14px; font-size: 16px; line-height: 24px;">
					{#each data.next as c (c.id)}
						<li><a href={h(`/library/${c.slug}`)}><strong>{[c.code, c.title].filter(Boolean).join(' ')}</strong></a>{#if c.teaser}<br />{c.teaser}{/if}</li>
					{/each}
				</ul>
				<a href={h(`/library/${data.next[0].slug}`) + '#feedback'} style="font-size: 16px;">What should {data.next.length === 1 ? 'this report' : 'these reports'} answer for you?</a>
			</aside>
		{/if}
	</div>
</section>

<section id="roadmaps" class="section" style="padding-top: 0;" aria-labelledby="roadmap-title">
	<div class="wrap">
		<div class="panel--outline row" style="--row-gap: 20px; --col-gap: 40px; align-items: center; padding: 32px;">
			<svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#11a44f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="18" r="2"></circle><circle cx="19" cy="6" r="2"></circle><path d="M7 18h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7"></path></svg>
			<div class="stack" style="flex: 1 1 480px; min-width: 0; --stack: 8px;">
				<h2 id="roadmap-title" class="h3" style="font-size: 26px; line-height: 34px;">Five roadmaps, one for each actor group</h2>
				<p style="font-size: 17px; line-height: 26px;">ACHIEVE will develop roadmaps for improving the integrity of climate action, with milestones for the next two years, 2030, and 2050. Drafts will open for comment in 2027.</p>
			</div>
			<a class="ach-btn ach-btn-secondary" href={h('/have-your-say/thank-you') + '#join'}>Hear when drafts open</a>
		</div>
	</div>
</section>

<section class="band" aria-labelledby="say-title">
	<svg aria-hidden="true" viewBox="0 0 400 400" style="position: absolute; left: -80px; bottom: -160px; width: 420px; height: 420px; opacity: 0.08;"><path d="M200 20 380 380H20Z" fill="#ffffff"></path></svg>
	<div class="wrap row" style="--row-gap: 24px; --col-gap: 48px; align-items: center; position: relative;">
		<div class="stack" style="flex: 1 1 460px; min-width: 0;">
			<h2 id="say-title" class="h2">Your experience shapes our research</h2>
			<p style="font-size: 19px; line-height: 28px; max-width: 52ch;">Tell us what works, what is missing, and where integrity is hardest in practice. Answers are anonymous unless you choose to leave an email.</p>
		</div>
		<div style="flex: 1 1 360px; min-width: 0; display: flex; flex-direction: column; gap: 12px;">
			{#each [['comment', 'Comment on our work'], ['suggest_research', 'Suggest research'], ['share_challenge', 'Share a challenge']] as [stream, label] (stream)}
				<a class="ach-btn ach-btn-secondary" href={h(`/have-your-say?stream=${stream}`)}>{label} <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{@html arrow}</svg></a>
			{/each}
		</div>
	</div>
</section>
