import { describe, expect, it } from 'vitest';
import type { MilestoneView, WorkItemView } from '$lib/server/application/types';
import type { PhaseProgressView } from '$lib/phase-progress';
import type { JourneyContextView } from '../now/journey-context';
import { buildTrackingView, type TrackingViewInput } from './tracking-view';

function baseInput(overrides: Partial<TrackingViewInput> = {}): TrackingViewInput {
	return {
		journeyContext: { kind: 'in_progress', phaseLabel: 'Execução e acompanhamento', position: 5, total: 6 },
		phaseProgress: {
			phaseId: 'execucao',
			phaseLabel: 'Execução e acompanhamento',
			phaseOrder: 5,
			totalPhases: 6,
			totalActivities: 6,
			resolvedActivities: 2,
			groups: [
				{ key: 'concluidas', activities: [] },
				{
					key: 'atual',
					activities: [
						{ id: 'impedimentos', title: 'Identificar e tratar impedimentos', order: 3, status: 'em_andamento', isCurrent: true }
					]
				},
				{ key: 'pendentes', activities: [] },
				{ key: 'puladas', activities: [] }
			]
		},
		nextActivity: { kind: 'recommendation', activityDefinitionId: 'impedimentos' },
		workItems: [],
		milestones: [],
		scheduleBaseline: null,
		risks: [],
		...overrides
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

describe('buildTrackingView — situação e continuidade', () => {
	it('resume fase, atividade e progresso a partir de journeyContext/phaseProgress', () => {
		const result = buildTrackingView(baseInput());
		expect(result.situation).toEqual({
			phaseLabel: 'Execução e acompanhamento',
			positionLabel: 'Fase 5 de 6',
			activityLabel: 'Identificar e tratar impedimentos',
			progressLabel: '2 de 6 atividades concluídas',
			progressPercent: 33
		});
	});

	it('próxima atividade disponível reflete a mesma atividade da situação', () => {
		const result = buildTrackingView(baseInput());
		expect(result.continuity).toEqual({ completed: false, label: 'Próxima atividade: Identificar e tratar impedimentos' });
	});

	it('projeto concluído: journeyContext "completed" e nextActivity catalog_limit_reached', () => {
		const journeyContext: JourneyContextView = { kind: 'completed', total: 6 };
		const phaseProgress: PhaseProgressView = {
			phaseId: 'validacao',
			phaseLabel: 'Validação e encerramento',
			phaseOrder: 6,
			totalPhases: 6,
			totalActivities: 6,
			resolvedActivities: 6,
			groups: [
				{ key: 'concluidas', activities: [] },
				{ key: 'atual', activities: [] },
				{ key: 'pendentes', activities: [] },
				{ key: 'puladas', activities: [] }
			]
		};
		const result = buildTrackingView(
			baseInput({ journeyContext, phaseProgress, nextActivity: { kind: 'catalog_limit_reached' } })
		);
		expect(result.situation?.phaseLabel).toBe('Jornada concluída');
		expect(result.situation?.positionLabel).toBe('6 de 6 fases percorridas');
		expect(result.situation?.activityLabel).toBe('—');
		expect(result.continuity).toEqual({ completed: true, label: 'Não há próxima atividade — o projeto foi concluído.' });
	});
});

describe('buildTrackingView — Trabalho', () => {
	it('conta os três estados operacionais e lista os itens em andamento', () => {
		const result = buildTrackingView(
			baseInput({
				workItems: [
					makeWorkItem({ id: '1', title: 'Fluxo de aprovação', status: 'em_andamento' }),
					makeWorkItem({ id: '2', title: 'Notificação por e-mail', status: 'a_fazer' }),
					makeWorkItem({ id: '3', title: 'Item concluído', status: 'concluido' })
				]
			})
		);
		expect(result.work.counts).toEqual({ a_fazer: 1, em_andamento: 1, concluido: 1 });
		expect(result.work.inProgress.map((item) => item.id)).toEqual(['1']);
		expect(result.work.state).toBe('em_andamento');
	});

	it('estado "sem_andamento": há itens a fazer, nenhum em andamento', () => {
		const result = buildTrackingView(
			baseInput({ workItems: [makeWorkItem({ id: '1', status: 'a_fazer' })] })
		);
		expect(result.work.state).toBe('sem_andamento');
		expect(result.work.inProgress).toEqual([]);
	});

	it('estado "concluido": todos os itens foram concluídos', () => {
		const result = buildTrackingView(
			baseInput({ workItems: [makeWorkItem({ id: '1', status: 'concluido' })] })
		);
		expect(result.work.state).toBe('concluido');
	});

	it('estado "nenhuma": sem nenhum item de trabalho', () => {
		const result = buildTrackingView(baseInput({ workItems: [] }));
		expect(result.work.state).toBe('nenhuma');
	});

	it('não promove o primeiro item de "A fazer" a item em andamento', () => {
		const result = buildTrackingView(
			baseInput({
				workItems: [
					makeWorkItem({ id: '1', title: 'Primeiro da fila', status: 'a_fazer' }),
					makeWorkItem({ id: '2', title: 'Segundo da fila', status: 'a_fazer' })
				]
			})
		);
		expect(result.work.inProgress).toEqual([]);
		expect(result.work.state).toBe('sem_andamento');
	});
});

// Linha do tempo (ETAPA 8 do rework, microcorte de Timeline) — projeção
// cronológica de marcos DATADOS. Os testes abaixo são os falsificadores da
// promessa: se algum deles passar a afirmar atraso, proximidade ou progresso,
// o corte deixou de ser Timeline e virou scheduling.
describe('buildTrackingView — Linha do tempo', () => {
	it('omite marco sem data planejada', () => {
		const milestones = [
			makeMilestone({ id: 'm1', plannedDate: '2026-09-10' }),
			makeMilestone({ id: 'm2', plannedDate: null })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['m1']);
	});

	it('ordena por data civil ascendente, independente da ordem de criação', () => {
		const milestones = [
			makeMilestone({ id: 'm1', plannedDate: '2026-12-01' }),
			makeMilestone({ id: 'm2', plannedDate: '2026-02-28' }),
			makeMilestone({ id: 'm3', plannedDate: '2026-09-30' })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['m2', 'm3', 'm1']);
	});

	// Desempate por FATO, não por acaso: a ordem em que a projeção recebe os
	// marcos é deliberadamente invertida em relação à ordem de criação, para o
	// teste falhar se a ordenação voltar a depender da estabilidade do sort.
	it('desempata data igual pela ordem de criação, independente da ordem recebida', () => {
		const milestones = [
			makeMilestone({ id: 'zz', plannedDate: '2026-09-01', createdAt: '2026-03-01T00:00:00.000Z' }),
			makeMilestone({ id: 'aa', plannedDate: '2026-09-01', createdAt: '2026-01-01T00:00:00.000Z' }),
			makeMilestone({ id: 'mm', plannedDate: '2026-09-01', createdAt: '2026-02-01T00:00:00.000Z' }),
			makeMilestone({ id: 'anterior', plannedDate: '2026-08-31', createdAt: '2026-12-01T00:00:00.000Z' })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['anterior', 'aa', 'mm', 'zz']);
	});

	// Caso extremo restante: mesma data planejada E mesmo instante de criação.
	// O id resolve deterministicamente — a lista nunca fica à mercê da ordem de
	// entrada.
	it('desempata por id quando data planejada e createdAt são idênticos', () => {
		const createdAt = '2026-01-01T00:00:00.000Z';
		const milestones = [
			makeMilestone({ id: 'ms-c', plannedDate: '2026-09-01', createdAt }),
			makeMilestone({ id: 'ms-a', plannedDate: '2026-09-01', createdAt }),
			makeMilestone({ id: 'ms-b', plannedDate: '2026-09-01', createdAt })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['ms-a', 'ms-b', 'ms-c']);
	});

	it('um único marco datado já produz Linha do tempo', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-01' })];
		expect(buildTrackingView(baseInput({ milestones })).timeline).toHaveLength(1);
	});

	it('nenhum marco datado produz Linha do tempo vazia (a seção não existe na página)', () => {
		const milestones = [makeMilestone({ id: 'm1' }), makeMilestone({ id: 'm2' })];
		expect(buildTrackingView(baseInput({ milestones })).timeline).toEqual([]);
		expect(buildTrackingView(baseInput({ milestones: [] })).timeline).toEqual([]);
	});

	it('formata a data como dia civil pt-BR, sem deslocamento de dia', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-01-01' })];
		const [entry] = buildTrackingView(baseInput({ milestones })).timeline;
		expect(entry.plannedDate).toBe('2026-01-01');
		expect(entry.plannedDateLabel).toBe('01/01/2026');
	});

	it('mostra status declarado e reachedAt como fatos, sem afirmar atraso nem adiantamento', () => {
		// Alcançado depois da data planejada e alcançado antes dela: os dois são
		// estado legítimo, exibidos igual. A entrada não carrega nenhum campo de
		// variação/atraso/proximidade — e é isso que este teste protege.
		const milestones = [
			makeMilestone({
				id: 'atrasado',
				plannedDate: '2026-01-10',
				status: 'alcancado',
				reachedAt: '2026-03-02T10:00:00.000Z'
			}),
			makeMilestone({
				id: 'adiantado',
				plannedDate: '2026-06-10',
				status: 'alcancado',
				reachedAt: '2026-02-01T10:00:00.000Z'
			})
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['atrasado', 'adiantado']);
		for (const entry of result.timeline) {
			expect(entry.statusLabel).toBe('Alcançado');
			expect(Object.keys(entry).sort()).toEqual(
				['createdAt', 'id', 'kind', 'plannedDate', 'plannedDateLabel', 'reachedAt', 'status', 'statusLabel', 'title'].sort()
			);
		}
	});

	it('marco aberto aparece com reachedAt null e status declarado', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-01' })];
		const [entry] = buildTrackingView(baseInput({ milestones })).timeline;
		expect(entry.status).toBe('aberto');
		expect(entry.statusLabel).toBe('Em aberto');
		expect(entry.kind).toBe('milestone');
		if (entry.kind !== 'milestone') throw new Error('esperado marco');
		expect(entry.reachedAt).toBeNull();
	});

	// D058 (WorkItem com schedule entrando na Linha do tempo) foi o primeiro
	// consumidor real do fato temporal, mas o sexto microcorte de §42 (Design
	// Gate "Corredor") substitui a Timeline por um card assim que o
	// Cronograma atinge readiness — ver describe('buildTrackingView —
	// Cronograma (readiness e card)') abaixo: qualquer WorkItem agendado
	// torna o Cronograma ready, então a Linha do tempo nunca mais chega a
	// listar um WorkItem através de buildTrackingView.
	it('WorkItem agendado dispara readiness e esvazia a Linha do tempo, mesmo com marco datado', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-20' })];
		const workItems = [makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 })];
		const result = buildTrackingView(baseInput({ milestones, workItems }));
		expect(result.timeline).toEqual([]);
	});
});

describe('buildTrackingView — Cronograma (readiness e card)', () => {
	it('não ready sem nenhum WorkItem agendado — Timeline permanece intacta', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-20' })];
		const workItems = [makeWorkItem({ id: 'w1', title: 'Sem schedule' })];
		const result = buildTrackingView(baseInput({ milestones, workItems }));
		expect(result.cronogramaReady).toBe(false);
		expect(result.cronogramaCard).toBeNull();
		expect(result.timeline.map((entry) => entry.id)).toEqual(['m1']);
	});

	// Hardening pós-dogfood (ETAPA 12, §42, sétimo microcorte) — readiness
	// nunca deve passar a depender da baseline: 0 WorkItems com schedule
	// ATUAL, mesmo havendo uma referência histórica `removed`, continua
	// NOT ready. `isCronogramaReady` só recebe `workItems`, nunca
	// `scheduleBaseline` — este teste falsifica a interação real, não só a
	// assinatura da função.
	it('não ready mesmo com baseline contendo um WorkItem removed — readiness não depende da baseline', () => {
		const workItems = [makeWorkItem({ id: 'w1', plannedStart: null, durationDays: null })];
		const scheduleBaseline = {
			createdAt: '2026-09-01T00:00:00.000Z',
			partial: false,
			entries: [
				{
					kind: 'removed' as const,
					workItemId: 'w1',
					workItemTitle: 'w1',
					baselinePlannedStart: '2026-09-10',
					baselineDurationDays: 2
				}
			]
		};
		const result = buildTrackingView(baseInput({ workItems, scheduleBaseline }));
		expect(result.cronogramaReady).toBe(false);
		expect(result.cronogramaCard).toBeNull();
	});

	// Caminho inverso 1 → 0 (hardening pós-dogfood): limpar o schedule do
	// único WorkItem agendado precisa reverter integralmente a apresentação
	// — Timeline volta a existir com o marco datado, card desaparece. Duas
	// chamadas de buildTrackingView com o MESMO marco simulam o "antes
	// ready" e o "depois de limpar o schedule", mesmo espírito de D058
	// (limpar é uma escrita atômica normal, não um estado defeituoso).
	it('reverte Timeline/card quando o único WorkItem agendado tem o schedule limpo, preservando o marco datado', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-20' })];

		const ready = buildTrackingView(
			baseInput({ milestones, workItems: [makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 })] })
		);
		expect(ready.cronogramaReady).toBe(true);
		expect(ready.cronogramaCard).not.toBeNull();
		expect(ready.timeline).toEqual([]);

		const afterClear = buildTrackingView(
			baseInput({ milestones, workItems: [makeWorkItem({ id: 'w1', plannedStart: null, durationDays: null })] })
		);
		expect(afterClear.cronogramaReady).toBe(false);
		expect(afterClear.cronogramaCard).toBeNull();
		expect(afterClear.timeline.map((entry) => entry.id)).toEqual(['m1']);
	});

	it('ready com um WorkItem agendado — card presente, Timeline vazia', () => {
		const workItems = [makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 })];
		const result = buildTrackingView(baseInput({ workItems }));
		expect(result.cronogramaReady).toBe(true);
		expect(result.cronogramaCard).toEqual({
			conflictCount: 0,
			divergingFromBaselineCount: null,
			unrepresentableFromBaselineCount: null
		});
		expect(result.timeline).toEqual([]);
	});

	it('conflictCount conta WorkItems com precedenceConflict conhecido', () => {
		const workItems = [
			makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 }),
			makeWorkItem({
				id: 'w2',
				plannedStart: '2026-09-05',
				durationDays: 1,
				precedenceConflict: { kind: 'conflict', dependsOnWorkItemId: 'w1', dependsOnWorkItemTitle: 'w1', knownRequiredStart: '2026-09-12' }
			})
		];
		const result = buildTrackingView(baseInput({ workItems }));
		expect(result.cronogramaCard).toEqual({
			conflictCount: 1,
			divergingFromBaselineCount: null,
			unrepresentableFromBaselineCount: null
		});
	});

	// Auditoria do contrato completo de divergência (hardening pós-dogfood):
	// cada kind de ScheduleBaselineComparisonEntryView (D062) conta em NO
	// MÁXIMO um dos dois campos, nunca nos dois, e `compared` com as três
	// variâncias em zero não conta em nenhum — "sem variação desde a
	// referência" não é uma divergência.
	it('divergingFromBaselineCount/unrepresentableFromBaselineCount são null juntos sem baseline ativa', () => {
		const workItems = [makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 })];
		const result = buildTrackingView(baseInput({ workItems }));
		expect(result.cronogramaCard?.divergingFromBaselineCount).toBeNull();
		expect(result.cronogramaCard?.unrepresentableFromBaselineCount).toBeNull();
	});

	it('compared com as três variâncias em zero não conta como divergência', () => {
		const workItems = [makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 })];
		const scheduleBaseline = {
			createdAt: '2026-09-01T00:00:00.000Z',
			partial: false,
			entries: [
				{
					kind: 'compared' as const,
					workItemId: 'w1',
					workItemTitle: 'w1',
					startVarianceDays: 0,
					finishVarianceDays: 0,
					durationVarianceDays: 0,
					baselinePlannedStart: '2026-09-10',
					baselineDurationDays: 2
				}
			]
		};
		const result = buildTrackingView(baseInput({ workItems, scheduleBaseline }));
		expect(result.cronogramaCard).toEqual({
			conflictCount: 0,
			divergingFromBaselineCount: 0,
			unrepresentableFromBaselineCount: 0
		});
	});

	it('compared com qualquer variância não-zero, removed, scheduled_after e added_after contam como divergência; compared_unrepresentable conta separado, sem afirmar "difere"', () => {
		const workItems = [makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 })];
		const scheduleBaseline = {
			createdAt: '2026-09-01T00:00:00.000Z',
			partial: false,
			entries: [
				{
					kind: 'compared' as const,
					workItemId: 'w-start',
					workItemTitle: 'difere no início',
					startVarianceDays: 1,
					finishVarianceDays: 0,
					durationVarianceDays: 0,
					baselinePlannedStart: '2026-09-09',
					baselineDurationDays: 2
				},
				{
					kind: 'compared' as const,
					workItemId: 'w-finish',
					workItemTitle: 'difere no fim',
					startVarianceDays: 0,
					finishVarianceDays: 1,
					durationVarianceDays: 0,
					baselinePlannedStart: '2026-09-10',
					baselineDurationDays: 2
				},
				{
					kind: 'compared' as const,
					workItemId: 'w-duration',
					workItemTitle: 'difere na duração',
					startVarianceDays: 0,
					finishVarianceDays: 0,
					durationVarianceDays: 1,
					baselinePlannedStart: '2026-09-10',
					baselineDurationDays: 1
				},
				{
					kind: 'removed' as const,
					workItemId: 'w-removed',
					workItemTitle: 'removido',
					baselinePlannedStart: '2026-09-10',
					baselineDurationDays: 2
				},
				{ kind: 'scheduled_after' as const, workItemId: 'w-sched-after', workItemTitle: 'agendado depois' },
				{ kind: 'added_after' as const, workItemId: 'w-added-after', workItemTitle: 'adicionado depois' },
				{ kind: 'compared_unrepresentable' as const, workItemId: 'w-unrep', workItemTitle: 'não calculável' }
			]
		};
		const result = buildTrackingView(baseInput({ workItems, scheduleBaseline }));
		expect(result.cronogramaCard).toEqual({
			conflictCount: 0,
			divergingFromBaselineCount: 6,
			unrepresentableFromBaselineCount: 1
		});
	});
});
