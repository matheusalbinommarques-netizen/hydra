import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { fabricatedPartialPhase, fabricatedUnavailablePhase } from '$lib/domain/test-support';
import { buildMapView } from './map-view';

const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta')!;

describe('buildMapView', () => {
	it('mapeia a fase complete (Descoberta) com todas as atividades não iniciadas no início do projeto', () => {
		const result = buildMapView(catalog, {
			activityStatuses: {},
			phaseStatuses: { descoberta: 'não_iniciada' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'origem' }
		});

		const descobertaView = result.find((phase) => phase.id === 'descoberta')!;
		expect(descobertaView.catalogStatus).toBe('complete');
		expect(descobertaView.phaseStatus).toBe('não_iniciada');
		expect(descobertaView.activities).toHaveLength(descoberta.activities.length);
		expect(descobertaView.activities.every((activity) => activity.status === 'não_iniciada')).toBe(true);
	});

	it('nenhuma fase do catálogo real está marcada como unavailable (jornada linear completa, fases 1–6)', () => {
		const result = buildMapView(catalog, {
			activityStatuses: {},
			phaseStatuses: {},
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'origem' }
		});

		expect(result).toHaveLength(6);
		for (const phase of result) {
			expect(phase.catalogStatus).toBe('complete');
			expect(phase.activities.length).toBeGreaterThan(0);
		}
	});

	it('marca a atividade recomendada pela Trilha A como isCurrent, e nenhuma outra', () => {
		const result = buildMapView(catalog, {
			activityStatuses: { origem: 'concluída', contexto: 'em_andamento' },
			phaseStatuses: { descoberta: 'em_andamento' },
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
		for (const activity of catalog.phases.flatMap((phase) => phase.activities)) {
			activityStatuses[activity.id] = 'concluída';
		}
		const phaseStatuses = Object.fromEntries(catalog.phases.map((phase) => [phase.id, 'concluída' as const]));

		const result = buildMapView(catalog, {
			activityStatuses,
			phaseStatuses,
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
			phaseStatuses: { descoberta: 'em_andamento' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: 'contexto' }
		});

		const descobertaView = result.find((phase) => phase.id === 'descoberta')!;
		const byId = (id: string) => descobertaView.activities.find((activity) => activity.id === id)!;
		expect(byId('origem').status).toBe('concluída');
		expect(byId('contexto').status).toBe('em_andamento');
		expect(byId('problema').status).toBe('pulada');
		expect(byId('publico').status).toBe('não_iniciada');
	});

	// A capacidade genérica de mapear fases 'partial'/'unavailable' continua
	// fazendo parte do contrato de buildMapView mesmo que o catálogo real não
	// tenha mais nenhuma fase nesses estados (ver domain/test-support.ts).
	it('mapeia uma fase partial fabricada sem tratá-la como concluída', () => {
		const fabricatedCatalog = { phases: [fabricatedPartialPhase] };
		const result = buildMapView(fabricatedCatalog, {
			activityStatuses: { fixture_atividade: 'concluída' },
			phaseStatuses: { [fabricatedPartialPhase.id]: 'em_andamento' },
			nextActivity: { kind: 'catalog_limit_reached' }
		});

		const view = result.find((phase) => phase.id === fabricatedPartialPhase.id)!;
		expect(view.catalogStatus).toBe('partial');
		expect(view.phaseStatus).toBe('em_andamento');
		expect(view.phaseStatus).not.toBe('concluída');
	});

	it('mapeia uma fase unavailable fabricada sem atividades e nunca como concluída', () => {
		const fabricatedCatalog = { phases: [fabricatedUnavailablePhase] };
		const result = buildMapView(fabricatedCatalog, {
			activityStatuses: {},
			phaseStatuses: {},
			nextActivity: { kind: 'catalog_limit_reached' }
		});

		const view = result.find((phase) => phase.id === fabricatedUnavailablePhase.id)!;
		expect(view.catalogStatus).toBe('unavailable');
		expect(view.activities).toHaveLength(0);
	});
});
