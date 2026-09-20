// Projeção pura de apresentação para o bloco "Onde estamos" (/now) — localiza
// a fase da próxima atividade recomendada (Trilha A, orientation-engine/) no
// catálogo e devolve seu rótulo e posição oficial. Não recalcula progresso,
// não decide a próxima atividade, não persiste nada.

import type { Catalog } from '$lib/domain';
import type { NextActivityResult } from '$lib/orientation-engine';

export type JourneyContextView =
	| { kind: 'in_progress'; phaseLabel: string; position: number; total: number }
	// catálogo percorrido, projeto ainda aberto (falta encerrar em /closure)
	| { kind: 'awaiting_closure'; total: number }
	// Project.closedAt existe
	| { kind: 'closed' };

export function buildJourneyContext(
	catalog: Catalog,
	nextActivity: NextActivityResult
): JourneyContextView | undefined {
	const total = catalog.phases.length;

	if (nextActivity.kind === 'catalog_limit_reached') {
		return { kind: 'awaiting_closure', total };
	}
	if (nextActivity.kind === 'project_closed') {
		return { kind: 'closed' };
	}

	const phase = catalog.phases.find((p) =>
		p.activities.some((activity) => activity.id === nextActivity.activityDefinitionId)
	);
	if (!phase) return undefined;

	return { kind: 'in_progress', phaseLabel: phase.label, position: phase.order, total };
}
