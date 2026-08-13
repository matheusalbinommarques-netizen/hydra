// Fábrica pura de estado inicial — ver docs/06-architecture/contracts.md §4.

import type { Catalog } from './catalog-types';
import type { ActivityProgress, ProjectState } from './state-types';

export function createInitialProjectState(
	catalog: Catalog,
	projectId: string,
	createdAt: string
): ProjectState {
	const activityProgress: ActivityProgress[] = [];

	for (const phase of catalog.phases) {
		for (const activity of phase.activities) {
			activityProgress.push({
				projectId,
				activityDefinitionId: activity.id,
				status: 'não_iniciada'
			});
		}
	}

	return {
		project: { id: projectId, name: null, createdAt, routeStartPhaseId: null },
		activityProgress,
		answers: [],
		pendingItems: [],
		scopeItems: [],
		scopeVersion: { projectId, hypothesis: '', confirmedAt: null },
		impediments: [],
		affectedGroups: [],
		externalActions: [],
		evidences: []
	};
}
