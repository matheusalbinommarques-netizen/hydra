<script lang="ts">
	let { data } = $props();
	let projectId = $derived(data.view.projectId);
</script>

<svelte:head>
	<title>Documento do projeto</title>
</svelte:head>

<h1>Documento do projeto</h1>
<p class="subtitle">
	Uma visão consolidada do que você já definiu, da Descoberta à Estruturação.
</p>

{#if data.sections.length === 0}
	<p class="empty">Ainda não há respostas suficientes para montar o documento.</p>
{:else}
	<div class="sections">
		{#each data.sections as section (section.phaseId)}
			<section class="phase-section" aria-labelledby={`phase-${section.phaseId}`}>
				<h2 id={`phase-${section.phaseId}`}>{section.phaseLabel}</h2>
				<div class="blocks">
					{#each section.blocks as block (block.activityId)}
						<article class="block">
							<div class="block-header">
								<h3>{block.heading}</h3>
								{#if block.editable}
									<a
										class="edit-link"
										href="/projects/{projectId}/now?activity={block.activityId}&from=summary"
									>
										Editar {block.heading}
									</a>
								{/if}
							</div>
							<p class="value">{block.value}</p>
							{#if block.chips && block.chips.length > 0}
								<ul class="chip-list">
									{#each block.chips as chip (chip)}
										<li class="chip">{chip}</li>
									{/each}
								</ul>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/if}

<style>
	.subtitle {
		color: var(--hydra-muted);
		margin: 0 0 1.5rem;
	}

	.empty {
		color: var(--hydra-muted);
		margin: 0;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		max-width: 42rem;
	}

	.phase-section h2 {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-accent);
	}

	.blocks {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.block {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
	}

	.block-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.block-header h3 {
		margin: 0;
		font-size: 1rem;
	}

	.edit-link {
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.value {
		margin: 0.5rem 0 0;
		overflow-wrap: break-word;
		white-space: pre-wrap;
	}

	.chip-list {
		list-style: none;
		margin: 0.65rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		font-size: 0.8rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		color: var(--hydra-muted);
	}
</style>
