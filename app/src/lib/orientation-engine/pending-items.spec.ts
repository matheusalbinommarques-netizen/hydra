import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, createInitialProjectState, skipActivity } from '$lib/domain';
import { computeOpenPendingItems } from './pending-items';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

describe('computeOpenPendingItems (Trilha B)', () => {
	it('é vazia num projeto novo', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computeOpenPendingItems(catalog, state.pendingItems)).toEqual([]);
	});

	it('expõe a pendência criada ao pular, com label/detail do catálogo', () => {
		const state = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const origemDef = catalog.phases[0].activities.find((a) => a.id === 'origem')!;
		if (origemDef.completionMode !== 'required_fields') throw new Error('esperado required_fields');

		expect(computeOpenPendingItems(catalog, state.pendingItems)).toEqual([
			{
				id: 'pend-1',
				activityDefinitionId: 'origem',
				label: origemDef.pendingItemLabel,
				detail: origemDef.pendingItemDetail
			}
		]);
	});

	it('deixa de listar a pendência assim que ela é resolvida', () => {
		const skipped = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const resolved = unwrap(answerActivity(catalog, skipped, 'origem', { origem: 'x' }, T2));
		expect(computeOpenPendingItems(catalog, resolved.pendingItems)).toEqual([]);
	});

	it('nunca inclui uma pendência já resolvida mesmo que ela ainda esteja no conjunto', () => {
		const skipped = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		const resolved = unwrap(answerActivity(catalog, skipped, 'origem', { origem: 'x' }, T2));
		expect(resolved.pendingItems).toHaveLength(1); // continua no conjunto, só não é "aberta"
		expect(computeOpenPendingItems(catalog, resolved.pendingItems)).toHaveLength(0);
	});
});
