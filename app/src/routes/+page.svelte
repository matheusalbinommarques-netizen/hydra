<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
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
</style>
