<script lang="ts">
	import type { RequiredFieldsActivity } from '$lib/domain';

	let {
		activity,
		values = {}
	}: {
		activity: RequiredFieldsActivity;
		values?: Record<string, string>;
	} = $props();
</script>

<div class="fields">
	{#each activity.fields as field (field.id)}
		<div class="field">
			<label for={field.id}>
				{field.label}
				{#if field.required}
					<span class="required" aria-hidden="true">*</span>
				{:else}
					<span class="optional">(opcional)</span>
				{/if}
			</label>
			{#if field.help}
				<p class="help">{field.help}</p>
			{/if}

			{#if field.type === 'selecao'}
				<select id={field.id} name={field.id} required={field.required}>
					<option value="" disabled selected={!values[field.id]}>Selecione...</option>
					{#each field.options as option (option)}
						<option value={option} selected={values[field.id] === option}>{option}</option>
					{/each}
				</select>
			{:else if field.type === 'texto_longo'}
				<textarea
					id={field.id}
					name={field.id}
					placeholder={field.placeholder ?? ''}
					required={field.required}
					rows="4">{values[field.id] ?? ''}</textarea
				>
			{:else}
				<input
					id={field.id}
					name={field.id}
					type="text"
					placeholder={field.placeholder ?? ''}
					required={field.required}
					value={values[field.id] ?? ''}
				/>
			{/if}
		</div>
	{/each}
</div>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	label {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.required {
		color: var(--hydra-accent, #4fd1c5);
	}

	.optional {
		font-weight: 400;
		font-size: 0.8rem;
		color: var(--hydra-muted, #9aa5b1);
	}

	.help {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted, #9aa5b1);
	}

	input,
	textarea,
	select {
		font: inherit;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--hydra-border, #3a4552);
		background: var(--hydra-surface, #1b2430);
		color: var(--hydra-text, #e8edf2);
	}

	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--hydra-accent, #4fd1c5);
		outline-offset: 1px;
	}

	textarea {
		resize: vertical;
	}
</style>
