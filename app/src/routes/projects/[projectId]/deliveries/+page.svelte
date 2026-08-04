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
	// Mesmo vocabulário monocromático de ícone já usado por Mapa e Agora
	// (phase-activities/displayStatusIcon) — não introduz cor nova para
	// diferenciar os três grupos, só forma.
	const groupIcon: Record<ExecutionStatus, string> = {
		a_fazer: '○',
		em_andamento: '◐',
		concluido: '●'
	};
</script>

<svelte:head>
	<title>Entregas</title>
</svelte:head>

<h1>Entregas</h1>
<p class="subtitle">Acompanhamento dos itens do foco atual pelos três estados de execução.</p>

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
				<h2 id="{status}-heading">
					<span class="group-icon" aria-hidden="true">{groupIcon[status]}</span>
					{groupLabel[status]}
					<span class="group-count">({data.counts[status]})</span>
				</h2>
				{#if data.groups[status].length === 0}
					<p class="empty-group">Nenhum item neste estado.</p>
				{:else}
					<ul>
						{#each data.groups[status] as item (item.id)}
							<li>
								<span class="item-text">{item.text}</span>
								{#if item.effort}
									<span class="item-meta">Esforço: {effortLabel[item.effort]}</span>
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
											aria-pressed={item.executionStatus === target}
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
	.subtitle {
		color: var(--hydra-muted);
		max-width: 42rem;
		line-height: 1.5;
		margin: 0 0 var(--space-5);
	}

	.empty-state {
		color: var(--hydra-muted);
	}

	.columns {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-5);
		align-items: start;
	}

	/* Coluna = superfície agrupadora, não um quadro delimitado: contorno
	   quase invisível, só o fundo e o espaçamento separam um grupo do
	   outro. O card abaixo é que carrega a borda que se vê de fato. */
	.column {
		border: 1px solid rgba(101, 104, 108, 0.12);
		border-radius: var(--hydra-radius);
		padding: var(--space-5) var(--space-4);
		background: var(--hydra-surface);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.column h2 {
		margin: 0;
		padding-bottom: var(--space-3);
		border-bottom: 1px solid rgba(101, 104, 108, 0.2);
		font-size: var(--font-size-body);
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.group-icon {
		color: var(--hydra-muted);
		font-size: 0.7em;
	}

	.group-count {
		color: var(--hydra-muted);
		font-weight: 400;
		font-size: var(--font-size-meta);
	}

	.column ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	/* Card = principal elemento delimitado do quadro: borda mais leve que a
	   original (cinza translúcido, não preto), mas reforçada por uma sombra
	   discreta (--hydra-shadow-raised) para se destacar da coluna sem
	   precisar de um contorno pesado. */
	.column li {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		box-shadow: var(--hydra-shadow-raised);
		padding: var(--space-4);
		background: var(--hydra-surface-raised);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.item-text {
		font-weight: 600;
		line-height: 1.35;
	}

	.item-meta {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.execution-status-group {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
		border-top: 1px solid rgba(101, 104, 108, 0.15);
		padding-top: var(--space-3);
		margin-top: var(--space-1);
	}

	.execution-status-group button {
		padding: var(--space-2) var(--space-4);
		font-size: var(--font-size-caption);
		font-weight: 500;
		border-radius: var(--hydra-radius-pill);
		min-height: 2.25rem;
		border-color: rgba(101, 104, 108, 0.3);
		color: var(--hydra-muted);
	}

	/* Estado atual: preenchido em vermelho queimado — proposta aprovada no
	   Claude Design. Reaproveita --hydra-editorial-accent (mesmo valor de
	   --hydra-warning), aqui usado para indicar o estado corrente de um
	   controle, não conteúdo derivado/gerado nem destaque puramente
	   decorativo — uso novo do token, sem alterar sua definição em app.css.
	   Não depende só da cor: aria-pressed comunica o estado a leitores de
	   tela, e o peso da fonte também muda. */
	.execution-status-group button.selected {
		background: var(--hydra-editorial-accent);
		color: #fdfcfa;
		border-color: var(--hydra-editorial-accent);
		font-weight: 700;
	}

	.empty-group {
		border: 1px dashed rgba(101, 104, 108, 0.3);
		border-radius: var(--hydra-radius);
		padding: var(--space-6) var(--space-3);
		text-align: center;
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		font-style: italic;
		margin: 0;
	}

	@media (max-width: 860px) {
		.columns {
			grid-template-columns: 1fr;
		}

		.execution-status-group button {
			min-height: 2.75rem;
			padding: 0 var(--space-4);
		}
	}
</style>
