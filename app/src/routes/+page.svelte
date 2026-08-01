<script lang="ts">
	import { enhance } from '$app/forms';
	import { projectStatusLabel } from '$lib/project-status-label';
	import type { ProjectListItem } from '$lib/server/application/types';
	import type { ProjectStatus } from '$lib/orientation-engine';

	let { data, form } = $props();

	const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

	function formatDate(iso: string): string {
		const parsed = new Date(iso);
		return Number.isNaN(parsed.getTime()) ? iso : dateFormatter.format(parsed);
	}

	function ctaLabel(project: ProjectListItem): string {
		if (project.nextAction.kind === 'completed') return 'Ver projeto';
		return project.projectStatus === 'rascunho' ? 'Começar projeto' : 'Continuar projeto';
	}

	function nextActionText(project: ProjectListItem): string {
		return project.nextAction.kind === 'activity' ? project.nextAction.label : 'Jornada concluída';
	}

	function badgeClass(status: ProjectStatus): string {
		if (status === 'em_andamento') return 'badge badge-active';
		if (status === 'concluído') return 'badge badge-done';
		return 'badge badge-draft';
	}

	let featuredProject = $derived(data.projects.find((project) => project.projectStatus !== 'concluído'));
</script>

<svelte:head>
	<title>Hydra</title>
</svelte:head>

<div class="home-page">
	<header class="home-header">
		<div class="identity">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
				<path d="M6 2v9c0 3 2.5 5 6 5s6-2 6-5V2M12 16v6" />
			</svg>
			<span class="wordmark-text">Hydra</span>
			<span class="identity-divider" aria-hidden="true"></span>
			<span class="eyebrow">Projetos</span>
		</div>
		<form method="POST" action="?/create" use:enhance>
			<button type="submit" class="cta-accent">Criar nova iniciativa</button>
		</form>
	</header>

	<main class="home-main">
		{#if form?.message}
			<p role="alert">{form.message}</p>
		{/if}

		<div class="page-heading">
			<h1>Seus projetos</h1>
			<p class="subtitle">Acompanhe seus projetos e saiba qual é a próxima ação.</p>
		</div>

		{#if data.projects.length === 0}
			<div class="grid">
				<section class="empty-featured">
					<span class="empty-icon" aria-hidden="true">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 5v14M5 12h14" />
						</svg>
					</span>
					<div>
						<h2>Nenhum projeto ainda</h2>
						<p>Crie sua primeira iniciativa ou importe um projeto existente para começar.</p>
					</div>
					<form method="POST" action="?/create" use:enhance>
						<button type="submit" class="button">Criar nova iniciativa</button>
					</form>
				</section>

				<aside class="sidebar">
					<h3>O que você pode fazer</h3>
					<div class="capabilities">
						<div class="capability">
							<span class="capability-icon" aria-hidden="true">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 5v14M5 12h14" />
								</svg>
							</span>
							<div class="capability-body">
								<p class="capability-title">Criar nova iniciativa</p>
								<p class="capability-desc">Comece do zero com um fluxo guiado.</p>
							</div>
						</div>
						<div class="capability">
							<span class="capability-icon" aria-hidden="true">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
								</svg>
							</span>
							<div class="capability-body">
								<p class="capability-title">Importar projeto</p>
								<p class="capability-desc">Traga um projeto existente em .json.</p>
								<details class="import-details">
									<summary>Selecionar arquivo</summary>
									<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance class="import-form">
										<input aria-label="Arquivo do projeto (.json)" name="file" type="file" accept=".json,application/json" required />
										<button type="submit" class="button-secondary">Importar</button>
									</form>
								</details>
							</div>
						</div>
					</div>
					<div class="sidebar-note">
						<p class="sidebar-note-label">Como o Hydra orienta o trabalho</p>
						<p>Cada projeto avança por próximas ações reais, não por metas abstratas. Você sempre sabe o que fazer em seguida.</p>
					</div>
				</aside>
			</div>

			<section class="project-list-section">
				<h3>Todos os projetos</h3>
				<div class="empty-list-box">
					<p>Você ainda não tem projetos. Comece uma iniciativa para vê-la aqui.</p>
				</div>
			</section>
		{:else}
			<div class="grid" class:grid-solo={!featuredProject}>
				{#if featuredProject}
					<section class="featured" aria-label="Projeto em destaque">
						<p class="eyebrow accent-text">Projeto em destaque</p>
						<h2>{featuredProject.projectName ?? 'Projeto sem nome'}</h2>
						<p class="status-line">
							<span class={badgeClass(featuredProject.projectStatus)}>{projectStatusLabel[featuredProject.projectStatus]}</span>
							<span class="created-at">Criado em {formatDate(featuredProject.createdAt)}</span>
						</p>
						<div class="next-action-block">
							<p class="next-action-label">Próxima ação</p>
							<p class="next-action-value">{nextActionText(featuredProject)}</p>
						</div>
						<div class="featured-cta-row">
							<a class="button" href="/projects/{featuredProject.projectId}/now">{ctaLabel(featuredProject)}</a>
							<a class="overview-link" href="/projects/{featuredProject.projectId}/cockpit">Ver visão geral</a>
						</div>
					</section>
				{/if}

				<aside class="sidebar">
					<h3>O que você pode fazer</h3>
					<div class="capabilities">
						<div class="capability">
							<span class="capability-icon" aria-hidden="true">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 5v14M5 12h14" />
								</svg>
							</span>
							<div class="capability-body">
								<p class="capability-title">Criar nova iniciativa</p>
								<p class="capability-desc">Comece do zero com um fluxo guiado.</p>
							</div>
						</div>
						<div class="capability">
							<span class="capability-icon" aria-hidden="true">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M12 3v12M7 8l5-5 5 5M5 21h14" />
								</svg>
							</span>
							<div class="capability-body">
								<p class="capability-title">Importar projeto</p>
								<p class="capability-desc">Traga um projeto existente em .json.</p>
								<details class="import-details">
									<summary>Selecionar arquivo</summary>
									<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance class="import-form">
										<input aria-label="Arquivo do projeto (.json)" name="file" type="file" accept=".json,application/json" required />
										<button type="submit" class="button-secondary">Importar</button>
									</form>
								</details>
							</div>
						</div>
					</div>
					<div class="sidebar-note">
						<p class="sidebar-note-label">Como o Hydra orienta o trabalho</p>
						<p>Cada projeto avança por próximas ações reais, não por metas abstratas. Você sempre sabe o que fazer em seguida.</p>
					</div>
				</aside>
			</div>

			<section class="project-list-section">
				<h3>Todos os projetos</h3>
				<div class="project-list-box">
					{#each data.projects as project (project.projectId)}
						<div class="project-row">
							<div class="col-name">{project.projectName ?? 'Projeto sem nome'}</div>
							<div class="col-status"><span class={badgeClass(project.projectStatus)}>{projectStatusLabel[project.projectStatus]}</span></div>
							<div class="col-created">Criado em {formatDate(project.createdAt)}</div>
							<div class="col-next"><span class="col-next-label">Próxima ação · </span>{nextActionText(project)}</div>
							<div class="col-cta">
								<a
									class={project.nextAction.kind === 'completed' ? 'button-secondary' : 'button'}
									href="/projects/{project.projectId}/now"
								>
									{ctaLabel(project)}
								</a>
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	/* Tokens locais extraídos do artefato aprovado (Claude Design —
	   "Home Seus Projetos.dc.html"). Escopados a esta rota: não alteram
	   app.css nem afetam outras telas ainda não convergidas. Onde um valor
	   do artefato não corresponde a um token global existente, usa-se o
	   valor direto em vez de forçar a escala antiga (autorizado nesta
	   correção). */
	.home-page {
		--hp-bg: oklch(97.5% 0.006 75);
		--hp-surface: oklch(99% 0.003 75);
		--hp-border: oklch(88% 0.007 75);
		--hp-border-soft: oklch(90% 0.007 75);
		--hp-border-row: oklch(91% 0.007 75);
		--hp-border-dashed: oklch(80% 0.01 60);
		--hp-text: oklch(20% 0.01 60);
		--hp-muted: oklch(48% 0.012 60);
		--hp-muted-strong: oklch(38% 0.012 60);
		--hp-muted-soft: oklch(45% 0.012 60);
		--hp-accent: oklch(42% 0.14 35);
		--hp-accent-hover: oklch(34% 0.14 35);
		--hp-accent-tint: oklch(96% 0.02 35);
		--hp-accent-chip: oklch(93% 0.02 40);
		--hp-done-bg: oklch(93% 0.007 60);
		--hp-done-text: oklch(24% 0.012 60);
		--hp-shadow: 0 1px 2px oklch(20% 0.01 60 / 0.05);
		--hp-radius-lg: 0.625rem;
		--hp-radius: 0.375rem;

		background: var(--hp-bg);
		color: var(--hp-text);
		min-height: 100vh;
	}

	.home-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 4rem;
		padding: 0 2.5rem;
		border-bottom: 1px solid var(--hp-border);
		background: var(--hp-surface);
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.wordmark-text {
		font-family:
			'Source Serif 4',
			Georgia,
			serif;
		font-weight: 700;
		font-size: 1.1875rem;
		letter-spacing: 0.2px;
	}

	.identity-divider {
		width: 1px;
		height: 1.125rem;
		background: var(--hp-border-soft);
	}

	.home-header .eyebrow {
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--hp-muted-soft);
		margin: 0;
	}

	.cta-accent {
		background: var(--hp-accent);
		color: var(--hp-surface);
		border: none;
		border-radius: var(--hp-radius);
		padding: 0.5625rem 1.125rem;
		font-size: 0.84375rem;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}

	.cta-accent:hover {
		background: var(--hp-accent-hover);
	}

	.home-main {
		max-width: 73.75rem;
		margin: 0 auto;
		padding: 2.5rem 2.5rem 4rem;
	}

	.page-heading {
		margin-bottom: 1.75rem;
	}

	.page-heading h1 {
		font-size: 1.625rem;
		margin: 0 0 0.25rem;
	}

	.subtitle {
		color: var(--hp-muted);
		font-size: 0.875rem;
		margin: 0;
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 20rem;
		gap: 1.5rem;
		align-items: start;
	}

	.grid-solo {
		grid-template-columns: minmax(0, 20rem);
	}

	.featured,
	.sidebar,
	.empty-featured {
		min-width: 0;
		background: var(--hp-surface);
		border: 1px solid var(--hp-border);
		border-radius: var(--hp-radius-lg);
	}

	.featured {
		padding: 1.75rem 1.875rem;
		box-shadow: var(--hp-shadow);
	}

	.featured .eyebrow {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin: 0 0 0.625rem;
	}

	.accent-text {
		color: var(--hp-accent);
	}

	.featured h2 {
		font-family:
			'Source Serif 4',
			Georgia,
			serif;
		font-size: 1.5rem;
		font-weight: 600;
		margin: 0 0 0.875rem;
	}

	.status-line {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
		margin: 0 0 1.375rem;
	}

	.next-action-block {
		border-top: 1px solid var(--hp-border-soft);
		padding-top: 1.125rem;
		margin-bottom: 1.5rem;
	}

	.next-action-label {
		font-size: 0.71875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hp-muted);
		margin: 0 0 0.375rem;
	}

	.next-action-value {
		font-size: 0.9375rem;
		margin: 0;
	}

	.featured-cta-row {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		flex-wrap: wrap;
	}

	.featured .button {
		background: var(--hp-text);
		color: var(--hp-surface);
		border-radius: var(--hp-radius);
		padding: 0.6875rem 1.375rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.overview-link {
		font-size: 0.84375rem;
		font-weight: 500;
		color: var(--hp-text);
		text-decoration: none;
	}

	.overview-link:hover {
		text-decoration: underline;
	}

	.sidebar,
	.empty-featured {
		padding: 1.5rem 1.5rem 1.375rem;
	}

	.empty-featured {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
		border-style: dashed;
		border-color: var(--hp-border-dashed);
		padding: 3rem 1.875rem;
	}

	.empty-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--hp-radius);
		background: var(--hp-accent-chip);
		color: var(--hp-accent);
	}

	.empty-featured h2 {
		font-family:
			'Source Serif 4',
			Georgia,
			serif;
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.375rem;
	}

	.empty-featured p {
		color: var(--hp-muted);
		font-size: 0.875rem;
		margin: 0;
		max-width: 32ch;
		line-height: 1.5;
	}

	.empty-featured .button {
		background: var(--hp-text);
		color: var(--hp-surface);
		border-radius: var(--hp-radius);
		padding: 0.6875rem 1.375rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.sidebar h3 {
		font-family:
			'Source Serif 4',
			Georgia,
			serif;
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 1rem;
	}

	.capabilities {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		margin-bottom: 1.25rem;
	}

	.capability {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		border: 1px solid var(--hp-border-soft);
		border-radius: var(--hp-radius);
		padding: 0.75rem 0.875rem;
	}

	.capability-body {
		min-width: 0;
		flex: 1;
	}

	.capability-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		border-radius: var(--hp-radius);
		background: var(--hp-accent-chip);
		color: var(--hp-accent);
	}

	.capability-title {
		font-size: 0.84375rem;
		font-weight: 600;
		margin: 0 0 0.125rem;
	}

	.capability-desc {
		font-size: 0.78125rem;
		color: var(--hp-muted);
		line-height: 1.4;
		margin: 0;
	}

	.import-details summary {
		cursor: pointer;
		font-size: 0.78125rem;
		font-weight: 600;
		color: var(--hp-accent);
		margin-top: 0.5rem;
		list-style: none;
	}

	.import-details summary::-webkit-details-marker {
		display: none;
	}

	.import-details summary::before {
		content: '+ ';
	}

	.import-details[open] summary::before {
		content: '– ';
	}

	.import-details summary:hover {
		color: var(--hp-accent-hover);
	}

	/* display:none por padrão — <details> só revela o conteúdo quando
	   aberto; sem esta regra explícita, o próprio display:flex do formulário
	   sobrepõe o colapso nativo do <details> e o input fica sempre visível. */
	.import-form {
		display: none;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 0.625rem;
	}

	.import-details[open] .import-form {
		display: flex;
	}

	.import-form input {
		font-size: 0.78125rem;
		max-width: 100%;
	}

	.import-form .button-secondary {
		font-size: 0.78125rem;
		font-weight: 600;
		padding: 0.375rem 0.75rem;
		border-radius: var(--hp-radius);
		border-color: var(--hp-border);
		color: var(--hp-text);
	}

	.sidebar-note {
		border-top: 1px solid var(--hp-border-soft);
		padding-top: 1rem;
	}

	.sidebar-note-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hp-accent);
		margin: 0 0 0.375rem;
	}

	.sidebar-note p:last-child {
		font-size: 0.8125rem;
		color: var(--hp-muted-strong);
		line-height: 1.55;
		margin: 0;
	}

	.project-list-section {
		margin-top: 2.25rem;
	}

	.project-list-section h3 {
		font-family:
			'Source Serif 4',
			Georgia,
			serif;
		font-size: 1.1875rem;
		font-weight: 600;
		margin: 0 0 0.875rem;
	}

	.project-list-box {
		background: var(--hp-surface);
		border: 1px solid var(--hp-border);
		border-radius: var(--hp-radius-lg);
		overflow: hidden;
	}

	.empty-list-box {
		background: var(--hp-surface);
		border: 1px solid var(--hp-border);
		border-radius: var(--hp-radius-lg);
		padding: 2.25rem;
		text-align: center;
	}

	.empty-list-box p {
		color: var(--hp-muted);
		font-size: 0.84375rem;
		margin: 0;
	}

	.project-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--hp-border-row);
	}

	.project-row:last-child {
		border-bottom: none;
	}

	.col-name {
		flex: 1 1 13rem;
		min-width: 0;
		font-size: 0.90625rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-status {
		flex: 0 0 auto;
	}

	.col-created {
		flex: 0 0 10rem;
		font-size: 0.78125rem;
		color: var(--hp-muted);
	}

	.col-next {
		flex: 1 1 15rem;
		min-width: 0;
		font-size: 0.8125rem;
		color: var(--hp-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-next-label {
		color: var(--hp-muted);
	}

	.col-cta {
		flex: 0 0 auto;
		margin-left: auto;
	}

	.col-cta a {
		text-decoration: none;
		white-space: nowrap;
		font-size: 0.78125rem;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: var(--hp-radius);
	}

	.col-cta a.button {
		background: var(--hp-text);
		color: var(--hp-surface);
	}

	.col-cta a.button-secondary {
		background: var(--hp-surface);
		color: var(--hp-text);
		border: 1px solid var(--hp-border-dashed);
	}

	.badge {
		font-size: 0.71875rem;
		font-weight: 600;
		border-radius: 100px;
		border: 1px solid;
		padding: 0.1875rem 0.5625rem;
		white-space: nowrap;
	}

	.badge-active {
		color: var(--hp-accent);
		border-color: oklch(42% 0.14 35 / 0.5);
		background: var(--hp-accent-tint);
	}

	.badge-done {
		color: var(--hp-done-text);
		border-color: oklch(24% 0.012 60 / 0.4);
		background: var(--hp-done-bg);
	}

	.badge-draft {
		color: var(--hp-muted);
		border-color: var(--hp-border-dashed);
		background: transparent;
	}

	.created-at {
		color: var(--hp-muted-soft);
		font-size: 0.8125rem;
	}

	[role='alert'] {
		margin-bottom: 1rem;
	}

	@media (max-width: 860px) {
		.home-header {
			height: 3.5rem;
			padding: 0 1rem;
		}

		.wordmark-text {
			font-size: 1rem;
		}

		.cta-accent {
			padding: 0.4375rem 0.75rem;
			font-size: 0.75rem;
		}

		.home-main {
			padding: 1.25rem 1rem 2.5rem;
		}

		.page-heading h1 {
			font-size: 1.25rem;
		}

		.subtitle {
			font-size: 0.8125rem;
		}

		.grid,
		.grid-solo {
			grid-template-columns: minmax(0, 1fr);
		}

		.featured,
		.sidebar,
		.empty-featured {
			padding: 1.125rem 1rem;
		}

		.featured-cta-row {
			flex-direction: column;
			align-items: stretch;
			gap: 0.625rem;
		}

		.featured .button {
			width: 100%;
			text-align: center;
		}

		.overview-link {
			text-align: center;
		}

		.project-list-box {
			border: none;
			background: transparent;
			border-radius: 0;
		}

		.project-row {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
			background: var(--hp-surface);
			border: 1px solid var(--hp-border);
			border-radius: var(--hp-radius-lg);
			padding: 0.875rem;
			margin-bottom: 0.625rem;
		}

		.project-row:last-child {
			margin-bottom: 0;
		}

		.col-name,
		.col-created,
		.col-next {
			white-space: normal;
			overflow: visible;
			text-overflow: clip;
		}

		.col-status {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		.col-cta {
			margin-left: 0;
		}

		.col-cta a {
			display: block;
			text-align: center;
		}
	}
</style>
