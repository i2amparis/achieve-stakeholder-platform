<script lang="ts">
	// One inline feedback prompt (at most three questions), posting to a form action
	// of the current page. Works without JavaScript; with it, the page does not reload.
	import { enhance } from '$app/forms';
	import { ACTOR_TYPES } from '#lib/feedback/form.ts';

	type Result = { form?: string; sent?: boolean; errors?: Record<string, string>; values?: Record<string, string> } | null | undefined;

	let {
		id,
		action,
		kicker,
		question,
		note,
		result,
		withUsefulness = false,
		withRole = false,
		messageLabel,
		placeholder,
		fullFormHref,
		hidden = {},
		headingLevel = 2
	}: {
		id: string;
		action: string;
		kicker: string;
		question: string;
		note: string;
		result: Result;
		withUsefulness?: boolean;
		withRole?: boolean;
		messageLabel?: string;
		placeholder?: string;
		fullFormHref?: string;
		hidden?: Record<string, string>;
		headingLevel?: 2 | 3;
	} = $props();

	const mine = $derived(result?.form === id ? result : null);
	const errors = $derived(mine?.errors ?? {});
	const values = $derived(mine?.values ?? {});
	let submitting = $state(false);
</script>

<section class="prompt" aria-labelledby="{id}-q">
	<div class="prompt__head stack">
		<p class="kicker">{kicker}</p>
		<svelte:element this={`h${headingLevel}`} id="{id}-q" class="h2--sm" style="font-size: 26px; line-height: 34px;">{question}</svelte:element>
		<p class="hint">{note}</p>
	</div>
	<div class="prompt__body">
		{#if mine?.sent}
			<p class="status" role="status">Thank you. Your answer has reached the ACHIEVE team.</p>
		{:else}
			<form
				method="POST"
				{action}
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: true });
						submitting = false;
					};
				}}
				class="stack"
				style="--stack: 16px"
				novalidate
			>
				{#if errors.form}<p class="status status--error" role="alert">{errors.form}</p>{/if}
				{#each Object.entries(hidden) as [name, value] (name)}<input type="hidden" {name} {value} />{/each}
				{#if withUsefulness}
					<fieldset style="border: 0; margin: 0; padding: 0;">
						<legend class="label" style="padding: 0; margin-bottom: 10px;">How useful is it?</legend>
						<div class="options">
							{#each [['very_useful', 'Very useful'], ['somewhat', 'Somewhat'], ['not_really', 'Not really']] as [value, label] (value)}
								<label class="option"><input type="radio" name="usefulness" {value} checked={values.usefulness === value} /><span>{label}</span></label>
							{/each}
						</div>
					</fieldset>
				{/if}
				<div class="field">
					<label class="label" for="{id}-message">{messageLabel ?? 'Your answer'}{#if withUsefulness}{' '}<span class="muted" style="font-weight: 400;">(optional)</span>{/if}</label>
					{#if errors.message}<p class="error" id="{id}-message-error">{errors.message}</p>{/if}
					<textarea
						class="textarea"
						id="{id}-message"
						name="message"
						rows={withUsefulness ? 3 : 4}
						{placeholder}
						aria-invalid={errors.message ? 'true' : undefined}
						aria-describedby={errors.message ? `${id}-message-error` : undefined}
					>{values.message ?? ''}</textarea>
				</div>
				{#if withRole}
					<div class="field">
						<label class="label" for="{id}-role">You work in <span class="muted" style="font-weight: 400;">(optional)</span></label>
						<select class="select" id="{id}-role" name="actor_type">
							<option value="">Choose…</option>
							{#each ACTOR_TYPES as [value, label] (value)}<option {value} selected={values.actor_type === value}>{label}</option>{/each}
						</select>
					</div>
				{/if}
				<div class="honeypot" aria-hidden="true"><label>Leave this empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>
				<div class="row" style="--row-gap: 12px; --col-gap: 20px; align-items: center;">
					<button type="submit" class="ach-btn ach-btn-primary ach-btn--sm" disabled={submitting}>{withUsefulness ? 'Send feedback' : 'Send'}</button>
					{#if fullFormHref}<a href={fullFormHref} style="font-size: 15px;">Add your role and region on the full form</a>{/if}
				</div>
			</form>
		{/if}
	</div>
</section>
