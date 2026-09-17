import { describe, expect, it } from 'vitest';
import type { DeliverableView, MilestoneView, ScheduleBaselineView, WorkItemView } from '$lib/server/application/types';
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
	it('inclui todo WorkItem CURRENT — agendado com geometria, sem schedule só como identidade', () => {
		const scheduled = makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 3 });
		const unscheduled = makeWorkItem({ id: 'wi-2' });
		const result = buildCronogramaView({ workItems: [scheduled, unscheduled], deliverables: [], milestones: [] });

		const ids = result.groups.flatMap((group) => group.items.map((item) => item.id));
		expect(ids).toEqual(['wi-1', 'wi-2']);

		const scheduledRow = result.groups[0].items.find((item) => item.id === 'wi-1');
		expect(scheduledRow?.unscheduled).toBe(false);
		expect(scheduledRow?.geometry).not.toBeNull();

		const unscheduledRow = result.groups[0].items.find((item) => item.id === 'wi-2');
		expect(unscheduledRow?.unscheduled).toBe(true);
		expect(unscheduledRow?.plannedStartLabel).toBeNull();
		expect(unscheduledRow?.durationLabel).toBeNull();
		expect(unscheduledRow?.geometry).toBeNull();
		expect(unscheduledRow?.ghost).toBeNull();
		expect(unscheduledRow?.removedFromBaseline).toBe(false);
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

	it('sem nenhum WorkItem agendado nem Milestone datado, eixo é null mas identidade sem cronograma continua visível', () => {
		const result = buildCronogramaView({ workItems: [makeWorkItem({ id: 'wi-1' })], deliverables: [], milestones: [] });
		expect(result.axis).toBeNull();
		expect(result.groups.flatMap((group) => group.items.map((item) => item.id))).toEqual(['wi-1']);
		expect(result.groups[0].items[0].unscheduled).toBe(true);
		expect(result.groups[0].items[0].geometry).toBeNull();
		expect(result.milestones).toEqual([]);
	});
});

// Identidade sem cronograma (ETAPA 12 do rework, §42, oitavo microcorte).
// Falsificadores do briefing.
describe('buildCronogramaView — identidade sem cronograma', () => {
	it('agrupa WorkItem sem cronograma pela sua Deliverable atual', () => {
		const deliverables = [makeDeliverable({ id: 'd-1', title: 'Portal', order: 1 })];
		const workItems = [
			makeWorkItem({ id: 'wi-scheduled', plannedStart: '2026-09-01', durationDays: 1 }),
			makeWorkItem({ id: 'wi-unscheduled', deliverable: { deliverableId: 'd-1', title: 'Portal' } })
		];
		const result = buildCronogramaView({ workItems, deliverables, milestones: [] });
		const portalGroup = result.groups.find((group) => group.key === 'd-1');
		expect(portalGroup?.items.map((item) => item.id)).toEqual(['wi-unscheduled']);
	});

	it('WorkItem sem cronograma e sem Deliverable cai em "Sem entrega"', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-scheduled', plannedStart: '2026-09-01', durationDays: 1 }),
			makeWorkItem({ id: 'wi-unscheduled' })
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		const semEntregaGroup = result.groups.find((group) => group.key === '__sem_entrega__');
		expect(semEntregaGroup?.items.map((item) => item.id)).toContain('wi-unscheduled');
	});

	it('WorkItem CURRENT `removed` na baseline aparece exatamente uma vez, nunca duplicado como linha genérica', () => {
		const workItems = [makeWorkItem({ id: 'wi-removed', title: 'Removido', plannedStart: null, durationDays: null })];
		const scheduleBaseline: ScheduleBaselineView = {
			createdAt: '2026-01-01T00:00:00.000Z',
			partial: false,
			entries: [
				{
					kind: 'removed',
					workItemId: 'wi-removed',
					workItemTitle: 'Removido',
					baselinePlannedStart: '2026-09-01',
					baselineDurationDays: 1
				}
			]
		};
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		const rows = result.groups.flatMap((group) => group.items.filter((item) => item.id === 'wi-removed'));
		expect(rows).toHaveLength(1);
		expect(rows[0].removedFromBaseline).toBe(true);
		expect(rows[0].unscheduled).toBe(false);
	});

	it('Dependency com ponta sem cronograma não produz conector, mas ambas as identidades continuam visíveis', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-unscheduled' }),
			makeWorkItem({
				id: 'wi-b',
				plannedStart: '2026-09-05',
				durationDays: 1,
				dependsOn: [{ dependencyId: 'dep-1', dependsOnWorkItemId: 'wi-unscheduled', title: 'wi-unscheduled', satisfied: true }]
			})
		];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.dependencies).toEqual([]);
		const ids = result.groups.flatMap((group) => group.items.map((item) => item.id));
		expect(ids).toEqual(expect.arrayContaining(['wi-unscheduled', 'wi-b']));
	});

	it('adicionar identidades sem cronograma não altera os limites do eixo', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 })];
		const baseAxis = buildCronogramaView({ workItems, deliverables: [], milestones: [] }).axis;

		const withUnscheduled = [
			...workItems,
			makeWorkItem({ id: 'wi-unscheduled-a' }),
			makeWorkItem({ id: 'wi-unscheduled-b' })
		];
		const result = buildCronogramaView({ workItems: withUnscheduled, deliverables: [], milestones: [] });
		expect(result.axis).toEqual(baseAxis);
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

// Ghost da baseline ativa (ETAPA 12 do rework, §42, sétimo microcorte —
// Design Gate aprovado, opção A do Scout). Falsificadores A-N do briefing.
describe('buildCronogramaView — referência da baseline ativa (ghost)', () => {
	function makeBaseline(entries: ScheduleBaselineView['entries']): ScheduleBaselineView {
		return { createdAt: '2026-01-01T00:00:00.000Z', partial: false, entries };
	}

	it('A — baseline inexistente: Cronograma permanece igual (sem ghost)', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 })];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.groups[0].items[0].ghost).toBeNull();
	});

	it('B — compared idêntico: current e ghost coincidem, sem geometria alegando divergência', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 })];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'compared',
				workItemId: 'wi-1',
				workItemTitle: 'wi-1',
				startVarianceDays: 0,
				finishVarianceDays: 0,
				durationVarianceDays: 0,
				baselinePlannedStart: '2026-09-01',
				baselineDurationDays: 2
			}
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		const row = result.groups[0].items[0];
		expect(row.geometry).toEqual({ offsetDays: 0, widthDays: 2 });
		expect(row.ghost).toEqual({
			offsetDays: 0,
			widthDays: 2,
			plannedStartLabel: '01/09/2026',
			semanticEndLabel: '02/09/2026',
			durationLabel: '2 dias'
		});
	});

	it('C/D — compared deslocado e com duração diferente: offsets e larguras diferentes', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-05', durationDays: 4 })];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'compared',
				workItemId: 'wi-1',
				workItemTitle: 'wi-1',
				startVarianceDays: 4,
				finishVarianceDays: 4,
				durationVarianceDays: 2,
				baselinePlannedStart: '2026-09-01',
				baselineDurationDays: 2
			}
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		const row = result.groups[0].items[0];
		// eixo começa na referência (01/09), current offset = 4 dias depois.
		expect(row.geometry).toEqual({ offsetDays: 4, widthDays: 4 });
		expect(row.ghost).toEqual({
			offsetDays: 0,
			widthDays: 2,
			plannedStartLabel: '01/09/2026',
			semanticEndLabel: '02/09/2026',
			durationLabel: '2 dias'
		});
	});

	it('E — removed: linha ghost-only, identidade presente, nenhuma barra atual', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', title: 'Removido', plannedStart: null, durationDays: null })];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'removed',
				workItemId: 'wi-1',
				workItemTitle: 'Removido',
				baselinePlannedStart: '2026-09-01',
				baselineDurationDays: 3
			}
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		const row = result.groups[0].items[0];
		expect(row.id).toBe('wi-1');
		expect(row.geometry).toBeNull();
		expect(row.removedFromBaseline).toBe(true);
		expect(row.removedNote).not.toBeNull();
		expect(row.ghost).toEqual({
			offsetDays: 0,
			widthDays: 3,
			plannedStartLabel: '01/09/2026',
			semanticEndLabel: '03/09/2026',
			durationLabel: '3 dias'
		});
	});

	it('F/G — scheduled_after e added_after nunca recebem ghost', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-after', plannedStart: '2026-09-10', durationDays: 1 }),
			makeWorkItem({ id: 'wi-new', plannedStart: '2026-09-11', durationDays: 1 })
		];
		const scheduleBaseline = makeBaseline([
			{ kind: 'scheduled_after', workItemId: 'wi-after', workItemTitle: 'wi-after' },
			{ kind: 'added_after', workItemId: 'wi-new', workItemTitle: 'wi-new' }
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		const rows = result.groups[0].items;
		expect(rows.find((item) => item.id === 'wi-after')?.ghost).toBeNull();
		expect(rows.find((item) => item.id === 'wi-new')?.ghost).toBeNull();
	});

	it('H — compared_unrepresentable: barra atual normal, nenhuma referência inventada', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 })];
		const scheduleBaseline = makeBaseline([
			{ kind: 'compared_unrepresentable', workItemId: 'wi-1', workItemTitle: 'wi-1' }
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		const row = result.groups[0].items[0];
		expect(row.geometry).toEqual({ offsetDays: 0, widthDays: 2 });
		expect(row.ghost).toBeNull();
	});

	it('I/J — baseline antes ou depois do plano atual expande o eixo', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-10', durationDays: 2 })];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'compared',
				workItemId: 'wi-1',
				workItemTitle: 'wi-1',
				startVarianceDays: 9,
				finishVarianceDays: -5,
				durationVarianceDays: -10,
				baselinePlannedStart: '2026-09-01',
				baselineDurationDays: 20
			}
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		// referência: 01/09 a 20/09 (01 + 19 dias); atual: 10/09 a 11/09 — eixo
		// deve cobrir a união inteira.
		expect(result.axis?.startDate).toBe('2026-09-01');
		expect(result.axis?.endDate).toBe('2026-09-20');
	});

	it('K — ano 0099 na referência: sem remapeamento', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '0099-01-05', durationDays: 2 })];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'compared',
				workItemId: 'wi-1',
				workItemTitle: 'wi-1',
				startVarianceDays: 4,
				finishVarianceDays: 4,
				durationVarianceDays: 0,
				baselinePlannedStart: '0099-01-01',
				baselineDurationDays: 2
			}
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		expect(result.axis?.startDate).toBe('0099-01-01');
		expect(result.groups[0].items[0].ghost?.plannedStartLabel).toBe('01/01/0099');
	});

	it('L — fim histórico irrepresentável: ghost null, sem quebrar a surface', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 })];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'compared',
				workItemId: 'wi-1',
				workItemTitle: 'wi-1',
				startVarianceDays: 0,
				finishVarianceDays: 0,
				durationVarianceDays: 0,
				baselinePlannedStart: '9999-12-30',
				baselineDurationDays: 5
			}
		]);
		expect(() => buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline })).not.toThrow();
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		const row = result.groups[0].items[0];
		expect(row.ghost).toBeNull();
		expect(row.geometry).toEqual({ offsetDays: 0, widthDays: 2 });
	});

	it('M — removed não cria Dependency com posição inventada', () => {
		const workItems = [
			makeWorkItem({ id: 'wi-removed', title: 'Removido', plannedStart: null, durationDays: null }),
			makeWorkItem({
				id: 'wi-b',
				plannedStart: '2026-09-05',
				durationDays: 1,
				dependsOn: [{ dependencyId: 'dep-1', dependsOnWorkItemId: 'wi-removed', title: 'Removido', satisfied: true }]
			})
		];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'removed',
				workItemId: 'wi-removed',
				workItemTitle: 'Removido',
				baselinePlannedStart: '2026-09-01',
				baselineDurationDays: 1
			}
		]);
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		expect(result.dependencies).toEqual([]);
	});

	it('removed agrupa pela Deliverable atual do WorkItem', () => {
		const deliverables = [makeDeliverable({ id: 'd-1', title: 'Portal', order: 1 })];
		const workItems = [
			makeWorkItem({
				id: 'wi-removed',
				title: 'Removido',
				plannedStart: null,
				durationDays: null,
				deliverable: { deliverableId: 'd-1', title: 'Portal' }
			})
		];
		const scheduleBaseline = makeBaseline([
			{
				kind: 'removed',
				workItemId: 'wi-removed',
				workItemTitle: 'Removido',
				baselinePlannedStart: '2026-09-01',
				baselineDurationDays: 1
			}
		]);
		const result = buildCronogramaView({ workItems, deliverables, milestones: [], scheduleBaseline });
		expect(result.groups.map((group) => group.key)).toEqual(['d-1']);
		expect(result.groups[0].items[0].id).toBe('wi-removed');
	});
});

// Referência do cronograma como capability do próprio Cronograma (ETAPA 13
// do rework, §43 — D068: a gestão da referência deixa de viver numa surface
// própria e passa a pertencer ao Cronograma). `scheduleBaseline` na saída é
// passthrough puro de ProjectView.scheduleBaseline — mesmo contrato exato
// que TrackingView expunha antes desta absorção — para a apresentação
// textual (createdAt/partial/entries) que a página usa junto da geometria
// de ghost já coberta acima.
describe('buildCronogramaView — referência do cronograma (passthrough D068)', () => {
	it('sem baseline: scheduleBaseline é null (projeto honesto, nenhuma referência inventada)', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 })];
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [] });
		expect(result.scheduleBaseline).toBeNull();
	});

	it('com baseline ativa: scheduleBaseline repassa createdAt/partial/entries sem transformação', () => {
		const workItems = [makeWorkItem({ id: 'wi-1', plannedStart: '2026-09-01', durationDays: 2 })];
		const scheduleBaseline: ScheduleBaselineView = {
			createdAt: '2026-09-01T00:00:00.000Z',
			partial: true,
			entries: [
				{
					kind: 'compared',
					workItemId: 'wi-1',
					workItemTitle: 'wi-1',
					startVarianceDays: 1,
					finishVarianceDays: 0,
					durationVarianceDays: 0,
					baselinePlannedStart: '2026-08-31',
					baselineDurationDays: 2
				}
			]
		};
		const result = buildCronogramaView({ workItems, deliverables: [], milestones: [], scheduleBaseline });
		expect(result.scheduleBaseline).toEqual(scheduleBaseline);
	});
});
