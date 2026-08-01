<script lang="ts">
	import { enhance } from '$app/forms';
	import { projectStatusLabel } from '$lib/project-status-label';

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
	<img class="wordmark" src="/brand/hydra-lockup-primary-transparent.png" alt="Hydra" />
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
						<div class="project-info">
							<a href="/projects/{project.projectId}/now">{project.projectName ?? 'Projeto sem nome'}</a>
							<span class="status-tag">{projectStatusLabel[project.projectStatus]}</span>
							<span class="created-at">Criado em {formatDate(project.createdAt)}</span>
							{#if project.nextAction.kind === 'activity'}
								<p class="next-action">
									<span class="next-action-label">Próxima ação</span>
									{project.nextAction.label}
								</p>
							{:else}
								<p class="next-action">Jornada concluída</p>
							{/if}
						</div>
						<a class="button-secondary continue-link" href="/projects/{project.projectId}/now">
							{#if project.nextAction.kind === 'completed'}
								Ver projeto
							{:else if project.projectStatus === 'rascunho'}
								Começar projeto
							{:else}
								Continuar projeto
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.wordmark {
		height: 2.75rem;
		width: auto;
		display: block;
	}

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

	/* input[type=file] é um widget nativo do SO — cor/fonte do texto e do
	   próprio controle são estilizáveis, mas o botão "Escolher arquivo" só
	   aceita estilo via ::file-selector-button. Reaproveita a mesma receita
	   visual de .button-secondary (app.css), sem criar um padrão novo. */
	input[type='file'] {
		font: inherit;
		color: var(--hydra-text);
		/* A largura interna do texto nativo ("Nenhum arquivo escolhido"/nome do
		   arquivo) não é controlável via CSS entre navegadores — só a largura
		   total do próprio elemento. Sem isso, o texto trunca no meio da
		   palavra assim que o botão reestilizado (::file-selector-button)
		   divide o espaço disponível. */
		min-width: 26rem;
	}

	input[type='file']::file-selector-button {
		font: inherit;
		font-weight: 700;
		background: transparent;
		color: var(--hydra-text);
		border: 1px solid var(--hydra-border);
		border-radius: 8px;
		padding: 0.55rem 1rem;
		margin-right: 0.75rem;
		cursor: pointer;
	}

	input[type='file']::file-selector-button:hover {
		background: var(--hydra-surface-raised);
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
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.project-info {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.next-action {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-text);
	}

	.next-action-label {
		color: var(--hydra-muted);
		margin-right: 0.35rem;
	}

	.continue-link {
		flex-shrink: 0;
	}

	/* mesma convenção de link textual já usada em projects/[projectId]/+layout.svelte (nav a). */
	.projects a {
		color: var(--hydra-accent);
		font-weight: 600;
		text-decoration: none;
	}

	.projects a:hover {
		text-decoration: underline;
	}

	.status-tag {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--hydra-muted);
		border: 1px solid var(--hydra-border);
		border-radius: 999px;
		padding: 0.1rem 0.55rem;
	}

	.created-at {
		color: var(--hydra-muted);
		font-size: 0.8rem;
	}
</style>
