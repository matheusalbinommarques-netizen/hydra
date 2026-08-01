<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
	let projectId = $derived(data.view.projectId);

	const effortLabel: Record<string, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' };

	type ExecutionStatus = 'a_fazer' | 'em_andamento' | 'concluido';
	const EXECUTION_STATUSES: ExecutionStatus[] = ['a_fazer', 'em_andamento', 'concluido'];
	const groupLabel: Record<ExecutionStatus, string> = {
		a_fazer: 'A fazer',
		em_andamento: 'Em andamento',
		concluido: 'Concluído'
	};
</script>

<svelte:head>
	<title>Entregas</title>
</svelte:head>

<h1>Entregas</h1>

{#if !data.confirmed}
	<section class="empty-state">
		<p>Ainda não há um foco confirmado para acompanhar.</p>
		<p>Defina e confirme o próximo foco para começar a acompanhar a execução aqui.</p>
		<p><a href="/projects/{projectId}/next-version">Ir para Escolha o próximo foco →</a></p>
	</section>
{:else if data.counts.a_fazer + data.counts.em_andamento + data.counts.concluido === 0}
	<section class="empty-state">
		<p>O foco atual não tem itens em "Agora" para acompanhar.</p>
		<p><a href="/projects/{projectId}/next-version">Editar foco →</a></p>
	</section>
{:else}
	<div class="columns">
		{#each EXECUTION_STATUSES as status (status)}
			<section class="column" aria-labelledby="{status}-heading">
				<h2 id="{status}-heading">{groupLabel[status]} ({data.counts[status]})</h2>
				{#if data.groups[status].length === 0}
					<p class="empty">Nenhum item.</p>
				{:else}
					<ul>
						{#each data.groups[status] as item (item.id)}
							<li>
								<span class="item-text">{item.text}</span>
								{#if item.effort}
									<span class="item-meta">Tamanho: {effortLabel[item.effort]}</span>
								{/if}
								<form method="POST" action="?/setExecutionStatus" use:enhance class="execution-status-group">
									<input type="hidden" name="itemId" value={item.id} />
									{#each EXECUTION_STATUSES as target (target)}
										<button
											type="submit"
											name="status"
											value={target}
											class="button-secondary"
											class:selected={item.executionStatus === target}
										>
											{groupLabel[target]}
										</button>
									{/each}
								</form>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		color: var(--hydra-muted);
	}

	.columns {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
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

	.execution-status-group {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.execution-status-group button {
		padding: 0.35rem 0.7rem;
		font-size: 0.8rem;
	}

	.execution-status-group button.selected {
		background: var(--hydra-accent);
		color: #f8f8f8;
		border-color: var(--hydra-accent);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0;
	}
</style>
