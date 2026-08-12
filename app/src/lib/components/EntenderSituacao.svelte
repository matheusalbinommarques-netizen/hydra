<script lang="ts">
	// "Entender a situação" (Claude Design, "Entender a Situacao.dc.html") —
	// substitui o texto livre da antiga "Problema ou oportunidade" por seleção
	// estruturada em três passos (o quê / onde / peso) e uma síntese
	// determinística de confirmação. Fluxo local até a confirmação: só a
	// confirmação da síntese ("Sim, continuar") submete ao servidor, via a
	// mesma action genérica `?/answer` já usada por todas as atividades
	// required_fields — nenhuma persistência nova.
	//
	// Mecânica de layout (mockup, 11/08/2026): esta atividade substitui o
	// shell padrão de /now (breadcrumb "Onde estamos" + Progresso da
	// fase/Bancada) por sua própria topbar de progresso e painel lateral
	// "Documento do projeto", que reflete ao vivo só o que está sendo
	// construído aqui. Implementado local a este componente — nenhuma
	// abstração compartilhada foi criada; se uma próxima atividade adotar a
	// mesma mecânica, extraímos as peças comuns nesse momento, não antes
	// (mesmo espírito de phase-activities.ts, extraído só quando Mapa e Agora
	// passaram a precisar da mesma projeção).
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
	import type { PhaseProgressView } from '$lib/phase-progress';
	import SkipActivityConfirm from './SkipActivityConfirm.svelte';

	let {
		activity,
		values = {},
		originAnswer,
		reviewOrigin,
		phaseProgress,
		projectName
	}: {
		activity: RequiredFieldsActivity;
		values?: Record<string, string>;
		originAnswer?: string;
		reviewOrigin?: 'summary' | 'records';
		phaseProgress?: PhaseProgressView;
		projectName?: string | null;
	} = $props();

	type Step = 'what' | 'where' | 'weight' | 'synthesis' | 'done';

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

	// Destaque temporário no "Documento do projeto" logo após uma seleção —
	// só decorativo (mesmo espírito do mockup), nunca afeta os dados.
	let justAdded = $state<string | null>(null);
	let pulseTimeout: ReturnType<typeof setTimeout> | undefined;
	function pulse(key: string) {
		justAdded = key;
		clearTimeout(pulseTimeout);
		pulseTimeout = setTimeout(() => (justAdded = null), 1400);
	}

	function toggleWhat(id: string) {
		const next = new Set(whatKeys);
		next.has(id) ? next.delete(id) : next.add(id);
		whatKeys = next;
		pulse(id);
	}

	function toggleWhere(id: string) {
		const next = new Set(whereKeys);
		next.has(id) ? next.delete(id) : next.add(id);
		whereKeys = next;
		pulse(id);
	}

	function selectWeight(id: string) {
		weightKey = id;
		pulse('weight');
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

	// Topbar de progresso: mesma fase-atividades já calculada para o painel
	// "Progresso da fase" (phase-progress.ts) — concluídas, a atual e as
	// pendentes, na ordem do catálogo (puladas ficam fora, como no mockup).
	let breadcrumbActivities = $derived.by(() => {
		if (!phaseProgress) return [];
		const order = ['concluidas', 'atual', 'pendentes'] as const;
		return order.flatMap((key) => phaseProgress.groups.find((g) => g.key === key)?.activities ?? []);
	});
	let nextActivityTitle = $derived(
		phaseProgress?.groups.find((g) => g.key === 'pendentes')?.activities[0]?.title
	);

	let docWhatItems = $derived(
		[...whatKeys].map((id) => {
			const label = id === outroWhatId ? otherWhatText.trim() || 'Outro' : whatOptions.find((o) => o.id === id)?.label;
			return { id, label: label ?? id, highlighted: justAdded === id };
		})
	);
	let docWhereItems = $derived(
		[...whereKeys].map((id) => {
			const label =
				id === 'area_outra' ? otherWhereText.trim() || 'Outra área' : SITUATION_WHERE_OPTIONS.find((o) => o.id === id)?.label;
			return { id, label: label ?? id, highlighted: justAdded === id };
		})
	);
	let weightHighlighted = $derived(justAdded === 'weight');

	// Guarda a atualização de página pendente após submeter a síntese — em
	// vez de trocar imediatamente para a próxima atividade, mostramos antes o
	// passo "Etapa concluída" (mockup); só o clique em "Continuar" aplica a
	// resposta do servidor (próxima atividade, redirect de revisão, etc.).
	let pendingUpdate = $state<(() => Promise<void>) | undefined>(undefined);
</script>

<div class="es-shell">
	<div class="es-topbar">
		<p class="es-breadcrumb">
			{projectName ?? 'Novo projeto'}{#if phaseProgress}
				· {phaseProgress.phaseLabel}{/if}
		</p>
		{#if breadcrumbActivities.length > 0}
			<div class="es-pills" aria-hidden="true">
				{#each breadcrumbActivities as act (act.id)}
					{#if act.isCurrent}
						<span class="es-pill-current"><span class="es-pill-dot"></span>{act.title}</span>
					{:else}
						<span class="es-pill-dot-only" title={act.title}></span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<div class="es-body">
		<div class="es-main">
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
							onclick={() => selectWeight(label)}
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
			{:else if step === 'synthesis'}
				<p class="es-eyebrow">Entender a situação · Síntese</p>
				<h2 class="es-question">É mais ou menos isso?</h2>
				<div class="es-synthesis-box">
					<p>{synthesisText}</p>
				</div>

				<form
					method="POST"
					action="?/answer"
					use:enhance={() => async ({ result, update }) => {
						if (result.type === 'failure' || result.type === 'error') {
							await update();
							return;
						}
						pendingUpdate = () => update();
						step = 'done';
					}}
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
			{:else}
				<div class="es-done-icon" aria-hidden="true">
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none">
						<path d="M5 13l4 4L19 7" stroke="var(--hydra-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</div>
				<h2 class="es-question">Etapa concluída</h2>
				<p class="es-help es-done-text">{synthesisText}</p>
				<div class="es-actions">
					<button type="button" class="es-btn-primary" onclick={() => pendingUpdate?.()}>
						Continuar para próxima atividade <span aria-hidden="true">→</span>
					</button>
				</div>
				{#if nextActivityTitle}
					<p class="es-next-hint">Em seguida: {nextActivityTitle}</p>
				{/if}
			{/if}

			{#if activity.allowsSkip && !reviewOrigin && step !== 'done'}
				<SkipActivityConfirm {activity} />
			{/if}
		</div>

		<aside class="es-doc" aria-label="Documento do projeto">
			<div class="es-doc-header">
				<p class="es-doc-eyebrow">Documento do projeto</p>
				{#if phaseProgress}
					<span class="es-doc-phase-badge">{phaseProgress.phaseLabel}</span>
				{/if}
			</div>

			{#if step === 'done'}
				<div class="es-doc-done-card">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
						<path d="M5 13l4 4L19 7" stroke="var(--hydra-accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
					<span>{activity.title}</span>
				</div>
			{:else}
				<div class="es-doc-card">
					<p class="es-doc-card-title">{activity.title}</p>

					{#if step !== 'synthesis'}
						<div class="es-doc-group">
							<p class="es-doc-group-label">Situação</p>
							{#if docWhatItems.length === 0}
								<p class="es-doc-empty">Ainda não preenchido</p>
							{:else}
								{#each docWhatItems as it (it.id)}
									<div class="es-doc-chip" class:highlighted={it.highlighted}>{it.label}</div>
								{/each}
							{/if}
						</div>

						<div class="es-doc-group">
							<p class="es-doc-group-label">Aparece em</p>
							{#if docWhereItems.length === 0}
								<p class="es-doc-empty">Ainda não preenchido</p>
							{:else}
								{#each docWhereItems as it (it.id)}
									<div class="es-doc-chip" class:highlighted={it.highlighted}>{it.label}</div>
								{/each}
							{/if}
						</div>

						<div class="es-doc-group">
							<p class="es-doc-group-label">Peso atual</p>
							{#if weightKey}
								<div class="es-doc-chip" class:highlighted={weightHighlighted}>{weightKey}</div>
							{:else}
								<p class="es-doc-empty">Ainda não preenchido</p>
							{/if}
						</div>
					{:else}
						<div class="es-doc-group">
							<p class="es-doc-group-label">Síntese</p>
							<p class="es-doc-synthesis">{synthesisText}</p>
						</div>
					{/if}
				</div>
			{/if}

			{#if breadcrumbActivities.length > 0}
				{@const upcoming = phaseProgress?.groups.find((g) => g.key === 'pendentes')?.activities ?? []}
				{#if upcoming.length > 0}
					<div class="es-doc-upcoming">
						{#each upcoming as act (act.id)}
							<div class="es-doc-upcoming-item">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<rect x="5" y="11" width="14" height="9" rx="2" stroke="var(--hydra-muted)" stroke-width="1.8" />
									<path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="var(--hydra-muted)" stroke-width="1.8" />
								</svg>
								<span>{act.title}</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</aside>
	</div>
</div>

<style>
	.es-shell {
		max-width: 74rem;
	}

	.es-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 1.125rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid var(--hydra-border);
	}

	.es-breadcrumb {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.es-pills {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.es-pill-current {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		background: rgba(45, 212, 196, 0.12);
		border: 1px solid rgba(45, 212, 196, 0.45);
		border-radius: 999px;
		padding: 0.375rem 0.875rem 0.375rem 0.5rem;
		font-size: 0.78125rem;
		font-weight: 600;
		color: var(--hydra-text);
		white-space: nowrap;
	}

	.es-pill-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--hydra-accent);
		flex-shrink: 0;
	}

	.es-pill-dot-only {
		width: 0.5625rem;
		height: 0.5625rem;
		border-radius: 50%;
		background: transparent;
		border: 1px solid var(--hydra-border);
	}

	.es-body {
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 1fr);
		gap: 2.5rem;
		align-items: start;
	}

	.es-main {
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
		border-radius: var(--hydra-dark-radius);
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
		background: var(--hydra-dark-accent-tint-strong);
		border-color: var(--hydra-dark-accent-border-strong);
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
		border-radius: var(--hydra-dark-radius);
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
		background: var(--hydra-dark-accent-tint-strong);
		border-color: var(--hydra-dark-accent-border-strong);
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
		border-radius: var(--hydra-dark-radius);
		padding: 0.6875rem 0.875rem;
		color: var(--hydra-text);
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
	}

	.es-synthesis-box {
		border: 1px solid rgba(45, 212, 196, 0.4);
		background: var(--hydra-dark-accent-tint);
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
		flex-wrap: wrap;
	}

	.es-btn-primary {
		background: linear-gradient(135deg, #22d3c5, #0891b2);
		color: #04211f;
		border: none;
		border-radius: var(--hydra-dark-radius);
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
		border-radius: var(--hydra-dark-radius);
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

	.es-done-icon {
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 50%;
		background: var(--hydra-dark-accent-tint-strong);
		border: 1px solid rgba(45, 212, 196, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 1.5rem;
	}

	.es-done-text {
		max-width: 30rem;
		line-height: 1.5;
	}

	.es-next-hint {
		margin-top: 1rem;
		font-size: 0.78125rem;
		color: var(--hydra-muted);
	}

	.es-doc {
		border: 1px solid var(--hydra-border);
		border-radius: 0.875rem;
		padding: 1.5rem 1.375rem;
		background: var(--hydra-surface);
	}

	.es-doc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}

	.es-doc-eyebrow {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.es-doc-phase-badge {
		font-size: 0.6875rem;
		color: var(--hydra-accent);
		background: var(--hydra-dark-accent-tint);
		border: 1px solid var(--hydra-dark-accent-border);
		border-radius: 999px;
		padding: 0.1875rem 0.625rem;
		white-space: nowrap;
	}

	.es-doc-card {
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		border-radius: 0.875rem;
		padding: 1.125rem;
		margin-bottom: 0.625rem;
	}

	.es-doc-card-title {
		margin: 0 0 0.875rem;
		font-size: 0.84375rem;
		font-weight: 700;
		color: var(--hydra-text);
	}

	.es-doc-group {
		margin-bottom: 1rem;
	}

	.es-doc-group:last-child {
		margin-bottom: 0;
	}

	.es-doc-group-label {
		margin: 0 0 0.5rem;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.es-doc-empty {
		margin: 0;
		border: 1px dashed var(--hydra-border);
		border-radius: 0.5rem;
		padding: 0.75rem;
		font-size: 0.75rem;
		color: var(--hydra-muted);
		font-style: italic;
		text-align: center;
	}

	.es-doc-chip {
		border-radius: 0.5rem;
		padding: 0.5625rem 0.6875rem;
		margin-bottom: 0.375rem;
		background: var(--hydra-bg);
		border: 1px solid var(--hydra-border);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--hydra-text);
		transition: all 0.4s;
	}

	.es-doc-chip:last-child {
		margin-bottom: 0;
	}

	.es-doc-chip.highlighted {
		background: var(--hydra-dark-accent-tint-strong);
		border-color: rgba(45, 212, 196, 0.5);
	}

	.es-doc-synthesis {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--hydra-muted);
		font-style: italic;
	}

	.es-doc-done-card {
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		border-radius: 0.875rem;
		padding: 0.875rem 1rem;
		margin-bottom: 0.625rem;
		display: flex;
		align-items: center;
		gap: 0.4375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--hydra-text);
	}

	.es-doc-upcoming {
		border-top: 1px solid var(--hydra-border);
		padding-top: 1rem;
		margin-top: 0.625rem;
	}

	.es-doc-upcoming-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		border: 1px solid var(--hydra-border);
		background: var(--hydra-bg);
		border-radius: 0.875rem;
		padding: 0.875rem 1rem;
		margin-bottom: 0.625rem;
		opacity: 0.55;
		font-size: 0.8125rem;
		color: var(--hydra-muted);
	}

	.es-doc-upcoming-item:last-child {
		margin-bottom: 0;
	}

	@media (max-width: 860px) {
		.es-body {
			grid-template-columns: 1fr;
		}
	}
</style>
