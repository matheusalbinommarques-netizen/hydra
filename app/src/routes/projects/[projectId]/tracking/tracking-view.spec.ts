import { describe, expect, it } from 'vitest';
import type { ImpedimentView, WorkItemView } from '$lib/server/application/types';
import type { PendingItemView } from '$lib/orientation-engine';
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
		impediments: [],
		openPendingItems: [],
		...overrides
	};
}

function makeWorkItem(overrides: Partial<WorkItemView> & Pick<WorkItemView, 'id'>): WorkItemView {
	return {
		id: overrides.id,
		title: overrides.title ?? `Item ${overrides.id}`,
		status: overrides.status ?? 'a_fazer',
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		blockedBy: overrides.blockedBy ?? null,
		dependsOn: overrides.dependsOn ?? []
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

describe('buildTrackingView — Bloqueios (Precisa de você)', () => {
	it('fica vazio quando nenhum WorkItem está bloqueado', () => {
		const result = buildTrackingView(baseInput({ workItems: [makeWorkItem({ id: '1' })] }));
		expect(result.blockedWorkItems).toEqual([]);
	});

	it('expõe um card por WorkItem bloqueado, com impedimento e explicação', () => {
		const result = buildTrackingView(
			baseInput({
				workItems: [
					makeWorkItem({
						id: '1',
						title: 'Migrar base de clientes',
						status: 'em_andamento',
						blockedBy: { impedimentId: 'imp-1', text: 'Acesso ao CRM ainda não liberado', tipo: 'dependencia_externa' }
					}),
					makeWorkItem({ id: '2', title: 'Item livre', status: 'a_fazer' })
				]
			})
		);
		expect(result.blockedWorkItems).toEqual([
			{
				workItemId: '1',
				title: 'Migrar base de clientes',
				status: 'em_andamento',
				impedimentId: 'imp-1',
				impedimentText: 'Acesso ao CRM ainda não liberado',
				impedimentTipo: 'dependencia_externa',
				why: 'Este impedimento está bloqueando trabalho atualmente em "Em andamento".'
			}
		]);
	});
});

describe('buildTrackingView — Atenções', () => {
	it('expõe pendências abertas com dados suficientes para a ação "Retomar atividade"', () => {
		const openPendingItems: PendingItemView[] = [
			{ id: 'p1', activityDefinitionId: 'proximo-foco', label: 'Foco não definido', detail: 'Defina o próximo foco.' }
		];
		const result = buildTrackingView(baseInput({ openPendingItems }));
		expect(result.attentionPendingItems).toEqual([
			{ id: 'p1', activityDefinitionId: 'proximo-foco', label: 'Foco não definido', detail: 'Defina o próximo foco.' }
		]);
	});
});

describe('buildTrackingView — impedimentos', () => {
	it('separa impedimentos abertos e resolvidos', () => {
		const impediments: ImpedimentView[] = [
			{
				id: 'i1',
				text: 'Falta de acesso',
				tipo: 'falta_de_recurso',
				nextAction: 'Solicitar à TI',
				status: 'aberto',
				workItemId: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			},
			{
				id: 'i2',
				text: 'Licença expirada',
				tipo: 'falta_de_recurso',
				nextAction: null,
				status: 'resolvido',
				workItemId: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: '2026-01-02T00:00:00.000Z'
			}
		];
		const result = buildTrackingView(baseInput({ impediments }));
		expect(result.impediments.open.map((i) => i.id)).toEqual(['i1']);
		expect(result.impediments.resolved.map((i) => i.id)).toEqual(['i2']);
	});

	it('exclui impedimentos abertos vinculados a um WorkItem — já aparecem em "Precisa de você"', () => {
		const impediments: ImpedimentView[] = [
			{
				id: 'i1',
				text: 'Impedimento livre, sem WorkItem',
				tipo: 'outro',
				nextAction: null,
				status: 'aberto',
				workItemId: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			},
			{
				id: 'i2',
				text: 'Bloqueia um WorkItem',
				tipo: 'dependencia_externa',
				nextAction: null,
				status: 'aberto',
				workItemId: 'wi-1',
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			},
			{
				id: 'i3',
				text: 'Bloqueava um WorkItem, já resolvido',
				tipo: 'dependencia_externa',
				nextAction: null,
				status: 'resolvido',
				workItemId: 'wi-1',
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: '2026-01-02T00:00:00.000Z'
			}
		];
		const result = buildTrackingView(baseInput({ impediments }));
		expect(result.impediments.open.map((i) => i.id)).toEqual(['i1']);
		expect(result.impediments.resolved.map((i) => i.id)).toEqual(['i3']);
	});
});
