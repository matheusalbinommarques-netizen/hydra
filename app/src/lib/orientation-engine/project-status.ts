// Status de projeto — ver docs/06-architecture/contracts.md §8 e docs/core/STATE_MACHINE.md §4.

import type { ActivityProgress, Catalog, Project } from '$lib/domain';

export type ProjectStatus = 'rascunho' | 'em_andamento' | 'concluído';

export function computeProjectStatus(
	project: Project,
	catalog: Catalog,
	activityProgress: ActivityProgress[]
): ProjectStatus {
	if (!project.name || project.name.trim().length === 0) return 'rascunho';

	// Fases partial/unavailable nunca contam como concluídas; uma fase complete
	// só conta se TODAS as suas atividades estiverem concluída (não pulada,
	// não em_andamento) — mais rígido que concluída_com_pendências.
	const allPhasesFullyConcluded = catalog.phases.every((phase) => {
		if (phase.catalogStatus !== 'complete') return false;
		return phase.activities.every((activity) => {
			const progress = activityProgress.find((p) => p.activityDefinitionId === activity.id);
			return progress?.status === 'concluída';
		});
	});

	return allPhasesFullyConcluded ? 'concluído' : 'em_andamento';
}
