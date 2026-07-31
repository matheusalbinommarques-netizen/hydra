// Recomendação de rota (D024, docs/07-management/decision-log.md) — projeção
// pura e determinística, separada de route.ts: não conhece ProjectState nem
// Catalog, não persiste nada. Perguntas, rótulos de fase e descrições de
// estrutura são conteúdo de produto e vêm do chamador
// (route-diagnostic-questions.ts), nunca daqui.

export interface RouteRecommendationEntry {
	phaseId: string;
	phaseLabel: string;
	structureLabel: string;
	answer: boolean;
}

export interface RouteRecommendationFallback {
	phaseId: string;
	phaseLabel: string;
}

export interface RouteRecommendation {
	phaseId: string;
	phaseLabel: string;
	justification: string;
}

export function computeRouteStartRecommendation(
	entries: RouteRecommendationEntry[],
	fallback: RouteRecommendationFallback
): RouteRecommendation {
	const firstGap = entries.find((entry) => !entry.answer);
	if (firstGap) {
		return {
			phaseId: firstGap.phaseId,
			phaseLabel: firstGap.phaseLabel,
			justification: `Ainda não há confirmação de que: ${firstGap.structureLabel}`
		};
	}

	return {
		phaseId: fallback.phaseId,
		phaseLabel: fallback.phaseLabel,
		justification: 'Todas as estruturas anteriores estão confirmadas — o projeto está pronto para validação e encerramento.'
	};
}
