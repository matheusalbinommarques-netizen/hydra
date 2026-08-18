<script lang="ts">
	import { enhance } from '$app/forms';
	import type { CheckpointSection } from './discovery-summary-view';

	let { data, form } = $props();
	let projectId = $derived(data.view.projectId);
	let checkpoint = $derived(data.checkpoint);
	let hasFlags = $derived(checkpoint.sections.some((section) => section.flagText));
	let attentionCount = $derived(
		checkpoint.sections.filter((section) => section.flagText).length + (data.criteriaScopeConflict.triggered ? 1 : 0)
	);

	// "Ver mais/Ver menos" da Situação — só quando o texto é longo o
	// suficiente para valer a pena truncar (mesmo limiar do Design Gate).
	let expandedSituacao = $state(false);
	let situacaoSection = $derived(checkpoint.sections.find((section) => section.key === 'situacao'));
	let situacaoIsLong = $derived((situacaoSection?.situacaoText?.length ?? 0) > 240);

	function statusLabel(section: CheckpointSection): string {
		if (section.flagText) return 'Atenção';
		if (section.status === 'pendente') return 'Pendente';
		if (section.status === 'opcional') return 'Opcional';
		return 'Completa';
	}
</script>

<svelte:head>
	<title>Checkpoint da descoberta</title>
</svelte:head>

{#if data.closed}
	<div class="checkpoint-closed">
		<div class="closed-mark" aria-hidden="true">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
				<path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</div>
		<h1>Descoberta concluída</h1>
		<p>O checkpoint foi registrado. O projeto avança para a fase de Definição com o entendimento revisado.</p>
		{#if data.criteriaScopeConflict.triggered}
			<p class="closed-alert" role="alert">{data.criteriaScopeConflict.message}</p>
		{/if}
		<a class="button-secondary" href="/projects/{projectId}/now">Continuar em Agora</a>
	</div>
{:else}
	<div class="checkpoint">
		<div class="checkpoint-header">
			<div class="checkpoint-badge">
				<span class="checkpoint-dot" aria-hidden="true"></span>
				Checkpoint
			</div>
			<p class="eyebrow">Checkpoint da descoberta</p>
			<h1>Confira o que foi entendido antes de avançar</h1>
			<p class="explanation">
				Isso foi montado a partir do que você já respondeu na Descoberta. Revise cada parte, corrija o que estiver
				errado e conclua quando fizer sentido.
			</p>
		</div>

		<div class="checkpoint-body">
			<div class="spine">
				{#each checkpoint.sections as section, index (section.key)}
					<div id="sec-{section.key}" class="spine-row">
						<div class="spine-marker">
							<span class="node" class:done={section.status === 'completa'} class:flagged={!!section.flagText}>
								{#if section.status === 'completa'}
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
										<path
											d="M5 13l4 4L19 7"
											stroke="currentColor"
											stroke-width="3"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{/if}
							</span>
							{#if index < checkpoint.sections.length - 1}
								<span class="node-line" aria-hidden="true"></span>
							{/if}
						</div>

						<div class="card" class:optional={section.status === 'opcional'} class:pending={section.status === 'pendente'} class:flagged={!!section.flagText}>
							<div class="card-header">
								<div class="card-heading">
									<div class="card-eyebrow-row">
										<span class="card-eyebrow">{section.eyebrow}</span>
										{#if section.flagText}
											<span class="badge badge-attention">Ponto de atenção</span>
										{:else if section.status === 'pendente'}
											<span class="badge badge-missing">Pendente</span>
										{:else if section.status === 'opcional'}
											<span class="badge badge-optional">Opcional</span>
										{/if}
									</div>
									<h2>{section.title}</h2>
								</div>
								<a
									class="revisar-link"
									aria-label={`Revisar ${section.eyebrow}`}
									href="/projects/{projectId}/now?activity={section.activityId}&from=summary"
								>
									Revisar
								</a>
							</div>

							{#if section.flagText}
								<div class="flag-note">
									<span class="flag-dot" aria-hidden="true"></span>
									<span>{section.flagText}</span>
								</div>
							{/if}

							{#if section.key === 'situacao'}
								{#if section.situacaoText}
									<div class="situacao-body">
										<p class="situacao-text" class:clamped={!expandedSituacao && situacaoIsLong}>
											{section.situacaoText}
										</p>
										{#if situacaoIsLong}
											<button
												type="button"
												class="toggle-link"
												onclick={() => (expandedSituacao = !expandedSituacao)}
												aria-expanded={expandedSituacao}
											>
												{expandedSituacao ? 'Ver menos' : 'Ver mais'}
											</button>
										{/if}
									</div>
								{:else}
									<p class="empty-hint">Ainda não preenchido.</p>
								{/if}
							{:else if section.key === 'afetados'}
								{#if section.afetadosGroups && section.afetadosGroups.length > 0}
									<p class="section-summary">{section.afetadosSummary}</p>
									<div class="item-list">
										{#each section.afetadosGroups as group (group.label)}
											<div class="item">
												<div class="item-main">
													<span class="item-label">{group.label}</span>
													{#if group.badge}
														<span class="item-pill">{group.badge}</span>
													{/if}
												</div>
												{#if group.note}
													<p class="item-note">{group.note}</p>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<p class="empty-hint">Nenhum grupo mapeado ainda.</p>
								{/if}
							{:else if section.key === 'estado'}
								{#if section.estadoNoTreatment}
									<p class="section-body-text">Hoje não existe um tratamento definido.</p>
								{:else if section.estadoSteps && section.estadoSteps.length > 0}
									<div class="item-list">
										{#each section.estadoSteps as step, stepIndex (stepIndex)}
											<div class="item">
												<span class="item-label">{step.label}</span>
												{#if step.note}
													<p class="item-note">{step.note}</p>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<p class="empty-hint">Ainda não descrito.</p>
								{/if}
							{:else if section.key === 'causas'}
								{#if section.causasStillUnknown}
									<p class="empty-hint italic">Você indicou que ainda não sabe as causas prováveis deste problema.</p>
								{:else if section.causasHypotheses && section.causasHypotheses.length > 0}
									<div class="item-list">
										{#each section.causasHypotheses as hypothesis, hypothesisIndex (hypothesisIndex)}
											<div class="item">
												<span class="item-label">{hypothesis.label}</span>
												{#if hypothesis.note}
													<p class="item-note">{hypothesis.note}</p>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<p class="empty-hint dashed">
										Nenhuma hipótese registrada. Etapa opcional — não bloqueia o fechamento.
									</p>
								{/if}
							{:else if section.key === 'resultado'}
								{#if section.resultadoOutcomes && section.resultadoOutcomes.length > 0}
									<div class="item-list">
										{#each section.resultadoOutcomes as outcome, outcomeIndex (outcomeIndex)}
											<div class="item">
												<span class="item-label">{outcome.label}</span>
												{#if outcome.note}
													<p class="item-note">{outcome.note}</p>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<p class="empty-hint dashed">Ainda não preenchido.</p>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<aside class="rail">
				<div class="rail-panel">
					<p class="rail-label">Status do checkpoint</p>
					<p class="rail-count">
						{checkpoint.requiredDoneCount} de {checkpoint.requiredTotal}
						<span class="rail-count-label">seções obrigatórias completas</span>
					</p>
					<div class="progress-track">
						<div
							class="progress-fill"
							style="width: {(checkpoint.requiredDoneCount / checkpoint.requiredTotal) * 100}%"
						></div>
					</div>

					<div class="status-rows">
						{#each checkpoint.sections as section (section.key)}
							<a href="#sec-{section.key}" class="status-row">
								<span class="status-row-left">
									<span
										class="status-dot"
										class:done={section.status === 'completa' && !section.flagText}
										class:flagged={!!section.flagText}
										class:pending={section.status === 'pendente'}
									></span>
									<span class="status-row-label">{section.eyebrow}</span>
								</span>
								<span
									class="status-row-value"
									class:done={section.status === 'completa' && !section.flagText}
									class:flagged={!!section.flagText}
									class:pending={section.status === 'pendente'}
								>
									{statusLabel(section)}
								</span>
							</a>
						{/each}
					</div>

					{#if hasFlags || data.criteriaScopeConflict.triggered}
						<div class="attention-block">
							<p class="attention-label">Pontos de atenção</p>
							<div class="attention-list">
								{#if data.criteriaScopeConflict.triggered}
									<div class="attention-item">
										<span class="flag-dot" aria-hidden="true"></span>
										<p role="alert">{data.criteriaScopeConflict.message}</p>
									</div>
								{/if}
								{#each checkpoint.sections.filter((section) => section.flagText) as section (section.key)}
									<div class="attention-item">
										<span class="flag-dot" aria-hidden="true"></span>
										<div>
											<p>{section.flagText}</p>
											<a class="attention-link" href="#sec-{section.key}">Revisar</a>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<p class="no-attention">Nenhum ponto de atenção identificado nesta revisão.</p>
					{/if}

					<div class="rail-cta">
						<form method="POST" action="?/confirm" use:enhance>
							<button type="submit" class="confirm-button" disabled={checkpoint.ctaDisabled}>
								Concluir Descoberta e avançar →
							</button>
						</form>
						{#if checkpoint.ctaDisabled}
							<p class="cta-helper" role="status">
								Preencha {checkpoint.missingRequiredTitles.map((title) => `«${title}»`).join(' e ')} para concluir a
								Descoberta.
							</p>
						{:else}
							<p class="cta-ready">O projeto avança para Definição.</p>
						{/if}
						{#if form?.message}
							<p class="cta-error" role="alert">{form.message}</p>
						{/if}
					</div>
				</div>
			</aside>
		</div>

		<div class="mobile-cta-bar">
			<form method="POST" action="?/confirm" use:enhance>
				<button type="submit" class="confirm-button" disabled={checkpoint.ctaDisabled}>
					Concluir Descoberta →
				</button>
			</form>
		</div>
	</div>
{/if}

<style>
	.checkpoint,
	.checkpoint-closed {
		--checkpoint-accent: #2dd4c4;
		--checkpoint-accent-light: #5be9d8;
		--checkpoint-warning: #f5b955;
		--checkpoint-danger: #f97066;
		font-family: var(--hydra-dark-font, inherit);
		color: var(--hydra-dark-text, var(--hydra-text));
	}

	.checkpoint-header {
		max-width: 640px;
		margin-bottom: var(--space-6);
	}

	.checkpoint-badge {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		background: rgba(45, 212, 196, 0.12);
		border: 1px solid rgba(45, 212, 196, 0.45);
		border-radius: var(--hydra-radius-pill);
		padding: 5px 12px 5px 8px;
		font-size: 0.8rem;
		font-weight: 600;
		margin-bottom: var(--space-4);
	}

	.checkpoint-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--checkpoint-accent);
	}

	.eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--checkpoint-accent);
		margin: 0 0 var(--space-3);
	}

	.checkpoint-header h1 {
		font-family: var(--hydra-dark-font, inherit);
		font-size: 1.75rem;
		line-height: 1.25;
		margin: 0 0 var(--space-2);
	}

	.explanation {
		color: var(--hydra-dark-muted, var(--hydra-muted));
		line-height: 1.5;
		margin: 0;
	}

	.checkpoint-body {
		display: flex;
		align-items: flex-start;
		gap: var(--space-7);
	}

	.spine {
		flex: 1 1 auto;
		min-width: 0;
		max-width: 700px;
	}

	.spine-row {
		display: flex;
		gap: var(--space-4);
		margin-bottom: var(--space-4);
	}

	.spine-marker {
		width: 28px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.node {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: 1.5px dashed var(--hydra-dark-muted, var(--hydra-muted));
		color: var(--hydra-dark-bg, #04211f);
	}

	.node.done {
		background: var(--checkpoint-accent);
		border: none;
	}

	.node.flagged {
		box-shadow: 0 0 0 4px rgba(245, 185, 85, 0.22);
	}

	.node-line {
		flex: 1;
		width: 2px;
		min-height: 24px;
		background: var(--hydra-dark-border, var(--hydra-border));
		margin-top: 6px;
	}

	.card {
		flex: 1;
		min-width: 0;
		border-radius: 14px;
		padding: 20px 22px;
		background: var(--hydra-dark-surface, var(--hydra-surface));
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		scroll-margin-top: 24px;
	}

	.card.optional {
		background: rgba(255, 255, 255, 0.02);
		border-style: dashed;
	}

	.card.pending {
		border-color: rgba(249, 112, 102, 0.35);
	}

	.card.flagged {
		border-color: rgba(245, 185, 85, 0.4);
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.card-heading {
		min-width: 0;
	}

	.card-eyebrow-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		margin-bottom: 6px;
	}

	.card-eyebrow {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.card-heading h2 {
		font-family: var(--hydra-dark-font, inherit);
		font-size: 1.05rem;
		margin: 0;
	}

	.badge {
		font-size: 0.65rem;
		font-weight: 700;
		border-radius: var(--hydra-radius-pill);
		padding: 3px 9px;
	}

	.badge-attention {
		background: rgba(245, 185, 85, 0.14);
		border: 1px solid rgba(245, 185, 85, 0.4);
		color: #f0d9ae;
	}

	.badge-missing {
		background: rgba(249, 112, 102, 0.12);
		border: 1px solid rgba(249, 112, 102, 0.4);
		color: #ffb3ab;
	}

	.badge-optional {
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.revisar-link {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 32px;
		padding: 0 var(--space-3);
		border-radius: var(--hydra-radius);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		color: var(--hydra-dark-text, var(--hydra-text));
	}

	.revisar-link:hover {
		border-color: var(--checkpoint-accent);
		color: var(--checkpoint-accent-light);
	}

	.flag-note {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		background: rgba(245, 185, 85, 0.1);
		border: 1px solid rgba(245, 185, 85, 0.3);
		border-radius: var(--hydra-radius);
		padding: 10px 12px;
		margin: 10px 0 var(--space-3);
		font-size: 0.8rem;
		line-height: 1.5;
		color: #f0d9ae;
	}

	.flag-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--checkpoint-warning);
		flex-shrink: 0;
		margin-top: 5px;
	}

	.situacao-body {
		margin-top: 6px;
	}

	.situacao-text {
		font-size: 0.9rem;
		color: var(--hydra-dark-text-soft, var(--hydra-text));
		line-height: 1.6;
		margin: 0;
		white-space: pre-wrap;
	}

	.situacao-text.clamped {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.toggle-link {
		background: none;
		border: none;
		padding: 0;
		margin-top: 6px;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--checkpoint-accent-light);
		cursor: pointer;
		font-family: inherit;
		text-decoration: underline;
	}

	.section-summary {
		font-size: 0.75rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		margin: 8px 0 10px;
	}

	.section-body-text {
		font-size: 0.875rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		line-height: 1.55;
		margin: 8px 0 0;
	}

	.item-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: 8px;
	}

	.item {
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: 10px;
		padding: 10px 14px;
		background: rgba(255, 255, 255, 0.02);
	}

	.item-main {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.item-label {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.item-pill {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: var(--hydra-radius-pill);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.item-note {
		margin: 4px 0 0;
		font-size: 0.78rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		line-height: 1.5;
	}

	.empty-hint {
		font-size: 0.8rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		margin: 8px 0 0;
	}

	.empty-hint.italic {
		font-style: italic;
	}

	.empty-hint.dashed {
		border: 1px dashed var(--hydra-dark-border, var(--hydra-border));
		border-radius: 8px;
		padding: 12px 14px;
	}

	.rail {
		width: 340px;
		flex-shrink: 0;
		position: sticky;
		top: 24px;
	}

	.rail-panel {
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		background: var(--hydra-dark-surface-raised, var(--hydra-surface-raised));
		border-radius: 16px;
		padding: 22px;
	}

	.rail-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		margin: 0 0 14px;
	}

	.rail-count {
		font-size: 1.35rem;
		font-weight: 700;
		margin: 0 0 4px;
	}

	.rail-count-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.progress-track {
		height: 6px;
		border-radius: var(--hydra-radius-pill);
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
		margin: 10px 0 18px;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--checkpoint-accent), #0891b2);
		border-radius: var(--hydra-radius-pill);
		transition: width 0.3s ease;
	}

	.status-rows {
		display: flex;
		flex-direction: column;
		margin-bottom: var(--space-2);
	}

	.status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 9px 4px;
		text-decoration: none;
		border-bottom: 1px solid var(--hydra-dark-border, var(--hydra-border));
		color: inherit;
	}

	.status-row-left {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--hydra-dark-border, var(--hydra-border));
		flex-shrink: 0;
	}

	.status-dot.done {
		background: var(--checkpoint-accent);
	}

	.status-dot.pending {
		background: var(--checkpoint-danger);
	}

	.status-dot.flagged {
		background: var(--checkpoint-warning);
	}

	.status-row-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--hydra-dark-text-soft, var(--hydra-text));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.status-row-value {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		white-space: nowrap;
	}

	.status-row-value.done {
		color: var(--checkpoint-accent-light);
	}

	.status-row-value.pending {
		color: var(--checkpoint-danger);
	}

	.status-row-value.flagged {
		color: var(--checkpoint-warning);
	}

	.attention-block {
		border-top: 1px solid var(--hydra-dark-border, var(--hydra-border));
		margin-top: 12px;
		padding-top: 14px;
	}

	.attention-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--checkpoint-warning);
		margin: 0 0 10px;
	}

	.attention-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.attention-item {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
	}

	.attention-item p {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--hydra-dark-text-soft, var(--hydra-text));
	}

	.attention-link {
		font-size: 0.75rem;
		color: var(--checkpoint-accent-light);
		margin-left: 15px;
	}

	.no-attention {
		font-size: 0.8rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		margin: var(--space-2) 0 0;
	}

	.rail-cta {
		border-top: 1px solid var(--hydra-dark-border, var(--hydra-border));
		margin-top: var(--space-4);
		padding-top: var(--space-4);
	}

	.rail-cta form {
		margin: 0;
	}

	.confirm-button {
		width: 100%;
		min-height: 44px;
		border: none;
		border-radius: var(--hydra-radius);
		background: linear-gradient(90deg, #22d3c5, #0891b2);
		color: #04211f;
		font-weight: 700;
		cursor: pointer;
	}

	.confirm-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.cta-helper,
	.cta-ready {
		font-size: 0.75rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		margin: 10px 0 0;
		line-height: 1.5;
	}

	.cta-error {
		font-size: 0.8rem;
		color: var(--checkpoint-danger);
		margin: var(--space-2) 0 0;
	}

	.mobile-cta-bar {
		display: none;
	}

	.checkpoint-closed {
		min-height: 60vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 60px var(--space-5);
		text-align: center;
	}

	.checkpoint-closed .closed-mark {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: rgba(45, 212, 196, 0.14);
		border: 1px solid rgba(45, 212, 196, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto var(--space-5);
		color: var(--checkpoint-accent-light);
	}

	.checkpoint-closed h1 {
		font-size: 1.6rem;
		margin: 0 0 var(--space-2);
	}

	.checkpoint-closed p {
		max-width: 440px;
		margin: 0 auto var(--space-6);
		color: var(--hydra-dark-muted, var(--hydra-muted));
		line-height: 1.55;
	}

	.checkpoint-closed p.closed-alert {
		margin-top: calc(var(--space-6) * -1 + var(--space-3));
		color: var(--checkpoint-warning);
		font-weight: 600;
	}

	@media (max-width: 860px) {
		.checkpoint-body {
			flex-direction: column;
			gap: var(--space-5);
		}

		.spine {
			max-width: none;
			width: 100%;
		}

		.rail {
			width: 100%;
			position: static;
		}

		.rail-cta {
			display: none;
		}

		.mobile-cta-bar {
			display: block;
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--hydra-dark-surface-raised, var(--hydra-surface-raised));
			border-top: 1px solid var(--hydra-dark-border, var(--hydra-border));
			padding: 14px 20px;
			box-sizing: border-box;
			z-index: 20;
		}

		.mobile-cta-bar form {
			margin: 0;
		}

		.checkpoint {
			padding-bottom: 80px;
		}
	}
</style>
