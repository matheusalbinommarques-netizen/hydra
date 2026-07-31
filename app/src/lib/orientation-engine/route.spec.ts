import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { computeRecommendedRoute } from './route';

describe('computeRecommendedRoute', () => {
	it('null retorna o catálogo completo (mesma referência)', () => {
		expect(computeRecommendedRoute(catalog, null)).toBe(catalog);
	});

	it('undefined retorna o catálogo completo (mesma referência)', () => {
		expect(computeRecommendedRoute(catalog, undefined)).toBe(catalog);
	});

	it('fase válida retorna só as fases a partir dela, na mesma ordem', () => {
		const route = computeRecommendedRoute(catalog, 'estruturacao');
		expect(route.phases.map((phase) => phase.id)).toEqual(
			catalog.phases.slice(catalog.phases.findIndex((phase) => phase.id === 'estruturacao')).map((phase) => phase.id)
		);
	});

	it('escolher a primeira fase do catálogo retorna o catálogo completo em conteúdo', () => {
		const firstPhaseId = catalog.phases[0].id;
		const route = computeRecommendedRoute(catalog, firstPhaseId);
		expect(route.phases.map((phase) => phase.id)).toEqual(catalog.phases.map((phase) => phase.id));
	});

	it('escolher a última fase retorna só ela', () => {
		const lastPhase = catalog.phases[catalog.phases.length - 1];
		const route = computeRecommendedRoute(catalog, lastPhase.id);
		expect(route.phases.map((phase) => phase.id)).toEqual([lastPhase.id]);
	});

	it('id de fase inexistente no catálogo retorna o catálogo completo (defensivo)', () => {
		const route = computeRecommendedRoute(catalog, 'fase-inexistente');
		expect(route).toBe(catalog);
	});

	it('não modifica o catálogo original', () => {
		const before = JSON.parse(JSON.stringify(catalog));
		computeRecommendedRoute(catalog, 'estruturacao');
		expect(catalog).toEqual(before);
	});
});
