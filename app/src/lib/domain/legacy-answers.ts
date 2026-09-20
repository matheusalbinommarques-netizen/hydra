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
	// "Confirmar encerramento do projeto" (ETAPA 16, D083) — a atividade
	// `confirmar_encerramento` saiu do catálogo (ver RETIRED_ACTIVITY_IDS);
	// `resumo_encerramento` é só registro legado: nunca vira closedAt nem
	// closureNote (Project.closedAt/closureNote são a fonte de verdade).
	{ activityDefinitionId: 'confirmar_encerramento', fieldDefinitionId: 'resumo_encerramento' },
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
	{ activityDefinitionId: 'mapear_dependencias', fieldDefinitionId: 'dependencias_trabalho' },
	// "Definir marcos" (S9, reconciliação de marcos legados) — a atividade
	// `definir_marcos` deixou de ser required_fields; `marcos_principais` não é
	// mais fonte de verdade (Milestone é, D040/D041, domain/state-types.ts).
	// Snapshots exportados antes dessa mudança ainda carregam essa Answer — ela
	// continua legível, nunca reescrita.
	{ activityDefinitionId: 'definir_marcos', fieldDefinitionId: 'marcos_principais' },
	// "Riscos do projeto"/"Atualizar riscos" (S10, D049 — reconciliação de
	// risco legado, ver docs/core/HYDRA_PRODUCT_REWORK.md §40) — as atividades
	// `riscos_projeto` e `atualizar_riscos` deixaram de ser required_fields;
	// `riscos_identificados`/`resposta_inicial_riscos`/`riscos_atualizados` não
	// são mais fonte de verdade (Risk é, ver domain/state-types.ts). Duas
	// atividades distintas, mesma coleção canônica — nenhum dos três campos
	// tem equivalente individual em Risk (sem parsing/conversão automática).
	// Snapshots exportados antes dessa mudança ainda carregam essas Answers —
	// continuam legíveis, nunca reescritas.
	{ activityDefinitionId: 'riscos_projeto', fieldDefinitionId: 'riscos_identificados' },
	{ activityDefinitionId: 'riscos_projeto', fieldDefinitionId: 'resposta_inicial_riscos' },
	{ activityDefinitionId: 'atualizar_riscos', fieldDefinitionId: 'riscos_atualizados' },
	// "Registrar decisões e mudanças" (S11, ETAPA 11 do rework — "Decision e
	// Change", §41) — a atividade `decisoes_mudancas` deixou de ser
	// required_fields; `decisoes_mudancas_recentes` não é mais fonte de
	// verdade (Decision e Change são, ver domain/state-types.ts). Um único
	// campo legado misturava os dois conceitos — nenhum tem equivalente
	// individual nele (sem parsing/conversão automática, sem split). Snapshots
	// exportados antes dessa mudança ainda carregam essa Answer — ela
	// continua legível, nunca reescrita.
	{ activityDefinitionId: 'decisoes_mudancas', fieldDefinitionId: 'decisoes_mudancas_recentes' }
];

export function isDeprecatedAnswerField(activityDefinitionId: string, fieldDefinitionId: string): boolean {
	return DEPRECATED_ANSWER_FIELDS.some(
		(field) =>
			field.activityDefinitionId === activityDefinitionId && field.fieldDefinitionId === fieldDefinitionId
	);
}

// Atividades removidas do catálogo (não participam de próxima atividade, fase
// nem status), cujo ActivityProgress persistido continua aceito e preservado.
// Mínimo para o contrato de S16 — sem framework de migração.
export const RETIRED_ACTIVITY_IDS: readonly string[] = ['confirmar_encerramento'];

export function isRetiredActivityId(activityDefinitionId: string): boolean {
	return RETIRED_ACTIVITY_IDS.includes(activityDefinitionId);
}
