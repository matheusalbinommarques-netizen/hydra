// Tradução de UseCaseError para mensagens compreensíveis — central, para não
// duplicar o mapeamento em cada rota. Nunca expõe stack trace ou SQL.

import type { UseCaseError } from './application';

export function mapUseCaseError(error: UseCaseError): string {
	switch (error.kind) {
		case 'project_not_found':
			return 'Projeto não encontrado.';
		case 'document_snapshot_not_found':
			return 'Versão do Documento não encontrada.';
		case 'invalid_import':
			return 'O arquivo selecionado não é um JSON de projeto válido.';
		case 'import_id_collision':
			return `Já existe um projeto com o identificador "${error.projectId}".`;
		case 'activity_not_found':
			return 'Atividade não encontrada.';
		case 'wrong_completion_mode':
			return 'Esta atividade não aceita respostas neste formato.';
		case 'activity_not_skippable':
			return 'Esta atividade não pode ser pulada.';
		case 'unknown_field':
			return 'Um dos campos enviados não pertence a esta atividade.';
		case 'transition_not_allowed':
			return 'Esta ação não é permitida neste momento.';
		case 'scope_item_not_found':
			return 'Item de escopo não encontrado.';
		case 'scope_reorder_mismatch':
			return 'A nova ordem enviada não corresponde aos itens atuais de "Agora".';
		case 'scope_confirmation_invalid':
			return 'Ainda faltam critérios para confirmar esta versão.';
		case 'scope_item_not_agora':
			return 'Somente itens de "Agora" têm status de execução.';
		case 'scope_version_not_confirmed':
			return 'Confirme a versão do escopo antes de alterar o status de execução.';
		case 'deliverable_not_found':
			return 'Entrega não encontrada.';
		case 'deliverable_reorder_mismatch':
			return 'A nova ordem enviada não corresponde às entregas atuais do recorte.';
		case 'deliverable_already_promoted':
			return 'Este item já virou uma entrega. Abra Entregas para editá-la.';
		case 'impediment_not_found':
			return 'Impedimento não encontrado.';
		case 'impediment_id_already_exists':
			return 'Já existe um impedimento com este identificador.';
		case 'impediment_decision_requires_pending_type':
			return 'Só é possível relacionar uma decisão a um impedimento do tipo "Decisão pendente".';
		case 'impediment_type_change_blocked_by_decision':
			return 'Remova a decisão relacionada antes de mudar o tipo deste impedimento.';
		case 'work_item_not_found':
			return 'Item de trabalho não encontrado.';
		case 'work_item_blocked':
			return 'Marque o impedimento como resolvido antes de concluir este item.';
		case 'work_item_schedule_incomplete':
			return 'Informe início e duração juntos, ou deixe os dois em branco.';
		case 'work_item_planned_start_invalid':
			return 'Informe uma data de início válida (dia, mês e ano).';
		case 'work_item_duration_invalid':
			return 'A duração deve ser um número inteiro de dias, maior ou igual a 1.';
		case 'work_item_precedence_date_overflow':
			return 'O replanejamento levaria uma data além do limite representável (ano 9999). Nada foi alterado.';
		case 'work_item_precedence_stale_preview':
			return 'O cronograma mudou desde este preview. Gere o replanejamento novamente antes de confirmar.';
		case 'schedule_baseline_no_eligible_work_items':
			return 'Nenhum item de trabalho tem cronograma completo ainda — defina início e duração antes de capturar uma referência.';
		case 'schedule_baseline_precedence_conflict':
			return 'Um item de trabalho que entraria na referência tem um conflito de precedência conhecido. Resolva o conflito antes de capturar.';
		case 'schedule_baseline_stale_preview':
			return 'O cronograma mudou desde este preview. Gere a prévia novamente antes de confirmar a referência.';
		case 'dependency_not_found':
			return 'Dependência não encontrada.';
		case 'dependency_self_reference':
			return 'Um item de trabalho não pode depender dele mesmo.';
		case 'dependency_already_exists':
			return 'Esta dependência já foi registrada.';
		case 'dependency_cycle':
			return 'Esta dependência criaria um ciclo: o outro item já depende deste, direta ou indiretamente.';
		case 'milestone_not_found':
			return 'Marco não encontrado.';
		case 'milestone_planned_date_invalid':
			return 'Informe uma data válida (dia, mês e ano).';
		case 'milestone_work_item_not_found':
			return 'Trabalho relacionado não encontrado.';
		case 'milestone_work_item_already_linked':
			return 'Este trabalho já está relacionado a este marco.';
		case 'phase_not_found':
			return 'A fase escolhida não existe mais no catálogo.';
		case 'decomposition_no_work_items':
			return 'Crie ao menos um item de trabalho (WorkItem), em Entregas ou em Trabalho, antes de confirmar.';
		case 'priorization_no_deliverables':
			return 'Crie ao menos uma entrega (Deliverable) em Entregas antes de confirmar a prioridade.';
		case 'affected_group_not_found':
			return 'Grupo afetado não encontrado.';
		case 'affected_group_confirmation_invalid':
			return 'Adicione ao menos um grupo e classifique impacto e frequência antes de concluir o mapa.';
		case 'affected_group_has_references':
			return 'Este grupo tem uma validação ou evidência relacionada e não pode ser removido.';
		case 'external_action_not_found':
			return 'Ação externa não encontrada.';
		case 'external_action_duplicate_open':
			return 'Já existe uma ação externa aberta para este item.';
		case 'external_action_not_open':
			return 'Esta ação já foi concluída.';
		case 'external_action_wrong_kind':
			return 'Esta operação não se aplica a este tipo de ação externa.';
		case 'evidence_learning_required':
			return 'Descreva o que você aprendeu antes de salvar a evidência.';
		case 'treatment_step_not_found':
			return 'Passo não encontrado.';
		case 'treatment_confirmation_invalid':
			return 'Adicione ao menos um passo ou marque "Hoje não existe um tratamento definido" antes de continuar.';
		case 'cause_hypothesis_not_found':
			return 'Hipótese não encontrada.';
		case 'cause_exploration_has_hypotheses':
			return 'Remova as hipóteses registradas antes de marcar "ainda não sabemos".';
		case 'evidence_not_found':
			return 'Evidência não encontrada.';
		case 'desired_outcome_not_found':
			return 'Resultado desejado não encontrado.';
		case 'desired_outcome_assessment_state_invalid':
			return 'Escolha um dos estados de avaliação disponíveis.';
		case 'desired_outcome_assessment_rationale_required':
			return 'Registre o racional da avaliação.';
		case 'desired_outcome_confirmation_invalid':
			return 'Adicione ao menos uma mudança esperada antes de confirmar o resultado.';
		case 'risk_not_found':
			return 'Risco não encontrado.';
		case 'risk_statement_required':
			return 'Descreva o risco antes de salvar.';
			case 'risk_assessment_incomplete':
			return 'Informe probabilidade e impacto juntos, ou deixe os dois em branco.';
		case 'decision_not_found':
			return 'Decisão não encontrada.';
		case 'decision_subject_required':
			return 'Descreva o que precisa ser decidido antes de salvar.';
		case 'decision_due_date_invalid':
			return 'Prazo inválido.';
		case 'decision_already_decided':
			return 'Esta decisão já foi tomada.';
		case 'decision_not_decided':
			return 'Esta decisão ainda não foi tomada.';
		case 'decision_outcome_required':
			return 'Descreva o resultado da decisão antes de salvar.';
		case 'decision_work_item_not_found':
			return 'Trabalho afetado não encontrado.';
		case 'decision_work_item_already_linked':
			return 'Este trabalho já está relacionado a esta decisão.';
		case 'change_not_found':
			return 'Mudança não encontrada.';
		case 'change_statement_required':
			return 'Descreva o que mudou antes de salvar.';
		default:
			return 'Não foi possível concluir a operação.';
	}
}
