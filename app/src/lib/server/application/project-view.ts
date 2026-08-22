// Montagem do DTO ProjectView a partir de ProjectState + Catalog — uso
// interno; nunca expõe ProjectState bruto (ver contracts.md §10).

import type { ActivityDefinition, ActivityStatus, Catalog, ProjectState } from '$lib/domain';
import {
	getAffectedGroupConfirmationIssues,
	getCauseHypothesesConfirmationIssues,
	getDesiredOutcomeConfirmationIssues,
	getScopeConfirmationIssues,
	getTreatmentConfirmationIssues
} from '$lib/domain';
import {
	computeCriteriaScopeConflict,
	computeFieldSuggestions,
	computeScopeProjection,
	computeScopeSuggestions,
	computeSnapshot
} from '$lib/orientation-engine';
import { hasOpenImpediment } from '$lib/domain';
import type {
	AffectedGroupView,
	CauseExplorationView,
	CauseHypothesisView,
	CurrentTreatmentView,
	DesiredOutcomeView,
	EvidenceView,
	ExternalActionView,
	ImpedimentView,
	PendingItemHistoryView,
	ProjectView,
	ScopeItemView,
	TreatmentStepView,
	WorkItemDependencyView,
	WorkItemView
} from './types';

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
		workItemId: impediment.workItemId,
		createdAt: impediment.createdAt,
		resolvedAt: impediment.resolvedAt
	};
}

// blockedBy é sempre derivado aqui, nunca lido de um campo persistido (ver
// domain/transitions.ts, hasOpenImpediment) — "bloqueado" nunca é status nem
// coluna. Quando mais de um Impediment aberto aponta para o mesmo WorkItem
// (schema permite; a interface desta rodada só cria um por vez), o primeiro
// encontrado é o exibido — sem ordenação especial, mesmo espírito de
// singleOpenAction em outras telas.
function buildWorkItemView(state: ProjectState, item: ProjectState['workItems'][number]): WorkItemView {
	const blocking = hasOpenImpediment(state, item.id)
		? state.impediments.find((impediment) => impediment.workItemId === item.id && impediment.status === 'aberto')
		: undefined;
	return {
		id: item.id,
		title: item.title,
		status: item.status,
		createdAt: item.createdAt,
		blockedBy: blocking ? { impedimentId: blocking.id, text: blocking.text, tipo: blocking.tipo } : null,
		dependsOn: buildWorkItemDependencyViews(state, item.id)
	};
}

// "Aguardando" nunca é persistido — é sempre derivado aqui do status do
// predecessor (mesmo espírito de blockedBy acima): a dependência está
// satisfeita quando o WorkItem do qual se depende está 'concluido'.
// Dependência órfã não é representável (FK no schema + invariante na
// desserialização), então um predecessor ausente só poderia vir de estado
// corrompido — filtrado em vez de quebrar a tela.
function buildWorkItemDependencyViews(state: ProjectState, workItemId: string): WorkItemDependencyView[] {
	const views: WorkItemDependencyView[] = [];
	for (const dependency of state.dependencies) {
		if (dependency.workItemId !== workItemId) continue;
		const predecessor = state.workItems.find((item) => item.id === dependency.dependsOnWorkItemId);
		if (!predecessor) continue;
		views.push({
			dependencyId: dependency.id,
			dependsOnWorkItemId: predecessor.id,
			title: predecessor.title,
			satisfied: predecessor.status === 'concluido'
		});
	}
	return views;
}

function buildAffectedGroupView(group: ProjectState['affectedGroups'][number]): AffectedGroupView {
	return { id: group.id, label: group.label, impact: group.impact, frequency: group.frequency };
}

function buildExternalActionView(action: ProjectState['externalActions'][number]): ExternalActionView {
	return {
		id: action.id,
		affectedGroupId: action.affectedGroupId,
		status: action.status,
		objective: action.objective,
		questions: action.questions,
		informationToTake: action.informationToTake,
		expectedResult: action.expectedResult
	};
}

function buildTreatmentStepView(step: ProjectState['treatmentSteps'][number]): TreatmentStepView {
	return {
		id: step.id,
		order: step.order,
		whatHappens: step.whatHappens,
		actors: step.actors,
		medium: step.medium,
		frictions: step.frictions
	};
}

function buildCurrentTreatmentView(currentTreatment: ProjectState['currentTreatment']): CurrentTreatmentView {
	return { noTreatment: currentTreatment.noTreatment };
}

function buildCauseHypothesisView(hypothesis: ProjectState['causeHypotheses'][number]): CauseHypothesisView {
	return {
		id: hypothesis.id,
		title: hypothesis.title,
		origin: hypothesis.origin,
		expectedIfTrue: hypothesis.expectedIfTrue,
		whatWeakensIt: hypothesis.whatWeakensIt,
		evidenceIds: hypothesis.evidenceIds
	};
}

function buildCauseExplorationView(causeExploration: ProjectState['causeExploration']): CauseExplorationView {
	return { stillUnknown: causeExploration.stillUnknown };
}

function buildDesiredOutcomeView(outcome: ProjectState['desiredOutcomes'][number]): DesiredOutcomeView {
	return { id: outcome.id, change: outcome.change, target: outcome.target, order: outcome.order };
}

function buildEvidenceView(evidence: ProjectState['evidences'][number]): EvidenceView {
	return {
		id: evidence.id,
		externalActionId: evidence.externalActionId,
		affectedGroupId: evidence.affectedGroupId,
		outcome: evidence.outcome,
		learning: evidence.learning,
		createdAt: evidence.createdAt
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
		workItems: state.workItems.map((item) => buildWorkItemView(state, item)),
		affectedGroups: state.affectedGroups.map(buildAffectedGroupView),
		affectedGroupConfirmationIssues: getAffectedGroupConfirmationIssues(state.affectedGroups),
		externalActions: state.externalActions.map(buildExternalActionView),
		evidences: state.evidences.map(buildEvidenceView),
		currentTreatment: buildCurrentTreatmentView(state.currentTreatment),
		treatmentSteps: state.treatmentSteps.map(buildTreatmentStepView).sort((a, b) => a.order - b.order),
		treatmentConfirmationIssues: getTreatmentConfirmationIssues(state.currentTreatment.noTreatment, state.treatmentSteps),
		causeExploration: buildCauseExplorationView(state.causeExploration),
		causeHypotheses: state.causeHypotheses.map(buildCauseHypothesisView),
		causeHypothesisConfirmationIssues: getCauseHypothesesConfirmationIssues(),
		desiredOutcomes: state.desiredOutcomes.map(buildDesiredOutcomeView).sort((a, b) => a.order - b.order),
		desiredOutcomeConfirmationIssues: getDesiredOutcomeConfirmationIssues(state.desiredOutcomes)
	};
}
