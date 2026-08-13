<script lang="ts">
	let { data } = $props();
	let projectId = $derived(data.view.projectId);
</script>

<svelte:head>
	<title>Documento do projeto</title>
</svelte:head>

<h1>Documento do projeto</h1>
<div class="accent-bar" aria-hidden="true"></div>
<p class="subtitle">
	Uma visão consolidada do que você já definiu, da Descoberta à Estruturação.
</p>
<a class="cta button-secondary" href="/projects/{projectId}/now">Continuar em Agora</a>

{#if data.sections.length === 0}
	<div class="empty-state">
		<p class="empty-title">Ainda não há conteúdo consolidado</p>
		<p class="empty-description">
			Este documento será formado automaticamente conforme você for respondendo às atividades da
			jornada, começando pela Descoberta.
		</p>
	</div>
{:else}
	<article class="document">
		{#each data.sections as section, sectionIndex (section.phaseId)}
			{#if sectionIndex > 0}
				<div class="phase-divider" aria-hidden="true"></div>
			{/if}
			<section aria-labelledby={`phase-${section.phaseId}`}>
				<h2 id={`phase-${section.phaseId}`}>
					<span class="phase-number">{sectionIndex + 1}</span> — {section.phaseLabel}
				</h2>
				{#each section.blocks as block, blockIndex (block.activityId)}
					{#if blockIndex > 0}
						<div class="block-divider" aria-hidden="true"></div>
					{/if}
					<div class="block">
						<div class="block-header">
							<h3>{block.heading}</h3>
							{#if block.editable}
								<a
									class="edit-link"
									aria-label={`Editar ${block.heading}`}
									href="/projects/{projectId}/now?activity={block.activityId}&from=summary"
								>
									Editar
								</a>
							{/if}
						</div>
						{#each block.value.split('\n\n') as paragraph, paragraphIndex (paragraphIndex)}
							<p class="value">{paragraph}</p>
						{/each}
						{#if block.chips && block.chips.length > 0}
							<ul class="chip-list">
								{#each block.chips as chip (chip)}
									<li class="chip">{chip}</li>
								{/each}
							</ul>
						{/if}
						{#if block.evidenceItems && block.evidenceItems.length > 0}
							<div class="evidence-block">
								<p class="evidence-heading">Evidências</p>
								<ul class="evidence-list">
									{#each block.evidenceItems as item, itemIndex (itemIndex)}
										<li class="evidence-item">
											<span class="evidence-group">{item.groupLabel}</span>
											<span class="evidence-outcome">{item.outcomeLabel}</span>
											<span class="evidence-learning">"{item.learning}"</span>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
					</div>
				{/each}
			</section>
		{/each}
	</article>
{/if}

<style>
	.accent-bar {
		width: 40px;
		height: 3px;
		background: var(--hydra-editorial-accent);
		margin: 0 0 var(--space-4);
	}

	.subtitle {
		color: var(--hydra-muted);
		max-width: 42rem;
		line-height: 1.5;
		margin: 0 0 var(--space-5);
	}

	.cta {
		display: inline-block;
		margin-bottom: var(--space-6);
		text-decoration: none;
	}

	.empty-state {
		max-width: 800px;
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		background: var(--hydra-surface);
		padding: 3rem 2rem;
		text-align: center;
	}

	.empty-title {
		margin: 0 0 var(--space-2);
		font-weight: 700;
		font-size: 1.05rem;
	}

	.empty-description {
		margin: 0 auto;
		max-width: 32rem;
		font-size: 0.95rem;
		color: var(--hydra-muted);
		line-height: 1.55;
	}

	.document {
		max-width: 800px;
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		background: var(--hydra-surface-raised);
		box-shadow: var(--hydra-shadow-raised);
		padding: 2.5rem 3rem;
	}

	.phase-divider {
		border-top: 1px solid rgba(101, 104, 108, 0.35);
		margin: var(--space-6) 0;
	}

	.block-divider {
		border-top: 1px solid rgba(101, 104, 108, 0.2);
		margin: var(--space-5) 0;
	}

	h2 {
		margin: 0 0 var(--space-5);
	}

	.phase-number {
		color: var(--hydra-editorial-accent);
	}

	.block-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.block-header h3 {
		flex: 1 1 auto;
		min-width: 12rem;
		margin: 0;
	}

	.edit-link {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-height: 44px;
		font-size: var(--font-size-meta);
		font-weight: 600;
		white-space: nowrap;
	}

	.value {
		margin: var(--space-2) 0 0;
		line-height: 1.65;
		overflow-wrap: break-word;
	}

	.chip-list {
		list-style: none;
		margin: var(--space-3) 0 0;
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
		color: var(--hydra-muted);
	}

	.evidence-block {
		margin: var(--space-4) 0 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--hydra-border);
	}

	.evidence-heading {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.evidence-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.evidence-item {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.5rem;
		font-size: var(--font-size-body);
		line-height: 1.55;
	}

	.evidence-group {
		font-weight: 700;
	}

	.evidence-outcome {
		color: var(--hydra-editorial-accent);
		font-weight: 600;
	}

	.evidence-learning {
		color: var(--hydra-muted);
		overflow-wrap: break-word;
	}

	@media (max-width: 860px) {
		.document {
			max-width: none;
			padding: var(--space-5) var(--space-4);
		}

		.empty-state {
			max-width: none;
			padding: var(--space-6) var(--space-4);
		}
	}
</style>
