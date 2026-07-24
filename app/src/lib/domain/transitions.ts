// Operações puras de transição — ver docs/06-architecture/contracts.md §5
// e docs/core/STATE_MACHINE.md.

import type { ActivityDefinition, Catalog, RequiredFieldsActivity } from './catalog-types';
import type { ActivityProgress, ActivityStatus, PendingItem, ProjectState } from './state-types';
import type { Result } from './result';

export type DomainTransitionError =
	| { kind: 'activity_not_found' }
	| { kind: 'wrong_completion_mode' }
	| { kind: 'activity_not_skippable' }
	| { kind: 'unknown_field'; fieldDefinitionId: string }
	| { kind: 'transition_not_allowed'; from: ActivityStatus };

export type ProjectStateChange =
	| { kind: 'answer'; activityDefinitionId: string }
	| { kind: 'project_name' };

// --- helpers internos (não exportados) ---------------------------------

function findActivityDefinition(catalog: Catalog, activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

function findExplicitConfirmationActivity(catalog: Catalog): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.completionMode === 'explicit_confirmation');
		if (found) return found;
	}
	return undefined;
}

function findActivityProgress(state: ProjectState, activityId: string): ActivityProgress | undefined {
	return state.activityProgress.find((progress) => progress.activityDefinitionId === activityId);
}

function setActivityStatus(state: ProjectState, activityId: string, status: ActivityStatus): ProjectState {
	const exists = state.activityProgress.some((progress) => progress.activityDefinitionId === activityId);
	const activityProgress = exists
		? state.activityProgress.map((progress) =>
				progress.activityDefinitionId === activityId ? { ...progress, status } : progress
			)
		: [...state.activityProgress, { projectId: state.project.id, activityDefinitionId: activityId, status }];
	return { ...state, activityProgress };
}

function resolvePendingItem(state: ProjectState, activityId: string, resolvedAt: string): ProjectState {
	const pendingItems: PendingItem[] = state.pendingItems.map((item) => {
		if (item.activityDefinitionId !== activityId || item.status !== 'aberta') return item;
		return {
			id: item.id,
			projectId: item.projectId,
			activityDefinitionId: item.activityDefinitionId,
			createdAt: item.createdAt,
			status: 'resolvida',
			resolvedAt
		};
	});
	return { ...state, pendingItems };
}

function invalidateSummary(catalog: Catalog, state: ProjectState): ProjectState {
	const resumo = findExplicitConfirmationActivity(catalog);
	if (!resumo) return state;
	return setActivityStatus(state, resumo.id, 'em_andamento');
}

// --- funções públicas ----------------------------------------------------

export function isActivityFieldsValid(activity: RequiredFieldsActivity, state: ProjectState): boolean {
	return activity.fields.every((field) => {
		if (!field.required) return true;
		if (field.dataTarget === 'project_property') {
			return !!state.project.name && state.project.name.trim().length > 0;
		}
		const answer = state.answers.find(
			(a) => a.activityDefinitionId === activity.id && a.fieldDefinitionId === field.id
		);
		return !!answer && answer.value.trim().length > 0;
	});
}

export function shouldInvalidateSummary(
	catalog: Catalog,
	state: ProjectState,
	change: ProjectStateChange
): boolean {
	const resumo = findExplicitConfirmationActivity(catalog);
	if (!resumo) return false;

	const resumoProgress = findActivityProgress(state, resumo.id);
	if (!resumoProgress || resumoProgress.status !== 'concluída') return false;

	if (change.kind === 'project_name') return true;

	const changedActivity = findActivityDefinition(catalog, change.activityDefinitionId);
	if (!changedActivity) return false;

	return changedActivity.phaseId === resumo.phaseId && changedActivity.order < resumo.order;
}

export function answerActivity(
	catalog: Catalog,
	state: ProjectState,
	activityDefinitionId: string,
	values: Record<string, string>,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findActivityDefinition(catalog, activityDefinitionId);
	if (!activity) return { ok: false, error: { kind: 'activity_not_found' } };
	if (activity.completionMode !== 'required_fields') {
		return { ok: false, error: { kind: 'wrong_completion_mode' } };
	}

	const fieldById = new Map(activity.fields.map((field) => [field.id, field]));
	for (const fieldId of Object.keys(values)) {
		if (!fieldById.has(fieldId)) {
			return { ok: false, error: { kind: 'unknown_field', fieldDefinitionId: fieldId } };
		}
	}

	let nextState = state;
	let anyAnswerChange = false;
	let anyNameChange = false;

	for (const [fieldId, newValue] of Object.entries(values)) {
		const field = fieldById.get(fieldId)!;

		if (field.dataTarget === 'project_property') {
			const oldValue = nextState.project.name ?? '';
			if (oldValue === newValue) continue;
			anyNameChange = true;
			nextState = { ...nextState, project: { ...nextState.project, name: newValue } };
			continue;
		}

		const existingIndex = nextState.answers.findIndex(
			(a) => a.activityDefinitionId === activityDefinitionId && a.fieldDefinitionId === fieldId
		);
		const oldValue = existingIndex >= 0 ? nextState.answers[existingIndex].value : '';
		if (oldValue === newValue) continue;
		anyAnswerChange = true;

		if (existingIndex >= 0) {
			nextState = {
				...nextState,
				answers: nextState.answers.map((a, i) =>
					i === existingIndex ? { ...a, value: newValue, updatedAt: occurredAt } : a
				)
			};
		} else {
			nextState = {
				...nextState,
				answers: [
					...nextState.answers,
					{
						projectId: nextState.project.id,
						activityDefinitionId,
						fieldDefinitionId: fieldId,
						value: newValue,
						createdAt: occurredAt,
						updatedAt: occurredAt
					}
				]
			};
		}
	}

	const progress = findActivityProgress(nextState, activityDefinitionId);
	const currentStatus = progress?.status ?? 'não_iniciada';
	const valid = isActivityFieldsValid(activity, nextState);

	let newStatus: ActivityStatus;
	if (currentStatus === 'concluída') {
		newStatus = valid ? 'concluída' : 'em_andamento'; // nunca pulada
	} else if (currentStatus === 'pulada') {
		newStatus = valid ? 'concluída' : 'pulada';
	} else {
		newStatus = valid ? 'concluída' : 'em_andamento';
	}

	nextState = setActivityStatus(nextState, activityDefinitionId, newStatus);

	if (currentStatus === 'pulada' && newStatus === 'concluída') {
		nextState = resolvePendingItem(nextState, activityDefinitionId, occurredAt);
	}

	if (anyNameChange && shouldInvalidateSummary(catalog, nextState, { kind: 'project_name' })) {
		nextState = invalidateSummary(catalog, nextState);
	} else if (
		anyAnswerChange &&
		shouldInvalidateSummary(catalog, nextState, { kind: 'answer', activityDefinitionId })
	) {
		nextState = invalidateSummary(catalog, nextState);
	}

	return { ok: true, value: nextState };
}

export function confirmSummary(
	catalog: Catalog,
	state: ProjectState
): Result<ProjectState, DomainTransitionError> {
	const resumo = findExplicitConfirmationActivity(catalog);
	if (!resumo) return { ok: false, error: { kind: 'activity_not_found' } };

	const progress = findActivityProgress(state, resumo.id);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus === 'concluída') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	return { ok: true, value: setActivityStatus(state, resumo.id, 'concluída') };
}

export function skipActivity(
	catalog: Catalog,
	state: ProjectState,
	activityDefinitionId: string,
	newPendingItemId: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findActivityDefinition(catalog, activityDefinitionId);
	if (!activity) return { ok: false, error: { kind: 'activity_not_found' } };
	if (!activity.allowsSkip) {
		return { ok: false, error: { kind: 'activity_not_skippable' } };
	}

	const progress = findActivityProgress(state, activityDefinitionId);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus !== 'não_iniciada' && currentStatus !== 'em_andamento') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	let nextState = setActivityStatus(state, activityDefinitionId, 'pulada');

	const hasExistingPendingItem = nextState.pendingItems.some(
		(item) => item.activityDefinitionId === activityDefinitionId
	);
	if (!hasExistingPendingItem) {
		nextState = {
			...nextState,
			pendingItems: [
				...nextState.pendingItems,
				{
					id: newPendingItemId,
					projectId: nextState.project.id,
					activityDefinitionId,
					status: 'aberta',
					createdAt: occurredAt
				}
			]
		};
	}

	return { ok: true, value: nextState };
}

export function renameProject(
	catalog: Catalog,
	state: ProjectState,
	name: string
): Result<ProjectState, DomainTransitionError> {
	if (state.project.name === name) {
		return { ok: true, value: state };
	}

	let nextState: ProjectState = { ...state, project: { ...state.project, name } };

	if (shouldInvalidateSummary(catalog, nextState, { kind: 'project_name' })) {
		nextState = invalidateSummary(catalog, nextState);
	}

	return { ok: true, value: nextState };
}
