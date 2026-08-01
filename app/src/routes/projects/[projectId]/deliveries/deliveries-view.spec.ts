import { describe, expect, it } from 'vitest';
import { buildDeliveriesView, type DeliveriesScopeItemInput } from './deliveries-view';

function makeItem(overrides: Partial<DeliveriesScopeItemInput> & Pick<DeliveriesScopeItemInput, 'id'>): DeliveriesScopeItemInput {
	return {
		id: overrides.id,
		text: overrides.text ?? `Item ${overrides.id}`,
		bucket: overrides.bucket ?? 'agora',
		effort: overrides.effort ?? null,
		executionStatus: overrides.executionStatus
	};
}

describe('buildDeliveriesView', () => {
	it('inclui somente itens do bucket agora', () => {
		const items = [
			makeItem({ id: 'a', bucket: 'agora' }),
			makeItem({ id: 'b', bucket: 'depois' }),
			makeItem({ id: 'c', bucket: 'fora' })
		];
		const view = buildDeliveriesView(items, { confirmedAt: '2026-01-01T00:00:00.000Z' });

		expect(view.groups.a_fazer.map((item) => item.id)).toEqual(['a']);
		expect(view.counts.a_fazer).toBe(1);
	});

	it('agrupa itens corretamente nos três estados de execução', () => {
		const items = [
			makeItem({ id: 'a', executionStatus: 'a_fazer' }),
			makeItem({ id: 'b', executionStatus: 'em_andamento' }),
			makeItem({ id: 'c', executionStatus: 'concluido' })
		];
		const view = buildDeliveriesView(items, { confirmedAt: '2026-01-01T00:00:00.000Z' });

		expect(view.groups.a_fazer.map((item) => item.id)).toEqual(['a']);
		expect(view.groups.em_andamento.map((item) => item.id)).toEqual(['b']);
		expect(view.groups.concluido.map((item) => item.id)).toEqual(['c']);
	});

	it('trata executionStatus ausente como a_fazer', () => {
		const items = [makeItem({ id: 'a', executionStatus: undefined })];
		const view = buildDeliveriesView(items, { confirmedAt: '2026-01-01T00:00:00.000Z' });

		expect(view.groups.a_fazer.map((item) => item.id)).toEqual(['a']);
		expect(view.groups.a_fazer[0].executionStatus).toBe('a_fazer');
	});

	it('preserva a ordem original dos itens dentro de cada grupo', () => {
		const items = [
			makeItem({ id: 'c', executionStatus: 'a_fazer' }),
			makeItem({ id: 'a', executionStatus: 'a_fazer' }),
			makeItem({ id: 'b', executionStatus: 'a_fazer' })
		];
		const view = buildDeliveriesView(items, { confirmedAt: '2026-01-01T00:00:00.000Z' });

		expect(view.groups.a_fazer.map((item) => item.id)).toEqual(['c', 'a', 'b']);
	});

	it('fornece a contagem de cada grupo', () => {
		const items = [
			makeItem({ id: 'a', executionStatus: 'a_fazer' }),
			makeItem({ id: 'b', executionStatus: 'a_fazer' }),
			makeItem({ id: 'c', executionStatus: 'em_andamento' })
		];
		const view = buildDeliveriesView(items, { confirmedAt: '2026-01-01T00:00:00.000Z' });

		expect(view.counts).toEqual({ a_fazer: 2, em_andamento: 1, concluido: 0 });
	});

	it('informa versão de escopo não confirmada', () => {
		const view = buildDeliveriesView([], { confirmedAt: null });
		expect(view.confirmed).toBe(false);
	});

	it('informa versão de escopo confirmada sem itens em agora', () => {
		const items = [makeItem({ id: 'a', bucket: 'depois' })];
		const view = buildDeliveriesView(items, { confirmedAt: '2026-01-01T00:00:00.000Z' });

		expect(view.confirmed).toBe(true);
		expect(view.counts).toEqual({ a_fazer: 0, em_andamento: 0, concluido: 0 });
	});
});
