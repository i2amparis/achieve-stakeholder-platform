<script lang="ts">
	let { page }: { page: { title: string; body: string | null } } = $props();
</script>

<svelte:head><title>{page.title} · ACHIEVE stakeholder platform</title></svelte:head>
<section class="hero" aria-labelledby="page-title">
	<div class="wrap hero__inner" style="padding-top: 40px; padding-bottom: 40px;"><h1 id="page-title" class="title">{page.title}</h1></div>
</section>
<section class="section"><div class="wrap prose">{@html page.body ?? ''}</div></section>
