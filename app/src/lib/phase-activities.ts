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

// Fase atual do projeto: a fase da atividade recomendada (Trilha A); quando
// o catálogo já foi esgotado (catalog_limit_reached), a última fase com
// atividades aplicáveis — normalmente a fase final, já totalmente resolvida.
// Extraído de phase-progress.ts (S13) para ser reaproveitado também pela
// projeção `currentPhase` de ProjectView, sem duplicar a regra de fallback.
export function findCurrentPhase(phases: PhaseActivitiesView[]): PhaseActivitiesView | undefined {
	const current = phases.find((phase) => phase.isCurrent);
	if (current) return current;
	return [...phases].reverse().find((phase) => phase.catalogStatus !== 'unavailable');
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
