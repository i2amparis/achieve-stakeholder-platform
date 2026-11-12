<script lang="ts">
	import { enhance } from '$app/forms';
	import { ACTOR_TYPES, REGIONS } from '#lib/feedback/form.ts';
	import { monthYear } from '#lib/format.ts';
	import { href } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const h = (p: string) => href(p, data.locale);

	const S: Record<string, { label: string; desc: string; q: string; hint: string }> = {
		comment: { label: 'Comment on our work', desc: 'Tell us what is useful in an ACHIEVE output, what is wrong, or what is missing.', q: 'Which output are you commenting on, and what do you think?', hint: 'Name the report, brief, or article if you can.' },
		suggest_research: { label: 'Suggest research', desc: 'Point us to a question about the integrity of climate pledges that nobody is answering yet.', q: 'What should ACHIEVE look into?', hint: 'A question, a gap in the evidence, or a dataset we should use.' },
		share_challenge: { label: 'Share a challenge', desc: 'Describe an integrity problem your organisation faces when setting or delivering climate pledges.', q: 'What is the biggest integrity challenge your organisation faces right now?', hint: 'For example: unreliable emissions data, unclear rules on offsets, or pressure to set targets you cannot yet deliver.' }
	};

	const errors = $derived((form?.form === 'say' ? form.errors : null) ?? {}) as Record<string, string>;
	const values = $derived((form?.form === 'say' ? form.values : null) ?? {}) as Record<string, string>;
	let stream = $state('share_challenge');
	let followUp = $state(false);
	$effect.pre(() => {
		stream = values.stream || data.stream || 'share_challenge';
		followUp = values.followup === 'yes';
	});
	let submitting = $state(false);
	const errorList = $derived(Object.entries(errors));
</script>

<svelte:head>
	<title>Have your say · ACHIEVE stakeholder platform</title>
	<meta name="description" content="Comment on ACHIEVE's work, suggest research, or share an integrity challenge your organisation faces." />
</svelte:head>

<section class="hero" aria-labelledby="say-title">
	<div class="wrap hero__inner stack" style="padding-top: 40px; padding-bottom: 40px;">
		<p class="eyebrow">Take part</p>
		<h1 id="say-title" class="title">Have your say</h1>
		<p class="intro">What you tell us shapes the questions we study and the five actor roadmaps we will publish in 2027.</p>
		<p lang="es" class="muted">Puede responder en español o en portugués.</p>
	</div>
</section>

<section class="section" style="padding-top: 40px;">
	<div class="wrap row" style="--row-gap: 40px; --col-gap: 56px; align-items: flex-start;">
		<form
			method="POST"
			class="grow stack"
			style="flex-basis: 620px; --stack: 32px;"
			aria-labelledby="say-title"
			novalidate
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			{#if errorList.length}
				<div class="status status--error" role="alert" tabindex="-1">
					<p style="font-weight: 600;">Please check your answer</p>
					<ul style="margin: 6px 0 0; padding-left: 20px;">
						{#each errorList as [field, message] (field)}<li>{#if field === 'form'}{message}{:else}<a href="#say-{field}">{message}</a>{/if}</li>{/each}
					</ul>
				</div>
			{/if}

			<fieldset style="border: 0; margin: 0; padding: 0;">
				<legend class="h3" style="padding: 0; margin-bottom: 14px;"><span class="muted">1.</span> What would you like to do?</legend>
				<div id="say-stream" style="display: grid; gap: 12px;">
					{#each Object.entries(S) as [key, s] (key)}
						<label style="display: flex; gap: 14px; align-items: flex-start; border: 2px solid {stream === key ? 'var(--navy)' : 'var(--grey)'}; background: {stream === key ? 'var(--surface-tint)' : 'var(--surface)'}; padding: 16px 18px; border-radius: var(--radius-sm); cursor: pointer;">
							<input type="radio" name="stream" value={key} bind:group={stream} style="width: 22px; height: 22px; margin: 2px 0 0; accent-color: var(--navy); flex: 0 0 auto;" />
							<span><strong style="font-family: var(--font-display); font-weight: 500; font-size: 19px; color: var(--navy);">{s.label}</strong><br /><span style="font-size: 16px; line-height: 24px;">{s.desc}</span></span>
						</label>
					{/each}
				</div>
			</fieldset>

			<div class="field">
				<label for="say-message" class="h3"><span class="muted">2.</span> {S[stream].q}</label>
				<p id="say-message-hint" class="hint">{S[stream].hint}</p>
				{#if errors.message}<p class="error" id="say-message-error">{errors.message}</p>{/if}
				<textarea id="say-message" name="message" rows="7" class="textarea" aria-describedby="say-message-hint{errors.message ? ' say-message-error' : ''}" aria-invalid={errors.message ? 'true' : undefined}>{values.message ?? ''}</textarea>
			</div>

			<fieldset style="border: 0; margin: 0; padding: 0;" class="stack">
				<legend class="h3" style="padding: 0; margin-bottom: 14px;"><span class="muted">3.</span> About you <span class="muted" style="font-family: var(--font-sans); font-size: 16px;">(optional)</span></legend>
				<div class="row" style="--row-gap: 16px; --col-gap: 20px;">
					<div class="field" style="flex: 1 1 220px;">
						<label class="label" for="say-actor">You work in</label>
						<select id="say-actor" name="actor_type" class="select">
							<option value="">Prefer not to say</option>
							{#each ACTOR_TYPES as [v, l] (v)}<option value={v} selected={values.actor_type === v}>{l}</option>{/each}
						</select>
					</div>
					<div class="field" style="flex: 1 1 180px;">
						<label class="label" for="say-region">Region</label>
						<select id="say-region" name="region" class="select">
							<option value="">Prefer not to say</option>
							{#each REGIONS as [v, l] (v)}<option value={v} selected={values.region === v}>{l}</option>{/each}
						</select>
					</div>
					<div class="field" style="flex: 1 1 180px;">
						<label class="label" for="say-country">Country</label>
						<input id="say-country" name="country" class="input" type="text" autocomplete="country-name" value={values.country ?? ''} />
					</div>
				</div>
				<div class="panel--tint stack" style="padding: 18px 20px; margin-top: 20px;">
					<label class="check">
						<input type="checkbox" name="followup" value="yes" bind:checked={followUp} />
						<span>I am happy to be contacted about my answer. <span class="muted">Your email is used only for this follow-up: we pass it to the ACHIEVE partner working on your topic, and delete it afterwards.</span></span>
					</label>
					{#if followUp}
						<div class="field" style="max-width: 420px;">
							<label class="label" for="say-email">Email</label>
							{#if errors.email}<p class="error" id="say-email-error">{errors.email}</p>{/if}
							<input id="say-email" name="email" type="email" class="input" autocomplete="email" value={values.email ?? ''} aria-invalid={errors.email ? 'true' : undefined} aria-describedby={errors.email ? 'say-email-error' : undefined} />
						</div>
					{:else}
						<noscript>
							<div class="field" style="max-width: 420px;">
								<label class="label" for="say-email-ns">Email (only if you ticked the box above)</label>
								<input id="say-email-ns" name="email" type="email" class="input" autocomplete="email" />
							</div>
						</noscript>
					{/if}
				</div>
			</fieldset>

			<div class="honeypot" aria-hidden="true"><label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
			<div class="stack">
				<button type="submit" class="ach-btn ach-btn-primary" disabled={submitting}>Send your answer</button>
				<p class="hint">Anonymous unless you give an email. Read how we handle your answer in the <a href={h('/privacy')}>privacy notice</a>.</p>
			</div>
		</form>

		<aside class="side stack" style="--stack: 32px; flex-basis: 320px;">
			<section aria-labelledby="how-title" class="stack">
				<h2 id="how-title" class="h3">Where your answer goes</h2>
				<ol style="margin: 0; padding-left: 22px; font-size: 16px; line-height: 24px;" class="stack">
					<li>Our team reads it and tags it by actor group and integrity principle.</li>
					<li>It goes to the researchers working on that topic, including the authors of the actor roadmaps.</li>
					<li>Common themes feed future research questions, and we report back on what we heard.</li>
				</ol>
			</section>
			<section aria-labelledby="priv-title" class="stack">
				<h2 id="priv-title" class="h3">Your privacy</h2>
				<ul style="margin: 0; padding-left: 22px; font-size: 16px; line-height: 24px;" class="stack">
					<li>Answers are anonymous by default.</li>
					<li>Email is optional, with a separate consent for follow-up and for the community.</li>
					<li>Responses are stored on servers in the EU and kept until the end of the project (December 2027).</li>
					<li>No tracking cookies on this site.</li>
				</ul>
				<p style="font-size: 16px;"><a href={h('/privacy')}>Read the privacy notice</a></p>
			</section>
			{#if data.open.length}
				<section aria-labelledby="open-title" class="stack">
					<h2 id="open-title" class="h3">Questions open now</h2>
					<ul style="list-style: none; margin: 0; padding: 0; font-size: 16px; line-height: 24px;" class="stack">
						{#each data.open as o (o.slug)}
							<li><a href={h(`/library/${o.slug}`) + '#feedback'}>{o.title}</a><br /><span class="muted" style="font-size: 14px;">{data.openQuestion} · Due {monthYear(o.date)}</span></li>
						{/each}
					</ul>
				</section>
			{/if}
		</aside>
	</div>
</section>
