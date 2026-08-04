import { describe, expect, it } from 'vitest';
import type { ImpedimentView } from '$lib/server/application/types';
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
		scopeItems: [],
		scopeVersion: { confirmedAt: null },
		impediments: [],
		openPendingItems: [],
		...overrides
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

describe('buildTrackingView — Entregas', () => {
	it('conta os três estados de execução e lista os itens em andamento', () => {
		const result = buildTrackingView(
			baseInput({
				scopeItems: [
					{ id: '1', text: 'Fluxo de aprovação', bucket: 'agora', effort: 'medio', executionStatus: 'em_andamento' },
					{ id: '2', text: 'Notificação por e-mail', bucket: 'agora', effort: 'pequeno', executionStatus: 'a_fazer' },
					{ id: '3', text: 'Item concluído', bucket: 'agora', effort: 'grande', executionStatus: 'concluido' }
				],
				scopeVersion: { confirmedAt: '2026-01-01T00:00:00.000Z' }
			})
		);
		expect(result.deliveries.counts).toEqual({ a_fazer: 1, em_andamento: 1, concluido: 1 });
		expect(result.deliveries.inProgress.map((item) => item.id)).toEqual(['1']);
		expect(result.deliveries.state).toBe('em_andamento');
	});

	it('estado "sem_andamento": há itens a fazer, nenhum em andamento', () => {
		const result = buildTrackingView(
			baseInput({
				scopeItems: [{ id: '1', text: 'Item', bucket: 'agora', effort: null, executionStatus: 'a_fazer' }],
				scopeVersion: { confirmedAt: '2026-01-01T00:00:00.000Z' }
			})
		);
		expect(result.deliveries.state).toBe('sem_andamento');
		expect(result.deliveries.inProgress).toEqual([]);
	});

	it('estado "concluido": todos os itens confirmados foram concluídos', () => {
		const result = buildTrackingView(
			baseInput({
				scopeItems: [{ id: '1', text: 'Item', bucket: 'agora', effort: null, executionStatus: 'concluido' }],
				scopeVersion: { confirmedAt: '2026-01-01T00:00:00.000Z' }
			})
		);
		expect(result.deliveries.state).toBe('concluido');
	});

	it('estado "nenhuma": sem versão confirmada', () => {
		const result = buildTrackingView(baseInput({ scopeItems: [], scopeVersion: { confirmedAt: null } }));
		expect(result.deliveries.state).toBe('nenhuma');
		expect(result.deliveries.confirmed).toBe(false);
	});

	it('estado "nenhuma": confirmada mas sem nenhum item em "Agora"', () => {
		const result = buildTrackingView(
			baseInput({
				scopeItems: [{ id: '1', text: 'Item fora de Agora', bucket: 'depois', effort: null, executionStatus: 'a_fazer' }],
				scopeVersion: { confirmedAt: '2026-01-01T00:00:00.000Z' }
			})
		);
		expect(result.deliveries.state).toBe('nenhuma');
	});

	it('não promove o primeiro item de "A fazer" a item em andamento', () => {
		const result = buildTrackingView(
			baseInput({
				scopeItems: [
					{ id: '1', text: 'Primeiro da fila', bucket: 'agora', effort: null, executionStatus: 'a_fazer' },
					{ id: '2', text: 'Segundo da fila', bucket: 'agora', effort: null, executionStatus: 'a_fazer' }
				],
				scopeVersion: { confirmedAt: '2026-01-01T00:00:00.000Z' }
			})
		);
		expect(result.deliveries.inProgress).toEqual([]);
		expect(result.deliveries.state).toBe('sem_andamento');
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
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			},
			{
				id: 'i2',
				text: 'Licença expirada',
				tipo: 'falta_de_recurso',
				nextAction: null,
				status: 'resolvido',
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: '2026-01-02T00:00:00.000Z'
			}
		];
		const result = buildTrackingView(baseInput({ impediments }));
		expect(result.impediments.open.map((i) => i.id)).toEqual(['i1']);
		expect(result.impediments.resolved.map((i) => i.id)).toEqual(['i2']);
	});
});
