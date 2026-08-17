<script lang="ts">
	// "Como é tratado hoje" (Stage 4A do rework, Claude Design, "Como e
	// Tratado Hoje - Refinado.dc.html"). Substitui o texto livre de "Estado
	// atual" por uma cadeia ordenada de TreatmentStep reais (persistidos a
	// cada interação, nunca staging local submetido de uma vez só — mesmo
	// espírito de MapaDeImpacto.svelte) e o estado canônico "Hoje não existe
	// um tratamento definido" (noTreatment).
	//
	// Mesma mecânica de shell de "Quem é afetado"/"Entender a situação":
	// topbar de progresso própria, substituindo o painel genérico "Progresso
	// da fase"/Bancada de /now só para esta atividade. Implementado local a
	// este componente — sem abstração compartilhada, extraída quando uma
	// quarta activity adotar a mesma mecânica, não antes.
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import {
		TREATMENT_FRICTION_OPTIONS,
		TREATMENT_MEDIUM_SUGGESTIONS,
		excludeUsedLabels,
		summarizeCurrentTreatment
	} from '$lib/catalog/current-treatment';
	import type { TreatmentConfirmationIssue, TreatmentFriction } from '$lib/domain';
	import type { AffectedGroupView, CurrentTreatmentView, TreatmentStepView } from '$lib/server/application/types';
	import type { PhaseProgressView } from '$lib/phase-progress';
	import SkipActivityConfirm from './SkipActivityConfirm.svelte';

	let {
		activity,
		currentTreatment,
		treatmentSteps,
		treatmentConfirmationIssues,
		affectedGroups,
		reviewOrigin,
		phaseProgress,
		projectName,
		projectId,
		situacaoSynthesis
	}: {
		activity: { id: string; title: string; allowsSkip: boolean; pendingItemDetail?: string };
		currentTreatment: CurrentTreatmentView;
		treatmentSteps: TreatmentStepView[];
		treatmentConfirmationIssues: TreatmentConfirmationIssue[];
		affectedGroups: AffectedGroupView[];
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

	let steps = $derived([...treatmentSteps].sort((a, b) => a.order - b.order));
	let synthesis = $derived(
		summarizeCurrentTreatment(
			currentTreatment.noTreatment,
			steps.map((step) => ({
				whatHappens: step.whatHappens,
				actors: step.actors,
				medium: step.medium,
				frictions: step.frictions
			}))
		)
	);

	let expandedStepId = $state<string | null>(null);
	let justAdded = $state<string | null>(null);
	let pulseTimeout: ReturnType<typeof setTimeout> | undefined;

	let newStepValue = $state('');
	let addStepFormEl = $state<HTMLFormElement | undefined>();

	let actorCustomOpenStepId = $state<string | null>(null);
	let actorCustomValue = $state('');
	let mediumCustomOpenStepId = $state<string | null>(null);
	let mediumCustomValue = $state('');

	const actorsFormRefs: Record<string, HTMLFormElement | undefined> = {};
	const mediumFormRefs: Record<string, HTMLFormElement | undefined> = {};
	let pendingActorsByStep = $state<Record<string, string[]>>({});
	let pendingMediumByStep = $state<Record<string, string>>({});

	function pulse(id: string) {
		justAdded = id;
		clearTimeout(pulseTimeout);
		pulseTimeout = setTimeout(() => (justAdded = null), 1400);
	}

	function toggleExpand(stepId: string) {
		expandedStepId = expandedStepId === stepId ? null : stepId;
	}

	function handleAddStepSubmit(): EnhanceCallback {
		const existingIds = new Set(steps.map((s) => s.id));
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				await update();
				return;
			}
			await update();
			newStepValue = '';
			// Só destaque visual (pulse) — o contexto/fricções permanece fechado
			// por padrão mesmo no passo recém-criado (§3 do corte: "não abrir
			// todos os atributos por padrão").
			const created = steps.find((s) => !existingIds.has(s.id));
			if (created) pulse(created.id);
		};
	}

	function handleGenericSubmit(): EnhanceCallback {
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				await update();
				return;
			}
			await update();
		};
	}

	function handleRemoveSubmit(stepId: string): EnhanceCallback {
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				await update();
				return;
			}
			await update();
			if (expandedStepId === stepId) expandedStepId = null;
		};
	}

	async function toggleActor(stepId: string, currentActors: readonly string[], actor: string) {
		const next = currentActors.includes(actor)
			? currentActors.filter((a) => a !== actor)
			: [...currentActors, actor];
		pendingActorsByStep[stepId] = next;
		await tick();
		actorsFormRefs[stepId]?.requestSubmit();
	}

	async function submitCustomActor(stepId: string, currentActors: readonly string[]) {
		const value = actorCustomValue.trim();
		if (!value || currentActors.includes(value)) return;
		pendingActorsByStep[stepId] = [...currentActors, value];
		await tick();
		actorsFormRefs[stepId]?.requestSubmit();
		actorCustomOpenStepId = null;
		actorCustomValue = '';
	}

	async function setMedium(stepId: string, medium: string) {
		pendingMediumByStep[stepId] = medium;
		await tick();
		mediumFormRefs[stepId]?.requestSubmit();
	}

	async function submitCustomMedium(stepId: string) {
		const value = mediumCustomValue.trim();
		if (!value) return;
		pendingMediumByStep[stepId] = value;
		await tick();
		mediumFormRefs[stepId]?.requestSubmit();
		mediumCustomOpenStepId = null;
		mediumCustomValue = '';
	}

	let breadcrumbActivities = $derived.by(() => {
		if (!phaseProgress) return [];
		const order = ['concluidas', 'atual', 'pendentes'] as const;
		return order.flatMap((key) => phaseProgress.groups.find((g) => g.key === key)?.activities ?? []);
	});

	let canFinish = $derived(!reviewOrigin && treatmentConfirmationIssues.length === 0);
	let promptQuestion = $derived(steps.length === 0 ? 'O que costuma acontecer primeiro?' : 'E depois?');
	let newStepTrimmed = $derived(newStepValue.trim());

	let returnHref = $derived(
		reviewOrigin === 'summary'
			? `/projects/${projectId}/summary`
			: reviewOrigin === 'records'
				? `/projects/${projectId}/records`
				: null
	);
</script>

<div class="cet-shell">
	<div class="cet-topbar">
		<p class="cet-breadcrumb">
			{projectName ?? 'Novo projeto'}{#if phaseProgress}
				· {phaseProgress.phaseLabel}{/if}
		</p>
		{#if breadcrumbActivities.length > 0}
			<div class="cet-pills" aria-hidden="true">
				{#each breadcrumbActivities as act (act.id)}
					{#if act.isCurrent}
						<span class="cet-pill-current"><span class="cet-pill-dot"></span>{act.title}</span>
					{:else}
						<span class="cet-pill-dot-only" title={act.title}></span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	{#if returnHref}
		<p class="cet-return">
			<a href={returnHref}>← Voltar para {reviewOrigin === 'summary' ? 'o Resumo da descoberta' : 'Registros'}</a>
		</p>
	{/if}

	{#if situacaoSynthesis}
		<p class="cet-context">A partir da situação identificada — <em>“{situacaoSynthesis}”</em></p>
	{/if}
	<p class="cet-eyebrow">Como é tratado hoje</p>
	<h2 class="cet-question">O que acontece quando isso aparece?</h2>
	<p class="cet-help">Construa a sequência do que costuma acontecer, na ordem. Você pode voltar e ajustar depois.</p>

	{#if currentTreatment.noTreatment}
		<div class="cet-empty-state">
			Hoje não existe um tratamento definido. Quando isso aparece, o problema simplesmente acontece — sem um passo
			seguinte conhecido.
		</div>
		<form method="POST" action="?/setTreatmentNoTreatment" use:enhance={handleGenericSubmit}>
			<input type="hidden" name="noTreatment" value="false" />
			<button type="submit" class="cet-ghost-affordance">Na verdade, existe algo — quero descrever</button>
		</form>
	{:else}
		<div class="cet-chain" role="list" aria-label="Cadeia de tratamento atual">
			{#each steps as step, index (step.id)}
				{@const currentActors = pendingActorsByStep[step.id] ?? step.actors}
				<div class="cet-node-row" role="listitem">
					<div class="cet-rail-col">
						<div class="cet-node-circle cet-node-circle-num" class:cet-node-pulse={justAdded === step.id}>
							{index + 1}
						</div>
					</div>
					<div class="cet-node-content">
						<div class="cet-step-head">
							<span class="cet-step-label">{step.whatHappens}</span>
							<div class="cet-step-actions">
								<form method="POST" action="?/moveTreatmentStep" use:enhance={handleGenericSubmit}>
									<input type="hidden" name="stepId" value={step.id} />
									<input type="hidden" name="direction" value="-1" />
									<button type="submit" class="cet-icon-btn" disabled={index === 0} aria-label="Mover para cima"
										>↑</button
									>
								</form>
								<form method="POST" action="?/moveTreatmentStep" use:enhance={handleGenericSubmit}>
									<input type="hidden" name="stepId" value={step.id} />
									<input type="hidden" name="direction" value="1" />
									<button
										type="submit"
										class="cet-icon-btn"
										disabled={index === steps.length - 1}
										aria-label="Mover para baixo">↓</button
									>
								</form>
								<form method="POST" action="?/removeTreatmentStep" use:enhance={() => handleRemoveSubmit(step.id)}>
									<input type="hidden" name="stepId" value={step.id} />
									<button type="submit" class="cet-icon-btn" aria-label="Remover passo">×</button>
								</form>
							</div>
						</div>

						{#if step.actors.length > 0 || step.medium || step.frictions.length > 0}
							<div class="cet-summary-tags">
								{#each step.actors as actor (actor)}
									<span class="cet-tag cet-tag-actor">{actor}</span>
								{/each}
								{#if step.medium}
									<span class="cet-tag cet-tag-medium">{step.medium}</span>
								{/if}
								{#each step.frictions as friction (friction)}
									<span class="cet-tag cet-tag-friction"
										>{TREATMENT_FRICTION_OPTIONS.find((f) => f.id === friction)?.label ?? friction}</span
									>
								{/each}
							</div>
						{/if}

						<button type="button" class="cet-ghost-affordance cet-compact" onclick={() => toggleExpand(step.id)}>
							{expandedStepId === step.id ? 'Ocultar contexto e fricções' : '+ Adicionar contexto e fricções'}
						</button>

						{#if expandedStepId === step.id}
							<div class="cet-step-detail">
								<div>
									<p class="cet-subtle-label">Quem atua aqui? (opcional)</p>
									<div class="cet-chip-row">
										{#each excludeUsedLabels(
											affectedGroups.map((g) => g.label),
											currentActors
										) as label (label)}
											<button
												type="button"
												class="cet-plain-chip"
												onclick={() => toggleActor(step.id, currentActors, label)}>{label}</button
											>
										{/each}
										{#each currentActors as actor (actor)}
											<button
												type="button"
												class="cet-plain-chip cet-selected"
												onclick={() => toggleActor(step.id, currentActors, actor)}>{actor} ×</button
											>
										{/each}
										<button type="button" class="cet-plain-chip" onclick={() => (actorCustomOpenStepId = step.id)}
											>+ outro</button
										>
									</div>
									{#if actorCustomOpenStepId === step.id}
										<div class="cet-custom-form">
											<input
												type="text"
												placeholder="Nomear quem atua…"
												bind:value={actorCustomValue}
												onkeydown={(e) => e.key === 'Enter' && submitCustomActor(step.id, currentActors)}
											/>
											<button type="button" onclick={() => submitCustomActor(step.id, currentActors)}>OK</button>
										</div>
									{/if}
									<form
										method="POST"
										action="?/setTreatmentStepActors"
										use:enhance={handleGenericSubmit}
										bind:this={actorsFormRefs[step.id]}
									>
										<input type="hidden" name="stepId" value={step.id} />
										{#each pendingActorsByStep[step.id] ?? [] as actor (actor)}
											<input type="hidden" name="actor" value={actor} />
										{/each}
									</form>
								</div>

								<div>
									<p class="cet-subtle-label">Meio ou ferramenta usado (opcional)</p>
									<div class="cet-chip-row">
										{#each TREATMENT_MEDIUM_SUGGESTIONS as label (label)}
											<button
												type="button"
												class="cet-plain-chip"
												class:cet-selected={step.medium === label}
												onclick={() => setMedium(step.id, step.medium === label ? '' : label)}>{label}</button
											>
										{/each}
										<button type="button" class="cet-plain-chip" onclick={() => (mediumCustomOpenStepId = step.id)}
											>+ outro</button
										>
									</div>
									{#if mediumCustomOpenStepId === step.id}
										<div class="cet-custom-form">
											<input
												type="text"
												placeholder="Nomear a ferramenta…"
												bind:value={mediumCustomValue}
												onkeydown={(e) => e.key === 'Enter' && submitCustomMedium(step.id)}
											/>
											<button type="button" onclick={() => submitCustomMedium(step.id)}>OK</button>
										</div>
									{/if}
									<form
										method="POST"
										action="?/setTreatmentStepMedium"
										use:enhance={handleGenericSubmit}
										bind:this={mediumFormRefs[step.id]}
									>
										<input type="hidden" name="stepId" value={step.id} />
										<input type="hidden" name="medium" value={pendingMediumByStep[step.id] ?? ''} />
									</form>
								</div>

								<div>
									<p class="cet-subtle-label">Fricção neste momento (opcional) — pode marcar mais de uma</p>
									<div class="cet-chip-row">
										{#each TREATMENT_FRICTION_OPTIONS as option (option.id)}
											<form method="POST" action="?/toggleTreatmentStepFriction" use:enhance={handleGenericSubmit}>
												<input type="hidden" name="stepId" value={step.id} />
												<input type="hidden" name="friction" value={option.id} />
												<button
													type="submit"
													class="cet-friction-pill"
													class:cet-selected={step.frictions.includes(option.id)}>{option.label}</button
												>
											</form>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/each}

			<div class="cet-node-row cet-node-row-add">
				<div class="cet-rail-col">
					<div class="cet-node-circle cet-node-circle-dashed" aria-hidden="true">+</div>
				</div>
				<div class="cet-node-content">
					<p class="cet-prompt-question">{promptQuestion}</p>
					<form method="POST" action="?/addTreatmentStep" use:enhance={handleAddStepSubmit} bind:this={addStepFormEl}>
						<div class="cet-custom-form">
							<input
								type="text"
								name="whatHappens"
								placeholder="Descrever em poucas palavras…"
								bind:value={newStepValue}
							/>
							<button type="submit" disabled={newStepTrimmed.length === 0}>Adicionar</button>
						</div>
					</form>
					<form method="POST" action="?/setTreatmentNoTreatment" use:enhance={handleGenericSubmit}>
						<input type="hidden" name="noTreatment" value="true" />
						<button type="submit" class="cet-ghost-affordance">Hoje não existe um tratamento definido</button>
					</form>
				</div>
			</div>
		</div>

		{#if steps.length > 0}
			<div class="cet-synthesis-row">
				<div class="cet-rail-col"><div class="cet-rail-solo"></div></div>
				<div class="cet-synthesis">
					<p class="cet-eyebrow cet-eyebrow-muted">↳ Como funciona hoje</p>
					<p class="cet-synthesis-text">{synthesis}</p>
				</div>
			</div>
		{/if}
	{/if}

	{#if canFinish}
		<div class="cet-finish">
			<form method="POST" action="?/confirmTreatment" use:enhance>
				<button type="submit" class="cet-btn-primary">Continuar <span aria-hidden="true">→</span></button>
			</form>
		</div>
	{/if}

	{#if activity.allowsSkip && activity.pendingItemDetail && !reviewOrigin}
		<SkipActivityConfirm activity={{ id: activity.id, title: activity.title, pendingItemDetail: activity.pendingItemDetail }} />
	{/if}
</div>

<style>
	.cet-shell {
		max-width: 46rem;
	}

	.cet-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 1.125rem;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--hydra-border);
	}

	.cet-breadcrumb {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.cet-pills {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.cet-pill-current {
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

	.cet-pill-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--hydra-accent);
		flex-shrink: 0;
	}

	.cet-pill-dot-only {
		width: 0.5625rem;
		height: 0.5625rem;
		border-radius: 50%;
		background: transparent;
		border: 1px solid var(--hydra-border);
	}

	.cet-return {
		margin: 0 0 0.875rem;
	}

	.cet-return a {
		font-size: 0.8125rem;
		color: var(--hydra-muted);
	}

	.cet-context {
		font-size: 0.75rem;
		color: var(--hydra-muted);
		margin: 0 0 0.625rem;
		line-height: 1.5;
	}

	.cet-eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--hydra-accent);
		text-transform: uppercase;
		margin: 0 0 0.625rem;
	}

	.cet-question {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.3;
		margin: 0 0 0.5rem;
		color: var(--hydra-text);
		max-width: 40rem;
	}

	.cet-help {
		font-size: 0.84375rem;
		color: var(--hydra-muted);
		margin: 0 0 1.5rem;
	}

	.cet-empty-state {
		border: 1px dashed var(--hydra-border);
		border-radius: 0.75rem;
		padding: 1.25rem;
		color: var(--hydra-muted);
		font-size: 0.84375rem;
		font-style: italic;
		line-height: 1.6;
		margin-bottom: 0.875rem;
	}

	/* Cadeia vertical contínua (Claude Design, "Como e Tratado Hoje -
	   Refinamento Visual.dc.html", alternativa 1A, Visual Gate deste corte):
	   cada passo é um nó circular numerado ligado ao próximo por um trilho
	   vertical; o nó "+" (tracejado, sem trilho de entrada) representa o
	   próximo passo ainda não construído. `.cet-rail-col` empilha via flex
	   (não posicionamento absoluto sobre a lista inteira) para acompanhar
	   naturalmente altura dinâmica de conteúdo, reordenar, expandir/
	   recolher e adicionar/remover passos sem recalcular offsets. */
	.cet-chain {
		display: flex;
		flex-direction: column;
	}

	.cet-node-row {
		display: flex;
		gap: 0.875rem;
		padding-bottom: 1.375rem;
	}

	.cet-node-row:last-child {
		padding-bottom: 0;
	}

	.cet-rail-col {
		width: 1.875rem;
		flex-shrink: 0;
		display: flex;
		justify-content: center;
		position: relative;
	}

	.cet-node-row:not(:last-child) .cet-rail-col::before {
		content: '';
		position: absolute;
		top: 1.875rem;
		bottom: 0;
		left: 50%;
		width: 2px;
		transform: translateX(-50%);
		background: var(--hydra-border);
	}

	.cet-node-circle {
		width: 1.875rem;
		height: 1.875rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		flex-shrink: 0;
		background: var(--hydra-bg);
		position: relative;
		z-index: 1;
	}

	.cet-node-circle-num {
		border: 2px solid var(--hydra-accent);
		color: var(--hydra-accent);
	}

	.cet-node-circle-dashed {
		border: 2px dashed var(--hydra-border);
		color: var(--hydra-muted);
		font-size: 0.875rem;
	}

	.cet-node-pulse {
		animation: cet-pulse-glow 1.4s ease;
	}

	@keyframes cet-pulse-glow {
		0% {
			box-shadow: 0 0 0 0 rgba(45, 212, 196, 0.55);
		}
		70% {
			box-shadow: 0 0 0 10px rgba(45, 212, 196, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(45, 212, 196, 0);
		}
	}

	.cet-node-content {
		min-width: 0;
		flex: 1;
		padding-top: 0.1875rem;
	}

	.cet-node-row-add .cet-node-content {
		padding-top: 0.25rem;
	}

	.cet-step-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.625rem;
	}

	.cet-step-label {
		font-size: 0.90625rem;
		color: var(--hydra-text);
		font-weight: 600;
		line-height: 1.5;
		min-width: 0;
	}

	.cet-step-actions {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.cet-step-actions form {
		margin: 0;
	}

	.cet-icon-btn {
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
		border-radius: 6px;
		width: 1.375rem;
		height: 1.375rem;
		font-size: 0.75rem;
		cursor: pointer;
		font-family: inherit;
		line-height: 1;
	}

	.cet-icon-btn:hover:not(:disabled) {
		color: var(--hydra-text);
	}

	.cet-icon-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.cet-summary-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.625rem;
	}

	.cet-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		border-radius: 999px;
		padding: 0.1875rem 0.625rem;
		font-size: 0.6875rem;
		font-weight: 600;
	}

	.cet-tag-actor {
		background: rgba(45, 212, 196, 0.12);
		color: var(--hydra-accent-light, #5be9d8);
	}

	.cet-tag-medium {
		background: var(--hydra-surface-raised);
		color: var(--hydra-muted);
	}

	.cet-tag-friction {
		background: rgba(248, 113, 113, 0.12);
		color: #fca5a5;
	}

	.cet-ghost-affordance {
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
		border-radius: 8px;
		padding: 0.5rem 0.875rem;
		font-size: 0.78125rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		white-space: nowrap;
	}

	.cet-ghost-affordance:hover {
		color: var(--hydra-text);
	}

	.cet-ghost-affordance.cet-compact {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		border-radius: 7px;
		margin-top: 0.625rem;
	}

	.cet-step-detail {
		margin-top: 0.875rem;
		padding-top: 0.875rem;
		border-top: 1px solid var(--hydra-border);
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.cet-subtle-label {
		font-size: 0.71875rem;
		color: var(--hydra-muted);
		margin: 0 0 0.5rem;
	}

	.cet-chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.cet-plain-chip {
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
		border-radius: 999px;
		padding: 0.375rem 0.8125rem;
		font-size: 0.78125rem;
		cursor: pointer;
		font-family: inherit;
	}

	.cet-plain-chip:hover {
		color: var(--hydra-text);
	}

	.cet-plain-chip.cet-selected {
		background: rgba(45, 212, 196, 0.14);
		border-color: rgba(45, 212, 196, 0.55);
		color: #eafffb;
	}

	.cet-custom-form {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.cet-custom-form input {
		flex: 1;
		min-width: 0;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-dark-radius, 0.5rem);
		padding: 0.5rem 0.625rem;
		color: var(--hydra-text);
		font-size: 0.8125rem;
		font-family: inherit;
		outline: none;
		box-sizing: border-box;
	}

	.cet-custom-form button {
		background: var(--hydra-surface-raised);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-dark-radius, 0.5rem);
		padding: 0 0.75rem;
		color: var(--hydra-text);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}

	.cet-friction-pill {
		border-radius: 999px;
		padding: 0.3125rem 0.6875rem;
		font-size: 0.6875rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface);
		color: var(--hydra-muted);
	}

	.cet-friction-pill.cet-selected {
		background: rgba(248, 113, 113, 0.14);
		border-color: rgba(248, 113, 113, 0.5);
		color: #fca5a5;
	}

	.cet-prompt-question {
		font-size: 0.84375rem;
		font-weight: 600;
		color: var(--hydra-text);
		margin: 0 0 0.625rem;
	}

	.cet-node-row-add form:last-of-type {
		margin-top: 0.625rem;
	}

	/* Trilho residual que leva da corrente até a síntese — mesma coluna de
	   30px dos nós, sem círculo, indicando que "Como funciona hoje" pendura
	   do mesmo trilho em vez de flutuar como um bloco à parte. */
	.cet-synthesis-row {
		display: flex;
		gap: 0.875rem;
		margin-top: 0.375rem;
	}

	.cet-rail-solo {
		width: 2px;
		height: 100%;
		min-height: 1.25rem;
		background: var(--hydra-border);
		opacity: 0.6;
	}

	/* Leitura derivada, não um card a gerenciar: sem superfície nem borda —
	   só recuo e itálico, pendurados no mesmo trilho (cet-rail-solo) que já
	   liga a síntese à cadeia. */
	.cet-synthesis {
		flex: 1;
		min-width: 0;
		padding: 0.125rem 0 0;
	}

	.cet-eyebrow-muted {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		color: var(--hydra-muted);
		opacity: 0.85;
	}

	.cet-synthesis-text {
		font-size: 0.84375rem;
		font-style: italic;
		color: var(--hydra-muted);
		line-height: 1.7;
		margin: 0;
	}

	.cet-finish {
		margin-top: 2rem;
	}

	.cet-btn-primary {
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

	/* Compacta o trilho na largura mobile do frame 1A (260px) — mesma
	   proporção de redução (30px → 24px) usada no artefato aprovado. */
	@media (max-width: 30rem) {
		.cet-rail-col {
			width: 1.5rem;
		}

		.cet-node-circle {
			width: 1.5rem;
			height: 1.5rem;
			font-size: 0.6875rem;
		}

		.cet-node-row:not(:last-child) .cet-rail-col::before {
			top: 1.5rem;
		}

		.cet-node-row {
			gap: 0.625rem;
			padding-bottom: 1.125rem;
		}

		.cet-synthesis-row {
			gap: 0.625rem;
		}
	}
</style>
