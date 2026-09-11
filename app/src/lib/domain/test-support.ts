// Helpers e fixtures de teste sobre domain/orientation-engine — não é código
// de produção, não é exportado por domain/index.ts, só consumido por specs
// (`.spec.ts`) via import direto deste caminho.
//
// Objetivo: evitar que cada atividade nova do catálogo exija editar de novo
// os mesmos blocos de "responder as N atividades anteriores campo a campo"
// espalhados pelos testes de orientation-engine.

import {
	addAffectedGroup,
	addDeliverable,
	addDesiredOutcome,
	addScopeItem,
	addTreatmentStep,
	addWorkItem,
	answerActivity,
	confirmAffectedGroups,
	confirmCauseHypotheses,
	confirmDecisionsAndChangesReview,
	confirmDecomposition,
	confirmDependencyMapping,
	confirmMilestoneReview,
	confirmRiskIdentification,
	confirmRiskUpdate,
	confirmDesiredOutcomes,
	confirmPlanningPriority,
	confirmScopeVersion,
	confirmSummary,
	confirmTreatment,
	setAffectedGroupFrequency,
	setAffectedGroupImpact,
	setHypothesis,
	setScopeItemEffort,
	skipActivity
} from './transitions';
import { encodeMultiSelectValue } from './multi-select';
import { encodePlanningItems } from './planning-items';
import type { ActivityDefinition, Catalog, PhaseDefinition } from './catalog-types';
import type { ProjectState } from './state-types';
import type { Result } from './result';

export function unwrapResult<T>(result: Result<T, unknown>): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

function findActivity(catalog: Catalog, activityId: string): ActivityDefinition {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	throw new Error(`atividade de teste não encontrada no catálogo: "${activityId}"`);
}

/**
 * Responde uma atividade `required_fields` preenchendo todos os campos
 * obrigatórios com um valor trivial não vazio — para quando o teste só
 * precisa que a atividade fique `concluída`, sem se importar com o
 * conteúdo específico de cada campo.
 */
export function answerActivityMinimally(
	catalog: Catalog,
	state: ProjectState,
	activityId: string,
	occurredAt: string
): ProjectState {
	const activity = findActivity(catalog, activityId);
	if (activity.completionMode !== 'required_fields') {
		throw new Error(`answerActivityMinimally só se aplica a required_fields (atividade "${activityId}")`);
	}
	const values: Record<string, string> = {};
	for (const field of activity.fields) {
		if (!field.required) continue;
		if (field.dataTarget === 'answer' && field.type === 'selecao') {
			values[field.id] = field.options[0];
		} else if (field.dataTarget === 'answer' && field.type === 'selecao_multipla') {
			values[field.id] = encodeMultiSelectValue([field.options[0].id]);
		} else if (field.dataTarget === 'answer' && field.type === 'lista_partes') {
			values[field.id] = encodePlanningItems([{ id: `${field.id}-item-1`, text: 'Parte de teste' }]);
		} else {
			values[field.id] = `resposta de teste (${field.id})`;
		}
	}
	return unwrapResult(answerActivity(catalog, state, activityId, values, occurredAt));
}

/** `skipActivity` já desembrulhado, para não repetir `unwrapResult` em cada teste. */
export function skipActivityForTest(
	catalog: Catalog,
	state: ProjectState,
	activityId: string,
	pendingItemId: string,
	occurredAt: string
): ProjectState {
	return unwrapResult(skipActivity(catalog, state, activityId, pendingItemId, occurredAt));
}

/**
 * Confirma uma versão de escopo (`scope_confirmation`) com o mínimo que
 * satisfaz {@link getScopeConfirmationIssues}: um item em `agora` com
 * valor/esforço definidos e uma hipótese não vazia — para quando o teste só
 * precisa que `montar_proxima_versao` fique `concluída`, sem se importar com
 * o conteúdo do escopo.
 */
export function confirmScopeVersionMinimally(
	catalog: Catalog,
	state: ProjectState,
	itemId: string,
	occurredAt: string
): ProjectState {
	let next = unwrapResult(addScopeItem(catalog, state, itemId, 'Item de teste', 'agora', occurredAt));
	next = unwrapResult(setScopeItemEffort(catalog, next, itemId, 'medio', occurredAt));
	next = unwrapResult(setHypothesis(catalog, next, 'Hipótese de teste'));
	return unwrapResult(confirmScopeVersion(catalog, next, occurredAt));
}

/**
 * Confirma o Mapa de Impacto (`publico`, ETAPA 2 do rework) com o mínimo que
 * satisfaz {@link getAffectedGroupConfirmationIssues}: um grupo com impact e
 * frequency definidos — para quando o teste só precisa que `publico` fique
 * `concluída`, sem se importar com o conteúdo do mapa.
 */
export function confirmAffectedGroupsMinimally(
	catalog: Catalog,
	state: ProjectState,
	groupId: string,
	occurredAt: string
): ProjectState {
	let next = unwrapResult(addAffectedGroup(catalog, state, groupId, 'Grupo de teste', occurredAt));
	next = unwrapResult(setAffectedGroupImpact(catalog, next, groupId, 'alto', occurredAt));
	next = unwrapResult(setAffectedGroupFrequency(catalog, next, groupId, 'constante', occurredAt));
	return unwrapResult(confirmAffectedGroups(catalog, next, occurredAt));
}

/**
 * Confirma "Como é tratado hoje" (`estado_atual`, Stage 4A do rework) com o
 * mínimo que satisfaz {@link getTreatmentConfirmationIssues}: um passo com
 * `whatHappens` preenchido — para quando o teste só precisa que
 * `estado_atual` fique `concluída`, sem se importar com o conteúdo da
 * cadeia.
 */
export function confirmTreatmentMinimally(
	catalog: Catalog,
	state: ProjectState,
	stepId: string,
	occurredAt: string
): ProjectState {
	const next = unwrapResult(addTreatmentStep(catalog, state, stepId, 'Passo de teste', occurredAt));
	return unwrapResult(confirmTreatment(catalog, next, occurredAt));
}

/**
 * Confirma "Decompor o trabalho" (S9 — explicit_confirmation contra WorkItem)
 * com o mínimo que {@link confirmDecomposition} exige: um WorkItem real —
 * para quando o teste só precisa que a atividade fique `concluída`, sem se
 * importar com o conteúdo do WorkItem.
 */
export function confirmDecompositionMinimally(
	catalog: Catalog,
	state: ProjectState,
	workItemId: string,
	occurredAt: string
): ProjectState {
	const next = unwrapResult(addWorkItem(catalog, state, workItemId, 'Item de trabalho de teste', occurredAt));
	return unwrapResult(confirmDecomposition(catalog, next, occurredAt));
}

/**
 * Confirma "Priorizar entregas" (S9 — explicit_confirmation contra
 * Deliverable) com o mínimo que {@link confirmPlanningPriority} exige: uma
 * Deliverable real — para quando o teste só precisa que a atividade fique
 * `concluída`, sem se importar com o conteúdo da entrega.
 */
export function confirmPlanningPriorityMinimally(
	catalog: Catalog,
	state: ProjectState,
	deliverableId: string,
	occurredAt: string
): ProjectState {
	const next = unwrapResult(addDeliverable(catalog, state, deliverableId, 'Entrega de teste', 'agora', occurredAt));
	return unwrapResult(confirmPlanningPriority(catalog, next, occurredAt));
}

/**
 * Confirma "Mapear dependências" (S9 — explicit_confirmation contra
 * Dependency, mas ZERO é resultado válido) — {@link confirmDependencyMapping}
 * nunca exige nenhuma Dependency, então não há "mínimo" a fabricar aqui,
 * ao contrário de {@link confirmDecompositionMinimally}/
 * {@link confirmPlanningPriorityMinimally}.
 */
export function confirmDependencyMappingMinimally(catalog: Catalog, state: ProjectState, occurredAt: string): ProjectState {
	return unwrapResult(confirmDependencyMapping(catalog, state, occurredAt));
}

/**
 * Confirma "Definir marcos" (S9 — explicit_confirmation contra Milestone,
 * mas ZERO é resultado válido) — mesmo raciocínio de
 * {@link confirmDependencyMappingMinimally}: {@link confirmMilestoneReview}
 * nunca exige nenhum Milestone, então não há "mínimo" a fabricar aqui.
 */
export function confirmMilestoneReviewMinimally(catalog: Catalog, state: ProjectState, occurredAt: string): ProjectState {
	return unwrapResult(confirmMilestoneReview(catalog, state, occurredAt));
}

/**
 * Confirma "Identificar riscos do projeto"/"Atualizar riscos" (S10 —
 * explicit_confirmation contra Risk, mas ZERO é resultado válido, D049) —
 * mesmo raciocínio de {@link confirmDependencyMappingMinimally}: nenhuma das
 * duas exige nenhum Risk, então não há "mínimo" a fabricar aqui.
 */
export function confirmRiskIdentificationMinimally(catalog: Catalog, state: ProjectState, occurredAt: string): ProjectState {
	return unwrapResult(confirmRiskIdentification(catalog, state, occurredAt));
}

export function confirmRiskUpdateMinimally(catalog: Catalog, state: ProjectState, occurredAt: string): ProjectState {
	return unwrapResult(confirmRiskUpdate(catalog, state, occurredAt));
}

/**
 * Confirma "Registrar decisões e mudanças" (S11 — explicit_confirmation
 * contra Decision/Change, mas ZERO de ambas é resultado válido, ETAPA 11 do
 * rework §41) — mesmo raciocínio de {@link confirmDependencyMappingMinimally}:
 * nunca exige nenhuma Decision/Change, então não há "mínimo" a fabricar aqui.
 */
export function confirmDecisionsAndChangesReviewMinimally(
	catalog: Catalog,
	state: ProjectState,
	occurredAt: string
): ProjectState {
	return unwrapResult(confirmDecisionsAndChangesReview(catalog, state, occurredAt));
}

/**
 * Confirma "Resultado desejado" (`resultado`, Stage 4C do rework) com o
 * mínimo que satisfaz {@link getDesiredOutcomeConfirmationIssues}: um
 * DesiredOutcome com `change` preenchido — para quando o teste só precisa
 * que `resultado` fique `concluída`, sem se importar com o conteúdo da
 * coleção.
 */
export function confirmDesiredOutcomesMinimally(
	catalog: Catalog,
	state: ProjectState,
	outcomeId: string,
	occurredAt: string
): ProjectState {
	const next = unwrapResult(addDesiredOutcome(catalog, state, outcomeId, 'Resultado de teste', occurredAt));
	return unwrapResult(confirmDesiredOutcomes(catalog, next, occurredAt));
}

/**
 * Completa todas as atividades de uma fase, na ordem do catálogo:
 * `required_fields` via {@link answerActivityMinimally}, `explicit_confirmation`
 * via `confirmSummary` (Resumo), {@link confirmDecompositionMinimally}
 * (Decompor o trabalho, S9), {@link confirmPlanningPriorityMinimally}
 * (Priorizar entregas, S9), {@link confirmDependencyMappingMinimally}
 * (Mapear dependências, S9), {@link confirmMilestoneReviewMinimally}
 * (Definir marcos, S9), {@link confirmRiskIdentificationMinimally}/
 * {@link confirmRiskUpdateMinimally} (Riscos, S10) ou
 * {@link confirmAffectedGroupsMinimally} (Quem é afetado, ETAPA 2), `scope_confirmation` via
 * {@link confirmScopeVersionMinimally}.
 */
export function completePhase(catalog: Catalog, state: ProjectState, phaseId: string, occurredAt: string): ProjectState {
	const phase = catalog.phases.find((p) => p.id === phaseId);
	if (!phase) throw new Error(`fase de teste não encontrada: "${phaseId}"`);
	let next = state;
	for (const activity of phase.activities) {
		if (activity.completionMode === 'explicit_confirmation') {
			// Atividades explicit_confirmation no catálogo (C5-01/S9 + ETAPA 2) —
			// cada uma tem sua própria transição de confirmação, localizada por id
			// explícito; nunca uma seleção genérica "a explicit_confirmation desta
			// fase".
			if (activity.id === 'decompor_trabalho') {
				next = confirmDecompositionMinimally(catalog, next, `${activity.id}-work-item-1`, occurredAt);
			} else if (activity.id === 'priorizar_entregas') {
				next = confirmPlanningPriorityMinimally(catalog, next, `${activity.id}-deliverable-1`, occurredAt);
			} else if (activity.id === 'mapear_dependencias') {
				next = confirmDependencyMappingMinimally(catalog, next, occurredAt);
			} else if (activity.id === 'definir_marcos') {
				next = confirmMilestoneReviewMinimally(catalog, next, occurredAt);
			} else if (activity.id === 'riscos_projeto') {
				next = confirmRiskIdentificationMinimally(catalog, next, occurredAt);
			} else if (activity.id === 'atualizar_riscos') {
				next = confirmRiskUpdateMinimally(catalog, next, occurredAt);
			} else if (activity.id === 'decisoes_mudancas') {
				next = confirmDecisionsAndChangesReviewMinimally(catalog, next, occurredAt);
			} else if (activity.id === 'publico') {
				next = confirmAffectedGroupsMinimally(catalog, next, `${activity.id}-affected-group-1`, occurredAt);
			} else if (activity.id === 'estado_atual') {
				next = confirmTreatmentMinimally(catalog, next, `${activity.id}-treatment-step-1`, occurredAt);
			} else if (activity.id === 'entender_causas') {
				// "Entender as causas" (Stage 4B do rework) nunca bloqueia conclusão
				// (ver getCauseHypothesesConfirmationIssues, sempre []) — completar
				// minimamente é só confirmar, sem precisar de nenhuma CauseHypothesis.
				next = unwrapResult(confirmCauseHypotheses(catalog, next, occurredAt));
			} else if (activity.id === 'resultado') {
				next = confirmDesiredOutcomesMinimally(catalog, next, `${activity.id}-desired-outcome-1`, occurredAt);
			} else {
				next = unwrapResult(confirmSummary(catalog, next));
			}
		} else if (activity.completionMode === 'scope_confirmation') {
			next = confirmScopeVersionMinimally(catalog, next, `${activity.id}-scope-item-1`, occurredAt);
		} else {
			next = answerActivityMinimally(catalog, next, activity.id, occurredAt);
		}
	}
	return next;
}

/** Completa o catálogo inteiro, fase a fase, na ordem — para testes de jornada ponta a ponta. */
export function completeEntireCatalog(catalog: Catalog, state: ProjectState, occurredAt: string): ProjectState {
	let next = state;
	for (const phase of catalog.phases) {
		next = completePhase(catalog, next, phase.id, occurredAt);
	}
	return next;
}

// --- Fixtures fabricadas ---------------------------------------------------
//
// Testam o comportamento de computePhaseStatus/computeNextActivity para
// catalogStatus 'partial' e 'unavailable' sem depender de o catálogo real
// ter uma fase nesse estado. Nesta versão o catálogo real não tem nenhuma
// (todas as seis fases são 'complete') — ver docs/core/STATE_MACHINE.md §2,
// que continua descrevendo os três estados como parte do modelo geral.

const fixtureAtividade: ActivityDefinition = {
	id: 'fixture_atividade',
	phaseId: 'fixture_fase_partial',
	order: 1,
	title: 'Atividade fabricada de teste',
	mainQuestion: 'Pergunta fabricada de teste?',
	why: 'Fixture de teste — não faz parte do catálogo real.',
	example: 'Fixture de teste.',
	completionCriteria: 'Campo fabricado preenchido.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Pendência fabricada de teste',
	pendingItemDetail: 'Fixture de teste — não faz parte do catálogo real.',
	fields: [
		{
			id: 'fixture_campo',
			activityId: 'fixture_atividade',
			label: 'Campo fabricado',
			required: true,
			dataTarget: 'answer',
			type: 'texto_curto'
		}
	]
};

export const fabricatedPartialPhase: PhaseDefinition = {
	id: 'fixture_fase_partial',
	order: 999,
	label: 'Fase parcial fabricada (fixture de teste)',
	catalogStatus: 'partial',
	activities: [fixtureAtividade]
};

export const fabricatedPartialCatalog: Catalog = { phases: [fabricatedPartialPhase] };

export const fabricatedUnavailablePhase: PhaseDefinition = {
	id: 'fixture_fase_unavailable',
	order: 998,
	label: 'Fase indisponível fabricada (fixture de teste)',
	catalogStatus: 'unavailable',
	activities: []
};
