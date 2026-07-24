// Projeção de hipóteses — ver docs/06-architecture/contracts.md §8
// e docs/core/ORIENTATION_ENGINE.md §8. Nenhuma entidade própria é consultada.

import type { Answer, Catalog } from '$lib/domain';
import { findFieldDefinition } from './catalog-lookup';

export interface HypothesisView {
	text: string;
}

export function computeHypotheses(catalog: Catalog, answers: Answer[]): HypothesisView[] {
	const views: HypothesisView[] = [];
	for (const answer of answers) {
		if (answer.value.trim().length === 0) continue;
		const field = findFieldDefinition(catalog, answer.activityDefinitionId, answer.fieldDefinitionId);
		if (field && field.dataTarget === 'answer' && field.semanticRole === 'hypothesis') {
			views.push({ text: answer.value });
		}
	}
	return views;
}
