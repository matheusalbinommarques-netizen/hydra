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

const funcionalidadesEssenciais: ActivityDefinition = {
	id: 'funcionalidades_essenciais',
	phaseId: 'definicao',
	order: 3,
	title: 'Definir funcionalidades essenciais',
	mainQuestion: 'Quais funcionalidades são indispensáveis para entregar a visão do produto?',
	why: 'Definir o essencial ajuda a proteger o foco do produto e evita que a primeira versão cresça antes de comprovar seu valor principal.',
	example: 'Para uma plataforma guiada de gestão de projetos, as funcionalidades essenciais podem ser criar um projeto, responder atividades metodológicas, visualizar a próxima ação e registrar pendências.',
	completionCriteria: 'Funcionalidades essenciais e o valor entregue ao usuário descritos de forma coerente com a visão do produto.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Funcionalidades essenciais não foram definidas',
	pendingItemDetail: 'Sem uma definição do que é essencial, o escopo inicial pode crescer sem conexão clara com o valor central do produto.',
	fields: [
		{
			id: 'funcionalidades_essenciais',
			activityId: 'funcionalidades_essenciais',
			label: 'Quais funcionalidades são essenciais?',
			required: true,
			help: 'Liste apenas as funcionalidades necessárias para entregar o valor central do produto.',
			placeholder: 'Ex.: criar projeto, orientar a próxima atividade e registrar decisões',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'valor_entregue',
			activityId: 'funcionalidades_essenciais',
			label: 'Que valor essas funcionalidades entregam ao usuário?',
			required: true,
			help: 'Relacione as funcionalidades com a necessidade e o benefício definidos na visão do produto.',
			placeholder: 'Ex.: ajudam o usuário a estruturar o projeto e avançar sem depender de conhecimento avançado',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'fora_escopo_inicial',
			activityId: 'funcionalidades_essenciais',
			label: 'O que pode ficar fora da primeira versão?',
			required: false,
			help: 'Registre funcionalidades interessantes, mas que não são necessárias para validar o valor central.',
			placeholder: 'Ex.: colaboração em equipe, integrações externas e automações com IA',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const priorizarPrimeiraVersao: ActivityDefinition = {
	id: 'priorizar_primeira_versao',
	phaseId: 'definicao',
	order: 4,
	title: 'Priorizar primeira versão',
	mainQuestion: 'O que entra na primeira versão do produto, o que fica para depois, e qual hipótese esse recorte vai validar?',
	why: 'Priorizar o recorte inicial evita que a primeira versão cresça antes de validar se a proposta realmente entrega o valor esperado.',
	example: 'Primeira versão: criar projeto e responder a Descoberta guiada. Depois: fases avançadas de planejamento detalhado. Hipótese: profissionais iniciantes conseguem avançar sozinhos só com a orientação contextual.',
	completionCriteria: 'O que entra, o que fica para depois e a hipótese a validar estão descritos de forma coerente com a visão e as funcionalidades essenciais já definidas.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Primeira versão do produto não foi priorizada',
	pendingItemDetail: 'Sem esse recorte, o projeto corre o risco de tentar entregar tudo de uma vez, sem validar o essencial primeiro.',
	fields: [
		{
			id: 'entra_primeira_versao',
			activityId: 'priorizar_primeira_versao',
			label: 'O que entra na primeira versão?',
			required: true,
			help: 'Liste só o que é necessário para validar o valor central.',
			placeholder: 'Ex.: criar projeto e completar a jornada guiada de Descoberta',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'fica_para_depois',
			activityId: 'priorizar_primeira_versao',
			label: 'O que fica para depois?',
			required: true,
			help: 'Registre o que é interessante, mas não indispensável agora.',
			placeholder: 'Ex.: relatórios avançados, integrações externas',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'hipotese_validada',
			activityId: 'priorizar_primeira_versao',
			label: 'Qual hipótese será validada com esse recorte?',
			required: true,
			help: 'Descreva o que você espera confirmar ao lançar essa primeira versão.',
			placeholder: 'Ex.: usuários conseguem concluir a jornada sem ajuda externa',
			dataTarget: 'answer',
			semanticRole: 'hypothesis',
			type: 'texto_longo'
		}
	]
};

const criteriosSucessoProduto: ActivityDefinition = {
	id: 'criterios_sucesso_produto',
	phaseId: 'definicao',
	order: 5,
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
	funcionalidadesEssenciais,
	priorizarPrimeiraVersao,
	criteriosSucessoProduto
];
