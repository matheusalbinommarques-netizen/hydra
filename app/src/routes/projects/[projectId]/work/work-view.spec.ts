import { describe, expect, it } from 'vitest';
import { buildWorkView, dependencyPresentation, nextWorkItemStatus, previousWorkItemStatus } from './work-view';
import type { WorkItemDependencyView, WorkItemView } from '$lib/server/application/types';

function makeItem(overrides: Partial<WorkItemView> & Pick<WorkItemView, 'id'>): WorkItemView {
	return {
		id: overrides.id,
		title: overrides.title ?? `Item ${overrides.id}`,
		status: overrides.status ?? 'a_fazer',
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		blockedBy: overrides.blockedBy ?? null,
		dependsOn: overrides.dependsOn ?? []
	};
}

describe('buildWorkView', () => {
	it('fica vazio quando não há itens de trabalho', () => {
		const view = buildWorkView([]);
		expect(view.isEmpty).toBe(true);
		expect(view.counts).toEqual({ a_fazer: 0, em_andamento: 0, concluido: 0 });
	});

	it('agrupa itens corretamente nos três estados operacionais', () => {
		const items = [
			makeItem({ id: 'a', status: 'a_fazer' }),
			makeItem({ id: 'b', status: 'em_andamento' }),
			makeItem({ id: 'c', status: 'concluido' })
		];
		const view = buildWorkView(items);

		expect(view.isEmpty).toBe(false);
		expect(view.groups.a_fazer.map((item) => item.id)).toEqual(['a']);
		expect(view.groups.em_andamento.map((item) => item.id)).toEqual(['b']);
		expect(view.groups.concluido.map((item) => item.id)).toEqual(['c']);
	});

	it('preserva a ordem original dos itens dentro de cada grupo', () => {
		const items = [
			makeItem({ id: 'c', status: 'a_fazer' }),
			makeItem({ id: 'a', status: 'a_fazer' }),
			makeItem({ id: 'b', status: 'a_fazer' })
		];
		const view = buildWorkView(items);

		expect(view.groups.a_fazer.map((item) => item.id)).toEqual(['c', 'a', 'b']);
	});

	it('fornece a contagem de cada grupo', () => {
		const items = [
			makeItem({ id: 'a', status: 'a_fazer' }),
			makeItem({ id: 'b', status: 'a_fazer' }),
			makeItem({ id: 'c', status: 'em_andamento' })
		];
		const view = buildWorkView(items);

		expect(view.counts).toEqual({ a_fazer: 2, em_andamento: 1, concluido: 0 });
	});
});

describe('nextWorkItemStatus / previousWorkItemStatus', () => {
	it('avança na sequência a_fazer → em_andamento → concluido', () => {
		expect(nextWorkItemStatus('a_fazer')).toBe('em_andamento');
		expect(nextWorkItemStatus('em_andamento')).toBe('concluido');
		expect(nextWorkItemStatus('concluido')).toBeNull();
	});

	it('retrocede na mesma sequência', () => {
		expect(previousWorkItemStatus('concluido')).toBe('em_andamento');
		expect(previousWorkItemStatus('em_andamento')).toBe('a_fazer');
		expect(previousWorkItemStatus('a_fazer')).toBeNull();
	});
});

// Dependency (ETAPA 8 do rework) — os três estados de apresentação. A regra
// existe porque Dependency não é hard block: um item pode ser concluído com o
// predecessor ainda aberto, e nesse caso ele não "aguarda" mais nada — mas a
// precedência não satisfeita continua sendo fato visível.
describe('dependencyPresentation', () => {
	const unsatisfied: WorkItemDependencyView = {
		dependencyId: 'dep-1',
		dependsOnWorkItemId: 'wi-b',
		title: 'Definir schema',
		satisfied: false
	};
	const satisfied: WorkItemDependencyView = { ...unsatisfied, satisfied: true };

	it('predecessor concluído é sempre "pronto", inclusive para dependente concluído', () => {
		expect(dependencyPresentation('a_fazer', satisfied)).toBe('pronto');
		expect(dependencyPresentation('em_andamento', satisfied)).toBe('pronto');
		expect(dependencyPresentation('concluido', satisfied)).toBe('pronto');
	});

	it('dependente não concluído com predecessor aberto está "aguardando"', () => {
		expect(dependencyPresentation('a_fazer', unsatisfied)).toBe('aguardando');
		expect(dependencyPresentation('em_andamento', unsatisfied)).toBe('aguardando');
	});

	it('dependente concluído com predecessor aberto está "pendente", nunca "aguardando"', () => {
		expect(dependencyPresentation('concluido', unsatisfied)).toBe('pendente');
	});
});
