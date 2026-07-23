// Catálogo estático — fase Definição do produto (catalogStatus: partial).
// Fonte: docs/core/DOMAIN_MODEL.md §7 (só a primeira atividade está catalogada nesta versão).

import type { ActivityDefinition } from '$lib/domain';

const usuarioPrincipal: ActivityDefinition = {
	id: 'usuario_principal',
	phaseId: 'definicao',
	order: 1,
	title: 'Definir usuário principal',
	mainQuestion: 'Quem é o usuário principal do produto?',
	why: 'Entender quem é o usuário principal ajuda a guiar decisões de funcionalidades, linguagem e experiência desde o início.',
	example: 'Analista de atendimento que recebe e acompanha solicitações internas e externas.',
	completionCriteria: 'Usuário principal descrito com contexto, objetivos e necessidades-chave.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Usuário principal do produto não foi definido',
	pendingItemDetail: 'Impacta decisões de escopo, linguagem e prioridades.',
	fields: [
		{
			id: 'usuario_principal',
			activityId: 'usuario_principal',
			label: 'Quem é o usuário principal do produto?',
			required: true,
			help: 'Descreva contexto, objetivos e necessidades-chave.',
			placeholder: 'Descreva o usuário principal...',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

export const productDefinitionActivities: ActivityDefinition[] = [usuarioPrincipal];
