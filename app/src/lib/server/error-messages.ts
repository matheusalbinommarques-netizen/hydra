// Tradução de UseCaseError para mensagens compreensíveis — central, para não
// duplicar o mapeamento em cada rota. Nunca expõe stack trace ou SQL.

import type { UseCaseError } from './application';

export function mapUseCaseError(error: UseCaseError): string {
	switch (error.kind) {
		case 'project_not_found':
			return 'Projeto não encontrado.';
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
		case 'impediment_not_found':
			return 'Impedimento não encontrado.';
		case 'impediment_id_already_exists':
			return 'Já existe um impedimento com este identificador.';
		case 'phase_not_found':
			return 'A fase escolhida não existe mais no catálogo.';
		case 'planning_no_items':
			return 'Adicione ao menos uma parte em "Decompor o trabalho" antes de confirmar a prioridade.';
		case 'affected_group_not_found':
			return 'Grupo afetado não encontrado.';
		case 'affected_group_confirmation_invalid':
			return 'Adicione ao menos um grupo e classifique impacto e frequência antes de concluir o mapa.';
		case 'affected_group_has_references':
			return 'Este grupo tem uma validação ou evidência relacionada e não pode ser removido.';
		case 'external_action_not_found':
			return 'Ação externa não encontrada.';
		case 'external_action_duplicate_open':
			return 'Já existe uma validação em campo para este grupo.';
		case 'external_action_not_open':
			return 'Esta ação já foi concluída.';
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
		case 'desired_outcome_confirmation_invalid':
			return 'Adicione ao menos uma mudança esperada antes de confirmar o resultado.';
		default:
			return 'Não foi possível concluir a operação.';
	}
}
