<script lang="ts">
	import { page } from '$app/state';
	import { projectStatusLabel } from '$lib/project-status-label';

	let { data, children } = $props();
	let projectId = $derived(page.params.projectId);
</script>

<div class="project-shell">
	<header class="project-header">
		<div class="identity">
			<img class="symbol" src="/brand/hydra-symbol-primary-transparent.png" alt="" />
			<div>
				<p class="eyebrow">{data.view.projectName ?? 'Projeto sem nome'}</p>
				<p class="status">Status: {projectStatusLabel[data.view.projectStatus]}</p>
			</div>
		</div>
		<nav>
			<a href="/">Projetos</a>
			<a href="/projects/{projectId}/now">Agora</a>
			<a href="/projects/{projectId}/map">Mapa</a>
			<a href="/projects/{projectId}/records">Registros</a>
			<a href="/projects/{projectId}/summary">Resumo</a>
			<a href="/projects/{projectId}/export">Exportar</a>
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
		gap: 0.75rem;
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
		gap: 1.25rem;
	}

	nav a {
		font-weight: 600;
		text-decoration: none;
	}

	nav a:hover {
		text-decoration: underline;
	}
</style>
