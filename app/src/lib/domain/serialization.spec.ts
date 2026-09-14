import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';
import {
	addAffectedGroup,
	addChange,
	addDecision,
	addDeliverable,
	addDependency,
	promoteScopeItemToDeliverable,
	addMilestone,
	setMilestonePlannedDate,
	linkWorkItemToDecision,
	linkWorkItemToMilestone,
	reachMilestone,
	addRisk,
	editRiskStatement,
	closeRisk,
	reopenRisk,
	reviewRisk,
	setRiskAssessment,
	setRiskResponse,
	confirmRiskIdentification,
	confirmRiskUpdate,
	confirmDecisionsAndChangesReview,
	decideDecision,
	editChangeStatement,
	editDecision,
	editDecisionOutcome,
	setChangeImpact,
	addCauseHypothesis,
	addDesiredOutcome,
	addImpediment,
	addScopeItem,
	addTreatmentStep,
	addWorkItem,
	setWorkItemSchedule,
	captureScheduleBaseline,
	previewScheduleBaselineCapture,
	answerActivity,
	completeExternalAction,
	confirmAffectedGroups,
	confirmScopeVersion,
	confirmSummary,
	confirmTreatment,
	markCauseExplorationUnknown,
	prepareExternalAction,
	resolveImpediment,
	setAffectedGroupFrequency,
	setAffectedGroupImpact,
	setHypothesis,
	setImpedimentDecision,
	setImpedimentNextAction,
	setRouteStartPhase,
	setScopeItemEffort,
	setTreatmentNoTreatment,
	skipActivity
} from './transitions';
import { deserializeProjectEvents, deserializeProjectState, serializeProjectState } from './serialization';
import { encodePlanningItems } from './planning-items';
import type { ProjectEvent } from './events';
import type { Catalog, RequiredFieldsActivity } from './catalog-types';
import type { ProjectState } from './state-types';
import type { ProjectStateParseError } from './serialization';

// Nenhuma atividade do catálogo real usa mais dataTarget: 'project_property'
// desde a remoção de "Contexto inicial" — fixture local só para o teste que
// precisa dessa forma de campo, mesmo padrão de domain/test-support.ts.
const PROJECT_PROPERTY_ACTIVITY: RequiredFieldsActivity = {
	id: 'fixture_project_property',
	phaseId: 'descoberta',
	order: 1,
	title: 'Fixture de teste',
	mainQuestion: 'Pergunta fabricada de teste?',
	why: 'Fixture de teste.',
	example: 'Fixture de teste.',
	completionCriteria: 'Nome preenchido.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Pendência fabricada de teste',
	pendingItemDetail: 'Fixture de teste.',
	fields: [
		{
			id: 'nome_provisorio',
			activityId: 'fixture_project_property',
			label: 'Nome provisório do projeto',
			required: true,
			dataTarget: 'project_property',
			projectProperty: 'name',
			type: 'texto_curto'
		}
	]
};
const PROJECT_PROPERTY_CATALOG: Catalog = {
	phases: [
		{ id: 'descoberta', order: 1, label: 'Descoberta', catalogStatus: 'complete', activities: [PROJECT_PROPERTY_ACTIVITY] }
	]
};

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

function baseEnvelope(): { version: number; state: unknown } {
	const state = createInitialProjectState(catalog, 'proj-1', T1);
	return JSON.parse(serializeProjectState(state));
}

function nonTrivialState(): ProjectState {
	let state = createInitialProjectState(catalog, 'proj-1', T1);
	state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'Um problema' }, T1));
	state = unwrap(skipActivity(catalog, state, 'problema', 'pend-1', T1));
	state = unwrap(addAffectedGroup(catalog, state, 'ag-1', 'Clientes', T2));
	state = unwrap(setAffectedGroupImpact(catalog, state, 'ag-1', 'alto', T2));
	state = unwrap(setAffectedGroupFrequency(catalog, state, 'ag-1', 'constante', T2));
	state = unwrap(confirmAffectedGroups(catalog, state, T2));
	state = unwrap(addTreatmentStep(catalog, state, 'ts-1', 'Financeiro confere manualmente', T2));
	state = unwrap(confirmTreatment(catalog, state, T2));
	state = unwrap(confirmSummary(catalog, state));
	state = unwrap(addScopeItem(catalog, state, 'scope-1', 'Criar projeto', 'agora', T1));
	state = unwrap(addScopeItem(catalog, state, 'scope-2', 'Relatórios avançados', 'depois', T1));
	state = unwrap(setScopeItemEffort(catalog, state, 'scope-1', 'pequeno', T1));
	state = unwrap(setHypothesis(catalog, state, 'Usuários concluem a jornada sem ajuda externa'));
	state = unwrap(confirmScopeVersion(catalog, state, T2));
	state = unwrap(addImpediment(catalog, state, 'imp-1', 'Falta acesso ao ambiente', 'falta_de_recurso', T1));
	state = unwrap(setImpedimentNextAction(catalog, state, 'imp-1', 'Solicitar acesso à TI', T1));
	state = unwrap(addImpediment(catalog, state, 'imp-2', 'Decisão pendente do time', 'decisao_pendente', T1));
	state = unwrap(resolveImpediment(catalog, state, 'imp-2', T2));
	return state;
}

function expectError(json: string, kind: ProjectStateParseError['kind']): void {
	const result = deserializeProjectState(json, catalog);
	expect(result.ok).toBe(false);
	if (!result.ok) expect(result.error.kind).toBe(kind);
}

describe('round-trip ProjectState → JSON → ProjectState', () => {
	it('preserva o estado exatamente após um ciclo completo de serialização/desserialização', () => {
		const original = nonTrivialState();
		const json = serializeProjectState(original);
		const result = deserializeProjectState(json, catalog);
		expect(result).toEqual({ ok: true, value: original });
	});

	it('serializeProjectState produz um envelope com version: 1', () => {
		const json = serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1));
		const parsed = JSON.parse(json);
		expect(parsed.version).toBe(1);
		expect(parsed.state.project.id).toBe('proj-1');
	});
});

describe('deserializeProjectState — invalid_json', () => {
	it('rejeita uma string que não é JSON válido', () => {
		expectError('isto não é JSON {{{', 'invalid_json');
	});
});

describe('deserializeProjectState — unsupported_version', () => {
	it('rejeita uma versão diferente de 1', () => {
		const envelope = baseEnvelope();
		envelope.version = 2;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result).toEqual({ ok: false, error: { kind: 'unsupported_version', found: 2 } });
	});
});

describe('deserializeProjectState — invalid_shape', () => {
	it('rejeita um JSON raiz que não é objeto', () => {
		expectError(JSON.stringify('apenas uma string'), 'invalid_shape');
	});

	it('rejeita envelope sem version', () => {
		expectError(JSON.stringify({ state: {} }), 'invalid_shape');
	});

	it('rejeita envelope sem state', () => {
		expectError(JSON.stringify({ version: 1 }), 'invalid_shape');
	});

	it('rejeita project.id que não é string', () => {
		const envelope = baseEnvelope() as { state: { project: Record<string, unknown> } };
		envelope.state.project.id = 123;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita activityProgress que não é array', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		envelope.state.activityProgress = {};
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita status fora da união aprovada', () => {
		const envelope = baseEnvelope() as { state: { activityProgress: Array<Record<string, unknown>> } };
		envelope.state.activityProgress[0].status = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita createdAt com formato de data inválido', () => {
		const envelope = baseEnvelope() as { state: { project: Record<string, unknown> } };
		envelope.state.project.createdAt = 'não é uma data';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — invalid_reference', () => {
	it('rejeita ActivityProgress.activityDefinitionId inexistente no catálogo', () => {
		const envelope = baseEnvelope() as { state: { activityProgress: Array<Record<string, unknown>> } };
		envelope.state.activityProgress[0].activityDefinitionId = 'inexistente';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita Answer.activityDefinitionId inexistente no catálogo', () => {
		const state = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', { origem: 'x' }, T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { answers: Array<Record<string, unknown>> };
		};
		envelope.state.answers[0].activityDefinitionId = 'inexistente';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita Answer.fieldDefinitionId que não pertence à atividade', () => {
		const state = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', { origem: 'x' }, T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { answers: Array<Record<string, unknown>> };
		};
		envelope.state.answers[0].fieldDefinitionId = 'campo_inexistente';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita PendingItem.activityDefinitionId inexistente no catálogo', () => {
		const state = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { pendingItems: Array<Record<string, unknown>> };
		};
		envelope.state.pendingItems[0].activityDefinitionId = 'inexistente';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});
});

describe('deserializeProjectState — invariant_violation', () => {
	it('rejeita ActivityProgress com projectId diferente do Project', () => {
		const envelope = baseEnvelope() as { state: { activityProgress: Array<Record<string, unknown>> } };
		envelope.state.activityProgress[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ActivityProgress faltando para uma atividade do catálogo', () => {
		const envelope = baseEnvelope() as { state: { activityProgress: unknown[] } };
		envelope.state.activityProgress = envelope.state.activityProgress.slice(1);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ActivityProgress duplicado para a mesma atividade', () => {
		const envelope = baseEnvelope() as { state: { activityProgress: unknown[] } };
		envelope.state.activityProgress.push(envelope.state.activityProgress[0]);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita o Resumo (explicit_confirmation, allowsSkip false) com status pulada', () => {
		const envelope = baseEnvelope() as { state: { activityProgress: Array<Record<string, unknown>> } };
		const resumo = envelope.state.activityProgress.find((p) => p.activityDefinitionId === 'resumo')!;
		resumo.status = 'pulada';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('S9: aceita "Priorizar entregas" (explicit_confirmation, allowsSkip true) com status pulada', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(skipActivity(catalog, state, 'priorizar_entregas', 'pend-priorizar', T1));

		const json = serializeProjectState(state);
		const result = deserializeProjectState(json, catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('rejeita Answer com projectId diferente do Project', () => {
		const state = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', { origem: 'x' }, T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { answers: Array<Record<string, unknown>> };
		};
		envelope.state.answers[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita Answer referenciando um campo project_property', () => {
		// Estado base contra o próprio PROJECT_PROPERTY_CATALOG (não o catálogo
		// real) — senão o ActivityProgress de "origem"/"problema"/etc. do
		// catálogo real já seria rejeitado por invalid_reference antes de
		// chegar na violação que este teste quer provar.
		const state = createInitialProjectState(PROJECT_PROPERTY_CATALOG, 'proj-1', T1);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { answers: Array<Record<string, unknown>> };
		};
		envelope.state.answers.push({
			projectId: 'proj-1',
			activityDefinitionId: 'fixture_project_property',
			fieldDefinitionId: 'nome_provisorio',
			value: 'Portal',
			createdAt: T1,
			updatedAt: T1
		});
		const result = deserializeProjectState(JSON.stringify(envelope), PROJECT_PROPERTY_CATALOG);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe('invariant_violation');
	});

	it('rejeita Answer duplicada para o mesmo campo/atividade', () => {
		const state = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', { origem: 'x' }, T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { answers: unknown[] };
		};
		envelope.state.answers.push(envelope.state.answers[0]);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita PendingItem com projectId diferente do Project', () => {
		const state = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { pendingItems: Array<Record<string, unknown>> };
		};
		envelope.state.pendingItems[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita PendingItem para uma atividade com allowsSkip: false (Resumo)', () => {
		const envelope = baseEnvelope() as { state: { pendingItems: unknown[]; project: { id: string } } };
		envelope.state.pendingItems = [
			{
				id: 'pend-x',
				projectId: envelope.state.project.id,
				activityDefinitionId: 'resumo',
				status: 'aberta',
				createdAt: T1
			}
		];
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita PendingItem.id duplicado', () => {
		const state1 = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const state2 = unwrap(skipActivity(catalog, state1, 'problema', 'pend-1', T1)); // mesmo id, outra atividade
		const envelope = JSON.parse(serializeProjectState(state2));
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita duas PendingItem para a mesma atividade', () => {
		const state = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { pendingItems: Array<Record<string, unknown>> };
		};
		const second = { ...envelope.state.pendingItems[0], id: 'pend-2' };
		envelope.state.pendingItems.push(second);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita PendingItem aberta com resolvedAt presente', () => {
		const state = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { pendingItems: Array<Record<string, unknown>> };
		};
		envelope.state.pendingItems[0].resolvedAt = T2;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita PendingItem resolvida sem resolvedAt', () => {
		const skipped = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const resolved = unwrap(answerActivity(catalog, skipped, 'origem', { origem: 'x' }, T2));
		const envelope = JSON.parse(serializeProjectState(resolved)) as {
			state: { pendingItems: Array<Record<string, unknown>> };
		};
		delete envelope.state.pendingItems[0].resolvedAt;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});
});

describe('deserializeProjectState — ScopeItem / ScopeVersion', () => {
	function scopeState(): ProjectState {
		let state = unwrap(
			addScopeItem(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'scope-1', 'Item', 'agora', T1)
		);
		return state;
	}

	it('rejeita ScopeItem.bucket fora da união aprovada', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[0].bucket = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita ScopeItem.effort fora da união aprovada', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[0].effort = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita ScopeItem.order negativo', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[0].order = -1;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita ScopeItem com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ScopeItem.id duplicado', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: unknown[] };
		};
		envelope.state.scopeItems.push(envelope.state.scopeItems[0]);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ScopeItem em "agora" sem order', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[0].order = null;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ScopeItem fora de "agora" com order definido', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[0].bucket = 'depois';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita order não contíguo entre itens de "agora"', () => {
		let state = unwrap(
			addScopeItem(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'scope-1', 'Um', 'agora', T1)
		);
		state = unwrap(addScopeItem(catalog, state, 'scope-2', 'Dois', 'agora', T1));
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[1].order = 5;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ScopeVersion com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeVersion: Record<string, unknown> };
		};
		envelope.state.scopeVersion.projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ScopeVersion confirmada que não atende aos critérios de confirmação', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeVersion: Record<string, unknown> };
		};
		envelope.state.scopeVersion.confirmedAt = T2;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ScopeItem.executionStatus fora da união aprovada', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		envelope.state.scopeItems[0].executionStatus = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — compatibilidade com JSONs anteriores à D025 (sem executionStatus)', () => {
	function scopeState(): ProjectState {
		return unwrap(
			addScopeItem(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'scope-1', 'Item', 'agora', T1)
		);
	}

	it('trata ScopeItem.executionStatus ausente como "a_fazer" (envelope válido pré-D025)', () => {
		const envelope = JSON.parse(serializeProjectState(scopeState())) as {
			state: { scopeItems: Array<Record<string, unknown>> };
		};
		delete envelope.state.scopeItems[0].executionStatus;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.scopeItems[0].executionStatus).toBe('a_fazer');
	});

	it('exportação/importação preserva um executionStatus não-padrão', () => {
		const state = scopeState();
		const withStatus: ProjectState = {
			...state,
			scopeItems: state.scopeItems.map((item) => ({ ...item, executionStatus: 'concluido' as const }))
		};
		const result = deserializeProjectState(serializeProjectState(withStatus), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.scopeItems[0].executionStatus).toBe('concluido');
	});
});

describe('deserializeProjectState — compatibilidade com JSONs anteriores à D022 (sem impediments)', () => {
	it('trata state.impediments ausente como [] (envelope válido pré-D022)', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		delete envelope.state.impediments;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.impediments).toEqual([]);
	});

	it('continua rejeitando state.impediments: null', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		envelope.state.impediments = null;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — compatibilidade com JSONs anteriores à D023 (sem routeStartPhaseId)', () => {
	it('trata project.routeStartPhaseId ausente como null (envelope válido pré-D023)', () => {
		const envelope = baseEnvelope() as { state: { project: Record<string, unknown> } };
		delete envelope.state.project.routeStartPhaseId;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.project.routeStartPhaseId).toBeNull();
	});

	it('preserva routeStartPhaseId definido num JSON novo', () => {
		const withRoute = unwrap(
			setRouteStartPhase(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'estruturacao')
		);
		const json = serializeProjectState(withRoute);
		const result = deserializeProjectState(json, catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.project.routeStartPhaseId).toBe('estruturacao');
	});

	it('rejeita routeStartPhaseId referenciando uma fase que não existe no catálogo', () => {
		const envelope = baseEnvelope() as { state: { project: Record<string, unknown> } };
		envelope.state.project.routeStartPhaseId = 'fase-inexistente';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita routeStartPhaseId de tipo inválido (nem string nem null)', () => {
		const envelope = baseEnvelope() as { state: { project: Record<string, unknown> } };
		envelope.state.project.routeStartPhaseId = 42;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — Impediment', () => {
	function impedimentState(): ProjectState {
		return unwrap(
			addImpediment(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'imp-1', 'Texto', 'outro', T1)
		);
	}

	it('rejeita Impediment.tipo fora da união aprovada', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].tipo = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita Impediment.status fora da união aprovada', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].status = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita Impediment.nextAction que não é string nem null', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].nextAction = 42;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita Impediment com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita Impediment.id duplicado', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentState())) as {
			state: { impediments: unknown[] };
		};
		envelope.state.impediments.push(envelope.state.impediments[0]);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita status "aberto" com resolvedAt definido', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].resolvedAt = T2;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita status "resolvido" sem resolvedAt', () => {
		let state = impedimentState();
		state = unwrap(resolveImpediment(catalog, state, 'imp-1', T2));
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].resolvedAt = null;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});
});

// Impediment.decisionId — ETAPA 11 do rework, segundo microcorte (§41/§13.4).
describe('deserializeProjectState — Impediment.decisionId', () => {
	function impedimentWithDecisionState(): ProjectState {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addImpediment(catalog, state, 'imp-1', 'Aguardando decisão', 'decisao_pendente', T1));
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));
		return state;
	}

	function impedimentWithoutDecisionState(): ProjectState {
		return unwrap(
			addImpediment(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'imp-1', 'Texto', 'outro', T1)
		);
	}

	it('trata decisionId ausente como null (compatibilidade com snapshot anterior a este corte)', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentWithoutDecisionState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		delete envelope.state.impediments[0].decisionId;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.impediments[0].decisionId).toBeNull();
	});

	it('round-trip preserva decisionId', () => {
		const original = impedimentWithDecisionState();
		const json = serializeProjectState(original);
		const result = deserializeProjectState(json, catalog);
		expect(result).toEqual({ ok: true, value: original });
	});

	it('rejeita decisionId apontando para Decision inexistente', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentWithDecisionState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].decisionId = 'nao-existe';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita decisionId preenchido em Impediment de tipo diferente de decisao_pendente', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentWithDecisionState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].tipo = 'outro';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita decisionId que não é string, null ou ausente', () => {
		const envelope = JSON.parse(serializeProjectState(impedimentWithDecisionState())) as {
			state: { impediments: Array<Record<string, unknown>> };
		};
		envelope.state.impediments[0].decisionId = 42;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — compatibilidade com JSONs anteriores à ETAPA 2 (sem affectedGroups)', () => {
	it('trata state.affectedGroups ausente como [] (envelope válido pré-ETAPA 2)', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		delete envelope.state.affectedGroups;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.affectedGroups).toEqual([]);
	});

	it('continua rejeitando state.affectedGroups: null', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		envelope.state.affectedGroups = null;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — READ-LEGACY de publico_detail (snapshot exportado antes da ETAPA 2)', () => {
	// Simula um export legítimo feito ANTES da ETAPA 2: "publico" era
	// required_fields, o usuário respondeu publico_detail e a atividade ficou
	// concluída por esse mecanismo — sem nenhum AffectedGroup, que não
	// existia ainda. baseEnvelope() já traz activityProgress/affectedGroups
	// no formato atual; só a Answer + o status de "publico" precisam ser
	// ajustados para reproduzir o formato antigo.
	function legacyEnvelopeWithPublicoDetail(): {
		state: {
			project: { id: string };
			answers: Array<Record<string, unknown>>;
			activityProgress: Array<Record<string, unknown>>;
			affectedGroups: unknown[];
		};
	} {
		const envelope = baseEnvelope() as {
			state: {
				project: { id: string };
				answers: Array<Record<string, unknown>>;
				activityProgress: Array<Record<string, unknown>>;
				affectedGroups: unknown[];
			};
		};
		envelope.state.answers.push({
			projectId: envelope.state.project.id,
			activityDefinitionId: 'publico',
			fieldDefinitionId: 'publico_detail',
			value: 'Agentes de atendimento e clientes internos.',
			createdAt: T1,
			updatedAt: T1
		});
		const publicoProgress = envelope.state.activityProgress.find(
			(p) => p.activityDefinitionId === 'publico'
		)!;
		publicoProgress.status = 'concluída';
		return envelope;
	}

	it('export/snapshot legado com publico_detail importa com sucesso (não invalida o projeto inteiro)', () => {
		const envelope = legacyEnvelopeWithPublicoDetail();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
	});

	it('o dado legado é preservado (READ-LEGACY) mas não cria nenhum AffectedGroup automaticamente', () => {
		const envelope = legacyEnvelopeWithPublicoDetail();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// dado antigo preservado tal como estava — nunca reescrito, nunca apagado
		const legacyAnswer = result.value.answers.find(
			(a) => a.activityDefinitionId === 'publico' && a.fieldDefinitionId === 'publico_detail'
		);
		expect(legacyAnswer?.value).toBe('Agentes de atendimento e clientes internos.');

		// nenhuma conversão automática texto livre → objeto estruturado
		expect(result.value.affectedGroups).toEqual([]);

		// o status antigo de conclusão é preservado (grandfathered), mesmo sem
		// nenhum AffectedGroup — é exatamente o que existia no snapshot original
		const publicoProgress = result.value.activityProgress.find((p) => p.activityDefinitionId === 'publico');
		expect(publicoProgress?.status).toBe('concluída');
	});

	it('o fluxo novo a partir desse estado usa só AffectedGroup — publico_detail nunca é reescrita nem lida por nenhuma projeção', () => {
		const envelope = legacyEnvelopeWithPublicoDetail();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// adicionar um grupo novo a partir daqui opera exclusivamente sobre
		// AffectedGroup — a Answer legada não é tocada, não é apagada, e a
		// mutação não depende dela de forma alguma.
		const withGroup = unwrap(addAffectedGroup(catalog, result.value, 'ag-legacy', 'Novo grupo', T2));
		expect(withGroup.affectedGroups).toEqual([
			{
				id: 'ag-legacy',
				projectId: result.value.project.id,
				label: 'Novo grupo',
				impact: null,
				frequency: null,
				createdAt: T2,
				updatedAt: T2
			}
		]);
		const legacyAnswerStillThere = withGroup.answers.find(
			(a) => a.activityDefinitionId === 'publico' && a.fieldDefinitionId === 'publico_detail'
		);
		expect(legacyAnswerStillThere?.value).toBe('Agentes de atendimento e clientes internos.');
		expect(legacyAnswerStillThere?.updatedAt).toBe(T1); // nunca reescrita

		// a nova classificação torna "publico" incompleta de novo (1 grupo por
		// classificar) — reabre a atividade mesmo tendo vindo de conclusão legada.
		const publicoProgress = withGroup.activityProgress.find((p) => p.activityDefinitionId === 'publico');
		expect(publicoProgress?.status).toBe('em_andamento');
	});

	it('rejeita publico_detail com projectId diferente do Project (validação estrita continua para o que é realmente inválido)', () => {
		const envelope = legacyEnvelopeWithPublicoDetail();
		const legacyAnswer = envelope.state.answers.find((a) => a.fieldDefinitionId === 'publico_detail')!;
		legacyAnswer.projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita publico_detail duplicada', () => {
		const envelope = legacyEnvelopeWithPublicoDetail();
		const legacyAnswer = envelope.state.answers.find((a) => a.fieldDefinitionId === 'publico_detail')!;
		envelope.state.answers.push({ ...legacyAnswer });
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('um campo desconhecido (não deprecado, não existe no catálogo) continua rejeitado normalmente', () => {
		const envelope = legacyEnvelopeWithPublicoDetail();
		envelope.state.answers.push({
			projectId: envelope.state.project.id,
			activityDefinitionId: 'publico',
			fieldDefinitionId: 'campo_totalmente_inventado',
			value: 'x',
			createdAt: T1,
			updatedAt: T1
		});
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});
});

describe('deserializeProjectState — AffectedGroup (ETAPA 2, "Quem é afetado")', () => {
	function affectedGroupState(): ProjectState {
		return unwrap(
			addAffectedGroup(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'ag-1', 'Operação', T1)
		);
	}

	it('rejeita AffectedGroup.impact fora da união aprovada (nem literal nem null)', () => {
		const envelope = JSON.parse(serializeProjectState(affectedGroupState())) as {
			state: { affectedGroups: Array<Record<string, unknown>> };
		};
		envelope.state.affectedGroups[0].impact = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita AffectedGroup.frequency fora da união aprovada (nem literal nem null)', () => {
		const envelope = JSON.parse(serializeProjectState(affectedGroupState())) as {
			state: { affectedGroups: Array<Record<string, unknown>> };
		};
		envelope.state.affectedGroups[0].frequency = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita AffectedGroup.label vazia', () => {
		const envelope = JSON.parse(serializeProjectState(affectedGroupState())) as {
			state: { affectedGroups: Array<Record<string, unknown>> };
		};
		envelope.state.affectedGroups[0].label = '   ';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita AffectedGroup com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(affectedGroupState())) as {
			state: { affectedGroups: Array<Record<string, unknown>> };
		};
		envelope.state.affectedGroups[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita AffectedGroup.id duplicado', () => {
		const envelope = JSON.parse(serializeProjectState(affectedGroupState())) as {
			state: { affectedGroups: unknown[] };
		};
		envelope.state.affectedGroups.push(envelope.state.affectedGroups[0]);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('aceita "publico" concluída quando o mapa atende aos critérios de confirmação', () => {
		let state = affectedGroupState();
		state = unwrap(setAffectedGroupImpact(catalog, state, 'ag-1', 'alto', T1));
		state = unwrap(setAffectedGroupFrequency(catalog, state, 'ag-1', 'constante', T1));
		state = unwrap(confirmAffectedGroups(catalog, state, T2));
		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('rejeita "publico" concluída quando o mapa não atende aos critérios de confirmação', () => {
		const envelope = JSON.parse(serializeProjectState(affectedGroupState())) as {
			state: { activityProgress: Array<Record<string, unknown>> };
		};
		const publico = envelope.state.activityProgress.find((p) => p.activityDefinitionId === 'publico')!;
		publico.status = 'concluída';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});
});

describe('deserializeProjectState — compatibilidade com JSONs anteriores à ETAPA 3 (sem externalActions/evidences)', () => {
	it('trata externalActions/evidences ausentes como [] (envelope válido pré-ETAPA 3)', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		delete envelope.state.externalActions;
		delete envelope.state.evidences;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.externalActions).toEqual([]);
			expect(result.value.evidences).toEqual([]);
		}
	});

	it('continua rejeitando externalActions/evidences: null', () => {
		const withNullActions = baseEnvelope() as { state: Record<string, unknown> };
		withNullActions.state.externalActions = null;
		expectError(JSON.stringify(withNullActions), 'invalid_shape');

		const withNullEvidences = baseEnvelope() as { state: Record<string, unknown> };
		withNullEvidences.state.evidences = null;
		expectError(JSON.stringify(withNullEvidences), 'invalid_shape');
	});
});

describe('deserializeProjectState — ExternalAction / Evidence (ETAPA 3, "Validação Externa")', () => {
	const preparation = {
		objective: 'Confirmar.',
		questions: ['Q1', 'Q2'],
		informationToTake: ['Operação'],
		expectedResult: 'Resultado esperado.'
	};

	function openActionState(): ProjectState {
		let state = unwrap(
			addAffectedGroup(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'ag-1', 'Operação', T1)
		);
		state = unwrap(prepareExternalAction(catalog, state, 'ea-1', 'ag-1', preparation, T1));
		return state;
	}

	function completedActionState(): ProjectState {
		return unwrap(completeExternalAction(catalog, openActionState(), 'ea-1', 'ev-1', 'confirmed', 'Aprendi.', T2));
	}

	it('roundtrip de uma ExternalAction aberta', () => {
		const state = openActionState();
		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('roundtrip de uma ExternalAction concluída + Evidence', () => {
		const state = completedActionState();
		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('rejeita ExternalAction.affectedGroupId referenciando grupo inexistente', () => {
		const envelope = JSON.parse(serializeProjectState(openActionState())) as {
			state: { externalActions: Array<Record<string, unknown>> };
		};
		envelope.state.externalActions[0].affectedGroupId = 'inexistente';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita ExternalAction "aberta" com completedAt preenchido', () => {
		const envelope = JSON.parse(serializeProjectState(openActionState())) as {
			state: { externalActions: Array<Record<string, unknown>> };
		};
		envelope.state.externalActions[0].completedAt = T2;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ExternalAction "concluida" sem completedAt', () => {
		const envelope = JSON.parse(serializeProjectState(completedActionState())) as {
			state: { externalActions: Array<Record<string, unknown>> };
		};
		envelope.state.externalActions[0].completedAt = null;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita duas ExternalActions abertas do mesmo tipo para o mesmo grupo', () => {
		const envelope = JSON.parse(serializeProjectState(openActionState())) as {
			state: { externalActions: Array<Record<string, unknown>> };
		};
		envelope.state.externalActions.push({ ...envelope.state.externalActions[0], id: 'ea-2' });
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita Evidence.externalActionId referenciando ação inexistente', () => {
		const envelope = JSON.parse(serializeProjectState(completedActionState())) as {
			state: { evidences: Array<Record<string, unknown>> };
		};
		envelope.state.evidences[0].externalActionId = 'inexistente';
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita Evidence referenciando uma ExternalAction ainda aberta', () => {
		const envelope = JSON.parse(serializeProjectState(openActionState())) as {
			state: { externalActions: Array<Record<string, unknown>>; evidences: Array<Record<string, unknown>> };
		};
		// Estado impossível: ação nunca foi concluída (ainda "aberta"), mas o
		// payload tenta introduzir uma Evidence relacionada a ela mesmo assim.
		envelope.state.evidences.push({
			id: 'ev-1',
			projectId: 'proj-1',
			externalActionId: 'ea-1',
			affectedGroupId: 'ag-1',
			kind: 'conversation',
			outcome: 'confirmed',
			learning: 'Aprendi.',
			createdAt: T1
		});
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita Evidence.affectedGroupId divergente do affectedGroupId da própria ExternalAction', () => {
		const envelope = JSON.parse(serializeProjectState(completedActionState())) as {
			state: {
				affectedGroups: Array<Record<string, unknown>>;
				evidences: Array<Record<string, unknown>>;
			};
		};
		envelope.state.affectedGroups.push({ ...envelope.state.affectedGroups[0], id: 'ag-2', label: 'Outro' });
		envelope.state.evidences[0].affectedGroupId = 'ag-2';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita duas Evidence para a mesma ExternalAction', () => {
		const envelope = JSON.parse(serializeProjectState(completedActionState())) as {
			state: { evidences: Array<Record<string, unknown>> };
		};
		envelope.state.evidences.push({ ...envelope.state.evidences[0], id: 'ev-2' });
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita ExternalAction "concluida" sem nenhuma Evidence correspondente', () => {
		const envelope = JSON.parse(serializeProjectState(completedActionState())) as {
			state: { evidences: unknown[] };
		};
		envelope.state.evidences = [];
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita Evidence.outcome fora da união aprovada', () => {
		const envelope = JSON.parse(serializeProjectState(completedActionState())) as {
			state: { evidences: Array<Record<string, unknown>> };
		};
		envelope.state.evidences[0].outcome = 'inventado';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita Evidence.learning vazia', () => {
		const envelope = JSON.parse(serializeProjectState(completedActionState())) as {
			state: { evidences: Array<Record<string, unknown>> };
		};
		envelope.state.evidences[0].learning = '   ';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita ExternalAction/Evidence com projectId diferente do Project', () => {
		const withWrongAction = JSON.parse(serializeProjectState(openActionState())) as {
			state: { externalActions: Array<Record<string, unknown>> };
		};
		withWrongAction.state.externalActions[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(withWrongAction), 'invariant_violation');

		const withWrongEvidence = JSON.parse(serializeProjectState(completedActionState())) as {
			state: { evidences: Array<Record<string, unknown>> };
		};
		withWrongEvidence.state.evidences[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(withWrongEvidence), 'invariant_violation');
	});
});

describe('deserializeProjectState — compatibilidade com JSONs anteriores ao Stage 4A (sem currentTreatment/treatmentSteps)', () => {
	it('trata state.currentTreatment ausente como { noTreatment: false } e treatmentSteps ausente como []', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		delete envelope.state.currentTreatment;
		delete envelope.state.treatmentSteps;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.currentTreatment).toEqual({
			projectId: result.value.project.id,
			noTreatment: false,
			updatedAt: result.value.project.createdAt
		});
		expect(result.value.treatmentSteps).toEqual([]);
	});

	it('continua rejeitando state.treatmentSteps: null', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		envelope.state.treatmentSteps = null;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — READ-LEGACY de estado_atual_detail (snapshot exportado antes do Stage 4A)', () => {
	// Mesmo espírito do bloco publico_detail acima: simula um export legítimo
	// feito ANTES do Stage 4A — "estado_atual" era required_fields, o usuário
	// respondeu estado_atual_detail e a atividade ficou concluída por esse
	// mecanismo, sem nenhum TreatmentStep (que não existia ainda).
	function legacyEnvelopeWithEstadoAtualDetail(): {
		state: {
			project: { id: string };
			answers: Array<Record<string, unknown>>;
			activityProgress: Array<Record<string, unknown>>;
			treatmentSteps: unknown[];
		};
	} {
		const envelope = baseEnvelope() as {
			state: {
				project: { id: string };
				answers: Array<Record<string, unknown>>;
				activityProgress: Array<Record<string, unknown>>;
				treatmentSteps: unknown[];
			};
		};
		envelope.state.answers.push({
			projectId: envelope.state.project.id,
			activityDefinitionId: 'estado_atual',
			fieldDefinitionId: 'estado_atual_detail',
			value: 'Cada time mantém sua própria planilha.',
			createdAt: T1,
			updatedAt: T1
		});
		const estadoAtualProgress = envelope.state.activityProgress.find(
			(p) => p.activityDefinitionId === 'estado_atual'
		)!;
		estadoAtualProgress.status = 'concluída';
		return envelope;
	}

	it('export/snapshot legado com estado_atual_detail importa com sucesso (não invalida o projeto inteiro)', () => {
		const envelope = legacyEnvelopeWithEstadoAtualDetail();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
	});

	it('o dado legado é preservado (READ-LEGACY) mas não cria nenhum TreatmentStep automaticamente', () => {
		const envelope = legacyEnvelopeWithEstadoAtualDetail();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const legacyAnswer = result.value.answers.find(
			(a) => a.activityDefinitionId === 'estado_atual' && a.fieldDefinitionId === 'estado_atual_detail'
		);
		expect(legacyAnswer?.value).toBe('Cada time mantém sua própria planilha.');

		expect(result.value.treatmentSteps).toEqual([]);
		expect(result.value.currentTreatment.noTreatment).toBe(false);

		const estadoAtualProgress = result.value.activityProgress.find(
			(p) => p.activityDefinitionId === 'estado_atual'
		);
		expect(estadoAtualProgress?.status).toBe('concluída');
	});

	it('o fluxo novo a partir desse estado usa só TreatmentStep — estado_atual_detail nunca é reescrita nem lida por nenhuma projeção', () => {
		const envelope = legacyEnvelopeWithEstadoAtualDetail();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const withStep = unwrap(addTreatmentStep(catalog, result.value, 'ts-legacy', 'Novo passo real', T2));
		expect(withStep.treatmentSteps).toEqual([
			{
				id: 'ts-legacy',
				projectId: result.value.project.id,
				order: 0,
				whatHappens: 'Novo passo real',
				actors: [],
				medium: null,
				frictions: [],
				createdAt: T2,
				updatedAt: T2
			}
		]);
		const legacyAnswerStillThere = withStep.answers.find(
			(a) => a.activityDefinitionId === 'estado_atual' && a.fieldDefinitionId === 'estado_atual_detail'
		);
		expect(legacyAnswerStillThere?.value).toBe('Cada time mantém sua própria planilha.');
		expect(legacyAnswerStillThere?.updatedAt).toBe(T1); // nunca reescrita

		// "estado_atual" permanece concluída (adicionar um passo não a torna
		// incompleta — mesmo espírito do teste equivalente de AffectedGroup).
		const estadoAtualProgress = withStep.activityProgress.find((p) => p.activityDefinitionId === 'estado_atual');
		expect(estadoAtualProgress?.status).toBe('concluída');
	});

	it('rejeita estado_atual_detail com projectId diferente do Project', () => {
		const envelope = legacyEnvelopeWithEstadoAtualDetail();
		const legacyAnswer = envelope.state.answers.find((a) => a.fieldDefinitionId === 'estado_atual_detail')!;
		legacyAnswer.projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita estado_atual_detail duplicada', () => {
		const envelope = legacyEnvelopeWithEstadoAtualDetail();
		const legacyAnswer = envelope.state.answers.find((a) => a.fieldDefinitionId === 'estado_atual_detail')!;
		envelope.state.answers.push({ ...legacyAnswer });
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});
});

describe('deserializeProjectState — READ-LEGACY de mudanca/beneficiario/percepcao (snapshot exportado antes do Stage 4C)', () => {
	// Mesmo espírito dos blocos publico_detail/estado_atual_detail acima:
	// simula um export legítimo feito ANTES do Stage 4C — "resultado" era
	// required_fields, o usuário respondeu os três campos e a atividade ficou
	// concluída por esse mecanismo, sem nenhum DesiredOutcome (que não
	// existia ainda). Confirma o contrato central deste corte: um projeto
	// antigo com "resultado" já concluído não é invalidado retroativamente
	// só porque desiredOutcomes está vazio.
	function legacyEnvelopeWithResultadoAnswers(): {
		state: {
			project: { id: string };
			answers: Array<Record<string, unknown>>;
			activityProgress: Array<Record<string, unknown>>;
			desiredOutcomes: unknown[];
		};
	} {
		const envelope = baseEnvelope() as {
			state: {
				project: { id: string };
				answers: Array<Record<string, unknown>>;
				activityProgress: Array<Record<string, unknown>>;
				desiredOutcomes: unknown[];
			};
		};
		envelope.state.answers.push(
			{
				projectId: envelope.state.project.id,
				activityDefinitionId: 'resultado',
				fieldDefinitionId: 'mudanca',
				value: 'Solicitações centralizadas.',
				createdAt: T1,
				updatedAt: T1
			},
			{
				projectId: envelope.state.project.id,
				activityDefinitionId: 'resultado',
				fieldDefinitionId: 'beneficiario',
				value: 'Clientes',
				createdAt: T1,
				updatedAt: T1
			},
			{
				projectId: envelope.state.project.id,
				activityDefinitionId: 'resultado',
				fieldDefinitionId: 'percepcao',
				value: 'Menos retrabalho perceptível.',
				createdAt: T1,
				updatedAt: T1
			}
		);
		const resultadoProgress = envelope.state.activityProgress.find((p) => p.activityDefinitionId === 'resultado')!;
		resultadoProgress.status = 'concluída';
		return envelope;
	}

	it('export/snapshot legado com mudanca/beneficiario/percepcao importa com sucesso (não invalida o projeto inteiro)', () => {
		const envelope = legacyEnvelopeWithResultadoAnswers();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
	});

	it('o dado legado é preservado (READ-LEGACY) mas não cria nenhum DesiredOutcome automaticamente, e a conclusão histórica não é invalidada', () => {
		const envelope = legacyEnvelopeWithResultadoAnswers();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const legacyMudanca = result.value.answers.find(
			(a) => a.activityDefinitionId === 'resultado' && a.fieldDefinitionId === 'mudanca'
		);
		expect(legacyMudanca?.value).toBe('Solicitações centralizadas.');
		const legacyBeneficiario = result.value.answers.find(
			(a) => a.activityDefinitionId === 'resultado' && a.fieldDefinitionId === 'beneficiario'
		);
		expect(legacyBeneficiario?.value).toBe('Clientes');
		const legacyPercepcao = result.value.answers.find(
			(a) => a.activityDefinitionId === 'resultado' && a.fieldDefinitionId === 'percepcao'
		);
		expect(legacyPercepcao?.value).toBe('Menos retrabalho perceptível.');

		expect(result.value.desiredOutcomes).toEqual([]);

		const resultadoProgress = result.value.activityProgress.find((p) => p.activityDefinitionId === 'resultado');
		expect(resultadoProgress?.status).toBe('concluída');
	});

	it('o fluxo novo a partir desse estado usa só DesiredOutcome — mudanca/beneficiario/percepcao nunca são reescritas nem lidas por nenhuma projeção', () => {
		const envelope = legacyEnvelopeWithResultadoAnswers();
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const withOutcome = unwrap(
			addDesiredOutcome(catalog, result.value, 'do-legacy', 'Resultado real, estruturado', T2)
		);
		expect(withOutcome.desiredOutcomes).toEqual([
			{
				id: 'do-legacy',
				projectId: result.value.project.id,
				change: 'Resultado real, estruturado',
				target: null,
				order: 0,
				createdAt: T2,
				updatedAt: T2
			}
		]);
		const legacyMudancaStillThere = withOutcome.answers.find(
			(a) => a.activityDefinitionId === 'resultado' && a.fieldDefinitionId === 'mudanca'
		);
		expect(legacyMudancaStillThere?.value).toBe('Solicitações centralizadas.');
		expect(legacyMudancaStillThere?.updatedAt).toBe(T1); // nunca reescrita

		// "resultado" permanece concluída (adicionar um DesiredOutcome não a
		// torna incompleta — mesmo espírito do teste equivalente de
		// AffectedGroup/CurrentTreatment).
		const resultadoProgress = withOutcome.activityProgress.find((p) => p.activityDefinitionId === 'resultado');
		expect(resultadoProgress?.status).toBe('concluída');
	});

	it('rejeita mudanca com projectId diferente do Project', () => {
		const envelope = legacyEnvelopeWithResultadoAnswers();
		const legacyAnswer = envelope.state.answers.find((a) => a.fieldDefinitionId === 'mudanca')!;
		legacyAnswer.projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita mudanca duplicada', () => {
		const envelope = legacyEnvelopeWithResultadoAnswers();
		const legacyAnswer = envelope.state.answers.find((a) => a.fieldDefinitionId === 'mudanca')!;
		envelope.state.answers.push({ ...legacyAnswer });
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});
});

describe('deserializeProjectState — DesiredOutcome (Stage 4C, "Resultado desejado")', () => {
	function desiredOutcomeState(): ProjectState {
		return unwrap(
			addDesiredOutcome(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'do-1', 'Solicitações centralizadas', T1)
		);
	}

	it('rejeita DesiredOutcome.change vazia', () => {
		const envelope = JSON.parse(serializeProjectState(desiredOutcomeState())) as {
			state: { desiredOutcomes: Array<Record<string, unknown>> };
		};
		envelope.state.desiredOutcomes[0].change = '   ';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita DesiredOutcome com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(desiredOutcomeState())) as {
			state: { desiredOutcomes: Array<Record<string, unknown>> };
		};
		envelope.state.desiredOutcomes[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita order não contíguo começando em 0', () => {
		const withSecond = unwrap(addDesiredOutcome(catalog, desiredOutcomeState(), 'do-2', 'Segundo resultado', T2));
		const envelope = JSON.parse(serializeProjectState(withSecond)) as {
			state: { desiredOutcomes: Array<Record<string, unknown>> };
		};
		envelope.state.desiredOutcomes[1].order = 5;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita "resultado" concluída sem nenhum DesiredOutcome, quando não há Answer legada', () => {
		const envelope = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: { activityProgress: Array<Record<string, unknown>> };
		};
		const resultadoProgress = envelope.state.activityProgress.find((p) => p.activityDefinitionId === 'resultado')!;
		resultadoProgress.status = 'concluída';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});
});

describe('deserializeProjectState — CurrentTreatment / TreatmentStep (Stage 4A, "Como é tratado hoje")', () => {
	function treatmentState(): ProjectState {
		return unwrap(
			addTreatmentStep(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'ts-1', 'Financeiro confere', T1)
		);
	}

	it('rejeita TreatmentStep.whatHappens vazia', () => {
		const envelope = JSON.parse(serializeProjectState(treatmentState())) as {
			state: { treatmentSteps: Array<Record<string, unknown>> };
		};
		envelope.state.treatmentSteps[0].whatHappens = '   ';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita TreatmentStep.frictions com literal fora da união aprovada', () => {
		const envelope = JSON.parse(serializeProjectState(treatmentState())) as {
			state: { treatmentSteps: Array<Record<string, unknown>> };
		};
		envelope.state.treatmentSteps[0].frictions = ['inventado'];
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita TreatmentStep com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(treatmentState())) as {
			state: { treatmentSteps: Array<Record<string, unknown>> };
		};
		envelope.state.treatmentSteps[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita TreatmentStep.id duplicado', () => {
		const envelope = JSON.parse(serializeProjectState(treatmentState())) as {
			state: { treatmentSteps: unknown[] };
		};
		envelope.state.treatmentSteps.push(envelope.state.treatmentSteps[0]);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita treatmentSteps sem order contíguo começando em 0', () => {
		const envelope = JSON.parse(serializeProjectState(treatmentState())) as {
			state: { treatmentSteps: Array<Record<string, unknown>> };
		};
		envelope.state.treatmentSteps[0].order = 3;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita currentTreatment.noTreatment true com treatmentSteps ativos (invariante mutuamente exclusiva)', () => {
		const envelope = JSON.parse(serializeProjectState(treatmentState())) as {
			state: { currentTreatment: Record<string, unknown> };
		};
		envelope.state.currentTreatment.noTreatment = true;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita currentTreatment com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(treatmentState())) as {
			state: { currentTreatment: Record<string, unknown> };
		};
		envelope.state.currentTreatment.projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('aceita "estado_atual" concluída quando o tratamento atende aos critérios de confirmação (passos ou noTreatment)', () => {
		const state = unwrap(confirmTreatment(catalog, treatmentState(), T2));
		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });

		const noneState = unwrap(
			confirmTreatment(
				catalog,
				unwrap(setTreatmentNoTreatment(catalog, createInitialProjectState(catalog, 'proj-2', T1), true, T1)),
				T2
			)
		);
		const noneResult = deserializeProjectState(serializeProjectState(noneState), catalog);
		expect(noneResult).toEqual({ ok: true, value: noneState });
	});

	it('rejeita "estado_atual" concluída quando o tratamento não atende aos critérios de confirmação', () => {
		const envelope = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: { activityProgress: Array<Record<string, unknown>> };
		};
		const estadoAtual = envelope.state.activityProgress.find((p) => p.activityDefinitionId === 'estado_atual')!;
		estadoAtual.status = 'concluída';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});
});

describe('deserializeProjectState — compatibilidade com JSONs anteriores ao Stage 4B (sem causeExploration/causeHypotheses)', () => {
	it('trata state.causeExploration ausente como { stillUnknown: false } e causeHypotheses ausente como []', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		delete envelope.state.causeExploration;
		delete envelope.state.causeHypotheses;
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.causeExploration).toEqual({
			projectId: result.value.project.id,
			stillUnknown: false,
			updatedAt: result.value.project.createdAt
		});
		expect(result.value.causeHypotheses).toEqual([]);
	});

	it('continua rejeitando state.causeHypotheses: null', () => {
		const envelope = baseEnvelope() as { state: Record<string, unknown> };
		envelope.state.causeHypotheses = null;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('deserializeProjectState — CauseHypothesis / CauseExploration (Stage 4B, "Entender as causas")', () => {
	function hypothesisState(): ProjectState {
		return unwrap(
			addCauseHypothesis(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'ch-1',
				'O aprovador só revisa uma vez por semana',
				null,
				T1
			)
		);
	}

	it('rejeita CauseHypothesis.title vazio', () => {
		const envelope = JSON.parse(serializeProjectState(hypothesisState())) as {
			state: { causeHypotheses: Array<Record<string, unknown>> };
		};
		envelope.state.causeHypotheses[0].title = '   ';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('rejeita CauseHypothesis com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(hypothesisState())) as {
			state: { causeHypotheses: Array<Record<string, unknown>> };
		};
		envelope.state.causeHypotheses[0].projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita CauseHypothesis.id duplicado', () => {
		const envelope = JSON.parse(serializeProjectState(hypothesisState())) as {
			state: { causeHypotheses: unknown[] };
		};
		envelope.state.causeHypotheses.push(envelope.state.causeHypotheses[0]);
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('rejeita CauseHypothesis.evidenceIds referenciando uma Evidence inexistente', () => {
		const envelope = JSON.parse(serializeProjectState(hypothesisState())) as {
			state: { causeHypotheses: Array<Record<string, unknown>> };
		};
		envelope.state.causeHypotheses[0].evidenceIds = ['ev-inexistente'];
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('rejeita causeExploration com projectId diferente do Project', () => {
		const envelope = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: { causeExploration: Record<string, unknown> };
		};
		envelope.state.causeExploration.projectId = 'outro-projeto';
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('round-trip preserva stillUnknown e as hipóteses (nunca bloqueia conclusão, mesmo com zero hipóteses)', () => {
		const marked = unwrap(markCauseExplorationUnknown(catalog, createInitialProjectState(catalog, 'proj-1', T1), T1));
		const result = deserializeProjectState(serializeProjectState(marked), catalog);
		expect(result).toEqual({ ok: true, value: marked });

		const withHypothesis = hypothesisState();
		const resultWithHypothesis = deserializeProjectState(serializeProjectState(withHypothesis), catalog);
		expect(resultWithHypothesis).toEqual({ ok: true, value: withHypothesis });
	});
});

// Event log incremental (ETAPA 7 do rework) — parser independente de
// deserializeProjectState (ver comentário em serialization.ts): events é um
// campo irmão de state no mesmo envelope, nunca parte de ProjectState.
describe('deserializeProjectEvents', () => {
	const workItemCreated: ProjectEvent = {
		id: 'evt-1',
		projectId: 'proj-1',
		type: 'work_item.created',
		entityType: 'work_item',
		entityId: 'wi-1',
		payload: { title: 'Revisar contrato' },
		createdAt: T1
	};

	it('round-trip: serializeProjectState(state, events) → deserializeProjectEvents preserva os eventos', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const json = serializeProjectState(state, [workItemCreated]);
		expect(deserializeProjectEvents(json)).toEqual({ ok: true, value: [workItemCreated] });
	});

	it('JSON sem a chave "events" (export anterior à S7) produz []', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const envelope = JSON.parse(serializeProjectState(state)) as { events?: unknown };
		delete envelope.events;
		expect(deserializeProjectEvents(JSON.stringify(envelope))).toEqual({ ok: true, value: [] });
	});

	it('rejeita JSON inválido', () => {
		expect(deserializeProjectEvents('não é json {{')).toEqual({ ok: false, error: { kind: 'invalid_json' } });
	});

	it('rejeita um type fora da taxonomia fechada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const envelope = JSON.parse(serializeProjectState(state, [workItemCreated])) as {
			events: Array<Record<string, unknown>>;
		};
		envelope.events[0].type = 'work_item.deleted';
		const result = deserializeProjectEvents(JSON.stringify(envelope));
		expect(result.ok).toBe(false);
	});

	it('rejeita payload incompatível com o type declarado', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const envelope = JSON.parse(serializeProjectState(state, [workItemCreated])) as {
			events: Array<{ payload: Record<string, unknown> }>;
		};
		envelope.events[0].payload = { fromStatus: 'a_fazer', toStatus: 'em_andamento' }; // payload de status_changed, type é created
		const result = deserializeProjectEvents(JSON.stringify(envelope));
		expect(result.ok).toBe(false);
	});

	it('serializeProjectState sem segundo argumento continua produzindo events: [] (compatibilidade dos ~125 call sites anteriores à S7)', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const json = serializeProjectState(state);
		expect(deserializeProjectEvents(json)).toEqual({ ok: true, value: [] });
		// e o restante do envelope continua intacto
		expect(deserializeProjectState(json, catalog)).toEqual({ ok: true, value: state });
	});
});

// Decompor o trabalho (S9, D045 — correção de compatibilidade) — D045
// prometeu que partes_trabalho/PlanningItem legado "continuam legíveis em
// Answer, Agora e Registros, e preservados integralmente em export/import",
// mas `decompor_trabalho::partes_trabalho` nunca foi registrado em
// legacy-answers.ts depois que a atividade virou explicit_confirmation —
// falsificador que prova o defeito estava presente (sem a entrada em
// DEPRECATED_ANSWER_FIELDS, este teste falha com result.ok === false) e
// que a correção cumpre exatamente o que D045 já havia decidido, sem
// promover PlanningItem a WorkItem/Deliverable.
describe('Decompor o trabalho (S9, D045 — correção de compatibilidade de partes_trabalho legado)', () => {
	it('snapshot anterior a D045 com Answer legada partes_trabalho continua importável, intacta, sem criar WorkItem/Deliverable', () => {
		const legacyValue = encodePlanningItems([
			{ id: 'p1', text: 'Tela de abertura' },
			{ id: 'p2', text: 'Fluxo de aprovação' }
		]);
		const state: ProjectState = {
			...createInitialProjectState(catalog, 'proj-1', T1),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'decompor_trabalho',
					fieldDefinitionId: 'partes_trabalho',
					value: legacyValue,
					createdAt: T1,
					updatedAt: T1
				}
			]
		};

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Intacto — READ-LEGACY, nunca reescrito.
		expect(
			result.value.answers.find(
				(answer) => answer.activityDefinitionId === 'decompor_trabalho' && answer.fieldDefinitionId === 'partes_trabalho'
			)?.value
		).toBe(legacyValue);
		// Nunca promovido a nenhum objeto canônico — D045 proíbe conversão
		// automática de PlanningItem legado em WorkItem/Deliverable.
		expect(result.value.workItems).toEqual([]);
		expect(result.value.deliverables).toEqual([]);
	});
});

// Dependency (ETAPA 8 do rework) — compatibilidade de leitura e invariantes
// reforçadas contra estado desserializado, mesmo padrão já aplicado a
// WorkItem/Impediment neste arquivo.
// WorkItem.plannedStart/durationDays (ETAPA 12 do rework, "Scheduling e
// Gantt", §42, primeiro microcorte fundacional) — mesmo molde de
// Risk.likelihood/impact: par fechado, ausência em snapshot antigo importa
// como null/null, nunca sintetizado de nenhum outro dado.
describe('WorkItem.plannedStart/durationDays (ETAPA 12 do rework, §42)', () => {
	function stateWithScheduledWorkItem(): ProjectState {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		return state;
	}

	it('preserva o schedule no round-trip completo', () => {
		const state = stateWithScheduledWorkItem();
		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('snapshot anterior a este corte (sem plannedStart/durationDays) importa como null/null', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		const envelope = JSON.parse(serializeProjectState(state)) as { state: { workItems: Record<string, unknown>[] } };
		delete envelope.state.workItems[0].plannedStart;
		delete envelope.state.workItems[0].durationDays;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.workItems[0]).toMatchObject({ plannedStart: null, durationDays: null });
	});

	it('recusa schedule parcial vindo de estado persistido (plannedStart sem durationDays)', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithScheduledWorkItem())) as {
			state: { workItems: Record<string, unknown>[] };
		};
		envelope.state.workItems[0].durationDays = null;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('recusa schedule parcial vindo de estado persistido (durationDays sem plannedStart)', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithScheduledWorkItem())) as {
			state: { workItems: Record<string, unknown>[] };
		};
		envelope.state.workItems[0].plannedStart = null;
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('recusa plannedStart com formato inválido (timestamp completo, dia inexistente)', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithScheduledWorkItem())) as {
			state: { workItems: Record<string, unknown>[] };
		};
		envelope.state.workItems[0].plannedStart = '2026-09-01T00:00:00.000Z';
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('recusa durationDays não inteiro ou menor que 1', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithScheduledWorkItem())) as {
			state: { workItems: Record<string, unknown>[] };
		};
		envelope.state.workItems[0].durationDays = 0;
		expectError(JSON.stringify(envelope), 'invalid_shape');
	});
});

describe('Dependency (ETAPA 8 do rework)', () => {
	function stateWithWorkItems(): ProjectState {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		return state;
	}

	it('preserva as dependências no round-trip completo', () => {
		let state = stateWithWorkItems();
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-2', 'wi-b', 'wi-c', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('snapshot anterior à ETAPA 8 (sem a chave "dependencies") importa como coleção vazia', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		delete envelope.state.dependencies; // simula um export gerado antes da S8

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.dependencies).toEqual([]);
	});

	it('recusa dependência que referencia um WorkItem inexistente', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		envelope.state.dependencies = [
			{ id: 'dep-1', projectId: 'proj-1', workItemId: 'wi-a', dependsOnWorkItemId: 'nao-existe', createdAt: T1 }
		];
		expectError(JSON.stringify(envelope), 'invalid_reference');
	});

	it('recusa auto-dependência e par duplicado vindos de estado persistido', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		envelope.state.dependencies = [
			{ id: 'dep-1', projectId: 'proj-1', workItemId: 'wi-a', dependsOnWorkItemId: 'wi-a', createdAt: T1 }
		];
		expectError(JSON.stringify(envelope), 'invariant_violation');

		envelope.state.dependencies = [
			{ id: 'dep-1', projectId: 'proj-1', workItemId: 'wi-a', dependsOnWorkItemId: 'wi-b', createdAt: T1 },
			{ id: 'dep-2', projectId: 'proj-1', workItemId: 'wi-a', dependsOnWorkItemId: 'wi-b', createdAt: T1 }
		];
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('recusa ciclo direto e ciclo transitivo vindos de estado persistido', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		envelope.state.dependencies = [
			{ id: 'dep-1', projectId: 'proj-1', workItemId: 'wi-a', dependsOnWorkItemId: 'wi-b', createdAt: T1 },
			{ id: 'dep-2', projectId: 'proj-1', workItemId: 'wi-b', dependsOnWorkItemId: 'wi-a', createdAt: T1 }
		];
		expectError(JSON.stringify(envelope), 'invariant_violation');

		envelope.state.dependencies = [
			{ id: 'dep-1', projectId: 'proj-1', workItemId: 'wi-a', dependsOnWorkItemId: 'wi-b', createdAt: T1 },
			{ id: 'dep-2', projectId: 'proj-1', workItemId: 'wi-b', dependsOnWorkItemId: 'wi-c', createdAt: T1 },
			{ id: 'dep-3', projectId: 'proj-1', workItemId: 'wi-c', dependsOnWorkItemId: 'wi-a', createdAt: T1 }
		];
		expectError(JSON.stringify(envelope), 'invariant_violation');
	});

	it('aceita duas dependências que compartilham o mesmo predecessor (não é ciclo)', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		envelope.state.dependencies = [
			{ id: 'dep-1', projectId: 'proj-1', workItemId: 'wi-a', dependsOnWorkItemId: 'wi-c', createdAt: T1 },
			{ id: 'dep-2', projectId: 'proj-1', workItemId: 'wi-b', dependsOnWorkItemId: 'wi-c', createdAt: T1 }
		];
		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
	});

	it('não converte o Answer legado dependencias_trabalho em nenhuma Dependency', () => {
		// S9 (reconciliação de dependências legadas) — `mapear_dependencias` não
		// é mais required_fields (virou explicit_confirmation, ver
		// domain/transitions.ts), então answerActivity recusa escrita nova aqui
		// com wrong_completion_mode. Simula um projeto antigo: Answer legado
		// gravado diretamente no estado, mesmo padrão de transitions.spec.ts.
		const state: ProjectState = {
			...stateWithWorkItems(),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'mapear_dependencias',
					fieldDefinitionId: 'dependencias_trabalho',
					value: 'A depende de B; B depende de C',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.dependencies).toEqual([]);
		// O texto livre continua legível, intacto — READ-LEGACY, nunca promovido.
		expect(
			result.value.answers.find((answer) => answer.fieldDefinitionId === 'dependencias_trabalho')?.value
		).toBe('A depende de B; B depende de C');
	});
});

// Milestone (ETAPA 8 do rework, segundo microcorte) — checkpoint declarado.
// Mesmo molde dos blocos de Dependency/WorkItem acima: round-trip,
// compatibilidade com snapshot anterior ao corte, invariantes de referência e
// a invariante FECHADA do lifecycle (status × reachedAt) reforçada contra
// estado persistido.
describe('Milestone (ETAPA 8 do rework, segundo microcorte)', () => {
	function stateWithWorkItems(): ProjectState {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		return state;
	}

	it('preserva marcos e vínculos no round-trip completo', () => {
		let state = stateWithWorkItems();
		state = unwrap(addMilestone(catalog, state, 'ms-1', 'Fluxo de abertura ponta a ponta', T1));
		state = unwrap(addMilestone(catalog, state, 'ms-2', 'Aprovação completa', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-2', 'ms-1', 'wi-b', T2));
		state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('marco alcançado com trabalho relacionado ainda aberto é estado legítimo', () => {
		let state = stateWithWorkItems();
		state = unwrap(addMilestone(catalog, state, 'ms-1', 'Marco', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));
		state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));
		// wi-a continua 'a_fazer' — a desserialização não pode recusar isso.
		expect(state.workItems.find((item) => item.id === 'wi-a')?.status).toBe('a_fazer');

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.milestones[0].status).toBe('alcancado');
	});

	it('snapshot anterior a este corte (sem as chaves de marco) importa como coleções vazias', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		delete envelope.state.milestones;
		delete envelope.state.milestoneWorkItems;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.milestones).toEqual([]);
		expect(result.value.milestoneWorkItems).toEqual([]);
	});

	it('recusa marco alcançado sem reachedAt e marco aberto com reachedAt', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};

		base.state.milestones = [
			{ id: 'ms-1', projectId: 'proj-1', title: 'M', status: 'alcancado', reachedAt: null, createdAt: T1, updatedAt: T1 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');

		base.state.milestones = [
			{ id: 'ms-1', projectId: 'proj-1', title: 'M', status: 'aberto', reachedAt: T2, createdAt: T1, updatedAt: T1 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	it('recusa vínculo órfão e par (marco, trabalho) duplicado vindos de estado persistido', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.milestones = [
			{ id: 'ms-1', projectId: 'proj-1', title: 'M', status: 'aberto', reachedAt: null, createdAt: T1, updatedAt: T1 }
		];

		base.state.milestoneWorkItems = [
			{ id: 'mwi-1', projectId: 'proj-1', milestoneId: 'ms-1', workItemId: 'nao-existe', createdAt: T1 }
		];
		expectError(JSON.stringify(base), 'invalid_reference');

		base.state.milestoneWorkItems = [
			{ id: 'mwi-1', projectId: 'proj-1', milestoneId: 'nao-existe', workItemId: 'wi-a', createdAt: T1 }
		];
		expectError(JSON.stringify(base), 'invalid_reference');

		base.state.milestoneWorkItems = [
			{ id: 'mwi-1', projectId: 'proj-1', milestoneId: 'ms-1', workItemId: 'wi-a', createdAt: T1 },
			{ id: 'mwi-2', projectId: 'proj-1', milestoneId: 'ms-1', workItemId: 'wi-a', createdAt: T2 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	// plannedDate (microcorte de Timeline) — o snapshot anterior ao corte não
	// tem a chave, e "sem chave" significa marco SEM data planejada. Nenhuma
	// data é sintetizada de createdAt nem inferida de texto legado.
	it('marco de snapshot anterior, sem a chave plannedDate, importa com data nula', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.milestones = [
			{ id: 'ms-1', projectId: 'proj-1', title: 'M', status: 'aberto', reachedAt: null, createdAt: T1, updatedAt: T1 }
		];

		const result = deserializeProjectState(JSON.stringify(base), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.milestones[0].plannedDate).toBeNull();
	});

	it('preserva plannedDate no round-trip, sem deslocamento de dia', () => {
		let state = stateWithWorkItems();
		state = unwrap(addMilestone(catalog, state, 'ms-1', 'Marco', T1));
		state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2026-01-01', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
		if (result.ok) expect(result.value.milestones[0].plannedDate).toBe('2026-01-01');
	});

	it('recusa plannedDate persistida que não é dia civil real', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		for (const invalid of ['2026-02-30', '2026-13-01', '2026-09-01T00:00:00.000Z', '01/09/2026']) {
			base.state.milestones = [
				{
					id: 'ms-1',
					projectId: 'proj-1',
					title: 'M',
					status: 'aberto',
					reachedAt: null,
					plannedDate: invalid,
					createdAt: T1,
					updatedAt: T1
				}
			];
			expectError(JSON.stringify(base), 'invalid_shape');
		}
	});

	it('não converte o Answer legado marcos_principais em nenhum Milestone', () => {
		// S9 (reconciliação de marcos legados) — `definir_marcos` não é mais
		// required_fields (virou explicit_confirmation, ver domain/transitions.ts),
		// então answerActivity recusa escrita nova aqui com wrong_completion_mode.
		// Simula um projeto antigo: Answer legado gravado diretamente no estado,
		// mesmo padrão do teste de dependencias_trabalho acima.
		const state: ProjectState = {
			...stateWithWorkItems(),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'definir_marcos',
					fieldDefinitionId: 'marcos_principais',
					value: 'Marco 1: tela de abertura funcionando; Marco 2: fluxo de aprovação completo',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.milestones).toEqual([]);
		expect(result.value.milestoneWorkItems).toEqual([]);
		// O texto livre continua legível, intacto — READ-LEGACY, nunca promovido.
		expect(result.value.answers.find((answer) => answer.fieldDefinitionId === 'marcos_principais')?.value).toBe(
			'Marco 1: tela de abertura funcionando; Marco 2: fluxo de aprovação completo'
		);
	});
});

// ProjectScheduleBaseline/ProjectScheduleBaselineEntry (ETAPA 12 do rework,
// §42, quinto microcorte) — mesmo molde dos blocos de Dependency/Milestone
// acima: round-trip, compatibilidade com snapshot anterior ao corte, e
// invariantes de referência (baselineId/workItemId inexistentes, par
// duplicado) reforçadas contra estado persistido.
describe('ProjectScheduleBaseline (ETAPA 12 do rework, §42, quinto microcorte, hardening pós-dogfood)', () => {
	function stateWithWorkItems(): ProjectState {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		return state;
	}

	function captureWithFreshPreview(state: ProjectState, baselineId: string, occurredAt: string): ProjectState {
		const preview = unwrap(previewScheduleBaselineCapture(state));
		return unwrap(captureScheduleBaseline(catalog, state, baselineId, { entries: preview.entries }, occurredAt));
	}

	it('preserva baseline e entradas no round-trip completo, inclusive entry null/null (WorkItem sem schedule)', () => {
		let state = stateWithWorkItems();
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T1));
		state = captureWithFreshPreview(state, 'baseline-1', T2);

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
		if (result.ok) {
			expect(result.value.scheduleBaselineEntries).toContainEqual({
				baselineId: 'baseline-1',
				workItemId: 'wi-b',
				plannedStart: null,
				durationDays: null
			});
		}
	});

	it('snapshot anterior a este corte (sem as chaves de baseline) importa como coleções vazias', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		delete envelope.state.scheduleBaselines;
		delete envelope.state.scheduleBaselineEntries;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.scheduleBaselines).toEqual([]);
		expect(result.value.scheduleBaselineEntries).toEqual([]);
	});

	it('recusa entrada referenciando baselineId ou workItemId inexistente', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.scheduleBaselines = [{ id: 'baseline-1', projectId: 'proj-1', createdAt: T1, version: 1 }];

		base.state.scheduleBaselineEntries = [
			{ baselineId: 'nao-existe', workItemId: 'wi-a', plannedStart: '2026-09-12', durationDays: 3 }
		];
		expectError(JSON.stringify(base), 'invalid_reference');

		base.state.scheduleBaselineEntries = [
			{ baselineId: 'baseline-1', workItemId: 'nao-existe', plannedStart: '2026-09-12', durationDays: 3 }
		];
		expectError(JSON.stringify(base), 'invalid_reference');
	});

	it('recusa entrada duplicada (mesma baseline, mesmo WorkItem) vinda de estado persistido', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.scheduleBaselines = [{ id: 'baseline-1', projectId: 'proj-1', createdAt: T1, version: 1 }];
		base.state.scheduleBaselineEntries = [
			{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: '2026-09-12', durationDays: 3 },
			{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: '2026-09-14', durationDays: 1 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	it('recusa ProjectScheduleBaseline.id duplicado', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.scheduleBaselines = [
			{ id: 'baseline-1', projectId: 'proj-1', createdAt: T1, version: 1 },
			{ id: 'baseline-1', projectId: 'proj-1', createdAt: T2, version: 2 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	// Hardening pós-dogfood: version prova a ordem real de captura — duas
	// baselines do mesmo projeto nunca podem compartilhar version, mesmo com
	// id/createdAt distintos.
	it('recusa ProjectScheduleBaseline.version duplicada no mesmo projeto', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.scheduleBaselines = [
			{ id: 'baseline-1', projectId: 'proj-1', createdAt: T1, version: 1 },
			{ id: 'baseline-2', projectId: 'proj-1', createdAt: T1, version: 1 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	it('recusa ProjectScheduleBaseline.version menor que 1', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.scheduleBaselines = [{ id: 'baseline-1', projectId: 'proj-1', createdAt: T1, version: 0 }];
		expectError(JSON.stringify(base), 'invalid_shape');
	});

	it('recusa plannedStart persistido que não é dia civil real, e durationDays menor que 1', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.scheduleBaselines = [{ id: 'baseline-1', projectId: 'proj-1', createdAt: T1, version: 1 }];

		base.state.scheduleBaselineEntries = [
			{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: '2026-02-30', durationDays: 3 }
		];
		expectError(JSON.stringify(base), 'invalid_shape');

		base.state.scheduleBaselineEntries = [
			{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: '2026-09-12', durationDays: 0 }
		];
		expectError(JSON.stringify(base), 'invalid_shape');
	});

	// Hardening pós-dogfood: null/null é MEMBERSHIP legítimo (WorkItem
	// existia sem schedule na captura) — só um sozinho é inválido.
	it('aceita entry null/null (membership sem schedule) e recusa schedule parcial (só um dos dois null)', () => {
		const base = JSON.parse(serializeProjectState(stateWithWorkItems())) as {
			state: Record<string, unknown>;
		};
		base.state.scheduleBaselines = [{ id: 'baseline-1', projectId: 'proj-1', createdAt: T1, version: 1 }];

		base.state.scheduleBaselineEntries = [
			{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: null, durationDays: null }
		];
		const result = deserializeProjectState(JSON.stringify(base), catalog);
		expect(result.ok).toBe(true);

		base.state.scheduleBaselineEntries = [
			{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: '2026-09-12', durationDays: null }
		];
		expectError(JSON.stringify(base), 'invariant_violation');

		base.state.scheduleBaselineEntries = [
			{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: null, durationDays: 3 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});
});

describe('Risk (ETAPA 10 do rework, primeiro microcorte, D049; reviewedAt, segundo microcorte)', () => {
	it('preserva riscos no round-trip completo', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addRisk(catalog, state, 'risk-1', 'Baixa adesão da equipe', T1));
		state = unwrap(addRisk(catalog, state, 'risk-2', 'Prazo apertado', T1));
		state = unwrap(editRiskStatement(catalog, state, 'risk-2', 'Prazo muito apertado', T2));
		state = unwrap(closeRisk(catalog, state, 'risk-1', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('criar Risk nasce aberto, sem closedAt e sem revisão', () => {
		const state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco novo', T1)
		);
		expect(state.risks[0]).toMatchObject({ status: 'aberto', closedAt: null, reviewedAt: null });
	});

	it('encerrar/reabrir preserva a invariante do timestamp (idempotente)', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		state = unwrap(closeRisk(catalog, state, 'risk-1', T2));
		expect(state.risks[0].status).toBe('encerrado');
		expect(state.risks[0].closedAt).toBe(T2);

		// Idempotente: encerrar de novo não reescreve closedAt.
		const closedAgain = unwrap(closeRisk(catalog, state, 'risk-1', '2026-03-01T00:00:00.000Z'));
		expect(closedAgain.risks[0].closedAt).toBe(T2);

		state = unwrap(reopenRisk(catalog, state, 'risk-1', T2));
		expect(state.risks[0].status).toBe('aberto');
		expect(state.risks[0].closedAt).toBeNull();
	});

	it('editar a declaração nunca altera status/closedAt', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		state = unwrap(closeRisk(catalog, state, 'risk-1', T2));
		state = unwrap(editRiskStatement(catalog, state, 'risk-1', 'Risco reformulado', '2026-03-01T00:00:00.000Z'));
		expect(state.risks[0]).toMatchObject({
			statement: 'Risco reformulado',
			status: 'encerrado',
			closedAt: T2
		});
	});

	it('reviewRisk define reviewedAt sem alterar statement/status/closedAt', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		state = unwrap(reviewRisk(catalog, state, 'risk-1', T2));
		expect(state.risks[0]).toMatchObject({
			statement: 'Risco',
			status: 'aberto',
			closedAt: null,
			reviewedAt: T2
		});
	});

	it('editar a declaração de verdade também conta como revisão; o no-op (mesma declaração) não', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		state = unwrap(editRiskStatement(catalog, state, 'risk-1', 'Risco reformulado', T2));
		expect(state.risks[0].reviewedAt).toBe(T2);

		const noop = unwrap(editRiskStatement(catalog, state, 'risk-1', 'Risco reformulado', '2026-03-01T00:00:00.000Z'));
		expect(noop.risks[0].reviewedAt).toBe(T2);
		expect(noop).toBe(state);
	});

	it('encerrar/reabrir uma transição real também conta como revisão', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		expect(state.risks[0].reviewedAt).toBeNull();

		state = unwrap(closeRisk(catalog, state, 'risk-1', T2));
		expect(state.risks[0]).toMatchObject({ status: 'encerrado', closedAt: T2, reviewedAt: T2 });

		state = unwrap(reopenRisk(catalog, state, 'risk-1', '2026-03-01T00:00:00.000Z'));
		expect(state.risks[0]).toMatchObject({
			status: 'aberto',
			closedAt: null,
			reviewedAt: '2026-03-01T00:00:00.000Z'
		});
	});

	it('encerrar/reabrir já encerrado/já aberto é no-op e não reescreve reviewedAt', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		state = unwrap(closeRisk(catalog, state, 'risk-1', T2));

		const closedAgain = unwrap(closeRisk(catalog, state, 'risk-1', '2026-03-01T00:00:00.000Z'));
		expect(closedAgain).toBe(state);
		expect(closedAgain.risks[0].reviewedAt).toBe(T2);
	});

	it('checkpoints (confirmRiskIdentification/confirmRiskUpdate) nunca alteram reviewedAt de nenhum Risk', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		expect(state.risks[0].reviewedAt).toBeNull();

		state = unwrap(confirmRiskIdentification(catalog, state, T2));
		expect(state.risks[0].reviewedAt).toBeNull();

		state = unwrap(confirmRiskUpdate(catalog, state, '2026-03-01T00:00:00.000Z'));
		expect(state.risks[0].reviewedAt).toBeNull();
	});

	it('snapshot anterior a este microcorte (Risk sem reviewedAt) importa reviewedAt como null', () => {
		const base = JSON.parse(
			serializeProjectState(
				unwrap(addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1))
			)
		) as { state: Record<string, unknown> };
		const risks = base.state.risks as Array<Record<string, unknown>>;
		delete risks[0].reviewedAt;

		const result = deserializeProjectState(JSON.stringify(base), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.risks[0].reviewedAt).toBeNull();
	});

	it('zero Risk é estado legítimo — confirmRiskIdentification nunca exige nenhum', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(state.risks).toEqual([]);
		const result = confirmRiskIdentification(catalog, state, T1);
		expect(result.ok).toBe(true);
	});

	it('snapshot anterior a este corte (sem a chave risks) importa como coleção vazia', () => {
		const envelope = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: Record<string, unknown>;
		};
		delete envelope.state.risks;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.risks).toEqual([]);
	});

	it('recusa risco encerrado sem closedAt e risco aberto com closedAt', () => {
		const base = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: Record<string, unknown>;
		};

		base.state.risks = [
			{ id: 'risk-1', projectId: 'proj-1', statement: 'R', status: 'encerrado', closedAt: null, createdAt: T1, updatedAt: T1 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');

		base.state.risks = [
			{ id: 'risk-1', projectId: 'proj-1', statement: 'R', status: 'aberto', closedAt: T2, createdAt: T1, updatedAt: T1 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	it('não converte os Answers legados de riscos em nenhum Risk (riscos_projeto e atualizar_riscos)', () => {
		// S10 (D049) — `riscos_projeto`/`atualizar_riscos` não são mais
		// required_fields (viraram explicit_confirmation, ver
		// domain/transitions.ts), então answerActivity recusa escrita nova aqui
		// com wrong_completion_mode. Simula um projeto antigo: três Answers
		// legadas gravadas diretamente no estado, mesmo padrão do teste de
		// marcos_principais acima.
		const state: ProjectState = {
			...createInitialProjectState(catalog, 'proj-1', T1),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'riscos_projeto',
					fieldDefinitionId: 'riscos_identificados',
					value: 'Baixa adesão da equipe',
					createdAt: T1,
					updatedAt: T1
				},
				{
					projectId: 'proj-1',
					activityDefinitionId: 'riscos_projeto',
					fieldDefinitionId: 'resposta_inicial_riscos',
					value: 'Envolver a equipe cedo',
					createdAt: T1,
					updatedAt: T1
				},
				{
					projectId: 'proj-1',
					activityDefinitionId: 'atualizar_riscos',
					fieldDefinitionId: 'riscos_atualizados',
					value: 'Risco de adesão diminuiu',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.risks).toEqual([]);
		expect(
			result.value.answers.find((answer) => answer.fieldDefinitionId === 'riscos_identificados')?.value
		).toBe('Baixa adesão da equipe');
		expect(
			result.value.answers.find((answer) => answer.fieldDefinitionId === 'resposta_inicial_riscos')?.value
		).toBe('Envolver a equipe cedo');
		expect(
			result.value.answers.find((answer) => answer.fieldDefinitionId === 'riscos_atualizados')?.value
		).toBe('Risco de adesão diminuiu');
	});
});

describe('Risk — avaliação qualitativa e resposta planejada (ETAPA 10 do rework, terceiro microcorte)', () => {
	it('Risk novo nasce sem avaliação e sem resposta', () => {
		const state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		expect(state.risks[0]).toMatchObject({ likelihood: null, impact: null, response: null });
	});

	it('avaliação só aceita o par completo — likelihood ou impact sozinho é recusado', () => {
		const state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		expect(setRiskAssessment(catalog, state, 'risk-1', 'alta', null, T2)).toEqual({
			ok: false,
			error: { kind: 'risk_assessment_incomplete' }
		});
		expect(setRiskAssessment(catalog, state, 'risk-1', null, 'alto', T2)).toEqual({
			ok: false,
			error: { kind: 'risk_assessment_incomplete' }
		});
	});

	it('definir, alterar e limpar a avaliação atualiza reviewedAt e updatedAt; no-op preserva ambos', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);

		state = unwrap(setRiskAssessment(catalog, state, 'risk-1', 'baixa', 'alto', T2));
		expect(state.risks[0]).toMatchObject({
			likelihood: 'baixa',
			impact: 'alto',
			reviewedAt: T2,
			updatedAt: T2
		});

		const noop = unwrap(setRiskAssessment(catalog, state, 'risk-1', 'baixa', 'alto', '2026-03-01T00:00:00.000Z'));
		expect(noop).toBe(state);

		state = unwrap(setRiskAssessment(catalog, state, 'risk-1', 'alta', 'baixo', '2026-03-02T00:00:00.000Z'));
		expect(state.risks[0]).toMatchObject({
			likelihood: 'alta',
			impact: 'baixo',
			reviewedAt: '2026-03-02T00:00:00.000Z'
		});

		const cleared = unwrap(setRiskAssessment(catalog, state, 'risk-1', null, null, '2026-03-03T00:00:00.000Z'));
		expect(cleared.risks[0]).toMatchObject({
			likelihood: null,
			impact: null,
			reviewedAt: '2026-03-03T00:00:00.000Z'
		});
	});

	it('definir, alterar e limpar a resposta atualiza reviewedAt e updatedAt; no-op preserva ambos', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);

		state = unwrap(setRiskResponse(catalog, state, 'risk-1', 'Envolver a equipe cedo', T2));
		expect(state.risks[0]).toMatchObject({ response: 'Envolver a equipe cedo', reviewedAt: T2, updatedAt: T2 });

		const noop = unwrap(
			setRiskResponse(catalog, state, 'risk-1', 'Envolver a equipe cedo', '2026-03-01T00:00:00.000Z')
		);
		expect(noop).toBe(state);

		const cleared = unwrap(setRiskResponse(catalog, state, 'risk-1', null, '2026-03-02T00:00:00.000Z'));
		expect(cleared.risks[0]).toMatchObject({ response: null, reviewedAt: '2026-03-02T00:00:00.000Z' });
	});

	it('avaliação e resposta nunca alteram status/closedAt', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		state = unwrap(closeRisk(catalog, state, 'risk-1', T2));
		state = unwrap(setRiskAssessment(catalog, state, 'risk-1', 'media', 'medio', '2026-03-01T00:00:00.000Z'));
		state = unwrap(setRiskResponse(catalog, state, 'risk-1', 'Plano de resposta', '2026-03-02T00:00:00.000Z'));
		expect(state.risks[0]).toMatchObject({ status: 'encerrado', closedAt: T2 });
	});

	it('preserva avaliação e resposta no round-trip', () => {
		let state = unwrap(
			addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1)
		);
		state = unwrap(setRiskAssessment(catalog, state, 'risk-1', 'alta', 'alto', T2));
		state = unwrap(setRiskResponse(catalog, state, 'risk-1', 'Plano de resposta', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('snapshot anterior a este microcorte (Risk sem likelihood/impact/response) importa os três como null', () => {
		const base = JSON.parse(
			serializeProjectState(
				unwrap(addRisk(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'risk-1', 'Risco', T1))
			)
		) as { state: Record<string, unknown> };
		const risks = base.state.risks as Array<Record<string, unknown>>;
		delete risks[0].likelihood;
		delete risks[0].impact;
		delete risks[0].response;

		const result = deserializeProjectState(JSON.stringify(base), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.risks[0]).toMatchObject({ likelihood: null, impact: null, response: null });
	});

	it('recusa avaliação parcial na desserialização (likelihood/impact devem ser ambos null ou ambos preenchidos)', () => {
		const base = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: Record<string, unknown>;
		};

		base.state.risks = [
			{
				id: 'risk-1',
				projectId: 'proj-1',
				statement: 'R',
				status: 'aberto',
				closedAt: null,
				reviewedAt: null,
				likelihood: 'alta',
				impact: null,
				response: null,
				createdAt: T1,
				updatedAt: T1
			}
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});
});

describe('Decision (ETAPA 11 do rework, primeiro microcorte, §41)', () => {
	it('preserva decisões no round-trip completo', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		state = unwrap(editDecision(catalog, state, 'dec-1', 'Adiar o SMS?', 'A ou B', '2026-02-01', 'Ana', T2));
		state = unwrap(decideDecision(catalog, state, 'dec-1', 'Adiado', T2));
		state = unwrap(addDecision(catalog, state, 'dec-2', 'Trocar de fornecedor?', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('snapshot anterior a este corte (sem a chave decisions) importa como coleção vazia', () => {
		const envelope = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: Record<string, unknown>;
		};
		delete envelope.state.decisions;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.decisions).toEqual([]);
	});

	// responsible — ETAPA 11 do rework, quarto microcorte, §41.
	it('Decision.responsible ausente (snapshot anterior a este corte) importa como null', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		const envelope = JSON.parse(serializeProjectState(state)) as { state: { decisions: Record<string, unknown>[] } };
		delete envelope.state.decisions[0].responsible;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.decisions[0].responsible).toBeNull();
	});

	it('rejeita Decision.responsible que não é string, null ou ausente', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		const envelope = JSON.parse(serializeProjectState(state)) as { state: { decisions: Record<string, unknown>[] } };
		envelope.state.decisions[0].responsible = 42;

		expectError(JSON.stringify(envelope), 'invalid_shape');
	});

	it('zero Decision é estado legítimo — confirmDecisionsAndChangesReview nunca exige nenhuma', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(state.decisions).toEqual([]);
		const result = confirmDecisionsAndChangesReview(catalog, state, T1);
		expect(result.ok).toBe(true);
	});

	it('recusa decisão pendente com outcome/decidedAt e decisão tomada sem outcome/decidedAt', () => {
		const base = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: Record<string, unknown>;
		};

		base.state.decisions = [
			{
				id: 'dec-1',
				projectId: 'proj-1',
				subject: 'S',
				options: null,
				dueDate: null,
				status: 'pendente',
				outcome: 'Resultado indevido',
				decidedAt: null,
				createdAt: T1,
				updatedAt: T1
			}
		];
		expectError(JSON.stringify(base), 'invariant_violation');

		base.state.decisions = [
			{
				id: 'dec-1',
				projectId: 'proj-1',
				subject: 'S',
				options: null,
				dueDate: null,
				status: 'tomada',
				outcome: null,
				decidedAt: null,
				createdAt: T1,
				updatedAt: T1
			}
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	it('recusa dueDate que não é data civil estrita — timestamp ISO completo, mês/dia inexistentes', () => {
		const base = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: Record<string, unknown>;
		};

		for (const dueDate of ['2026-09-01T12:00:00.000Z', '2026-13-01', '2026-02-30']) {
			base.state.decisions = [
				{
					id: 'dec-1',
					projectId: 'proj-1',
					subject: 'S',
					options: null,
					dueDate,
					status: 'pendente',
					outcome: null,
					decidedAt: null,
					createdAt: T1,
					updatedAt: T1
				}
			];
			expectError(JSON.stringify(base), 'invalid_shape');
		}
	});

	it('não converte o Answer legado (decisoes_mudancas_recentes) em nenhuma Decision/Change', () => {
		// S11 (§41) — `decisoes_mudancas` não é mais required_fields (virou
		// explicit_confirmation), então answerActivity recusa escrita nova aqui
		// com wrong_completion_mode. Simula um projeto antigo: Answer legada
		// gravada diretamente no estado, mesmo padrão do teste de riscos acima.
		const state: ProjectState = {
			...createInitialProjectState(catalog, 'proj-1', T1),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'decisoes_mudancas',
					fieldDefinitionId: 'decisoes_mudancas_recentes',
					value: 'Decisão: adiar a notificação por SMS',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.decisions).toEqual([]);
		expect(result.value.changes).toEqual([]);
		expect(
			result.value.answers.find((answer) => answer.fieldDefinitionId === 'decisoes_mudancas_recentes')?.value
		).toBe('Decisão: adiar a notificação por SMS');
	});
});

describe('DecisionAffectedWorkItem (ETAPA 11 do rework, terceiro microcorte, §41)', () => {
	function stateWithDecisionAndWorkItem(): ProjectState {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		return state;
	}

	it('preserva relações no round-trip completo', () => {
		let state = stateWithDecisionAndWorkItem();
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-2', 'dec-1', 'wi-b', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('snapshot anterior a este corte (sem a chave decisionAffectedWorkItems) importa como coleção vazia', () => {
		const envelope = JSON.parse(serializeProjectState(stateWithDecisionAndWorkItem())) as {
			state: Record<string, unknown>;
		};
		delete envelope.state.decisionAffectedWorkItems;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.decisionAffectedWorkItems).toEqual([]);
	});

	it('recusa referência inválida e par (decisão, trabalho) duplicado vindos de estado persistido', () => {
		const base = JSON.parse(serializeProjectState(stateWithDecisionAndWorkItem())) as {
			state: Record<string, unknown>;
		};

		base.state.decisionAffectedWorkItems = [
			{ id: 'dwi-1', projectId: 'proj-1', decisionId: 'nao-existe', workItemId: 'wi-a', createdAt: T1 }
		];
		expectError(JSON.stringify(base), 'invalid_reference');

		base.state.decisionAffectedWorkItems = [
			{ id: 'dwi-1', projectId: 'proj-1', decisionId: 'dec-1', workItemId: 'nao-existe', createdAt: T1 }
		];
		expectError(JSON.stringify(base), 'invalid_reference');

		base.state.decisionAffectedWorkItems = [
			{ id: 'dwi-1', projectId: 'proj-1', decisionId: 'dec-1', workItemId: 'wi-a', createdAt: T1 },
			{ id: 'dwi-2', projectId: 'proj-1', decisionId: 'dec-1', workItemId: 'wi-a', createdAt: T2 }
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});
});

describe('Change (ETAPA 11 do rework, primeiro microcorte, §41)', () => {
	it('preserva mudanças no round-trip completo', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addChange(catalog, state, 'chg-1', 'Trocou o fornecedor de e-mail', T1));
		state = unwrap(setChangeImpact(catalog, state, 'chg-1', 'Atraso de 2 dias', T2));
		state = unwrap(editChangeStatement(catalog, state, 'chg-1', 'Trocou o fornecedor de e-mail (v2)', T2));

		const result = deserializeProjectState(serializeProjectState(state), catalog);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('snapshot anterior a este corte (sem a chave changes) importa como coleção vazia', () => {
		const envelope = JSON.parse(serializeProjectState(createInitialProjectState(catalog, 'proj-1', T1))) as {
			state: Record<string, unknown>;
		};
		delete envelope.state.changes;

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.changes).toEqual([]);
	});
});

describe('Deliverable (ETAPA 9 do rework)', () => {
	function stateWithDeliverables(): ProjectState {
		let state = nonTrivialState();
		state = unwrap(addDeliverable(catalog, state, 'del-1', 'Portal de autoatendimento', 'agora', T2));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'del-2', 'scope-1', T2));
		state = unwrap(addDeliverable(catalog, state, 'del-3', 'Relatórios', 'fora', T2));
		return state;
	}

	it('round-trip preserva entregas nativas e promovidas', () => {
		const original = stateWithDeliverables();
		const result = deserializeProjectState(serializeProjectState(original), catalog);
		expect(result).toEqual({ ok: true, value: original });
	});

	it('snapshot anterior a este corte (sem a chave deliverables) importa como coleção vazia', () => {
		const envelope = JSON.parse(serializeProjectState(nonTrivialState())) as {
			version: number;
			state: Record<string, unknown>;
		};
		delete envelope.state.deliverables;
		// Campo aditivo opcional: o envelope permanece version 1.
		expect(envelope.version).toBe(1);

		const result = deserializeProjectState(JSON.stringify(envelope), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.deliverables).toEqual([]);
		// Nenhum ScopeItem foi convertido na leitura.
		expect(result.value.scopeItems).toEqual(nonTrivialState().scopeItems);
	});

	it('recusa duas entregas com o mesmo sourceScopeItemId', () => {
		const base = JSON.parse(serializeProjectState(nonTrivialState())) as {
			state: Record<string, unknown>;
		};
		base.state.deliverables = [
			{
				id: 'del-1',
				projectId: 'proj-1',
				title: 'A',
				bucket: 'depois',
				effort: null,
				order: null,
				sourceScopeItemId: 'scope-1',
				createdAt: T1,
				updatedAt: T1
			},
			{
				id: 'del-2',
				projectId: 'proj-1',
				title: 'B',
				bucket: 'depois',
				effort: null,
				order: null,
				sourceScopeItemId: 'scope-1',
				createdAt: T1,
				updatedAt: T1
			}
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});

	it('aceita proveniência órfã: sourceScopeItemId sem ScopeItem correspondente', () => {
		const base = JSON.parse(serializeProjectState(nonTrivialState())) as {
			state: Record<string, unknown>;
		};
		base.state.deliverables = [
			{
				id: 'del-1',
				projectId: 'proj-1',
				title: 'Origem removida',
				bucket: 'depois',
				effort: 'medio',
				order: null,
				sourceScopeItemId: 'scope-que-nao-existe-mais',
				createdAt: T1,
				updatedAt: T1
			}
		];

		const result = deserializeProjectState(JSON.stringify(base), catalog);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.deliverables[0].sourceScopeItemId).toBe('scope-que-nao-existe-mais');
	});

	it('recusa order fora de "agora" e "agora" sem order contíguo', () => {
		const base = JSON.parse(serializeProjectState(nonTrivialState())) as {
			state: Record<string, unknown>;
		};

		base.state.deliverables = [
			{
				id: 'del-1',
				projectId: 'proj-1',
				title: 'A',
				bucket: 'depois',
				effort: null,
				order: 0,
				sourceScopeItemId: null,
				createdAt: T1,
				updatedAt: T1
			}
		];
		expectError(JSON.stringify(base), 'invariant_violation');

		base.state.deliverables = [
			{
				id: 'del-1',
				projectId: 'proj-1',
				title: 'A',
				bucket: 'agora',
				effort: null,
				order: 1,
				sourceScopeItemId: null,
				createdAt: T1,
				updatedAt: T1
			}
		];
		expectError(JSON.stringify(base), 'invariant_violation');
	});
});
