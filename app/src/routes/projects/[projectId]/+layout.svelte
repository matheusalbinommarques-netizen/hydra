<script lang="ts">
	import { page } from '$app/state';
	import { projectStatusLabel } from '$lib/project-status-label';

	let { data, children } = $props();
	let projectId = $derived(page.params.projectId);
	let pathname = $derived(page.url.pathname);
</script>

<div class="project-shell">
	<header class="project-header">
		<div class="identity">
			<a class="projects-link" href="/">← Projetos</a>
			<span class="identity-divider" aria-hidden="true"></span>
			<img class="symbol" src="/brand/hydra-symbol-primary-transparent.png" alt="" />
			<div>
				<p class="eyebrow">{data.view.projectName ?? 'Projeto sem nome'}</p>
				<p class="status">Status: {projectStatusLabel[data.view.projectStatus]}</p>
			</div>
		</div>
		<nav>
			<div class="nav-primary" aria-label="Modos de trabalho">
				<a href="/projects/{projectId}/now" class:active={pathname === `/projects/${projectId}/now`}>
					Agora
				</a>
				<a href="/projects/{projectId}/cockpit" class:active={pathname === `/projects/${projectId}/cockpit`}>
					Cockpit
				</a>
			</div>
			<span class="nav-divider" aria-hidden="true"></span>
			<div class="nav-secondary" aria-label="Consulta">
				<a href="/projects/{projectId}/map">Mapa</a>
				<a href="/projects/{projectId}/records">Registros</a>
				<a href="/projects/{projectId}/summary">Resumo</a>
				<a href="/projects/{projectId}/export">Exportar</a>
			</div>
		</nav>
	</header>

	<main class="container">
		{@render children()}
	</main>
</div>

<style>
	.project-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--hydra-border);
		background: var(--hydra-surface);
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.projects-link {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--hydra-muted);
		text-decoration: none;
		white-space: nowrap;
	}

	.projects-link:hover {
		color: var(--hydra-text);
		text-decoration: underline;
	}

	.identity-divider {
		width: 1px;
		height: 1.75rem;
		background: var(--hydra-border);
		flex-shrink: 0;
	}

	.symbol {
		height: 2rem;
		width: auto;
		display: block;
	}

	.eyebrow {
		margin: 0;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.status {
		margin: 0.15rem 0 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	nav {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	/* Destaque: os dois modos de trabalho (Agora/Cockpit) — estilo de aba,
	   mais peso visual, com o ativo marcado por fundo + sublinhado forte. */
	.nav-primary {
		display: flex;
		gap: 0.25rem;
	}

	.nav-primary a {
		font-weight: 700;
		text-decoration: none;
		padding: 0.4rem 0.9rem;
		border-radius: 8px 8px 0 0;
		border-bottom: 2px solid transparent;
		color: var(--hydra-muted);
	}

	.nav-primary a:hover {
		color: var(--hydra-text);
	}

	.nav-primary a.active {
		color: var(--hydra-text);
		background: var(--hydra-surface-raised);
		border-bottom-color: var(--hydra-accent);
	}

	.nav-divider {
		width: 1px;
		height: 1.25rem;
		background: var(--hydra-border);
		flex-shrink: 0;
	}

	/* Utilitário: telas de consulta (Mapa/Registros/Resumo/Exportar) —
	   deliberadamente mais discreto, sem competir com Agora/Cockpit. */
	.nav-secondary {
		display: flex;
		gap: 0.9rem;
	}

	.nav-secondary a {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--hydra-muted);
		text-decoration: none;
	}

	.nav-secondary a:hover {
		color: var(--hydra-text);
		text-decoration: underline;
	}
</style>
