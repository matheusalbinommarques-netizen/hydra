// Falsificadores da ETAPA 9 do rework (Deliverable + CONFIRM-TO-CONVERT).
// Concentrados num arquivo próprio porque o que está sob teste aqui não é o
// escopo (transitions.spec.ts) e sim a INDEPENDÊNCIA entre as duas camadas.

import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';
import {
	addDeliverable,
	addScopeItem,
	confirmScopeVersion,
	moveDeliverable,
	promoteScopeItemToDeliverable,
	removeDeliverable,
	removeScopeItem,
	reorderDeliverables,
	setDeliverableEffort,
	setDeliverableTitle,
	setHypothesis,
	setScopeItemEffort,
	setScopeItemText
} from './transitions';
import { deserializeProjectState, serializeProjectState } from './serialization';
import type { ProjectState } from './state-types';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function freshState(): ProjectState {
	return createInitialProjectState(catalog, 'proj-1', T1);
}

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperava sucesso, veio erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

function expectError(result: { ok: boolean; error?: unknown }, kind: string) {
	expect(result.ok).toBe(false);
	expect((result.error as { kind: string }).kind).toBe(kind);
}

function agoraOrders(state: ProjectState): [string, number | null][] {
	return state.deliverables
		.filter((deliverable) => deliverable.bucket === 'agora')
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map((deliverable) => [deliverable.title, deliverable.order]);
}

/** Estado com três itens de escopo em "agora", orders 0, 1 e 2. */
function stateWithScope(): ProjectState {
	let state = unwrap(addScopeItem(catalog, freshState(), 'scope-0', 'Zero', 'agora', T1));
	state = unwrap(addScopeItem(catalog, state, 'scope-1', 'Um', 'agora', T1));
	state = unwrap(addScopeItem(catalog, state, 'scope-2', 'Dois', 'agora', T1));
	return state;
}

describe('Deliverable nativa', () => {
	it('nasce com os campos do contrato e nada além deles', () => {
		const state = unwrap(addDeliverable(catalog, freshState(), 'd1', 'Portal', 'agora', T1));
		expect(state.deliverables).toEqual([
			{
				id: 'd1',
				projectId: 'proj-1',
				title: 'Portal',
				bucket: 'agora',
				effort: null,
				order: 0,
				sourceScopeItemId: null,
				createdAt: T1,
				updatedAt: T1
			}
		]);
	});

	it('entrega nativa em "agora" entra no fim; fora de "agora" tem order null', () => {
		let state = unwrap(addDeliverable(catalog, freshState(), 'd1', 'Um', 'agora', T1));
		state = unwrap(addDeliverable(catalog, state, 'd2', 'Dois', 'agora', T1));
		state = unwrap(addDeliverable(catalog, state, 'd3', 'Depois', 'depois', T1));
		expect(agoraOrders(state)).toEqual([
			['Um', 0],
			['Dois', 1]
		]);
		expect(state.deliverables.find((d) => d.id === 'd3')?.order).toBeNull();
	});

	it('editar título e esforço grava o valor e o timestamp', () => {
		let state = unwrap(addDeliverable(catalog, freshState(), 'd1', 'Portal', 'agora', T1));
		state = unwrap(setDeliverableTitle(catalog, state, 'd1', 'Portal v2', T2));
		state = unwrap(setDeliverableEffort(catalog, state, 'd1', 'grande', T2));
		expect(state.deliverables[0].title).toBe('Portal v2');
		expect(state.deliverables[0].effort).toBe('grande');
		expect(state.deliverables[0].updatedAt).toBe(T2);
	});

	it('esforço volta a "ainda não estimado" (null) sem erro', () => {
		let state = unwrap(addDeliverable(catalog, freshState(), 'd1', 'Portal', 'agora', T1));
		state = unwrap(setDeliverableEffort(catalog, state, 'd1', 'medio', T2));
		state = unwrap(setDeliverableEffort(catalog, state, 'd1', null, T2));
		expect(state.deliverables[0].effort).toBeNull();
	});

	it('mover para fora de "agora" recompacta a fila restante', () => {
		let state = unwrap(addDeliverable(catalog, freshState(), 'd1', 'Um', 'agora', T1));
		state = unwrap(addDeliverable(catalog, state, 'd2', 'Dois', 'agora', T1));
		state = unwrap(addDeliverable(catalog, state, 'd3', 'Três', 'agora', T1));
		state = unwrap(moveDeliverable(catalog, state, 'd1', 'fora', T2));
		expect(state.deliverables.find((d) => d.id === 'd1')?.order).toBeNull();
		expect(agoraOrders(state)).toEqual([
			['Dois', 0],
			['Três', 1]
		]);
	});

	it('remover recompacta a fila de "agora"', () => {
		let state = unwrap(addDeliverable(catalog, freshState(), 'd1', 'Um', 'agora', T1));
		state = unwrap(addDeliverable(catalog, state, 'd2', 'Dois', 'agora', T1));
		state = unwrap(addDeliverable(catalog, state, 'd3', 'Três', 'agora', T1));
		state = unwrap(removeDeliverable(catalog, state, 'd2'));
		expect(agoraOrders(state)).toEqual([
			['Um', 0],
			['Três', 1]
		]);
	});

	it('reordenar em "agora" grava a sequência pedida e recusa conjunto diferente', () => {
		let state = unwrap(addDeliverable(catalog, freshState(), 'd1', 'Um', 'agora', T1));
		state = unwrap(addDeliverable(catalog, state, 'd2', 'Dois', 'agora', T1));
		state = unwrap(reorderDeliverables(catalog, state, ['d2', 'd1'], T2));
		expect(agoraOrders(state)).toEqual([
			['Dois', 0],
			['Um', 1]
		]);
		expectError(reorderDeliverables(catalog, state, ['d1'], T2), 'deliverable_reorder_mismatch');
	});

	it('operação sobre entrega inexistente é erro explícito', () => {
		expectError(setDeliverableTitle(catalog, freshState(), 'nope', 'x', T1), 'deliverable_not_found');
		expectError(removeDeliverable(catalog, freshState(), 'nope'), 'deliverable_not_found');
	});
});

describe('CONFIRM-TO-CONVERT', () => {
	it('projeto novo e projeto com escopo abrem com zero entregas — nada é promovido sozinho', () => {
		expect(freshState().deliverables).toEqual([]);
		expect(stateWithScope().deliverables).toEqual([]);
	});

	it('nenhuma leitura cria entrega: serializar e desserializar mantém a coleção vazia', () => {
		const state = stateWithScope();
		const restored = unwrap(deserializeProjectState(serializeProjectState(state), catalog));
		expect(restored.deliverables).toEqual([]);
		expect(restored.scopeItems).toEqual(state.scopeItems);
	});

	it('promoção repetida cria uma única entrega e recusa a segunda tentativa', () => {
		const state = unwrap(promoteScopeItemToDeliverable(catalog, stateWithScope(), 'd1', 'scope-0', T2));
		expect(state.deliverables).toHaveLength(1);
		expectError(
			promoteScopeItemToDeliverable(catalog, state, 'd2', 'scope-0', T2),
			'deliverable_already_promoted'
		);
		expect(state.deliverables).toHaveLength(1);
	});

	it('item "fora" com esforço null vira entrega "fora", esforço null e order null', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'scope-x', 'Fora do recorte', 'fora', T1));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd1', 'scope-x', T2));
		expect(state.deliverables[0]).toMatchObject({
			title: 'Fora do recorte',
			bucket: 'fora',
			effort: null,
			order: null,
			sourceScopeItemId: 'scope-x'
		});
	});

	it('esforço definido atravessa exatamente', () => {
		let state = unwrap(setScopeItemEffort(catalog, stateWithScope(), 'scope-0', 'grande', T1));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd1', 'scope-0', T2));
		expect(state.deliverables[0].effort).toBe('grande');
	});

	it('promover escopo confirmado não altera confirmedAt', () => {
		let state = unwrap(setScopeItemEffort(catalog, stateWithScope(), 'scope-0', 'pequeno', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'scope-1', 'pequeno', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'scope-2', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));
		const confirmedAt = state.scopeVersion.confirmedAt;
		expect(confirmedAt).not.toBeNull();

		const promoted = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd1', 'scope-0', T2));
		expect(promoted.scopeVersion.confirmedAt).toBe(confirmedAt);
	});

	it('sourceSuggestionId e executionStatus não atravessam, e a sugestão continua registrada no escopo', () => {
		let state = unwrap(
			addScopeItem(catalog, freshState(), 'scope-s', 'Da sugestão', 'agora', T1, 'sugestao-42')
		);
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd1', 'scope-s', T2));

		const deliverable = state.deliverables[0] as unknown as Record<string, unknown>;
		expect(Object.keys(deliverable).sort()).toEqual(
			['bucket', 'createdAt', 'effort', 'id', 'order', 'projectId', 'sourceScopeItemId', 'title', 'updatedAt'].sort()
		);
		expect(deliverable.sourceSuggestionId).toBeUndefined();
		expect(deliverable.executionStatus).toBeUndefined();
		expect(state.scopeItems[0].sourceSuggestionId).toBe('sugestao-42');
		expect(state.scopeItems[0].executionStatus).toBe('a_fazer');
	});

	it('editar a entrega deixa o ScopeItem de origem idêntico', () => {
		let state = unwrap(promoteScopeItemToDeliverable(catalog, stateWithScope(), 'd1', 'scope-0', T2));
		const before = structuredClone(state.scopeItems);

		state = unwrap(setDeliverableTitle(catalog, state, 'd1', 'Outro título', T2));
		state = unwrap(setDeliverableEffort(catalog, state, 'd1', 'grande', T2));
		state = unwrap(moveDeliverable(catalog, state, 'd1', 'fora', T2));

		expect(state.scopeItems).toEqual(before);
	});

	it('editar ou remover o ScopeItem depois da promoção não altera a entrega', () => {
		let state = unwrap(promoteScopeItemToDeliverable(catalog, stateWithScope(), 'd1', 'scope-0', T2));
		const before = structuredClone(state.deliverables);

		state = unwrap(setScopeItemText(catalog, state, 'scope-0', 'Texto reescrito', T2));
		state = unwrap(removeScopeItem(catalog, state, 'scope-0'));

		expect(state.deliverables).toEqual(before);
		// Proveniência órfã continua sendo estado válido e persistível.
		expect(state.scopeItems.some((item) => item.id === 'scope-0')).toBe(false);
		expect(unwrap(deserializeProjectState(serializeProjectState(state), catalog)).deliverables).toEqual(before);
	});
});

describe('prioridade relativa na promoção', () => {
	it('ordem relativa de origem sobrevive a promoções fora de ordem (2, 0, 1)', () => {
		let state = stateWithScope();
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd-2', 'scope-2', T2));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd-0', 'scope-0', T2));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd-1', 'scope-1', T2));
		expect(agoraOrders(state)).toEqual([
			['Zero', 0],
			['Um', 1],
			['Dois', 2]
		]);
	});

	it('entregas nativas e promovidas coexistem com orders contíguos', () => {
		let state = unwrap(addDeliverable(catalog, stateWithScope(), 'nativa', 'Nativa', 'agora', T1));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd-2', 'scope-2', T2));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd-0', 'scope-0', T2));
		state = unwrap(addDeliverable(catalog, state, 'nativa-2', 'Nativa 2', 'agora', T2));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'd-1', 'scope-1', T2));

		expect(agoraOrders(state)).toEqual([
			['Nativa', 0],
			['Zero', 1],
			['Um', 2],
			['Dois', 3],
			['Nativa 2', 4]
		]);
	});

	it('order de ScopeItem não é copiada como escalar', () => {
		// scope-2 tem order 2 na origem, mas é a primeira entrega promovida:
		// precisa nascer em 0 para "agora" continuar contíguo.
		const state = unwrap(promoteScopeItemToDeliverable(catalog, stateWithScope(), 'd-2', 'scope-2', T2));
		expect(state.deliverables[0].order).toBe(0);
	});
});
