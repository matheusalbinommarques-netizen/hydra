// Montagem do DTO ProjectView a partir de ProjectState + Catalog — uso
// interno; nunca expõe ProjectState bruto (ver contracts.md §10).

import type { ActivityDefinition, ActivityStatus, Catalog, ProjectState } from '$lib/domain';
import { getAffectedGroupConfirmationIssues, getScopeConfirmationIssues } from '$lib/domain';
import {
	computeCriteriaScopeConflict,
	computeFieldSuggestions,
	computeScopeProjection,
	computeScopeSuggestions,
	computeSnapshot
} from '$lib/orientation-engine';
import type { AffectedGroupView, ImpedimentView, PendingItemHistoryView, ProjectView, ScopeItemView } from './types';

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
		// A capacidade declarada de gerar pendência é allowsSkip — só uma
		// atividade pulável pode ter um PendingItem aberto. pendingItemLabel/
		// pendingItemDetail são exigidos apenas como defesa de apresentação
		// (o texto precisa existir para ser exibido), não como proxy da
		// capacidade em si.
		if (
			!activity ||
			!activity.allowsSkip ||
			activity.pendingItemLabel === undefined ||
			activity.pendingItemDetail === undefined
		) {
			continue;
		}

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
		sourceSuggestionId: item.sourceSuggestionId,
		executionStatus: item.executionStatus ?? 'a_fazer'
	};
}

function buildImpedimentView(impediment: ProjectState['impediments'][number]): ImpedimentView {
	return {
		id: impediment.id,
		text: impediment.text,
		tipo: impediment.tipo,
		nextAction: impediment.nextAction,
		status: impediment.status,
		createdAt: impediment.createdAt,
		resolvedAt: impediment.resolvedAt
	};
}

function buildAffectedGroupView(group: ProjectState['affectedGroups'][number]): AffectedGroupView {
	return { id: group.id, label: group.label, impact: group.impact, frequency: group.frequency };
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
		createdAt: state.project.createdAt,
		routeStartPhaseId: state.project.routeStartPhaseId ?? null,
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
		scopeSuggestions: computeScopeSuggestions(state.answers, state.scopeItems),
		fieldSuggestions: computeFieldSuggestions(catalog, state.answers),
		criteriaScopeConflict: computeCriteriaScopeConflict(state.answers, state.scopeItems),
		impediments: state.impediments.map(buildImpedimentView),
		affectedGroups: state.affectedGroups.map(buildAffectedGroupView),
		affectedGroupConfirmationIssues: getAffectedGroupConfirmationIssues(state.affectedGroups)
	};
}
