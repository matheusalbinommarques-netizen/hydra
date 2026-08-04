// Projeção pura de leitura para "Acompanhamento" (etapa 7.4 do roadmap) —
// compõe situação atual, síntese de Entregas, atenções e continuidade a
// partir de projeções e campos já existentes (buildJourneyContext,
// buildPhaseProgress, buildDeliveriesView, view.impediments,
// view.openPendingItems). Não lê
// catálogo nem persistência diretamente, não decide nada (isso já foi
// decidido por orientation-engine/ e pelas projeções reaproveitadas), não
// introduz estado de domínio novo.

import type { ImpedimentView } from '$lib/server/application/types';
import type { NextActivityResult, PendingItemView } from '$lib/orientation-engine';
import type { PhaseProgressView } from '$lib/phase-progress';
import type { JourneyContextView } from '../now/journey-context';
import {
	buildDeliveriesView,
	type DeliveriesScopeItemInput,
	type DeliveriesScopeVersionInput,
	type DeliveryItemView
} from '../deliveries/deliveries-view';

export interface TrackingSituationView {
	phaseLabel: string;
	positionLabel: string;
	activityLabel: string;
	progressLabel: string;
	progressPercent: number;
}

// "nenhuma": não há foco confirmado ou nenhum item confirmado em "Agora" —
// mesma condição, uma única mensagem ("Nenhuma entrega disponível."). Nunca
// promove o primeiro item de "A fazer" a "próxima entrega": o domínio não
// garante que a ordem represente prioridade.
export type TrackingDeliveriesState = 'em_andamento' | 'sem_andamento' | 'concluido' | 'nenhuma';

export interface TrackingDeliveriesView {
	confirmed: boolean;
	counts: { a_fazer: number; em_andamento: number; concluido: number };
	inProgress: DeliveryItemView[];
	state: TrackingDeliveriesState;
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

export interface TrackingContinuityView {
	completed: boolean;
	label: string;
}

export interface TrackingView {
	situation: TrackingSituationView | undefined;
	deliveries: TrackingDeliveriesView;
	attentionPendingItems: TrackingAttentionPendingItem[];
	impediments: TrackingImpedimentsView;
	continuity: TrackingContinuityView;
}

export interface TrackingViewInput {
	journeyContext: JourneyContextView | undefined;
	phaseProgress: PhaseProgressView | undefined;
	nextActivity: NextActivityResult;
	scopeItems: DeliveriesScopeItemInput[];
	scopeVersion: DeliveriesScopeVersionInput;
	impediments: ImpedimentView[];
	openPendingItems: PendingItemView[];
}

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

function buildDeliveries(
	scopeItems: DeliveriesScopeItemInput[],
	scopeVersion: DeliveriesScopeVersionInput
): TrackingDeliveriesView {
	const deliveries = buildDeliveriesView(scopeItems, scopeVersion);
	const total = deliveries.counts.a_fazer + deliveries.counts.em_andamento + deliveries.counts.concluido;

	let state: TrackingDeliveriesState;
	if (!deliveries.confirmed || total === 0) {
		state = 'nenhuma';
	} else if (deliveries.groups.em_andamento.length > 0) {
		state = 'em_andamento';
	} else if (deliveries.counts.concluido === total) {
		state = 'concluido';
	} else {
		state = 'sem_andamento';
	}

	return {
		confirmed: deliveries.confirmed,
		counts: deliveries.counts,
		inProgress: deliveries.groups.em_andamento,
		state
	};
}

function buildAttentionPendingItems(openPendingItems: PendingItemView[]): TrackingAttentionPendingItem[] {
	return openPendingItems.map((item) => ({
		id: item.id,
		label: item.label,
		detail: item.detail,
		activityDefinitionId: item.activityDefinitionId
	}));
}

function buildImpediments(impediments: ImpedimentView[]): TrackingImpedimentsView {
	return {
		open: impediments.filter((impediment) => impediment.status === 'aberto'),
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
		deliveries: buildDeliveries(input.scopeItems, input.scopeVersion),
		attentionPendingItems: buildAttentionPendingItems(input.openPendingItems),
		impediments: buildImpediments(input.impediments),
		continuity: buildContinuity(input.nextActivity, situation)
	};
}
