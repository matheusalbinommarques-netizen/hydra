// Snapshot agregado — ver docs/06-architecture/contracts.md §8.
// Única saída que routes/ e server/application/ devem consumir do motor.

import type { Catalog, ProjectState } from '$lib/domain';
import { computePhaseStatus, type PhaseStatus } from './phase-status';
import { computeProjectStatus, type ProjectStatus } from './project-status';
import { computeNextActivity, type NextActivityResult } from './next-activity';
import { computeOpenPendingItems, type PendingItemView } from './pending-items';
import { computeHypotheses, type HypothesisView } from './hypotheses';

export interface OrientationSnapshot {
	projectStatus: ProjectStatus;
	phaseStatuses: Record<string, PhaseStatus>;
	nextActivity: NextActivityResult;
	openPendingItems: PendingItemView[];
	hypotheses: HypothesisView[];
}

export function computeSnapshot(catalog: Catalog, state: ProjectState): OrientationSnapshot {
	const phaseStatuses: Record<string, PhaseStatus> = {};
	for (const phase of catalog.phases) {
		phaseStatuses[phase.id] = computePhaseStatus(phase, state.activityProgress, state.pendingItems);
	}

	return {
		projectStatus: computeProjectStatus(state.project, catalog, state.activityProgress),
		phaseStatuses,
		nextActivity: computeNextActivity(catalog, state.activityProgress),
		openPendingItems: computeOpenPendingItems(catalog, state.pendingItems),
		hypotheses: computeHypotheses(catalog, state.answers)
	};
}
