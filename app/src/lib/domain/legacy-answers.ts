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
	{ activityDefinitionId: 'estado_atual', fieldDefinitionId: 'estado_atual_detail' },
	// "Resultado desejado" (Stage 4C do rework, ver catalog/discovery.ts) — a
	// atividade `resultado` deixou de ser required_fields; `mudanca`/
	// `beneficiario`/`percepcao` não são mais fonte de verdade (DesiredOutcome
	// é, ver domain/state-types.ts). `beneficiario`/`percepcao` não têm
	// equivalente no objeto vivo novo (AffectedGroup já representa quem é
	// afetado) — os três seguem READ-LEGACY juntos, nunca promovidos.
	// Snapshots exportados antes dessa mudança ainda carregam essas Answers —
	// continuam legíveis, nunca reescritas.
	{ activityDefinitionId: 'resultado', fieldDefinitionId: 'mudanca' },
	{ activityDefinitionId: 'resultado', fieldDefinitionId: 'beneficiario' },
	{ activityDefinitionId: 'resultado', fieldDefinitionId: 'percepcao' },
	// "Decompor o trabalho" (S9, D045 — reconciliação da decomposição legada)
	// — a atividade `decompor_trabalho` deixou de ser required_fields;
	// `partes_trabalho` não é mais fonte de verdade (WorkItem é, D045,
	// domain/state-types.ts). CORREÇÃO DE COMPATIBILIDADE: esta entrada foi
	// prometida pelo próprio D045 (`partes_trabalho`/PlanningItem "continuam
	// legíveis em Answer, Agora e Registros, e preservados integralmente em
	// export/import"), mas nunca foi registrada aqui — um snapshot anterior a
	// D045 com essa Answer era recusado na desserialização, porque
	// `decompor_trabalho` não é mais `required_fields` (ver checagem em
	// domain/serialization.ts). Descoberto durante S9 ao corrigir o mesmo
	// sintoma para `dependencias_trabalho` abaixo; não é decisão nova, só
	// cumpre o contrato já publicado.
	{ activityDefinitionId: 'decompor_trabalho', fieldDefinitionId: 'partes_trabalho' },
	// "Mapear dependências" (S9, reconciliação de dependências legadas) — a
	// atividade `mapear_dependencias` deixou de ser required_fields;
	// `dependencias_trabalho` não é mais fonte de verdade (Dependency é, D039,
	// domain/state-types.ts). Snapshots exportados antes dessa mudança ainda
	// carregam essa Answer — ela continua legível, nunca reescrita.
	{ activityDefinitionId: 'mapear_dependencias', fieldDefinitionId: 'dependencias_trabalho' }
];

export function isDeprecatedAnswerField(activityDefinitionId: string, fieldDefinitionId: string): boolean {
	return DEPRECATED_ANSWER_FIELDS.some(
		(field) =>
			field.activityDefinitionId === activityDefinitionId && field.fieldDefinitionId === fieldDefinitionId
	);
}
