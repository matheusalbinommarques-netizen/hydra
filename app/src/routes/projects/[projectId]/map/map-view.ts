// Projeção pura de leitura para a Tela Mapa — cruza catalog/ (estático) com
// os campos de ProjectView já expostos pela camada de aplicação. Não lê nem
// grava persistência, não conhece ProjectState bruto.

import type { ActivityStatus, Catalog } from '$lib/domain';
import type { NextActivityResult, PhaseStatus } from '$lib/orientation-engine';

export interface MapViewInput {
	activityStatuses: Record<string, ActivityStatus>;
	phaseStatuses: Record<string, PhaseStatus>;
	nextActivity: NextActivityResult;
}

export interface MapActivityView {
	id: string;
	title: string;
	order: number;
	status: ActivityStatus;
	isCurrent: boolean;
}

export interface MapPhaseView {
	id: string;
	label: string;
	order: number;
	catalogStatus: Catalog['phases'][number]['catalogStatus'];
	phaseStatus: PhaseStatus;
	isCurrent: boolean;
	activities: MapActivityView[];
}

export function buildMapView(catalog: Catalog, input: MapViewInput): MapPhaseView[] {
	const currentActivityId =
		input.nextActivity.kind === 'recommendation' ? input.nextActivity.activityDefinitionId : undefined;

	return catalog.phases.map((phase) => {
		const activities: MapActivityView[] = phase.activities.map((activity) => ({
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
