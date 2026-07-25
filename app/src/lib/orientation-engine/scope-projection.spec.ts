import { describe, expect, it } from 'vitest';
import type { ScopeItem, ScopeVersion } from '$lib/domain';
import { computeScopeProjection } from './scope-projection';

const T1 = '2026-01-01T00:00:00.000Z';

function makeItem(overrides: Partial<ScopeItem> & Pick<ScopeItem, 'id' | 'bucket'>): ScopeItem {
	return {
		id: overrides.id,
		projectId: 'proj-1',
		text: overrides.text ?? `Item ${overrides.id}`,
		bucket: overrides.bucket,
		value: overrides.value ?? null,
		effort: overrides.effort ?? null,
		order: overrides.order ?? null,
		createdAt: T1,
		updatedAt: T1
	};
}

function makeVersion(overrides: Partial<ScopeVersion> = {}): ScopeVersion {
	return { projectId: 'proj-1', hypothesis: '', confirmedAt: null, ...overrides };
}

describe('computeScopeProjection', () => {
	it('agrupa itens por bucket, ordenando "agora" por order', () => {
		const items: ScopeItem[] = [
			makeItem({ id: 'a', bucket: 'agora', order: 1, value: 'alto', effort: 'pequeno' }),
			makeItem({ id: 'b', bucket: 'agora', order: 0, value: 'baixo', effort: 'medio' }),
			makeItem({ id: 'c', bucket: 'depois' }),
			makeItem({ id: 'd', bucket: 'fora' })
		];
		const projection = computeScopeProjection(items, makeVersion({ hypothesis: 'Minha hipótese' }));

		expect(projection.agora.map((i) => i.id)).toEqual(['b', 'a']);
		expect(projection.depois.map((i) => i.id)).toEqual(['c']);
		expect(projection.fora.map((i) => i.id)).toEqual(['d']);
		expect(projection.hypothesis).toBe('Minha hipótese');
	});

	it('sem alerta com poucos itens de esforço pesado em agora', () => {
		const items: ScopeItem[] = [
			makeItem({ id: 'a', bucket: 'agora', order: 0, effort: 'grande' }),
			makeItem({ id: 'b', bucket: 'agora', order: 1, effort: 'medio' })
		];
		const projection = computeScopeProjection(items, makeVersion());
		expect(projection.alert).toEqual({ triggered: false, message: null });
	});

	it('dispara alerta com mais de 5 itens de esforço médio/grande em agora', () => {
		const items: ScopeItem[] = Array.from({ length: 6 }, (_, i) =>
			makeItem({ id: `item-${i}`, bucket: 'agora', order: i, effort: i % 2 === 0 ? 'medio' : 'grande' })
		);
		const projection = computeScopeProjection(items, makeVersion());
		expect(projection.alert.triggered).toBe(true);
		expect(projection.alert.message).toContain('6 itens');
	});

	it('esforço "pequeno" nunca conta para o alerta', () => {
		const items: ScopeItem[] = Array.from({ length: 8 }, (_, i) =>
			makeItem({ id: `item-${i}`, bucket: 'agora', order: i, effort: 'pequeno' })
		);
		const projection = computeScopeProjection(items, makeVersion());
		expect(projection.alert.triggered).toBe(false);
	});

	it('itens fora de agora nunca contam para o alerta', () => {
		const items: ScopeItem[] = Array.from({ length: 8 }, (_, i) =>
			makeItem({ id: `item-${i}`, bucket: 'depois', effort: 'grande' })
		);
		const projection = computeScopeProjection(items, makeVersion());
		expect(projection.alert.triggered).toBe(false);
	});
});
