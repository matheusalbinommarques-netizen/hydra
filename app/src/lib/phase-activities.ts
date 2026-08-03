// Projeção pura, compartilhada, de apresentação — cruza catalog/ (estático)
// com o estado já exposto por ProjectView (activityStatuses/phaseStatuses/
// nextActivity) — mesma fonte usada pelo Mapa (`/map`) e pelo painel
// "Progresso da fase" de Agora (`/now`, ver phase-progress.ts). Não decide
// nada (isso é orientation-engine/) — só agrupa e formata um resultado já
// calculado, por isso vive fora do motor de orientação.

import type { ActivityStatus, Catalog } from '$lib/domain';
import type { NextActivityResult, PhaseStatus } from '$lib/orientation-engine';

export interface PhaseActivitiesInput {
	activityStatuses: Record<string, ActivityStatus>;
	phaseStatuses: Record<string, PhaseStatus>;
	nextActivity: NextActivityResult;
}

export interface PhaseActivityView {
	id: string;
	title: string;
	order: number;
	status: ActivityStatus;
	isCurrent: boolean;
}

export interface PhaseActivitiesView {
	id: string;
	label: string;
	order: number;
	catalogStatus: Catalog['phases'][number]['catalogStatus'];
	phaseStatus: PhaseStatus;
	isCurrent: boolean;
	activities: PhaseActivityView[];
}

export function buildPhaseActivities(catalog: Catalog, input: PhaseActivitiesInput): PhaseActivitiesView[] {
	const currentActivityId =
		input.nextActivity.kind === 'recommendation' ? input.nextActivity.activityDefinitionId : undefined;

	return catalog.phases.map((phase) => {
		const activities: PhaseActivityView[] = phase.activities.map((activity) => ({
			id: activity.id,
			title: activity.title,
			order: activity.order,
			status: input.activityStatuses[activity.id] ?? 'não_iniciada',
			isCurrent: activity.id === currentActivityId
		}));

		return {
			id: phase.id,
			label: phase.label,
			order: phase.order,
			catalogStatus: phase.catalogStatus,
			phaseStatus: input.phaseStatuses[phase.id] ?? 'não_iniciada',
			isCurrent: activities.some((activity) => activity.isCurrent),
			activities
		};
	});
}
