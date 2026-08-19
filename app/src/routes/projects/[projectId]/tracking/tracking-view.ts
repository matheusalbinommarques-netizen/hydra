// Projeção pura de leitura para "Acompanhamento" (etapa 7.4 do roadmap;
// seção "Bloqueios" adicionada na ETAPA 6 do rework, "Primeiro loop
// operacional") — compõe situação atual, síntese de Trabalho, bloqueios,
// atenções e continuidade a partir de projeções e campos já existentes
// (buildJourneyContext, buildPhaseProgress, buildWorkView, view.impediments,
// view.workItems, view.openPendingItems). Não lê catálogo nem persistência
// diretamente, não decide nada (isso já foi decidido por orientation-engine/
// e pelas projeções reaproveitadas), não introduz estado de domínio novo.

import type { ImpedimentType, WorkItemStatus } from '$lib/domain';
import type { ImpedimentView, WorkItemView } from '$lib/server/application/types';
import type { NextActivityResult, PendingItemView } from '$lib/orientation-engine';
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

export interface TrackingAttentionPendingItem {
	id: string;
	label: string;
	detail: string;
	activityDefinitionId: string;
}

export interface TrackingImpedimentsView {
	open: ImpedimentView[];
	resolved: ImpedimentView[];
}

// Bloqueios (ETAPA 6 do rework) — sinal estreito, derivado, explicável e
// acionável (contrato de Signal, ver HYDRA_PRODUCT_REWORK.md §15): um
// WorkItem por card, só quando bloqueado por um Impediment aberto. `why` é
// texto simples (mesmo espírito de TrackingContinuityView.label), não um
// health score nem semáforo — a explicação é sempre "este impedimento está
// bloqueando trabalho no estado X", nunca um cálculo de severidade.
export interface TrackingBlockedWorkItem {
	workItemId: string;
	title: string;
	// Estado operacional atual do WorkItem — exposto para a interface poder
	// explicar, antes da ação de "marcar como resolvido", que esse estado NÃO
	// muda automaticamente (só o bloqueio é removido). Achado de dogfooding:
	// "Resolver impedimento" parecia resolver o problema sozinho; a interface
	// precisa desta informação para dar contexto antes da mutação.
	status: WorkItemStatus;
	impedimentId: string;
	impedimentText: string;
	impedimentTipo: ImpedimentType;
	why: string;
}

export interface TrackingContinuityView {
	completed: boolean;
	label: string;
}

export interface TrackingView {
	situation: TrackingSituationView | undefined;
	work: TrackingWorkView;
	blockedWorkItems: TrackingBlockedWorkItem[];
	attentionPendingItems: TrackingAttentionPendingItem[];
	impediments: TrackingImpedimentsView;
	continuity: TrackingContinuityView;
}

export interface TrackingViewInput {
	journeyContext: JourneyContextView | undefined;
	phaseProgress: PhaseProgressView | undefined;
	nextActivity: NextActivityResult;
	workItems: WorkItemView[];
	impediments: ImpedimentView[];
	openPendingItems: PendingItemView[];
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

function buildBlockedWorkItems(workItems: WorkItemView[]): TrackingBlockedWorkItem[] {
	return workItems
		.filter((item) => item.blockedBy !== null)
		.map((item) => ({
			workItemId: item.id,
			title: item.title,
			status: item.status,
			// filter acima já garante blockedBy !== null.
			impedimentId: item.blockedBy!.impedimentId,
			impedimentText: item.blockedBy!.text,
			impedimentTipo: item.blockedBy!.tipo,
			why: `Este impedimento está bloqueando trabalho atualmente em "${WORK_STATUS_LABEL[item.status]}".`
		}));
}

function buildAttentionPendingItems(openPendingItems: PendingItemView[]): TrackingAttentionPendingItem[] {
	return openPendingItems.map((item) => ({
		id: item.id,
		label: item.label,
		detail: item.detail,
		activityDefinitionId: item.activityDefinitionId
	}));
}

// Impedimentos vinculados a um WorkItem (workItemId !== null) já têm sua
// própria projeção acionável e explicável em "Precisa de você"
// (buildBlockedWorkItems, acima) — mantê-los também aqui duplicaria o mesmo
// fato operacional em "Atenções" e ofereceria uma segunda superfície
// administrativa concorrente ("Gestão de impedimentos") para o mesmo
// bloqueio (achado real de dogfooding, não hipotético). Impedimentos sem
// WorkItem (o caso normal de impedimento no nível do projeto) continuam
// aparecendo aqui exatamente como antes — este filtro não muda o
// comportamento deles. Resolvidos continuam todos juntos: histórico passivo,
// não é uma segunda superfície de ação sobre um bloqueio ainda aberto.
function buildImpediments(impediments: ImpedimentView[]): TrackingImpedimentsView {
	return {
		open: impediments.filter((impediment) => impediment.status === 'aberto' && impediment.workItemId === null),
		resolved: impediments.filter((impediment) => impediment.status === 'resolvido')
	};
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

	return {
		situation,
		work: buildWork(input.workItems),
		blockedWorkItems: buildBlockedWorkItems(input.workItems),
		attentionPendingItems: buildAttentionPendingItems(input.openPendingItems),
		impediments: buildImpediments(input.impediments),
		continuity: buildContinuity(input.nextActivity, situation)
	};
}
