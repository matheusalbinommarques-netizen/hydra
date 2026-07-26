// Montagem do DTO ProjectView a partir de ProjectState + Catalog — uso
// interno; nunca expõe ProjectState bruto (ver contracts.md §10).

import type { ActivityDefinition, ActivityStatus, Catalog, ProjectState } from '$lib/domain';
import { getScopeConfirmationIssues } from '$lib/domain';
import { computeScopeProjection, computeScopeSuggestions, computeSnapshot } from '$lib/orientation-engine';
import type { PendingItemHistoryView, ProjectView, ScopeItemView } from './types';

function findActivityDefinition(catalog: Catalog, activityDefinitionId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityDefinitionId);
		if (found) return found;
	}
	return undefined;
}

function buildPendingItemHistory(catalog: Catalog, state: ProjectState): PendingItemHistoryView[] {
	const history: PendingItemHistoryView[] = [];
	for (const item of state.pendingItems) {
		const activity = findActivityDefinition(catalog, item.activityDefinitionId);
		if (!activity || activity.completionMode !== 'required_fields') continue;

		if (item.status === 'aberta') {
			history.push({
				id: item.id,
				activityDefinitionId: item.activityDefinitionId,
				label: activity.pendingItemLabel,
				detail: activity.pendingItemDetail,
				status: 'aberta',
				createdAt: item.createdAt
			});
		} else {
			history.push({
				id: item.id,
				activityDefinitionId: item.activityDefinitionId,
				label: activity.pendingItemLabel,
				detail: activity.pendingItemDetail,
				status: 'resolvida',
				createdAt: item.createdAt,
				resolvedAt: item.resolvedAt
			});
		}
	}
	return history;
}

function buildScopeItemView(item: ProjectState['scopeItems'][number]): ScopeItemView {
	return {
		id: item.id,
		text: item.text,
		bucket: item.bucket,
		effort: item.effort,
		order: item.order,
		sourceSuggestionId: item.sourceSuggestionId
	};
}

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
		pendingItemHistory: buildPendingItemHistory(catalog, state),
		hypotheses: snapshot.hypotheses,
		scopeItems: state.scopeItems.map(buildScopeItemView),
		scopeVersion: { hypothesis: state.scopeVersion.hypothesis, confirmedAt: state.scopeVersion.confirmedAt },
		scopeConfirmationIssues: getScopeConfirmationIssues(state.scopeItems, state.scopeVersion),
		scopeProjection: computeScopeProjection(state.scopeItems, state.scopeVersion),
		scopeSuggestions: computeScopeSuggestions(state.answers, state.scopeItems)
	};
}
