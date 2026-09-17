<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import type { ScheduleBaselineCapturePreviewView } from '$lib/server/application/types';

	let { data, form } = $props();
	let projectId = $derived(data.view.projectId);
	let tracking = $derived(data.tracking);

	// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte,
	// hardening pós-dogfood) — preview NUNCA grava; guarda o candidato
	// completo localmente a partir do retorno da própria action, mesmo
	// espírito de propagationPreview (work/+page.svelte). A captura pode ser
	// recusada por inteiro (sem WorkItem elegível, conflito de precedência
	// conhecido, ou preview obsoleto — ver expectedBaselineCandidateJson
	// abaixo) — `update()` sempre roda, mesmo em falha, para `form?.message`
	// refletir a recusa em vez de falhar silenciosamente.
	let baselinePreview = $state<ScheduleBaselineCapturePreviewView | null>(null);

	function handleBaselinePreviewSubmit() {
		return async ({
			result,
			update
		}: {
			result: ActionResult;
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			if (result.type === 'success' && result.data && 'baselinePreview' in result.data) {
				baselinePreview = result.data.baselinePreview as ScheduleBaselineCapturePreviewView;
			}
			await update({ reset: false });
		};
	}

	function cancelBaselinePreview() {
		baselinePreview = null;
	}

	// Candidato canônico que a interface efetivamente mostrou (hardening
	// pós-dogfood) — devolvido sem alteração como `expected` na confirmação;
	// o servidor recalcula e compara, nunca confia neste JSON como fonte de
	// verdade (mesmo espírito de expectedPropagationPlanJson, work/+page.svelte).
	function expectedBaselineCandidateJson(preview: ScheduleBaselineCapturePreviewView): string {
		return JSON.stringify({
			entries: preview.entries.map((entry) => ({
				workItemId: entry.workItemId,
				plannedStart: entry.plannedStart,
				durationDays: entry.durationDays
			}))
		});
	}

	function handleBaselineCaptureSubmit() {
		return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			baselinePreview = null;
			await update({ reset: false });
		};
	}

	// reachedAt/reviewedAt são INSTANTE (timestamp gravado pelo Clock), então
	// aqui Date/Intl é o tratamento correto — ao contrário de plannedDate, que
	// é dia civil e chega da projeção já formatado como string, sem nunca
	// virar Date.
	const timestampFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

	// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte) —
	// positivo = atual mais tarde/mais longo, negativo = atual mais
	// cedo/mais curto, zero = sem alteração (convenção congelada em
	// domain/transitions.ts, computeScheduleBaselineComparison). Nunca
	// percentual, health score, atraso ou impacto crítico.
	function formatVarianceDays(days: number): string {
		if (days === 0) return 'sem alteração';
		const label = Math.abs(days) === 1 ? '1 dia' : `${Math.abs(days)} dias`;
		return days > 0 ? `+${label}` : `-${label}`;
	}
</script>

<svelte:head>
	<title>Acompanhamento — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<h1>Acompanhamento do projeto</h1>
<p class="subtitle">Retrato consolidado da fase atual e do trabalho em execução deste projeto.</p>
<p class="subtitle">
	Para trabalho bloqueado, impedimentos e pendências, use <a href="/projects/{projectId}/attentions">Atenções</a>. Para
	responder atividades ou avançar a jornada, use Agora.
</p>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

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

<!-- Linha do tempo (ETAPA 8 do rework, microcorte de Timeline;
     HYDRA_PRODUCT_REWORK.md §16). Só existe quando algum marco tem data
     planejada — §17: surface aparece por prontidão de dados, e uma seção vazia
     prometendo feature futura é exatamente o que a regra proíbe.

     Lista cronológica declarada, não Gantt: sem barra, sem escala, sem "hoje",
     sem atraso e sem comparar data planejada com data de alcance. Acompanhamento
     apenas PROJETA — quem edita a data é Trabalho, dono do marco. -->
{#if tracking.timeline.length > 0}
	<section class="card timeline" aria-labelledby="timeline-heading">
		<h2 id="timeline-heading">Linha do tempo</h2>
		<p class="subtitle-inline">
			Marcos e trabalhos com schedule declarado, do mais próximo ao mais distante. A data é o que você
			planejou; o estado é o que você declarou — sem cálculo de precedência ou propagação ainda.
		</p>

		<ul class="timeline-list">
			{#each tracking.timeline as entry (entry.id)}
				<li
					class="timeline-row"
					class:reached={entry.kind === 'milestone' && entry.status === 'alcancado'}
				>
					<span class="timeline-date">{entry.plannedDateLabel}</span>
					<span class="timeline-kind">{entry.kind === 'milestone' ? 'Marco' : 'Trabalho'}</span>
					<span class="timeline-title">{entry.title}</span>
					{#if entry.kind === 'milestone'}
						<!-- O estado declarado aparece uma vez só: quando o marco foi
						     alcançado, a própria frase com a data já É o estado. -->
						{#if entry.reachedAt === null}
							<span class="timeline-state">{entry.statusLabel}</span>
						{:else}
							<span class="timeline-state">
								{entry.statusLabel} em {timestampFormatter.format(new Date(entry.reachedAt))}
							</span>
						{/if}
					{:else}
						<span class="timeline-state">{entry.statusLabel} · {entry.durationLabel}</span>
					{/if}
				</li>
			{/each}
		</ul>

		<a class="section-link" href="/projects/{projectId}/work">Ver Trabalho →</a>
	</section>
{/if}

<!-- Card do Cronograma (ETAPA 12 do rework, §42, sexto microcorte —
     Design Gate "Corredor"): substitui a Linha do tempo assim que o
     Cronograma atinge readiness (tracking.timeline já vem vazio nesse
     caso — ver buildTrackingView) — as duas nunca aparecem juntas. Só
     fatos honestamente deriváveis, cada um condicional à sua própria
     existência (nunca linha vazia para fato inexistente). -->
{#if tracking.cronogramaReady && tracking.cronogramaCard}
	<section class="card cronograma-card" aria-labelledby="cronograma-heading">
		<h2 id="cronograma-heading">Cronograma</h2>
		{#if tracking.cronogramaCard.conflictCount > 0}
			<p class="cronograma-fact cronograma-fact-warning">
				{tracking.cronogramaCard.conflictCount}
				{tracking.cronogramaCard.conflictCount === 1
					? 'conflito de precedência conhecido.'
					: 'conflitos de precedência conhecidos.'}
			</p>
		{/if}
		{#if tracking.cronogramaCard.divergingFromBaselineCount !== null && tracking.cronogramaCard.divergingFromBaselineCount > 0}
			<p class="cronograma-fact">
				{tracking.cronogramaCard.divergingFromBaselineCount}
				{tracking.cronogramaCard.divergingFromBaselineCount === 1 ? 'trabalho difere' : 'trabalhos diferem'} da referência.
			</p>
		{/if}
		{#if tracking.cronogramaCard.unrepresentableFromBaselineCount !== null && tracking.cronogramaCard.unrepresentableFromBaselineCount > 0}
			<p class="cronograma-fact">
				{tracking.cronogramaCard.unrepresentableFromBaselineCount}
				{tracking.cronogramaCard.unrepresentableFromBaselineCount === 1
					? 'comparação com a referência não pôde ser calculada.'
					: 'comparações com a referência não puderam ser calculadas.'}
			</p>
		{/if}
		<a class="section-link" href="/projects/{projectId}/cronograma">Abrir Cronograma →</a>
	</section>
{/if}

<!-- Referência do cronograma (ETAPA 12 do rework, §42, quinto microcorte) —
     REFERÊNCIA explicitamente aprovada pelo usuário, nunca criada
     automaticamente: o primeiro clique sempre mostra um preview com
     confirmação explícita antes de congelar qualquer coisa. Compara
     plannedStart/durationDays atuais contra a baseline ATIVA (a mais
     recente); não congela Dependency, título, status ou Milestone, e não
     resolve nem antecipa caminho crítico. -->
<section class="card schedule-baseline" aria-labelledby="schedule-baseline-heading">
	<h2 id="schedule-baseline-heading">Referência do cronograma</h2>
	<p class="subtitle-inline">
		Uma referência congela o início e a duração de cada trabalho com cronograma completo, para comparar
		depois contra o cronograma atual. Nunca é criada automaticamente.
	</p>

	{#if tracking.scheduleBaseline !== null}
		<p class="subtitle-inline">
			Referência ativa criada em {timestampFormatter.format(new Date(tracking.scheduleBaseline.createdAt))}.
			{#if tracking.scheduleBaseline.partial}
				Parcial: nem todo trabalho tinha cronograma completo no momento da captura.
			{/if}
		</p>

		{#if tracking.scheduleBaseline.entries.length === 0}
			<p class="empty">Sem variação desde a referência.</p>
		{:else}
			<ul class="baseline-comparison-list">
				{#each tracking.scheduleBaseline.entries as entry (entry.workItemId)}
					<li class="baseline-comparison-row">
						<span class="baseline-comparison-title">{entry.workItemTitle}</span>
						{#if entry.kind === 'compared'}
							{#if entry.startVarianceDays === 0 && entry.finishVarianceDays === 0 && entry.durationVarianceDays === 0}
								<span class="baseline-comparison-state">Sem variação desde a referência.</span>
							{:else}
								<span class="baseline-comparison-state">
									Início {formatVarianceDays(entry.startVarianceDays)} · Término {formatVarianceDays(
										entry.finishVarianceDays
									)} · Duração {formatVarianceDays(entry.durationVarianceDays)}
								</span>
							{/if}
						{:else if entry.kind === 'compared_unrepresentable'}
							<span class="baseline-comparison-state">Variação não pôde ser calculada.</span>
						{:else if entry.kind === 'removed'}
							<span class="baseline-comparison-state">Cronograma removido após a referência.</span>
						{:else if entry.kind === 'scheduled_after'}
							<span class="baseline-comparison-state">Agendado após a referência.</span>
						{:else if entry.kind === 'added_after'}
							<span class="baseline-comparison-state">Adicionado após a referência.</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if baselinePreview !== null}
		<div class="baseline-preview">
			<p class="subtitle-inline"><strong>Prévia da referência</strong></p>
			<p class="subtitle-inline">
				{baselinePreview.scheduledCount}
				{baselinePreview.scheduledCount === 1 ? 'trabalho será capturado' : 'trabalhos serão capturados'}.
				{#if baselinePreview.uncoveredCount > 0}
					{baselinePreview.uncoveredCount}
					{baselinePreview.uncoveredCount === 1
						? 'trabalho ficará de fora, por não ter cronograma.'
						: 'trabalhos ficarão de fora, por não terem cronograma.'}
				{/if}
			</p>
			{#if baselinePreview.partial}
				<p class="subtitle-inline">Esta referência será parcial: nem todo trabalho tem cronograma completo ainda.</p>
			{/if}
			<form method="POST" action="?/captureScheduleBaseline" use:enhance={handleBaselineCaptureSubmit}>
				<input type="hidden" name="expectedCandidate" value={expectedBaselineCandidateJson(baselinePreview)} />
				<button type="submit" class="button-secondary">Confirmar referência</button>
			</form>
			<button type="button" class="link-button" onclick={cancelBaselinePreview}>Cancelar</button>
		</div>
	{:else}
		<form method="POST" action="?/previewScheduleBaselineCapture" use:enhance={handleBaselinePreviewSubmit}>
			<button type="submit" class="button-secondary">
				{tracking.scheduleBaseline === null
					? 'Congelar cronograma atual como referência'
					: 'Criar nova referência do cronograma'}
			</button>
		</form>
		{#if tracking.scheduleBaseline !== null}
			<p class="subtitle-inline">A referência atual será preservada — nenhuma sobrescrita.</p>
		{/if}
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

	.timeline-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.timeline-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding: var(--space-2) 0;
		border-bottom: 1px solid rgba(101, 104, 108, 0.18);
	}

	.timeline-row:last-child {
		border-bottom: none;
	}

	/* Tipografia de data tabular: alinha a coluna sem virar escala gráfica. */
	.timeline-date {
		flex: none;
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	/* Distingue WorkItem de Milestone sem depender só da palavra em
	   .timeline-title — mesmo espírito de .deliverable-badge em Trabalho. */
	.timeline-kind {
		flex: none;
		font-size: var(--font-size-caption);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--hydra-muted);
		border: 1px solid rgba(101, 104, 108, 0.3);
		border-radius: var(--hydra-radius-pill);
		padding: 0 var(--space-2);
	}

	.timeline-title {
		flex: 1;
		min-width: 10rem;
	}

	.timeline-state {
		flex: none;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	/* Card do Cronograma (ETAPA 12 do rework, §42, sexto microcorte) — mesmo
	   --hydra-warning já usado para conteúdo derivado pelo sistema em
	   work/+page.svelte (.precedence-conflict). */
	.cronograma-fact {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-body);
	}

	.cronograma-fact-warning {
		color: var(--hydra-warning);
		font-weight: 600;
	}

	/* Referência do cronograma (ETAPA 12 do rework, §42, quinto microcorte) —
	   mesmo molde de .timeline-list/.timeline-row acima: lista enxuta, sem
	   barra nem escala. */
	.baseline-comparison-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.baseline-comparison-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding: var(--space-2) 0;
		border-bottom: 1px solid rgba(101, 104, 108, 0.18);
	}

	.baseline-comparison-row:last-child {
		border-bottom: none;
	}

	.baseline-comparison-title {
		flex: 1;
		min-width: 10rem;
		font-weight: 700;
	}

	.baseline-comparison-state {
		flex: none;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.baseline-preview {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		margin-top: var(--space-3);
		padding: var(--space-3);
		border: 1px solid rgba(101, 104, 108, 0.3);
		border-radius: var(--hydra-radius);
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
