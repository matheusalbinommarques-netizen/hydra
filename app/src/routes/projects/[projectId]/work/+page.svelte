<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import type { WorkItemStatus } from '$lib/domain';
	import { nextWorkItemStatus, previousWorkItemStatus } from './work-view';

	let { data, form } = $props();
	let projectId = $derived(data.view.projectId);
	let board = $derived(data.board);

	const WORK_ITEM_STATUSES: WorkItemStatus[] = ['a_fazer', 'em_andamento', 'concluido'];
	const statusLabel: Record<WorkItemStatus, string> = {
		a_fazer: 'A fazer',
		em_andamento: 'Em andamento',
		concluido: 'Concluído'
	};
	const tipoLabel: Record<string, string> = {
		dependencia_externa: 'Dependência externa',
		decisao_pendente: 'Decisão pendente',
		falta_de_recurso: 'Falta de recurso',
		bloqueio_tecnico: 'Bloqueio técnico',
		outro: 'Outro'
	};
	const TIPOS = ['dependencia_externa', 'decisao_pendente', 'falta_de_recurso', 'bloqueio_tecnico', 'outro'];

	let createOpen = $state(false);
	let newTitle = $state('');
	let createDialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		// Lê createOpen incondicionalmente antes do guard de createDialog: o
		// rastreamento de dependências do $effect é por execução — um retorno
		// antecipado que nunca chega a ler createOpen o deixaria de fora da
		// lista de dependências, e mudanças nele parariam de reexecutar o
		// efeito (bug real encontrado em dogfooding: clicar em "Criar item de
		// trabalho" não abria o diálogo).
		const open = createOpen;
		if (!createDialog) return;
		if (open && !createDialog.open) createDialog.showModal();
		if (!open && createDialog.open) createDialog.close();
	});

	function openCreate() {
		createOpen = true;
	}
	function closeCreate() {
		createOpen = false;
		newTitle = '';
	}
	function handleCreateSubmit() {
		return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			if (result.type === 'success') closeCreate();
			await update({ reset: false });
		};
	}

	let selectedItemId = $state<string | null>(null);
	let blockFormOpen = $state(false);
	let newImpedText = $state('');
	let newImpedTipo = $state('');

	// Feedback pendente ao mover um WorkItem (achado de dogfooding: o
	// dogfood humano percebeu ~2s entre clicar e ver a coluna mudar, sem
	// nenhum sinal de que algo estava acontecendo — parecia falha). A causa
	// real está no back-end (todo caso de uso recomputa a ProjectView inteira
	// a cada mutação, mais o reload de página que o enhance dispara depois —
	// arquitetura compartilhada por toda a aplicação, não algo local a
	// corrigir aqui sem reabrir o contrato de ProjectUseCases). Este estado
	// resolve o sintoma perceptível sem mexer nisso: trava o item em voo
	// (evita clique duplicado) e mostra "Movendo…" imediatamente ao clique —
	// nunca estado otimista (o board só reflete o novo status depois que o
	// servidor confirma).
	let movingItemId = $state<string | null>(null);

	function handleMoveSubmit(itemId: string) {
		return () => {
			movingItemId = itemId;
			return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
				await update({ reset: false });
				movingItemId = null;
			};
		};
	}

	let allItems = $derived([...board.groups.a_fazer, ...board.groups.em_andamento, ...board.groups.concluido]);
	let selectedItem = $derived(selectedItemId ? (allItems.find((item) => item.id === selectedItemId) ?? null) : null);

	function openDetail(itemId: string) {
		selectedItemId = itemId;
		blockFormOpen = false;
		newImpedText = '';
		newImpedTipo = '';
	}
	function closeDetail() {
		selectedItemId = null;
		blockFormOpen = false;
	}
</script>

<svelte:head>
	<title>Trabalho — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<h1>Trabalho</h1>
<p class="subtitle">Crie itens executáveis e mova-os entre A fazer, Em andamento e Concluído.</p>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

{#if board.isEmpty}
	<section class="empty-state">
		<p class="empty-title">Você ainda não tem itens de trabalho</p>
		<p>Crie o primeiro item para começar a mover trabalho neste projeto.</p>
		<button type="button" class="button-primary" onclick={openCreate}>+ Criar item de trabalho</button>
	</section>
{:else}
	<div class="toolbar">
		<button type="button" class="button-primary" onclick={openCreate}>+ Criar item de trabalho</button>
	</div>

	<div class="columns">
		{#each WORK_ITEM_STATUSES as status (status)}
			<section class="column" aria-labelledby="{status}-heading">
				<h2 id="{status}-heading">
					{statusLabel[status]}
					<span class="group-count">({board.counts[status]})</span>
				</h2>
				{#if board.groups[status].length === 0}
					<p class="empty-group">Nenhum item neste estado.</p>
				{:else}
					<ul>
						{#each board.groups[status] as item (item.id)}
							{@const prev = previousWorkItemStatus(item.status)}
							{@const next = nextWorkItemStatus(item.status)}
							{@const nextBlocked = next === 'concluido' && item.blockedBy !== null}
							{@const isMoving = movingItemId === item.id}
							<li class="work-card" class:blocked={item.blockedBy}>
								<button
									type="button"
									class="card-open"
									onclick={() => openDetail(item.id)}
									aria-label="Abrir item de trabalho: {item.title}"
								>
									<span class="card-open-content">
										{#if item.blockedBy}
											<span class="blocked-badge">Bloqueado</span>
										{/if}
										<span class="card-title">{item.title}</span>
										{#if item.blockedBy}
											<span class="blocked-detail">
												Impedimento ({tipoLabel[item.blockedBy.tipo]}): {item.blockedBy.text}
											</span>
										{/if}
									</span>
									<span class="card-chevron">Abrir <span aria-hidden="true">›</span></span>
								</button>
								<div class="card-move">
									<form method="POST" action="?/move" use:enhance={handleMoveSubmit(item.id)}>
										<input type="hidden" name="workItemId" value={item.id} />
										<input type="hidden" name="status" value={prev ?? ''} />
										<button
											type="submit"
											class="button-secondary"
											disabled={!prev || isMoving}
											aria-label="Mover para trás"
										>
											&larr;
										</button>
									</form>
									<form method="POST" action="?/move" use:enhance={handleMoveSubmit(item.id)}>
										<input type="hidden" name="workItemId" value={item.id} />
										<input type="hidden" name="status" value={next ?? ''} />
										<button
											type="submit"
											class="button-secondary"
											disabled={!next || nextBlocked || isMoving}
											aria-label="Mover para frente"
										>
											&rarr;
										</button>
									</form>
									{#if isMoving}
										<span class="move-pending" role="status">Movendo…</span>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	</div>
{/if}

<dialog bind:this={createDialog} class="create-dialog" onclose={closeCreate}>
	<div class="dialog-content">
		<h2>Criar item de trabalho</h2>
		<form method="POST" action="?/create" use:enhance={handleCreateSubmit}>
			<label class="visually-hidden" for="new-work-title">Título</label>
			<input
				id="new-work-title"
				type="text"
				name="title"
				placeholder="O que precisa ser feito?"
				required
				bind:value={newTitle}
			/>
			<div class="dialog-actions">
				<button type="submit" class="button-primary" disabled={!newTitle.trim()}>Criar</button>
				<button type="button" class="button-secondary" onclick={closeCreate}>Cancelar</button>
			</div>
		</form>
	</div>
</dialog>

{#if selectedItem}
	<div class="panel-backdrop" onclick={closeDetail} aria-hidden="true"></div>
	<aside class="detail-panel" aria-label="Item de trabalho">
		<div class="panel-header">
			<p class="eyebrow">Item de trabalho</p>
			<button type="button" class="link-button" onclick={closeDetail}>Fechar</button>
		</div>
		<h2 class="panel-title">{selectedItem.title}</h2>

		<p class="panel-label">Status</p>
		<div class="status-options">
			{#each WORK_ITEM_STATUSES as status (status)}
				{@const disabled = status === 'concluido' && selectedItem.blockedBy !== null}
				{@const isMoving = movingItemId === selectedItem.id}
				<form method="POST" action="?/move" use:enhance={handleMoveSubmit(selectedItem.id)}>
					<input type="hidden" name="workItemId" value={selectedItem.id} />
					<input type="hidden" name="status" value={status} />
					<button
						type="submit"
						class="status-option button-secondary"
						class:selected={selectedItem.status === status}
						disabled={disabled || selectedItem.status === status || isMoving}
						aria-pressed={selectedItem.status === status}
					>
						{statusLabel[status]}{isMoving && selectedItem.status !== status ? '…' : ''}
					</button>
				</form>
			{/each}
		</div>
		{#if selectedItem.blockedBy}
			<p class="panel-note">Marque o impedimento como resolvido para poder concluir este item.</p>
		{/if}

		<div class="panel-section">
			<p class="panel-label">Impedimento</p>
			{#if selectedItem.blockedBy}
				<div class="impediment-summary">
					<span class="impediment-tipo">{tipoLabel[selectedItem.blockedBy.tipo]}</span>
					<p class="impediment-text">{selectedItem.blockedBy.text}</p>
				</div>
				<a class="section-link" href="/projects/{projectId}/tracking">Atualizar no Acompanhamento →</a>
			{:else if blockFormOpen}
				<p class="panel-hint">O que está bloqueando esse trabalho?</p>
				<form
					method="POST"
					action="?/registerImpediment"
					use:enhance={() => {
						return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
							if (result.type === 'success') {
								blockFormOpen = false;
								newImpedText = '';
								newImpedTipo = '';
							}
							await update({ reset: false });
						};
					}}
				>
					<input type="hidden" name="workItemId" value={selectedItem.id} />
					<label class="visually-hidden" for="new-imped-text">Descrição</label>
					<input
						id="new-imped-text"
						type="text"
						name="text"
						placeholder="Ex.: aguardando aprovação do fornecedor"
						required
						bind:value={newImpedText}
					/>
					<label class="visually-hidden" for="new-imped-tipo">Tipo</label>
					<select id="new-imped-tipo" name="tipo" required bind:value={newImpedTipo}>
						<option value="" disabled>Selecione o tipo...</option>
						{#each TIPOS as tipo (tipo)}
							<option value={tipo}>{tipoLabel[tipo]}</option>
						{/each}
					</select>
					<div class="dialog-actions">
						<button type="submit" class="button-primary" disabled={!newImpedText.trim() || !newImpedTipo}>
							Registrar impedimento
						</button>
						<button type="button" class="button-secondary" onclick={() => (blockFormOpen = false)}>Cancelar</button>
					</div>
				</form>
			{:else}
				<button type="button" class="button-secondary" onclick={() => (blockFormOpen = true)}>
					Este trabalho está bloqueado
				</button>
			{/if}
		</div>
	</aside>
{/if}

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
		max-width: 42rem;
		line-height: 1.5;
		margin: 0 0 var(--space-5);
	}

	.empty-state {
		border: 1px dashed rgba(101, 104, 108, 0.3);
		border-radius: var(--hydra-radius);
		padding: var(--space-9) var(--space-6);
		text-align: center;
		color: var(--hydra-muted);
	}

	.empty-title {
		font-size: var(--font-size-subtitle);
		font-weight: 700;
		color: var(--hydra-text);
	}

	.toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-5);
	}

	.button-primary {
		background: var(--hydra-accent);
		color: var(--hydra-surface);
		border: none;
		border-radius: var(--hydra-radius);
		padding: var(--space-3) var(--space-5);
		font-weight: 700;
		cursor: pointer;
	}

	.button-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.button-secondary {
		border-radius: var(--hydra-radius-pill);
		border: 1px solid rgba(101, 104, 108, 0.3);
		background: var(--hydra-surface);
		color: var(--hydra-muted);
		padding: var(--space-2) var(--space-4);
		font-size: var(--font-size-caption);
		font-weight: 500;
		cursor: pointer;
	}

	.button-secondary:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.columns {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-5);
		align-items: start;
	}

	.column {
		border: 1px solid rgba(101, 104, 108, 0.12);
		border-radius: var(--hydra-radius);
		padding: var(--space-5) var(--space-4);
		background: var(--hydra-surface);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.column h2 {
		margin: 0;
		padding-bottom: var(--space-3);
		border-bottom: 1px solid rgba(101, 104, 108, 0.2);
		font-size: var(--font-size-body);
		font-weight: 700;
	}

	.group-count {
		color: var(--hydra-muted);
		font-weight: 400;
		font-size: var(--font-size-meta);
	}

	.column ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.empty-group {
		border: 1px dashed rgba(101, 104, 108, 0.3);
		border-radius: var(--hydra-radius);
		padding: var(--space-6) var(--space-3);
		text-align: center;
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		font-style: italic;
		margin: 0;
	}

	.work-card {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		box-shadow: var(--hydra-shadow-raised);
		padding: var(--space-4);
		background: var(--hydra-surface-raised);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/* Bloqueado nunca é uma coluna nem um status — é um sinal visual no
	   próprio card, independente de onde ele está (ver domain/state-types.ts,
	   WorkItem). --hydra-warning é reservado a conteúdo derivado pelo
	   sistema, exatamente o caso deste selo. */
	.work-card.blocked {
		border-color: var(--hydra-warning);
	}

	.blocked-badge {
		align-self: flex-start;
		font-size: var(--font-size-caption);
		font-weight: 700;
		color: var(--hydra-warning);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	/* Afordância explícita de que o card abre um detalhe (achado de
	   dogfooding: antes só o título era clicável, sem nenhum sinal visual —
	   o usuário não tinha como perceber que era abrível sem tentar clicar).
	   O botão cobre título + selo + resumo do impedimento inteiros (área de
	   toque maior, melhor em mobile) e termina num chevron ">" que só existe
	   para comunicar "isto abre algo". Hover/focus dão o mesmo sinal por
	   teclado e mouse; :active dá feedback de toque no mobile, que não tem
	   hover. */
	.card-open {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
		background: none;
		border: none;
		border-radius: var(--hydra-radius);
		padding: var(--space-2);
		margin: calc(-1 * var(--space-2));
		text-align: left;
		font: inherit;
		cursor: pointer;
		color: var(--hydra-text);
	}

	.card-open:hover,
	.card-open:active {
		background: rgba(101, 104, 108, 0.08);
	}

	.card-open:focus-visible {
		outline: 2px solid var(--hydra-accent);
		outline-offset: 2px;
	}

	.card-open-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}

	.card-title {
		font-weight: 600;
		line-height: 1.35;
	}

	/* Menor affordance textual possível (achado de dogfooding: o chevron
	   sozinho ainda não comunicava com clareza que existe detalhe abrível) —
	   mesmo peso visual discreto de --font-size-caption/--hydra-muted já
	   usado em toda a página para metadados secundários, não uma hierarquia
	   nova. */
	.card-chevron {
		flex-shrink: 0;
		font-size: var(--font-size-caption);
		line-height: 1.6;
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.blocked-detail {
		display: block;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.card-move {
		display: flex;
		gap: var(--space-2);
		border-top: 1px solid rgba(101, 104, 108, 0.15);
		padding-top: var(--space-3);
		margin-top: var(--space-1);
	}

	.card-move form {
		display: contents;
	}

	.move-pending {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		font-style: italic;
		align-self: center;
	}

	.create-dialog {
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		padding: 0;
		max-width: 26rem;
		width: 90vw;
	}

	.create-dialog::backdrop {
		background: rgba(4, 10, 16, 0.55);
	}

	.dialog-content {
		padding: var(--space-7);
	}

	.dialog-content h2 {
		margin: 0 0 var(--space-5);
	}

	.dialog-content input[type='text'] {
		width: 100%;
		font: inherit;
		padding: 0.55rem 0.75rem;
		border-radius: var(--hydra-radius);
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface);
		color: var(--hydra-text);
	}

	.dialog-actions {
		display: flex;
		gap: var(--space-3);
		margin-top: var(--space-5);
	}

	.panel-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(4, 10, 16, 0.55);
		z-index: 40;
	}

	.detail-panel {
		position: fixed;
		top: 0;
		bottom: 0;
		right: 0;
		z-index: 41;
		width: min(26rem, 100%);
		background: var(--hydra-surface-raised);
		border-left: 1px solid var(--hydra-border);
		padding: var(--space-7);
		overflow-y: auto;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-5);
	}

	.eyebrow {
		margin: 0;
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.link-button {
		background: none;
		border: none;
		padding: 0;
		font-size: var(--font-size-caption);
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
		color: var(--hydra-text);
	}

	.panel-title {
		margin: 0 0 var(--space-6);
	}

	.panel-label {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.status-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}

	.status-option {
		text-align: left;
	}

	.status-option.selected {
		background: var(--hydra-editorial-accent);
		color: #fdfcfa;
		border-color: var(--hydra-editorial-accent);
		font-weight: 700;
	}

	.panel-note {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		margin: 0 0 var(--space-6);
	}

	.panel-section {
		border-top: 1px solid rgba(101, 104, 108, 0.2);
		padding-top: var(--space-5);
	}

	.impediment-summary {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		background: var(--hydra-surface);
		margin-bottom: var(--space-4);
	}

	.impediment-tipo {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.impediment-text {
		margin: var(--space-1) 0 0;
		font-weight: 600;
	}

	.section-link {
		font-size: var(--font-size-meta);
		font-weight: 700;
	}

	.panel-hint {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		margin: 0 0 var(--space-3);
	}

	.panel-section form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.panel-section select {
		font: inherit;
		padding: 0.55rem 0.75rem;
		border-radius: var(--hydra-radius);
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface);
		color: var(--hydra-text);
	}

	@media (max-width: 860px) {
		.columns {
			grid-template-columns: 1fr;
		}

		.card-open {
			min-height: 2.75rem;
		}

		.card-move .button-secondary {
			min-height: 2.75rem;
			min-width: 2.75rem;
		}
	}
</style>
