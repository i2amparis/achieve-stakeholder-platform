<script lang="ts">
	import '#lib/design-system/tokens.css';
	import '#lib/design-system/components.css';
	import '#lib/styles/app.css';
	import { page } from '$app/state';
	import SiteHeader from '#lib/components/SiteHeader.svelte';
	import SiteFooter from '#lib/components/SiteFooter.svelte';
	import { localeOfPath } from '#lib/i18n/locales.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	// The root layout also wraps error pages, so the locale comes from the URL.
	const locale = $derived(localeOfPath(page.url.pathname));
</script>

<SiteHeader {locale} />
<main id="main" tabindex="-1">
	{@render children()}
</main>
<SiteFooter {locale} />
