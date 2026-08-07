<script lang="ts">
	import { decodeMultiSelectValue, decodePlanningItems, encodePlanningItems } from '$lib/domain';
	import type { PlanningItem, RequiredFieldsActivity } from '$lib/domain';
	import type { FieldSuggestionView } from '$lib/orientation-engine';
	import PlanningItemsEditor from './PlanningItemsEditor.svelte';

	type FieldEntry = RequiredFieldsActivity['fields'][number];

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

	// Estado local de cada campo lista_partes (C5-01) — mesmo espírito de
	// multiSelectState: precisa ser reativo no cliente (adicionar/renomear/
	// remover sem round-trip), refletido num input escondido cujo `value` é
	// sempre o array codificado (planning-items.ts), nunca montado à mão aqui.
	// svelte-ignore state_referenced_locally -- seed intencional de montagem.
	let planningItemsState = $state<Record<string, PlanningItem[]>>(
		Object.fromEntries(
			activity.fields
				.filter((field) => field.dataTarget === 'answer' && field.type === 'lista_partes')
				.map((field) => [field.id, decodePlanningItems(values[field.id])])
		)
	);

	function setPlanningItems(fieldId: string, items: PlanningItem[]) {
		planningItemsState = { ...planningItemsState, [fieldId]: items };
	}

	function isVisible(field: FieldEntry): boolean {
		if (field.dataTarget !== 'answer' || !field.revealWhen) return true;
		return multiSelectState[field.revealWhen.fieldId]?.has(field.revealWhen.optionId) ?? false;
	}

	// Agrupa campos com o mesmo FieldDefinition.optionalGroup numa única seção
	// expansível, na posição do primeiro campo do grupo — ver
	// domain/catalog-types.ts. Campos sem optionalGroup continuam soltos, na
	// ordem original do catálogo.
	type RenderItem =
		| { kind: 'field'; key: string; field: FieldEntry }
		| { kind: 'group'; key: string; groupId: string; groupLabel: string; fields: FieldEntry[] };

	function buildRenderPlan(fields: FieldEntry[]): RenderItem[] {
		const plan: RenderItem[] = [];
		const groupPositionById = new Map<string, number>();

		for (const field of fields) {
			const group = field.dataTarget === 'answer' ? field.optionalGroup : undefined;
			if (!group) {
				plan.push({ kind: 'field', key: field.id, field });
				continue;
			}

			const existingIndex = groupPositionById.get(group.id);
			if (existingIndex === undefined) {
				groupPositionById.set(group.id, plan.length);
				plan.push({ kind: 'group', key: `group-${group.id}`, groupId: group.id, groupLabel: group.label, fields: [field] });
			} else {
				const existing = plan[existingIndex];
				if (existing.kind === 'group') existing.fields.push(field);
			}
		}

		return plan;
	}

	let renderPlan = $derived(buildRenderPlan(activity.fields));

	// Aberta inicialmente só quando algum campo do grupo já tem valor (Answer
	// persistida ou valor reenviado após erro de validação, via `values`).
	// Abrir/fechar depois é decisão do usuário — nunca salva nem altera
	// respostas, e não reage a mudanças posteriores nos props (mesmo padrão de
	// multiSelectState/suggestedFieldValues acima).
	// svelte-ignore state_referenced_locally -- seed intencional de montagem.
	let groupOpenState = $state<Record<string, boolean>>(
		Object.fromEntries(
			renderPlan
				.filter((item): item is Extract<RenderItem, { kind: 'group' }> => item.kind === 'group')
				.map((item) => [item.groupId, item.fields.some((field) => (values[field.id] ?? '').trim().length > 0)])
		)
	);
</script>

{#snippet fieldRow(field: FieldEntry)}
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
			{:else if field.type === 'lista_partes'}
				<input type="hidden" name={field.id} value={encodePlanningItems(planningItemsState[field.id] ?? [])} />
				<PlanningItemsEditor
					items={planningItemsState[field.id] ?? []}
					mode="build"
					onchange={(items) => setPlanningItems(field.id, items)}
				/>
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
{/snippet}

<div class="fields">
	{#each renderPlan as item (item.key)}
		{#if item.kind === 'field'}
			{@render fieldRow(item.field)}
		{:else}
			{@const filledCount = item.fields.filter((field) => (values[field.id] ?? '').trim().length > 0).length}
			<details class="optional-group" bind:open={groupOpenState[item.groupId]}>
				<summary>
					{item.groupLabel}
					{#if filledCount > 0}
						<span class="group-count"
							>· {filledCount} {filledCount === 1 ? 'informação adicionada' : 'informações adicionadas'}</span
						>
					{/if}
				</summary>
				<div class="group-fields">
					{#each item.fields as field (field.id)}
						{@render fieldRow(field)}
					{/each}
				</div>
			</details>
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
		color: var(--hydra-accent, #151918);
	}

	.optional {
		font-weight: 400;
		font-size: 0.8rem;
		color: var(--hydra-muted, #65686c);
	}

	.help {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted, #65686c);
	}

	input,
	textarea,
	select {
		font: inherit;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--hydra-border, #65686c);
		background: var(--hydra-surface, #f8f8f8);
		color: var(--hydra-text, #151918);
	}

	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--hydra-accent, #151918);
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
		border: 1px solid var(--hydra-border, #65686c);
		border-radius: 8px;
		padding: 0.6rem 0.85rem;
		background: var(--hydra-surface-raised, #f8f8f8);
	}

	.field-suggestion-help {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--hydra-muted, #65686c);
	}

	.optional-group {
		border: 1px solid var(--hydra-border, #65686c);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		background: var(--hydra-surface, #f8f8f8);
	}

	.optional-group summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 0.95rem;
		list-style: revert;
	}

	.optional-group summary:focus-visible {
		outline: 2px solid var(--hydra-accent, #151918);
		outline-offset: 2px;
	}

	.group-count {
		font-weight: 400;
		font-size: 0.85rem;
		color: var(--hydra-muted, #65686c);
	}

	.optional-group .group-fields {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-top: 1rem;
	}

	.optional-group[open] summary {
		margin-bottom: 0;
	}
</style>
