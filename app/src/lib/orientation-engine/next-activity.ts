// Trilha A — próxima atividade metodológica — ver docs/06-architecture/contracts.md §8
// e docs/core/ORIENTATION_ENGINE.md §3. Sem mapa fixo: sempre deriva do catálogo + estado.

import type { ActivityProgress, Catalog } from '$lib/domain';

export type NextActivityResult =
	| { kind: 'recommendation'; activityDefinitionId: string }
	| { kind: 'catalog_limit_reached' };

export function computeNextActivity(catalog: Catalog, activityProgress: ActivityProgress[]): NextActivityResult {
	for (const phase of catalog.phases) {
		for (const activity of phase.activities) {
			const progress = activityProgress.find((p) => p.activityDefinitionId === activity.id);
			const status = progress?.status ?? 'não_iniciada';
			if (status === 'não_iniciada' || status === 'em_andamento') {
				return { kind: 'recommendation', activityDefinitionId: activity.id };
			}
		}
	}
	return { kind: 'catalog_limit_reached' };
}
