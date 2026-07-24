// Montagem do DTO ProjectView a partir de ProjectState + Catalog — uso
// interno; nunca expõe ProjectState bruto (ver contracts.md §10).

import type { ActivityStatus, Catalog, ProjectState } from '$lib/domain';
import { computeSnapshot } from '$lib/orientation-engine';
import type { ProjectView } from './types';

export function buildProjectView(catalog: Catalog, state: ProjectState): ProjectView {
	const snapshot = computeSnapshot(catalog, state);

	const activityStatuses: Record<string, ActivityStatus> = {};
	for (const progress of state.activityProgress) {
		activityStatuses[progress.activityDefinitionId] = progress.status;
	}

	const answers: Record<string, string> = {};
	for (const answer of state.answers) {
		answers[answer.fieldDefinitionId] = answer.value;
	}

	return {
		projectId: state.project.id,
		projectName: state.project.name,
		projectStatus: snapshot.projectStatus,
		phaseStatuses: snapshot.phaseStatuses,
		activityStatuses,
		answers,
		nextActivity: snapshot.nextActivity,
		openPendingItems: snapshot.openPendingItems,
		hypotheses: snapshot.hypotheses
	};
}
