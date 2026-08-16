// Registro mínimo de campos de Answer oficialmente deprecados — existe só
// para permitir que um snapshot/export feito ANTES de um campo sair do
// catálogo continue importável (READ-LEGACY, ver domain/serialization.ts):
// o dado é preservado tal como estava, nunca usado como fonte de verdade,
// nunca convertido automaticamente em nenhum objeto novo. Não é um
// framework de migração — é uma lista explícita, checada em dois pontos
// precisos de assembleProjectState (validação de Answer e invariante de
// conclusão da atividade correspondente). Reaproveitável: um próximo campo
// deprecado só precisa de uma entrada nova aqui.

export interface DeprecatedAnswerField {
	activityDefinitionId: string;
	fieldDefinitionId: string;
}

export const DEPRECATED_ANSWER_FIELDS: readonly DeprecatedAnswerField[] = [
	// "Quem é afetado" (ETAPA 2 do rework, ver catalog/discovery.ts) — a
	// atividade `publico` deixou de ser required_fields; `publico_detail`
	// não é mais fonte de verdade (AffectedGroup é, ver
	// domain/state-types.ts). Snapshots exportados antes dessa mudança ainda
	// carregam essa Answer — ela continua legível, nunca reescrita.
	{ activityDefinitionId: 'publico', fieldDefinitionId: 'publico_detail' },
	// "Como é tratado hoje" (Stage 4A do rework, ver catalog/discovery.ts) —
	// a atividade `estado_atual` deixou de ser required_fields;
	// `estado_atual_detail` não é mais fonte de verdade (CurrentTreatment/
	// TreatmentStep são, ver domain/state-types.ts). Snapshots exportados
	// antes dessa mudança ainda carregam essa Answer — ela continua legível,
	// nunca reescrita.
	{ activityDefinitionId: 'estado_atual', fieldDefinitionId: 'estado_atual_detail' }
];

export function isDeprecatedAnswerField(activityDefinitionId: string, fieldDefinitionId: string): boolean {
	return DEPRECATED_ANSWER_FIELDS.some(
		(field) =>
			field.activityDefinitionId === activityDefinitionId && field.fieldDefinitionId === fieldDefinitionId
	);
}
