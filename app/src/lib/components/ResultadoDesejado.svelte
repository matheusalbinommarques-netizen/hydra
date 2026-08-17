<script lang="ts">
	// "Resultado desejado" (Stage 4C do rework, ver
	// docs/core/HYDRA_PRODUCT_REWORK.md §32). Substitui o formulário de três
	// perguntas fixas (mudança/beneficiário/percepção) por uma lista
	// manipulável de DesiredOutcome — a unidade visual é o resultado, não uma
	// pergunta por vez (persistido a cada interação, nunca staging local,
	// mesmo espírito de MapaDeImpacto.svelte/ComoETratadoHoje.svelte/
	// EntenderCausas.svelte). Ordenação por swap adjacente (mesmo padrão de
	// ComoETratadoHoje). Ao contrário de EntenderCausas, a conclusão É
	// bloqueada por estado incompleto: precisa de ao menos um resultado com
	// mudança preenchida — o botão "Confirmar resultado" só aparece quando
	// desiredOutcomeConfirmationIssues está vazio (mesmo padrão de
	// MapaDeImpacto, "Concluir mapa").
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import type { DesiredOutcomeConfirmationIssue } from '$lib/domain';
	import type { DesiredOutcomeView } from '$lib/server/application/types';
	import type { PhaseProgressView } from '$lib/phase-progress';
	import SkipActivityConfirm from './SkipActivityConfirm.svelte';

	let {
		activity,
		desiredOutcomes,
		desiredOutcomeConfirmationIssues,
		reviewOrigin,
		phaseProgress,
		projectName,
		projectId
	}: {
		activity: { id: string; title: string; allowsSkip: boolean; pendingItemDetail?: string };
		desiredOutcomes: DesiredOutcomeView[];
		desiredOutcomeConfirmationIssues: DesiredOutcomeConfirmationIssue[];
		reviewOrigin?: 'summary' | 'records';
		phaseProgress?: PhaseProgressView;
		projectName?: string | null;
		projectId: string;
	} = $props();

	type EnhanceCallback = (opts: {
		result: ActionResult;
		update: (opts?: { reset?: boolean }) => Promise<void>;
	}) => Promise<void>;

	function handleGenericSubmit(): EnhanceCallback {
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				await update();
				return;
			}
			await update();
		};
	}

	let outcomes = $derived([...desiredOutcomes].sort((a, b) => a.order - b.order));

	let draftChange = $state('');
	let addingOutcome = $state(false);

	let editingOutcomeId = $state<string | null>(null);
	let editChangeValue = $state('');
	const editFormRefs: Record<string, HTMLFormElement | undefined> = {};

	const targetFormRefs: Record<string, HTMLFormElement | undefined> = {};
	let pendingTarget = $state<Record<string, string>>({});

	function startEdit(outcome: DesiredOutcomeView) {
		editingOutcomeId = outcome.id;
		editChangeValue = outcome.change;
	}

	async function submitEdit(outcomeId: string) {
		await tick();
		editFormRefs[outcomeId]?.requestSubmit();
	}

	async function submitTarget(outcomeId: string, value: string) {
		pendingTarget[outcomeId] = value;
		await tick();
		targetFormRefs[outcomeId]?.requestSubmit();
	}

	let breadcrumbActivities = $derived.by(() => {
		if (!phaseProgress) return [];
		const order = ['concluidas', 'atual', 'pendentes'] as const;
		return order.flatMap((key) => phaseProgress.groups.find((g) => g.key === key)?.activities ?? []);
	});

	let canFinish = $derived(!reviewOrigin && desiredOutcomeConfirmationIssues.length === 0);
	let draftTrimmed = $derived(draftChange.trim());

	let returnHref = $derived(
		reviewOrigin === 'summary'
			? `/projects/${projectId}/summary`
			: reviewOrigin === 'records'
				? `/projects/${projectId}/records`
				: null
	);
</script>

<div class="rd-shell">
	<div class="rd-topbar">
		<p class="rd-breadcrumb">
			{projectName ?? 'Novo projeto'}{#if phaseProgress}
				· {phaseProgress.phaseLabel}{/if}
		</p>
		{#if breadcrumbActivities.length > 0}
			<div class="rd-pills" aria-hidden="true">
				{#each breadcrumbActivities as act (act.id)}
					{#if act.isCurrent}
						<span class="rd-pill-current"><span class="rd-pill-dot"></span>{act.title}</span>
					{:else}
						<span class="rd-pill-dot-only" title={act.title}></span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	{#if returnHref}
		<p class="rd-return">
			<a href={returnHref}>← Voltar para {reviewOrigin === 'summary' ? 'o Resumo da descoberta' : 'Registros'}</a>
		</p>
	{/if}

	<p class="rd-eyebrow">Resultado desejado</p>
	<h2 class="rd-question">O que deverá estar diferente quando este projeto tiver sucesso?</h2>
	<p class="rd-help">
		Registre as mudanças esperadas, na ordem que fizer mais sentido. Um alvo quantitativo é opcional — nem todo
		resultado precisa de um número para ser válido.
	</p>

	<form
		method="POST"
		action="?/addDesiredOutcome"
		use:enhance={() => {
			addingOutcome = true;
			return async ({ result, update }) => {
				addingOutcome = false;
				if (result.type === 'failure' || result.type === 'error') {
					await update();
					return;
				}
				await update();
				draftChange = '';
			};
		}}
	>
		<div class="rd-draft-row">
			<input
				type="text"
				name="change"
				placeholder="O que deverá estar diferente?"
				bind:value={draftChange}
			/>
			<button type="submit" disabled={draftTrimmed.length === 0 || addingOutcome}>Adicionar resultado</button>
		</div>
	</form>

	{#if outcomes.length > 0}
		<p class="rd-list-heading">Resultados esperados</p>
		<div class="rd-outcome-list" role="list" aria-label="Resultados desejados">
			{#each outcomes as outcome, index (outcome.id)}
				<div class="rd-node-row" role="listitem">
					<div class="rd-rail-col">
						<div class="rd-node-circle">{index + 1}</div>
					</div>
					<div class="rd-card">
						<div class="rd-card-actions">
							<form method="POST" action="?/moveDesiredOutcome" use:enhance={handleGenericSubmit}>
								<input type="hidden" name="outcomeId" value={outcome.id} />
								<input type="hidden" name="direction" value="-1" />
								<button type="submit" class="rd-icon-btn" disabled={index === 0} aria-label="Mover para cima">↑</button>
							</form>
							<form method="POST" action="?/moveDesiredOutcome" use:enhance={handleGenericSubmit}>
								<input type="hidden" name="outcomeId" value={outcome.id} />
								<input type="hidden" name="direction" value="1" />
								<button
									type="submit"
									class="rd-icon-btn"
									disabled={index === outcomes.length - 1}
									aria-label="Mover para baixo">↓</button
								>
							</form>
							<form method="POST" action="?/removeDesiredOutcome" use:enhance={handleGenericSubmit}>
								<input type="hidden" name="outcomeId" value={outcome.id} />
								<button type="submit" class="rd-icon-btn" aria-label="Remover resultado">×</button>
							</form>
						</div>

						{#if editingOutcomeId === outcome.id}
							<form
								method="POST"
								action="?/setDesiredOutcomeChange"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'failure' || result.type === 'error') {
											await update();
											return;
										}
										await update();
										editingOutcomeId = null;
									};
								}}
								bind:this={editFormRefs[outcome.id]}
							>
								<input type="hidden" name="outcomeId" value={outcome.id} />
								<div class="rd-draft-row">
									<input type="text" name="change" bind:value={editChangeValue} />
									<button type="submit" disabled={editChangeValue.trim().length === 0}>Salvar</button>
								</div>
							</form>
						{:else}
							<p class="rd-outcome-change">{outcome.change}</p>
							<button type="button" class="rd-icon-btn-text" onclick={() => startEdit(outcome)}>Editar</button>
						{/if}

						<div class="rd-target-row">
							<p class="rd-subtle-label">Alvo quantitativo (opcional)</p>
							<form
								method="POST"
								action="?/setDesiredOutcomeTarget"
								use:enhance={handleGenericSubmit}
								bind:this={targetFormRefs[outcome.id]}
							>
								<input type="hidden" name="outcomeId" value={outcome.id} />
								<input type="hidden" name="target" value={pendingTarget[outcome.id] ?? outcome.target ?? ''} />
								<input
									type="text"
									class="rd-target-input"
									placeholder="Ex.: -30%, até 2 dias, R$ 50 mil/mês..."
									value={outcome.target ?? ''}
									onblur={(e) => submitTarget(outcome.id, e.currentTarget.value)}
								/>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="rd-empty-state">
			<p class="rd-empty-title">Nenhum resultado registrado ainda.</p>
			<p class="rd-empty-help">Adicione ao menos uma mudança esperada para concluir.</p>
		</div>
	{/if}

	{#if canFinish}
		<div class="rd-finish">
			<form method="POST" action="?/confirmDesiredOutcomes" use:enhance>
				<button type="submit" class="rd-btn-primary">Confirmar resultado <span aria-hidden="true">→</span></button>
			</form>
		</div>
	{/if}

	{#if activity.allowsSkip && activity.pendingItemDetail && !reviewOrigin}
		<SkipActivityConfirm activity={{ id: activity.id, title: activity.title, pendingItemDetail: activity.pendingItemDetail }} />
	{/if}
</div>

<style>
	.rd-shell {
		max-width: 46rem;
	}

	.rd-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 1.125rem;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--hydra-border);
	}

	.rd-breadcrumb {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.rd-pills {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.rd-pill-current {
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

	.rd-pill-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--hydra-accent);
		flex-shrink: 0;
	}

	.rd-pill-dot-only {
		width: 0.5625rem;
		height: 0.5625rem;
		border-radius: 50%;
		background: transparent;
		border: 1px solid var(--hydra-border);
	}

	.rd-return {
		margin: 0 0 0.875rem;
	}

	.rd-return a {
		font-size: 0.8125rem;
		color: var(--hydra-muted);
	}

	.rd-eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--hydra-accent);
		text-transform: uppercase;
		margin: 0 0 0.625rem;
	}

	.rd-question {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.3;
		margin: 0 0 0.5rem;
		color: var(--hydra-text);
		max-width: 40rem;
	}

	.rd-help {
		font-size: 0.84375rem;
		color: var(--hydra-muted);
		margin: 0 0 1.25rem;
	}

	.rd-draft-row {
		display: flex;
		gap: 0.5rem;
	}

	.rd-draft-row input {
		flex: 1;
		min-width: 0;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-dark-radius, 0.5rem);
		padding: 0.6875rem 0.75rem;
		color: var(--hydra-text);
		font-size: 0.84375rem;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
	}

	.rd-draft-row button {
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-dark-radius, 0.5rem);
		padding: 0 1rem;
		color: var(--hydra-text);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
	}

	.rd-draft-row button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.rd-empty-state {
		border: 1px dashed var(--hydra-border);
		border-radius: 0.75rem;
		padding: 1.375rem;
		margin-top: 1.25rem;
	}

	.rd-empty-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--hydra-text);
		margin: 0 0 0.375rem;
	}

	.rd-empty-help {
		font-size: 0.78125rem;
		color: var(--hydra-muted);
		margin: 0;
	}

	.rd-list-heading {
		font-size: 0.78125rem;
		font-weight: 700;
		color: var(--hydra-muted);
		margin: 1.375rem 0 0.625rem;
	}

	.rd-outcome-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.rd-node-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.rd-rail-col {
		flex-shrink: 0;
		padding-top: 0.25rem;
	}

	.rd-node-circle {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--hydra-muted);
	}

	.rd-card {
		flex: 1;
		min-width: 0;
		border-radius: 0.75rem;
		padding: 1rem 1.125rem;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
	}

	.rd-card-actions {
		display: flex;
		gap: 0.375rem;
		justify-content: flex-end;
		margin-bottom: 0.5rem;
	}

	.rd-card-actions form {
		margin: 0;
	}

	.rd-icon-btn {
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
		border-radius: 0.375rem;
		width: 1.75rem;
		height: 1.75rem;
		font-size: 0.8125rem;
		cursor: pointer;
		font-family: inherit;
	}

	.rd-icon-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.rd-icon-btn:not(:disabled):hover {
		color: var(--hydra-text);
	}

	.rd-outcome-change {
		font-size: 0.90625rem;
		font-weight: 700;
		color: var(--hydra-text);
		margin: 0 0 0.375rem;
	}

	.rd-icon-btn-text {
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.71875rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		padding: 0;
		margin-bottom: 0.625rem;
	}

	.rd-icon-btn-text:hover {
		color: var(--hydra-text);
	}

	.rd-target-row {
		margin-top: 0.625rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--hydra-border);
	}

	.rd-subtle-label {
		font-size: 0.71875rem;
		color: var(--hydra-muted);
		margin: 0 0 0.5rem;
	}

	.rd-target-input {
		width: 100%;
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-dark-radius, 0.5rem);
		padding: 0.5625rem 0.6875rem;
		color: var(--hydra-text);
		font-size: 0.8125rem;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
	}

	.rd-finish {
		margin-top: 2rem;
	}

	.rd-btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		background: linear-gradient(135deg, #22d3c5, #0891b2);
		color: #04211f;
		border: none;
		border-radius: var(--hydra-dark-radius, 0.625rem);
		font-weight: 700;
		font-size: 0.875rem;
		font-family: inherit;
		padding: 0.75rem 1.125rem;
		cursor: pointer;
	}
</style>
