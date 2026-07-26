<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let projectId = $derived(data.view.projectId);
	let criteriaScopeConflict = $derived(data.view.criteriaScopeConflict);
</script>

<svelte:head>
	<title>Resumo da descoberta</title>
</svelte:head>

<h1>Resumo da descoberta</h1>
<p>Revise o que entendemos até aqui antes de avançar.</p>

{#if criteriaScopeConflict.triggered}
	<p role="alert" class="scope-alert">{criteriaScopeConflict.message}</p>
{/if}

{#if data.overview.length > 0}
	<div class="overview">
		{#each data.overview as block (block.activityId)}
			<section class="overview-block">
				<div class="overview-header">
					<h2>{block.heading}</h2>
					<a class="edit-link" href="/projects/{projectId}/now?activity={block.activityId}&from=summary">
						{block.editLabel}
					</a>
				</div>
				<p class="overview-value">{block.value}</p>
				{#if block.chips && block.chips.length > 0}
					<ul class="chip-list">
						{#each block.chips as chip (chip)}
							<li class="chip">{chip}</li>
						{/each}
					</ul>
				{/if}
			</section>
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
				<h2>{block.title}</h2>
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

<ul class="checklist">
	{#each data.checklist as item (item.label)}
		<li class:complete={item.complete}>
			<span aria-hidden="true">{item.complete ? '✓' : '○'}</span>
			{item.label}
		</li>
	{/each}
</ul>

<form method="POST" action="?/confirm" use:enhance>
	<button type="submit">Confirmar resumo</button>
</form>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

<style>
	.empty {
		color: var(--hydra-muted);
		margin: 0;
	}

	.scope-alert {
		border: 1px solid var(--hydra-warning);
		border-radius: 10px;
		padding: 0.85rem 1.1rem;
		background: var(--hydra-surface);
		margin: 1rem 0 0;
	}

	.overview {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 1.5rem 0;
	}

	.overview-block {
		border: 1px solid var(--hydra-accent);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface-raised);
	}

	.overview-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.overview-header h2 {
		margin: 0;
		font-size: 1rem;
	}

	.edit-link {
		font-size: 0.85rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.overview-value {
		margin: 0.5rem 0 0;
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
		background: var(--hydra-surface);
		color: var(--hydra-muted);
	}

	.full-details {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 0.85rem 1.1rem;
		background: var(--hydra-surface);
		margin: 1.5rem 0;
	}

	.full-details summary {
		cursor: pointer;
		font-weight: 600;
		list-style: revert;
	}

	.full-details summary:focus-visible {
		outline: 2px solid var(--hydra-accent);
		outline-offset: 2px;
	}

	.blocks {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-top: 1rem;
	}

	.block {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface-raised);
	}

	.block h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	dl {
		margin: 0;
	}

	dt {
		font-size: 0.8rem;
		color: var(--hydra-muted);
		margin-top: 0.5rem;
	}

	dd {
		margin: 0.15rem 0 0;
	}

	.checklist {
		list-style: none;
		margin: 1.5rem 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.9rem;
		color: var(--hydra-muted);
	}

	.checklist li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.checklist li.complete {
		color: var(--hydra-text);
	}
</style>
