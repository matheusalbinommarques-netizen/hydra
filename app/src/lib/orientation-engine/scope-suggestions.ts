// Prova pequena "seleção estruturada → sugestão explicada → ScopeItem" — ver
// docs/core/ORIENTATION_ENGINE.md. Função pura, nunca persistida, recalculada
// a cada leitura a partir de Answer[]/ScopeItem[] (mesmo padrão de
// computeScopeProjection/computeHypotheses). Exatamente duas regras
// explícitas e específicas — deliberadamente não é uma tabela configurável
// de sinal→sugestão; se uma terceira regra ou um segundo sinal-fonte
// aparecer, isso é o sinal para reconsiderar o desenho, não para acumular
// mais `if`s aqui silenciosamente.

import { decodeMultiSelectValue } from '$lib/domain';
import type { Answer, ScopeItem } from '$lib/domain';

export interface ScopeSuggestionView {
	id: string;
	title: string;
	reason: string;
}

// Fonte fixa: o campo de sinais da atividade "Problema ou oportunidade"
// (catalog/discovery.ts). Específico de propósito — não genérico.
const SIGNALS_FIELD_ID = 'sinais_situacao';

export function computeScopeSuggestions(answers: Answer[], scopeItems: ScopeItem[]): ScopeSuggestionView[] {
	const signalsAnswer = answers.find((answer) => answer.fieldDefinitionId === SIGNALS_FIELD_ID);
	const signals = signalsAnswer ? (decodeMultiSelectValue(signalsAnswer.value) ?? []) : [];

	const alreadyAccepted = new Set(
		scopeItems.map((item) => item.sourceSuggestionId).filter((id): id is string => id !== null)
	);

	const suggestions: ScopeSuggestionView[] = [];

	if (signals.includes('duplicated_information')) {
		suggestions.push({
			id: 'reuse_existing_information',
			title: 'Reaproveitar informações já registradas',
			reason: 'Sugerido porque você indicou informação duplicada.'
		});
	}

	if (signals.includes('too_many_steps')) {
		suggestions.push({
			id: 'combine_redundant_steps',
			title: 'Reduzir ou combinar etapas redundantes',
			reason: 'Sugerido porque você indicou excesso de etapas.'
		});
	}

	return suggestions.filter((suggestion) => !alreadyAccepted.has(suggestion.id));
}
