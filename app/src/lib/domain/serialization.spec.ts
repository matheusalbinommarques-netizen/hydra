import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';
import {
	addImpediment,
	addScopeItem,
	answerActivity,
	confirmScopeVersion,
	confirmSummary,
	resolveImpediment,
	setHypothesis,
	setImpedimentNextAction,
	setRouteStartPhase,
	setScopeItemEffort,
	skipActivity
} from './transitions';
import { deserializeProjectState, serializeProjectState } from './serialization';
import { encodePlanningItems } from './planning-items';
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
	state = unwrap(
		answerActivity(catalog, state, 'publico', { publico_detail: 'Clientes' }, T2)
	);
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

	it('C5-01: aceita "Priorizar entregas" (explicit_confirmation, allowsSkip true) com status pulada', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'decompor_trabalho',
				{ partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Parte 1' }]) },
				T1
			)
		);
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
