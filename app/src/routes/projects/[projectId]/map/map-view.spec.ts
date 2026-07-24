import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { buildMapView } from './map-view';

const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta')!;
const definicao = catalog.phases.find((phase) => phase.id === 'definicao')!;
const estruturacao = catalog.phases.find((phase) => phase.id === 'estruturacao')!;

describe('buildMapView', () => {
	it('mapeia a fase complete (Descoberta) com todas as atividades não iniciadas no início do projeto', () => {
		const result = buildMapView(catalog, {
			activityStatuses: {},
			phaseStatuses: { descoberta: 'não_iniciada', definicao: 'não_iniciada', estruturacao: 'não_iniciada' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'origem' }
		});

		const descobertaView = result.find((phase) => phase.id === 'descoberta')!;
		expect(descobertaView.catalogStatus).toBe('complete');
		expect(descobertaView.phaseStatus).toBe('não_iniciada');
		expect(descobertaView.activities).toHaveLength(descoberta.activities.length);
		expect(descobertaView.activities.every((activity) => activity.status === 'não_iniciada')).toBe(true);
	});

	it('mapeia a fase partial (Definição do produto) sem tratá-la como concluída', () => {
		const result = buildMapView(catalog, {
			activityStatuses: {},
			phaseStatuses: { descoberta: 'concluída', definicao: 'em_andamento', estruturacao: 'não_iniciada' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'usuario_principal' }
		});

		const definicaoView = result.find((phase) => phase.id === 'definicao')!;
		expect(definicaoView.catalogStatus).toBe('partial');
		expect(definicaoView.phaseStatus).toBe('em_andamento');
		expect(definicaoView.phaseStatus).not.toBe('concluída');
		expect(definicaoView.activities).toHaveLength(definicao.activities.length);
	});

	it('mapeia fases unavailable sem atividades e nunca como concluídas', () => {
		const result = buildMapView(catalog, {
			activityStatuses: {},
			phaseStatuses: { descoberta: 'não_iniciada', definicao: 'não_iniciada', estruturacao: 'não_iniciada' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'origem' }
		});

		const estruturacaoView = result.find((phase) => phase.id === 'estruturacao')!;
		expect(estruturacaoView.catalogStatus).toBe('unavailable');
		expect(estruturacaoView.phaseStatus).toBe('não_iniciada');
		expect(estruturacaoView.activities).toHaveLength(0);
		expect(estruturacaoView.activities).toHaveLength(estruturacao.activities.length);
	});

	it('marca a atividade recomendada pela Trilha A como isCurrent, e nenhuma outra', () => {
		const result = buildMapView(catalog, {
			activityStatuses: { origem: 'concluída', contexto: 'em_andamento' },
			phaseStatuses: { descoberta: 'em_andamento', definicao: 'não_iniciada', estruturacao: 'não_iniciada' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'contexto' }
		});

		const allActivities = result.flatMap((phase) => phase.activities);
		const current = allActivities.filter((activity) => activity.isCurrent);
		expect(current).toHaveLength(1);
		expect(current[0].id).toBe('contexto');

		const descobertaView = result.find((phase) => phase.id === 'descoberta')!;
		expect(descobertaView.isCurrent).toBe(true);
		const definicaoView = result.find((phase) => phase.id === 'definicao')!;
		expect(definicaoView.isCurrent).toBe(false);
	});

	it('não marca nenhuma atividade ou fase como atual quando o catálogo foi esgotado (catalog_limit_reached)', () => {
		const activityStatuses: Record<string, 'não_iniciada' | 'em_andamento' | 'concluída' | 'pulada'> = {};
		for (const activity of descoberta.activities) activityStatuses[activity.id] = 'concluída';
		for (const activity of definicao.activities) activityStatuses[activity.id] = 'concluída';

		const result = buildMapView(catalog, {
			activityStatuses,
			phaseStatuses: { descoberta: 'concluída', definicao: 'em_andamento', estruturacao: 'não_iniciada' },
			nextActivity: { kind: 'catalog_limit_reached' }
		});

		const allActivities = result.flatMap((phase) => phase.activities);
		expect(allActivities.every((activity) => !activity.isCurrent)).toBe(true);
		expect(result.every((phase) => !phase.isCurrent)).toBe(true);
		expect(allActivities.every((activity) => activity.status === 'concluída')).toBe(true);
	});

	it('reflete os quatro status de atividade aplicáveis, incluindo pulada', () => {
		const result = buildMapView(catalog, {
			activityStatuses: {
				origem: 'concluída',
				contexto: 'em_andamento',
				problema: 'pulada',
				publico: 'não_iniciada'
			},
			phaseStatuses: { descoberta: 'em_andamento', definicao: 'não_iniciada', estruturacao: 'não_iniciada' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'contexto' }
		});

		const descobertaView = result.find((phase) => phase.id === 'descoberta')!;
		const byId = (id: string) => descobertaView.activities.find((activity) => activity.id === id)!;
		expect(byId('origem').status).toBe('concluída');
		expect(byId('contexto').status).toBe('em_andamento');
		expect(byId('problema').status).toBe('pulada');
		expect(byId('publico').status).toBe('não_iniciada');
	});
});
