<script lang="ts">
	// Actor icons from the platform screens (24px grid, green outline, as the design system's icon set).
	let { slug, size = 40 }: { slug: string; size?: number } = $props();
	const PATHS: Record<string, string> = {
		business: '<rect x="3" y="7" width="18" height="13" rx="1.5"></rect><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18"></path>',
		cities: '<path d="M3 21h18M5 21V10l5-3v14M10 21V4h6v17M16 21V11h3.5v10"></path>',
		regulators: '<path d="m3 9 9-5 9 5M5.5 9v9M10 9v9M14 9v9M18.5 9v9M3 21h18"></path>',
		'carbon-markets': '<circle cx="12" cy="12" r="8.5"></circle><path d="M8.5 15.5c0-4.2 2.6-7 7-7 0 4.2-2.6 7-7 7ZM8.5 15.5l3.5-3.5"></path>',
		ccis: '<circle cx="8" cy="9" r="3.6"></circle><circle cx="16" cy="9" r="3.6"></circle><circle cx="12" cy="16" r="3.6"></circle>'
	};
</script>

{#if PATHS[slug]}
	<svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#11a44f" stroke-width={size > 48 ? 1.4 : 1.6} stroke-linecap="round" stroke-linejoin="round">{@html PATHS[slug]}</svg>
{/if}
