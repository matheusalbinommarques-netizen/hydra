<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let view = $derived(data.view);

	const bucketLabel: Record<string, string> = { agora: 'Agora', depois: 'Depois', fora: 'Fora' };
	const valueLabel: Record<string, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };
	const effortLabel: Record<string, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' };
	const issueLabel: Record<string, string> = {
		no_items: 'Adicione pelo menos um item.',
		no_now_items: 'Tenha pelo menos um item em "Agora".',
		missing_value: 'Defina o valor de todos os itens.',
		missing_effort: 'Defina o esforço de todos os itens.',
		missing_hypothesis: 'Preencha a hipótese.'
	};

	function itemsIn(bucket: string) {
		return view.scopeItems
			.filter((item) => item.bucket === bucket)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	}
</script>

<svelte:head>
	<title>Monte a próxima versão</title>
</svelte:head>

<h1>Monte a próxima versão</h1>
<p class="subtitle">
	Classifique cada item em Agora, Depois ou Fora, defina valor e esforço, e registre a hipótese que
	esse recorte vai validar.
</p>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

<section class="add-item" aria-labelledby="add-item-heading">
	<h2 id="add-item-heading">Adicionar item</h2>
	<form method="POST" action="?/addItem" use:enhance>
		<label for="add-item-text">Descrição do item</label>
		<input id="add-item-text" type="text" name="text" placeholder="Descreva o item..." required />
		<label for="add-item-bucket">Onde esse item entra?</label>
		<select id="add-item-bucket" name="bucket" required>
			<option value="" disabled selected>Selecione...</option>
			<option value="agora">Agora</option>
			<option value="depois">Depois</option>
			<option value="fora">Fora</option>
		</select>
		<button type="submit">Adicionar</button>
	</form>
</section>

{#snippet itemCard(item: (typeof view.scopeItems)[number])}
	<li class="item-card">
		<form method="POST" action="?/setText" use:enhance class="text-form">
			<input type="hidden" name="itemId" value={item.id} />
			<label class="visually-hidden" for="item-text-{item.id}">Texto do item</label>
			<input id="item-text-{item.id}" type="text" name="text" value={item.text} required />
			<button type="submit" class="button-secondary">Salvar</button>
		</form>

		<div class="controls">
			<form method="POST" action="?/move" use:enhance class="button-group">
				<input type="hidden" name="itemId" value={item.id} />
				{#each ['agora', 'depois', 'fora'] as bucket (bucket)}
					<button
						type="submit"
						name="bucket"
						value={bucket}
						class="button-secondary"
						class:selected={item.bucket === bucket}
					>
						{bucketLabel[bucket]}
					</button>
				{/each}
			</form>

			<form method="POST" action="?/setValue" use:enhance class="button-group">
				<input type="hidden" name="itemId" value={item.id} />
				{#each ['baixo', 'medio', 'alto'] as value (value)}
					<button
						type="submit"
						name="value"
						value={value}
						class="button-secondary"
						class:selected={item.value === value}
					>
						{valueLabel[value]}
					</button>
				{/each}
			</form>

			<form method="POST" action="?/setEffort" use:enhance class="button-group">
				<input type="hidden" name="itemId" value={item.id} />
				{#each ['pequeno', 'medio', 'grande'] as effort (effort)}
					<button
						type="submit"
						name="effort"
						value={effort}
						class="button-secondary"
						class:selected={item.effort === effort}
					>
						{effortLabel[effort]}
					</button>
				{/each}
			</form>

			{#if item.bucket === 'agora'}
				<div class="button-group">
					<form method="POST" action="?/moveUp" use:enhance>
						<input type="hidden" name="itemId" value={item.id} />
						<button type="submit" class="button-secondary" aria-label="Mover para cima">↑</button>
					</form>
					<form method="POST" action="?/moveDown" use:enhance>
						<input type="hidden" name="itemId" value={item.id} />
						<button type="submit" class="button-secondary" aria-label="Mover para baixo">↓</button>
					</form>
				</div>
			{/if}

			<form method="POST" action="?/remove" use:enhance>
				<input type="hidden" name="itemId" value={item.id} />
				<button type="submit" class="button-secondary remove">Excluir</button>
			</form>
		</div>
	</li>
{/snippet}

<div class="columns">
	{#each ['agora', 'depois', 'fora'] as bucket (bucket)}
		<section class="column" aria-labelledby="column-{bucket}-heading">
			<h2 id="column-{bucket}-heading">{bucketLabel[bucket]}</h2>
			{#if itemsIn(bucket).length === 0}
				<p class="empty">Nenhum item aqui ainda.</p>
			{:else}
				<ul class="item-list">
					{#each itemsIn(bucket) as item (item.id)}
						{@render itemCard(item)}
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

<section class="hypothesis" aria-labelledby="hypothesis-heading">
	<h2 id="hypothesis-heading">Hipótese</h2>
	<form method="POST" action="?/setHypothesis" use:enhance>
		<label class="visually-hidden" for="hypothesis-input">Hipótese</label>
		<textarea id="hypothesis-input" name="hypothesis" rows="3" placeholder="O que esse recorte vai validar?"
			>{view.scopeVersion.hypothesis}</textarea
		>
		<button type="submit" class="button-secondary">Salvar hipótese</button>
	</form>
</section>

<section class="confirmation" aria-labelledby="confirmation-heading">
	<h2 id="confirmation-heading">Confirmação</h2>
	{#if view.scopeConfirmationIssues.length > 0}
		<ul class="checklist">
			{#each view.scopeConfirmationIssues as issue (issue)}
				<li>{issueLabel[issue]}</li>
			{/each}
		</ul>
	{:else}
		<p class="ready">Tudo pronto para confirmar.</p>
	{/if}

	<form method="POST" action="?/confirm" use:enhance>
		<button type="submit" disabled={view.scopeConfirmationIssues.length > 0}>
			{view.scopeVersion.confirmedAt ? 'Confirmar de novo' : 'Confirmar versão'}
		</button>
	</form>

	{#if view.scopeVersion.confirmedAt}
		<p class="confirmed-note">
			Versão confirmada. <a href="/projects/{view.projectId}/next-version/confirmed"
				>Ver o artefato →</a
			>
		</p>
	{/if}
</section>

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

	.add-item,
	.hypothesis,
	.confirmation {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.add-item h2,
	.hypothesis h2,
	.confirmation h2,
	.column h2 {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
	}

	.add-item form {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.add-item input[type='text'] {
		flex: 1;
		min-width: 12rem;
	}

	input[type='text'],
	textarea,
	select {
		font: inherit;
		padding: 0.55rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		color: var(--hydra-text);
	}

	textarea {
		width: 100%;
		resize: vertical;
	}

	.columns {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.column {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem;
		background: var(--hydra-surface);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0;
	}

	.item-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.item-card {
		border: 1px solid var(--hydra-border);
		border-radius: 8px;
		padding: 0.75rem;
		background: var(--hydra-surface-raised);
	}

	.text-form {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}

	.text-form input {
		flex: 1;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.button-group {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.button-group button {
		padding: 0.35rem 0.7rem;
		font-size: 0.8rem;
	}

	.button-group button.selected {
		background: var(--hydra-accent);
		color: #0a1420;
		border-color: var(--hydra-accent);
	}

	.remove {
		color: var(--hydra-warning);
	}

	.checklist {
		margin: 0 0 1rem;
		padding-left: 1.25rem;
		color: var(--hydra-warning);
	}

	.ready {
		color: var(--hydra-accent);
		font-weight: 600;
	}

	.confirmed-note {
		margin-top: 0.75rem;
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}
</style>
