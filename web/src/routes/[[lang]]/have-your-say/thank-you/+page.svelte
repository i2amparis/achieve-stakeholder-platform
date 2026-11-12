<script lang="ts">
	import { enhance } from '$app/forms';
	import { href } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const h = (p: string) => href(p, data.locale);
	const errors = $derived((form?.form === 'join' ? form.errors : null) ?? {}) as Record<string, string>;
	const values = $derived((form?.form === 'join' ? form.values : null) ?? {}) as Record<string, string>;
	const joined = $derived(form?.form === 'join' && 'sent' in form && form.sent);
</script>

<svelte:head>
	<title>{data.sent ? 'Thank you' : 'Join the community'} · ACHIEVE stakeholder platform</title>
</svelte:head>

<section class="hero" aria-labelledby="ty-title">
	<div class="wrap hero__inner stack" style="padding-top: 40px; padding-bottom: 40px;">
		<p class="eyebrow">Have your say</p>
		<h1 id="ty-title" class="title">{data.sent ? 'Thank you' : 'Join the ACHIEVE stakeholder community'}</h1>
	</div>
</section>

<section class="section" style="padding-top: 40px;">
	<div class="wrap row" style="--row-gap: 40px; --col-gap: 56px; align-items: flex-start;">
		{#if data.sent}
			<div class="grow stack" role="status" style="flex-basis: 480px; --stack: 16px;">
				<svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#11a44f" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"></circle><path d="m7.5 12.5 3 3 6-6.5"></path></svg>
				<p class="lede">Your answer has reached the ACHIEVE team. We pass it to the researchers working on the topic, and we report back on what we heard in our newsletter.</p>
				<p><a href={h('/have-your-say')}>Send another answer</a> · <a href={h('/library')}>Explore the library</a></p>
			</div>
		{/if}
		<section id="join" class="panel--tint stack" style="flex: 1 1 420px; min-width: 0; --stack: 16px;" aria-labelledby="join-title" tabindex="-1">
			<h2 id="join-title" class="h3" style="font-size: 26px; line-height: 34px;">{data.sent ? 'Join the ACHIEVE stakeholder community' : 'Hear first when roadmap drafts open'}</h2>
			<p style="font-size: 16px; line-height: 24px;">Hear first when roadmap drafts open for comment, get invitations to webinars and workshops, and meet peers working on the same integrity questions.</p>
			{#if joined}
				<p class="status" role="status">Thank you. You are on the list; we will write when roadmap drafts open.</p>
			{:else}
				<form method="POST" action="?/join" class="stack" style="--stack: 16px;" novalidate use:enhance>
					{#if errors.form}<p class="status status--error" role="alert">{errors.form}</p>{/if}
					<div class="field" style="max-width: 420px;">
						<label class="label" for="join-email">Email</label>
						{#if errors.email}<p class="error" id="join-email-error">{errors.email}</p>{/if}
						<input id="join-email" name="email" type="email" class="input" autocomplete="email" value={values.email ?? ''} aria-invalid={errors.email ? 'true' : undefined} aria-describedby={errors.email ? 'join-email-error' : undefined} />
					</div>
					{#if errors.consent}<p class="error" id="join-consent-error">{errors.consent}</p>{/if}
					<label class="check">
						<input type="checkbox" name="consent" value="yes" aria-describedby={errors.consent ? 'join-consent-error' : undefined} />
						<span>I agree that ACHIEVE stores my email to send me community updates until the project ends in December 2027 or until I unsubscribe. <a href={h('/privacy')}>Privacy notice</a></span>
					</label>
					<div class="honeypot" aria-hidden="true"><label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
					<div><button type="submit" class="ach-btn ach-btn-primary ach-btn--sm">Join the community</button></div>
				</form>
			{/if}
		</section>
	</div>
</section>
