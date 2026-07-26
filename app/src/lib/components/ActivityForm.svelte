<script lang="ts">
	import { decodeMultiSelectValue } from '$lib/domain';
	import type { RequiredFieldsActivity } from '$lib/domain';

	let {
		activity,
		values = {}
	}: {
		activity: RequiredFieldsActivity;
		values?: Record<string, string>;
	} = $props();

	// Estado local dos checkboxes de cada campo selecao_multipla — precisa
	// ser reativo no cliente (não só refletir `values` do último submit) para
	// que `revealWhen` reaja imediatamente ao marcar/desmarcar uma opção,
	// sem round-trip ao servidor.
	// svelte-ignore state_referenced_locally -- seed intencional a partir de
	// `activity`/`values` (props de montagem); depois diverge por toggleOption
	// e não deve reagir a mudanças posteriores dos props (não é um $derived).
	let multiSelectState = $state<Record<string, Set<string>>>(
		Object.fromEntries(
			activity.fields
				.filter((field) => field.dataTarget === 'answer' && field.type === 'selecao_multipla')
				.map((field) => [field.id, new Set(decodeMultiSelectValue(values[field.id] ?? '[]') ?? [])])
		)
	);

	function toggleOption(fieldId: string, optionId: string, checked: boolean) {
		const next = new Set(multiSelectState[fieldId]);
		if (checked) next.add(optionId);
		else next.delete(optionId);
		multiSelectState = { ...multiSelectState, [fieldId]: next };
	}

	function isVisible(field: RequiredFieldsActivity['fields'][number]): boolean {
		if (field.dataTarget !== 'answer' || !field.revealWhen) return true;
		return multiSelectState[field.revealWhen.fieldId]?.has(field.revealWhen.optionId) ?? false;
	}
</script>

<div class="fields">
	{#each activity.fields as field (field.id)}
		{#if isVisible(field)}
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
				{:else if field.type === 'selecao_multipla'}
					<div class="checkbox-group" role="group" aria-label={field.label}>
						{#each field.options as option (option.id)}
							<label class="checkbox-option">
								<input
									type="checkbox"
									name={field.id}
									value={option.id}
									checked={multiSelectState[field.id]?.has(option.id) ?? false}
									onchange={(event) => toggleOption(field.id, option.id, event.currentTarget.checked)}
								/>
								{option.label}
							</label>
						{/each}
					</div>
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
		{/if}
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

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 400;
		font-size: 0.95rem;
	}

	.checkbox-option input[type='checkbox'] {
		width: auto;
		padding: 0;
	}
</style>
