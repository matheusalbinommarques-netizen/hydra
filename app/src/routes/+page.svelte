<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

	function formatDate(iso: string): string {
		const parsed = new Date(iso);
		return Number.isNaN(parsed.getTime()) ? iso : dateFormatter.format(parsed);
	}
</script>

<svelte:head>
	<title>Hydra</title>
</svelte:head>

<main class="container">
	<h1>Hydra</h1>
	<p>Estruture seu projeto de software passo a passo.</p>
	<p class="subtitle">
		O Hydra ajuda você a entender o que definir agora, por que isso importa e o que fazer depois.
	</p>

	<section class="actions">
		<form method="POST" action="?/create" use:enhance>
			<button type="submit">Criar novo projeto</button>
		</form>

		<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance>
			<label for="file">Importar projeto (.json)</label>
			<input id="file" name="file" type="file" accept=".json,application/json" required />
			<button type="submit" class="button-secondary">Importar</button>
		</form>
	</section>

	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	<section class="projects" aria-label="Seus projetos">
		<h2>Seus projetos</h2>
		{#if data.projects.length === 0}
			<p class="empty">Nenhum projeto ainda. Crie o primeiro acima.</p>
		{:else}
			<ul>
				{#each data.projects as project (project.projectId)}
					<li>
						<a href="/projects/{project.projectId}/now">{project.projectName ?? 'Projeto sem nome'}</a>
						<span class="created-at">Criado em {formatDate(project.createdAt)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.subtitle {
		color: var(--hydra-muted);
		max-width: 40ch;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.actions form {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	label {
		font-weight: 600;
	}

	.projects {
		margin-top: 2.5rem;
	}

	.projects h2 {
		font-size: 1rem;
		margin: 0 0 0.75rem;
	}

	.projects .empty {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0;
	}

	.projects ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.projects li {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
	}

	.created-at {
		color: var(--hydra-muted);
		font-size: 0.8rem;
	}
</style>
