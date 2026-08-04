<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let projectId = $derived(data.view.projectId);
	let criteriaScopeConflict = $derived(data.view.criteriaScopeConflict);
	let hasAttention = $derived(
		criteriaScopeConflict.triggered || data.discoveryOpenPendingItems.length > 0
	);
</script>

<svelte:head>
	<title>Revisão e confirmação</title>
</svelte:head>

<div class="review">
	<div class="review-header">
		<p class="context">Fase 1 — Descoberta</p>
		<h1>Revisão e confirmação</h1>
		<p class="explanation">Revise as decisões tomadas nesta fase antes de confirmar e avançar.</p>
	</div>

	<div class="review-body">
		<div class="main-col">
			<h2>Resumo da fase</h2>
			<p class="section-caption">Decisões da Descoberta</p>

			{#if data.overview.length > 0}
				<div class="overview">
					{#each data.overview as block, index (block.activityId)}
						<div class="decision" class:first={index === 0}>
							<span class="marker" aria-hidden="true"></span>
							<h3 class="decision-title">{block.heading}</h3>
							<a
								class="edit-link"
								aria-label={block.editLabel}
								href="/projects/{projectId}/now?activity={block.activityId}&from=summary"
							>
								Editar
							</a>
							<p class="decision-value">{block.value}</p>
							{#if block.chips && block.chips.length > 0}
								<ul class="chip-list">
									{#each block.chips as chip (chip)}
										<li class="chip">{chip}</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty">Ainda não há respostas suficientes para uma visão geral.</p>
			{/if}

			<details class="full-details" open={data.detailsOpenByDefault}>
				<summary>Ver todas as respostas da descoberta</summary>
				<div class="blocks">
					{#each data.blocks as block (block.title)}
						<section class="block">
							<h3>{block.title}</h3>
							{#if block.fields.length > 0}
								<dl>
									{#each block.fields as field (field.label)}
										<dt>{field.label}</dt>
										<dd>{field.value}</dd>
									{/each}
								</dl>
							{:else}
								<p class="empty">Ainda não respondida.</p>
							{/if}
						</section>
					{/each}
				</div>
			</details>
		</div>

		<div class="side-col">
			<section class="attention" class:has-attention={hasAttention} aria-label="Pontos de atenção">
				<h2>Pontos de atenção</h2>
				{#if hasAttention}
					<div class="attention-items">
						{#if criteriaScopeConflict.triggered}
							<div class="attention-item">
								<span aria-hidden="true" class="attention-mark">!</span>
								<p role="alert">{criteriaScopeConflict.message}</p>
							</div>
						{/if}
						{#each data.discoveryOpenPendingItems as item (item.id)}
							<div class="attention-item">
								<span aria-hidden="true" class="attention-mark">•</span>
								<div>
									<strong>{item.label}</strong>
									{#if item.detail}
										<p>{item.detail}</p>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="no-attention">Nenhum ponto de atenção identificado nesta revisão.</p>
				{/if}
			</section>

			<section class="conference">
				<h2>Conferência</h2>
				<ul class="checklist">
					{#each data.checklist as item (item.label)}
						<li>
							<span aria-hidden="true">{item.complete ? '✓' : '○'}</span>
							<span class:complete={item.complete}>{item.label}</span>
						</li>
					{/each}
				</ul>
			</section>
		</div>
	</div>

	<div class="review-footer">
		<div class="footer-text">
			<h2>Confirmar esta fase?</h2>
			<p>Após confirmar, você avançará para a próxima parte da jornada.</p>
			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}
		</div>
		<div class="footer-actions">
			<a class="button-secondary back-link" href="/projects/{projectId}/now">Voltar para edição</a>
			<form method="POST" action="?/confirm" use:enhance>
				<button type="submit">Confirmar e avançar</button>
			</form>
		</div>
	</div>
</div>

<style>
	.review {
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		background: var(--hydra-surface-raised);
		box-shadow: var(--hydra-shadow-raised);
		padding: 2.25rem 2.5rem;
	}

	.review-header {
		padding-bottom: var(--space-5);
		border-bottom: 1px solid rgba(101, 104, 108, 0.25);
		margin-bottom: var(--space-6);
	}

	.context {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-meta);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hydra-editorial-accent);
	}

	.review-header h1 {
		margin: 0 0 var(--space-2);
	}

	.explanation {
		margin: 0;
		max-width: 40rem;
		color: var(--hydra-muted);
	}

	.review-body {
		display: grid;
		grid-template-columns: 3fr 2fr;
		gap: var(--space-7);
		align-items: start;
	}

	.main-col h2,
	.side-col h2 {
		margin: 0 0 0.2rem;
	}

	.section-caption {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	.empty {
		color: var(--hydra-muted);
		margin: 0;
	}

	/* Grade explícita (marcador | conteúdo | ação) em vez de flex + margem —
	   flex alinhava o marcador por uma margem aproximada que não acompanhava
	   de forma confiável a primeira linha do título em todo caso. Cada nó
	   (marcador, título, link Editar, resposta, tags) é um item de grid
	   próprio; resposta e tags recebem grid-column explícito para cair na
	   coluna de conteúdo em vez de seguir o fluxo automático (que as levaria
	   para a coluna do marcador). */
	.decision {
		display: grid;
		grid-template-columns: 14px 1fr auto;
		column-gap: var(--space-3);
		row-gap: 0.3rem;
		padding: var(--space-4) 0;
		border-top: 1px solid rgba(101, 104, 108, 0.2);
	}

	.decision.first {
		padding-top: 0;
		border-top: none;
	}

	.marker {
		grid-column: 1;
		grid-row: 1;
		align-self: start;
		justify-self: start;
		width: 6px;
		height: 6px;
		margin-top: 0.55em;
		border-radius: 2px;
		background: var(--hydra-editorial-accent);
	}

	.decision-title {
		grid-column: 2;
		grid-row: 1;
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--hydra-text);
	}

	.edit-link {
		grid-column: 3;
		grid-row: 1;
		align-self: start;
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-size: var(--font-size-meta);
		font-weight: 600;
		white-space: nowrap;
	}

	.decision-value {
		grid-column: 2;
		margin: 0;
		line-height: 1.6;
		white-space: pre-wrap;
		overflow-wrap: break-word;
	}

	.chip-list {
		grid-column: 2;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chip {
		font-size: var(--font-size-caption);
		padding: 0.2rem var(--space-3);
		border-radius: var(--hydra-radius-pill);
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface);
		color: var(--hydra-muted);
	}

	.full-details {
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid rgba(101, 104, 108, 0.25);
	}

	.full-details summary {
		cursor: pointer;
		font-weight: 700;
		font-size: 0.9rem;
		list-style: revert;
	}

	.full-details summary:focus-visible {
		outline: 2px solid var(--hydra-accent);
		outline-offset: 2px;
	}

	.blocks {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin-top: var(--space-4);
	}

	.block h3 {
		margin: 0 0 var(--space-2);
		font-size: 0.88rem;
	}

	.block dl {
		margin: 0;
	}

	.block dt {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		margin-top: var(--space-2);
	}

	.block dd {
		margin: 0.15rem 0 0;
	}

	.side-col {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.attention {
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		background: var(--hydra-surface);
	}

	.attention.has-attention {
		border-color: var(--hydra-warning);
		background: rgba(139, 50, 39, 0.04);
	}

	.attention-items {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.attention-item {
		display: flex;
		gap: var(--space-2);
	}

	.attention-item p {
		margin: 0.2rem 0 0;
		font-size: 0.87rem;
		line-height: 1.5;
	}

	.attention-item strong {
		font-size: 0.87rem;
	}

	.attention-item p[role='alert'] {
		margin: 0;
		color: var(--hydra-text);
	}

	.attention-mark {
		flex-shrink: 0;
		font-weight: 700;
		color: var(--hydra-warning);
	}

	.no-attention {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.conference {
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		background: var(--hydra-surface);
	}

	.checklist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-size: 0.87rem;
		color: var(--hydra-muted);
	}

	.checklist li {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
	}

	.checklist li .complete {
		color: var(--hydra-text);
	}

	.review-footer {
		margin-top: var(--space-6);
		padding-top: var(--space-5);
		border-top: 1px solid rgba(101, 104, 108, 0.25);
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-6);
	}

	.footer-text {
		flex: 1;
		min-width: 0;
	}

	.footer-text h2 {
		margin: 0 0 var(--space-1);
		font-size: 1rem;
	}

	.footer-text p {
		margin: 0;
		font-size: 0.87rem;
		color: var(--hydra-muted);
	}

	.footer-text p[role='alert'] {
		margin-top: var(--space-3);
		color: var(--hydra-warning);
	}

	.footer-actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-shrink: 0;
	}

	.back-link {
		text-decoration: none;
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	@media (max-width: 860px) {
		.review {
			border-radius: 0;
			padding: var(--space-5) 0;
			border-left: none;
			border-right: none;
		}

		.review-body {
			grid-template-columns: 1fr;
			gap: var(--space-6);
		}

		.review-footer {
			flex-direction: column;
		}

		.footer-text {
			margin-bottom: var(--space-4);
		}

		.footer-actions {
			flex-direction: column;
			align-items: stretch;
			width: 100%;
		}

		.footer-actions form {
			width: 100%;
		}

		.footer-actions button {
			width: 100%;
			box-sizing: border-box;
		}

		.back-link {
			width: 100%;
		}

		/* O link Editar pode cair para uma linha própria sob o título — ainda
		   na coluna de conteúdo, nunca na do marcador, que permanece intocado.
		   Resposta e tags seguem o fluxo automático de grid-column (já
		   definido acima) e caem naturalmente para a próxima linha livre. */
		.decision {
			grid-template-columns: 14px 1fr;
		}

		.edit-link {
			grid-column: 2;
			grid-row: 2;
			justify-self: start;
		}
	}
</style>
