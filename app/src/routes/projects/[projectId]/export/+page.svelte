<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Exportar projeto</title>
</svelte:head>

<h1>Exportar projeto</h1>
<div class="accent-bar" aria-hidden="true"></div>
<p class="subtitle">
	Os dados deste projeto serão baixados como um arquivo JSON, com tudo o que foi registrado até
	agora.
</p>

<section class="card">
	<div class="filename-block">
		<span class="meta">Nome do arquivo</span>
		<code>{data.filename}</code>
	</div>

	<a class="button download-button" href="/projects/{data.projectId}/export/download" download>
		Baixar exportação
	</a>
</section>

<style>
	.accent-bar {
		width: 40px;
		height: 3px;
		background: var(--hydra-editorial-accent);
		margin: 0 0 var(--space-4);
	}

	.subtitle {
		color: var(--hydra-muted);
		max-width: 32rem;
		line-height: 1.5;
		margin: 0 0 var(--space-6);
	}

	.card {
		max-width: 36rem;
		width: 100%;
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		padding: var(--space-5);
	}

	.filename-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-5);
	}

	.filename-block code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		background: var(--hydra-bg);
		border-radius: var(--hydra-radius);
		padding: var(--space-2) var(--space-3);
		width: fit-content;
	}

	.download-button {
		display: block;
		width: 100%;
		text-align: center;
		text-decoration: none;
	}
</style>
