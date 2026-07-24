import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';
import { answerActivity, confirmSummary, skipActivity } from './transitions';
import { deserializeProjectState, serializeProjectState } from './serialization';
import type { ProjectState } from './state-types';
import type { ProjectStateParseError } from './serialization';

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
	state = unwrap(skipActivity(catalog, state, 'contexto', 'pend-1', T1));
	state = unwrap(
		answerActivity(catalog, state, 'publico', { publico_detail: 'Clientes' }, T2)
	);
	state = unwrap(confirmSummary(catalog, state));
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

	it('rejeita o Resumo (explicit_confirmation) com status pulada', () => {
		const envelope = baseEnvelope() as { state: { activityProgress: Array<Record<string, unknown>> } };
		const resumo = envelope.state.activityProgress.find((p) => p.activityDefinitionId === 'resumo')!;
		resumo.status = 'pulada';
		expectError(JSON.stringify(envelope), 'invariant_violation');
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
		const state = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'contexto',
				{ breve_descricao: 'x' },
				T1
			)
		);
		const envelope = JSON.parse(serializeProjectState(state)) as {
			state: { answers: Array<Record<string, unknown>> };
		};
		envelope.state.answers[0].activityDefinitionId = 'contexto';
		envelope.state.answers[0].fieldDefinitionId = 'nome_provisorio';
		expectError(JSON.stringify(envelope), 'invariant_violation');
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
		const state2 = unwrap(skipActivity(catalog, state1, 'contexto', 'pend-1', T1)); // mesmo id, outra atividade
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
