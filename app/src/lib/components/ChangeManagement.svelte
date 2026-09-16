<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import type { ChangeView } from '$lib/server/application/types';

	// Mudanças (ETAPA 11 do rework, §41; região secundária do workspace de
	// Decisões na ETAPA 13, D065/D066) — sem lifecycle próprio além de
	// criar/editar declaração/impacto; `Change` permanece distinto de
	// `Decision` (nunca fundidos, nunca "tipo de Decision").
	let { changes }: { changes: ChangeView[] } = $props();

	let newChangeStatement = $state('');
	let editingChangeId = $state<string | null>(null);

	function handleAddChangeSubmit() {
		return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			if (result.type === 'success') {
				newChangeStatement = '';
			}
			await update({ reset: false });
		};
	}

	function toggleEditChange(id: string) {
		editingChangeId = editingChangeId === id ? null : id;
	}

	function changeImpactLabel(impact: string | null): string {
		return impact ? `Impacto: ${impact}` : 'Nenhum impacto registrado';
	}
</script>

<section class="card change-management" aria-labelledby="change-management-heading">
	<h2 id="change-management-heading">Mudanças</h2>
	<p class="subtitle-inline">Registre e edite as mudanças relevantes deste projeto.</p>

	<form method="POST" action="?/addChange" use:enhance={handleAddChangeSubmit} class="add-change-form">
		<label class="visually-hidden" for="change-statement">O que mudou</label>
		<input
			id="change-statement"
			type="text"
			name="statement"
			placeholder="O que mudou?"
			required
			bind:value={newChangeStatement}
		/>
		<button type="submit">Adicionar</button>
	</form>

	{#if changes.length === 0}
		<p class="empty">Nenhuma mudança registrada.</p>
	{:else}
		<ul class="change-list">
			{#each changes as change (change.id)}
				{#if editingChangeId === change.id}
					<li class="change-row editing">
						<form method="POST" action="?/editChangeStatement" use:enhance class="change-statement-form">
							<input type="hidden" name="changeId" value={change.id} />
							<label class="visually-hidden" for="statement-{change.id}">O que mudou</label>
							<input id="statement-{change.id}" type="text" name="statement" value={change.statement} required />
							<button type="submit" class="button-secondary">Salvar</button>
						</form>
						<form method="POST" action="?/setChangeImpact" use:enhance class="change-response-form">
							<input type="hidden" name="changeId" value={change.id} />
							<label class="visually-hidden" for="impact-{change.id}">Impacto</label>
							<textarea
								id="impact-{change.id}"
								name="impact"
								placeholder="Impacto conhecido (opcional)"
								value={change.impact ?? ''}
							></textarea>
							<button type="submit" class="button-secondary">Salvar impacto</button>
						</form>
						<div class="change-actions">
							<button type="button" class="button-secondary" onclick={() => toggleEditChange(change.id)}>
								Concluir edição
							</button>
						</div>
					</li>
				{:else}
					<li class="change-row">
						<p class="change-text">{change.statement}</p>
						<p class="change-assessment">{changeImpactLabel(change.impact)}</p>
						<div class="change-actions">
							<button type="button" class="link-button" onclick={() => toggleEditChange(change.id)}>Editar</button>
						</div>
					</li>
				{/if}
			{/each}
		</ul>
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
		margin-bottom: 0;
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

	.add-change-form {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: var(--space-4);
	}

	.add-change-form input[type='text'] {
		flex: 1;
		min-width: 14rem;
	}

	.change-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.change-row {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		background: var(--hydra-surface);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.change-row.editing {
		flex-direction: column;
		align-items: stretch;
		background: var(--hydra-surface);
		border-color: rgba(101, 104, 108, 0.4);
	}

	.change-text {
		font-weight: 600;
		flex: 1;
		min-width: 12rem;
		margin: 0;
	}

	.change-actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-left: auto;
	}

	.change-statement-form {
		display: flex;
		gap: var(--space-3);
		align-items: center;
	}

	.change-statement-form input {
		flex: 1;
	}

	.change-assessment {
		flex-basis: 100%;
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.change-response-form {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.change-response-form textarea {
		min-height: 4.5rem;
		resize: vertical;
	}

	@media (max-width: 860px) {
		.change-actions {
			width: 100%;
			margin-left: 0;
		}

		.change-actions button {
			min-height: 2.75rem;
			flex: 1;
		}
	}
</style>
