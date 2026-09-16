<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';

	let { data, form } = $props();
	let projectId = $derived(data.view.projectId);
	let attentions = $derived(data.attentions);

	const tipoLabel: Record<string, string> = {
		dependencia_externa: 'Dependência externa',
		decisao_pendente: 'Decisão pendente',
		falta_de_recurso: 'Falta de recurso',
		bloqueio_tecnico: 'Bloqueio técnico',
		outro: 'Outro'
	};
	const TIPOS = ['dependencia_externa', 'decisao_pendente', 'falta_de_recurso', 'bloqueio_tecnico', 'outro'];
	const workStatusLabel: Record<string, string> = {
		a_fazer: 'A fazer',
		em_andamento: 'Em andamento',
		concluido: 'Concluído'
	};
	// Decisões disponíveis para relacionar a um Impediment `decisao_pendente`
	// (mesmo padrão de tracking/+page.svelte antes da absorção) — pendentes e
	// tomadas juntas: relacionar uma Decision já tomada é um estado válido.
	let allDecisions = $derived([...data.decisions.pending, ...data.decisions.decided]);

	let newText = $state('');
	let newTipo = $state('');
	// Só um impedimento em edição por vez — evita deixar todos os formulários
	// permanentemente expandidos (mesmo padrão de tracking/+page.svelte).
	let editingImpedimentId = $state<string | null>(null);
	let showResolved = $state(false);

	function handleAddSubmit() {
		return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			if (result.type === 'success') {
				newText = '';
				newTipo = '';
			}
			await update({ reset: false });
		};
	}

	function toggleEdit(id: string) {
		editingImpedimentId = editingImpedimentId === id ? null : id;
	}

	let hasBlocked = $derived(attentions.blockedWorkItems.length > 0);
	let hasPendingItems = $derived(attentions.pendingItems.length > 0);

	// Feedback pós-mutação de "marcar como resolvido" (achado de dogfooding,
	// preservado ao migrar de tracking/+page.svelte): a ação fazia o card
	// sumir de "Precisa de você" sem nenhuma confirmação de que o item foi
	// desbloqueado nem de qual estado ele manteve. Captura os dados do
	// WorkItem ANTES do submit (o card vai sumir da lista após o reload).
	let resolvedFeedback = $state<{ title: string; statusLabel: string } | null>(null);

	function handleResolveSubmit(blocked: { title: string; status: string }) {
		return () => {
			return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
				if (result.type === 'success') {
					resolvedFeedback = { title: blocked.title, statusLabel: workStatusLabel[blocked.status] ?? blocked.status };
					confirmingWorkItemId = null;
				}
				await update({ reset: false });
			};
		};
	}

	function dismissResolvedFeedback() {
		resolvedFeedback = null;
	}

	// "Atualizar situação" (mesmo padrão de tracking/+page.svelte): o primeiro
	// clique nunca muta nada — só abre um estado de confirmação contextual por
	// card; a mutação real (resolveImpediment) só acontece em "Confirmar que
	// foi resolvido", ação explícita separada, com "Cancelar" sempre disponível.
	let confirmingWorkItemId = $state<string | null>(null);

	function openConfirm(workItemId: string) {
		confirmingWorkItemId = workItemId;
	}
	function cancelConfirm() {
		confirmingWorkItemId = null;
	}
</script>

<svelte:head>
	<title>Atenções — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<section class="attentions-page">
	<header>
		<p class="eyebrow">Execução</p>
		<h1>Atenções</h1>
		<p class="subtitle">
			Fatos que já exigem atenção neste projeto: trabalho bloqueado, impedimentos abertos e pendências metodológicas.
		</p>
	</header>

	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	<section class="card need-you" aria-labelledby="need-you-heading">
		<p class="eyebrow" id="need-you-heading">Precisa de você</p>

		{#if resolvedFeedback}
			<div class="resolved-feedback" role="status">
				<p class="resolved-feedback-text">
					Impedimento resolvido. <strong>{resolvedFeedback.title}</strong> foi desbloqueado e permanece em "{resolvedFeedback.statusLabel}".
				</p>
				<div class="resolved-feedback-actions">
					<a class="section-link" href="/projects/{projectId}/work">Continuar em Trabalho →</a>
					<button type="button" class="link-button" onclick={dismissResolvedFeedback}>Entendi</button>
				</div>
			</div>
		{/if}

		{#if hasBlocked}
			<ul class="blocked-list">
				{#each attentions.blockedWorkItems as blocked (blocked.workItemId)}
					<li class="blocked-card">
						<span class="blocked-badge">Bloqueado</span>
						<p class="blocked-headline">{blocked.title} está bloqueado</p>
						<p class="blocked-impediment">Impedimento ({tipoLabel[blocked.impedimentTipo]})</p>
						<p class="blocked-text">{blocked.impedimentText}</p>
						{#if blocked.waitingLabel}
							<p class="blocked-waiting">{blocked.waitingLabel}</p>
						{/if}
						<p class="blocked-why">Por que importa: {blocked.why}</p>

						{#if confirmingWorkItemId === blocked.workItemId}
							<div class="confirm-resolve" role="group" aria-label="Confirmar atualização de situação">
								<p class="confirm-resolve-text">
									Isso já foi resolvido no projeto, fora do Hydra? Confirme só se o impedimento realmente deixou de
									bloquear o trabalho. Ao confirmar, {blocked.title} deixa de aparecer bloqueado e continua em "{workStatusLabel[
										blocked.status
									] ?? blocked.status}" — o estado operacional não muda sozinho.
								</p>
								<div class="blocked-actions">
									<form method="POST" action="?/resolve" use:enhance={handleResolveSubmit(blocked)}>
										<input type="hidden" name="impedimentId" value={blocked.impedimentId} />
										<button type="submit" class="button-primary">Confirmar que foi resolvido</button>
									</form>
									<button type="button" class="button-secondary" onclick={cancelConfirm}>Cancelar</button>
								</div>
							</div>
						{:else}
							<div class="blocked-actions">
								<button type="button" class="button-primary" onclick={() => openConfirm(blocked.workItemId)}>
									Atualizar situação
								</button>
								<a class="section-link" href="/projects/{projectId}/work">Ver item em Trabalho →</a>
								<a
									class="section-link"
									href="/projects/{projectId}/records?entityId={blocked.workItemId}&entityId={blocked.impedimentId}"
								>
									Ver mudanças relacionadas →
								</a>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{:else if !resolvedFeedback}
			<p class="empty">
				Nenhuma ação necessária agora. Quando um item de trabalho ficar bloqueado por um impedimento, o Hydra mostra
				aqui o que fazer.
			</p>
		{/if}
	</section>

	<section class="card pending-items" aria-labelledby="pending-items-heading">
		<h2 id="pending-items-heading">Pendências</h2>
		{#if hasPendingItems}
			<ul class="attention-list">
				{#each attentions.pendingItems as item (item.id)}
					<li>
						<span class="attention-kind">Pendência</span>
						<p class="attention-text">{item.label}</p>
						<a href="/projects/{projectId}/now?activity={item.activityDefinitionId}">Retomar atividade →</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Nenhuma pendência metodológica em aberto.</p>
		{/if}
	</section>

	<section class="card impediment-management" aria-labelledby="impediment-management-heading">
		<h2 id="impediment-management-heading">Gestão de impedimentos</h2>
		<p class="subtitle-inline">Registre, classifique e acompanhe cada impedimento até resolver.</p>

		<form method="POST" action="?/addImpediment" use:enhance={handleAddSubmit} class="add-impediment-form">
			<label class="visually-hidden" for="impediment-text">Descrição</label>
			<input
				id="impediment-text"
				type="text"
				name="text"
				placeholder="Descreva o impedimento..."
				required
				bind:value={newText}
			/>
			<label class="visually-hidden" for="impediment-tipo">Tipo</label>
			<select id="impediment-tipo" name="tipo" required bind:value={newTipo}>
				<option value="" disabled>Selecione o tipo...</option>
				{#each TIPOS as tipo (tipo)}
					<option value={tipo}>{tipoLabel[tipo]}</option>
				{/each}
			</select>
			<button type="submit">Adicionar</button>
		</form>

		{#if attentions.impediments.open.length === 0}
			<p class="empty">Nenhum impedimento aberto.</p>
		{:else}
			<ul class="impediment-list">
				{#each attentions.impediments.open as impediment (impediment.id)}
					{#if editingImpedimentId === impediment.id}
						<li class="impediment-row editing">
							<p class="impediment-text">{impediment.text}</p>
							<div class="impediment-edit-fields">
								<form method="POST" action="?/setType" use:enhance class="tipo-form">
									<input type="hidden" name="impedimentId" value={impediment.id} />
									<label for="tipo-{impediment.id}">Tipo</label>
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
								<form method="POST" action="?/setNextAction" use:enhance class="next-action-form">
									<input type="hidden" name="impedimentId" value={impediment.id} />
									<label for="next-action-{impediment.id}">Próxima ação</label>
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
								{#if impediment.tipo === 'decisao_pendente'}
									<form method="POST" action="?/setDecision" use:enhance class="decision-form">
										<input type="hidden" name="impedimentId" value={impediment.id} />
										<label for="decision-{impediment.id}">Decisão relacionada</label>
										<select
											id="decision-{impediment.id}"
											name="decisionId"
											value={impediment.decisionId ?? ''}
											onchange={(event) => event.currentTarget.form?.requestSubmit()}
										>
											<option value="">Nenhuma</option>
											{#each allDecisions as decision (decision.id)}
												<option value={decision.id}>{decision.subject}</option>
											{/each}
										</select>
									</form>
								{/if}
							</div>
							<div class="impediment-actions">
								<button type="button" class="button-secondary" onclick={() => toggleEdit(impediment.id)}>
									Concluir edição
								</button>
								<form method="POST" action="?/resolve" use:enhance class="resolve-form">
									<input type="hidden" name="impedimentId" value={impediment.id} />
									<button type="submit" class="button-secondary">Resolver</button>
								</form>
							</div>
						</li>
					{:else}
						<li class="impediment-row">
							<p class="impediment-text">{impediment.text}</p>
							<span class="impediment-tipo">{tipoLabel[impediment.tipo]}</span>
							{#if impediment.nextAction}
								<span class="impediment-next-action">Próxima ação: {impediment.nextAction}</span>
							{/if}
							{#if impediment.decisionSubject}
								<span class="impediment-decision">Decisão relacionada: {impediment.decisionSubject}</span>
							{/if}
							<div class="impediment-actions">
								<button type="button" class="link-button" onclick={() => toggleEdit(impediment.id)}>Editar</button>
								<form method="POST" action="?/resolve" use:enhance class="resolve-form">
									<input type="hidden" name="impedimentId" value={impediment.id} />
									<button type="submit" class="button-secondary">Resolver</button>
								</form>
							</div>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}

		<button
			type="button"
			class="resolved-toggle"
			aria-expanded={showResolved}
			aria-controls="resolved-impediments-list"
			onclick={() => (showResolved = !showResolved)}
		>
			Resolvidos ({attentions.impediments.resolved.length})
		</button>
		{#if showResolved}
			<div id="resolved-impediments-list">
				{#if attentions.impediments.resolved.length === 0}
					<p class="empty">Nenhum impedimento resolvido ainda.</p>
				{:else}
					<ul class="impediment-list">
						{#each attentions.impediments.resolved as impediment (impediment.id)}
							<li class="impediment-row resolved">
								<p class="impediment-text">{impediment.text}</p>
								<span class="impediment-tipo">{tipoLabel[impediment.tipo]}</span>
								{#if impediment.nextAction}
									<span class="impediment-next-action">Próxima ação registrada: {impediment.nextAction}</span>
								{/if}
								{#if impediment.decisionSubject}
									<span class="impediment-decision">Decisão relacionada: {impediment.decisionSubject}</span>
								{/if}
								<form method="POST" action="?/reopen" use:enhance class="reopen-form">
									<input type="hidden" name="impedimentId" value={impediment.id} />
									<button type="submit" class="button-secondary">Reabrir</button>
								</form>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</section>
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

	.attentions-page {
		max-width: 52rem;
	}

	header {
		margin-bottom: var(--space-5);
	}

	.eyebrow {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	h1 {
		margin: 0 0 var(--space-2);
	}

	.subtitle {
		color: var(--hydra-muted);
		max-width: 42rem;
		line-height: 1.55;
		margin: 0;
	}

	.card {
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		padding: var(--space-5);
		margin-bottom: var(--space-5);
	}

	.card h2 {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-subtitle);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		font-style: italic;
		margin: 0;
	}

	.section-link {
		font-size: var(--font-size-meta);
		font-weight: 700;
	}

	.attention-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.attention-kind {
		font-size: var(--font-size-caption);
		font-weight: 700;
		color: var(--hydra-editorial-accent);
		display: block;
		margin-bottom: var(--space-1);
	}

	.attention-text {
		margin: 0;
		font-size: var(--font-size-meta);
	}

	.attention-list a {
		font-size: var(--font-size-caption);
		font-weight: 700;
	}

	/* Gestão de impedimentos — mesmo vocabulário funcional já existente
	   (registrar, tipo, próxima ação, resolver, reabrir), com leitura/edição
	   alternadas por linha em vez de campos sempre editáveis. */
	.subtitle-inline {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	.add-impediment-form {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: var(--space-4);
	}

	.add-impediment-form input[type='text'] {
		flex: 1;
		min-width: 14rem;
	}

	input[type='text'],
	select {
		font: inherit;
		padding: 0.55rem 0.75rem;
		border-radius: var(--hydra-radius);
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface);
		color: var(--hydra-text);
	}

	.impediment-list {
		list-style: none;
		margin: 0 0 var(--space-4);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.impediment-row {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		background: var(--hydra-surface);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.impediment-row.editing {
		flex-direction: column;
		align-items: stretch;
		background: var(--hydra-surface);
		border-color: rgba(101, 104, 108, 0.4);
	}

	.impediment-row.resolved {
		opacity: 0.85;
	}

	.impediment-text {
		font-weight: 600;
		flex: 1;
		min-width: 12rem;
		margin: 0;
	}

	.impediment-tipo {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		padding: 0.2rem var(--space-3);
		border: 1px solid rgba(101, 104, 108, 0.3);
		border-radius: var(--hydra-radius-pill);
	}

	.impediment-next-action,
	.impediment-decision {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.impediment-actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-left: auto;
	}

	.link-button {
		background: none;
		border: none;
		padding: var(--space-1);
		font-size: var(--font-size-caption);
		font-weight: 700;
		text-decoration: underline;
		cursor: pointer;
		color: var(--hydra-text);
	}

	.impediment-edit-fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}

	.impediment-edit-fields form {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: var(--font-size-caption);
		font-weight: 600;
		color: var(--hydra-muted);
	}

	.next-action-form {
		flex: 1;
		min-width: 14rem;
	}

	.next-action-form input {
		width: 100%;
	}

	.decision-form {
		flex: 1;
		min-width: 14rem;
	}

	.decision-form select {
		width: 100%;
	}

	.resolved-toggle {
		background: none;
		border: none;
		padding: 0;
		font-size: var(--font-size-meta);
		font-weight: 700;
		cursor: pointer;
		color: var(--hydra-text);
	}

	#resolved-impediments-list {
		margin-top: var(--space-3);
	}

	/* Precisa de você (ETAPA 6 do rework, migrado de tracking/+page.svelte) —
	   sinal estreito e acionável: um WorkItem bloqueado por vez, com a
	   explicação e a ação de resolver logo ali. --hydra-warning é reservado a
	   conteúdo derivado pelo sistema (mesmo token usado no selo "Bloqueado"
	   de /work). */
	.need-you {
		border-color: var(--hydra-warning);
	}

	.blocked-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.blocked-card {
		border: 1px solid var(--hydra-warning);
		border-radius: var(--hydra-radius);
		padding: var(--space-5);
		background: var(--hydra-surface);
	}

	.blocked-badge {
		display: inline-block;
		font-size: var(--font-size-caption);
		font-weight: 700;
		color: var(--hydra-warning);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: var(--space-2);
	}

	.blocked-headline {
		margin: 0 0 var(--space-2);
		font-weight: 700;
		font-size: var(--font-size-body);
	}

	.blocked-impediment {
		margin: 0;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.blocked-text {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-meta);
	}

	.blocked-waiting {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
		overflow-wrap: anywhere;
	}

	.blocked-why {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-caption);
		font-style: italic;
		color: var(--hydra-muted);
	}

	.confirm-resolve {
		border: 1px dashed var(--hydra-warning);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		margin-bottom: var(--space-2);
		background: var(--hydra-surface-raised);
	}

	.confirm-resolve-text {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-caption);
		color: var(--hydra-text);
		line-height: 1.45;
	}

	.resolved-feedback {
		border: 1px solid var(--hydra-accent);
		border-radius: var(--hydra-radius);
		padding: var(--space-5);
		margin-bottom: var(--space-5);
		background: var(--hydra-surface);
	}

	.resolved-feedback-text {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-meta);
	}

	.resolved-feedback-actions {
		display: flex;
		align-items: center;
		gap: var(--space-5);
	}

	.blocked-actions {
		display: flex;
		align-items: center;
		gap: var(--space-5);
		flex-wrap: wrap;
	}

	.button-primary {
		background: var(--hydra-accent);
		color: var(--hydra-surface);
		border: none;
		border-radius: var(--hydra-radius);
		padding: var(--space-3) var(--space-5);
		font-weight: 700;
		font-size: var(--font-size-meta);
		cursor: pointer;
	}

	@media (max-width: 860px) {
		.impediment-actions {
			width: 100%;
			margin-left: 0;
		}

		.impediment-actions button,
		.impediment-actions .resolve-form button {
			min-height: 2.75rem;
			flex: 1;
		}

		.blocked-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.blocked-actions .button-primary {
			min-height: 2.75rem;
		}
	}
</style>
