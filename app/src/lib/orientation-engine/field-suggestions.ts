// Reaproveitamento explícito de resposta anterior — ver DOMAIN_MODEL.md e
// ORIENTATION_ENGINE.md. Função pura, nunca persistida, recalculada a cada
// leitura a partir de Answer[] (mesmo padrão de computeHypotheses/
// computeScopeProjection). Só resolve candidatos a partir de
// FieldDefinition.suggestedSource (catalog/validate.ts garante que a
// referência é estruturalmente válida) — não interpreta texto, não gera
// prosa nova, só localiza uma Answer já existente para oferecer como ponto
// de partida editável. `actionLabel`/`helpText` são texto de produto que já
// vive no catálogo — esta função só os repassa, nunca os deriva.
//
// Não decide se o campo já foi "digitado localmente" na tela atual — isso é
// estado de interface (ver ActivityForm.svelte), não de domínio.

import type { Answer, Catalog } from '$lib/domain';

export interface FieldSuggestionView {
	fieldId: string;
	actionLabel: string;
	helpText: string;
	sourceValue: string;
}

export function computeFieldSuggestions(catalog: Catalog, answers: Answer[]): FieldSuggestionView[] {
	const answerValueByField = new Map(answers.map((answer) => [answer.fieldDefinitionId, answer.value]));
	const suggestions: FieldSuggestionView[] = [];

	for (const phase of catalog.phases) {
		for (const activity of phase.activities) {
			if (activity.completionMode !== 'required_fields') continue;

			for (const field of activity.fields) {
				if (field.dataTarget !== 'answer' || !field.suggestedSource) continue;

				// A sugestão só existe enquanto o destino ainda não tem Answer —
				// conteúdo já persistido nunca é sobrescrito por uma sugestão.
				const destinationValue = answerValueByField.get(field.id);
				if (destinationValue && destinationValue.trim().length > 0) continue;

				const sourceValue = answerValueByField.get(field.suggestedSource.fieldId);
				if (!sourceValue || sourceValue.trim().length === 0) continue;

				suggestions.push({
					fieldId: field.id,
					actionLabel: field.suggestedSource.actionLabel,
					helpText: field.suggestedSource.helpText,
					sourceValue
				});
			}
		}
	}

	return suggestions;
}
