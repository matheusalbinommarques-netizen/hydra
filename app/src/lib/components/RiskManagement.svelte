<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import type { RisksView } from '$lib/risk-view';

	// Surface compartilhada do lifecycle de Risk (D065/D066) — reaproveitada
	// por Acompanhamento (`/tracking`, temporário) e Riscos (`/risks`, S13,
	// primeiro microcorte). Cada rota hospedeira define suas próprias actions
	// (`?/addRisk`, `?/editRiskStatement`, ...) sobre o mesmo `addRisk`/
	// `closeRisk`/etc. de `project-use-cases.ts` — este componente só
	// encapsula apresentação e estado local de edição, nunca decide nem
	// duplica o lifecycle real do domínio.
	let { risks }: { risks: RisksView } = $props();

	let newRiskStatement = $state('');
	// Só um risco em edição por vez.
	let editingRiskId = $state<string | null>(null);
	let showClosedRisks = $state(false);

	function handleAddRiskSubmit() {
		return async ({ result, update }: { result: ActionResult; update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			if (result.type === 'success') {
				newRiskStatement = '';
			}
			await update({ reset: false });
		};
	}

	function toggleEditRisk(id: string) {
		editingRiskId = editingRiskId === id ? null : id;
	}

	const timestampFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

	// reviewedAt é fato factual ("quando alguém olhou por último"), nunca
	// urgência — por isso o rótulo é sempre uma data absoluta ou "sem revisão
	// registrada", nunca "há N dias"/atrasado (ETAPA 10 do rework).
	function riskReviewLabel(reviewedAt: string | null): string {
		if (!reviewedAt) return 'Sem revisão registrada';
		return `Última revisão: ${timestampFormatter.format(new Date(reviewedAt))}`;
	}

	// Avaliação qualitativa (ETAPA 10 do rework, terceiro microcorte) — só
	// probabilidade/impacto, nunca score/matriz/porcentagem.
	const likelihoodLabel: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
	const impactLabel: Record<string, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };

	function riskAssessmentLabel(likelihood: string | null, impact: string | null): string {
		if (!likelihood || !impact) return 'Sem avaliação registrada';
		return `Avaliação: probabilidade ${likelihoodLabel[likelihood]} · impacto ${impactLabel[impact]}`;
	}

	function riskResponseLabel(response: string | null): string {
		return response ? `Resposta planejada: ${response}` : 'Nenhuma resposta registrada';
	}
</script>

<section class="card risk-management" aria-labelledby="risk-management-heading">
	<h2 id="risk-management-heading">Riscos</h2>
	<p class="subtitle-inline">Registre, edite e acompanhe os riscos do projeto até encerrá-los.</p>

	<form method="POST" action="?/addRisk" use:enhance={handleAddRiskSubmit} class="add-risk-form">
		<label class="visually-hidden" for="risk-statement">Declaração do risco</label>
		<input
			id="risk-statement"
			type="text"
			name="statement"
			placeholder="Descreva o risco..."
			required
			bind:value={newRiskStatement}
		/>
		<button type="submit">Adicionar</button>
	</form>

	{#if risks.open.length === 0}
		<p class="empty">Nenhum risco aberto.</p>
	{:else}
		<ul class="risk-list">
			{#each risks.open as risk (risk.id)}
				{#if editingRiskId === risk.id}
					<li class="risk-row editing">
						<form method="POST" action="?/editRiskStatement" use:enhance class="risk-statement-form">
							<input type="hidden" name="riskId" value={risk.id} />
							<label class="visually-hidden" for="statement-{risk.id}">Declaração do risco</label>
							<input id="statement-{risk.id}" type="text" name="statement" value={risk.statement} required />
							<button type="submit" class="button-secondary">Salvar</button>
						</form>

						<form method="POST" action="?/setRiskAssessment" use:enhance class="risk-assessment-form">
							<input type="hidden" name="riskId" value={risk.id} />
							<label class="visually-hidden" for="likelihood-{risk.id}">Probabilidade</label>
							<select id="likelihood-{risk.id}" name="likelihood">
								<option value="" selected={risk.likelihood === null}>Sem avaliação</option>
								<option value="baixa" selected={risk.likelihood === 'baixa'}>Probabilidade baixa</option>
								<option value="media" selected={risk.likelihood === 'media'}>Probabilidade média</option>
								<option value="alta" selected={risk.likelihood === 'alta'}>Probabilidade alta</option>
							</select>
							<label class="visually-hidden" for="impact-{risk.id}">Impacto</label>
							<select id="impact-{risk.id}" name="impact">
								<option value="" selected={risk.impact === null}>Sem avaliação</option>
								<option value="baixo" selected={risk.impact === 'baixo'}>Impacto baixo</option>
								<option value="medio" selected={risk.impact === 'medio'}>Impacto médio</option>
								<option value="alto" selected={risk.impact === 'alto'}>Impacto alto</option>
							</select>
							<button type="submit" class="button-secondary">Salvar avaliação</button>
						</form>

						<form method="POST" action="?/setRiskResponse" use:enhance class="risk-response-form">
							<input type="hidden" name="riskId" value={risk.id} />
							<label class="visually-hidden" for="response-{risk.id}">Resposta planejada</label>
							<textarea
								id="response-{risk.id}"
								name="response"
								placeholder="Resposta planejada (opcional)"
								value={risk.response ?? ''}
							></textarea>
							<button type="submit" class="button-secondary">Salvar resposta</button>
						</form>

						<p class="risk-review">{riskReviewLabel(risk.reviewedAt)}</p>
						<div class="risk-actions">
							<button type="button" class="button-secondary" onclick={() => toggleEditRisk(risk.id)}>
								Concluir edição
							</button>
							<form method="POST" action="?/closeRisk" use:enhance class="close-risk-form">
								<input type="hidden" name="riskId" value={risk.id} />
								<button type="submit" class="button-secondary">Encerrar</button>
							</form>
						</div>
					</li>
				{:else}
					<li class="risk-row">
						<p class="risk-text">{risk.statement}</p>
						<p class="risk-assessment">{riskAssessmentLabel(risk.likelihood, risk.impact)}</p>
						<p class="risk-response">{riskResponseLabel(risk.response)}</p>
						<p class="risk-review">{riskReviewLabel(risk.reviewedAt)}</p>
						<div class="risk-actions">
							<button type="button" class="link-button" onclick={() => toggleEditRisk(risk.id)}>Editar</button>
							<form method="POST" action="?/reviewRisk" use:enhance class="review-risk-form">
								<input type="hidden" name="riskId" value={risk.id} />
								<button type="submit" class="button-secondary">Revisar</button>
							</form>
							<form method="POST" action="?/closeRisk" use:enhance class="close-risk-form">
								<input type="hidden" name="riskId" value={risk.id} />
								<button type="submit" class="button-secondary">Encerrar</button>
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
		aria-expanded={showClosedRisks}
		aria-controls="closed-risks-list"
		onclick={() => (showClosedRisks = !showClosedRisks)}
	>
		Encerrados ({risks.closed.length})
	</button>
	{#if showClosedRisks}
		<div id="closed-risks-list">
			{#if risks.closed.length === 0}
				<p class="empty">Nenhum risco encerrado ainda.</p>
			{:else}
				<ul class="risk-list">
					{#each risks.closed as risk (risk.id)}
						<li class="risk-row resolved">
							<p class="risk-text">{risk.statement}</p>
							<p class="risk-assessment">{riskAssessmentLabel(risk.likelihood, risk.impact)}</p>
							<p class="risk-response">{riskResponseLabel(risk.response)}</p>
							<p class="risk-review">{riskReviewLabel(risk.reviewedAt)}</p>
							<form method="POST" action="?/reopenRisk" use:enhance class="reopen-risk-form">
								<input type="hidden" name="riskId" value={risk.id} />
								<button type="submit" class="button-secondary">Reabrir</button>
							</form>
						</li>
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

	.add-risk-form {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		align-items: center;
		margin-bottom: var(--space-4);
	}

	.add-risk-form input[type='text'] {
		flex: 1;
		min-width: 14rem;
	}

	.risk-list {
		list-style: none;
		margin: 0 0 var(--space-4);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.risk-row {
		border: 1px solid rgba(101, 104, 108, 0.22);
		border-radius: var(--hydra-radius);
		padding: var(--space-4);
		background: var(--hydra-surface);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.risk-row.editing {
		flex-direction: column;
		align-items: stretch;
		background: var(--hydra-surface);
		border-color: rgba(101, 104, 108, 0.4);
	}

	.risk-row.resolved {
		opacity: 0.85;
	}

	.risk-text {
		font-weight: 600;
		flex: 1;
		min-width: 12rem;
		margin: 0;
	}

	.risk-review {
		flex-basis: 100%;
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.risk-actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-left: auto;
	}

	.risk-statement-form {
		display: flex;
		gap: var(--space-3);
		align-items: center;
	}

	.risk-statement-form input {
		flex: 1;
	}

	.risk-assessment,
	.risk-response {
		flex-basis: 100%;
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.risk-assessment-form {
		flex-basis: 100%;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
	}

	.risk-response-form {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.risk-response-form textarea {
		min-height: 4.5rem;
		resize: vertical;
	}

	#closed-risks-list {
		margin-top: var(--space-3);
	}

	@media (max-width: 860px) {
		.risk-actions {
			width: 100%;
			margin-left: 0;
		}

		.risk-actions button,
		.risk-actions .close-risk-form button {
			min-height: 2.75rem;
			flex: 1;
		}
	}
</style>
