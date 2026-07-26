<script lang="ts">
	let { data } = $props();
	let view = $derived(data.view);

	const effortLabel: Record<string, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' };
</script>

<svelte:head>
	<title>Próximo foco confirmado</title>
</svelte:head>

<h1>Próximo foco confirmado</h1>

{#if !view.scopeVersion.confirmedAt}
	<section class="not-confirmed">
		<p>Este foco ainda não foi confirmado.</p>
		<p><a href="/projects/{view.projectId}/next-version">Ir para Escolha o próximo foco →</a></p>
	</section>
{:else}
	{#if view.scopeProjection.alert.triggered}
		<p role="alert" class="scope-alert">{view.scopeProjection.alert.message}</p>
	{/if}

	<div class="columns">
		<section class="column" aria-labelledby="agora-heading">
			<h2 id="agora-heading">Agora</h2>
			{#if view.scopeProjection.agora.length === 0}
				<p class="empty">Nenhum item.</p>
			{:else}
				<ul>
					{#each view.scopeProjection.agora as item (item.id)}
						<li>
							<span class="item-text">{item.text}</span>
							<span class="item-meta">Tamanho: {effortLabel[item.effort ?? '']}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="column" aria-labelledby="depois-heading">
			<h2 id="depois-heading">Depois</h2>
			{#if view.scopeProjection.depois.length === 0}
				<p class="empty">Nenhum item.</p>
			{:else}
				<ul>
					{#each view.scopeProjection.depois as item (item.id)}
						<li>
							<span class="item-text">{item.text}</span>
							{#if item.effort}
								<span class="item-meta">Tamanho: {effortLabel[item.effort]}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="column" aria-labelledby="fora-heading">
			<h2 id="fora-heading">Fora</h2>
			{#if view.scopeProjection.fora.length === 0}
				<p class="empty">Nenhum item.</p>
			{:else}
				<ul>
					{#each view.scopeProjection.fora as item (item.id)}
						<li>
							<span class="item-text">{item.text}</span>
							{#if item.effort}
								<span class="item-meta">Tamanho: {effortLabel[item.effort]}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<section class="hypothesis" aria-labelledby="hypothesis-heading">
		<h2 id="hypothesis-heading">Hipótese</h2>
		<p>{view.scopeProjection.hypothesis}</p>
	</section>

	<div class="actions">
		<a class="button-primary" href="/projects/{view.projectId}/now">Continuar jornada →</a>
		<a class="secondary-link" href="/projects/{view.projectId}/next-version">Editar foco</a>
	</div>
{/if}

<style>
	.not-confirmed {
		color: var(--hydra-muted);
	}

	.scope-alert {
		border: 1px solid var(--hydra-warning);
		border-radius: 10px;
		padding: 0.85rem 1.1rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.columns {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.column {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem;
		background: var(--hydra-surface);
	}

	.column h2 {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
	}

	.column ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.column li {
		border: 1px solid var(--hydra-border);
		border-radius: 8px;
		padding: 0.6rem 0.75rem;
		background: var(--hydra-surface-raised);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.item-text {
		font-weight: 600;
	}

	.item-meta {
		font-size: 0.8rem;
		color: var(--hydra-muted);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0;
	}

	.hypothesis {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.hypothesis h2 {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
	}

	.hypothesis p {
		margin: 0;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1.25rem;
	}

	.button-primary {
		display: inline-block;
		padding: 0.65rem 1.25rem;
		border-radius: 8px;
		background: var(--hydra-accent);
		color: #f8f8f8;
		font-weight: 700;
		text-decoration: none;
	}

	.secondary-link {
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}
</style>
