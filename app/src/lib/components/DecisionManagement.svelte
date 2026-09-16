<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import type { DecisionsView, DecisionWorkItemOption } from '$lib/decision-view';

	// Surface própria de Decision (D065/D066, ETAPA 13, segundo microcorte) —
	// mesmo espírito de RiskManagement.svelte: a rota hospedeira (`/decisions`)
	// define suas próprias actions (`?/addDecision`, `?/editDecision`, ...)
	// sobre o mesmo lifecycle real de `project-use-cases.ts`; este componente
	// só encapsula apresentação e estado local de edição.
	let { decisions, workItemOptions }: { decisions: DecisionsView; workItemOptions: DecisionWorkItemOption[] } =
		$props();

	let newDecisionSubject = $state('');
	// Só uma decisão em edição por vez.
	let editingDecisionId = $state<string | null>(null);
	let showDecidedDecisions = $state(false);

	function handleAddDecisionSubmit() {
		return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			if (result.type === 'success') {
				newDecisionSubject = '';
			}
			await update({ reset: false });
		};
	}

	function toggleEditDecision(id: string) {
		editingDecisionId = editingDecisionId === id ? null : id;
	}

	// Ter prazo declarado não implica nenhuma regra de urgência automática
	// (§41) — o rótulo é sempre a data crua, nunca "atrasado"/"há N dias".
	function decisionDueDateLabel(dueDate: string | null): string {
		if (!dueDate) return 'Sem prazo declarado';
		const [year, month, day] = dueDate.split('-');
		return `Prazo: ${day}/${month}/${year}`;
	}

	function decisionOptionsLabel(options: string | null): string {
		return options ? `Opções: ${options}` : 'Nenhuma opção registrada';
	}

	function decisionResponsibleLabel(responsible: string | null): string {
		return responsible ? `Responsável: ${responsible}` : 'Sem responsável definido';
	}

	// "Trabalhos afetados" (ETAPA 11 do rework, terceiro microcorte, §41) —
	// opções do seletor excluem WorkItems já associados a esta Decision, para
	// não oferecer uma duplicata que o domínio recusaria.
	function availableWorkItemsFor(decision: { affectedWorkItems: { workItemId: string }[] }) {
		const linkedIds = new Set(decision.affectedWorkItems.map((link) => link.workItemId));
		return workItemOptions.filter((option) => !linkedIds.has(option.id));
	}
</script>

<section class="card decision-management" aria-labelledby="decision-management-heading">
	<h2 id="decision-management-heading">Decisões</h2>
	<p class="subtitle-inline">Registre, edite e marque as decisões do projeto como tomadas.</p>

	<form method="POST" action="?/addDecision" use:enhance={handleAddDecisionSubmit} class="add-decision-form">
		<label class="visually-hidden" for="decision-subject">O que precisa ser decidido</label>
		<input
			id="decision-subject"
			type="text"
			name="subject"
			placeholder="O que precisa ser decidido?"
			required
			bind:value={newDecisionSubject}
		/>
		<button type="submit">Adicionar</button>
	</form>

	{#if decisions.pending.length === 0}
		<p class="empty">Nenhuma decisão pendente.</p>
	{:else}
		<ul class="decision-list">
			{#each decisions.pending as decision (decision.id)}
				{#if editingDecisionId === decision.id}
					<li class="decision-row editing">
						<form method="POST" action="?/editDecision" use:enhance class="decision-statement-form">
							<input type="hidden" name="decisionId" value={decision.id} />
							<label class="visually-hidden" for="subject-{decision.id}">Assunto</label>
							<input id="subject-{decision.id}" type="text" name="subject" value={decision.subject} required />
							<label class="visually-hidden" for="due-date-{decision.id}">Prazo</label>
							<input id="due-date-{decision.id}" type="date" name="dueDate" value={decision.dueDate ?? ''} />
							<label class="visually-hidden" for="options-{decision.id}">Opções consideradas</label>
							<textarea
								id="options-{decision.id}"
								name="options"
								placeholder="Opções consideradas (opcional)"
								value={decision.options ?? ''}
							></textarea>
							<label class="visually-hidden" for="responsible-{decision.id}">Responsável</label>
							<input
								id="responsible-{decision.id}"
								type="text"
								name="responsible"
								placeholder="Responsável (opcional)"
								value={decision.responsible ?? ''}
							/>
							<button type="submit" class="button-secondary">Salvar</button>
						</form>
						<form method="POST" action="?/decideDecision" use:enhance class="decision-response-form">
							<input type="hidden" name="decisionId" value={decision.id} />
							<label class="visually-hidden" for="outcome-{decision.id}">Resultado</label>
							<textarea id="outcome-{decision.id}" name="outcome" placeholder="Resultado da decisão" required
							></textarea>
							<button type="submit" class="button-secondary">Marcar como tomada</button>
						</form>
						<div class="decision-actions">
							<button type="button" class="button-secondary" onclick={() => toggleEditDecision(decision.id)}>
								Concluir edição
							</button>
						</div>
					</li>
				{:else}
					<li class="decision-row">
						<p class="decision-text">{decision.subject}</p>
						<p class="decision-assessment">{decisionOptionsLabel(decision.options)}</p>
						<p class="decision-response">{decisionDueDateLabel(decision.dueDate)}</p>
						<p class="decision-response">{decisionResponsibleLabel(decision.responsible)}</p>
						<div class="affected-work-items">
							<p class="affected-work-items-label">Trabalhos afetados</p>
							{#if decision.affectedWorkItems.length === 0}
								<p class="empty">Nenhum trabalho relacionado.</p>
							{:else}
								<ul class="affected-work-items-list">
									{#each decision.affectedWorkItems as link (link.decisionAffectedWorkItemId)}
										<li>
											<span>{link.title}</span>
											<form method="POST" action="?/unlinkWorkItem" use:enhance>
												<input
													type="hidden"
													name="decisionAffectedWorkItemId"
													value={link.decisionAffectedWorkItemId}
												/>
												<button type="submit" class="link-button">Remover</button>
											</form>
										</li>
									{/each}
								</ul>
							{/if}
							{#if availableWorkItemsFor(decision).length > 0}
								<form method="POST" action="?/linkWorkItem" use:enhance class="affected-work-items-form">
									<input type="hidden" name="decisionId" value={decision.id} />
									<label class="visually-hidden" for="affected-work-item-{decision.id}">Adicionar trabalho afetado</label>
									<select id="affected-work-item-{decision.id}" name="workItemId" required>
										<option value="">Adicionar trabalho afetado…</option>
										{#each availableWorkItemsFor(decision) as option (option.id)}
											<option value={option.id}>{option.title}</option>
										{/each}
									</select>
									<button type="submit" class="button-secondary">Associar</button>
								</form>
							{/if}
						</div>
						<div class="decision-actions">
							<button type="button" class="link-button" onclick={() => toggleEditDecision(decision.id)}>Editar</button>
						</div>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}

	<button
		type="button"
		class="resolved-toggle"
		aria-expanded={showDecidedDecisions}
		aria-controls="decided-decisions-list"
		onclick={() => (showDecidedDecisions = !showDecidedDecisions)}
	>
		Tomadas ({decisions.decided.length})
	</button>
	{#if showDecidedDecisions}
		<div id="decided-decisions-list">
			{#if decisions.decided.length === 0}
				<p class="empty">Nenhuma decisão tomada ainda.</p>
			{:else}
				<ul class="decision-list">
					{#each decisions.decided as decision (decision.id)}
						{#if editingDecisionId === decision.id}
							<li class="decision-row editing">
								<form method="POST" action="?/editDecisionOutcome" use:enhance class="decision-response-form">
									<input type="hidden" name="decisionId" value={decision.id} />
									<label class="visually-hidden" for="outcome-edit-{decision.id}">Resultado</label>
									<textarea id="outcome-edit-{decision.id}" name="outcome" required>{decision.outcome}</textarea>
									<button type="submit" class="button-secondary">Corrigir resultado</button>
								</form>
								<div class="decision-actions">
									<button type="button" class="button-secondary" onclick={() => toggleEditDecision(decision.id)}>
										Concluir edição
									</button>
								</div>
							</li>
						{:else}
							<li class="decision-row resolved">
								<p class="decision-text">{decision.subject}</p>
								<p class="decision-assessment">Resultado: {decision.outcome}</p>
								<p class="decision-response">{decisionDueDateLabel(decision.dueDate)}</p>
								<p class="decision-response">{decisionResponsibleLabel(decision.responsible)}</p>
								<div class="affected-work-items">
									<p class="affected-work-items-label">Trabalhos afetados</p>
									{#if decision.affectedWorkItems.length === 0}
										<p class="empty">Nenhum trabalho relacionado.</p>
									{:else}
										<ul class="affected-work-items-list">
											{#each decision.affectedWorkItems as link (link.decisionAffectedWorkItemId)}
												<li>
													<span>{link.title}</span>
													<form method="POST" action="?/unlinkWorkItem" use:enhance>
														<input
															type="hidden"
															name="decisionAffectedWorkItemId"
															value={link.decisionAffectedWorkItemId}
														/>
														<button type="submit" class="link-button">Remover</button>
													</form>
												</li>
											{/each}
										</ul>
									{/if}
									{#if availableWorkItemsFor(decision).length > 0}
										<form method="POST" action="?/linkWorkItem" use:enhance class="affected-work-items-form">
											<input type="hidden" name="decisionId" value={decision.id} />
											<label class="visually-hidden" for="affected-work-item-{decision.id}">
												Adicionar trabalho afetado
											</label>
											<select id="affected-work-item-{decision.id}" name="workItemId" required>
												<option value="">Adicionar trabalho afetado…</option>
												{#each availableWorkItemsFor(decision) as option (option.id)}
													<option value={option.id}>{option.title}</option>
												{/each}
											</select>
											<button type="submit" class="button-secondary">Associar</button>
										</form>
									{/if}
								</div>
								<div class="decision-actions">
									<button type="button" class="link-button" onclick={() => toggleEditDecision(decision.id)}>
										Corrigir resultado
									</button>
								</div>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>
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

	.subtitle-inline {
		margin: 0 0 var(--space-4);
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
	}

	.empty {
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		font-style: italic;
		margin: 0;
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

	.resolved-toggle {
		background: none;
		border: none;
		padding: 0;
		font-size: var(--font-size-meta);
		font-weight: 700;
		cursor: pointer;
		color: var(--hydra-text);
	}

	.add-decision-form {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: var(--space-4);
	}

	.add-decision-form input[type='text'] {
		flex: 1;
		min-width: 14rem;
	}

	.decision-list {
		list-style: none;
		margin: 0 0 var(--space-4);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.decision-row {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		background: var(--hydra-surface);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.decision-row.editing {
		flex-direction: column;
		align-items: stretch;
		background: var(--hydra-surface);
		border-color: rgba(101, 104, 108, 0.4);
	}

	.decision-row.resolved {
		opacity: 0.85;
	}

	.decision-text {
		font-weight: 600;
		flex: 1;
		min-width: 12rem;
		margin: 0;
	}

	.affected-work-items {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		border-top: 1px solid rgba(101, 104, 108, 0.16);
		padding-top: var(--space-2);
		margin-top: var(--space-1);
	}

	.affected-work-items-label {
		margin: 0;
		font-size: var(--font-size-caption);
		font-weight: 600;
		color: var(--hydra-muted);
	}

	.affected-work-items-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.affected-work-items-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.affected-work-items-form {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.affected-work-items-form select {
		flex: 1;
		min-width: 12rem;
	}

	.decision-actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-left: auto;
	}

	.decision-statement-form {
		display: flex;
		gap: var(--space-3);
		align-items: center;
	}

	.decision-statement-form input {
		flex: 1;
	}

	.decision-assessment,
	.decision-response {
		flex-basis: 100%;
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.decision-response-form {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.decision-response-form textarea {
		min-height: 4.5rem;
		resize: vertical;
	}

	#decided-decisions-list {
		margin-top: var(--space-3);
	}

	@media (max-width: 860px) {
		.decision-actions {
			width: 100%;
			margin-left: 0;
		}

		.decision-actions button {
			min-height: 2.75rem;
			flex: 1;
		}
	}
</style>
