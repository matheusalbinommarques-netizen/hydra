// Catálogo estático — fase Definição do produto (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7.

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

const visaoProduto: ActivityDefinition = {
	id: 'visao_produto',
	phaseId: 'definicao',
	order: 2,
	title: 'Definir visão do produto',
	mainQuestion: 'Qual produto estamos construindo e qual valor central ele entrega?',
	why: 'Uma visão clara conecta o usuário, sua necessidade e o valor esperado, evitando que o produto vire apenas uma lista desconectada de funcionalidades.',
	example: 'Plataforma web de gestão de projetos que orienta profissionais iniciantes sobre a próxima decisão, ajudando-os a estruturar e conduzir projetos com clareza e autonomia.',
	completionCriteria: 'Tipo de produto, necessidade central e benefício principal definidos de forma coerente.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Visão do produto não foi definida',
	pendingItemDetail: 'Sem uma visão clara, funcionalidades e prioridades podem perder conexão com o valor esperado para o usuário.',
	fields: [
		{
			id: 'tipo_produto',
			activityId: 'visao_produto',
			label: 'Que tipo de produto será?',
			required: true,
			help: 'Descreva a categoria ou formato principal da solução.',
			placeholder: 'Ex.: aplicativo web para planejamento de projetos',
			dataTarget: 'answer',
			type: 'texto_curto'
		},
		{
			id: 'necessidade_central',
			activityId: 'visao_produto',
			label: 'Qual necessidade principal esse produto atende?',
			required: true,
			help: 'Foque na necessidade do usuário, não em uma lista de funcionalidades.',
			placeholder: 'Ex.: saber o que fazer em seguida sem depender de conhecimento avançado',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'beneficio_central',
			activityId: 'visao_produto',
			label: 'Qual benefício principal o produto deve entregar?',
			required: true,
			help: 'Descreva a transformação ou resultado esperado para o usuário.',
			placeholder: 'Ex.: conduzir projetos com mais clareza, consistência e autonomia',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'diferencial',
			activityId: 'visao_produto',
			label: 'O que diferencia essa proposta das alternativas atuais?',
			required: false,
			help: 'Pode ser uma abordagem, experiência ou princípio do produto.',
			placeholder: 'Ex.: orientação contextual em vez de apenas ferramentas soltas',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const escolhaProximoFoco: ActivityDefinition = {
	id: 'montar_proxima_versao',
	phaseId: 'definicao',
	order: 3,
	title: 'Escolha o próximo foco',
	mainQuestion: 'O que deve ser feito agora, o que pode esperar, e o que não pertence a este recorte?',
	why: 'Organizar o escopo em Agora, Depois e Fora — com tamanho e ordem só para o que está em Agora — protege o foco do próximo passo e evita tentar avançar tudo ao mesmo tempo antes de validar o essencial.',
	example: 'Agora: criar projeto e completar a jornada guiada (1º, tamanho pequeno). Depois: relatórios avançados. Fora: integrações externas. Hipótese: profissionais iniciantes conseguem avançar sozinhos só com a orientação contextual.',
	completionCriteria: 'Recorte confirmado — pelo menos um item em Agora, todos os itens de Agora com tamanho definido, e hipótese preenchida.',
	completionMode: 'scope_confirmation',
	allowsSkip: false
};

const criteriosSucessoProduto: ActivityDefinition = {
	id: 'criterios_sucesso_produto',
	phaseId: 'definicao',
	order: 4,
	title: 'Definir critérios de sucesso do produto',
	mainQuestion: 'Como você vai perceber se essa proposta entregou valor?',
	why: 'Critérios de sucesso claros evitam que o julgamento sobre a primeira versão fique subjetivo ou seja adiado indefinidamente.',
	example: 'Sinal de sucesso: usuários concluem a jornada guiada sem abandonar no meio. Evidência: taxa de conclusão da Descoberta. Condição mínima: pelo menos um usuário real completa o fluxo e confirma que entendeu o que fazer.',
	completionCriteria: 'Sinais de sucesso, evidências ou indicadores e a condição mínima de validação estão definidos.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Critérios de sucesso do produto não foram definidos',
	pendingItemDetail: 'Sem critérios claros, fica difícil saber se a primeira versão realmente validou a proposta.',
	fields: [
		{
			id: 'sinais_sucesso',
			activityId: 'criterios_sucesso_produto',
			label: 'Quais são os sinais de sucesso?',
			required: true,
			help: 'Descreva o que indicaria que a proposta está funcionando.',
			placeholder: 'Ex.: usuários voltam a usar o produto sem serem lembrados',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'evidencias_indicadores',
			activityId: 'criterios_sucesso_produto',
			label: 'Que evidências ou indicadores mostrarão isso?',
			required: true,
			help: 'Podem ser qualitativos ou quantitativos.',
			placeholder: 'Ex.: taxa de conclusão da jornada, feedback direto dos usuários',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'condicao_minima_validacao',
			activityId: 'criterios_sucesso_produto',
			label: 'Qual é a condição mínima para considerar a primeira versão validada?',
			required: true,
			help: 'Defina um limite objetivo, mesmo que simples.',
			placeholder: 'Ex.: pelo menos um usuário real completa o fluxo com sucesso',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

export const productDefinitionActivities: ActivityDefinition[] = [
	usuarioPrincipal,
	visaoProduto,
	escolhaProximoFoco,
	criteriosSucessoProduto
];
