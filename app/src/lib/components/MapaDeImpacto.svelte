<script lang="ts">
	// "Quem é afetado" — Mapa de Impacto (Claude Design, "Quem é Afetado.dc.html",
	// ETAPA 2 do rework: docs/core/HYDRA_PRODUCT_REWORK.md §32). Substitui o
	// texto livre de "Público afetado" por uma surface de manipulação direta:
	// adicionar um grupo já cria um AffectedGroup real (persistido a cada
	// interação, nunca staging local submetido de uma vez só — mesmo espírito
	// do editor de ScopeItem em /next-version), que se reposiciona sozinho
	// entre as faixas conforme o impacto é classificado.
	//
	// Mesma mecânica de shell de "Entender a situação" (EntenderSituacao.svelte):
	// topbar de progresso própria, substituindo o painel genérico "Progresso da
	// fase"/Bancada de /now só para esta atividade. Implementado local a este
	// componente — sem abstração compartilhada com EntenderSituacao (extraída
	// quando uma terceira activity adotar a mesma mecânica, não antes).
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import {
		AFFECTED_GROUP_FREQUENCY_OPTIONS,
		AFFECTED_GROUP_IMPACT_OPTIONS,
		AFFECTED_GROUP_LANE_LABEL,
		AFFECTED_GROUP_SUGGESTIONS_MORE,
		AFFECTED_GROUP_SUGGESTIONS_PRIMARY,
		affectedGroupFrequencyLabel,
		affectedGroupSuggestions,
		isDuplicateAffectedGroupLabel
	} from '$lib/catalog/affected-group';
	import type {
		AffectedGroupConfirmationIssue,
		AffectedGroupFrequency,
		AffectedGroupImpact
	} from '$lib/domain';
	import type { AffectedGroupView } from '$lib/server/application/types';
	import type { PhaseProgressView } from '$lib/phase-progress';
	import SkipActivityConfirm from './SkipActivityConfirm.svelte';

	let {
		activity,
		affectedGroups,
		affectedGroupConfirmationIssues,
		reviewOrigin,
		phaseProgress,
		projectName,
		projectId,
		situacaoSynthesis
	}: {
		activity: { id: string; title: string; allowsSkip: boolean; pendingItemDetail?: string };
		affectedGroups: AffectedGroupView[];
		affectedGroupConfirmationIssues: AffectedGroupConfirmationIssue[];
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

	const LANE_ORDER: AffectedGroupImpact[] = ['alto', 'medio', 'baixo', 'desconhecido'];
	const FREQ_BARS: Record<AffectedGroupFrequency, number> = {
		constante: 4,
		frequente: 3,
		as_vezes: 2,
		raro: 1,
		desconhecido: 0
	};

	let unclassified = $derived(affectedGroups.filter((g) => g.impact === null));
	let lanes = $derived(
		LANE_ORDER.map((impact) => ({
			impact,
			label: AFFECTED_GROUP_LANE_LABEL[impact],
			groups: affectedGroups.filter((g) => g.impact === impact)
		})).filter((lane) => lane.groups.length > 0)
	);

	let existingLabels = $derived(affectedGroups.map((g) => g.label));
	let primarySuggestions = $derived(affectedGroupSuggestions(AFFECTED_GROUP_SUGGESTIONS_PRIMARY, existingLabels));
	let moreSuggestions = $derived(affectedGroupSuggestions(AFFECTED_GROUP_SUGGESTIONS_MORE, existingLabels));

	let addOpen = $state(false);
	let showMore = $state(false);
	let customLabel = $state('');
	let expandedGroupId = $state<string | null>(null);
	let justAdded = $state<string | null>(null);
	let pulseTimeout: ReturnType<typeof setTimeout> | undefined;

	let customTrimmed = $derived(customLabel.trim());
	let customDuplicate = $derived(customTrimmed.length > 0 && isDuplicateAffectedGroupLabel(customTrimmed, existingLabels));
	let customDisabled = $derived(customTrimmed.length === 0 || customDuplicate);

	function pulse(id: string) {
		justAdded = id;
		clearTimeout(pulseTimeout);
		pulseTimeout = setTimeout(() => (justAdded = null), 1400);
	}

	function openAdd() {
		addOpen = true;
	}
	function closeAdd() {
		addOpen = false;
		showMore = false;
		customLabel = '';
	}

	// Único handler para sugestão e "Outro grupo": ambos submetem ao mesmo
	// `?/addAffectedGroup`, com o mesmo comportamento pós-sucesso (fechar o
	// card de adição, expandir e destacar o grupo recém-criado). O grupo novo
	// é identificado por diferença de conjunto de ids antes/depois — o caso
	// de uso não devolve "qual id foi criado" separadamente.
	function handleAddGroupSubmit(): EnhanceCallback {
		const existingIds = new Set(affectedGroups.map((g) => g.id));
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				await update();
				return;
			}
			await update();
			closeAdd();
			const created = affectedGroups.find((g) => !existingIds.has(g.id));
			if (created) {
				expandedGroupId = created.id;
				pulse(created.id);
			}
		};
	}

	function handleClassifySubmit(): EnhanceCallback {
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				await update();
				return;
			}
			await update();
		};
	}

	function handleRemoveSubmit(groupId: string): EnhanceCallback {
		return async ({ result, update }) => {
			if (result.type === 'failure' || result.type === 'error') {
				await update();
				return;
			}
			await update();
			if (expandedGroupId === groupId) expandedGroupId = null;
		};
	}

	function toggleExpand(groupId: string) {
		expandedGroupId = expandedGroupId === groupId ? null : groupId;
	}

	function frequencyLabel(frequency: AffectedGroupFrequency | null): string {
		return frequency ? affectedGroupFrequencyLabel(frequency) : 'Frequência pendente';
	}

	let breadcrumbActivities = $derived.by(() => {
		if (!phaseProgress) return [];
		const order = ['concluidas', 'atual', 'pendentes'] as const;
		return order.flatMap((key) => phaseProgress.groups.find((g) => g.key === key)?.activities ?? []);
	});

	let canFinish = $derived(!reviewOrigin && affectedGroupConfirmationIssues.length === 0);

	let returnHref = $derived(
		reviewOrigin === 'summary'
			? `/projects/${projectId}/summary`
			: reviewOrigin === 'records'
				? `/projects/${projectId}/records`
				: null
	);
</script>

<div class="mi-shell">
	<div class="mi-topbar">
		<p class="mi-breadcrumb">
			{projectName ?? 'Novo projeto'}{#if phaseProgress}
				· {phaseProgress.phaseLabel}{/if}
		</p>
		{#if breadcrumbActivities.length > 0}
			<div class="mi-pills" aria-hidden="true">
				{#each breadcrumbActivities as act (act.id)}
					{#if act.isCurrent}
						<span class="mi-pill-current"><span class="mi-pill-dot"></span>{act.title}</span>
					{:else}
						<span class="mi-pill-dot-only" title={act.title}></span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	{#if returnHref}
		<p class="mi-return">
			<a href={returnHref}>← Voltar para {reviewOrigin === 'summary' ? 'o Resumo da descoberta' : 'Registros'}</a>
		</p>
	{/if}

	{#if situacaoSynthesis}
		<p class="mi-context">A partir da situação identificada — <em>“{situacaoSynthesis}”</em></p>
	{/if}
	<p class="mi-eyebrow">Quem é afetado</p>
	<h2 class="mi-question">Quem sente mais essa situação?</h2>
	<p class="mi-help">Adicione grupos e classifique cada um diretamente no mapa abaixo.</p>

	<div class="mi-board">
		<div class="mi-lane">
			<div class="mi-lane-head">
				<span class="mi-lane-dot mi-lane-dot-dashed" aria-hidden="true"></span>
				<span class="mi-lane-label">Por classificar</span>
			</div>
			<div class="mi-lane-body">
				<div class="mi-add-card">
					{#if !addOpen}
						<button type="button" class="mi-add-trigger" onclick={openAdd}>+ Adicionar grupo</button>
					{:else}
						<p class="mi-add-subhead">Grupos prováveis</p>
						<form
							method="POST"
							action="?/addAffectedGroup"
							use:enhance={handleAddGroupSubmit}
							class="mi-suggestions"
						>
							{#each primarySuggestions as label (label)}
								<button type="submit" name="label" value={label} class="mi-chip">{label}</button>
							{/each}
							{#if showMore}
								{#each moreSuggestions as label (label)}
									<button type="submit" name="label" value={label} class="mi-chip">{label}</button>
								{/each}
							{/if}
						</form>
						{#if moreSuggestions.length > 0}
							<button type="button" class="mi-more-toggle" onclick={() => (showMore = !showMore)}>
								{showMore ? 'Ver menos' : 'Ver mais sugestões'}
							</button>
						{/if}

						<p class="mi-add-subhead">Outro grupo</p>
						<form
							method="POST"
							action="?/addAffectedGroup"
							use:enhance={handleAddGroupSubmit}
							class="mi-custom-form"
						>
							<input type="text" name="label" placeholder="Nome curto…" bind:value={customLabel} />
							<button type="submit" class="mi-custom-ok" disabled={customDisabled}>OK</button>
						</form>
						{#if customDuplicate}
							<p class="mi-custom-error" role="alert">Esse grupo já foi adicionado.</p>
						{/if}

						<button type="button" class="mi-cancel" onclick={closeAdd}>Cancelar</button>
					{/if}
				</div>

				{#each unclassified as group (group.id)}
					<div class="mi-tile" class:mi-tile-pulse={justAdded === group.id}>
						<button type="button" class="mi-tile-head" onclick={() => toggleExpand(group.id)}>
							<span class="mi-tile-label">{group.label}</span>
							<span class="mi-tile-hint">{expandedGroupId === group.id ? 'Fechar' : 'Editar'}</span>
						</button>
						{#if expandedGroupId === group.id}
							<div class="mi-tile-detail">
								<p class="mi-tile-detail-label">Impacto</p>
								<form
									method="POST"
									action="?/setAffectedGroupImpact"
									use:enhance={handleClassifySubmit}
									class="mi-pill-form"
								>
									<input type="hidden" name="groupId" value={group.id} />
									{#each AFFECTED_GROUP_IMPACT_OPTIONS as opt (opt.id)}
										<button
											type="submit"
											name="impact"
											value={opt.id}
											class="mi-chip"
											class:selected={group.impact === opt.id}
										>
											{opt.label}
										</button>
									{/each}
								</form>

								<p class="mi-tile-detail-label">Frequência</p>
								<form
									method="POST"
									action="?/setAffectedGroupFrequency"
									use:enhance={handleClassifySubmit}
									class="mi-pill-form"
								>
									<input type="hidden" name="groupId" value={group.id} />
									{#each AFFECTED_GROUP_FREQUENCY_OPTIONS as opt (opt.id)}
										<button
											type="submit"
											name="frequency"
											value={opt.id}
											class="mi-chip"
											class:selected={group.frequency === opt.id}
										>
											{opt.label}
										</button>
									{/each}
								</form>

								<form
									method="POST"
									action="?/removeAffectedGroup"
									use:enhance={() => handleRemoveSubmit(group.id)}
								>
									<input type="hidden" name="groupId" value={group.id} />
									<button type="submit" class="mi-remove">Remover grupo</button>
								</form>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#each lanes as lane (lane.impact)}
			<div class="mi-lane">
				<div class="mi-lane-head">
					{#if lane.impact === 'desconhecido'}
						<span class="mi-lane-dot mi-lane-dot-dashed" aria-hidden="true"></span>
					{:else}
						<span
							class="mi-lane-dot"
							class:mi-lane-dot-alto={lane.impact === 'alto'}
							class:mi-lane-dot-medio={lane.impact === 'medio'}
							class:mi-lane-dot-baixo={lane.impact === 'baixo'}
							aria-hidden="true"
						></span>
					{/if}
					<span class="mi-lane-label">{lane.label}</span>
				</div>
				<div class="mi-lane-body">
					{#each lane.groups as group (group.id)}
						<div class="mi-tile mi-tile-classified" class:mi-tile-pulse={justAdded === group.id}>
							<button type="button" class="mi-tile-head" onclick={() => toggleExpand(group.id)}>
								<span class="mi-tile-label">{group.label}</span>
								<span class="mi-tile-freq">
									<span class="mi-bars" aria-hidden="true">
										{#each [0, 1, 2, 3] as barIndex (barIndex)}
											<span
												class="mi-bar"
												class:mi-bar-filled={group.frequency ? FREQ_BARS[group.frequency] > barIndex : false}
											></span>
										{/each}
									</span>
									<span class="mi-freq-label">{frequencyLabel(group.frequency)}</span>
								</span>
							</button>
							{#if expandedGroupId === group.id}
								<div class="mi-tile-detail">
									<p class="mi-tile-detail-label">Impacto</p>
									<form
										method="POST"
										action="?/setAffectedGroupImpact"
										use:enhance={handleClassifySubmit}
										class="mi-pill-form"
									>
										<input type="hidden" name="groupId" value={group.id} />
										{#each AFFECTED_GROUP_IMPACT_OPTIONS as opt (opt.id)}
											<button
												type="submit"
												name="impact"
												value={opt.id}
												class="mi-chip"
												class:selected={group.impact === opt.id}
											>
												{opt.label}
											</button>
										{/each}
									</form>

									<p class="mi-tile-detail-label">Frequência</p>
									<form
										method="POST"
										action="?/setAffectedGroupFrequency"
										use:enhance={handleClassifySubmit}
										class="mi-pill-form"
									>
										<input type="hidden" name="groupId" value={group.id} />
										{#each AFFECTED_GROUP_FREQUENCY_OPTIONS as opt (opt.id)}
											<button
												type="submit"
												name="frequency"
												value={opt.id}
												class="mi-chip"
												class:selected={group.frequency === opt.id}
											>
												{opt.label}
											</button>
										{/each}
									</form>

									<form
										method="POST"
										action="?/removeAffectedGroup"
										use:enhance={() => handleRemoveSubmit(group.id)}
									>
										<input type="hidden" name="groupId" value={group.id} />
										<button type="submit" class="mi-remove">Remover grupo</button>
									</form>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	{#if canFinish}
		<div class="mi-finish">
			<form method="POST" action="?/confirmAffectedGroups" use:enhance>
				<button type="submit" class="mi-btn-primary">Concluir mapa <span aria-hidden="true">→</span></button>
			</form>
		</div>
	{/if}

	{#if activity.allowsSkip && activity.pendingItemDetail && !reviewOrigin}
		<SkipActivityConfirm activity={{ id: activity.id, title: activity.title, pendingItemDetail: activity.pendingItemDetail }} />
	{/if}
</div>

<style>
	.mi-shell {
		max-width: 74rem;
	}

	.mi-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.5rem;
		flex-wrap: wrap;
		padding-bottom: 1.125rem;
		margin-bottom: 1.25rem;
		border-bottom: 1px solid var(--hydra-border);
	}

	.mi-breadcrumb {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.mi-pills {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.mi-pill-current {
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

	.mi-pill-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--hydra-accent);
		flex-shrink: 0;
	}

	.mi-pill-dot-only {
		width: 0.5625rem;
		height: 0.5625rem;
		border-radius: 50%;
		background: transparent;
		border: 1px solid var(--hydra-border);
	}

	.mi-return {
		margin: 0 0 0.875rem;
	}

	.mi-return a {
		font-size: 0.8125rem;
		color: var(--hydra-muted);
	}

	.mi-context {
		font-size: 0.75rem;
		color: var(--hydra-muted);
		margin: 0 0 0.625rem;
		line-height: 1.5;
	}

	.mi-eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--hydra-accent);
		text-transform: uppercase;
		margin: 0 0 0.625rem;
	}

	.mi-question {
		font-size: 1.5rem;
		font-weight: 700;
		line-height: 1.3;
		margin: 0 0 0.5rem;
		color: var(--hydra-text);
		max-width: 40rem;
	}

	.mi-help {
		font-size: 0.84375rem;
		color: var(--hydra-muted);
		margin: 0 0 1.5rem;
	}

	.mi-board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		align-items: start;
	}

	.mi-lane-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.625rem;
	}

	.mi-lane-dot {
		width: 0.5625rem;
		height: 0.5625rem;
		border-radius: 50%;
		flex-shrink: 0;
		background: var(--hydra-accent);
	}

	.mi-lane-dot-alto {
		opacity: 1;
	}

	.mi-lane-dot-medio {
		opacity: 0.55;
	}

	.mi-lane-dot-baixo {
		opacity: 0.25;
	}

	.mi-lane-dot-dashed {
		background: transparent;
		border: 1.5px dashed var(--hydra-border);
	}

	.mi-lane-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--hydra-muted);
	}

	.mi-lane-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.mi-add-card {
		border: 1px dashed var(--hydra-border);
		border-radius: 0.875rem;
		padding: 0.875rem 1rem;
		box-sizing: border-box;
	}

	.mi-add-trigger {
		width: 100%;
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
		padding: 0.375rem 0;
	}

	.mi-add-subhead {
		font-size: 0.65625rem;
		color: var(--hydra-muted);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin: 0 0 0.5rem;
	}

	.mi-suggestions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.mi-more-toggle {
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.71875rem;
		cursor: pointer;
		font-family: inherit;
		text-decoration: underline;
		margin-bottom: 0.5rem;
		display: block;
		padding: 0;
	}

	.mi-custom-form {
		display: flex;
		gap: 0.375rem;
	}

	.mi-custom-form input {
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

	.mi-custom-ok {
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

	.mi-custom-error {
		margin: 0.375rem 0 0;
		font-size: 0.75rem;
		color: var(--hydra-warning);
	}

	.mi-cancel {
		margin-top: 0.5rem;
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.6875rem;
		cursor: pointer;
		font-family: inherit;
		text-decoration: underline;
		padding: 0;
	}

	.mi-tile {
		border: 1px dashed var(--hydra-border);
		border-radius: 0.875rem;
		padding: 0.875rem 1rem;
	}

	.mi-tile-classified {
		border-style: solid;
		background: var(--hydra-surface);
	}

	.mi-tile-pulse {
		animation: mi-pulse-glow 1.4s ease;
	}

	@keyframes mi-pulse-glow {
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

	.mi-tile-head {
		width: 100%;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.625rem;
		padding: 0;
		text-align: left;
	}

	.mi-tile-label {
		font-size: 0.84375rem;
		font-weight: 600;
		color: var(--hydra-text);
		word-break: break-word;
		min-width: 0;
	}

	.mi-tile-hint {
		font-size: 0.6875rem;
		color: var(--hydra-muted);
		flex-shrink: 0;
	}

	.mi-tile-freq {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.mi-bars {
		display: flex;
		align-items: flex-end;
		gap: 0.125rem;
	}

	.mi-bar {
		width: 3px;
		border-radius: 2px;
		background: transparent;
		border: 1px solid var(--hydra-border);
		height: 6px;
	}

	.mi-bar:nth-child(2) {
		height: 9px;
	}
	.mi-bar:nth-child(3) {
		height: 12px;
	}
	.mi-bar:nth-child(4) {
		height: 15px;
	}

	.mi-bar-filled {
		background: var(--hydra-accent);
		border-color: var(--hydra-accent);
	}

	.mi-freq-label {
		font-size: 0.6875rem;
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.mi-tile-detail {
		margin-top: 0.75rem;
	}

	.mi-tile-detail-label {
		font-size: 0.65625rem;
		color: var(--hydra-muted);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin: 0 0 0.375rem;
	}

	.mi-pill-form {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-bottom: 0.625rem;
	}

	.mi-chip {
		border-radius: var(--hydra-dark-radius, 0.625rem);
		padding: 0.375rem 0.75rem;
		font-size: 0.71875rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-text);
	}

	.mi-chip.selected {
		background: rgba(45, 212, 196, 0.14);
		border-color: rgba(45, 212, 196, 0.55);
		color: #eafffb;
	}

	.mi-remove {
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.71875rem;
		cursor: pointer;
		font-family: inherit;
		text-decoration: underline;
		padding: 0;
	}

	.mi-finish {
		margin-top: 2rem;
	}

	.mi-btn-primary {
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

	@media (max-width: 860px) {
		.mi-board {
			grid-template-columns: 1fr;
		}
	}
</style>
