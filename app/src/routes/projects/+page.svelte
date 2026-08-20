<script lang="ts">
	import { projectStatusLabel } from '$lib/project-status-label';
	import type { ProjectListItem } from '$lib/server/application/types';
	import type { ProjectStatus } from '$lib/orientation-engine';

	let { data } = $props();

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

	type FilterKey = 'all' | ProjectStatus;

	const filterDefs: { key: FilterKey; label: string }[] = [
		{ key: 'all', label: 'Todos' },
		{ key: 'rascunho', label: 'Rascunho' },
		{ key: 'em_andamento', label: 'Em andamento' },
		{ key: 'concluído', label: 'Concluído' }
	];

	let query = $state('');
	let filter = $state<FilterKey>('all');

	let counts = $derived.by(() => {
		const result: Record<FilterKey, number> = { all: data.projects.length, rascunho: 0, em_andamento: 0, concluído: 0 };
		for (const project of data.projects) {
			result[project.projectStatus]++;
		}
		return result;
	});

	let filteredProjects = $derived.by(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return data.projects.filter((project: ProjectListItem) => {
			if (filter !== 'all' && project.projectStatus !== filter) return false;
			if (normalizedQuery && !(project.projectName ?? 'Projeto sem nome').toLowerCase().includes(normalizedQuery)) return false;
			return true;
		});
	});

	function clearSearch() {
		query = '';
		filter = 'all';
	}
</script>

<svelte:head>
	<title>Biblioteca de projetos — Hydra</title>
</svelte:head>

<div class="library-page hydra-dark-tokens">
	<header class="library-header">
		<div class="identity">
			<a class="wordmark-link" href="/">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
					<path d="M6 2v9c0 3 2.5 5 6 5s6-2 6-5V2M12 16v6" />
				</svg>
				<span class="wordmark-text">Hydra</span>
			</a>
			<span class="identity-divider" aria-hidden="true"></span>
			<a class="eyebrow" href="/projects" aria-current="page">Projetos</a>
		</div>
		<a class="cta-accent" href="/projects/new">Criar nova iniciativa</a>
	</header>

	<main class="library-main">
		<div class="page-heading">
			<h1>Biblioteca de projetos</h1>
			<p class="subtitle">Encontre qualquer projeto em um só lugar.</p>
		</div>

		{#if data.projects.length === 0}
			<div class="empty-box">
				<span class="empty-icon" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M12 5v14M5 12h14" />
					</svg>
				</span>
				<div>
					<h2>Nenhum projeto ainda</h2>
					<p>Crie uma iniciativa ou importe um projeto para começar.</p>
				</div>
				<a class="button" href="/">Voltar para Projetos</a>
			</div>
		{:else}
			<div class="toolbar">
				<div class="search-box">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<circle cx="11" cy="11" r="7" />
						<path d="M21 21l-4.35-4.35" />
					</svg>
					<input aria-label="Buscar projetos" placeholder="Buscar projetos..." bind:value={query} />
				</div>

				<div class="filters">
					{#each filterDefs as def (def.key)}
						<button
							type="button"
							class="filter-chip"
							class:filter-chip-active={filter === def.key}
							aria-pressed={filter === def.key}
							onclick={() => (filter = def.key)}
						>
							{def.label}
							<span class="filter-count" class:filter-count-active={filter === def.key}>{counts[def.key]}</span>
						</button>
					{/each}
				</div>
			</div>

			{#if filteredProjects.length === 0}
				<div class="empty-box">
					<span class="empty-icon empty-icon-muted" aria-hidden="true">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="11" cy="11" r="7" />
							<path d="M21 21l-4.35-4.35" />
						</svg>
					</span>
					<div>
						<h2>Nenhum projeto encontrado</h2>
						<p>Tente outro nome ou limpe os filtros.</p>
					</div>
					<button type="button" class="link-button" onclick={clearSearch}>Limpar busca e filtros</button>
				</div>
			{:else}
				<div class="project-table">
					<div class="table-head">
						<div class="col-name">Projeto</div>
						<div class="col-status">Estado</div>
						<div class="col-created">Criado em</div>
						<div class="col-next">Próxima ação</div>
						<div class="col-cta">Ação</div>
					</div>
					{#each filteredProjects as project (project.projectId)}
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
			{/if}
		{/if}
	</main>
</div>

<style>
	/* Identidade dark aprovada (Design Gate "Convergência Visual", S6V) —
	   mesmo reskin de routes/+page.svelte (Home): tokens locais `--lp-*`
	   escopados a esta rota, lendo de `--hydra-dark-*` (app.css, ETAPA 1)
	   onde o valor já é comprovadamente igual; hierarquia mais densa que a
	   Home (tabela, chips de filtro) continua com valores próprios. Nenhuma
	   capacidade (busca, filtros, contagens, lista, estados, criação,
	   navegação) muda — só a cor. */
	.library-page {
		--lp-bg: var(--hydra-dark-bg);
		--lp-surface: var(--hydra-dark-surface-raised);
		--lp-surface-muted: var(--hydra-dark-surface);
		--lp-border: var(--hydra-dark-border);
		--lp-border-soft: rgba(255, 255, 255, 0.06);
		--lp-border-row: rgba(255, 255, 255, 0.06);
		--lp-border-dashed: rgba(255, 255, 255, 0.14);
		--lp-text: var(--hydra-dark-text-soft);
		--lp-text-strong: var(--hydra-dark-text);
		--lp-muted: #6f8ba0;
		--lp-muted-strong: var(--hydra-dark-muted);
		--lp-accent: var(--hydra-dark-accent);
		--lp-accent-light: var(--hydra-dark-accent-light);
		--lp-accent-hover: var(--hydra-dark-accent-light);
		--lp-accent-tint: var(--hydra-dark-accent-tint);
		--lp-accent-tint-strong: var(--hydra-dark-accent-tint-strong);
		--lp-accent-border: rgba(45, 212, 196, 0.5);
		--lp-on-accent: #04211f;
		--lp-done-bg: rgba(255, 255, 255, 0.05);
		--lp-done-text: var(--hydra-dark-text-soft);
		--lp-chip-bg: rgba(255, 255, 255, 0.05);
		--lp-radius-lg: 16px;
		--lp-radius: 10px;

		background: var(--lp-bg);
		color: var(--lp-text);
		min-height: 100vh;
		font-family: var(--hydra-dark-font);
	}

	.library-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 4rem;
		padding: 0 2.5rem;
		border-bottom: 1px solid var(--lp-border);
		background: var(--lp-surface);
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.wordmark-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: inherit;
		text-decoration: none;
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
		background: var(--lp-border-soft);
	}

	.library-header .eyebrow {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--lp-text);
		margin: 0;
		text-decoration: none;
	}

	.library-header .eyebrow:hover {
		text-decoration: underline;
	}

	.cta-accent {
		display: inline-flex;
		align-items: center;
		background: var(--lp-accent);
		color: var(--lp-on-accent);
		border: none;
		border-radius: var(--lp-radius);
		padding: 0.5625rem 1.125rem;
		font-size: 0.84375rem;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		font-family: inherit;
	}

	.cta-accent:hover {
		background: var(--lp-accent-hover);
	}

	.library-main {
		max-width: 73.75rem;
		margin: 0 auto;
		padding: 2.5rem 2.5rem 4rem;
	}

	.page-heading {
		margin-bottom: 1.5rem;
	}

	.page-heading h1 {
		font-size: 1.625rem;
		margin: 0 0 0.25rem;
	}

	.subtitle {
		color: var(--lp-muted);
		font-size: 0.875rem;
		margin: 0;
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		flex-wrap: wrap;
		margin-bottom: 1.125rem;
	}

	.search-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--lp-surface);
		border: 1px solid var(--lp-border);
		border-radius: var(--lp-radius);
		padding: 0 0.875rem;
		height: 2.5rem;
		width: 20rem;
		max-width: 100%;
		color: var(--lp-muted);
	}

	.search-box input {
		border: none;
		outline: none;
		background: transparent;
		font-family: inherit;
		font-size: 0.84375rem;
		color: var(--lp-text);
		width: 100%;
	}

	.filters {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.filter-chip {
		font-family: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0.5rem 0.875rem;
		border-radius: var(--hydra-radius-pill, 999px);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		white-space: nowrap;
		background: var(--lp-surface);
		color: var(--lp-muted-strong);
		border: 1px solid var(--lp-border-soft);
	}

	.filter-chip-active {
		background: var(--lp-accent-tint-strong);
		color: var(--lp-accent-light);
		border-color: var(--lp-accent-border);
	}

	.filter-count {
		font-size: 0.71875rem;
		font-weight: 600;
		background: var(--lp-chip-bg);
		color: var(--lp-muted-strong);
		padding: 0.0625rem 0.375rem;
		border-radius: var(--hydra-radius-pill, 999px);
	}

	.filter-count-active {
		background: rgba(255, 255, 255, 0.14);
		color: var(--lp-accent-light);
	}

	.project-table {
		background: var(--lp-surface);
		border: 1px solid var(--lp-border);
		border-radius: var(--lp-radius-lg);
		overflow: hidden;
	}

	.table-head {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0.6875rem 1.5rem;
		border-bottom: 1px solid var(--lp-border);
		background: var(--lp-surface-muted);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--lp-muted);
	}

	.project-row {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0.8125rem 1.5rem;
		border-bottom: 1px solid var(--lp-border-row);
	}

	.project-row:last-child {
		border-bottom: none;
	}

	.col-name {
		flex: 1 1 15rem;
		min-width: 0;
		font-size: 0.90625rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.table-head .col-name {
		font-size: 0.6875rem;
		font-weight: 600;
	}

	.col-status {
		flex: 0 0 8.125rem;
	}

	.col-created {
		flex: 0 0 9.375rem;
		font-size: 0.78125rem;
		color: var(--lp-muted);
	}

	.table-head .col-created {
		font-size: 0.6875rem;
		color: var(--lp-muted);
	}

	.col-next {
		flex: 1 1 16.25rem;
		min-width: 0;
		font-size: 0.8125rem;
		color: var(--lp-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.col-next-label {
		color: var(--lp-muted);
	}

	.col-cta {
		flex: 0 0 8.75rem;
		text-align: right;
	}

	.col-cta a {
		text-decoration: none;
		white-space: nowrap;
		font-size: 0.78125rem;
		font-weight: 600;
		padding: 0.5rem 1rem;
		border-radius: var(--lp-radius);
	}

	.col-cta a.button {
		background: var(--lp-accent);
		color: var(--lp-on-accent);
	}

	.col-cta a.button-secondary {
		background: var(--lp-surface);
		color: var(--lp-text);
		border: 1px solid var(--lp-border-dashed);
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
		color: var(--lp-accent-light);
		border-color: var(--lp-accent-border);
		background: var(--lp-accent-tint);
	}

	.badge-done {
		color: var(--lp-done-text);
		border-color: var(--lp-border-dashed);
		background: var(--lp-done-bg);
	}

	.badge-draft {
		color: var(--lp-muted);
		border-color: var(--lp-border-dashed);
		background: transparent;
	}

	.empty-box {
		background: var(--lp-surface);
		border: 1px dashed var(--lp-border-dashed);
		border-radius: var(--lp-radius-lg);
		padding: 3.5rem 1.875rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1rem;
	}

	.empty-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--lp-radius);
		background: var(--lp-accent-chip);
		color: var(--lp-accent);
	}

	.empty-icon-muted {
		background: var(--lp-chip-bg);
		color: var(--lp-muted);
	}

	.empty-box h2 {
		font-family:
			'Source Serif 4',
			Georgia,
			serif;
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.375rem;
	}

	.empty-box p {
		color: var(--lp-muted);
		font-size: 0.875rem;
		margin: 0;
		max-width: 32ch;
		line-height: 1.5;
	}

	.empty-box .button {
		background: var(--lp-accent);
		color: var(--lp-on-accent);
		text-decoration: none;
		border-radius: var(--lp-radius);
		padding: 0.6875rem 1.375rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.link-button {
		font-family: inherit;
		background: none;
		border: none;
		padding: 0;
		font-size: 0.84375rem;
		font-weight: 600;
		color: var(--lp-accent);
		cursor: pointer;
		text-decoration: underline;
	}

	.link-button:hover {
		color: var(--lp-accent-hover);
	}

	@media (max-width: 860px) {
		.library-header {
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

		.library-main {
			padding: 1.25rem 1rem 2.5rem;
		}

		.page-heading h1 {
			font-size: 1.25rem;
		}

		.subtitle {
			font-size: 0.8125rem;
		}

		.search-box {
			width: 100%;
		}

		.project-table {
			border: none;
			background: transparent;
			border-radius: 0;
		}

		.table-head {
			display: none;
		}

		.project-row {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
			background: var(--lp-surface);
			border: 1px solid var(--lp-border);
			border-radius: var(--lp-radius-lg);
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
			text-align: left;
			margin-left: 0;
		}

		.col-cta a {
			display: block;
			text-align: center;
		}
	}
</style>
