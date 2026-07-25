// Projeção de hipóteses — ver docs/06-architecture/contracts.md §8
// e docs/core/ORIENTATION_ENGINE.md §8. Nenhuma entidade própria é consultada.

import type { Answer, Catalog, ScopeVersion } from '$lib/domain';
import { findFieldDefinition } from './catalog-lookup';

export interface HypothesisView {
	text: string;
}

/**
 * scopeVersion é opcional para não quebrar chamadas existentes que só se
 * importam com hipóteses de Answer — quando presente e confirmada, sua
 * hipótese entra na lista, deduplicada por texto contra as de Answer.
 */
export function computeHypotheses(
	catalog: Catalog,
	answers: Answer[],
	scopeVersion?: ScopeVersion
): HypothesisView[] {
	const seen = new Set<string>();
	const views: HypothesisView[] = [];
	for (const answer of answers) {
		if (answer.value.trim().length === 0) continue;
		const field = findFieldDefinition(catalog, answer.activityDefinitionId, answer.fieldDefinitionId);
		if (field && field.dataTarget === 'answer' && field.semanticRole === 'hypothesis') {
			if (seen.has(answer.value)) continue;
			seen.add(answer.value);
			views.push({ text: answer.value });
		}
	}

	if (scopeVersion?.confirmedAt && scopeVersion.hypothesis.trim().length > 0 && !seen.has(scopeVersion.hypothesis)) {
		views.push({ text: scopeVersion.hypothesis });
	}

	return views;
}
