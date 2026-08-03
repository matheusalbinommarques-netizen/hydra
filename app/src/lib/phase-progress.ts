// Progresso da fase atual — apresentação para o painel "Progresso da fase"
// de Agora (`/now`). Reaproveita buildPhaseActivities (phase-activities.ts,
// a mesma projeção usada pelo Mapa) para não duplicar classificação de
// status, cálculo de atividade atual nem filtragem de atividades aplicáveis.
// Não persiste percentual nem introduz estado de domínio novo — resolved é
// sempre recomputado a partir de ActivityStatus. Assim como
// phase-activities.ts, é apresentação pura, sem decisão de orientação — não
// pertence a orientation-engine/.

import type { Catalog } from '$lib/domain';
import { buildPhaseActivities } from './phase-activities';
import type { PhaseActivitiesInput, PhaseActivityView } from './phase-activities';

export type PhaseProgressGroupKey = 'concluidas' | 'atual' | 'pendentes' | 'puladas';

export interface PhaseProgressGroup {
	key: PhaseProgressGroupKey;
	activities: PhaseActivityView[];
}

export interface PhaseProgressView {
	phaseId: string;
	phaseLabel: string;
	phaseOrder: number;
	totalPhases: number;
	totalActivities: number;
	resolvedActivities: number;
	groups: PhaseProgressGroup[];
}

// Fase alvo do painel: a fase da atividade recomendada (Trilha A), igual ao
// "Onde estamos" de journey-context.ts; quando o catálogo já foi esgotado
// (catalog_limit_reached), usa a última fase com atividades aplicáveis —
// normalmente a fase final, já totalmente resolvida.
function findTargetPhase(phases: ReturnType<typeof buildPhaseActivities>) {
	const current = phases.find((phase) => phase.isCurrent);
	if (current) return current;
	return [...phases].reverse().find((phase) => phase.catalogStatus !== 'unavailable');
}

export function buildPhaseProgress(catalog: Catalog, input: PhaseActivitiesInput): PhaseProgressView | undefined {
	const phases = buildPhaseActivities(catalog, input);
	const targetPhase = findTargetPhase(phases);
	if (!targetPhase) return undefined;

	const resolvedActivities = targetPhase.activities.filter(
		(activity) => activity.status === 'concluída' || activity.status === 'pulada'
	).length;

	const groups: PhaseProgressGroup[] = [
		{
			key: 'concluidas',
			activities: targetPhase.activities.filter((activity) => activity.status === 'concluída')
		},
		{
			key: 'atual',
			activities: targetPhase.activities.filter((activity) => activity.isCurrent)
		},
		{
			key: 'pendentes',
			activities: targetPhase.activities.filter(
				(activity) =>
					!activity.isCurrent && (activity.status === 'não_iniciada' || activity.status === 'em_andamento')
			)
		},
		{
			key: 'puladas',
			activities: targetPhase.activities.filter((activity) => activity.status === 'pulada')
		}
	];

	return {
		phaseId: targetPhase.id,
		phaseLabel: targetPhase.label,
		phaseOrder: targetPhase.order,
		totalPhases: catalog.phases.length,
		totalActivities: targetPhase.activities.length,
		resolvedActivities,
		groups
	};
}
