<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';

	let { data, form } = $props();
	let view = $derived(data.view);

	const tipoLabel: Record<string, string> = {
		dependencia_externa: 'Dependência externa',
		decisao_pendente: 'Decisão pendente',
		falta_de_recurso: 'Falta de recurso',
		bloqueio_tecnico: 'Bloqueio técnico',
		outro: 'Outro'
	};
	const TIPOS = ['dependencia_externa', 'decisao_pendente', 'falta_de_recurso', 'bloqueio_tecnico', 'outro'];

	let openImpediments = $derived(view.impediments.filter((i) => i.status === 'aberto'));
	let resolvedImpediments = $derived(view.impediments.filter((i) => i.status === 'resolvido'));

	let newText = $state('');
	let newTipo = $state('');

	function handleAddSubmit() {
		return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			if (result.type === 'success') {
				newText = '';
				newTipo = '';
			}
			await update({ reset: false });
		};
	}
</script>

<svelte:head>
	<title>Cockpit — Impedimentos</title>
</svelte:head>

<h1>Impedimentos</h1>
<p class="subtitle">O que está impedindo o progresso deste projeto agora, e o que fazer a respeito.</p>
<p class="subtitle">
	Complementa o retrato periódico da atividade "Identificar e tratar impedimentos", na Execução: aqui cada
	impedimento é acompanhado individualmente até ser resolvido.
</p>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

<section class="add-impediment" aria-labelledby="add-impediment-heading">
	<h2 id="add-impediment-heading">Registrar impedimento</h2>
	<form method="POST" action="?/addImpediment" use:enhance={handleAddSubmit}>
		<label for="impediment-text">Descrição</label>
		<input
			id="impediment-text"
			type="text"
			name="text"
			placeholder="Descreva o impedimento..."
			required
			bind:value={newText}
		/>
		<label for="impediment-tipo">Tipo</label>
		<select id="impediment-tipo" name="tipo" required bind:value={newTipo}>
			<option value="" disabled>Selecione...</option>
			{#each TIPOS as tipo (tipo)}
				<option value={tipo}>{tipoLabel[tipo]}</option>
			{/each}
		</select>
		<button type="submit">Adicionar</button>
	</form>
</section>

<section class="impediment-list" aria-labelledby="open-impediments-heading">
	<h2 id="open-impediments-heading">Abertos ({openImpediments.length})</h2>
	{#if openImpediments.length === 0}
		<p class="empty">Nenhum impedimento aberto.</p>
	{:else}
		<ul>
			{#each openImpediments as impediment (impediment.id)}
				<li class="impediment-row">
					<div class="impediment-header">
						<span class="impediment-text">{impediment.text}</span>
						<form method="POST" action="?/setType" use:enhance class="tipo-form">
							<input type="hidden" name="impedimentId" value={impediment.id} />
							<label class="visually-hidden" for="tipo-{impediment.id}">Tipo</label>
							<select
								id="tipo-{impediment.id}"
								name="tipo"
								value={impediment.tipo}
								onchange={(event) => event.currentTarget.form?.requestSubmit()}
							>
								{#each TIPOS as tipo (tipo)}
									<option value={tipo}>{tipoLabel[tipo]}</option>
								{/each}
							</select>
						</form>
					</div>

					<form method="POST" action="?/setNextAction" use:enhance class="next-action-form">
						<input type="hidden" name="impedimentId" value={impediment.id} />
						<label class="visually-hidden" for="next-action-{impediment.id}">Próxima ação</label>
						<input
							id="next-action-{impediment.id}"
							type="text"
							name="nextAction"
							placeholder="Próxima ação (opcional)..."
							value={impediment.nextAction ?? ''}
							onblur={(event) => {
								const next = event.currentTarget.value;
								if (next !== (impediment.nextAction ?? '')) {
									event.currentTarget.form?.requestSubmit();
								}
							}}
						/>
					</form>

					<form method="POST" action="?/resolve" use:enhance class="resolve-form">
						<input type="hidden" name="impedimentId" value={impediment.id} />
						<button type="submit" class="button-secondary">Resolver</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<details class="resolved-impediments">
	<summary>Resolvidos ({resolvedImpediments.length})</summary>
	{#if resolvedImpediments.length === 0}
		<p class="empty">Nenhum impedimento resolvido ainda.</p>
	{:else}
		<ul>
			{#each resolvedImpediments as impediment (impediment.id)}
				<li class="impediment-row resolved">
					<div class="impediment-header">
						<span class="impediment-text">{impediment.text}</span>
						<span class="impediment-tipo">{tipoLabel[impediment.tipo]}</span>
					</div>
					{#if impediment.nextAction}
						<p class="next-action-readonly">Próxima ação registrada: {impediment.nextAction}</p>
					{/if}
					<form method="POST" action="?/reopen" use:enhance class="reopen-form">
						<input type="hidden" name="impedimentId" value={impediment.id} />
						<button type="submit" class="button-secondary">Reabrir</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</details>

<style>
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.subtitle {
		color: var(--hydra-muted);
		margin-bottom: 1.5rem;
	}

	.add-impediment,
	.impediment-list {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.add-impediment h2,
	.impediment-list h2 {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
	}

	.add-impediment form {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: flex-end;
	}

	.add-impediment label {
		font-weight: 600;
		font-size: 0.85rem;
	}

	.add-impediment input[type='text'] {
		flex: 1;
		min-width: 14rem;
	}

	input[type='text'],
	select {
		font: inherit;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		color: var(--hydra-text);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.impediment-row {
		border: 1px solid var(--hydra-border);
		border-radius: 8px;
		padding: 0.85rem 1rem;
		background: var(--hydra-surface-raised);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.impediment-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.impediment-text {
		font-weight: 600;
		flex: 1;
		min-width: 12rem;
	}

	.impediment-tipo {
		font-size: 0.8rem;
		color: var(--hydra-muted);
	}

	.tipo-form select {
		font-size: 0.85rem;
	}

	.next-action-form input {
		width: 100%;
	}

	.resolve-form,
	.reopen-form {
		align-self: flex-start;
	}

	.next-action-readonly {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.resolved-impediments {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 0.85rem 1.1rem;
		background: var(--hydra-surface);
	}

	.resolved-impediments summary {
		cursor: pointer;
		font-weight: 600;
		list-style: revert;
	}

	.resolved-impediments summary:focus-visible {
		outline: 2px solid var(--hydra-accent);
		outline-offset: 2px;
	}

	.resolved-impediments ul {
		margin-top: 1rem;
	}

	.impediment-row.resolved {
		opacity: 0.85;
	}
</style>
