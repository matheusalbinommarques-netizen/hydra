<script lang="ts">
	// "Entender as causas" (Stage 4B do rework, Claude Design, "Entender as
	// Causas - 1A Refinada.dc.html"). Substitui qualquer especulação em texto
	// livre por hipóteses de causa reais (persistidas a cada interação, nunca
	// staging local — mesmo espírito de MapaDeImpacto.svelte/
	// ComoETratadoHoje.svelte). "Ainda não sabemos o que está por trás disso"
	// é um estado explícito e legítimo: ao ser escolhido, assume a surface por
	// completo (contexto, campo de formulação e hipóteses somem, só a tela
	// calma aparece) — só alcançável com zero hipóteses (ver
	// domain/transitions.ts, markCauseExplorationUnknown).
	//
	// Sem "Sugestão do Hydra": o Design Gate trata essa sugestão como
	// condicional, não requisito do Stage 4B — não existe hoje no repo uma
	// capacidade real de gerar hipóteses, então esta implementação não simula
	// uma. A experiência funciona integralmente sem isso.
	//
	// Mesma mecânica de shell de "Quem é afetado"/"Como é tratado hoje":
	// topbar de progresso própria. Implementado local a este componente — sem
	// abstração compartilhada, mesmo espírito dos três precedentes.
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import { causeHypothesisCountLabel } from '$lib/catalog/cause-hypothesis';
	import { summarizeCurrentTreatment, treatmentFrictionLabel } from '$lib/catalog/current-treatment';
	import type {
		CauseExplorationView,
		CauseHypothesisView,
		CurrentTreatmentView,
		EvidenceView,
		TreatmentStepView
	} from '$lib/server/application/types';
	import type { PhaseProgressView } from '$lib/phase-progress';
	import SkipActivityConfirm from './SkipActivityConfirm.svelte';

	let {
		activity,
		causeExploration,
		causeHypotheses,
		evidences,
		currentTreatment,
		treatmentSteps,
		reviewOrigin,
		phaseProgress,
		projectName,
		projectId,
		situacaoSynthesis
	}: {
		activity: { id: string; title: string; allowsSkip: boolean; pendingItemDetail?: string };
		causeExploration: CauseExplorationView;
		causeHypotheses: CauseHypothesisView[];
		evidences: EvidenceView[];
		currentTreatment: CurrentTreatmentView;
		treatmentSteps: TreatmentStepView[];
		reviewOrigin?: 'summary' | 'records';
		phaseProgress?: PhaseProgressView;
		projectName?: string | null;
		projectId: string;
		situacaoSynthesis?: string;
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

	// Cartões de contexto — só dados reais já conhecidos do projeto (situação,
	// tratamento atual, fricções observadas, evidência existente), nunca
	// conteúdo de demonstração. "Usar como ponto de partida" só marca a
	// proveniência (origin) da próxima hipótese registrada — nunca preenche o
	// texto da hipótese sozinho.
	let treatmentSynthesis = $derived(
		summarizeCurrentTreatment(
			currentTreatment.noTreatment,
			treatmentSteps.map((step) => ({
				whatHappens: step.whatHappens,
				actors: step.actors,
				medium: step.medium,
				frictions: step.frictions
			}))
		)
	);
	let frictionLabels = $derived.by(() => {
		const seen = new Set<string>();
		const labels: string[] = [];
		for (const step of treatmentSteps) {
			for (const friction of step.frictions) {
				if (!seen.has(friction)) {
					seen.add(friction);
					labels.push(treatmentFrictionLabel(friction));
				}
			}
		}
		return labels;
	});
	let evidenceSummary = $derived(
		evidences.length === 0
			? ''
			: evidences
					.slice(0, 2)
					.map((evidence) => evidence.learning)
					.join(' ')
	);

	interface ContextCard {
		id: string;
		label: string;
		text: string;
	}
	let contextCards = $derived.by(() => {
		const cards: ContextCard[] = [];
		if (situacaoSynthesis) cards.push({ id: 'situacao', label: 'Situação', text: situacaoSynthesis });
		if (currentTreatment.noTreatment || treatmentSteps.length > 0) {
			cards.push({ id: 'tratamento', label: 'Tratamento hoje', text: treatmentSynthesis });
		}
		if (frictionLabels.length > 0) {
			cards.push({ id: 'friccao', label: 'Fricção observada', text: frictionLabels.join(', ') });
		}
		if (evidenceSummary) cards.push({ id: 'evidence', label: 'Evidence existente', text: evidenceSummary });
		return cards;
	});

	let contextUsedLabel = $state<string | null>(null);
	let draftTitle = $state('');
	let addingHypothesis = $state(false);

	let expandedHypothesisId = $state<string | null>(null);
	let editingHypothesisId = $state<string | null>(null);
	let editTitleValue = $state('');

	const editFormRefs: Record<string, HTMLFormElement | undefined> = {};
	const expectedFormRefs: Record<string, HTMLFormElement | undefined> = {};
	const weakensFormRefs: Record<string, HTMLFormElement | undefined> = {};
	let pendingExpected = $state<Record<string, string>>({});
	let pendingWeakens = $state<Record<string, string>>({});

	function startEdit(hypothesis: CauseHypothesisView) {
		editingHypothesisId = hypothesis.id;
		editTitleValue = hypothesis.title;
	}

	async function submitEdit(hypothesisId: string) {
		await tick();
		editFormRefs[hypothesisId]?.requestSubmit();
	}

	async function submitExpected(hypothesisId: string, value: string) {
		pendingExpected[hypothesisId] = value;
		await tick();
		expectedFormRefs[hypothesisId]?.requestSubmit();
	}

	async function submitWeakens(hypothesisId: string, value: string) {
		pendingWeakens[hypothesisId] = value;
		await tick();
		weakensFormRefs[hypothesisId]?.requestSubmit();
	}

	function truncate(text: string, max: number): string {
		return text.length > max ? `${text.slice(0, max - 1)}…` : text;
	}

	let breadcrumbActivities = $derived.by(() => {
		if (!phaseProgress) return [];
		const order = ['concluidas', 'atual', 'pendentes'] as const;
		return order.flatMap((key) => phaseProgress.groups.find((g) => g.key === key)?.activities ?? []);
	});

	let showZeroLink = $derived(causeHypotheses.length === 0 && !causeExploration.stillUnknown);
	let showZeroCalm = $derived(causeHypotheses.length === 0 && causeExploration.stillUnknown);
	let canFinish = $derived(!reviewOrigin);
	let draftTrimmed = $derived(draftTitle.trim());
	let continueCaption = $derived(
		causeHypotheses.length === 0
			? 'Você pode seguir sem uma explicação ainda.'
			: 'Você pode seguir com mais de uma explicação em aberto.'
	);

	let returnHref = $derived(
		reviewOrigin === 'summary'
			? `/projects/${projectId}/summary`
			: reviewOrigin === 'records'
				? `/projects/${projectId}/records`
				: null
	);
</script>

<div class="ec-shell">
	<div class="ec-topbar">
		<p class="ec-breadcrumb">
			{projectName ?? 'Novo projeto'}{#if phaseProgress}
				· {phaseProgress.phaseLabel}{/if}
		</p>
		{#if breadcrumbActivities.length > 0}
			<div class="ec-pills" aria-hidden="true">
				{#each breadcrumbActivities as act (act.id)}
					{#if act.isCurrent}
						<span class="ec-pill-current"><span class="ec-pill-dot"></span>{act.title}</span>
					{:else}
						<span class="ec-pill-dot-only" title={act.title}></span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	{#if returnHref}
		<p class="ec-return">
			<a href={returnHref}>← Voltar para {reviewOrigin === 'summary' ? 'o Resumo da descoberta' : 'Registros'}</a>
		</p>
	{/if}

	<p class="ec-eyebrow">Hipóteses de causa</p>
	<h2 class="ec-question">O que pode estar por trás dessa situação?</h2>
	<p class="ec-help">
		Use o que o projeto já sabe como ponto de partida, ou escreva sua própria leitura. Nada aqui precisa ser a
		causa definitiva.
	</p>

	{#if showZeroCalm}
		<div class="ec-empty-state">
			<p class="ec-empty-title">Ainda não sabemos o que está por trás disso.</p>
			<p class="ec-empty-help">Você pode seguir e voltar quando tiver novos elementos.</p>
			<form method="POST" action="?/undoCauseExplorationUnknown" use:enhance={handleGenericSubmit}>
				<button type="submit" class="ec-ghost-affordance">Já tenho algo em mente</button>
			</form>
		</div>
	{:else}
		{#if contextCards.length > 0}
			<div class="ec-context-row">
				{#each contextCards as card (card.id)}
					<div class="ec-context-card">
						<p class="ec-context-label">{card.label}</p>
						<p class="ec-context-text">{truncate(card.text, 140)}</p>
						<button type="button" class="ec-icon-link" onclick={() => (contextUsedLabel = card.label)}>
							Usar como ponto de partida
						</button>
					</div>
				{/each}
			</div>
		{/if}

		{#if contextUsedLabel}
			<div class="ec-context-used">
				<span>Ponto de partida: {contextUsedLabel}</span>
				<button type="button" class="ec-icon-link" onclick={() => (contextUsedLabel = null)}>✕</button>
			</div>
		{/if}

		<form
			method="POST"
			action="?/addCauseHypothesis"
			use:enhance={() => {
				const usedOrigin = contextUsedLabel;
				addingHypothesis = true;
				return async ({ result, update }) => {
					addingHypothesis = false;
					if (result.type === 'failure' || result.type === 'error') {
						await update();
						return;
					}
					await update();
					draftTitle = '';
					if (usedOrigin) contextUsedLabel = null;
				};
			}}
		>
			<input type="hidden" name="origin" value={contextUsedLabel ?? ''} />
			<div class="ec-draft-row">
				<input
					type="text"
					name="title"
					placeholder="O que você imagina que pode estar por trás disso?"
					bind:value={draftTitle}
				/>
				<button type="submit" disabled={draftTrimmed.length === 0 || addingHypothesis}>Registrar hipótese</button>
			</div>
		</form>

		{#if showZeroLink}
			<form method="POST" action="?/markCauseExplorationUnknown" use:enhance={handleGenericSubmit}>
				<button type="submit" class="ec-text-link">Ainda não sei o que está por trás disso</button>
			</form>
		{/if}

		{#if causeHypotheses.length > 0}
			<p class="ec-list-heading">Hipóteses em consideração</p>
			<div class="ec-hypothesis-list">
				{#each causeHypotheses as hypothesis (hypothesis.id)}
					<div class="ec-card">
						<span class="ec-pill">Hipótese</span>

						{#if editingHypothesisId === hypothesis.id}
							<form
								method="POST"
								action="?/setCauseHypothesisTitle"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'failure' || result.type === 'error') {
											await update();
											return;
										}
										await update();
										editingHypothesisId = null;
									};
								}}
								bind:this={editFormRefs[hypothesis.id]}
							>
								<input type="hidden" name="hypothesisId" value={hypothesis.id} />
								<div class="ec-draft-row">
									<input type="text" name="title" bind:value={editTitleValue} />
									<button type="submit" disabled={editTitleValue.trim().length === 0}>Salvar</button>
								</div>
							</form>
						{:else}
							<p class="ec-hypothesis-title">{hypothesis.title}</p>
							{#if hypothesis.origin}
								<p class="ec-hypothesis-origin">Surgiu a partir de: {hypothesis.origin}</p>
							{/if}
							<div class="ec-hypothesis-actions">
								<button
									type="button"
									class="ec-icon-btn-text"
									onclick={() =>
										(expandedHypothesisId = expandedHypothesisId === hypothesis.id ? null : hypothesis.id)}
								>
									{expandedHypothesisId === hypothesis.id ? 'Ocultar' : 'Aprofundar esta hipótese'}
								</button>
								<button type="button" class="ec-icon-btn-text" onclick={() => startEdit(hypothesis)}>Editar</button>
								<form method="POST" action="?/removeCauseHypothesis" use:enhance={handleGenericSubmit}>
									<input type="hidden" name="hypothesisId" value={hypothesis.id} />
									<button type="submit" class="ec-icon-btn-text">Remover</button>
								</form>
							</div>

							{#if expandedHypothesisId === hypothesis.id}
								<div class="ec-hypothesis-detail">
									<div>
										<p class="ec-subtle-label">Evidence relacionada</p>
										{#if evidences.length > 0}
											<div class="ec-chip-row">
												{#each evidences as evidence (evidence.id)}
													<form method="POST" action="?/toggleCauseHypothesisEvidence" use:enhance={handleGenericSubmit}>
														<input type="hidden" name="hypothesisId" value={hypothesis.id} />
														<input type="hidden" name="evidenceId" value={evidence.id} />
														<button
															type="submit"
															class="ec-plain-chip"
															class:ec-selected={hypothesis.evidenceIds.includes(evidence.id)}
														>
															{truncate(evidence.learning, 40)}
														</button>
													</form>
												{/each}
											</div>
										{:else}
											<p class="ec-subtle-empty">Nenhuma evidência registrada ainda.</p>
										{/if}
									</div>

									<div>
										<p class="ec-subtle-label">O que esperaríamos observar se essa hipótese fizer sentido (opcional)</p>
										<form
											method="POST"
											action="?/setCauseHypothesisExpectedIfTrue"
											use:enhance={handleGenericSubmit}
											bind:this={expectedFormRefs[hypothesis.id]}
										>
											<input type="hidden" name="hypothesisId" value={hypothesis.id} />
											<input type="hidden" name="value" value={pendingExpected[hypothesis.id] ?? hypothesis.expectedIfTrue ?? ''} />
											<input
												type="text"
												placeholder="Um sinal esperado…"
												value={hypothesis.expectedIfTrue ?? ''}
												onblur={(e) => submitExpected(hypothesis.id, e.currentTarget.value)}
											/>
										</form>
									</div>

									<div>
										<p class="ec-subtle-label">O que faria essa hipótese perder força (opcional)</p>
										<form
											method="POST"
											action="?/setCauseHypothesisWhatWeakensIt"
											use:enhance={handleGenericSubmit}
											bind:this={weakensFormRefs[hypothesis.id]}
										>
											<input type="hidden" name="hypothesisId" value={hypothesis.id} />
											<input type="hidden" name="value" value={pendingWeakens[hypothesis.id] ?? hypothesis.whatWeakensIt ?? ''} />
											<input
												type="text"
												placeholder="Um sinal esperado…"
												value={hypothesis.whatWeakensIt ?? ''}
												onblur={(e) => submitWeakens(hypothesis.id, e.currentTarget.value)}
											/>
										</form>
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	{#if canFinish}
		<div class="ec-finish">
			<form method="POST" action="?/confirmCauseHypotheses" use:enhance>
				<button type="submit" class="ec-btn-primary">Continuar <span aria-hidden="true">→</span></button>
			</form>
			<p class="ec-continue-caption">{continueCaption}</p>
		</div>
	{/if}

	{#if activity.allowsSkip && activity.pendingItemDetail && !reviewOrigin}
		<SkipActivityConfirm activity={{ id: activity.id, title: activity.title, pendingItemDetail: activity.pendingItemDetail }} />
	{/if}
</div>

<style>
	.ec-shell {
		max-width: 46rem;
	}

	.ec-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 1.125rem;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--hydra-border);
	}

	.ec-breadcrumb {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.ec-pills {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.ec-pill-current {
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

	.ec-pill-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--hydra-accent);
		flex-shrink: 0;
	}

	.ec-pill-dot-only {
		width: 0.5625rem;
		height: 0.5625rem;
		border-radius: 50%;
		background: transparent;
		border: 1px solid var(--hydra-border);
	}

	.ec-return {
		margin: 0 0 0.875rem;
	}

	.ec-return a {
		font-size: 0.8125rem;
		color: var(--hydra-muted);
	}

	.ec-eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--hydra-accent);
		text-transform: uppercase;
		margin: 0 0 0.625rem;
	}

	.ec-question {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.3;
		margin: 0 0 0.5rem;
		color: var(--hydra-text);
		max-width: 40rem;
	}

	.ec-help {
		font-size: 0.84375rem;
		color: var(--hydra-muted);
		margin: 0 0 1.25rem;
	}

	.ec-empty-state {
		border: 1px dashed var(--hydra-border);
		border-radius: 0.75rem;
		padding: 1.375rem;
		margin-top: 1.25rem;
	}

	.ec-empty-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--hydra-text);
		margin: 0 0 0.375rem;
	}

	.ec-empty-help {
		font-size: 0.78125rem;
		color: var(--hydra-muted);
		margin: 0 0 0.875rem;
	}

	.ec-context-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-bottom: 1.25rem;
	}

	.ec-context-card {
		border-radius: 0.625rem;
		padding: 0.75rem 0.875rem;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		flex: 1;
		min-width: 9rem;
	}

	.ec-context-label {
		font-size: 0.65625rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: var(--hydra-muted);
		text-transform: uppercase;
		margin: 0 0 0.375rem;
	}

	.ec-context-text {
		font-size: 0.75rem;
		color: var(--hydra-muted);
		margin: 0 0 0.625rem;
		line-height: 1.5;
	}

	.ec-icon-link {
		background: none;
		border: none;
		color: var(--hydra-accent);
		font-size: 0.6875rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		padding: 0;
	}

	.ec-context-used {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		background: rgba(45, 212, 196, 0.1);
		border: 1px solid rgba(45, 212, 196, 0.3);
		border-radius: 999px;
		padding: 0.3125rem 0.625rem 0.3125rem 0.75rem;
		font-size: 0.71875rem;
		color: var(--hydra-accent);
		margin-bottom: 0.625rem;
	}

	.ec-context-used .ec-icon-link {
		color: var(--hydra-accent);
	}

	.ec-draft-row {
		display: flex;
		gap: 0.5rem;
	}

	.ec-draft-row input {
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

	.ec-draft-row button {
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

	.ec-draft-row button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.ec-text-link {
		background: none;
		border: none;
		color: var(--hydra-muted);
		text-decoration: underline;
		font-size: 0.78125rem;
		cursor: pointer;
		font-family: inherit;
		padding: 0;
		margin-top: 0.75rem;
	}

	.ec-ghost-affordance {
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
		border-radius: 8px;
		padding: 0.5rem 0.875rem;
		font-size: 0.78125rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}

	.ec-ghost-affordance:hover {
		color: var(--hydra-text);
	}

	.ec-list-heading {
		font-size: 0.78125rem;
		font-weight: 700;
		color: var(--hydra-muted);
		margin: 1.375rem 0 0.625rem;
	}

	.ec-hypothesis-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.ec-card {
		border-radius: 0.75rem;
		padding: 1rem 1.125rem;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
	}

	.ec-pill {
		display: inline-block;
		font-size: 0.65625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hydra-accent);
		background: rgba(45, 212, 196, 0.1);
		border: 1px solid rgba(45, 212, 196, 0.3);
		border-radius: 999px;
		padding: 0.1875rem 0.5625rem;
		margin-bottom: 0.5rem;
	}

	.ec-hypothesis-title {
		font-size: 0.90625rem;
		font-weight: 700;
		color: var(--hydra-text);
		margin: 0 0 0.25rem;
	}

	.ec-hypothesis-origin {
		font-size: 0.71875rem;
		color: var(--hydra-muted);
		font-style: italic;
		margin: 0 0 0.625rem;
	}

	.ec-hypothesis-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.ec-hypothesis-actions form {
		margin: 0;
	}

	.ec-icon-btn-text {
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
		border-radius: 999px;
		padding: 0.3125rem 0.625rem;
		font-size: 0.71875rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}

	.ec-icon-btn-text:hover {
		color: var(--hydra-text);
	}

	.ec-hypothesis-detail {
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--hydra-border);
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.ec-subtle-label {
		font-size: 0.71875rem;
		color: var(--hydra-muted);
		margin: 0 0 0.5rem;
	}

	.ec-subtle-empty {
		font-size: 0.71875rem;
		color: var(--hydra-muted);
		font-style: italic;
		margin: 0;
	}

	.ec-chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.ec-chip-row form {
		margin: 0;
	}

	.ec-plain-chip {
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
		border-radius: 999px;
		padding: 0.375rem 0.8125rem;
		font-size: 0.71875rem;
		cursor: pointer;
		font-family: inherit;
	}

	.ec-plain-chip:hover {
		color: var(--hydra-text);
	}

	.ec-plain-chip.ec-selected {
		background: rgba(45, 212, 196, 0.14);
		border-color: rgba(45, 212, 196, 0.55);
		color: #eafffb;
	}

	.ec-hypothesis-detail input[type='text'] {
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

	.ec-finish {
		margin-top: 2rem;
	}

	.ec-btn-primary {
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

	.ec-continue-caption {
		font-size: 0.71875rem;
		color: var(--hydra-muted);
		margin: 0.625rem 0 0;
	}
</style>
