import { describe, expect, it } from 'vitest';
import type { DeliverableView, MilestoneView, WorkItemView } from '$lib/server/application/types';
import { buildCronogramaView } from './cronograma-view';

function makeWorkItem(overrides: Partial<WorkItemView> & Pick<WorkItemView, 'id'>): WorkItemView {
	return {
		id: overrides.id,
		title: overrides.title ?? `Item ${overrides.id}`,
		status: overrides.status ?? 'a_fazer',
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		blockedBy: overrides.blockedBy ?? null,
		dependsOn: overrides.dependsOn ?? [],
		deliverable: overrides.deliverable ?? null,
		plannedStart: overrides.plannedStart ?? null,
		durationDays: overrides.durationDays ?? null,
		precedenceConflict: overrides.precedenceConflict ?? null,
		knownFreeSlack: overrides.knownFreeSlack ?? null
	};
}

function makeMilestone(overrides: Partial<MilestoneView> & Pick<MilestoneView, 'id'>): MilestoneView {
	return {
		id: overrides.id,
		title: overrides.title ?? `Marco ${overrides.id}`,
		status: overrides.status ?? 'aberto',
		reachedAt: overrides.reachedAt ?? null,
		plannedDate: overrides.plannedDate ?? null,
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		relatedWorkItems: overrides.relatedWorkItems ?? [],
		relatedConcluded: overrides.relatedConcluded ?? 0
	};
}

function makeDeliverable(overrides: Partial<DeliverableView> & Pick<DeliverableView, 'id'>): DeliverableView {
	return {
		id: overrides.id,
		title: overrides.title ?? `Entrega ${overrides.id}`,
		bucket: overrides.bucket ?? 'agora',
		effort: overrides.effort ?? null,
		order: overrides.order ?? null,
		sourceScopeItemId: overrides.sourceScopeItemId ?? null
	};
}

describe('buildCronogramaView — inclusão e agrupamento', () => {
	it('só inclui WorkItems com schedule completo', () => {
		const scheduled = makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 3 });
		const unscheduled = makeWorkItem({ id: 'wi-2' });
		const result = buildCronogramaView({ workItems: [scheduled, unscheduled], deliverables: [], milestones: [] });

		const ids = result.groups.flatMap((group) => group.items.map((item) => item.id));
		expect(ids).toEqual(['wi-1']);
	});

	it('agrupa por Deliverable, respeitando order, e coloca "Sem entrega" por último', () => {
		const deliverables = [
			makeDeliverable({ id: 'd-2', title: 'Cobrança', order: 2 }),
			makeDeliverable({ id: 'd-1', title: 'Portal', order: 1 })
		];
		const workItems = [
			makeWorkItem({
				id: 'wi-sem-entrega',
				plannedStart: '2026-09-01',
				durationDays: 1
			}),
			makeWorkItem({
				id: 'wi-cobranca',
				plannedStart: '2026-09-01',
				durationDays: 1,
				deliverable: { deliverableId: 'd-2', title: 'Cobrança' }
			}),
			makeWorkItem({
				id: 'wi-portal',
				plannedStart: '2026-09-01',
				durationDays: 1,
				deliverable: { deliverableId: 'd-1', title: 'Portal' }
			})
		];

		const result = buildCronogramaView({ workItems, deliverables, milestones: [] });

		expect(result.groups.map((group) => ({ key: group.key, title: group.title }))).toEqual([
			{ key: 'd-1', title: 'Portal' },
			{ key: 'd-2', title: 'Cobrança' },
			{ key: '__sem_entrega__', title: 'Sem entrega' }
		]);
	});

	it('ordena itens dentro do grupo por data planejada, depois createdAt, depois id', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-late', plannedStart: '2026-09-10', durationDays: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
			makeWorkItem({ id: 'wi-early', plannedStart: '2026-09-01', durationDays: 1, createdAt: '2026-01-02T00:00:00.000Z' })
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.groups[0].items.map((item) => item.id)).toEqual(['wi-early', 'wi-late']);
	});
});

describe('buildCronogramaView — geometria e eixo', () => {
	it('deriva o eixo do menor intervalo que enquadra WorkItems agendados e Milestones', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-05', durationDays: 3 })];
		const milestones = [makeMilestone({ id: 'm-1', plannedDate: '2026-09-20' })];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones });

		// fim semântico de wi-1: 05 + (3-1) = 07/09; eixo vai até o marco (20/09).
		expect(result.axis).toEqual({
			startDate: '2026-09-05',
			endDate: '2026-09-20',
			startLabel: '05/09/2026',
			endLabel: '20/09/2026',
			totalDays: 16
		});
	});

	it('calcula offsetDays/widthDays da barra a partir do início do eixo', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 }),
			makeWorkItem({ id: 'wi-2', plannedStart: '2026-09-05', durationDays: 4 })
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		const items = result.groups[0].items;
		expect(items.find((item) => item.id === 'wi-1')?.geometry).toEqual({ offsetDays: 0, widthDays: 2 });
		expect(items.find((item) => item.id === 'wi-2')?.geometry).toEqual({ offsetDays: 4, widthDays: 4 });
	});

	it('sem nenhum WorkItem agendado nem Milestone datado, eixo é null e listas ficam vazias', () => {
		const result = buildCronogramaView({ workItems: [makeWorkItem({ id: 'wi-1' })], deliverables: [], milestones: [] });
		expect(result.axis).toBeNull();
		expect(result.groups).toEqual([]);
		expect(result.milestones).toEqual([]);
	});
});

describe('buildCronogramaView — Milestones', () => {
	it('só inclui Milestones com plannedDate, numa lane própria (fora de groups)', () => {
		const milestones = [makeMilestone({ id: 'm-1', plannedDate: '2026-09-10' }), makeMilestone({ id: 'm-2' })];
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 1 })];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones });
		expect(result.milestones.map((entry) => entry.id)).toEqual(['m-1']);
	});
});

describe('buildCronogramaView — Dependency e conflito', () => {
	it('cria um conector só quando as duas pontas têm schedule completo', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-a', plannedStart: '2026-09-01', durationDays: 2 }),
			makeWorkItem({
				id: 'wi-b',
				plannedStart: '2026-09-05',
				durationDays: 2,
				dependsOn: [{ dependencyId: 'dep-1', dependsOnWorkItemId: 'wi-a', title: 'wi-a', satisfied: true }]
			}),
			makeWorkItem({
				id: 'wi-c',
				dependsOn: [{ dependencyId: 'dep-2', dependsOnWorkItemId: 'wi-a', title: 'wi-a', satisfied: true }]
			})
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.dependencies).toEqual([{ id: 'dep-1', fromWorkItemId: 'wi-a', toWorkItemId: 'wi-b', conflict: false }]);
	});

	it('marca conflict:true só na aresta que WorkItemView.precedenceConflict aponta como prova', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-a', plannedStart: '2026-09-01', durationDays: 5 }),
			makeWorkItem({ id: 'wi-x', plannedStart: '2026-09-01', durationDays: 1 }),
			makeWorkItem({
				id: 'wi-b',
				plannedStart: '2026-09-02',
				durationDays: 1,
				dependsOn: [
					{ dependencyId: 'dep-a', dependsOnWorkItemId: 'wi-a', title: 'wi-a', satisfied: true },
					{ dependencyId: 'dep-x', dependsOnWorkItemId: 'wi-x', title: 'wi-x', satisfied: true }
				],
				precedenceConflict: { kind: 'conflict', dependsOnWorkItemId: 'wi-a', dependsOnWorkItemTitle: 'wi-a', knownRequiredStart: '2026-09-06' }
			})
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.dependencies).toContainEqual({ id: 'dep-a', fromWorkItemId: 'wi-a', toWorkItemId: 'wi-b', conflict: true });
		expect(result.dependencies).toContainEqual({ id: 'dep-x', fromWorkItemId: 'wi-x', toWorkItemId: 'wi-b', conflict: false });
	});

	it('linha do item em conflito expõe hasConflict/conflictLabel', () => {
		const workItems = [
			makeWorkItem({
				id: 'wi-b',
				plannedStart: '2026-09-02',
				durationDays: 1,
				precedenceConflict: { kind: 'conflict', dependsOnWorkItemId: 'wi-a', dependsOnWorkItemTitle: 'Predecessor', knownRequiredStart: '2026-09-06' }
			})
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		const row = result.groups[0].items[0];
		expect(row.hasConflict).toBe(true);
		expect(row.conflictLabel).toBe('Conflito de precedência com "Predecessor".');
	});
});

// Hardening pós-dogfood (S12, sexto microcorte): a projeção temporal não
// pode reintroduzir nenhum dos bugs de data civil que D059/D060 já
// eliminaram no domínio — nada de parsing por timezone, remapeamento
// legado de ano 0000-0099, ou geometria fabricada quando a aritmética
// estoura a faixa representável.
describe('buildCronogramaView — data civil e geometria (hardening)', () => {
	it('ano 0099 não é remapeado para 1999 (mesmo motor setUTCFullYear de D059/D060)', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '0099-01-01', durationDays: 3 })];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		const row = result.groups[0].items[0];
		expect(row.plannedStartLabel).toBe('01/01/0099');
		// fim semântico: 0099-01-01 + (3-1) dias = 0099-01-03 — se o motor
		// remapeasse o ano para 1999, o resultado seria completamente diferente.
		expect(row.semanticEndLabel).toBe('03/01/0099');
		expect(result.axis).toEqual({
			startDate: '0099-01-01',
			endDate: '0099-01-03',
			startLabel: '01/01/0099',
			endLabel: '03/01/0099',
			totalDays: 3
		});
	});

	it('intervalo de um único dia (WorkItem de 1 dia, sem outros fatos temporais) produz totalDays=1, sem NaN', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 1 })];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.axis).toEqual({
			startDate: '2026-09-01',
			endDate: '2026-09-01',
			startLabel: '01/09/2026',
			endLabel: '01/09/2026',
			totalDays: 1
		});
		const row = result.groups[0].items[0];
		expect(row.geometry).toEqual({ offsetDays: 0, widthDays: 1 });
		expect(Number.isNaN(result.axis!.totalDays)).toBe(false);
	});

	it('WorkItem e Milestone no mesmo único dia continuam renderizáveis, sem NaN/divisão por zero', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 1 })];
		const milestones = [makeMilestone({ id: 'm-1', plannedDate: '2026-09-01' })];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones });
		expect(result.axis?.totalDays).toBe(1);
		expect(result.groups[0].items[0].geometry).toEqual({ offsetDays: 0, widthDays: 1 });
		expect(result.milestones[0].geometry).toEqual({ offsetDays: 0 });
	});

	it('WorkItem cujo fim semântico estoura a faixa civil (perto de 9999-12-31): sem throw, sem geometria fabricada', () => {
		const workItems = [makeWorkItem({ id: 'wi-overflow', plannedStart: '9999-12-30', durationDays: 5 })];
		expect(() => buildCronogramaView({ workItems, deliverables: [], milestones: [] })).not.toThrow();

		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		const row = result.groups[0].items[0];
		expect(row.geometry).toBeNull();
		expect(row.semanticEndLabel).toBe('Não calculável');
		// Nenhum outro fato temporal válido existe (só este item, sem
		// milestone) — o eixo inteiro fica sem base honesta, e a projeção
		// admite isso em vez de fabricar um intervalo.
		expect(result.axis).toBeNull();
	});

	it('item com fim irrepresentável não contamina o eixo quando existe outro fato temporal válido', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-overflow', plannedStart: '9999-12-30', durationDays: 5 }),
			makeWorkItem({ id: 'wi-valid', plannedStart: '2026-09-01', durationDays: 2 })
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.axis).not.toBeNull();
		// O eixo é ancorado pelo item válido — o item irrepresentável nunca
		// puxa endDate para 9999 nem estoura a aritmética do eixo.
		expect(result.axis?.endDate).toBe('2026-09-02');
		const overflowRow = result.groups[0].items.find((item) => item.id === 'wi-overflow');
		expect(overflowRow?.geometry).toBeNull();
		const validRow = result.groups[0].items.find((item) => item.id === 'wi-valid');
		expect(validRow?.geometry).toEqual({ offsetDays: 0, widthDays: 2 });
	});
});
