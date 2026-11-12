<script lang="ts">
	import { page } from '$app/state';
	import { href, localeOfPath } from '#lib/i18n/locales.ts';

	const locale = $derived(localeOfPath(page.url.pathname));
	const h = (p: string) => href(p, locale);
	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} · ACHIEVE stakeholder platform</title>
</svelte:head>

<section class="hero" aria-labelledby="nf-title">
	<svg class="hero__motif" aria-hidden="true" viewBox="0 0 120 104" style="right: 6%; bottom: -10px; width: min(300px, 40vw); height: auto;"><path d="M40 4 76 100H4Z" fill="#27aae1" opacity="0.9"></path><path d="M70 20 112 100H34Z" fill="#11a44f" opacity="0.85"></path><path d="M62 56 82 100H42Z" fill="#4ab467" opacity="0.9"></path></svg>
	<div class="wrap hero__inner stack" style="padding-top: 88px; padding-bottom: 112px; --stack: 20px;">
		<p class="eyebrow">Error {page.status}</p>
		<h1 id="nf-title" class="title" style="max-width: 18ch; margin-top: 4px;">{notFound ? "This page isn't here yet" : 'Something went wrong'}</h1>
		<p class="lede" style="max-width: 56ch;">
			{#if notFound}
				The platform grows as ACHIEVE publishes new results, so the page you're looking for may still be in preparation. The link may also be out of date.
			{:else}
				{page.error?.message ?? 'Please try again in a few minutes.'}
			{/if}
		</p>
		<div class="row" style="--row-gap: 16px; --col-gap: 16px; padding-top: 12px;">
			<a class="ach-btn ach-btn-primary" href={h('/')}>Go to the home page</a>
			<a class="ach-btn ach-btn-secondary" href={h('/library')}>Search the library</a>
		</div>
	</div>
</section>

<section class="section" style="padding: 56px 0 72px;" aria-labelledby="nf-more">
	<div class="wrap">
		<h2 id="nf-more" class="h3" style="font-size: 26px; line-height: 34px;">You might be looking for</h2>
		<ul class="tiles" style="margin-top: 20px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));">
			<li class="panel--outline stack" style="--stack: 8px;"><h3 class="h4"><a href={h('/') + '#actors'} style="color: var(--navy); text-decoration: none;">Actor hubs</a></h3><p style="font-size: 16px; line-height: 24px;">Findings and key messages for businesses, cities, regulators, carbon markets, and cooperative initiatives.</p></li>
			<li class="panel--outline stack" style="--stack: 8px;"><h3 class="h4"><a href={h('/') + '#principles'} style="color: var(--navy); text-decoration: none;">Integrity principles</a></h3><p style="font-size: 16px; line-height: 24px;">The four principles ACHIEVE uses to judge voluntary climate action.</p></li>
			<li class="panel--outline stack" style="--stack: 8px;"><h3 class="h4"><a href={h('/have-your-say')} style="color: var(--navy); text-decoration: none;">Have your say</a></h3><p style="font-size: 16px; line-height: 24px;">Expected to find something here? Tell us what you need, and we'll take it into account.</p></li>
		</ul>
	</div>
</section>
