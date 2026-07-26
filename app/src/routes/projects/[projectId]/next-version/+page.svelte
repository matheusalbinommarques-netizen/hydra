<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';

	let { data, form } = $props();
	let view = $derived(data.view);
	let activity = $derived(data.activity);

	type Bucket = 'agora' | 'depois' | 'fora';
	const BUCKETS: Bucket[] = ['agora', 'depois', 'fora'];
	const bucketLabel: Record<Bucket, string> = { agora: 'Agora', depois: 'Depois', fora: 'Fora' };
	const bucketHint: Record<Bucket, string> = {
		agora: 'o que você vai fazer primeiro.',
		depois: 'importante, mas não agora.',
		fora: 'não faz parte deste recorte.'
	};
	const effortLabel: Record<string, string> = { pequeno: 'Pequeno', medio: 'Médio', grande: 'Grande' };

	let activeTab = $state<Bucket>('agora');
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state<string | null>(null);
	// Promessa da autosave em andamento (texto do item / hipótese) — "Confirmar
	// foco" aguarda essa promessa antes de validar, para nunca confirmar com uma
	// edição pendente que ainda não chegou ao servidor.
	let pendingSave = $state<Promise<void> | null>(null);
	let confirmError = $state<string | null>(null);

	let itemPendingDelete = $state<{ id: string; text: string } | null>(null);
	let deleteDialogEl: HTMLDialogElement;
	let deleteSubmitting = $state(false);

	let highlightedItemId = $state<string | null>(null);
	let highlightTimeout: ReturnType<typeof setTimeout> | undefined;

	function itemsIn(bucket: Bucket) {
		return view.scopeItems
			.filter((item) => item.bucket === bucket)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	}

	type EnhanceCallback = (opts: {
		result: ActionResult;
		update: (opts?: { reset?: boolean }) => Promise<void>;
	}) => Promise<void>;

	/** Usado por toda ação de salvamento imediato (bucket, tamanho, ordem) e
	 * pelas ações disparadas ao sair do campo (texto do item, hipótese) —
	 * mesmo indicador "Salvando…/Tudo salvo/erro" para todas. */
	function handleAutosaveSubmit(): EnhanceCallback {
		saveStatus = 'saving';
		saveError = null;
		let resolveFn: () => void = () => {};
		pendingSave = new Promise<void>((resolve) => {
			resolveFn = resolve;
		});
		return async ({ result, update }) => {
			try {
				if (result.type === 'failure') {
					saveStatus = 'error';
					saveError = (result.data as { message?: string } | undefined)?.message ?? 'Não foi possível salvar.';
					await update({ reset: false });
					return;
				}
				if (result.type === 'error') {
					saveStatus = 'error';
					saveError = 'Não foi possível salvar.';
					return;
				}
				await update({ reset: false });
				saveStatus = 'saved';
			} finally {
				resolveFn();
			}
		};
	}

	function handleAddItemSubmit(): EnhanceCallback {
		saveStatus = 'saving';
		saveError = null;
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				saveStatus = 'error';
				saveError = (result.data as { message?: string } | undefined)?.message ?? 'Não foi possível adicionar o item.';
				await update();
				return;
			}
			await update();
			saveStatus = 'saved';
		};
	}

	/** Aguarda qualquer autosave pendente (texto/hipótese ainda não confirmado
	 * pelo servidor) antes de disparar a própria requisição de confirmação. */
	async function handleConfirmSubmit(): Promise<EnhanceCallback> {
		if (pendingSave) await pendingSave;
		return async ({ result, update }) => {
			if (result.type === 'failure') {
				confirmError = (result.data as { message?: string } | undefined)?.message ?? 'Não foi possível confirmar.';
				await update({ reset: false });
				return;
			}
			confirmError = null;
			await update({ reset: false });
		};
	}

	function handleDeleteSubmit(): EnhanceCallback {
		deleteSubmitting = true;
		return async ({ update }) => {
			deleteSubmitting = false;
			closeDeleteDialog();
			await update({ reset: false });
		};
	}

	function openDeleteDialog(item: { id: string; text: string }) {
		itemPendingDelete = item;
		deleteDialogEl.showModal();
	}

	function closeDeleteDialog() {
		deleteDialogEl.close();
		itemPendingDelete = null;
	}

	function goToItem(itemId: string, bucket: Bucket) {
		activeTab = bucket;
		highlightedItemId = itemId;
		clearTimeout(highlightTimeout);
		queueMicrotask(() => {
			document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
		highlightTimeout = setTimeout(() => {
			if (highlightedItemId === itemId) highlightedItemId = null;
		}, 2500);
	}
</script>

<svelte:head>
	<title>Escolha o próximo foco</title>
</svelte:head>

<h1>Escolha o próximo foco</h1>
<p class="subtitle">
	Organize o que deve ser feito agora, o que pode esperar e o que não pertence a este recorte.
</p>

<section class="how-it-works" aria-labelledby="how-it-works-heading">
	<h2 id="how-it-works-heading">Como funciona</h2>
	{#if activity}
		<p>{activity.why}</p>
		<p class="example"><strong>Exemplo:</strong> {activity.example}</p>
	{/if}
	<ul class="bucket-legend">
		{#each BUCKETS as bucket (bucket)}
			<li><strong>{bucketLabel[bucket]}</strong> — {bucketHint[bucket]}</li>
		{/each}
	</ul>
	<p class="result-note">
		Ao confirmar, o Hydra organiza este recorte num artefato somente-leitura para orientar os próximos
		passos.
	</p>
</section>

<p class="save-status" aria-live="polite">
	{#if saveStatus === 'saving'}
		Salvando…
	{:else if saveStatus === 'saved'}
		Tudo salvo
	{:else if saveStatus === 'error'}
		{saveError ?? 'Erro ao salvar.'}
	{/if}
</p>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

<section class="add-item" aria-labelledby="add-item-heading">
	<h2 id="add-item-heading">Adicionar item</h2>
	<form method="POST" action="?/addItem" use:enhance={handleAddItemSubmit}>
		<label for="add-item-text">Descrição do item</label>
		<input id="add-item-text" type="text" name="text" placeholder="Descreva o item..." required />
		<label for="add-item-bucket">Onde esse item entra?</label>
		<select id="add-item-bucket" name="bucket" required>
			<option value="" disabled selected>Selecione...</option>
			{#each BUCKETS as bucket (bucket)}
				<option value={bucket}>{bucketLabel[bucket]}</option>
			{/each}
		</select>
		<button type="submit">Adicionar</button>
	</form>
</section>

<div class="tabs" role="tablist" aria-label="Buckets do recorte">
	{#each BUCKETS as bucket (bucket)}
		<button
			type="button"
			role="tab"
			id="tab-{bucket}"
			aria-selected={activeTab === bucket}
			aria-controls="panel-{bucket}"
			class="tab"
			class:active={activeTab === bucket}
			onclick={() => (activeTab = bucket)}
		>
			{bucketLabel[bucket]} ({itemsIn(bucket).length})
		</button>
	{/each}
</div>

{#snippet itemRow(item: (typeof view.scopeItems)[number], bucket: Bucket)}
	<li id="item-{item.id}" class="item-row" class:highlighted={highlightedItemId === item.id}>
		<form method="POST" action="?/setText" use:enhance={handleAutosaveSubmit} class="text-form">
			<input type="hidden" name="itemId" value={item.id} />
			<label class="visually-hidden" for="item-text-{item.id}">Texto do item</label>
			<input
				id="item-text-{item.id}"
				type="text"
				name="text"
				value={item.text}
				onblur={(event) => {
					const next = event.currentTarget.value;
					if (next.trim().length > 0 && next !== item.text) {
						event.currentTarget.form?.requestSubmit();
					}
				}}
			/>
		</form>

		<div class="item-controls">
			<form method="POST" action="?/move" use:enhance={handleAutosaveSubmit} class="bucket-select">
				<input type="hidden" name="itemId" value={item.id} />
				<label class="visually-hidden" for="item-bucket-{item.id}">Mover para</label>
				<select
					id="item-bucket-{item.id}"
					name="bucket"
					value={item.bucket}
					onchange={(event) => event.currentTarget.form?.requestSubmit()}
				>
					{#each BUCKETS as b (b)}
						<option value={b}>{bucketLabel[b]}</option>
					{/each}
				</select>
			</form>

			{#if bucket === 'agora'}
				<form method="POST" action="?/setEffort" use:enhance={handleAutosaveSubmit} class="effort-group">
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

				<div class="order-controls">
					<form method="POST" action="?/moveUp" use:enhance={handleAutosaveSubmit}>
						<input type="hidden" name="itemId" value={item.id} />
						<button type="submit" class="button-secondary" aria-label="Mover para cima">↑</button>
					</form>
					<form method="POST" action="?/moveDown" use:enhance={handleAutosaveSubmit}>
						<input type="hidden" name="itemId" value={item.id} />
						<button type="submit" class="button-secondary" aria-label="Mover para baixo">↓</button>
					</form>
				</div>
			{/if}

			<button type="button" class="button-secondary remove" onclick={() => openDeleteDialog(item)}>
				Excluir
			</button>
		</div>
	</li>
{/snippet}

{#each BUCKETS as bucket (bucket)}
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="tabpanel" tabindex="0" id="panel-{bucket}" aria-labelledby="tab-{bucket}" hidden={activeTab !== bucket}>
		{#if itemsIn(bucket).length === 0}
			<p class="empty">Nenhum item aqui ainda.</p>
		{:else}
			<ul class="item-list">
				{#each itemsIn(bucket) as item (item.id)}
					{@render itemRow(item, bucket)}
				{/each}
			</ul>
		{/if}
	</section>
{/each}

<dialog bind:this={deleteDialogEl} aria-labelledby="delete-confirm-title" class="delete-confirm">
	{#if itemPendingDelete}
		<h2 id="delete-confirm-title">Excluir "{itemPendingDelete.text}"?</h2>
		<p>Este item será removido do recorte. Esta ação não pode ser desfeita.</p>
	{/if}
	<div class="actions">
		<button type="button" class="button-secondary" onclick={closeDeleteDialog} disabled={deleteSubmitting}>
			Cancelar
		</button>
		<form method="POST" action="?/remove" use:enhance={handleDeleteSubmit}>
			<input type="hidden" name="itemId" value={itemPendingDelete?.id ?? ''} />
			<button type="submit" disabled={deleteSubmitting}>
				{deleteSubmitting ? 'Excluindo…' : 'Confirmar exclusão'}
			</button>
		</form>
	</div>
</dialog>

<section class="hypothesis" aria-labelledby="hypothesis-heading">
	<h2 id="hypothesis-heading">Hipótese</h2>
	<form method="POST" action="?/setHypothesis" use:enhance={handleAutosaveSubmit}>
		<label class="visually-hidden" for="hypothesis-input">Hipótese</label>
		<textarea
			id="hypothesis-input"
			name="hypothesis"
			rows="3"
			placeholder="O que esse recorte vai validar?"
			onblur={(event) => {
				const next = event.currentTarget.value;
				if (next !== view.scopeVersion.hypothesis) {
					event.currentTarget.form?.requestSubmit();
				}
			}}>{view.scopeVersion.hypothesis}</textarea
		>
	</form>
</section>

<section class="confirmation" aria-labelledby="confirmation-heading">
	<h2 id="confirmation-heading">Confirmação</h2>

	{#if view.scopeConfirmationIssues.length > 0}
		<ul class="checklist">
			{#each view.scopeConfirmationIssues as issue (issue.kind)}
				<li>
					{#if issue.kind === 'no_items'}
						Adicione pelo menos um item.
					{:else if issue.kind === 'no_now_items'}
						Tenha pelo menos um item em "Agora".
					{:else if issue.kind === 'missing_effort'}
						Falta definir o tamanho de {issue.itemIds.length}
						{issue.itemIds.length === 1 ? 'item' : 'itens'}:
						<ul class="checklist-items">
							{#each issue.itemIds as itemId (itemId)}
								{@const missingItem = view.scopeItems.find((i) => i.id === itemId)}
								{#if missingItem}
									<li>
										<button type="button" class="link-button" onclick={() => goToItem(itemId, 'agora')}>
											{missingItem.text}
										</button>
									</li>
								{/if}
							{/each}
						</ul>
					{:else if issue.kind === 'missing_hypothesis'}
						Preencha a hipótese.
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="ready">Tudo pronto para confirmar.</p>
	{/if}

	<form method="POST" action="?/confirm" use:enhance={handleConfirmSubmit}>
		<button type="submit" disabled={view.scopeConfirmationIssues.length > 0}>
			{view.scopeVersion.confirmedAt ? 'Confirmar de novo' : 'Confirmar foco'}
		</button>
	</form>

	{#if confirmError}
		<p role="alert">{confirmError}</p>
	{/if}

	{#if view.scopeVersion.confirmedAt}
		<p class="confirmed-note">
			Foco confirmado.
			<a class="continue-cta" href="/projects/{view.projectId}/next-version/confirmed">Ver o artefato →</a>
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

	.how-it-works,
	.add-item,
	.hypothesis,
	.confirmation {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.how-it-works h2,
	.add-item h2,
	.hypothesis h2,
	.confirmation h2 {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
	}

	.how-it-works p {
		margin: 0 0 0.5rem;
	}

	.how-it-works .example {
		color: var(--hydra-muted);
	}

	.bucket-legend {
		margin: 0.5rem 0;
		padding-left: 1.25rem;
	}

	.result-note {
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.save-status {
		min-height: 1.2rem;
		font-size: 0.85rem;
		color: var(--hydra-muted);
		margin: 0 0 1rem;
	}

	.add-item form {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: flex-end;
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

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--hydra-border);
	}

	.tab {
		padding: 0.6rem 1rem;
		border: none;
		background: none;
		color: var(--hydra-muted);
		font-weight: 600;
		border-bottom: 2px solid transparent;
	}

	.tab.active {
		color: var(--hydra-text);
		border-bottom-color: var(--hydra-accent);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0 0 1.5rem;
	}

	.item-list {
		list-style: none;
		margin: 0 0 1.5rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.item-row {
		border: 1px solid var(--hydra-border);
		border-radius: 8px;
		padding: 0.85rem 1rem;
		background: var(--hydra-surface-raised);
		transition: outline-color 0.2s ease;
		outline: 2px solid transparent;
		outline-offset: 2px;
	}

	.item-row.highlighted {
		outline-color: var(--hydra-warning);
	}

	.text-form {
		margin-bottom: 0.6rem;
	}

	.text-form input {
		width: 100%;
		font-weight: 600;
	}

	.item-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.6rem;
	}

	.effort-group,
	.order-controls {
		display: flex;
		gap: 0.4rem;
	}

	.effort-group button,
	.order-controls button {
		padding: 0.35rem 0.7rem;
		font-size: 0.8rem;
	}

	.effort-group button.selected {
		background: var(--hydra-accent);
		color: #0a1420;
		border-color: var(--hydra-accent);
	}

	.remove {
		color: var(--hydra-warning);
		margin-left: auto;
	}

	.delete-confirm {
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 28rem;
		background: var(--hydra-surface-raised);
		color: var(--hydra-text);
	}

	.delete-confirm::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.delete-confirm h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
	}

	.delete-confirm p {
		margin: 0 0 0.75rem;
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.delete-confirm .actions {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.delete-confirm .actions form {
		display: contents;
	}

	.checklist {
		margin: 0 0 1rem;
		padding-left: 1.25rem;
		color: var(--hydra-warning);
	}

	.checklist-items {
		margin: 0.25rem 0 0.5rem;
		padding-left: 1.1rem;
		color: var(--hydra-text);
	}

	.link-button {
		background: none;
		border: none;
		padding: 0;
		color: var(--hydra-accent);
		text-decoration: underline;
		font: inherit;
		cursor: pointer;
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

	.continue-cta {
		font-weight: 600;
	}
</style>
