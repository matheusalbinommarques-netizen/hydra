<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionResult } from '@sveltejs/kit';
	import { addCivilDays } from '$lib/domain';
	import type { ScheduleBaselineCapturePreviewView } from '$lib/server/application/types';
	import type { CronogramaWorkItemRow } from './cronograma-view';

	let { data, form } = $props();
	let projectId = $derived(data.projectId);
	let cronograma = $derived(data.cronograma);
	let axis = $derived(cronograma.axis);

	// Referência do cronograma (ETAPA 13 do rework, §43 — D068) — preview
	// NUNCA grava; guarda o candidato completo localmente a partir do
	// retorno da própria action, mesmo espírito de propagationPreview
	// (work/+page.svelte). A captura pode ser recusada por inteiro (sem
	// WorkItem elegível, conflito de precedência conhecido, ou preview
	// obsoleto — ver expectedBaselineCandidateJson abaixo) — `update()`
	// sempre roda, mesmo em falha, para `form?.message` refletir a recusa em
	// vez de falhar silenciosamente.
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

	const ROW_HEIGHT = 44;
	const GROUP_HEADER_HEIGHT = 28;
	const MILESTONE_ROW_HEIGHT = 36;
	const DAY_WIDTH = 32;

	// dd/mm a partir das partes da própria string — mesmo tratamento de
	// tracking-view.ts/work-view.ts (sem Date/Intl, semântica é dia civil).
	function formatShortDate(civilDate: string): string {
		const [, month, day] = civilDate.split('-');
		return `${day}/${month}`;
	}

	// Marcas semanais da régua, derivadas de axis.startDate (dia civil cru) —
	// sempre inclui o último dia do intervalo, mesmo quando não cai numa
	// marca de 7 em 7.
	let weekTicks = $derived.by(() => {
		if (!axis) return [];
		const ticks: { offsetDays: number; label: string }[] = [];
		for (let offset = 0; offset < axis.totalDays; offset += 7) {
			ticks.push({ offsetDays: offset, label: formatShortDate(addCivilDays(axis.startDate, offset)) });
		}
		const lastOffset = axis.totalDays - 1;
		if (lastOffset > 0 && lastOffset % 7 !== 0) {
			ticks.push({ offsetDays: lastOffset, label: formatShortDate(addCivilDays(axis.startDate, lastOffset)) });
		}
		return ticks;
	});

	type LaneEntry =
		| { type: 'header'; key: string; title: string }
		| { type: 'item'; key: string; item: CronogramaWorkItemRow };

	let laneEntries = $derived.by<LaneEntry[]>(() => {
		const entries: LaneEntry[] = [];
		for (const group of cronograma.groups) {
			entries.push({ type: 'header', key: `h-${group.key}`, title: group.title });
			for (const item of group.items) {
				entries.push({ type: 'item', key: item.id, item });
			}
		}
		return entries;
	});

	let itemsById = $derived.by(() => {
		const map = new Map<string, CronogramaWorkItemRow>();
		for (const group of cronograma.groups) {
			for (const item of group.items) map.set(item.id, item);
		}
		return map;
	});

	let rowTopById = $derived.by(() => {
		const map = new Map<string, number>();
		let top = 0;
		for (const entry of laneEntries) {
			if (entry.type === 'header') {
				top += GROUP_HEADER_HEIGHT;
			} else {
				map.set(entry.item.id, top);
				top += ROW_HEIGHT;
			}
		}
		return map;
	});

	let bodyHeight = $derived(
		laneEntries.reduce((height, entry) => height + (entry.type === 'header' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT), 0)
	);

	// Conectores FS lag-zero (ETAPA 12 do rework, §42, sexto microcorte) —
	// elbow simples entre a borda direita da barra predecessora e a borda
	// esquerda da barra sucessora, nas posições verticais já determinísticas
	// de rowTopById. Uma Dependency só chega aqui (cronograma.dependencies)
	// quando as duas pontas têm schedule completo — geometria ausente é
	// defesa extra (nunca alcançada na prática) contra posição inventada.
	let connectors = $derived.by(() => {
		const result: { id: string; path: string; conflict: boolean }[] = [];
		for (const edge of cronograma.dependencies) {
			const from = itemsById.get(edge.fromWorkItemId);
			const to = itemsById.get(edge.toWorkItemId);
			const fromTop = rowTopById.get(edge.fromWorkItemId);
			const toTop = rowTopById.get(edge.toWorkItemId);
			if (!from?.geometry || !to?.geometry || fromTop === undefined || toTop === undefined) continue;
			const x1 = (from.geometry.offsetDays + from.geometry.widthDays) * DAY_WIDTH;
			const y1 = fromTop + ROW_HEIGHT / 2;
			const x2 = to.geometry.offsetDays * DAY_WIDTH;
			const y2 = toTop + ROW_HEIGHT / 2;
			const midX = (x1 + x2) / 2;
			result.push({ id: edge.id, path: `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`, conflict: edge.conflict });
		}
		return result;
	});

	let timelineWidth = $derived(axis ? axis.totalDays * DAY_WIDTH : 0);
	let milestoneLaneHeight = $derived(cronograma.milestones.length * MILESTONE_ROW_HEIGHT);
</script>

<svelte:head>
	<title>Cronograma — Hydra</title>
</svelte:head>

<header class="cronograma-header">
	<h1>Cronograma</h1>
	<p class="subtitle">
		Leitura do plano atual — datas, duração e precedência declaradas. Para alterar o cronograma, abra o trabalho em
		Trabalho.
	</p>
</header>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

{#if cronograma.groups.length === 0 && cronograma.milestones.length === 0}
	<p class="empty">Nenhum trabalho agendado nem marco datado para exibir.</p>
{:else}
	<div class="cronograma-board">
		<div class="cronograma-identity">
			<div class="ruler-spacer"></div>
			{#each laneEntries as entry (entry.key)}
				{#if entry.type === 'header'}
					<div class="group-header-cell" style="height:{GROUP_HEADER_HEIGHT}px">{entry.title}</div>
				{:else}
					<a
						class="item-identity-cell"
						class:conflict={entry.item.hasConflict}
						style="height:{ROW_HEIGHT}px"
						href="/projects/{projectId}/work?item={entry.item.id}"
					>
						<span class="item-title">{entry.item.title}</span>
						<span class="item-meta">
							{#if entry.item.removedFromBaseline || entry.item.unscheduled}
								{entry.item.statusLabel}
							{:else}
								{entry.item.statusLabel} · {entry.item.durationLabel}
							{/if}
						</span>
						{#if entry.item.removedNote}
							<span class="item-removed-note">{entry.item.removedNote}</span>
						{:else if entry.item.unscheduled}
							<span class="item-removed-note">Sem cronograma</span>
						{:else if entry.item.conflictLabel}
							<span class="item-conflict-note">{entry.item.conflictLabel}</span>
						{:else if entry.item.geometry === null}
							<span class="item-conflict-note">Barra não calculável: datas fora do intervalo suportado.</span>
						{/if}
					</a>
				{/if}
			{/each}
			{#if cronograma.milestones.length > 0}
				<div class="milestone-lane-header" style="height:{GROUP_HEADER_HEIGHT}px">Marcos do projeto</div>
				{#each cronograma.milestones as milestone (milestone.id)}
					<div class="milestone-identity-cell" style="height:{MILESTONE_ROW_HEIGHT}px">
						<span class="milestone-diamond" aria-hidden="true"></span>
						{milestone.title}
					</div>
				{/each}
			{/if}
		</div>

		<div class="cronograma-timeline-scroll">
			{#if !axis}
				<p class="empty axis-empty">Não é possível calcular o eixo temporal: datas fora do intervalo suportado.</p>
			{:else}
				<div class="cronograma-timeline-inner" style="width:{timelineWidth}px">
					<div class="ruler" style="width:{timelineWidth}px">
						{#each weekTicks as tick (tick.offsetDays)}
							<span class="ruler-tick" style="left:{tick.offsetDays * DAY_WIDTH}px">{tick.label}</span>
						{/each}
					</div>

					<div class="lane-body" style="height:{bodyHeight}px; width:{timelineWidth}px">
						<svg class="connectors" width={timelineWidth} height={bodyHeight} aria-hidden="true">
							<defs>
								<marker id="cronograma-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
									<path d="M0,0 L6,3 L0,6 Z" class="arrow-head" />
								</marker>
								<marker id="cronograma-arrow-conflict" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
									<path d="M0,0 L6,3 L0,6 Z" class="arrow-head-conflict" />
								</marker>
							</defs>
							{#each connectors as connector (connector.id)}
								<path
									d={connector.path}
									class="connector"
									class:conflict={connector.conflict}
									marker-end={connector.conflict ? 'url(#cronograma-arrow-conflict)' : 'url(#cronograma-arrow)'}
								/>
							{/each}
						</svg>

						{#each laneEntries as entry (entry.key)}
							{#if entry.type === 'header'}
								<div class="group-header-row" style="height:{GROUP_HEADER_HEIGHT}px"></div>
							{:else}
								<div class="item-row" style="height:{ROW_HEIGHT}px">
									{#if entry.item.ghost}
										<div
											class="item-ghost"
											class:standalone={entry.item.removedFromBaseline}
											style="left:{entry.item.ghost.offsetDays * DAY_WIDTH}px; width:{entry.item.ghost.widthDays *
												DAY_WIDTH}px"
											title="Referência: {entry.item.ghost.plannedStartLabel} – {entry.item.ghost.semanticEndLabel} · {entry
												.item.ghost.durationLabel}"
											aria-hidden="true"
										></div>
									{/if}
									{#if entry.item.geometry}
										<a
											class="item-bar"
											class:conflict={entry.item.hasConflict}
											href="/projects/{projectId}/work?item={entry.item.id}"
											style="left:{entry.item.geometry.offsetDays * DAY_WIDTH}px; width:{entry.item.geometry.widthDays *
												DAY_WIDTH}px"
											title="{entry.item.plannedStartLabel} – {entry.item.semanticEndLabel} · {entry.item.durationLabel}"
											aria-label="{entry.item.title}: {entry.item.plannedStartLabel} a {entry.item.semanticEndLabel}"
										></a>
									{/if}
								</div>
							{/if}
						{/each}
					</div>

					{#if cronograma.milestones.length > 0}
						<div class="milestone-lane-header-spacer" style="height:{GROUP_HEADER_HEIGHT}px"></div>
						<div class="milestone-lane" style="height:{milestoneLaneHeight}px; width:{timelineWidth}px">
							{#each cronograma.milestones as milestone, index (milestone.id)}
								{#if milestone.geometry}
									<span
										class="milestone-marker"
										style="left:{milestone.geometry.offsetDays * DAY_WIDTH}px; top:{index * MILESTONE_ROW_HEIGHT +
											MILESTONE_ROW_HEIGHT / 2}px"
										title="{milestone.title} · {milestone.plannedDateLabel} · {milestone.statusLabel}"
										aria-hidden="true"
									></span>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="cronograma-legend">
		<span class="legend-item"><span class="legend-swatch bar"></span>trabalho agendado</span>
		<span class="legend-item"><span class="legend-swatch bar conflict"></span>conflito de precedência</span>
		<span class="legend-item"><span class="legend-swatch diamond"></span>marco do projeto</span>
		{#if cronograma.groups.some((group) => group.items.some((item) => item.ghost !== null))}
			<span class="legend-item"><span class="legend-swatch ghost"></span>referência (baseline)</span>
		{/if}
	</div>
{/if}

<!-- Referência do cronograma (ETAPA 13 do rework, §43 — D068: a gestão da
     referência pertence ao Cronograma, não a uma surface própria; a
     geometria/ghost da baseline já aparece na régua acima — esta seção é a
     apresentação textual e a gestão explícita, mesmo contrato exato que
     vivia em Acompanhamento antes desta absorção). REFERÊNCIA
     explicitamente aprovada pelo usuário, nunca criada automaticamente: o
     primeiro clique sempre mostra um preview com confirmação explícita
     antes de congelar qualquer coisa. Capturar/rebaselinear é gestão da
     referência, não edição do plano — Cronograma permanece read-only
     quanto a scheduling. -->
<section class="card schedule-baseline" aria-labelledby="schedule-baseline-heading">
	<h2 id="schedule-baseline-heading">Referência do cronograma</h2>
	<p class="subtitle-inline">
		Uma referência congela o início e a duração de cada trabalho com cronograma completo, para comparar
		depois contra o cronograma atual. Nunca é criada automaticamente.
	</p>

	{#if cronograma.scheduleBaseline !== null}
		<p class="subtitle-inline">
			Referência ativa criada em {timestampFormatter.format(new Date(cronograma.scheduleBaseline.createdAt))}.
			{#if cronograma.scheduleBaseline.partial}
				Parcial: nem todo trabalho tinha cronograma completo no momento da captura.
			{/if}
		</p>

		{#if cronograma.scheduleBaseline.entries.length === 0}
			<p class="empty">Sem variação desde a referência.</p>
		{:else}
			<ul class="baseline-comparison-list">
				{#each cronograma.scheduleBaseline.entries as entry (entry.workItemId)}
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
				{cronograma.scheduleBaseline === null
					? 'Congelar cronograma atual como referência'
					: 'Criar nova referência do cronograma'}
			</button>
		</form>
		{#if cronograma.scheduleBaseline !== null}
			<p class="subtitle-inline">A referência atual será preservada — nenhuma sobrescrita.</p>
		{/if}
	{/if}
</section>

<a class="section-link" href="/projects/{projectId}/tracking">← Voltar a Acompanhamento</a>

<style>
	.cronograma-header {
		margin-bottom: var(--space-5);
	}

	.cronograma-header h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-title, 1.5rem);
	}

	.subtitle {
		margin: 0;
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		max-width: 42rem;
	}

	.empty {
		color: var(--hydra-muted);
		font-style: italic;
	}

	.axis-empty {
		padding: var(--space-4);
		margin: 0;
		white-space: nowrap;
	}

	.cronograma-board {
		display: flex;
		align-items: flex-start;
		gap: 0;
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		overflow: hidden;
	}

	.cronograma-identity {
		flex: 0 0 220px;
		width: 220px;
		display: flex;
		flex-direction: column;
		border-right: 1px solid rgba(101, 104, 108, 0.25);
	}

	.ruler-spacer {
		height: 30px;
		border-bottom: 1px solid rgba(101, 104, 108, 0.2);
	}

	.group-header-cell,
	.milestone-lane-header {
		display: flex;
		align-items: center;
		padding: 0 var(--space-3);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.milestone-lane-header {
		border-top: 1px solid rgba(101, 104, 108, 0.2);
	}

	.item-identity-cell,
	.milestone-identity-cell {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 1px;
		padding: 0 var(--space-3);
		border-bottom: 1px solid rgba(101, 104, 108, 0.08);
		color: var(--hydra-text);
		text-decoration: none;
		overflow: hidden;
	}

	.item-identity-cell:hover {
		background: rgba(101, 104, 108, 0.08);
	}

	.item-title {
		font-size: var(--font-size-body);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.item-meta {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.item-conflict-note {
		font-size: var(--font-size-caption);
		color: var(--hydra-warning);
	}

	.item-removed-note {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		font-style: italic;
	}

	.item-identity-cell.conflict .item-title {
		color: var(--hydra-warning);
	}

	.milestone-identity-cell {
		flex-direction: row;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-body);
	}

	.milestone-diamond {
		flex: none;
		width: 9px;
		height: 9px;
		background: var(--hydra-accent);
		transform: rotate(45deg);
	}

	.cronograma-timeline-scroll {
		flex: 1 1 auto;
		min-width: 0;
		overflow-x: auto;
	}

	.cronograma-timeline-inner {
		position: relative;
	}

	.ruler {
		position: relative;
		height: 30px;
		border-bottom: 1px solid rgba(101, 104, 108, 0.2);
	}

	.ruler-tick {
		position: absolute;
		top: 6px;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		white-space: nowrap;
	}

	.lane-body {
		position: relative;
	}

	.connectors {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
	}

	.connector {
		fill: none;
		stroke: rgba(101, 104, 108, 0.5);
		stroke-width: 1.5;
	}

	.connector.conflict {
		stroke: var(--hydra-warning);
		stroke-dasharray: 4 3;
	}

	.arrow-head {
		fill: rgba(101, 104, 108, 0.6);
	}

	.arrow-head-conflict {
		fill: var(--hydra-warning);
	}

	.group-header-row {
		border-bottom: 1px solid rgba(101, 104, 108, 0.08);
	}

	.item-row {
		position: relative;
		border-bottom: 1px solid rgba(101, 104, 108, 0.08);
	}

	.item-bar {
		position: absolute;
		top: 10px;
		height: 22px;
		border-radius: var(--hydra-radius);
		background: var(--hydra-accent);
		display: block;
	}

	.item-bar.conflict {
		background: transparent;
		border: 1.5px dashed var(--hydra-warning);
	}

	.item-ghost {
		position: absolute;
		top: 34px;
		height: 6px;
		border-radius: 3px;
		background: rgba(101, 104, 108, 0.35);
		pointer-events: none;
	}

	.item-ghost.standalone {
		top: 10px;
		height: 22px;
		border-radius: var(--hydra-radius);
		background: transparent;
		border: 1.5px dashed rgba(101, 104, 108, 0.55);
	}

	.milestone-lane-header-spacer {
		border-top: 1px solid rgba(101, 104, 108, 0.2);
	}

	.milestone-lane {
		position: relative;
	}

	.milestone-marker {
		position: absolute;
		width: 12px;
		height: 12px;
		margin-left: -6px;
		margin-top: -6px;
		background: var(--hydra-accent);
		transform: rotate(45deg);
	}

	.cronograma-legend {
		display: flex;
		gap: var(--space-4);
		flex-wrap: wrap;
		margin-top: var(--space-4);
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.legend-swatch {
		display: inline-block;
	}

	.legend-swatch.bar {
		width: 16px;
		height: 10px;
		border-radius: 3px;
		background: var(--hydra-accent);
	}

	.legend-swatch.bar.conflict {
		background: transparent;
		border: 1.5px dashed var(--hydra-warning);
	}

	.legend-swatch.diamond {
		width: 9px;
		height: 9px;
		background: var(--hydra-accent);
		transform: rotate(45deg);
	}

	.legend-swatch.ghost {
		width: 16px;
		height: 8px;
		border-radius: 3px;
		background: transparent;
		border: 1.5px dashed rgba(101, 104, 108, 0.55);
	}

	.section-link {
		display: inline-block;
		margin-top: var(--space-5);
		color: var(--hydra-accent);
		font-weight: 600;
	}

	/* Referência do cronograma (ETAPA 13 do rework, §43 — D068) — mesmo
	   molde de card/lista já usado em Acompanhamento antes desta absorção,
	   trazido junto para preservar a apresentação existente. */
	.card {
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		padding: var(--space-5);
		margin-top: var(--space-5);
	}

	.card h2 {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-subtitle);
	}

	.subtitle-inline {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

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

	@media (max-width: 640px) {
		.cronograma-identity {
			flex-basis: 150px;
			width: 150px;
		}
	}
</style>
