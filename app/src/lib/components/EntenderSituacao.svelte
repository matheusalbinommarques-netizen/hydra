<script lang="ts">
	// "Entender a situação" (Claude Design, "Entender a Situacao.dc.html") —
	// substitui o texto livre da antiga "Problema ou oportunidade" por seleção
	// estruturada em três passos (o quê / onde / peso) e uma síntese
	// determinística de confirmação. Fluxo local até a confirmação: só a
	// confirmação da síntese ("Sim, continuar") submete ao servidor, via a
	// mesma action genérica `?/answer` já usada por todas as atividades
	// required_fields — nenhuma persistência nova.
	import { enhance } from '$app/forms';
	import {
		isOpportunityOrigin,
		SITUATION_WHAT_OPPORTUNITY_OPTIONS,
		SITUATION_WHAT_PROBLEM_OPTIONS,
		SITUATION_WHERE_OPTIONS,
		SITUATION_WEIGHT_OPTIONS
	} from '$lib/catalog/discovery';
	import { buildSituationSynthesis } from '$lib/catalog/situation-synthesis';
	import { decodeMultiSelectValue } from '$lib/domain';
	import type { RequiredFieldsActivity } from '$lib/domain';
	import SkipActivityConfirm from './SkipActivityConfirm.svelte';

	let {
		activity,
		values = {},
		originAnswer,
		reviewOrigin
	}: {
		activity: RequiredFieldsActivity;
		values?: Record<string, string>;
		originAnswer?: string;
		reviewOrigin?: 'summary' | 'records';
	} = $props();

	type Step = 'what' | 'where' | 'weight' | 'synthesis';

	let opportunityGroup = $derived(isOpportunityOrigin(originAnswer));
	let whatOptions = $derived(opportunityGroup ? SITUATION_WHAT_OPPORTUNITY_OPTIONS : SITUATION_WHAT_PROBLEM_OPTIONS);
	let outroWhatId = $derived(opportunityGroup ? 'opor_outro' : 'prob_outro');
	let whatQuestion = $derived(opportunityGroup ? 'O que trouxe essa oportunidade?' : 'O que está acontecendo?');

	let step = $state<Step>('what');
	// Seeds intencionais de montagem (values já persistidos, ex. reabrindo a
	// partir de Registros/Resumo) — mesmo padrão de ActivityForm.svelte.
	// svelte-ignore state_referenced_locally
	let whatKeys = $state<Set<string>>(new Set(decodeMultiSelectValue(values['situacao_o_que'] ?? '[]') ?? []));
	// svelte-ignore state_referenced_locally
	let whereKeys = $state<Set<string>>(new Set(decodeMultiSelectValue(values['situacao_onde'] ?? '[]') ?? []));
	// svelte-ignore state_referenced_locally
	let weightKey = $state<string | null>(values['situacao_peso']?.trim() || null);
	// svelte-ignore state_referenced_locally
	let otherWhatText = $state(values['situacao_o_que_outro'] ?? '');
	// svelte-ignore state_referenced_locally
	let otherWhereText = $state(values['situacao_onde_outro'] ?? '');

	function toggleWhat(id: string) {
		const next = new Set(whatKeys);
		next.has(id) ? next.delete(id) : next.add(id);
		whatKeys = next;
	}

	function toggleWhere(id: string) {
		const next = new Set(whereKeys);
		next.has(id) ? next.delete(id) : next.add(id);
		whereKeys = next;
	}

	let whatEmpty = $derived(whatKeys.size === 0);

	let synthesisText = $derived(
		buildSituationSynthesis({
			originLabel: originAnswer,
			whatIds: [...whatKeys],
			whatOtherText: otherWhatText,
			whereIds: [...whereKeys],
			whereOtherText: otherWhereText,
			weightLabel: weightKey
		})
	);

</script>

<div class="es">
	{#if step === 'what'}
		<p class="es-eyebrow">Entender a situação · Passo 1 de 3</p>
		<h2 class="es-question">{whatQuestion}</h2>
		<p class="es-help">Selecione todos que se aplicam.</p>
		<div class="es-chips">
			{#each whatOptions as opt (opt.id)}
				<button
					type="button"
					class="es-chip"
					class:selected={whatKeys.has(opt.id)}
					onclick={() => toggleWhat(opt.id)}
				>
					<span class="es-chip-dot" aria-hidden="true"></span>
					{opt.label}
				</button>
			{/each}
		</div>
		{#if whatKeys.has(outroWhatId)}
			<div class="es-other">
				<input type="text" bind:value={otherWhatText} placeholder="Descreva em poucas palavras…" />
			</div>
		{/if}
		<div class="es-actions">
			<button type="button" class="es-btn-primary" disabled={whatEmpty} onclick={() => (step = 'where')}>
				Continuar <span aria-hidden="true">→</span>
			</button>
		</div>
	{:else if step === 'where'}
		<button type="button" class="es-back" onclick={() => (step = 'what')}>← Voltar</button>
		<p class="es-eyebrow es-eyebrow-spaced">Entender a situação · Passo 2 de 3</p>
		<h2 class="es-question">Onde isso aparece principalmente?</h2>
		<p class="es-help">Selecione uma ou mais áreas.</p>
		<div class="es-chips">
			{#each SITUATION_WHERE_OPTIONS as opt (opt.id)}
				<button
					type="button"
					class="es-chip"
					class:selected={whereKeys.has(opt.id)}
					onclick={() => toggleWhere(opt.id)}
				>
					<span class="es-chip-dot" aria-hidden="true"></span>
					{opt.label}
				</button>
			{/each}
		</div>
		{#if whereKeys.has('area_outra')}
			<div class="es-other">
				<input type="text" bind:value={otherWhereText} placeholder="Descreva em poucas palavras…" />
			</div>
		{/if}
		<div class="es-actions">
			<button type="button" class="es-btn-primary" onclick={() => (step = 'weight')}>
				Continuar <span aria-hidden="true">→</span>
			</button>
			<button type="button" class="es-btn-text" onclick={() => (step = 'weight')}>Pular esta pergunta</button>
		</div>
	{:else if step === 'weight'}
		<button type="button" class="es-back" onclick={() => (step = 'where')}>← Voltar</button>
		<p class="es-eyebrow es-eyebrow-spaced">Entender a situação · Passo 3 de 3</p>
		<h2 class="es-question">Qual é o peso disso hoje?</h2>
		<p class="es-help">Uma estimativa vale mais que nada.</p>
		<div class="es-rows">
			{#each SITUATION_WEIGHT_OPTIONS as label (label)}
				<button
					type="button"
					class="es-row"
					class:selected={weightKey === label}
					onclick={() => (weightKey = label)}
				>
					{label}
				</button>
			{/each}
		</div>
		<div class="es-actions">
			<button type="button" class="es-btn-primary" onclick={() => (step = 'synthesis')}>
				Ver síntese <span aria-hidden="true">→</span>
			</button>
			<button type="button" class="es-btn-text" onclick={() => (step = 'synthesis')}>Pular esta pergunta</button>
		</div>
	{:else}
		<p class="es-eyebrow">Entender a situação · Síntese</p>
		<h2 class="es-question">É mais ou menos isso?</h2>
		<div class="es-synthesis-box">
			<p>{synthesisText}</p>
		</div>

		<form
			method="POST"
			action="?/answer"
			use:enhance={() => async ({ update }) => update()}
		>
			<input type="hidden" name="activityDefinitionId" value={activity.id} />
			{#if reviewOrigin}
				<input type="hidden" name="returnTo" value={reviewOrigin} />
			{/if}
			<input type="hidden" name="situacao" value={synthesisText} />
			<!-- Um input por id selecionado, mesmo formato que checkboxes brutos
			     produziriam — a action genérica `?/answer` já sabe agrupar e
			     codificar múltiplos valores do mesmo name para campos
			     selecao_multipla (ver now/+page.server.ts). Codificar aqui
			     também duplicaria a codificação. -->
			{#each whatKeys as id (id)}
				<input type="hidden" name="situacao_o_que" value={id} />
			{/each}
			<input type="hidden" name="situacao_o_que_outro" value={otherWhatText} />
			{#each whereKeys as id (id)}
				<input type="hidden" name="situacao_onde" value={id} />
			{/each}
			<input type="hidden" name="situacao_onde_outro" value={otherWhereText} />
			<input type="hidden" name="situacao_peso" value={weightKey ?? ''} />

			<div class="es-actions">
				<button type="submit" class="es-btn-primary">
					Sim, continuar <span aria-hidden="true">→</span>
				</button>
				<button type="button" class="es-btn-secondary" onclick={() => (step = 'what')}>Quero ajustar</button>
			</div>
		</form>
	{/if}

	{#if activity.allowsSkip && !reviewOrigin}
		<SkipActivityConfirm {activity} />
	{/if}
</div>

<style>
	.es {
		max-width: 39rem;
	}

	.es-eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--hydra-accent);
		text-transform: uppercase;
		margin: 0 0 0.875rem;
	}

	.es-eyebrow-spaced {
		margin-top: 1.125rem;
	}

	.es-question {
		font-size: 1.75rem;
		font-weight: 700;
		line-height: 1.25;
		margin: 0 0 0.625rem;
		color: var(--hydra-text);
	}

	.es-help {
		font-size: 0.90625rem;
		color: var(--hydra-muted);
		margin: 0 0 1.625rem;
	}

	.es-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
		margin-bottom: 0.875rem;
	}

	.es-chip {
		display: flex;
		align-items: center;
		gap: 0.5625rem;
		border-radius: 0.625rem;
		padding: 0.6875rem 1rem;
		font-size: 0.84375rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-text);
	}

	.es-chip.selected {
		background: rgba(45, 212, 196, 0.14);
		border-color: rgba(45, 212, 196, 0.55);
		color: #eafffb;
	}

	.es-chip-dot {
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 50%;
		flex-shrink: 0;
		background: rgba(255, 255, 255, 0.25);
	}

	.es-chip.selected .es-chip-dot {
		background: var(--hydra-accent);
	}

	.es-rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.875rem;
		max-width: 26rem;
	}

	.es-row {
		text-align: left;
		border-radius: 0.625rem;
		padding: 0.875rem 1rem;
		width: 100%;
		box-sizing: border-box;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-text);
	}

	.es-row.selected {
		background: rgba(45, 212, 196, 0.14);
		border-color: rgba(45, 212, 196, 0.55);
		color: #eafffb;
	}

	.es-other {
		margin: 0.375rem 0 1.375rem;
		max-width: 26rem;
	}

	.es-other input {
		width: 100%;
		box-sizing: border-box;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		border-radius: 0.625rem;
		padding: 0.6875rem 0.875rem;
		color: var(--hydra-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
	}

	.es-synthesis-box {
		border: 1px solid rgba(45, 212, 196, 0.4);
		background: rgba(45, 212, 196, 0.1);
		border-radius: 0.75rem;
		padding: 1.375rem 1.5rem;
		margin-bottom: 1.75rem;
	}

	.es-synthesis-box p {
		font-size: 1.0625rem;
		line-height: 1.55;
		color: var(--hydra-text);
		margin: 0;
		font-weight: 500;
	}

	.es-actions {
		display: flex;
		align-items: center;
		gap: 1.125rem;
		margin-top: 1.375rem;
	}

	.es-btn-primary {
		background: linear-gradient(135deg, #22d3c5, #0891b2);
		color: #04211f;
		border: none;
		border-radius: 0.625rem;
		font-weight: 700;
		font-size: 0.875rem;
		font-family: inherit;
		padding: 0.75rem 1.125rem;
		cursor: pointer;
	}

	.es-btn-primary:disabled {
		background: rgba(255, 255, 255, 0.06);
		color: var(--hydra-muted);
		cursor: default;
	}

	.es-btn-secondary {
		background: none;
		border: 1px solid var(--hydra-border);
		color: var(--hydra-text);
		font-weight: 600;
		font-size: 0.875rem;
		font-family: inherit;
		padding: 0.75rem 1.125rem;
		border-radius: 0.625rem;
		cursor: pointer;
	}

	.es-btn-text {
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.8125rem;
		font-family: inherit;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
	}

	.es-back {
		display: block;
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.8125rem;
		font-family: inherit;
		cursor: pointer;
		padding: 0;
		margin-bottom: 0.25rem;
	}
</style>
