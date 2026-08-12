// Helpers e fixtures de teste sobre domain/orientation-engine — não é código
// de produção, não é exportado por domain/index.ts, só consumido por specs
// (`.spec.ts`) via import direto deste caminho.
//
// Objetivo: evitar que cada atividade nova do catálogo exija editar de novo
// os mesmos blocos de "responder as N atividades anteriores campo a campo"
// espalhados pelos testes de orientation-engine.

import {
	addAffectedGroup,
	addScopeItem,
	answerActivity,
	confirmAffectedGroups,
	confirmPlanningPriority,
	confirmScopeVersion,
	confirmSummary,
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
 * Completa todas as atividades de uma fase, na ordem do catálogo:
 * `required_fields` via {@link answerActivityMinimally}, `explicit_confirmation`
 * via `confirmSummary` (Resumo), `confirmPlanningPriority` (Priorizar
 * entregas, C5-01) ou {@link confirmAffectedGroupsMinimally} (Quem é afetado,
 * ETAPA 2), `scope_confirmation` via {@link confirmScopeVersionMinimally}.
 */
export function completePhase(catalog: Catalog, state: ProjectState, phaseId: string, occurredAt: string): ProjectState {
	const phase = catalog.phases.find((p) => p.id === phaseId);
	if (!phase) throw new Error(`fase de teste não encontrada: "${phaseId}"`);
	let next = state;
	for (const activity of phase.activities) {
		if (activity.completionMode === 'explicit_confirmation') {
			// Três atividades explicit_confirmation no catálogo (C5-01 + ETAPA 2)
			// — cada uma tem sua própria transição de confirmação, localizada por
			// id explícito; nunca uma seleção genérica "a explicit_confirmation
			// desta fase".
			if (activity.id === 'priorizar_entregas') {
				next = unwrapResult(confirmPlanningPriority(catalog, next, occurredAt));
			} else if (activity.id === 'publico') {
				next = confirmAffectedGroupsMinimally(catalog, next, `${activity.id}-affected-group-1`, occurredAt);
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
