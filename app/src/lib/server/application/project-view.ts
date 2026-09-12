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
	ChangeView,
	CurrentTreatmentView,
	DecisionAffectedWorkItemView,
	DecisionView,
	DesiredOutcomeView,
	EvidenceView,
	ExternalActionView,
	ImpedimentView,
	PendingItemHistoryView,
	ProjectView,
	ScopeItemView,
	TreatmentStepView,
	DeliverableView,
	MilestoneView,
	MilestoneWorkItemView,
	RiskView,
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

// Deliverable (ETAPA 9 do rework, primeiro microcorte) — projeção direta,
// sem nenhum agregado derivado: entrega não tem status, progresso nem
// contagem de trabalho neste contrato. O ScopeItem de origem NÃO é
// consultado aqui: nada da entrega é recalculado a partir dele, e ele pode
// nem existir mais.
function buildDeliverableView(deliverable: ProjectState['deliverables'][number]): DeliverableView {
	return {
		id: deliverable.id,
		title: deliverable.title,
		bucket: deliverable.bucket,
		effort: deliverable.effort,
		order: deliverable.order,
		sourceScopeItemId: deliverable.sourceScopeItemId
	};
}

// decisionSubject (ETAPA 11 do rework, segundo microcorte, §41/§13.4) —
// denormalizado aqui, mesmo espírito de blockedBy em buildWorkItemView
// abaixo: a interface exibe a Decision relacionada pelo subject sem round-
// trip adicional. Nunca persistido — sempre derivado de state.decisions no
// momento da leitura.
function buildImpedimentView(
	state: ProjectState,
	impediment: ProjectState['impediments'][number]
): ImpedimentView {
	const decision =
		impediment.decisionId !== null
			? state.decisions.find((candidate) => candidate.id === impediment.decisionId)
			: undefined;
	return {
		id: impediment.id,
		text: impediment.text,
		tipo: impediment.tipo,
		nextAction: impediment.nextAction,
		status: impediment.status,
		workItemId: impediment.workItemId,
		decisionId: impediment.decisionId,
		decisionSubject: decision?.subject ?? null,
		createdAt: impediment.createdAt,
		resolvedAt: impediment.resolvedAt
	};
}

function buildRiskView(risk: ProjectState['risks'][number]): RiskView {
	return {
		id: risk.id,
		statement: risk.statement,
		status: risk.status,
		createdAt: risk.createdAt,
		closedAt: risk.closedAt,
		reviewedAt: risk.reviewedAt,
		likelihood: risk.likelihood,
		impact: risk.impact,
		response: risk.response
	};
}

// affectedWorkItems (ETAPA 11 do rework, terceiro microcorte, §41) — mesmo
// tratamento de vínculo órfão de buildMilestoneView: um WorkItem ausente só
// poderia vir de estado corrompido (FK + invariante na desserialização),
// filtrado em vez de quebrar a tela.
function buildDecisionView(state: ProjectState, decision: ProjectState['decisions'][number]): DecisionView {
	const affectedWorkItems: DecisionAffectedWorkItemView[] = [];
	for (const link of state.decisionAffectedWorkItems) {
		if (link.decisionId !== decision.id) continue;
		const workItem = state.workItems.find((item) => item.id === link.workItemId);
		if (!workItem) continue;
		affectedWorkItems.push({
			decisionAffectedWorkItemId: link.id,
			workItemId: workItem.id,
			title: workItem.title
		});
	}
	return {
		id: decision.id,
		subject: decision.subject,
		options: decision.options,
		dueDate: decision.dueDate,
		responsible: decision.responsible,
		status: decision.status,
		outcome: decision.outcome,
		decidedAt: decision.decidedAt,
		createdAt: decision.createdAt,
		affectedWorkItems
	};
}

function buildChangeView(change: ProjectState['changes'][number]): ChangeView {
	return {
		id: change.id,
		statement: change.statement,
		impact: change.impact,
		createdAt: change.createdAt
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
	const deliverable =
		item.deliverableId !== null ? state.deliverables.find((d) => d.id === item.deliverableId) : undefined;
	return {
		id: item.id,
		title: item.title,
		status: item.status,
		createdAt: item.createdAt,
		blockedBy: blocking ? { impedimentId: blocking.id, text: blocking.text, tipo: blocking.tipo } : null,
		dependsOn: buildWorkItemDependencyViews(state, item.id),
		// Proveniência órfã (Deliverable removida de outro caminho que não
		// removeDeliverable, ou inconsistência de estado) é tratada como
		// ausência de origem, mesmo espírito de buildWorkItemDependencyViews —
		// nunca quebra a tela.
		deliverable: deliverable ? { deliverableId: deliverable.id, title: deliverable.title } : null,
		plannedStart: item.plannedStart,
		durationDays: item.durationDays
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

// Milestone (ETAPA 8 do rework, segundo microcorte) — `status` vem do estado
// DECLARADO, nunca derivado: nenhum trabalho relacionado aberto rebaixa um
// marco alcançado, e nenhum conjunto de trabalhos concluídos alcança um marco
// sozinho. O único cálculo aqui é CONTEXTO: quantos dos trabalhos que o
// usuário associou já estão concluídos. Marco sem trabalho associado produz
// lista vazia e `relatedConcluded: 0` — a interface não deve ler isso como
// prontidão (ver +page.svelte, seção Marcos).
//
// Vínculo órfão não é representável (FK no schema + invariante na
// desserialização), então um WorkItem ausente só poderia vir de estado
// corrompido — filtrado em vez de quebrar a tela, mesmo tratamento de
// buildWorkItemDependencyViews.
function buildMilestoneView(state: ProjectState, milestone: ProjectState['milestones'][number]): MilestoneView {
	const relatedWorkItems: MilestoneWorkItemView[] = [];
	for (const link of state.milestoneWorkItems) {
		if (link.milestoneId !== milestone.id) continue;
		const workItem = state.workItems.find((item) => item.id === link.workItemId);
		if (!workItem) continue;
		relatedWorkItems.push({
			milestoneWorkItemId: link.id,
			workItemId: workItem.id,
			title: workItem.title,
			status: workItem.status
		});
	}
	return {
		id: milestone.id,
		title: milestone.title,
		status: milestone.status,
		reachedAt: milestone.reachedAt,
		plannedDate: milestone.plannedDate,
		createdAt: milestone.createdAt,
		relatedWorkItems,
		relatedConcluded: relatedWorkItems.filter((item) => item.status === 'concluido').length
	};
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
		deliverables: state.deliverables.map(buildDeliverableView),
		impediments: state.impediments.map((impediment) => buildImpedimentView(state, impediment)),
		workItems: state.workItems.map((item) => buildWorkItemView(state, item)),
		milestones: state.milestones.map((milestone) => buildMilestoneView(state, milestone)),
		risks: state.risks.map(buildRiskView),
		decisions: state.decisions.map((decision) => buildDecisionView(state, decision)),
		changes: state.changes.map(buildChangeView),
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
