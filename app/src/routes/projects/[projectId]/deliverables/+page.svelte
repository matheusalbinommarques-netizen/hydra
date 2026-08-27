<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';

	let { data, form } = $props();
	let view = $derived(data.view);

	type Bucket = 'agora' | 'depois' | 'fora';
	const EFFORTS = ['pequeno', 'medio', 'grande'] as const;
	const effortLabel: Record<string, string> = { pequeno: 'P', medio: 'M', grande: 'G' };

	// Faixas empilhadas de uma MESMA lista (Design Gate S9): agora/depois/fora
	// são recortes de decisão, não status nem período — por isso não são
	// colunas paralelas nem linha do tempo. A posição numerada só aparece onde
	// a ordem é semanticamente válida: no recorte atual.
	const BANDS: { bucket: Bucket; title: string; hint: string }[] = [
		{ bucket: 'agora', title: 'No recorte atual', hint: 'ordenadas por prioridade' },
		{ bucket: 'depois', title: 'Depois', hint: 'no escopo, fora do recorte atual — sem ordem definida' },
		{ bucket: 'fora', title: 'Fora do recorte', hint: 'declarado como não entregaremos por ora' }
	];

	function deliverablesIn(bucket: Bucket) {
		return view.deliverables
			.filter((deliverable) => deliverable.bucket === bucket)
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	}

	let isEmpty = $derived(view.deliverables.length === 0);

	let creating = $state(false);
	let newTitle = $state('');
	let newBucket = $state('');

	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state<string | null>(null);

	let pendingDelete = $state<{ id: string; title: string } | null>(null);

	// Detalhe da entrega (ETAPA 9 do rework, segundo microcorte, D043/D044) —
	// ESTADO da própria surface Entregas (nunca nova rota): abrir mantém a
	// lista visível, fechar volta ao mesmo lugar. Client-side, sem query
	// param — não precisa sobreviver a um reload.
	let openDeliverableId = $state<string | null>(null);
	let newWorkItemTitle = $state('');
	let selectedExistingWorkItemId = $state('');

	const statusLabel: Record<string, string> = {
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

	function workItemsOf(deliverableId: string) {
		return view.workItems.filter((item) => item.deliverable?.deliverableId === deliverableId);
	}

	function unassociatedWorkItems() {
		return view.workItems.filter((item) => item.deliverable === null);
	}

	function toggleDetail(deliverableId: string) {
		openDeliverableId = openDeliverableId === deliverableId ? null : deliverableId;
		newWorkItemTitle = '';
		selectedExistingWorkItemId = '';
	}

	type EnhanceCallback = (opts: {
		result: ActionResult;
		update: (opts?: { reset?: boolean }) => Promise<void>;
	}) => Promise<void>;

	/** Mesmo indicador "Salvando…/Tudo salvo/erro" para toda escrita imediata. */
	function handleAutosaveSubmit(): EnhanceCallback {
		saveStatus = 'saving';
		saveError = null;
		return async ({ result, update }) => {
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
			saveStatus = 'saved';
			await update({ reset: false });
		};
	}

	function submitOnChange(event: Event) {
		(event.currentTarget as HTMLElement).closest('form')?.requestSubmit();
	}

	/** Título só é enviado quando realmente mudou — evita escrita inútil no blur. */
	function submitTitleIfChanged(event: FocusEvent, current: string) {
		const input = event.currentTarget as HTMLInputElement;
		const next = input.value.trim();
		if (next.length === 0) {
			input.value = current;
			return;
		}
		if (next === current) return;
		input.value = next;
		input.closest('form')?.requestSubmit();
	}
</script>

<svelte:head>
	<title>Entregas</title>
</svelte:head>

<section class="deliverables">
	<header class="head">
		<div>
			<p class="eyebrow">Corredor de entrega</p>
			<h1>Entregas</h1>
			<p class="explanation">
				O que este projeto decidiu entregar e qual é o recorte atual.
			</p>
		</div>
		<div class="head-actions">
			<span class="save-status" aria-live="polite">
				{#if saveStatus === 'saving'}Salvando…{:else if saveStatus === 'saved'}Tudo salvo{:else if saveStatus === 'error'}{saveError}{/if}
			</span>
			{#if !isEmpty}
				<button type="button" class="primary" onclick={() => (creating = true)}>Nova entrega</button>
			{/if}
		</div>
	</header>

	{#if form?.message}
		<p class="form-error" role="alert">{form.message}</p>
	{/if}

	{#if isEmpty && !creating}
		<div class="empty">
			<h2>Nenhuma entrega ainda</h2>
			<p>
				Declare a primeira coisa que este projeto pretende entregar. Depois você decide se ela está no recorte
				atual.
			</p>
			<button type="button" class="primary" onclick={() => (creating = true)}>Declarar primeira entrega</button>
		</div>
	{/if}

	{#if creating}
		<form
			class="create"
			method="POST"
			action="?/add"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') {
						newTitle = '';
						newBucket = '';
						creating = false;
					}
				};
			}}
		>
			<label class="field">
				<span>O que será entregue</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input name="title" bind:value={newTitle} autofocus placeholder="Ex.: Portal de autoatendimento" />
			</label>
			<label class="field">
				<span>Recorte</span>
				<!-- Sem pré-seleção: o recorte é uma decisão, nunca um default implícito. -->
				<select name="bucket" bind:value={newBucket}>
					<option value="" disabled>Escolha…</option>
					<option value="agora">No recorte atual</option>
					<option value="depois">Depois</option>
					<option value="fora">Fora do recorte</option>
				</select>
			</label>
			<div class="create-actions">
				<button type="button" class="ghost" onclick={() => (creating = false)}>Cancelar</button>
				<button type="submit" class="primary" disabled={newTitle.trim().length === 0 || newBucket === ''}>
					Adicionar entrega
				</button>
			</div>
		</form>
	{/if}

	{#each BANDS as band (band.bucket)}
		{@const items = deliverablesIn(band.bucket)}
		{#if items.length > 0}
			<section class="band">
				<h2>
					{band.title}
					<span class="band-hint">{band.hint}</span>
				</h2>
				<ul>
					{#each items as deliverable, index (deliverable.id)}
						<li class="card">
							<div class="card-lead">
								{#if band.bucket === 'agora'}
									<span class="position" aria-label="Posição {index + 1}">{index + 1}</span>
								{/if}
							</div>

							<div class="card-body">
								<form
									method="POST"
									action="?/setTitle"
									use:enhance={handleAutosaveSubmit}
									class="title-form"
								>
									<input type="hidden" name="deliverableId" value={deliverable.id} />
									<input
										class="title-input"
										name="title"
										value={deliverable.title}
										aria-label="Título da entrega"
										onblur={(event) => submitTitleIfChanged(event, deliverable.title)}
									/>
								</form>

								<div class="card-meta">
									<form method="POST" action="?/setEffort" use:enhance={handleAutosaveSubmit}>
										<input type="hidden" name="deliverableId" value={deliverable.id} />
										<label class="inline-field">
											<span class="inline-label">Esforço</span>
											<select name="effort" value={deliverable.effort ?? ''} onchange={submitOnChange}>
												<option value="">ainda não estimado</option>
												{#each EFFORTS as effort (effort)}
													<option value={effort}>{effortLabel[effort]}</option>
												{/each}
											</select>
										</label>
									</form>

									<form method="POST" action="?/move" use:enhance={handleAutosaveSubmit}>
										<input type="hidden" name="deliverableId" value={deliverable.id} />
										<label class="inline-field">
											<span class="inline-label">Recorte</span>
											<select name="bucket" value={deliverable.bucket} onchange={submitOnChange}>
												<option value="agora">No recorte atual</option>
												<option value="depois">Depois</option>
												<option value="fora">Fora do recorte</option>
											</select>
										</label>
									</form>

									{#if deliverable.sourceScopeItemId}
										<span class="provenance">Promovida do escopo</span>
									{/if}
								</div>
							</div>

							<div class="card-actions">
								<button
									type="button"
									class="ghost detail-toggle"
									aria-expanded={openDeliverableId === deliverable.id}
									onclick={() => toggleDetail(deliverable.id)}
								>
									{openDeliverableId === deliverable.id ? 'Fechar' : 'Abrir'}
								</button>
								{#if band.bucket === 'agora'}
									<form method="POST" action="?/moveUp" use:enhance={handleAutosaveSubmit}>
										<input type="hidden" name="deliverableId" value={deliverable.id} />
										<button type="submit" class="icon" disabled={index === 0} aria-label="Subir prioridade">
											↑
										</button>
									</form>
									<form method="POST" action="?/moveDown" use:enhance={handleAutosaveSubmit}>
										<input type="hidden" name="deliverableId" value={deliverable.id} />
										<button
											type="submit"
											class="icon"
											disabled={index === items.length - 1}
											aria-label="Descer prioridade"
										>
											↓
										</button>
									</form>
								{/if}
								<button
									type="button"
									class="icon danger"
									aria-label="Remover entrega"
									onclick={() => (pendingDelete = { id: deliverable.id, title: deliverable.title })}
								>
									✕
								</button>
							</div>
						</li>

						{#if openDeliverableId === deliverable.id}
							{@const deliverableWorkItems = workItemsOf(deliverable.id)}
							{@const candidates = unassociatedWorkItems()}
							<li class="detail">
								<h3>Trabalho desta entrega</h3>

								{#if deliverableWorkItems.length === 0}
									<p class="detail-empty">Nenhum item de trabalho associado ainda.</p>
								{:else}
									<ul class="detail-work-items">
										{#each deliverableWorkItems as workItem (workItem.id)}
											{@const unsatisfied = workItem.dependsOn.filter((dependency) => !dependency.satisfied)}
											<li class="detail-work-item">
												<div class="detail-work-item-main">
													<span class="detail-work-item-title">{workItem.title}</span>
													<span class="status-badge">{statusLabel[workItem.status]}</span>
													{#if workItem.blockedBy}
														<span class="blocked-badge"
															>Bloqueado — {tipoLabel[workItem.blockedBy.tipo]}</span
														>
													{/if}
													{#if unsatisfied.length > 0}
														<span class="waiting-badge"
															>Aguarda {unsatisfied.length === 1
																? unsatisfied[0].title
																: `${unsatisfied.length} itens`}</span
														>
													{/if}
												</div>
												<form method="POST" action="?/unassociateWorkItem" use:enhance={handleAutosaveSubmit}>
													<input type="hidden" name="workItemId" value={workItem.id} />
													<button type="submit" class="ghost small">Remover desta entrega</button>
												</form>
											</li>
										{/each}
									</ul>
								{/if}

								<div class="detail-actions">
									<form
										method="POST"
										action="?/createWorkItem"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();
												if (result.type === 'success') newWorkItemTitle = '';
											};
										}}
										class="detail-create"
									>
										<input type="hidden" name="deliverableId" value={deliverable.id} />
										<input
											name="title"
											bind:value={newWorkItemTitle}
											placeholder="Novo item de trabalho…"
											aria-label="Novo item de trabalho"
										/>
										<button type="submit" class="ghost small" disabled={newWorkItemTitle.trim().length === 0}>
											Criar aqui
										</button>
									</form>

									{#if candidates.length > 0}
										<form
											method="POST"
											action="?/associateWorkItem"
											use:enhance={() => {
												return async ({ result, update }) => {
													await update();
													if (result.type === 'success') selectedExistingWorkItemId = '';
												};
											}}
											class="detail-associate"
										>
											<input type="hidden" name="deliverableId" value={deliverable.id} />
											<select
												name="workItemId"
												bind:value={selectedExistingWorkItemId}
												aria-label="Associar item de trabalho existente"
											>
												<option value="" disabled>Associar item existente…</option>
												{#each candidates as candidate (candidate.id)}
													<option value={candidate.id}>{candidate.title}</option>
												{/each}
											</select>
											<button type="submit" class="ghost small" disabled={selectedExistingWorkItemId === ''}>
												Associar
											</button>
										</form>
									{/if}
								</div>
							</li>
						{/if}
					{/each}
				</ul>
			</section>
		{/if}
	{/each}
</section>

{#if pendingDelete}
	<div class="confirm-overlay" role="presentation" onclick={() => (pendingDelete = null)}></div>
	<div class="confirm" role="dialog" aria-label="Remover entrega">
		<p class="confirm-title">Remover “{pendingDelete.title}”?</p>
		<p class="confirm-detail">
			A entrega sai desta lista. O escopo de onde ela veio, quando houver, permanece como está.
		</p>
		<div class="confirm-actions">
			<button type="button" class="ghost" onclick={() => (pendingDelete = null)}>Cancelar</button>
			<form
				method="POST"
				action="?/remove"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						pendingDelete = null;
					};
				}}
			>
				<input type="hidden" name="deliverableId" value={pendingDelete.id} />
				<button type="submit" class="primary danger-solid">Remover</button>
			</form>
		</div>
	</div>
{/if}

<style>
	/* Identidade escura já convergida (S6V) — mesmos tokens `--hydra-dark-*`
	   do shell, mesmo padrão de /summary. */
	.deliverables {
		--accent: #2dd4c4;
		--accent-light: #5be9d8;
		--danger: #f97066;
		font-family: var(--hydra-dark-font, inherit);
		color: var(--hydra-dark-text, var(--hydra-text));
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-5);
		flex-wrap: wrap;
	}

	.eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
		margin: 0 0 var(--space-2);
	}

	h1 {
		font-size: 1.75rem;
		line-height: 1.25;
		margin: 0 0 var(--space-2);
	}

	.explanation {
		margin: 0;
		max-width: 34rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		line-height: 1.5;
	}

	.head-actions {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.save-status {
		font-size: 0.75rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		min-height: 1rem;
	}

	.form-error {
		margin: 0;
		padding: var(--space-3);
		border-radius: var(--hydra-radius);
		border: 1px solid rgba(249, 112, 102, 0.45);
		background: rgba(249, 112, 102, 0.1);
		font-size: 0.8125rem;
	}

	button {
		font-family: inherit;
		cursor: pointer;
	}

	.primary {
		background: var(--accent);
		color: #04211f;
		border: none;
		border-radius: var(--hydra-radius);
		padding: var(--space-2) var(--space-4);
		font-weight: 700;
		font-size: 0.8125rem;
		min-height: 2.5rem;
	}

	.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ghost {
		background: none;
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		color: inherit;
		border-radius: var(--hydra-radius);
		padding: var(--space-2) var(--space-4);
		font-size: 0.8125rem;
		min-height: 2.5rem;
	}

	.empty {
		border: 1px dashed var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius);
		padding: var(--space-6);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.empty h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.empty p {
		margin: 0;
		max-width: 30rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		line-height: 1.5;
		font-size: 0.875rem;
	}

	.create {
		display: flex;
		align-items: flex-end;
		gap: var(--space-4);
		flex-wrap: wrap;
		padding: var(--space-4);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius);
		background: var(--hydra-dark-surface, transparent);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1 1 14rem;
		min-width: 0;
	}

	.field span {
		font-size: 0.75rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.create-actions {
		display: flex;
		gap: var(--space-2);
	}

	input,
	select {
		font-family: inherit;
		font-size: 0.875rem;
		color: inherit;
		background: var(--hydra-dark-surface-raised, transparent);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius);
		padding: var(--space-2) var(--space-3);
		min-height: 2.5rem;
		width: 100%;
		box-sizing: border-box;
	}

	.band h2 {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		flex-wrap: wrap;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		margin: 0 0 var(--space-3);
	}

	.band-hint {
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.band ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.card {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius);
		background: var(--hydra-dark-surface, transparent);
	}

	.card-lead {
		flex-shrink: 0;
	}

	.position {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		background: rgba(45, 212, 196, 0.14);
		color: var(--accent-light);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.card-body {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.title-form {
		margin: 0;
	}

	.title-input {
		font-size: 0.9375rem;
		font-weight: 600;
		background: none;
		border: 1px solid transparent;
		padding: var(--space-1) var(--space-2);
		min-height: 2rem;
	}

	.title-input:hover,
	.title-input:focus {
		border-color: var(--hydra-dark-border, var(--hydra-border));
		background: var(--hydra-dark-surface-raised, transparent);
	}

	.card-meta {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		flex-wrap: wrap;
	}

	.card-meta form {
		margin: 0;
	}

	.inline-field {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.inline-label {
		font-size: 0.75rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.inline-field select {
		width: auto;
		min-height: 2rem;
		font-size: 0.8125rem;
		padding: var(--space-1) var(--space-2);
	}

	.provenance {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius-pill, 999px);
		padding: 0.125rem 0.5rem;
	}

	.card-actions {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
	}

	.card-actions form {
		margin: 0;
	}

	.icon {
		background: none;
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius);
		color: inherit;
		width: 2rem;
		height: 2rem;
		font-size: 0.875rem;
		line-height: 1;
	}

	.icon:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.icon.danger {
		color: var(--danger);
		border-color: rgba(249, 112, 102, 0.4);
	}

	.detail-toggle {
		min-height: 2rem;
		padding: var(--space-1) var(--space-3);
		font-size: 0.75rem;
	}

	.small {
		min-height: 2rem;
		padding: var(--space-1) var(--space-3);
		font-size: 0.75rem;
	}

	.detail {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		margin-left: 1.5rem;
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-left: 2px solid var(--accent);
		border-radius: var(--hydra-radius);
		background: var(--hydra-dark-surface-raised, rgba(255, 255, 255, 0.03));
	}

	.detail h3 {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.detail-empty {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.detail-work-items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.detail-work-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius);
	}

	.detail-work-item form {
		margin: 0;
	}

	.detail-work-item-main {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		font-size: 0.8125rem;
	}

	.detail-work-item-title {
		font-weight: 600;
	}

	.status-badge {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--hydra-dark-muted, var(--hydra-muted));
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius-pill, 999px);
		padding: 0.125rem 0.5rem;
	}

	.blocked-badge {
		font-size: 0.6875rem;
		font-weight: 700;
		color: var(--danger);
		border: 1px solid rgba(249, 112, 102, 0.4);
		border-radius: var(--hydra-radius-pill, 999px);
		padding: 0.125rem 0.5rem;
	}

	.waiting-badge {
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--accent-light);
		border: 1px solid rgba(45, 212, 196, 0.4);
		border-radius: var(--hydra-radius-pill, 999px);
		padding: 0.125rem 0.5rem;
	}

	.detail-actions {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.detail-actions form {
		display: flex;
		gap: var(--space-2);
		margin: 0;
		flex: 1 1 16rem;
	}

	.detail-actions input,
	.detail-actions select {
		min-height: 2rem;
		font-size: 0.8125rem;
	}

	.confirm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(5, 10, 16, 0.55);
		z-index: 49;
	}

	.confirm {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(24rem, calc(100vw - 2rem));
		box-sizing: border-box;
		background: var(--hydra-dark-surface-raised, #101a24);
		border: 1px solid var(--hydra-dark-border, var(--hydra-border));
		border-radius: var(--hydra-radius);
		padding: var(--space-5);
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		color: var(--hydra-dark-text, var(--hydra-text));
		font-family: var(--hydra-dark-font, inherit);
	}

	.confirm-title {
		margin: 0;
		font-weight: 700;
	}

	.confirm-detail {
		margin: 0;
		font-size: 0.8125rem;
		line-height: 1.5;
		color: var(--hydra-dark-muted, var(--hydra-muted));
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: var(--space-2);
	}

	.confirm-actions form {
		margin: 0;
	}

	.danger-solid {
		background: var(--danger);
		color: #2a0b08;
	}

	@media (max-width: 860px) {
		.card {
			flex-wrap: wrap;
		}

		.card-actions {
			width: 100%;
			justify-content: flex-end;
		}

		.head-actions {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
