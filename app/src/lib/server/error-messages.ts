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
		default:
			return 'Não foi possível concluir a operação.';
	}
}
