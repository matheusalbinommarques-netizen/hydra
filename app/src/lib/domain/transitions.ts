// Operações puras de transição — ver docs/06-architecture/contracts.md §5
// e docs/core/STATE_MACHINE.md.

import type { ActivityDefinition, Catalog, RequiredFieldsActivity } from './catalog-types';
import type {
	ActivityProgress,
	ActivityStatus,
	AffectedGroup,
	AffectedGroupFrequency,
	AffectedGroupImpact,
	CauseHypothesis,
	CurrentTreatment,
	Dependency,
	DesiredOutcome,
	Evidence,
	EvidenceOutcome,
	ExternalAction,
	Impediment,
	ImpedimentType,
	PendingItem,
	ProjectState,
	ScopeBucket,
	ScopeEffort,
	ScopeExecutionStatus,
	ScopeItem,
	ScopeVersion,
	TreatmentFriction,
	TreatmentStep,
	WorkItem,
	WorkItemStatus
} from './state-types';
import type { Result } from './result';
import { decodeMultiSelectValue, isValidMultiSelectValue } from './multi-select';
import { decodePlanningItems } from './planning-items';

// missing_effort carrega os ids dos itens concretos que faltam classificar —
// a interface precisa apontar exatamente quais, não só dizer "falta algo"
// (ver docs/core/DOMAIN_MODEL.md). Os demais issues não referenciam item
// nenhum, então não carregam dado extra.
export type ScopeConfirmationIssue =
	| { kind: 'no_items' }
	| { kind: 'no_now_items' }
	| { kind: 'missing_effort'; itemIds: string[] }
	| { kind: 'missing_hypothesis' };

export type DomainTransitionError =
	| { kind: 'activity_not_found' }
	| { kind: 'wrong_completion_mode' }
	| { kind: 'activity_not_skippable' }
	| { kind: 'unknown_field'; fieldDefinitionId: string }
	| { kind: 'invalid_field_value'; fieldDefinitionId: string }
	| { kind: 'transition_not_allowed'; from: ActivityStatus }
	| { kind: 'scope_item_not_found' }
	| { kind: 'scope_reorder_mismatch' }
	| { kind: 'scope_confirmation_invalid'; issues: ScopeConfirmationIssue[] }
	| { kind: 'scope_item_not_agora' }
	| { kind: 'scope_version_not_confirmed' }
	| { kind: 'impediment_not_found' }
	| { kind: 'impediment_id_already_exists' }
	| { kind: 'work_item_not_found' }
	| { kind: 'work_item_blocked' }
	| { kind: 'dependency_not_found' }
	| { kind: 'dependency_self_reference' }
	| { kind: 'dependency_already_exists' }
	| { kind: 'dependency_cycle' }
	| { kind: 'phase_not_found' }
	| { kind: 'planning_no_items' }
	| { kind: 'affected_group_not_found' }
	| { kind: 'affected_group_confirmation_invalid'; issues: AffectedGroupConfirmationIssue[] }
	| { kind: 'affected_group_has_references' }
	| { kind: 'external_action_not_found' }
	| { kind: 'external_action_duplicate_open' }
	| { kind: 'external_action_not_open' }
	| { kind: 'evidence_learning_required' }
	| { kind: 'treatment_step_not_found' }
	| { kind: 'treatment_confirmation_invalid'; issues: TreatmentConfirmationIssue[] }
	| { kind: 'cause_hypothesis_not_found' }
	| { kind: 'cause_exploration_has_hypotheses' }
	| { kind: 'evidence_not_found' }
	| { kind: 'desired_outcome_not_found' }
	| { kind: 'desired_outcome_confirmation_invalid'; issues: DesiredOutcomeConfirmationIssue[] };

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

// Resolve especificamente "Resumo da descoberta" (usado por invalidateSummary/
// shouldInvalidateSummary/confirmSummary). Historicamente buscava "a primeira
// atividade explicit_confirmation do catálogo" — seguro enquanto "resumo" era
// a única. Desde que "Priorizar entregas" (C5-01) e "publico" (ETAPA 2, Mapa
// de Impacto) também viraram explicit_confirmation, uma busca genérica por
// completionMode resolveria de forma ambígua (poderia encontrar "publico",
// que aparece antes de "resumo" na própria fase Descoberta) — por isso a
// busca é por id explícito, mesmo padrão já usado por
// PRIORIZAR_ENTREGAS_ACTIVITY_ID/confirmPlanningPriority abaixo.
const RESUMO_ACTIVITY_ID = 'resumo';
function findExplicitConfirmationActivity(catalog: Catalog): ActivityDefinition | undefined {
	const activity = findActivityDefinition(catalog, RESUMO_ACTIVITY_ID);
	return activity?.completionMode === 'explicit_confirmation' ? activity : undefined;
}

function findScopeConfirmationActivity(catalog: Catalog): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.completionMode === 'scope_confirmation');
		if (found) return found;
	}
	return undefined;
}

function findScopeItem(state: ProjectState, itemId: string): ScopeItem | undefined {
	return state.scopeItems.find((item) => item.id === itemId);
}

function agoraItemsSorted(items: ScopeItem[]): ScopeItem[] {
	return items.filter((item) => item.bucket === 'agora').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function findImpediment(state: ProjectState, impedimentId: string): Impediment | undefined {
	return state.impediments.find((item) => item.id === impedimentId);
}

function findWorkItem(state: ProjectState, workItemId: string): WorkItem | undefined {
	return state.workItems.find((item) => item.id === workItemId);
}

// "Bloqueado" nunca é persistido — sempre derivado, na leitura, de existir
// algum Impediment aberto apontando para este WorkItem (ver
// state-types.ts, WorkItem). Único ponto de verdade desta regra: tanto
// moveWorkItem (abaixo) quanto a camada de apresentação (ProjectView) devem
// chamar esta função, nunca reimplementar o critério.
export function hasOpenImpediment(state: ProjectState, workItemId: string): boolean {
	return state.impediments.some((impediment) => impediment.workItemId === workItemId && impediment.status === 'aberto');
}

function invalidateScopeConfirmation(catalog: Catalog, state: ProjectState): ProjectState {
	if (state.scopeVersion.confirmedAt === null) return state;

	let next: ProjectState = { ...state, scopeVersion: { ...state.scopeVersion, confirmedAt: null } };
	const activity = findScopeConfirmationActivity(catalog);
	if (activity) {
		const progress = findActivityProgress(next, activity.id);
		if (progress?.status === 'concluída') {
			next = setActivityStatus(next, activity.id, 'em_andamento');
		}
	}
	return next;
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
		if (!answer) return false;
		if (field.type === 'selecao_multipla') {
			// "[]" (nada selecionado) tem length > 0 como string — precisa
			// decodificar para saber se o array está de fato vazio.
			const decoded = decodeMultiSelectValue(answer.value);
			return !!decoded && decoded.length > 0;
		}
		if (field.type === 'lista_partes') {
			const items = decodePlanningItems(answer.value);
			return items.length > 0 && items.every((item) => item.text.trim().length > 0);
		}
		return answer.value.trim().length > 0;
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

		if (field.dataTarget === 'answer' && field.type === 'selecao_multipla') {
			const validIds = field.options.map((option) => option.id);
			if (!isValidMultiSelectValue(newValue, validIds)) {
				return { ok: false, error: { kind: 'invalid_field_value', fieldDefinitionId: fieldId } };
			}
		}

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

// C5-01 — "Priorizar entregas" (explicit_confirmation, allowsSkip: true).
// Localiza a atividade por id explícito, nunca via
// findExplicitConfirmationActivity: agora que há duas atividades
// explicit_confirmation no catálogo (Resumo da Descoberta e esta), aquele
// helper resolveria de forma ambígua — continua servindo só ao fluxo do
// Resumo, sem alteração. A coleção de PlanningItem pertence à Answer de
// "Decompor o trabalho" (partes_trabalho); esta função só lê essa Answer
// para validar, nunca a modifica.
const PRIORIZAR_ENTREGAS_ACTIVITY_ID = 'priorizar_entregas';
const DECOMPOR_TRABALHO_ACTIVITY_ID = 'decompor_trabalho';
const PARTES_TRABALHO_FIELD_ID = 'partes_trabalho';

export function confirmPlanningPriority(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findActivityDefinition(catalog, PRIORIZAR_ENTREGAS_ACTIVITY_ID);
	if (!activity || activity.completionMode !== 'explicit_confirmation') {
		return { ok: false, error: { kind: 'activity_not_found' } };
	}

	const progress = findActivityProgress(state, activity.id);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus === 'concluída') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	const answer = state.answers.find(
		(a) =>
			a.activityDefinitionId === DECOMPOR_TRABALHO_ACTIVITY_ID && a.fieldDefinitionId === PARTES_TRABALHO_FIELD_ID
	);
	const items = decodePlanningItems(answer?.value);
	if (items.length === 0) {
		return { ok: false, error: { kind: 'planning_no_items' } };
	}

	let nextState = setActivityStatus(state, activity.id, 'concluída');
	if (currentStatus === 'pulada') {
		nextState = resolvePendingItem(nextState, activity.id, occurredAt);
	}
	return { ok: true, value: nextState };
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

// D023 (docs/07-management/decision-log.md) — ponto de partida da rota
// recomendada. Não toca ActivityProgress: fases anteriores à escolhida não
// são concluídas, puladas nem apagadas, só deixam de ser recomendadas (ver
// orientation-engine/route.ts). `phaseId: null` restaura o percurso completo.
export function setRouteStartPhase(
	catalog: Catalog,
	state: ProjectState,
	phaseId: string | null
): Result<ProjectState, DomainTransitionError> {
	if (phaseId !== null && !catalog.phases.some((phase) => phase.id === phaseId)) {
		return { ok: false, error: { kind: 'phase_not_found' } };
	}
	if ((state.project.routeStartPhaseId ?? null) === phaseId) {
		return { ok: true, value: state };
	}
	return { ok: true, value: { ...state, project: { ...state.project, routeStartPhaseId: phaseId } } };
}

// --- Escolha o próximo foco (ScopeItem / ScopeVersion) --------------------
//
// Qualquer alteração num ScopeItem ou na hipótese invalida uma confirmação
// anterior (limpa scopeVersion.confirmedAt e reabre a atividade
// scope_confirmation), espelhando invalidateSummary — edição pós-confirmação
// nunca é bloqueada, só reabre. Mudança que repete o valor já existente é
// no-op (nem persiste, nem invalida), mesmo padrão de answerActivity/
// renameProject.

/**
 * Retorna a lista de motivos pelos quais a versão de escopo ainda não pode
 * ser confirmada (array vazio = pode confirmar). Função pura, sem
 * dependência do catálogo — usada pela interface (checklist), pelo domínio
 * (confirmScopeVersion) e pelos testes; nenhum dos três deve duplicar esta
 * lógica.
 */
export function getScopeConfirmationIssues(
	scopeItems: ScopeItem[],
	scopeVersion: ScopeVersion
): ScopeConfirmationIssue[] {
	const issues: ScopeConfirmationIssue[] = [];
	if (scopeItems.length === 0) issues.push({ kind: 'no_items' });

	const agoraItems = scopeItems.filter((item) => item.bucket === 'agora');
	if (agoraItems.length === 0) issues.push({ kind: 'no_now_items' });

	const missingEffortIds = agoraItems.filter((item) => item.effort === null).map((item) => item.id);
	if (missingEffortIds.length > 0) issues.push({ kind: 'missing_effort', itemIds: missingEffortIds });

	if (scopeVersion.hypothesis.trim().length === 0) issues.push({ kind: 'missing_hypothesis' });
	return issues;
}

export function addScopeItem(
	catalog: Catalog,
	state: ProjectState,
	itemId: string,
	text: string,
	bucket: ScopeBucket,
	occurredAt: string,
	sourceSuggestionId: string | null = null
): Result<ProjectState, DomainTransitionError> {
	const order = bucket === 'agora' ? agoraItemsSorted(state.scopeItems).length : null;
	const item: ScopeItem = {
		id: itemId,
		projectId: state.project.id,
		text,
		bucket,
		effort: null,
		order,
		sourceSuggestionId,
		executionStatus: 'a_fazer',
		createdAt: occurredAt,
		updatedAt: occurredAt
	};

	let next: ProjectState = { ...state, scopeItems: [...state.scopeItems, item] };
	next = invalidateScopeConfirmation(catalog, next);
	return { ok: true, value: next };
}

export function setScopeItemText(
	catalog: Catalog,
	state: ProjectState,
	itemId: string,
	text: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const item = findScopeItem(state, itemId);
	if (!item) return { ok: false, error: { kind: 'scope_item_not_found' } };
	if (item.text === text) return { ok: true, value: state };

	let next: ProjectState = {
		...state,
		scopeItems: state.scopeItems.map((i) => (i.id === itemId ? { ...i, text, updatedAt: occurredAt } : i))
	};
	next = invalidateScopeConfirmation(catalog, next);
	return { ok: true, value: next };
}

export function moveScopeItem(
	catalog: Catalog,
	state: ProjectState,
	itemId: string,
	bucket: ScopeBucket,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const item = findScopeItem(state, itemId);
	if (!item) return { ok: false, error: { kind: 'scope_item_not_found' } };
	if (item.bucket === bucket) return { ok: true, value: state };

	const leavingAgora = item.bucket === 'agora';
	const enteringAgora = bucket === 'agora';
	const oldOrder = item.order;
	const appendOrder = enteringAgora ? agoraItemsSorted(state.scopeItems).length : null;

	const items = state.scopeItems.map((i) => {
		if (i.id === itemId) {
			return { ...i, bucket, order: appendOrder, updatedAt: occurredAt };
		}
		if (leavingAgora && i.bucket === 'agora' && i.order !== null && oldOrder !== null && i.order > oldOrder) {
			return { ...i, order: i.order - 1 };
		}
		return i;
	});

	let next: ProjectState = { ...state, scopeItems: items };
	next = invalidateScopeConfirmation(catalog, next);
	return { ok: true, value: next };
}

export function setScopeItemEffort(
	catalog: Catalog,
	state: ProjectState,
	itemId: string,
	effort: ScopeEffort,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const item = findScopeItem(state, itemId);
	if (!item) return { ok: false, error: { kind: 'scope_item_not_found' } };
	if (item.effort === effort) return { ok: true, value: state };

	let next: ProjectState = {
		...state,
		scopeItems: state.scopeItems.map((i) => (i.id === itemId ? { ...i, effort, updatedAt: occurredAt } : i))
	};
	next = invalidateScopeConfirmation(catalog, next);
	return { ok: true, value: next };
}

// Acompanhamento de execução (D025) — catalog recebido só por consistência
// de assinatura com as demais transições de ScopeItem (mesmo padrão do
// bloco Impediment); esta função não o consulta. Deliberadamente não chama
// invalidateScopeConfirmation: status operacional não é mutação de
// planejamento e não deve reabrir a confirmação do escopo.
export function setScopeItemExecutionStatus(
	catalog: Catalog,
	state: ProjectState,
	itemId: string,
	status: ScopeExecutionStatus,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const item = findScopeItem(state, itemId);
	if (!item) return { ok: false, error: { kind: 'scope_item_not_found' } };
	if (item.bucket !== 'agora') return { ok: false, error: { kind: 'scope_item_not_agora' } };
	if (state.scopeVersion.confirmedAt === null) return { ok: false, error: { kind: 'scope_version_not_confirmed' } };

	const currentStatus = item.executionStatus ?? 'a_fazer';
	if (currentStatus === status) return { ok: true, value: state };

	const scopeItems = state.scopeItems.map((i) =>
		i.id === itemId ? { ...i, executionStatus: status, updatedAt: occurredAt } : i
	);
	return { ok: true, value: { ...state, scopeItems } };
}

/** orderedItemIds deve conter exatamente os ids atualmente em `agora`, na nova ordem desejada. */
export function reorderAgoraItems(
	catalog: Catalog,
	state: ProjectState,
	orderedItemIds: string[],
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const currentAgoraIds = agoraItemsSorted(state.scopeItems).map((item) => item.id);
	const sameSet =
		orderedItemIds.length === currentAgoraIds.length &&
		new Set(orderedItemIds).size === orderedItemIds.length &&
		currentAgoraIds.every((id) => orderedItemIds.includes(id));
	if (!sameSet) return { ok: false, error: { kind: 'scope_reorder_mismatch' } };

	const orderById = new Map(orderedItemIds.map((id, index) => [id, index]));
	let changed = false;
	const items = state.scopeItems.map((item) => {
		if (item.bucket !== 'agora') return item;
		const newOrder = orderById.get(item.id)!;
		if (item.order === newOrder) return item;
		changed = true;
		return { ...item, order: newOrder, updatedAt: occurredAt };
	});

	if (!changed) return { ok: true, value: state };

	let next: ProjectState = { ...state, scopeItems: items };
	next = invalidateScopeConfirmation(catalog, next);
	return { ok: true, value: next };
}

export function removeScopeItem(
	catalog: Catalog,
	state: ProjectState,
	itemId: string
): Result<ProjectState, DomainTransitionError> {
	const item = findScopeItem(state, itemId);
	if (!item) return { ok: false, error: { kind: 'scope_item_not_found' } };

	let items = state.scopeItems.filter((i) => i.id !== itemId);
	if (item.bucket === 'agora' && item.order !== null) {
		const removedOrder = item.order;
		items = items.map((i) =>
			i.bucket === 'agora' && i.order !== null && i.order > removedOrder ? { ...i, order: i.order - 1 } : i
		);
	}

	let next: ProjectState = { ...state, scopeItems: items };
	next = invalidateScopeConfirmation(catalog, next);
	return { ok: true, value: next };
}

export function setHypothesis(
	catalog: Catalog,
	state: ProjectState,
	hypothesis: string
): Result<ProjectState, DomainTransitionError> {
	if (state.scopeVersion.hypothesis === hypothesis) return { ok: true, value: state };

	let next: ProjectState = { ...state, scopeVersion: { ...state.scopeVersion, hypothesis } };
	next = invalidateScopeConfirmation(catalog, next);
	return { ok: true, value: next };
}

export function confirmScopeVersion(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findScopeConfirmationActivity(catalog);
	if (!activity) return { ok: false, error: { kind: 'activity_not_found' } };

	const progress = findActivityProgress(state, activity.id);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus === 'concluída') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	const issues = getScopeConfirmationIssues(state.scopeItems, state.scopeVersion);
	if (issues.length > 0) {
		return { ok: false, error: { kind: 'scope_confirmation_invalid', issues } };
	}

	let next: ProjectState = { ...state, scopeVersion: { ...state.scopeVersion, confirmedAt: occurredAt } };
	next = setActivityStatus(next, activity.id, 'concluída');
	return { ok: true, value: next };
}

// --- Impediment (Acompanhamento, vertical 2) ------------------------------
// Coleção independente do catálogo — `catalog` é recebido por consistência
// de assinatura com as demais transições (ScopeItem inclusive), mas nenhuma
// destas funções o consulta: Impediment não referencia ActivityDefinition
// nenhuma. Sem cálculo de "há quanto tempo está aberto" nem alerta
// derivado nesta rodada — só os timestamps são gravados.

export function addImpediment(
	catalog: Catalog,
	state: ProjectState,
	impedimentId: string,
	text: string,
	tipo: ImpedimentType,
	occurredAt: string,
	workItemId: string | null = null
): Result<ProjectState, DomainTransitionError> {
	if (findImpediment(state, impedimentId)) {
		return { ok: false, error: { kind: 'impediment_id_already_exists' } };
	}
	if (workItemId !== null && !findWorkItem(state, workItemId)) {
		return { ok: false, error: { kind: 'work_item_not_found' } };
	}

	const impediment: Impediment = {
		id: impedimentId,
		projectId: state.project.id,
		text,
		tipo,
		nextAction: null,
		status: 'aberto',
		workItemId,
		createdAt: occurredAt,
		updatedAt: occurredAt,
		resolvedAt: null
	};

	return { ok: true, value: { ...state, impediments: [...state.impediments, impediment] } };
}

export function setImpedimentType(
	catalog: Catalog,
	state: ProjectState,
	impedimentId: string,
	tipo: ImpedimentType,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const impediment = findImpediment(state, impedimentId);
	if (!impediment) return { ok: false, error: { kind: 'impediment_not_found' } };
	if (impediment.tipo === tipo) return { ok: true, value: state };

	return {
		ok: true,
		value: {
			...state,
			impediments: state.impediments.map((item) =>
				item.id === impedimentId ? { ...item, tipo, updatedAt: occurredAt } : item
			)
		}
	};
}

export function setImpedimentNextAction(
	catalog: Catalog,
	state: ProjectState,
	impedimentId: string,
	nextAction: string | null,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const impediment = findImpediment(state, impedimentId);
	if (!impediment) return { ok: false, error: { kind: 'impediment_not_found' } };
	if (impediment.nextAction === nextAction) return { ok: true, value: state };

	return {
		ok: true,
		value: {
			...state,
			impediments: state.impediments.map((item) =>
				item.id === impedimentId ? { ...item, nextAction, updatedAt: occurredAt } : item
			)
		}
	};
}

// Idempotente: resolver um impedimento já resolvido é no-op (mesmo espírito
// dos setters de ScopeItem que não fazem nada quando o valor já é o
// desejado) — não é uma transição de ActivityProgress gated por catálogo
// como skipActivity/confirmScopeVersion, então não há "transition_not_allowed"
// aqui.
export function resolveImpediment(
	catalog: Catalog,
	state: ProjectState,
	impedimentId: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const impediment = findImpediment(state, impedimentId);
	if (!impediment) return { ok: false, error: { kind: 'impediment_not_found' } };
	if (impediment.status === 'resolvido') return { ok: true, value: state };

	return {
		ok: true,
		value: {
			...state,
			impediments: state.impediments.map((item) =>
				item.id === impedimentId
					? { ...item, status: 'resolvido', resolvedAt: occurredAt, updatedAt: occurredAt }
					: item
			)
		}
	};
}

export function reopenImpediment(
	catalog: Catalog,
	state: ProjectState,
	impedimentId: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const impediment = findImpediment(state, impedimentId);
	if (!impediment) return { ok: false, error: { kind: 'impediment_not_found' } };
	if (impediment.status === 'aberto') return { ok: true, value: state };

	return {
		ok: true,
		value: {
			...state,
			impediments: state.impediments.map((item) =>
				item.id === impedimentId ? { ...item, status: 'aberto', resolvedAt: null, updatedAt: occurredAt } : item
			)
		}
	};
}

// --- WorkItem / Trabalho (ETAPA 6 do rework, "Primeiro loop operacional") --
// Mesmo espírito de Impediment: coleção independente do catálogo, sem
// activityDefinitionId, `catalog` recebido só por consistência de assinatura.

export function addWorkItem(
	catalog: Catalog,
	state: ProjectState,
	workItemId: string,
	title: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const item: WorkItem = {
		id: workItemId,
		projectId: state.project.id,
		title,
		status: 'a_fazer',
		createdAt: occurredAt,
		updatedAt: occurredAt
	};

	return { ok: true, value: { ...state, workItems: [...state.workItems, item] } };
}

// Recusa a transição para 'concluido' enquanto existir um Impediment aberto
// vinculado a este WorkItem (invariante congelada da ETAPA 6) — o impedimento
// precisa ser resolvido primeiro (ver resolveImpediment). Idempotente (mesmo
// espírito de resolveImpediment/reopenImpediment): mover para o status atual
// é no-op, nunca erro.
export function moveWorkItem(
	catalog: Catalog,
	state: ProjectState,
	workItemId: string,
	status: WorkItemStatus,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const item = findWorkItem(state, workItemId);
	if (!item) return { ok: false, error: { kind: 'work_item_not_found' } };
	if (item.status === status) return { ok: true, value: state };
	if (status === 'concluido' && hasOpenImpediment(state, workItemId)) {
		return { ok: false, error: { kind: 'work_item_blocked' } };
	}

	return {
		ok: true,
		value: {
			...state,
			workItems: state.workItems.map((i) => (i.id === workItemId ? { ...i, status, updatedAt: occurredAt } : i))
		}
	};
}

// --- Dependency (ETAPA 8 do rework, primeiro microcorte) ---
//
// Precedência planejada entre dois WorkItem, nunca bloqueio operacional (ver
// Dependency em state-types.ts): nada aqui altera moveWorkItem, e o único
// motivo de recusa de conclusão continua sendo Impediment aberto (D036).
// Dependency é imutável — só existe adicionar e remover.

/**
 * Existe caminho de precedência de `fromWorkItemId` até `targetWorkItemId`
 * seguindo as arestas `workItemId → dependsOnWorkItemId` já existentes?
 *
 * Busca em profundidade iterativa sobre a coleção atual, com conjunto de
 * visitados — termina mesmo se o estado persistido já contiver um ciclo
 * (defesa contra dado antigo/importado, nunca só contra a UI). Não é um
 * motor de grafo genérico nem scheduling: é a checagem mínima da própria
 * invariante de precedência, usada só por addDependency.
 */
function dependencyPathExists(state: ProjectState, fromWorkItemId: string, targetWorkItemId: string): boolean {
	const visited = new Set<string>();
	const queue: string[] = [fromWorkItemId];

	while (queue.length > 0) {
		const current = queue.pop() as string;
		if (current === targetWorkItemId) return true;
		if (visited.has(current)) continue;
		visited.add(current);

		for (const dependency of state.dependencies) {
			if (dependency.workItemId === current) queue.push(dependency.dependsOnWorkItemId);
		}
	}

	return false;
}

/**
 * Registra "workItemId depende da conclusão de dependsOnWorkItemId".
 *
 * Invariantes da relação, recusadas no domínio (nunca só na interface):
 * auto-dependência, par duplicado, WorkItem inexistente e ciclo — direto
 * (A ↔ B) ou transitivo (A → B → C → A). Ciclo é invariante da própria
 * precedência: "A depois de B" e "B depois de A" não descrevem nenhuma
 * ordem possível, independentemente de existir scheduling no produto.
 */
export function addDependency(
	catalog: Catalog,
	state: ProjectState,
	dependencyId: string,
	workItemId: string,
	dependsOnWorkItemId: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	if (workItemId === dependsOnWorkItemId) {
		return { ok: false, error: { kind: 'dependency_self_reference' } };
	}
	if (!findWorkItem(state, workItemId) || !findWorkItem(state, dependsOnWorkItemId)) {
		return { ok: false, error: { kind: 'work_item_not_found' } };
	}
	const duplicate = state.dependencies.some(
		(dependency) =>
			dependency.workItemId === workItemId && dependency.dependsOnWorkItemId === dependsOnWorkItemId
	);
	if (duplicate) return { ok: false, error: { kind: 'dependency_already_exists' } };

	// O predecessor já alcança (direta ou transitivamente) quem passaria a
	// depender dele — fechar esta aresta criaria um ciclo.
	if (dependencyPathExists(state, dependsOnWorkItemId, workItemId)) {
		return { ok: false, error: { kind: 'dependency_cycle' } };
	}

	const dependency: Dependency = {
		id: dependencyId,
		projectId: state.project.id,
		workItemId,
		dependsOnWorkItemId,
		createdAt: occurredAt
	};

	return { ok: true, value: { ...state, dependencies: [...state.dependencies, dependency] } };
}

export function removeDependency(
	catalog: Catalog,
	state: ProjectState,
	dependencyId: string
): Result<ProjectState, DomainTransitionError> {
	if (!state.dependencies.some((dependency) => dependency.id === dependencyId)) {
		return { ok: false, error: { kind: 'dependency_not_found' } };
	}

	return {
		ok: true,
		value: { ...state, dependencies: state.dependencies.filter((dependency) => dependency.id !== dependencyId) }
	};
}

// --- AffectedGroup / Mapa de Impacto (ETAPA 2 do rework, "Quem é afetado") ---
//
// Ao contrário de Impediment, esta coleção pertence à atividade `publico` do
// catálogo (completionMode explicit_confirmation) — qualquer mutação que
// torne o mapa novamente incompleto reabre a atividade se ela já estava
// concluída (mesmo espírito de invalidateScopeConfirmation), e também
// invalida o Resumo da descoberta já confirmado, exatamente como uma edição
// de Answer faria (mesmo `shouldInvalidateSummary`/`invalidateSummary` já
// usados por answerActivity).

export type AffectedGroupConfirmationIssue =
	| { kind: 'no_groups' }
	| { kind: 'missing_impact'; groupIds: string[] }
	| { kind: 'missing_frequency'; groupIds: string[] };

const AFFECTED_GROUPS_ACTIVITY_ID = 'publico';

/**
 * Retorna a lista de motivos pelos quais o Mapa de Impacto ainda não pode ser
 * concluído (array vazio = pode confirmar). Função pura, sem dependência do
 * catálogo — mesmo papel de getScopeConfirmationIssues: usada pelo domínio
 * (confirmAffectedGroups), pela interface (desabilitar "Concluir mapa") e
 * pelos testes, nenhum dos três deve duplicar esta lógica. impact/frequency
 * `null` (não classificado) é o único caso que bloqueia — 'desconhecido' é
 * uma resposta válida (ver AffectedGroup em state-types.ts).
 */
export function getAffectedGroupConfirmationIssues(groups: AffectedGroup[]): AffectedGroupConfirmationIssue[] {
	const issues: AffectedGroupConfirmationIssue[] = [];
	if (groups.length === 0) issues.push({ kind: 'no_groups' });

	const missingImpactIds = groups.filter((group) => group.impact === null).map((group) => group.id);
	if (missingImpactIds.length > 0) issues.push({ kind: 'missing_impact', groupIds: missingImpactIds });

	const missingFrequencyIds = groups.filter((group) => group.frequency === null).map((group) => group.id);
	if (missingFrequencyIds.length > 0) issues.push({ kind: 'missing_frequency', groupIds: missingFrequencyIds });

	return issues;
}

function findAffectedGroup(state: ProjectState, groupId: string): AffectedGroup | undefined {
	return state.affectedGroups.find((group) => group.id === groupId);
}

function invalidateAffectedGroupsConfirmation(catalog: Catalog, state: ProjectState): ProjectState {
	const activity = findActivityDefinition(catalog, AFFECTED_GROUPS_ACTIVITY_ID);
	if (!activity) return state;
	const progress = findActivityProgress(state, activity.id);
	if (progress?.status !== 'concluída') return state;
	if (getAffectedGroupConfirmationIssues(state.affectedGroups).length === 0) return state;
	return setActivityStatus(state, activity.id, 'em_andamento');
}

function afterAffectedGroupsMutation(catalog: Catalog, state: ProjectState): ProjectState {
	let next = invalidateAffectedGroupsConfirmation(catalog, state);
	if (shouldInvalidateSummary(catalog, next, { kind: 'answer', activityDefinitionId: AFFECTED_GROUPS_ACTIVITY_ID })) {
		next = invalidateSummary(catalog, next);
	}
	return next;
}

export function addAffectedGroup(
	catalog: Catalog,
	state: ProjectState,
	groupId: string,
	label: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const group: AffectedGroup = {
		id: groupId,
		projectId: state.project.id,
		label,
		impact: null,
		frequency: null,
		createdAt: occurredAt,
		updatedAt: occurredAt
	};

	const next = afterAffectedGroupsMutation(catalog, {
		...state,
		affectedGroups: [...state.affectedGroups, group]
	});
	return { ok: true, value: next };
}

export function setAffectedGroupImpact(
	catalog: Catalog,
	state: ProjectState,
	groupId: string,
	impact: AffectedGroupImpact,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const group = findAffectedGroup(state, groupId);
	if (!group) return { ok: false, error: { kind: 'affected_group_not_found' } };
	if (group.impact === impact) return { ok: true, value: state };

	const next = afterAffectedGroupsMutation(catalog, {
		...state,
		affectedGroups: state.affectedGroups.map((g) => (g.id === groupId ? { ...g, impact, updatedAt: occurredAt } : g))
	});
	return { ok: true, value: next };
}

export function setAffectedGroupFrequency(
	catalog: Catalog,
	state: ProjectState,
	groupId: string,
	frequency: AffectedGroupFrequency,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const group = findAffectedGroup(state, groupId);
	if (!group) return { ok: false, error: { kind: 'affected_group_not_found' } };
	if (group.frequency === frequency) return { ok: true, value: state };

	const next = afterAffectedGroupsMutation(catalog, {
		...state,
		affectedGroups: state.affectedGroups.map((g) =>
			g.id === groupId ? { ...g, frequency, updatedAt: occurredAt } : g
		)
	});
	return { ok: true, value: next };
}

// ExternalAction/Evidence passam a poder referenciar AffectedGroup (ETAPA 3
// do rework, §17) — perda silenciosa dessas relações não é permitida. Regra
// mínima segura: um grupo referenciado por qualquer ExternalAction ou
// Evidence não pode ser removido (sem cascade, sem apagar conhecimento real
// do projeto). Checagem por igualdade de id, não por índice — nenhuma das
// duas coleções guarda uma contagem própria de referências.
function isAffectedGroupReferenced(state: ProjectState, groupId: string): boolean {
	return (
		state.externalActions.some((action) => action.affectedGroupId === groupId) ||
		state.evidences.some((evidence) => evidence.affectedGroupId === groupId)
	);
}

export function removeAffectedGroup(
	catalog: Catalog,
	state: ProjectState,
	groupId: string
): Result<ProjectState, DomainTransitionError> {
	const group = findAffectedGroup(state, groupId);
	if (!group) return { ok: false, error: { kind: 'affected_group_not_found' } };
	if (isAffectedGroupReferenced(state, groupId)) {
		return { ok: false, error: { kind: 'affected_group_has_references' } };
	}

	const next = afterAffectedGroupsMutation(catalog, {
		...state,
		affectedGroups: state.affectedGroups.filter((g) => g.id !== groupId)
	});
	return { ok: true, value: next };
}

export function confirmAffectedGroups(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findActivityDefinition(catalog, AFFECTED_GROUPS_ACTIVITY_ID);
	if (!activity || activity.completionMode !== 'explicit_confirmation') {
		return { ok: false, error: { kind: 'activity_not_found' } };
	}

	const progress = findActivityProgress(state, activity.id);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus === 'concluída') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	const issues = getAffectedGroupConfirmationIssues(state.affectedGroups);
	if (issues.length > 0) {
		return { ok: false, error: { kind: 'affected_group_confirmation_invalid', issues } };
	}

	let next = setActivityStatus(state, activity.id, 'concluída');
	if (currentStatus === 'pulada') {
		next = resolvePendingItem(next, activity.id, occurredAt);
	}
	return { ok: true, value: next };
}

// --- ExternalAction / Evidence (ETAPA 3 do rework, "Evidence + primeira
// External Action") ---------------------------------------------------------
//
// Independente do catálogo/jornada guiada: não cria ActivityProgress, não
// gera PendingItem, não altera nenhuma atividade. A preparação
// (objective/questions/informationToTake/expectedResult) chega já pronta —
// domain/ não depende de catalog/ (ver catalog/external-action.ts,
// buildExternalActionPreparation, chamada pela camada de aplicação antes de
// invocar prepareExternalAction).

function findExternalAction(state: ProjectState, actionId: string): ExternalAction | undefined {
	return state.externalActions.find((action) => action.id === actionId);
}

export interface ExternalActionPreparationValues {
	objective: string;
	questions: string[];
	informationToTake: string[];
	expectedResult: string;
}

/**
 * Cria a ExternalAction só quando o usuário confirma "Pronto para
 * conversar" — abrir a preparação sozinho não persiste nada (ver
 * HYDRA_PRODUCT_REWORK.md §33, "quando a ExternalAction nasce"). Bloqueia
 * duplicata: no máximo uma ExternalAction aberta de `validate_affected_group`
 * por AffectedGroup — uma ação já concluída não impede uma nova validação
 * futura do mesmo grupo (ver getAffectedGroupConfirmationIssues para o
 * paralelo de "issues" que aqui não se aplica: não há confirmação de mapa
 * envolvida).
 */
export function prepareExternalAction(
	catalog: Catalog,
	state: ProjectState,
	actionId: string,
	affectedGroupId: string,
	preparation: ExternalActionPreparationValues,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	if (!findAffectedGroup(state, affectedGroupId)) {
		return { ok: false, error: { kind: 'affected_group_not_found' } };
	}

	const hasOpenAction = state.externalActions.some(
		(action) =>
			action.affectedGroupId === affectedGroupId &&
			action.kind === 'validate_affected_group' &&
			action.status === 'aberta'
	);
	if (hasOpenAction) return { ok: false, error: { kind: 'external_action_duplicate_open' } };

	const action: ExternalAction = {
		id: actionId,
		projectId: state.project.id,
		kind: 'validate_affected_group',
		affectedGroupId,
		status: 'aberta',
		objective: preparation.objective,
		questions: preparation.questions,
		informationToTake: preparation.informationToTake,
		expectedResult: preparation.expectedResult,
		createdAt: occurredAt,
		updatedAt: occurredAt,
		completedAt: null
	};

	return { ok: true, value: { ...state, externalActions: [...state.externalActions, action] } };
}

/**
 * Transição atômica única: valida outcome + `learning.trim()` não vazio,
 * confirma que a ação pertence ao projeto e está aberta, cria a Evidence e
 * conclui a ExternalAction — nunca uma ação concluída sem Evidence, nunca
 * duas Evidence pela mesma chamada (ver HYDRA_PRODUCT_REWORK.md §33 e §15).
 * `learning` chega já validado como não-vazio pela camada de aplicação
 * (mesmo padrão de outros textos livres do domínio), mas a checagem também
 * existe aqui — não confiar só no botão desabilitado da UI.
 */
export function completeExternalAction(
	catalog: Catalog,
	state: ProjectState,
	actionId: string,
	evidenceId: string,
	outcome: EvidenceOutcome,
	learning: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const action = findExternalAction(state, actionId);
	if (!action) return { ok: false, error: { kind: 'external_action_not_found' } };
	if (action.status !== 'aberta') return { ok: false, error: { kind: 'external_action_not_open' } };
	if (learning.trim().length === 0) return { ok: false, error: { kind: 'evidence_learning_required' } };

	const evidence: Evidence = {
		id: evidenceId,
		projectId: state.project.id,
		externalActionId: action.id,
		affectedGroupId: action.affectedGroupId,
		kind: 'conversation',
		outcome,
		learning: learning.trim(),
		createdAt: occurredAt
	};

	return {
		ok: true,
		value: {
			...state,
			evidences: [...state.evidences, evidence],
			externalActions: state.externalActions.map((item) =>
				item.id === actionId
					? { ...item, status: 'concluida', updatedAt: occurredAt, completedAt: occurredAt }
					: item
			)
		}
	};
}

// --- CurrentTreatment / TreatmentStep — "Como é tratado hoje" (Stage 4A do
// rework, ver docs/core/HYDRA_PRODUCT_REWORK.md §34) ------------------------
//
// Mesmo espírito de AffectedGroup: ligada à atividade `estado_atual` do
// catálogo (completionMode explicit_confirmation) — qualquer mutação que
// torne o tratamento novamente incompleto reabre a atividade se ela já
// estava concluída, e invalida o Resumo da descoberta já confirmado (mesmo
// afterAffectedGroupsMutation acima).

export type TreatmentConfirmationIssue = { kind: 'no_steps' };

const CURRENT_TREATMENT_ACTIVITY_ID = 'estado_atual';

/**
 * Retorna os motivos pelos quais "Como é tratado hoje" ainda não pode ser
 * concluída (array vazio = pode concluir). `noTreatment: true` sempre
 * satisfaz (é um estado terminal legítimo, não uma ausência de resposta);
 * caso contrário exige pelo menos um passo — um passo vazio nunca existe no
 * estado persistido (whatHappens é validado não-vazio em addTreatmentStep),
 * então "passo vazio não conta" já é garantido estruturalmente, sem checagem
 * extra aqui.
 */
export function getTreatmentConfirmationIssues(
	noTreatment: boolean,
	steps: readonly TreatmentStep[]
): TreatmentConfirmationIssue[] {
	if (noTreatment) return [];
	return steps.length === 0 ? [{ kind: 'no_steps' }] : [];
}

function findTreatmentStep(state: ProjectState, stepId: string): TreatmentStep | undefined {
	return state.treatmentSteps.find((step) => step.id === stepId);
}

function invalidateTreatmentConfirmation(catalog: Catalog, state: ProjectState): ProjectState {
	const activity = findActivityDefinition(catalog, CURRENT_TREATMENT_ACTIVITY_ID);
	if (!activity) return state;
	const progress = findActivityProgress(state, activity.id);
	if (progress?.status !== 'concluída') return state;
	if (getTreatmentConfirmationIssues(state.currentTreatment.noTreatment, state.treatmentSteps).length === 0) {
		return state;
	}
	return setActivityStatus(state, activity.id, 'em_andamento');
}

function afterTreatmentMutation(catalog: Catalog, state: ProjectState): ProjectState {
	let next = invalidateTreatmentConfirmation(catalog, state);
	if (shouldInvalidateSummary(catalog, next, { kind: 'answer', activityDefinitionId: CURRENT_TREATMENT_ACTIVITY_ID })) {
		next = invalidateSummary(catalog, next);
	}
	return next;
}

/**
 * Adiciona um passo ao final da cadeia (order = length atual) e desliga
 * `noTreatment` na mesma transição — invariante canônica garantida aqui, sem
 * depender da UI enviar um toggle separado (ver CurrentTreatment em
 * state-types.ts). `whatHappens` vazio é rejeitado (único dado obrigatório
 * do passo).
 */
export function addTreatmentStep(
	catalog: Catalog,
	state: ProjectState,
	stepId: string,
	whatHappens: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const trimmed = whatHappens.trim();
	if (trimmed.length === 0) return { ok: false, error: { kind: 'invalid_field_value', fieldDefinitionId: 'whatHappens' } };

	const step: TreatmentStep = {
		id: stepId,
		projectId: state.project.id,
		order: state.treatmentSteps.length,
		whatHappens: trimmed,
		actors: [],
		medium: null,
		frictions: [],
		createdAt: occurredAt,
		updatedAt: occurredAt
	};

	const next = afterTreatmentMutation(catalog, {
		...state,
		currentTreatment: { ...state.currentTreatment, noTreatment: false, updatedAt: occurredAt },
		treatmentSteps: [...state.treatmentSteps, step]
	});
	return { ok: true, value: next };
}

export function removeTreatmentStep(
	catalog: Catalog,
	state: ProjectState,
	stepId: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const step = findTreatmentStep(state, stepId);
	if (!step) return { ok: false, error: { kind: 'treatment_step_not_found' } };

	const remaining = state.treatmentSteps
		.filter((item) => item.id !== stepId)
		.sort((a, b) => a.order - b.order)
		.map((item, index) => (item.order === index ? item : { ...item, order: index, updatedAt: occurredAt }));

	const next = afterTreatmentMutation(catalog, { ...state, treatmentSteps: remaining });
	return { ok: true, value: next };
}

/**
 * Move um passo uma posição para cima (-1) ou para baixo (+1) — troca de
 * `order` com o vizinho adjacente, nunca reescreve a lista inteira. Fora dos
 * limites (primeiro subindo, último descendo) é um no-op silencioso, mesmo
 * espírito de moveScopeItem/moveImpediment não existirem — a interface já
 * desabilita o botão nesses casos (isFirst/isLast).
 */
export function moveTreatmentStep(
	catalog: Catalog,
	state: ProjectState,
	stepId: string,
	direction: -1 | 1,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const step = findTreatmentStep(state, stepId);
	if (!step) return { ok: false, error: { kind: 'treatment_step_not_found' } };

	const targetOrder = step.order + direction;
	const neighbor = state.treatmentSteps.find((item) => item.order === targetOrder);
	if (!neighbor) return { ok: true, value: state };

	const next = afterTreatmentMutation(catalog, {
		...state,
		treatmentSteps: state.treatmentSteps.map((item) => {
			if (item.id === step.id) return { ...item, order: targetOrder, updatedAt: occurredAt };
			if (item.id === neighbor.id) return { ...item, order: step.order, updatedAt: occurredAt };
			return item;
		})
	});
	return { ok: true, value: next };
}

export function setTreatmentStepActors(
	catalog: Catalog,
	state: ProjectState,
	stepId: string,
	actors: string[],
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const step = findTreatmentStep(state, stepId);
	if (!step) return { ok: false, error: { kind: 'treatment_step_not_found' } };

	const cleaned = actors.map((actor) => actor.trim()).filter((actor) => actor.length > 0);
	const next = afterTreatmentMutation(catalog, {
		...state,
		treatmentSteps: state.treatmentSteps.map((item) =>
			item.id === stepId ? { ...item, actors: cleaned, updatedAt: occurredAt } : item
		)
	});
	return { ok: true, value: next };
}

export function setTreatmentStepMedium(
	catalog: Catalog,
	state: ProjectState,
	stepId: string,
	medium: string | null,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const step = findTreatmentStep(state, stepId);
	if (!step) return { ok: false, error: { kind: 'treatment_step_not_found' } };

	const cleaned = medium && medium.trim().length > 0 ? medium.trim() : null;
	const next = afterTreatmentMutation(catalog, {
		...state,
		treatmentSteps: state.treatmentSteps.map((item) =>
			item.id === stepId ? { ...item, medium: cleaned, updatedAt: occurredAt } : item
		)
	});
	return { ok: true, value: next };
}

export function toggleTreatmentStepFriction(
	catalog: Catalog,
	state: ProjectState,
	stepId: string,
	friction: TreatmentFriction,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const step = findTreatmentStep(state, stepId);
	if (!step) return { ok: false, error: { kind: 'treatment_step_not_found' } };

	const next = afterTreatmentMutation(catalog, {
		...state,
		treatmentSteps: state.treatmentSteps.map((item) =>
			item.id === stepId
				? {
						...item,
						frictions: item.frictions.includes(friction)
							? item.frictions.filter((f) => f !== friction)
							: [...item.frictions, friction],
						updatedAt: occurredAt
					}
				: item
		)
	});
	return { ok: true, value: next };
}

/**
 * Liga/desliga "Hoje não existe um tratamento definido". Ligar (`true`)
 * remove todos os passos existentes na mesma transição — a invariante
 * canônica (nunca noTreatment=true com passos ativos) nunca fica pendente de
 * um segundo passo separado; desligar (`false`) só limpa o flag, os passos
 * continuam vazios (o usuário descreve de novo, ver
 * HYDRA_PRODUCT_REWORK.md §34, "voltar e descrever").
 */
export function setTreatmentNoTreatment(
	catalog: Catalog,
	state: ProjectState,
	noTreatment: boolean,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	if (state.currentTreatment.noTreatment === noTreatment) return { ok: true, value: state };

	const next = afterTreatmentMutation(catalog, {
		...state,
		currentTreatment: { ...state.currentTreatment, noTreatment, updatedAt: occurredAt },
		treatmentSteps: noTreatment ? [] : state.treatmentSteps
	});
	return { ok: true, value: next };
}

export function confirmTreatment(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findActivityDefinition(catalog, CURRENT_TREATMENT_ACTIVITY_ID);
	if (!activity || activity.completionMode !== 'explicit_confirmation') {
		return { ok: false, error: { kind: 'activity_not_found' } };
	}

	const progress = findActivityProgress(state, activity.id);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus === 'concluída') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	const issues = getTreatmentConfirmationIssues(state.currentTreatment.noTreatment, state.treatmentSteps);
	if (issues.length > 0) {
		return { ok: false, error: { kind: 'treatment_confirmation_invalid', issues } };
	}

	let next = setActivityStatus(state, activity.id, 'concluída');
	if (currentStatus === 'pulada') {
		next = resolvePendingItem(next, activity.id, occurredAt);
	}
	return { ok: true, value: next };
}

// --- CauseHypothesis / CauseExploration — "Entender as causas" (Stage 4B do
// rework, ver docs/core/HYDRA_PRODUCT_REWORK.md, Design Gate "Entender as
// Causas - 1A Refinada") -----------------------------------------------------
//
// Mesmo espírito de AffectedGroup/CurrentTreatment: ligada à atividade
// `entender_causas` do catálogo (completionMode explicit_confirmation) —
// qualquer mutação invalida o Resumo da descoberta já confirmado (mesmo
// afterAffectedGroupsMutation/afterTreatmentMutation acima). Diferença
// deliberada: a conclusão nunca é bloqueada por estado incompleto (ver
// getCauseHypothesesConfirmationIssues) — "ainda não sabemos" é um resultado
// legítimo, não uma resposta pendente — por isso não existe
// invalidateCauseHypothesesConfirmation/reabertura automática por mutação:
// nenhuma mutação pode tornar a atividade "novamente incompleta", porque ela
// nunca tem critério de completude a violar.

// Sempre vazio — existe só para simetria com getAffectedGroupConfirmationIssues/
// getTreatmentConfirmationIssues (mesma assinatura usada pela interface e por
// ProjectView) e para deixar testável a garantia de que esta atividade nunca
// bloqueia conclusão, mesmo com zero hipóteses e stillUnknown false.
export type CauseHypothesisConfirmationIssue = never;

const CAUSE_HYPOTHESES_ACTIVITY_ID = 'entender_causas';

export function getCauseHypothesesConfirmationIssues(): CauseHypothesisConfirmationIssue[] {
	return [];
}

function findCauseHypothesis(state: ProjectState, hypothesisId: string): CauseHypothesis | undefined {
	return state.causeHypotheses.find((hypothesis) => hypothesis.id === hypothesisId);
}

function afterCauseHypothesisMutation(catalog: Catalog, state: ProjectState): ProjectState {
	if (shouldInvalidateSummary(catalog, state, { kind: 'answer', activityDefinitionId: CAUSE_HYPOTHESES_ACTIVITY_ID })) {
		return invalidateSummary(catalog, state);
	}
	return state;
}

/**
 * Cria uma hipótese — título obrigatório (não vazio), origin é proveniência
 * opcional (rótulo do cartão de contexto usado como ponto de partida, ou
 * "Sugestão do Hydra"), nunca evidência. Desliga `stillUnknown` na mesma
 * transição (mesmo espírito de addTreatmentStep desligando noTreatment) —
 * registrar uma hipótese real é prova de que o estado "ainda não sabemos"
 * não se aplica mais.
 */
export function addCauseHypothesis(
	catalog: Catalog,
	state: ProjectState,
	hypothesisId: string,
	title: string,
	origin: string | null,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const trimmed = title.trim();
	if (trimmed.length === 0) return { ok: false, error: { kind: 'invalid_field_value', fieldDefinitionId: 'title' } };

	const hypothesis: CauseHypothesis = {
		id: hypothesisId,
		projectId: state.project.id,
		title: trimmed,
		origin: origin && origin.trim().length > 0 ? origin.trim() : null,
		expectedIfTrue: null,
		whatWeakensIt: null,
		evidenceIds: [],
		createdAt: occurredAt,
		updatedAt: occurredAt
	};

	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeExploration: { ...state.causeExploration, stillUnknown: false, updatedAt: occurredAt },
		causeHypotheses: [...state.causeHypotheses, hypothesis]
	});
	return { ok: true, value: next };
}

export function setCauseHypothesisTitle(
	catalog: Catalog,
	state: ProjectState,
	hypothesisId: string,
	title: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const hypothesis = findCauseHypothesis(state, hypothesisId);
	if (!hypothesis) return { ok: false, error: { kind: 'cause_hypothesis_not_found' } };
	const trimmed = title.trim();
	if (trimmed.length === 0) return { ok: false, error: { kind: 'invalid_field_value', fieldDefinitionId: 'title' } };

	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeHypotheses: state.causeHypotheses.map((item) =>
			item.id === hypothesisId ? { ...item, title: trimmed, updatedAt: occurredAt } : item
		)
	});
	return { ok: true, value: next };
}

export function setCauseHypothesisExpectedIfTrue(
	catalog: Catalog,
	state: ProjectState,
	hypothesisId: string,
	value: string | null,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const hypothesis = findCauseHypothesis(state, hypothesisId);
	if (!hypothesis) return { ok: false, error: { kind: 'cause_hypothesis_not_found' } };

	const cleaned = value && value.trim().length > 0 ? value.trim() : null;
	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeHypotheses: state.causeHypotheses.map((item) =>
			item.id === hypothesisId ? { ...item, expectedIfTrue: cleaned, updatedAt: occurredAt } : item
		)
	});
	return { ok: true, value: next };
}

export function setCauseHypothesisWhatWeakensIt(
	catalog: Catalog,
	state: ProjectState,
	hypothesisId: string,
	value: string | null,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const hypothesis = findCauseHypothesis(state, hypothesisId);
	if (!hypothesis) return { ok: false, error: { kind: 'cause_hypothesis_not_found' } };

	const cleaned = value && value.trim().length > 0 ? value.trim() : null;
	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeHypotheses: state.causeHypotheses.map((item) =>
			item.id === hypothesisId ? { ...item, whatWeakensIt: cleaned, updatedAt: occurredAt } : item
		)
	});
	return { ok: true, value: next };
}

/**
 * Liga/desliga a relação com uma Evidence já existente (ETAPA 3 do rework) —
 * nunca cria Evidence nova, só referencia por id. evidenceId precisa
 * pertencer a uma Evidence real do projeto.
 */
export function toggleCauseHypothesisEvidence(
	catalog: Catalog,
	state: ProjectState,
	hypothesisId: string,
	evidenceId: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const hypothesis = findCauseHypothesis(state, hypothesisId);
	if (!hypothesis) return { ok: false, error: { kind: 'cause_hypothesis_not_found' } };
	if (!state.evidences.some((evidence) => evidence.id === evidenceId)) {
		return { ok: false, error: { kind: 'evidence_not_found' } };
	}

	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeHypotheses: state.causeHypotheses.map((item) =>
			item.id === hypothesisId
				? {
						...item,
						evidenceIds: item.evidenceIds.includes(evidenceId)
							? item.evidenceIds.filter((id) => id !== evidenceId)
							: [...item.evidenceIds, evidenceId],
						updatedAt: occurredAt
					}
				: item
		)
	});
	return { ok: true, value: next };
}

export function removeCauseHypothesis(
	catalog: Catalog,
	state: ProjectState,
	hypothesisId: string
): Result<ProjectState, DomainTransitionError> {
	const hypothesis = findCauseHypothesis(state, hypothesisId);
	if (!hypothesis) return { ok: false, error: { kind: 'cause_hypothesis_not_found' } };

	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeHypotheses: state.causeHypotheses.filter((item) => item.id !== hypothesisId)
	});
	return { ok: true, value: next };
}

/**
 * Liga "Ainda não sabemos o que está por trás disso" — só permitido com
 * nenhuma hipótese registrada (mesma regra já aplicada pela interface no
 * Design Gate: o link para este estado só aparece com hypotheses.length ===
 * 0). Evita a ambiguidade de o que fazer com hipóteses existentes ao ligar
 * este estado — em vez de escolher uma transição destrutiva sozinha, a
 * transição recusa (ver HYDRA_PRODUCT_REWORK.md, invariante "Ainda não sei").
 */
export function markCauseExplorationUnknown(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	if (state.causeExploration.stillUnknown) return { ok: true, value: state };
	if (state.causeHypotheses.length > 0) {
		return { ok: false, error: { kind: 'cause_exploration_has_hypotheses' } };
	}

	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeExploration: { ...state.causeExploration, stillUnknown: true, updatedAt: occurredAt }
	});
	return { ok: true, value: next };
}

export function undoCauseExplorationUnknown(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	if (!state.causeExploration.stillUnknown) return { ok: true, value: state };

	const next = afterCauseHypothesisMutation(catalog, {
		...state,
		causeExploration: { ...state.causeExploration, stillUnknown: false, updatedAt: occurredAt }
	});
	return { ok: true, value: next };
}

/**
 * Conclui "Entender as causas" — nunca bloqueada por estado incompleto (ver
 * getCauseHypothesesConfirmationIssues, sempre []): zero hipóteses e
 * stillUnknown false é uma saída legítima ("você pode seguir sem uma
 * explicação ainda", Design Gate).
 */
export function confirmCauseHypotheses(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findActivityDefinition(catalog, CAUSE_HYPOTHESES_ACTIVITY_ID);
	if (!activity || activity.completionMode !== 'explicit_confirmation') {
		return { ok: false, error: { kind: 'activity_not_found' } };
	}

	const progress = findActivityProgress(state, activity.id);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus === 'concluída') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	let next = setActivityStatus(state, activity.id, 'concluída');
	if (currentStatus === 'pulada') {
		next = resolvePendingItem(next, activity.id, occurredAt);
	}
	return { ok: true, value: next };
}

// --- DesiredOutcome — "Resultado desejado" (Stage 4C do rework, ver
// docs/core/HYDRA_PRODUCT_REWORK.md §32) -------------------------------------
//
// Mesmo espírito de AffectedGroup: ligada à atividade `resultado` do
// catálogo (completionMode explicit_confirmation) — qualquer mutação que
// torne a coleção novamente incompleta reabre a atividade se ela já estava
// concluída, e invalida o Resumo da descoberta já confirmado (mesmo
// afterAffectedGroupsMutation acima). Ordenação por swap adjacente, mesmo
// padrão de moveTreatmentStep — diferente de AffectedGroup/CauseHypothesis,
// que não têm order.

export type DesiredOutcomeConfirmationIssue = { kind: 'no_outcomes' } | { kind: 'missing_change'; outcomeIds: string[] };

const DESIRED_OUTCOME_ACTIVITY_ID = 'resultado';

/**
 * Retorna os motivos pelos quais "Resultado desejado" ainda não pode ser
 * concluído (array vazio = pode concluir): pelo menos um DesiredOutcome, e
 * cada um com `change` não vazio após trim. `change` vazio nunca existe no
 * estado persistido (validado em addDesiredOutcome/setDesiredOutcomeChange),
 * então `missing_change` é defesa redundante, não um caminho alcançável hoje
 * — mesmo espírito de "passo vazio nunca existe" em
 * getTreatmentConfirmationIssues. `target` nunca entra aqui: é sempre
 * opcional, nenhuma quantidade mínima além de 1 outcome válido.
 */
export function getDesiredOutcomeConfirmationIssues(
	outcomes: readonly DesiredOutcome[]
): DesiredOutcomeConfirmationIssue[] {
	const issues: DesiredOutcomeConfirmationIssue[] = [];
	if (outcomes.length === 0) issues.push({ kind: 'no_outcomes' });

	const missingChangeIds = outcomes.filter((outcome) => outcome.change.trim().length === 0).map((outcome) => outcome.id);
	if (missingChangeIds.length > 0) issues.push({ kind: 'missing_change', outcomeIds: missingChangeIds });

	return issues;
}

function findDesiredOutcome(state: ProjectState, outcomeId: string): DesiredOutcome | undefined {
	return state.desiredOutcomes.find((outcome) => outcome.id === outcomeId);
}

function invalidateDesiredOutcomeConfirmation(catalog: Catalog, state: ProjectState): ProjectState {
	const activity = findActivityDefinition(catalog, DESIRED_OUTCOME_ACTIVITY_ID);
	if (!activity) return state;
	const progress = findActivityProgress(state, activity.id);
	if (progress?.status !== 'concluída') return state;
	if (getDesiredOutcomeConfirmationIssues(state.desiredOutcomes).length === 0) return state;
	return setActivityStatus(state, activity.id, 'em_andamento');
}

function afterDesiredOutcomeMutation(catalog: Catalog, state: ProjectState): ProjectState {
	let next = invalidateDesiredOutcomeConfirmation(catalog, state);
	if (shouldInvalidateSummary(catalog, next, { kind: 'answer', activityDefinitionId: DESIRED_OUTCOME_ACTIVITY_ID })) {
		next = invalidateSummary(catalog, next);
	}
	return next;
}

/** Adiciona um resultado ao final da cadeia (order = length atual) — `change` vazio é rejeitado (único dado obrigatório). */
export function addDesiredOutcome(
	catalog: Catalog,
	state: ProjectState,
	outcomeId: string,
	change: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const trimmed = change.trim();
	if (trimmed.length === 0) return { ok: false, error: { kind: 'invalid_field_value', fieldDefinitionId: 'change' } };

	const outcome: DesiredOutcome = {
		id: outcomeId,
		projectId: state.project.id,
		change: trimmed,
		target: null,
		order: state.desiredOutcomes.length,
		createdAt: occurredAt,
		updatedAt: occurredAt
	};

	const next = afterDesiredOutcomeMutation(catalog, {
		...state,
		desiredOutcomes: [...state.desiredOutcomes, outcome]
	});
	return { ok: true, value: next };
}

export function setDesiredOutcomeChange(
	catalog: Catalog,
	state: ProjectState,
	outcomeId: string,
	change: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const outcome = findDesiredOutcome(state, outcomeId);
	if (!outcome) return { ok: false, error: { kind: 'desired_outcome_not_found' } };
	const trimmed = change.trim();
	if (trimmed.length === 0) return { ok: false, error: { kind: 'invalid_field_value', fieldDefinitionId: 'change' } };

	const next = afterDesiredOutcomeMutation(catalog, {
		...state,
		desiredOutcomes: state.desiredOutcomes.map((item) =>
			item.id === outcomeId ? { ...item, change: trimmed, updatedAt: occurredAt } : item
		)
	});
	return { ok: true, value: next };
}

/** `target` é sempre texto opcional — nunca number+unit (ver state-types.ts, DesiredOutcome). */
export function setDesiredOutcomeTarget(
	catalog: Catalog,
	state: ProjectState,
	outcomeId: string,
	target: string | null,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const outcome = findDesiredOutcome(state, outcomeId);
	if (!outcome) return { ok: false, error: { kind: 'desired_outcome_not_found' } };

	const cleaned = target && target.trim().length > 0 ? target.trim() : null;
	const next = afterDesiredOutcomeMutation(catalog, {
		...state,
		desiredOutcomes: state.desiredOutcomes.map((item) =>
			item.id === outcomeId ? { ...item, target: cleaned, updatedAt: occurredAt } : item
		)
	});
	return { ok: true, value: next };
}

export function removeDesiredOutcome(
	catalog: Catalog,
	state: ProjectState,
	outcomeId: string,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const outcome = findDesiredOutcome(state, outcomeId);
	if (!outcome) return { ok: false, error: { kind: 'desired_outcome_not_found' } };

	const remaining = state.desiredOutcomes
		.filter((item) => item.id !== outcomeId)
		.sort((a, b) => a.order - b.order)
		.map((item, index) => (item.order === index ? item : { ...item, order: index, updatedAt: occurredAt }));

	const next = afterDesiredOutcomeMutation(catalog, { ...state, desiredOutcomes: remaining });
	return { ok: true, value: next };
}

/**
 * Move um resultado uma posição para cima (-1) ou para baixo (+1) — troca de
 * `order` com o vizinho adjacente, nunca reescreve a lista inteira (mesmo
 * espírito de moveTreatmentStep). Fora dos limites é um no-op silencioso — a
 * interface já desabilita o botão nesses casos.
 */
export function moveDesiredOutcome(
	catalog: Catalog,
	state: ProjectState,
	outcomeId: string,
	direction: -1 | 1,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const outcome = findDesiredOutcome(state, outcomeId);
	if (!outcome) return { ok: false, error: { kind: 'desired_outcome_not_found' } };

	const targetOrder = outcome.order + direction;
	const neighbor = state.desiredOutcomes.find((item) => item.order === targetOrder);
	if (!neighbor) return { ok: true, value: state };

	const next = afterDesiredOutcomeMutation(catalog, {
		...state,
		desiredOutcomes: state.desiredOutcomes.map((item) => {
			if (item.id === outcome.id) return { ...item, order: targetOrder, updatedAt: occurredAt };
			if (item.id === neighbor.id) return { ...item, order: outcome.order, updatedAt: occurredAt };
			return item;
		})
	});
	return { ok: true, value: next };
}

export function confirmDesiredOutcomes(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	const activity = findActivityDefinition(catalog, DESIRED_OUTCOME_ACTIVITY_ID);
	if (!activity || activity.completionMode !== 'explicit_confirmation') {
		return { ok: false, error: { kind: 'activity_not_found' } };
	}

	const progress = findActivityProgress(state, activity.id);
	const currentStatus = progress?.status ?? 'não_iniciada';
	if (currentStatus === 'concluída') {
		return { ok: false, error: { kind: 'transition_not_allowed', from: currentStatus } };
	}

	const issues = getDesiredOutcomeConfirmationIssues(state.desiredOutcomes);
	if (issues.length > 0) {
		return { ok: false, error: { kind: 'desired_outcome_confirmation_invalid', issues } };
	}

	let next = setActivityStatus(state, activity.id, 'concluída');
	if (currentStatus === 'pulada') {
		next = resolvePendingItem(next, activity.id, occurredAt);
	}
	return { ok: true, value: next };
}
