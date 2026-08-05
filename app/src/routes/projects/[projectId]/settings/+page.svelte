<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';

	let { data, form } = $props();

	let persistedName = $state('');
	let draftName = $state('');
	let errorMessage = $state<string | null>(null);
	let justSaved = $state(false);
	let saving = $state(false);

	let hasChanged = $derived(draftName !== persistedName);

	// Única fonte de sincronização com o nome carregado do servidor. Depende
	// só de `data.name` (a prop reativa) — a leitura de `persistedName` e
	// `hasChanged` fica em `untrack` de propósito, para que uma edição local
	// (draftName mudando a cada tecla) nunca dispare este efeito de novo; ele
	// só roda quando `data` muda de verdade (ex.: invalidateAll após salvar,
	// ou nova navegação). Sem edição pendente, adota o valor carregado; com
	// edição pendente, não sobrescreve o rascunho nem o texto de erro.
	$effect(() => {
		const loadedName = data.name;
		untrack(() => {
			if (hasChanged) return;
			persistedName = loadedName;
			draftName = loadedName;
		});
	});

	const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
	let createdAtLabel = $derived(dateFormatter.format(new Date(data.createdAt)));

	function handleInput() {
		errorMessage = null;
		justSaved = false;
	}

	function handleCancel() {
		draftName = persistedName;
		errorMessage = null;
		justSaved = false;
	}
</script>

<svelte:head>
	<title>Configurações do projeto — {data.name || 'Hydra'}</title>
</svelte:head>

<h1>Configurações do projeto</h1>

<section class="card">
	<h2>Geral</h2>

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'failure' && result.data) {
					errorMessage = typeof result.data.message === 'string' ? result.data.message : null;
				} else if (result.type === 'success' && result.data) {
					const savedName = typeof result.data.name === 'string' ? result.data.name : draftName;
					persistedName = savedName;
					draftName = savedName;
					errorMessage = null;
					justSaved = true;
				}
				await update({ reset: false });
			};
		}}
	>
		<div class="field">
			<label for="project-name">Nome do projeto</label>
			<input
				id="project-name"
				name="name"
				type="text"
				bind:value={draftName}
				oninput={handleInput}
				aria-invalid={errorMessage ? 'true' : undefined}
				aria-describedby={errorMessage ? 'project-name-error' : undefined}
				class:invalid={!!errorMessage}
			/>
			{#if errorMessage}
				<span id="project-name-error" class="field-error" role="alert">{errorMessage}</span>
			{:else if hasChanged}
				<span class="field-hint">Alterações não salvas.</span>
			{:else if justSaved}
				<span class="field-hint field-saved">Alterações salvas.</span>
			{/if}
		</div>

		<div class="field readonly-field">
			<span class="meta">Data de criação</span>
			<span>{createdAtLabel}</span>
		</div>

		<div class="actions">
			<button type="submit" disabled={!hasChanged || saving}>Salvar alterações</button>
			<button
				type="button"
				class="button-secondary"
				disabled={!hasChanged || saving}
				onclick={handleCancel}
			>
				Cancelar
			</button>
		</div>
	</form>
</section>

<p class="export-link">
	<a href="/projects/{data.projectId}/export">Exportar projeto →</a>
</p>

<style>
	.card {
		max-width: 32rem;
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		padding: var(--space-5);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-5);
	}

	.field label {
		font-weight: 700;
		font-size: var(--font-size-body);
	}

	.field input[type='text'] {
		font: inherit;
		font-size: var(--font-size-body);
		padding: var(--space-3);
		border-radius: var(--hydra-radius);
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface);
		color: var(--hydra-text);
	}

	.field input[type='text'].invalid {
		border-color: var(--hydra-warning);
	}

	.field-error {
		font-size: var(--font-size-caption);
	}

	.field-hint {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		font-style: italic;
	}

	.field-saved {
		font-style: normal;
		font-weight: 700;
		color: var(--hydra-text);
	}

	.readonly-field span:first-child {
		font-size: var(--font-size-caption);
	}

	.actions {
		display: flex;
		gap: var(--space-3);
	}

	.export-link {
		max-width: 32rem;
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid rgba(101, 104, 108, 0.2);
	}

	@media (max-width: 480px) {
		.actions {
			flex-direction: column;
		}

		.actions button {
			width: 100%;
		}
	}
</style>
