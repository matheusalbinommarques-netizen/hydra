<script lang="ts">
	let { data } = $props();

	const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
		dateStyle: 'short',
		timeStyle: 'short'
	});

	function formatDate(iso: string): string {
		const parsed = new Date(iso);
		return Number.isNaN(parsed.getTime()) ? iso : dateFormatter.format(parsed);
	}
</script>

<svelte:head>
	<title>Registros</title>
</svelte:head>

<h1>Registros</h1>
<p class="subtitle">Respostas registradas e pendências do projeto.</p>

<section aria-labelledby="respostas-heading">
	<h2 id="respostas-heading">Respostas</h2>

	{#if data.phases.length === 0}
		<p class="empty">Nenhuma resposta registrada ainda.</p>
	{:else}
		<div class="phases">
			{#each data.phases as phase (phase.phaseId)}
				<div class="phase-group">
					<h3>{phase.phaseLabel}</h3>
					{#each phase.activities as activity (activity.activityId)}
						<div class="activity-group">
							<h4>{activity.title}</h4>
							<dl>
								{#each activity.fields as field (field.id)}
									<dt>{field.label}</dt>
									<dd>{field.value}</dd>
								{/each}
							</dl>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</section>

<section aria-labelledby="pendencias-abertas-heading">
	<h2 id="pendencias-abertas-heading">Pendências abertas</h2>

	{#if data.openPendingItems.length === 0}
		<p class="empty">Nenhuma pendência aberta.</p>
	{:else}
		<ul class="pending-list">
			{#each data.openPendingItems as item (item.id)}
				<li>
					<strong>{item.label}</strong>
					<p class="detail">{item.detail}</p>
					<p class="meta">
						Atividade: {item.activityTitle} · Status: Aberta · Criada em {formatDate(item.createdAt)}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="pendencias-resolvidas-heading">
	<h2 id="pendencias-resolvidas-heading">Pendências resolvidas</h2>

	{#if data.resolvedPendingItems.length === 0}
		<p class="empty">Nenhuma pendência resolvida.</p>
	{:else}
		<ul class="pending-list">
			{#each data.resolvedPendingItems as item (item.id)}
				<li>
					<strong>{item.label}</strong>
					<p class="detail">{item.detail}</p>
					<p class="meta">
						Atividade: {item.activityTitle} · Status: Resolvida · Criada em {formatDate(item.createdAt)}
						{#if item.resolvedAt}
							· Resolvida em {formatDate(item.resolvedAt)}
						{/if}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.subtitle {
		color: var(--hydra-muted);
		margin-bottom: 1.5rem;
	}

	section {
		margin-bottom: 2rem;
	}

	section h2 {
		font-size: 1rem;
		margin: 0 0 0.75rem;
	}

	.empty {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0;
	}

	.phases {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.phase-group {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
	}

	.phase-group h3 {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
	}

	.activity-group + .activity-group {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--hydra-border);
	}

	.activity-group h4 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: var(--hydra-muted);
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
		overflow-wrap: break-word;
		white-space: pre-wrap;
	}

	.pending-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.pending-list li {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 0.85rem 1.1rem;
		background: var(--hydra-surface);
	}

	.pending-list .detail {
		margin: 0.35rem 0 0;
		color: var(--hydra-muted);
		overflow-wrap: break-word;
	}

	.pending-list .meta {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--hydra-muted);
	}
</style>
