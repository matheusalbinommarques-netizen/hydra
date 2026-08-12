// Operações puras de transição — ver docs/06-architecture/contracts.md §5
// e docs/core/STATE_MACHINE.md.

import type { ActivityDefinition, Catalog, RequiredFieldsActivity } from './catalog-types';
import type {
	ActivityProgress,
	ActivityStatus,
	AffectedGroup,
	AffectedGroupFrequency,
	AffectedGroupImpact,
	Impediment,
	ImpedimentType,
	PendingItem,
	ProjectState,
	ScopeBucket,
	ScopeEffort,
	ScopeExecutionStatus,
	ScopeItem,
	ScopeVersion
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
	| { kind: 'phase_not_found' }
	| { kind: 'planning_no_items' }
	| { kind: 'affected_group_not_found' }
	| { kind: 'affected_group_confirmation_invalid'; issues: AffectedGroupConfirmationIssue[] };

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
	occurredAt: string
): Result<ProjectState, DomainTransitionError> {
	if (findImpediment(state, impedimentId)) {
		return { ok: false, error: { kind: 'impediment_id_already_exists' } };
	}

	const impediment: Impediment = {
		id: impedimentId,
		projectId: state.project.id,
		text,
		tipo,
		nextAction: null,
		status: 'aberto',
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

export function removeAffectedGroup(
	catalog: Catalog,
	state: ProjectState,
	groupId: string
): Result<ProjectState, DomainTransitionError> {
	const group = findAffectedGroup(state, groupId);
	if (!group) return { ok: false, error: { kind: 'affected_group_not_found' } };

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
