<script lang="ts">
	import { decodeMultiSelectValue } from '$lib/domain';
	import type { RequiredFieldsActivity } from '$lib/domain';
	import type { FieldSuggestionView } from '$lib/orientation-engine';

	let {
		activity,
		values = {},
		fieldSuggestions = []
	}: {
		activity: RequiredFieldsActivity;
		values?: Record<string, string>;
		fieldSuggestions?: FieldSuggestionView[];
	} = $props();

	let suggestionByFieldId = $derived(
		new Map(fieldSuggestions.map((suggestion) => [suggestion.fieldId, suggestion]))
	);

	// Só os campos com sugestão precisam de valor controlado — para decidir,
	// reativamente, quando esconder a affordance porque o usuário já digitou
	// algo (mesmo sem ter salvo ainda). Os demais campos continuam
	// não-controlados, sem mudança de comportamento.
	// svelte-ignore state_referenced_locally -- seed intencional a partir de
	// `values` (prop de montagem); diverge depois por input/aceitar sugestão.
	let suggestedFieldValues = $state<Record<string, string>>(
		Object.fromEntries(
			activity.fields
				.filter((field) => field.dataTarget === 'answer' && suggestionByFieldId.has(field.id))
				.map((field) => [field.id, values[field.id] ?? ''])
		)
	);

	function acceptSuggestion(fieldId: string, sourceValue: string) {
		suggestedFieldValues = { ...suggestedFieldValues, [fieldId]: sourceValue };
		queueMicrotask(() => {
			const el = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
			el?.focus();
		});
	}

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
			{@const suggestion = field.dataTarget === 'answer' ? suggestionByFieldId.get(field.id) : undefined}
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

				{#if suggestion && (suggestedFieldValues[field.id] ?? '') === ''}
					<div class="field-suggestion">
						<button
							type="button"
							class="button-secondary"
							onclick={() => acceptSuggestion(field.id, suggestion.sourceValue)}
						>
							{suggestion.actionLabel}
						</button>
						<p class="field-suggestion-help">{suggestion.helpText}</p>
					</div>
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
					{#if field.dataTarget === 'answer' && suggestionByFieldId.has(field.id)}
						<textarea
							id={field.id}
							name={field.id}
							placeholder={field.placeholder ?? ''}
							required={field.required}
							rows="4"
							bind:value={suggestedFieldValues[field.id]}
						></textarea>
					{:else}
						<textarea
							id={field.id}
							name={field.id}
							placeholder={field.placeholder ?? ''}
							required={field.required}
							rows="4">{values[field.id] ?? ''}</textarea
						>
					{/if}
				{:else if field.dataTarget === 'answer' && suggestionByFieldId.has(field.id)}
					<input
						id={field.id}
						name={field.id}
						type="text"
						placeholder={field.placeholder ?? ''}
						required={field.required}
						bind:value={suggestedFieldValues[field.id]}
					/>
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

	.field-suggestion {
		border: 1px solid var(--hydra-border, #3a4552);
		border-radius: 8px;
		padding: 0.6rem 0.85rem;
		background: var(--hydra-surface-raised, #232e3b);
	}

	.field-suggestion-help {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--hydra-muted, #9aa5b1);
	}
</style>
