<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';

	let { data, form } = $props();
	let projectId = $derived(data.view.projectId);
	let tracking = $derived(data.tracking);

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
	let newText = $state('');
	let newTipo = $state('');
	// Só um impedimento em edição por vez — evita deixar todos os formulários
	// permanentemente expandidos (proposta aprovada no Claude Design).
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

	let hasAttentions = $derived(tracking.attentionPendingItems.length > 0 || tracking.impediments.open.length > 0);
	let hasBlocked = $derived(tracking.blockedWorkItems.length > 0);

	// Feedback pós-mutação de "marcar como resolvido" (achado de dogfooding:
	// a ação fazia o card sumir de "Precisa de você" sem nenhuma confirmação
	// de que o item foi desbloqueado nem de qual estado ele manteve). Captura
	// os dados do WorkItem ANTES do submit (o card vai sumir da lista após o
	// reload), para poder mostrar depois exatamente o que mudou.
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

	// "Atualizar situação" (achado de dogfooding: "Marcar como resolvido"
	// como ação de um clique só comunicava mutação definitiva imediata
	// demais). O primeiro clique nunca muta nada — só abre um estado de
	// confirmação contextual por card; a mutação real (resolveImpediment)
	// só acontece em "Confirmar que foi resolvido", uma ação explícita
	// separada, com "Cancelar" sempre disponível.
	let confirmingWorkItemId = $state<string | null>(null);

	function openConfirm(workItemId: string) {
		confirmingWorkItemId = workItemId;
	}
	function cancelConfirm() {
		confirmingWorkItemId = null;
	}
</script>

<svelte:head>
	<title>Acompanhamento — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<h1>Acompanhamento do projeto</h1>
<p class="subtitle">
	Retrato consolidado da fase atual, do trabalho em execução e do que está impedindo o avanço deste projeto.
</p>
<p class="subtitle">Para responder atividades ou avançar a jornada, use Agora.</p>

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
			{#each tracking.blockedWorkItems as blocked (blocked.workItemId)}
				<li class="blocked-card">
					<span class="blocked-badge">Bloqueado</span>
					<p class="blocked-headline">{blocked.title} está bloqueado</p>
					<p class="blocked-impediment">Impedimento ({tipoLabel[blocked.impedimentTipo]})</p>
					<p class="blocked-text">{blocked.impedimentText}</p>
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

{#if tracking.situation}
	<section class="card situation" aria-labelledby="situation-heading">
		<p class="eyebrow" id="situation-heading">Onde estamos</p>
		<div class="situation-grid">
			<div class="situation-item">
				<p class="situation-label">Fase atual</p>
				<p class="situation-value">{tracking.situation.phaseLabel}</p>
				<p class="situation-note">{tracking.situation.positionLabel}</p>
			</div>
			<div class="situation-item">
				<p class="situation-label">Atividade atual</p>
				<p class="situation-value">{tracking.situation.activityLabel}</p>
			</div>
			<div class="situation-item">
				<p class="situation-label">Progresso da fase</p>
				<p class="situation-value">{tracking.situation.progressLabel}</p>
				<div class="progress-bar" role="img" aria-label="Progresso da fase: {tracking.situation.progressLabel}">
					<div class="progress-fill" style="width: {tracking.situation.progressPercent}%"></div>
				</div>
			</div>
		</div>
	</section>
{/if}

<div class="summary-grid">
	<section class="card work-summary" aria-labelledby="work-heading">
		<h2 id="work-heading">Trabalho</h2>
		<div class="delivery-counts">
			<div>
				<p class="count-value">{tracking.work.counts.a_fazer}</p>
				<p class="count-label"><span aria-hidden="true">○</span> A fazer</p>
			</div>
			<div>
				<p class="count-value">{tracking.work.counts.em_andamento}</p>
				<p class="count-label"><span aria-hidden="true">◐</span> Em andamento</p>
			</div>
			<div>
				<p class="count-value">{tracking.work.counts.concluido}</p>
				<p class="count-label"><span aria-hidden="true">●</span> Concluído</p>
			</div>
		</div>

		{#if tracking.work.state === 'em_andamento'}
			<p class="section-label">Em andamento</p>
			<ul class="delivery-list">
				{#each tracking.work.inProgress as item (item.id)}
					<li>
						<span class="item-text">{item.title}</span>
					</li>
				{/each}
			</ul>
		{:else if tracking.work.state === 'concluido'}
			<p class="empty">Todo o trabalho foi concluído.</p>
		{:else if tracking.work.state === 'nenhuma'}
			<p class="empty">Nenhum item de trabalho disponível.</p>
		{:else}
			<p class="empty">Nenhum item em andamento.</p>
		{/if}

		<a class="section-link" href="/projects/{projectId}/work">Ver Trabalho →</a>
	</section>

	<section class="card attentions" aria-labelledby="attentions-heading">
		<h2 id="attentions-heading">Atenções</h2>
		{#if hasAttentions}
			<ul class="attention-list">
				{#each tracking.impediments.open as impediment (impediment.id)}
					<li>
						<span class="attention-kind">Impedimento</span>
						<p class="attention-text">{impediment.text}</p>
					</li>
				{/each}
				{#each tracking.attentionPendingItems as item (item.id)}
					<li>
						<span class="attention-kind">Pendência</span>
						<p class="attention-text">{item.label}</p>
						<a href="/projects/{projectId}/now?activity={item.activityDefinitionId}">Retomar atividade →</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">Nenhum impedimento ou pendência em aberto.</p>
		{/if}
	</section>
</div>

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

	{#if tracking.impediments.open.length === 0}
		<p class="empty">Nenhum impedimento aberto.</p>
	{:else}
		<ul class="impediment-list">
			{#each tracking.impediments.open as impediment (impediment.id)}
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
		Resolvidos ({tracking.impediments.resolved.length})
	</button>
	{#if showResolved}
		<div id="resolved-impediments-list">
			{#if tracking.impediments.resolved.length === 0}
				<p class="empty">Nenhum impedimento resolvido ainda.</p>
			{:else}
				<ul class="impediment-list">
					{#each tracking.impediments.resolved as impediment (impediment.id)}
						<li class="impediment-row resolved">
							<p class="impediment-text">{impediment.text}</p>
							<span class="impediment-tipo">{tipoLabel[impediment.tipo]}</span>
							{#if impediment.nextAction}
								<span class="impediment-next-action">Próxima ação registrada: {impediment.nextAction}</span>
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

<section class="card continuity" aria-labelledby="continuity-heading">
	<div>
		<p class="eyebrow" id="continuity-heading">Continuidade</p>
		<p class="continuity-label">{tracking.continuity.label}</p>
	</div>
	<a class="continuity-cta" href="/projects/{projectId}/now">Continuar em Agora →</a>
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
		max-width: 42rem;
		line-height: 1.55;
		margin: 0 0 var(--space-2);
	}

	.subtitle:last-of-type {
		margin-bottom: var(--space-5);
	}

	.card {
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		padding: var(--space-5);
		margin-bottom: var(--space-5);
	}

	.eyebrow {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
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

	/* Situação atual — resume "Onde estamos", sem repetir a superfície Agora
	   inteira: só fase, atividade e progresso compactos. */
	.situation-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-5);
	}

	.situation-item {
		padding-right: var(--space-5);
		border-right: 1px solid rgba(101, 104, 108, 0.2);
	}

	.situation-item:last-child {
		border-right: none;
		padding-right: 0;
	}

	.situation-label {
		margin: 0 0 var(--space-1);
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.situation-value {
		margin: 0;
		font-weight: 700;
		font-size: var(--font-size-body);
	}

	.situation-note {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	.progress-bar {
		height: 6px;
		border-radius: var(--hydra-radius-pill);
		background: var(--hydra-bg);
		overflow: hidden;
		margin-top: var(--space-2);
	}

	.progress-fill {
		height: 100%;
		border-radius: var(--hydra-radius-pill);
		background: var(--hydra-accent);
	}

	/* Entregas e Atenções: lado a lado no desktop, nenhuma domina a outra —
	   ordem visual (Entregas primeiro) inverte só no mobile (Atenções
	   primeiro), via CSS `order`; a ordem do DOM permanece estável porque as
	   duas seções são independentes entre si, sem dependência de foco ou de
	   leitura sequencial que a inversão visual possa prejudicar. */
	.summary-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-5);
		align-items: start;
	}

	.work-summary {
		order: 1;
	}

	.attentions {
		order: 2;
	}

	.delivery-counts {
		display: flex;
		gap: var(--space-5);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid rgba(101, 104, 108, 0.2);
		margin-bottom: var(--space-4);
	}

	.count-value {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.count-label {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.section-label {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.delivery-list {
		list-style: none;
		margin: 0 0 var(--space-4);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.delivery-list li {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		padding: var(--space-3) var(--space-4);
	}

	.item-text {
		font-weight: 600;
		display: block;
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

	.impediment-next-action {
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

	/* Continuidade — ponte discreta de volta a Agora; não deve competir
	   visualmente com o CTA de próxima ação que já vive lá. */
	.continuity {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
		background: var(--hydra-surface);
	}

	.continuity-label {
		margin: 0;
		font-weight: 700;
		font-size: var(--font-size-body);
	}

	.continuity-cta {
		font-size: var(--font-size-meta);
		font-weight: 700;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--hydra-radius);
		background: var(--hydra-accent);
		color: var(--hydra-surface);
		text-decoration: none;
		white-space: nowrap;
	}

	.continuity-cta:hover {
		text-decoration: underline;
	}

	/* Precisa de você (ETAPA 6 do rework) — sinal estreito e acionável: um
	   WorkItem bloqueado por vez, com a explicação e a ação de resolver logo
	   ali. --hydra-warning é reservado a conteúdo derivado pelo sistema
	   (mesmo token usado no selo "Bloqueado" de /work). */
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

	.blocked-why {
		margin: 0 0 var(--space-3);
		font-size: var(--font-size-caption);
		font-style: italic;
		color: var(--hydra-muted);
	}

	/* Contexto explícito antes da mutação (achado de dogfooding, ver §2 do
	   corte): a ação precisa deixar claro que a resolução aconteceu no mundo
	   real e que o Hydra só está sendo atualizado com esse resultado — nunca
	   "resolve sozinho". */
	/* Estado de confirmação (achado de dogfooding: "Marcar como resolvido"
	   como ação de um clique só comunicava mutação definitiva demais) —
	   contexto explícito antes da mutação real, aberto só depois de
	   "Atualizar situação", nunca no primeiro clique. */
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
		.situation-grid {
			grid-template-columns: 1fr;
			gap: var(--space-4);
		}

		.situation-item {
			border-right: none;
			padding-right: 0;
			padding-bottom: var(--space-3);
			border-bottom: 1px solid rgba(101, 104, 108, 0.2);
		}

		.situation-item:last-child {
			border-bottom: none;
			padding-bottom: 0;
		}

		.summary-grid {
			grid-template-columns: 1fr;
		}

		/* Ordem mobile aprovada: Atenções antes de Trabalho. */
		.attentions {
			order: 1;
		}

		.work-summary {
			order: 2;
		}

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

		.continuity {
			flex-direction: column;
			align-items: stretch;
			text-align: left;
		}

		.continuity-cta {
			text-align: center;
			min-height: 2.75rem;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
