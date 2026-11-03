<script lang="ts">
	import { page } from '$app/state';
	import logo from '#lib/design-system/assets/achieve-logo.png';
	import { href, type Locale } from '#lib/i18n/locales.ts';

	let { locale }: { locale: Locale } = $props();
	let open = $state(false);

	// "Integrity principles" and "Roadmaps" point at the home sections until their pages exist.
	const items = $derived([
		{ label: 'Home', path: href('/', locale), match: (p: string) => p === href('/', locale) },
		{ label: 'Integrity principles', path: href('/', locale) + '#principles', match: (p: string) => p.startsWith(href('/principles', locale)) },
		{ label: 'Roadmaps', path: href('/', locale) + '#roadmaps', match: (p: string) => p.startsWith(href('/roadmaps', locale)) },
		{ label: 'Library', path: href('/library', locale), match: (p: string) => p.startsWith(href('/library', locale)) },
		{ label: 'Have your say', path: href('/have-your-say', locale), match: (p: string) => p.startsWith(href('/have-your-say', locale)) },
		{ label: 'About', path: href('/about', locale), match: (p: string) => p.startsWith(href('/about', locale)) }
	]);

	// close the menu after navigating
	$effect(() => {
		page.url.pathname;
		open = false;
	});
</script>

<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
	<div class="brand-band" aria-hidden="true"></div>
	<div class="wrap site-header__row">
		<a class="site-header__logo" href={href('/', locale)} aria-label="ACHIEVE stakeholder platform, home"><img src={logo} alt="ACHIEVE" width="150" height="23" /></a>
		<div class="site-header__tools">
			<a class="icon-btn" href={href('/library', locale) + '#search'} aria-label="Search the library">
				<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg>
			</a>
			<button type="button" class="menu-btn" aria-expanded={open} aria-controls="site-nav" onclick={() => (open = !open)}>
				<span class="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
				<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#283b8d" stroke-width="2" stroke-linecap="round">
					{#if open}<path d="M6 6l12 12M18 6 6 18"></path>{:else}<path d="M4 7h16M4 12h16M4 17h16"></path>{/if}
				</svg>
			</button>
		</div>
		<nav id="site-nav" class="site-nav" class:is-open={open} aria-label="Main">
			<ul>
				{#each items as item (item.label)}
					<li><a href={item.path} aria-current={item.match(page.url.pathname) ? 'page' : undefined}>{item.label}</a></li>
				{/each}
			</ul>
		</nav>
	</div>
</header>

<style>
	/* keep the tools on the right of the logo on wide screens */
	@media (min-width: 861px) {
		.site-header__tools { order: 3; }
	}
</style>
