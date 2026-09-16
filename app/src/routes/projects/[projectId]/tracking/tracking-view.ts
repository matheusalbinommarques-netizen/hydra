// Projeção pura de leitura para "Acompanhamento" (etapa 7.4 do roadmap;
// seção "Bloqueios" adicionada na ETAPA 6 do rework, "Primeiro loop
// operacional") — compõe situação atual, síntese de Trabalho, bloqueios,
// atenções e continuidade a partir de projeções e campos já existentes
// (buildJourneyContext, buildPhaseProgress, buildWorkView, view.impediments,
// view.workItems, view.openPendingItems). Não lê catálogo nem persistência
// diretamente, não decide nada (isso já foi decidido por orientation-engine/
// e pelas projeções reaproveitadas), não introduz estado de domínio novo.

import { isCronogramaReady } from '$lib/schedule-readiness';
import { buildRisks, type RisksView } from '$lib/risk-view';
import type { MilestoneStatus, WorkItemStatus } from '$lib/domain';
import type { MilestoneView, RiskView, ScheduleBaselineView, WorkItemView } from '$lib/server/application/types';
import type { NextActivityResult } from '$lib/orientation-engine';
import type { PhaseProgressView } from '$lib/phase-progress';
import type { JourneyContextView } from '../now/journey-context';
import { buildWorkView, type WorkItemBoardCounts } from '../work/work-view';

export interface TrackingSituationView {
	phaseLabel: string;
	positionLabel: string;
	activityLabel: string;
	progressLabel: string;
	progressPercent: number;
}

export type TrackingWorkState = 'em_andamento' | 'sem_andamento' | 'concluido' | 'nenhuma';

export interface TrackingWorkView {
	counts: WorkItemBoardCounts;
	inProgress: WorkItemView[];
	state: TrackingWorkState;
}

// Linha do tempo (ETAPA 8 do rework, microcorte de Timeline;
// HYDRA_PRODUCT_REWORK.md §16 "Linha do tempo" e §17, prontidão "datas/marcos").
// LISTA cronológica declarada, nunca gráfico de scheduling: sem barra, sem
// escala espacial, sem "hoje", sem atraso, sem folga e sem comparação entre
// plannedDate e reachedAt — variação é §42.
//
// `status` é o estado DECLARADO do marco e continua sendo a única autoridade
// (D040): a Timeline não corrige nem interpreta um marco alcançado com data
// futura ou passada, só mostra os dois fatos.
export interface TrackingMilestoneTimelineEntry {
	kind: 'milestone';
	// Comum às duas variantes (ver TrackingWorkItemTimelineEntry) — chave de
	// lista e desempate de ordenação (ver compareTimelineEntries).
	id: string;
	title: string;
	// Data civil crua (YYYY-MM-DD), preservada para ordenação/teste.
	plannedDate: string;
	// Mesmo dia em pt-BR (dd/mm/aaaa), formatado por manipulação de string —
	// plannedDate nunca vira Date, que deslocaria o dia por timezone.
	plannedDateLabel: string;
	status: MilestoneStatus;
	statusLabel: string;
	// Instante real do alcance, cru: é timestamp (fato do sistema), não dia
	// civil, e a interface o formata com o tratamento de timestamp já usado no
	// repo. null enquanto o marco está aberto.
	reachedAt: string | null;
	// Só desempate (ver compareTimelineEntries). Nunca exibido: a Linha do
	// tempo afirma data planejada e estado declarado, não quando o marco foi
	// cadastrado.
	createdAt: string;
}

// WorkItem com schedule (ETAPA 12 do rework, "Scheduling e Gantt", §42,
// primeiro microcorte fundacional) — segunda variante da Linha do tempo,
// primeiro leitor real do fato temporal manual introduzido em
// WorkItem.plannedStart/durationDays. Só entram aqui WorkItems com schedule
// COMPLETO (ver buildWorkItemTimelineEntries) — sem schedule, o WorkItem
// continua existindo normalmente em Trabalho, fora desta lista. Sem
// plannedEnd exposto (não calculado nem persistido nesta rodada) e sem
// nenhuma promessa de precedência/propagação: `durationLabel` é só o dado
// declarado, formatado.
export interface TrackingWorkItemTimelineEntry {
	kind: 'workItem';
	id: string;
	title: string;
	plannedDate: string;
	plannedDateLabel: string;
	durationDays: number;
	durationLabel: string;
	status: WorkItemStatus;
	statusLabel: string;
	createdAt: string;
}

export type TrackingTimelineEntry = TrackingMilestoneTimelineEntry | TrackingWorkItemTimelineEntry;

export interface TrackingContinuityView {
	completed: boolean;
	label: string;
}

// Card temporal enxuto (ETAPA 12 do rework, §42, sexto microcorte —
// primeiro corte do Gantt, Design Gate "Corredor") — substitui a Timeline
// completa quando o Cronograma atinge readiness (isCronogramaReady); as
// duas apresentações nunca coexistem (ver buildTrackingView). Só fatos
// honestamente deriváveis já existentes na ProjectView: `conflictCount` é a
// contagem de WorkItems com precedenceConflict != null (D059).
//
// `divergingFromBaselineCount`/`unrepresentableFromBaselineCount` são
// `null` juntos enquanto não existe baseline ativa (caso normal) — nunca
// um `null` e o outro número. Quando existe baseline, cada entry de
// `ScheduleBaselineComparisonEntryView` (D062) conta em NO MÁXIMO um dos
// dois, nunca nos dois (hardening pós-dogfood, auditoria do contrato):
//   - `compared` com as três variâncias em zero → não conta em nenhum dos
//     dois (sem diferença honesta a relatar);
//   - `compared` com alguma variância != 0, `removed`, `scheduled_after`
//     ou `added_after` → soma `divergingFromBaselineCount` (todos são
//     fatos honestamente conhecidos de que o WorkItem difere da
//     referência, mesmo sem uma variância numérica para `removed`/
//     `scheduled_after`/`added_after`);
//   - `compared_unrepresentable` → soma `unrepresentableFromBaselineCount`
//     em vez de `divergingFromBaselineCount` — a aritmética de variância
//     estourou a faixa civil (D062), então afirmar "difere" fingiria
//     conhecer uma magnitude que não existe; a interface relata a
//     contagem como fato mínimo ("N não puderam ser comparados"), nunca
//     como sinônimo de divergência.
export interface TrackingCronogramaCardView {
	conflictCount: number;
	divergingFromBaselineCount: number | null;
	unrepresentableFromBaselineCount: number | null;
}

export interface TrackingView {
	situation: TrackingSituationView | undefined;
	work: TrackingWorkView;
	// Prontidão do Cronograma (mesmo critério de isCronogramaReady,
	// compartilhado com o shell e a rota /cronograma) — controla a troca
	// Timeline ↔ card, nunca as duas ao mesmo tempo.
	cronogramaReady: boolean;
	cronogramaCard: TrackingCronogramaCardView | null;
	// Vazia quando nenhum marco tem data planejada — nesse caso a seção
	// simplesmente não existe na página (§17: surface só aparece quando há
	// dados suficientes; nada de aba/placeholder vazio).
	timeline: TrackingTimelineEntry[];
	// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte) —
	// passthrough direto de ProjectView.scheduleBaseline (já projetado com
	// títulos denormalizados por project-view.ts); `null` é o caso normal
	// (nenhuma baseline capturada ainda).
	scheduleBaseline: ScheduleBaselineView | null;
	risks: RisksView;
	continuity: TrackingContinuityView;
}

export interface TrackingViewInput {
	journeyContext: JourneyContextView | undefined;
	phaseProgress: PhaseProgressView | undefined;
	nextActivity: NextActivityResult;
	workItems: WorkItemView[];
	milestones: MilestoneView[];
	scheduleBaseline: ScheduleBaselineView | null;
	risks: RiskView[];
}

const WORK_STATUS_LABEL: Record<WorkItemView['status'], string> = {
	a_fazer: 'A fazer',
	em_andamento: 'Em andamento',
	concluido: 'Concluído'
};

function buildSituation(
	journeyContext: JourneyContextView | undefined,
	phaseProgress: PhaseProgressView | undefined
): TrackingSituationView | undefined {
	if (!journeyContext) return undefined;

	const positionLabel =
		journeyContext.kind === 'in_progress'
			? `Fase ${journeyContext.position} de ${journeyContext.total}`
			: `${journeyContext.total} de ${journeyContext.total} fases percorridas`;
	const phaseLabel = journeyContext.kind === 'in_progress' ? journeyContext.phaseLabel : 'Jornada concluída';

	if (!phaseProgress) {
		return { phaseLabel, positionLabel, activityLabel: '—', progressLabel: 'Sem atividades aplicáveis.', progressPercent: 0 };
	}

	// A fase-alvo de buildPhaseProgress já é a fase da atividade recomendada
	// (Trilha A) — o grupo "atual" contém exatamente essa atividade, a mesma
	// que view.nextActivity aponta. Reaproveitado também pela Continuidade,
	// abaixo, para não duplicar a busca da atividade atual.
	const current = phaseProgress.groups.find((group) => group.key === 'atual')?.activities[0];
	const progressPercent =
		phaseProgress.totalActivities > 0
			? Math.round((phaseProgress.resolvedActivities / phaseProgress.totalActivities) * 100)
			: 0;

	return {
		phaseLabel,
		positionLabel,
		activityLabel: current?.title ?? '—',
		progressLabel: `${phaseProgress.resolvedActivities} de ${phaseProgress.totalActivities} atividades concluídas`,
		progressPercent
	};
}

function buildWork(workItems: WorkItemView[]): TrackingWorkView {
	const board = buildWorkView(workItems);
	const total = board.counts.a_fazer + board.counts.em_andamento + board.counts.concluido;

	let state: TrackingWorkState;
	if (total === 0) {
		state = 'nenhuma';
	} else if (board.groups.em_andamento.length > 0) {
		state = 'em_andamento';
	} else if (board.counts.concluido === total) {
		state = 'concluido';
	} else {
		state = 'sem_andamento';
	}

	return { counts: board.counts, inProgress: board.groups.em_andamento, state };
}

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
	aberto: 'Em aberto',
	alcancado: 'Alcançado'
};

// dd/mm/aaaa a partir das partes da própria string. Deliberadamente sem Date e
// sem Intl: a semântica é dia civil, e converter para instante desloca o dia em
// qualquer fuso a oeste de Greenwich (2026-09-01 viraria 31/08). A string já
// chegou aqui validada por isCivilDate (domain/civil-date.ts).
function formatCivilDate(plannedDate: string): string {
	const [year, month, day] = plannedDate.split('-');
	return `${day}/${month}/${year}`;
}

// Só marcos COM data planejada: um marco sem data não tem fato temporal e
// continua existindo normalmente em Trabalho. Mesma regra para WorkItem: só
// entram aqui os com schedule COMPLETO (ver buildWorkItemTimelineEntries).
//
// Ordenação totalmente determinística, sem depender da estabilidade do `sort`
// nem da ordem incidental em que a projeção recebeu marcos/WorkItems:
//   1. plannedDate ASC — comparação lexicográfica de YYYY-MM-DD é exatamente a
//      ordem cronológica, sem construir Date;
//   2. createdAt ASC — mesma data planejada mantém a ordem de criação;
//   3. id ASC — resolve o caso extremo restante (mesma data e mesmo instante
//      de criação), para a lista nunca depender de acaso.
// Nenhum dos três é ordenação de PRODUTO: não existe campo `order` em
// Milestone nem em WorkItem, e prioridade/recorte continuam pertencendo a
// Roadmap (§38)/Entregas.
function compareTimelineEntries(a: TrackingTimelineEntry, b: TrackingTimelineEntry): number {
	if (a.plannedDate !== b.plannedDate) return a.plannedDate < b.plannedDate ? -1 : 1;
	if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildMilestoneTimelineEntries(milestones: MilestoneView[]): TrackingMilestoneTimelineEntry[] {
	return milestones
		.filter((milestone) => milestone.plannedDate !== null)
		.map((milestone) => ({
			kind: 'milestone',
			id: milestone.id,
			// filter acima já garante plannedDate !== null.
			plannedDate: milestone.plannedDate!,
			plannedDateLabel: formatCivilDate(milestone.plannedDate!),
			title: milestone.title,
			status: milestone.status,
			statusLabel: MILESTONE_STATUS_LABEL[milestone.status],
			reachedAt: milestone.reachedAt,
			createdAt: milestone.createdAt
		}));
}

function durationLabel(durationDays: number): string {
	return durationDays === 1 ? '1 dia' : `${durationDays} dias`;
}

// Só WorkItems com schedule COMPLETO (plannedStart e durationDays não-null —
// a invariante do domínio já garante que os dois vêm juntos, ver WorkItem em
// domain/state-types.ts). Sem plannedEnd: não é calculado nem persistido
// nesta rodada, e não há consumidor real ainda (ver HYDRA_PRODUCT_REWORK.md
// §42).
function buildWorkItemTimelineEntries(workItems: WorkItemView[]): TrackingWorkItemTimelineEntry[] {
	return workItems
		.filter((item): item is WorkItemView & { plannedStart: string; durationDays: number } =>
			item.plannedStart !== null && item.durationDays !== null
		)
		.map((item) => ({
			kind: 'workItem',
			id: item.id,
			plannedDate: item.plannedStart,
			plannedDateLabel: formatCivilDate(item.plannedStart),
			durationDays: item.durationDays,
			durationLabel: durationLabel(item.durationDays),
			title: item.title,
			status: item.status,
			statusLabel: WORK_STATUS_LABEL[item.status],
			createdAt: item.createdAt
		}));
}

function buildTimeline(milestones: MilestoneView[], workItems: WorkItemView[]): TrackingTimelineEntry[] {
	return [...buildMilestoneTimelineEntries(milestones), ...buildWorkItemTimelineEntries(workItems)].sort(
		compareTimelineEntries
	);
}

function buildCronogramaCard(
	workItems: WorkItemView[],
	scheduleBaseline: ScheduleBaselineView | null
): TrackingCronogramaCardView {
	const conflictCount = workItems.filter((item) => item.precedenceConflict !== null).length;
	if (scheduleBaseline === null) {
		return { conflictCount, divergingFromBaselineCount: null, unrepresentableFromBaselineCount: null };
	}

	let divergingFromBaselineCount = 0;
	let unrepresentableFromBaselineCount = 0;
	for (const entry of scheduleBaseline.entries) {
		switch (entry.kind) {
			case 'compared':
				if (entry.startVarianceDays !== 0 || entry.finishVarianceDays !== 0 || entry.durationVarianceDays !== 0) {
					divergingFromBaselineCount++;
				}
				break;
			case 'removed':
			case 'scheduled_after':
			case 'added_after':
				divergingFromBaselineCount++;
				break;
			case 'compared_unrepresentable':
				unrepresentableFromBaselineCount++;
				break;
		}
	}
	return { conflictCount, divergingFromBaselineCount, unrepresentableFromBaselineCount };
}

function buildContinuity(
	nextActivity: NextActivityResult,
	situation: TrackingSituationView | undefined
): TrackingContinuityView {
	if (nextActivity.kind === 'catalog_limit_reached') {
		return { completed: true, label: 'Não há próxima atividade — o projeto foi concluído.' };
	}
	return { completed: false, label: `Próxima atividade: ${situation?.activityLabel ?? '—'}` };
}

export function buildTrackingView(input: TrackingViewInput): TrackingView {
	const situation = buildSituation(input.journeyContext, input.phaseProgress);
	const cronogramaReady = isCronogramaReady(input.workItems);

	return {
		situation,
		work: buildWork(input.workItems),
		cronogramaReady,
		cronogramaCard: cronogramaReady ? buildCronogramaCard(input.workItems, input.scheduleBaseline) : null,
		// Nunca as duas juntas (Design Gate "Corredor"): Timeline completa some
		// assim que o Cronograma atinge readiness, mesmo com marcos datados.
		timeline: cronogramaReady ? [] : buildTimeline(input.milestones, input.workItems),
		scheduleBaseline: input.scheduleBaseline,
		risks: buildRisks(input.risks),
		continuity: buildContinuity(input.nextActivity, situation)
	};
}
