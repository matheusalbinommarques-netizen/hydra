// Projeção pura de leitura para "Resultados e encerramento" (/closure,
// subetapa 7.5 do roadmap, D029, docs/07-management/decision-log.md) —
// combina as seis atividades reais da fase `validacao`
// (app/src/lib/catalog/closure.ts) em três seções editoriais fixas. Mesmo
// padrão de records-view.ts/document-view.ts: cruza catalog/ (estático) com
// os campos já expostos por ProjectView (activityStatuses/answers), não lê
// nem grava persistência, não conhece ProjectState bruto. Não introduz
// nenhum dado que o catálogo não sustente — nenhuma métrica, percentual,
// data, responsável ou contador.

import type { ActivityDefinition, ActivityStatus, Catalog } from '$lib/domain';

export interface ClosureViewInput {
	projectId: string;
	activityStatuses: Record<string, ActivityStatus>;
	answers: Record<string, string>;
	// Fase da atividade que view.nextActivity recomenda de fato (já resolvida
	// pelo loader a partir do catálogo) — null quando a jornada guiada já
	// esgotou o catálogo (`catalog_limit_reached`). Único dado usado para
	// decidir entre os três modos de continuidade; a projeção não recalcula
	// nem reimplementa a recomendação, só lê o resultado já produzido pelo
	// motor de orientação.
	nextActivityPhaseId: string | null;
}

export interface ClosureFieldView {
	id: string;
	label: string;
	value: string | null;
	isEmpty: boolean;
}

export interface ClosureActivityView {
	id: string;
	title: string;
	status: ActivityStatus;
	statusLabel: string;
	// null para não_iniciada/pulada — a seção mostra só título e estado,
	// nunca campos (mesmo quando existem respostas parciais persistidas por
	// uma atividade pulada em em_andamento antes de ser pulada).
	fields: ClosureFieldView[] | null;
}

export interface ClosureSectionView {
	id: string;
	title: string;
	activities: ClosureActivityView[];
}

export type ClosureContinuityView =
	| { kind: 'closure_cta'; message: string; ctaLabel: string; href: string }
	| { kind: 'earlier_cta'; message: string; ctaLabel: string; href: string }
	| { kind: 'completed'; message: string };

export interface ClosureView {
	sections: ClosureSectionView[];
	hasPendingClosureWork: boolean;
	continuity: ClosureContinuityView;
	recordsHref: string;
}

const VALIDACAO_PHASE_ID = 'validacao';

const SECTIONS_DEF: { id: string; title: string; activityIds: string[] }[] = [
	{ id: 'resultados', title: 'Resultados e benefícios', activityIds: ['validar_entregas_criterios', 'coletar_feedback'] },
	{ id: 'transicao', title: 'Transição e adoção', activityIds: ['transicao_proximos_passos'] },
	{
		id: 'encerramento',
		title: 'Encerramento e aprendizado',
		activityIds: ['resolver_pendencias_finais', 'licoes_aprendidas', 'confirmar_encerramento']
	}
];

const STATUS_LABEL: Record<ActivityStatus, string> = {
	não_iniciada: 'Ainda não iniciada',
	em_andamento: 'Em andamento',
	concluída: 'Concluída',
	pulada: 'Atividade pulada'
};

function isTerminal(status: ActivityStatus): boolean {
	return status === 'concluída' || status === 'pulada';
}

function findValidacaoActivity(catalog: Catalog, activityId: string): ActivityDefinition | undefined {
	const phase = catalog.phases.find((p) => p.id === VALIDACAO_PHASE_ID);
	return phase?.activities.find((activity) => activity.id === activityId);
}

function buildField(field: { id: string; label: string }, answers: Record<string, string>): ClosureFieldView {
	const value = answers[field.id];
	const isEmpty = !value;
	return { id: field.id, label: field.label, value: isEmpty ? null : value, isEmpty };
}

function buildActivityView(
	activity: ActivityDefinition,
	activityStatuses: Record<string, ActivityStatus>,
	answers: Record<string, string>
): ClosureActivityView {
	const status = activityStatuses[activity.id] ?? 'não_iniciada';
	const showFields = status === 'em_andamento' || status === 'concluída';
	const fields =
		showFields && activity.completionMode === 'required_fields'
			? activity.fields.filter((field) => field.dataTarget === 'answer').map((field) => buildField(field, answers))
			: null;

	return { id: activity.id, title: activity.title, status, statusLabel: STATUS_LABEL[status], fields };
}

function buildContinuity(
	projectId: string,
	hasPendingClosureWork: boolean,
	nextActivityPhaseId: string | null
): ClosureContinuityView {
	const href = `/projects/${projectId}/now`;

	if (!hasPendingClosureWork) {
		return { kind: 'completed', message: 'Etapa de encerramento concluída.' };
	}

	if (nextActivityPhaseId === VALIDACAO_PHASE_ID) {
		return {
			kind: 'closure_cta',
			message: 'Ainda há atividades desta etapa para concluir.',
			ctaLabel: 'Continuar encerramento em Agora',
			href
		};
	}

	return {
		kind: 'earlier_cta',
		message: 'Conclua as etapas anteriores para avançar ao encerramento.',
		ctaLabel: 'Continuar projeto em Agora',
		href
	};
}

export function buildClosureView(catalog: Catalog, input: ClosureViewInput): ClosureView {
	const sections: ClosureSectionView[] = SECTIONS_DEF.map((sectionDef) => ({
		id: sectionDef.id,
		title: sectionDef.title,
		activities: sectionDef.activityIds
			.map((activityId) => findValidacaoActivity(catalog, activityId))
			.filter((activity): activity is ActivityDefinition => activity !== undefined)
			.map((activity) => buildActivityView(activity, input.activityStatuses, input.answers))
	}));

	const hasPendingClosureWork = sections
		.flatMap((section) => section.activities)
		.some((activity) => !isTerminal(activity.status));

	return {
		sections,
		hasPendingClosureWork,
		continuity: buildContinuity(input.projectId, hasPendingClosureWork, input.nextActivityPhaseId),
		recordsHref: `/projects/${input.projectId}/records`
	};
}
