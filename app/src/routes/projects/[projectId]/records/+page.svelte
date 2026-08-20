<script lang="ts">
	let { data } = $props();
	let projectId = $derived(data.view.projectId);
</script>

<svelte:head>
	<title>Registros do projeto — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<h1>Registros do projeto</h1>
<p class="subtitle">Respostas registradas e pendências resolvidas ao longo de todo o projeto.</p>

{#snippet eventsSection()}
	<section class="card events" aria-labelledby="events-heading">
		<div class="events-header">
			<h2 id="events-heading">Atividade recente</h2>
			{#if data.recentActivity.filter === null}
				<a class="section-link" href="/projects/{projectId}/records">Ver tudo →</a>
			{/if}
		</div>
		{#if data.recentActivity.filter !== null}
			<!-- Design Gate S7 — chip discreto substitui "Ver tudo →" no estado
			     filtrado: nomeia o objeto observado, o × limpa o filtro na hora
			     (link direto para /records sem query, sem "modo filtro" persistente,
			     sem breadcrumb novo). -->
			<a class="filter-chip" href="/projects/{projectId}/records" aria-label="Limpar filtro: {data.recentActivity.filter.label}">
				<span class="filter-chip-label">Filtrado por "{data.recentActivity.filter.label}"</span>
				<span aria-hidden="true">✕</span>
			</a>
		{/if}
		{#if data.recentActivity.events.length === 0}
			<p class="empty">{data.recentActivity.emptyText}</p>
		{:else}
			<ul class="events-list">
				{#each data.recentActivity.events as event (event.id)}
					<li>
						<p class="event-text">{event.text}</p>
						<p class="event-meta">{new Date(event.createdAt).toLocaleString('pt-BR')}</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/snippet}

{#snippet resolvedSection()}
	<section class="card resolved" aria-labelledby="resolved-heading">
		<h2 id="resolved-heading">Pendências resolvidas</h2>
		{#if data.resolvedPendingItems.length === 0}
			<p class="empty">Nenhuma pendência resolvida ainda.</p>
		{:else}
			<ul class="resolved-list">
				{#each data.resolvedPendingItems as item (item.id)}
					<li>
						<p class="resolved-label">{item.label}</p>
						<p class="resolved-detail">{item.detail}</p>
						<p class="resolved-meta">Atividade: {item.activityTitle} · Resolvida</p>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/snippet}

{#snippet continuitySection()}
	<section class="card continuity" aria-labelledby="continuity-heading">
		<p class="eyebrow" id="continuity-heading">Continuidade</p>
		<a class="continuity-cta" href="/projects/{projectId}/now">Continuar em Agora →</a>
	</section>
{/snippet}

{#if data.phases.length === 0}
	<div class="empty-state card">
		<p class="empty-title">Nenhuma resposta registrada ainda</p>
		<p class="empty-description">
			Conforme as fases forem respondidas em Agora, seus registros passarão a aparecer aqui.
		</p>
	</div>

	{@render eventsSection()}
	{@render resolvedSection()}
	{@render continuitySection()}
{:else}
	<div class="layout">
		<nav class="index" aria-label="Índice de fases">
			<p class="eyebrow">Índice</p>
			<div class="index-list">
				{#each data.phases as phase (phase.phaseId)}
					<a class="index-item" href="#fase-{phase.phaseId}">
						<span>{phase.phaseLabel}</span>
						<span class="index-count">{phase.answerCount}</span>
					</a>
				{/each}
			</div>
		</nav>

		<div class="content">
			{#each data.phases as phase, phaseIndex (phase.phaseId)}
				<section class="card phase-card" id="fase-{phase.phaseId}" aria-labelledby="fase-{phase.phaseId}-heading">
					<h2 id="fase-{phase.phaseId}-heading"><span class="phase-number">{phaseIndex + 1}</span> — {phase.phaseLabel}</h2>
					{#each phase.activities as activity, activityIndex (activity.activityId)}
						{#if activityIndex > 0}
							<div class="activity-divider" aria-hidden="true"></div>
						{/if}
						<div class="activity">
							<h3>{activity.title}</h3>
							{#each activity.fields as field (field.id)}
								<dl>
									<dt>{field.label}</dt>
									<dd>{field.value}</dd>
								</dl>
							{/each}
							{#if activity.editHref !== null}
								<a class="edit-link" aria-label={`Revisar ${activity.title} na atividade`} href={activity.editHref}>
									Revisar na atividade →
								</a>
							{/if}
						</div>
					{/each}
				</section>
			{/each}

			{@render eventsSection()}
			{@render resolvedSection()}
			{@render continuitySection()}
		</div>
	</div>
{/if}

<style>
	.subtitle {
		color: var(--hydra-muted);
		max-width: 44rem;
		line-height: 1.55;
		margin: 0 0 var(--space-5);
	}

	.card {
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		padding: var(--space-5);
		margin-bottom: var(--space-4);
	}

	.eyebrow {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		font-style: italic;
		margin: 0;
	}

	.empty-state {
		text-align: center;
		padding: var(--space-6) var(--space-5);
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

	/* Layout principal — índice à esquerda (consulta rápida, sem depender de
	   rolagem cega), conteúdo à direita. Sticky simples (sem scroll interno
	   próprio, sem JS): o índice acompanha o scroll da página, nunca cria uma
	   segunda área rolável. */
	.layout {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: var(--space-6);
		align-items: start;
	}

	.index {
		position: sticky;
		top: var(--space-5);
	}

	.index-list {
		display: flex;
		flex-direction: column;
	}

	.index-item {
		display: flex;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) 0;
		border-bottom: 1px solid rgba(101, 104, 108, 0.2);
		text-decoration: none;
		color: var(--hydra-text);
		font-size: var(--font-size-meta);
		font-weight: 600;
	}

	.index-item:hover {
		color: var(--hydra-editorial-accent);
	}

	.index-item:last-child {
		border-bottom: none;
	}

	.index-count {
		color: var(--hydra-muted);
		font-weight: 500;
	}

	.content {
		min-width: 0;
	}

	.phase-card h2 {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-subtitle);
	}

	.phase-number {
		color: var(--hydra-editorial-accent);
	}

	.activity-divider {
		border-top: 1px solid rgba(101, 104, 108, 0.15);
		margin: var(--space-4) 0;
	}

	.activity h3 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-caption);
		font-weight: 700;
		color: var(--hydra-muted);
	}

	.activity dl {
		margin: 0;
	}

	.activity dl + dl {
		margin-top: var(--space-3);
	}

	.activity dt {
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
		margin: 0;
	}

	.activity dd {
		margin: var(--space-1) 0 0;
		overflow-wrap: break-word;
		white-space: pre-wrap;
		line-height: 1.55;
	}

	.edit-link {
		display: flex;
		align-items: center;
		margin-top: var(--space-3);
		min-height: 44px;
		font-size: var(--font-size-caption);
		font-weight: 700;
		width: fit-content;
	}

	.section-link {
		font-size: var(--font-size-caption);
		font-weight: 700;
		white-space: nowrap;
	}

	.events-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-3);
		margin-bottom: var(--space-4);
	}

	.events-header h2 {
		margin: 0;
	}

	/* Design Gate S7 — chip discreto do estado filtrado. Sem cor de destaque
	   própria (mesma regra de app.css, "papel/tinta/grafite": accent == text,
	   nenhuma superfície editorial usa uma cor de acento separada) — ink sobre
	   borda neutra, nunca o teal do mockup de referência (aquele bundle é do
	   shell escuro, não desta paleta). overflow-wrap garante que o nome do
	   objeto quebre em vez de cortar ou estourar a largura do card. */
	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 100%;
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius-pill);
		padding: var(--space-1) var(--space-3);
		margin-bottom: var(--space-4);
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		text-decoration: none;
	}

	.filter-chip:hover,
	.filter-chip:focus-visible {
		border-color: var(--hydra-text);
		color: var(--hydra-text);
	}

	.filter-chip-label {
		overflow-wrap: break-word;
	}

	.events-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.events-list li {
		border-bottom: 1px solid rgba(101, 104, 108, 0.15);
		padding-bottom: var(--space-3);
	}

	.events-list li:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	/* Design Gate S7 — anatomia da linha de evento: texto peso normal (a
	   hierarquia vem de ser a primeira informação e do tamanho, não de
	   negrito), timestamp menor/apagado abaixo (.event-meta), hairline entre
	   eventos (.events-list li) — sem card por evento, sem ícone, sem badge,
	   sem avatar. overflow-wrap evita qualquer overflow horizontal em mobile;
	   o texto nunca trunca, só quebra linha. */
	.event-text {
		margin: 0;
		font-weight: 400;
		font-size: var(--font-size-meta);
		overflow-wrap: break-word;
	}

	.event-meta {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.resolved-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.resolved-list li {
		border: 1px dashed rgba(101, 104, 108, 0.35);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
	}

	.resolved-label {
		margin: 0;
		font-weight: 600;
		font-size: var(--font-size-meta);
	}

	.resolved-detail {
		margin: var(--space-1) 0 0;
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		overflow-wrap: break-word;
	}

	.resolved-meta {
		margin: var(--space-2) 0 0;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	/* Continuidade — ponte discreta de volta a Agora, mesmo padrão de
	   /tracking: não deve competir visualmente com o CTA de próxima ação que
	   já vive lá. */
	.continuity {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
		background: var(--hydra-surface);
		margin-bottom: 0;
	}

	.continuity .eyebrow {
		margin: 0;
		font-weight: 700;
		font-size: var(--font-size-body);
		text-transform: none;
		letter-spacing: normal;
		color: var(--hydra-text);
	}

	.continuity-cta {
		font-size: var(--font-size-meta);
		font-weight: 700;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--hydra-radius);
		background: var(--hydra-accent);
		color: var(--hydra-surface);
		text-decoration: none;
		white-space: nowrap;
	}

	.continuity-cta:hover {
		text-decoration: underline;
	}

	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.index {
			position: static;
		}

		.index-item {
			padding: var(--space-3) var(--space-4);
			min-height: 44px;
		}

		.continuity {
			flex-direction: column;
			align-items: stretch;
			text-align: left;
		}

		.continuity-cta {
			text-align: center;
			min-height: 44px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
