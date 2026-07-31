// Rota recomendada (D023, docs/07-management/decision-log.md) — projeção
// pura e determinística, separada de next-activity.ts: recorta o catálogo a
// partir da fase escolhida como ponto de partida, sem conhecer
// ProjectState/ActivityProgress e sem alterar o catálogo original.

import type { Catalog } from '$lib/domain';

export function computeRecommendedRoute(catalog: Catalog, routeStartPhaseId: string | null | undefined): Catalog {
	if (routeStartPhaseId === null || routeStartPhaseId === undefined) return catalog;

	const startIndex = catalog.phases.findIndex((phase) => phase.id === routeStartPhaseId);
	// Defensivo: um routeStartPhaseId que não existe mais no catálogo atual
	// (ex.: catálogo mudou entre versões) não deve quebrar a recomendação —
	// equivale a nenhuma escolha feita (percurso completo).
	if (startIndex === -1) return catalog;

	return { phases: catalog.phases.slice(startIndex) };
}
