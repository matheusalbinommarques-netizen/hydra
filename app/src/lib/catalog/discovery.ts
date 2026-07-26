// Catálogo estático — fase Descoberta (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7, docs/core/RELEASE_0_SPEC.md §4.2–4.7.

import type { ActivityDefinition } from '$lib/domain';

// Agrupa os campos opcionais menos usados de "Problema ou oportunidade" numa
// seção expansível — situação e sinais continuam sempre visíveis.
const MAIS_CONTEXTO_GROUP = { id: 'mais_contexto', label: 'Adicionar mais contexto' };

const origem: ActivityDefinition = {
	id: 'origem',
	phaseId: 'descoberta',
	order: 1,
	title: 'Origem do projeto',
	mainQuestion: 'O que deu origem a este projeto?',
	why: 'Saber a origem ajuda o Hydra a calibrar o tom das próximas perguntas e a profundidade necessária.',
	example: 'Uma solicitação recorrente da equipe de atendimento virou este projeto.',
	completionCriteria: 'A origem do projeto identificada.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Origem do projeto não foi definida',
	pendingItemDetail: 'Ajuda o Hydra a calibrar o tom e a profundidade das próximas perguntas.',
	fields: [
		{
			id: 'origem',
			activityId: 'origem',
			label: 'O que deu origem a este projeto?',
			required: true,
			help: 'Selecione a opção mais próxima.',
			dataTarget: 'answer',
			type: 'selecao',
			options: [
				'Um problema',
				'Uma oportunidade',
				'Uma solicitação',
				'Uma ideia de produto',
				'Uma solução já iniciada',
				'Outro'
			]
		}
	]
};

const contexto: ActivityDefinition = {
	id: 'contexto',
	phaseId: 'descoberta',
	order: 2,
	title: 'Contexto inicial',
	mainQuestion: 'Um mínimo de contexto para começar sem formulário pesado.',
	why: 'Esse contexto ajuda o Hydra a calibrar a profundidade das próximas atividades.',
	example: 'Portal de Solicitações, projeto individual, primeira vez liderando um projeto, ainda em ideia.',
	completionCriteria: 'Nome, descrição, formato de trabalho, experiência e estágio atual informados.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Contexto inicial não foi detalhado',
	pendingItemDetail: 'Sem esse contexto, as próximas atividades podem pedir mais detalhe do que o necessário.',
	fields: [
		{
			id: 'nome_provisorio',
			activityId: 'contexto',
			label: 'Nome provisório do projeto',
			required: true,
			help: 'Pode ser alterado depois.',
			placeholder: 'Ex.: Portal de Solicitações',
			dataTarget: 'project_property',
			projectProperty: 'name',
			type: 'texto_curto'
		},
		{
			id: 'breve_descricao',
			activityId: 'contexto',
			label: 'Breve descrição',
			required: true,
			help: 'Uma ou duas frases já ajudam.',
			placeholder: 'Descreva brevemente o projeto...',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'modo_trabalho',
			activityId: 'contexto',
			label: 'Trabalho individual ou em equipe?',
			required: true,
			dataTarget: 'answer',
			type: 'selecao',
			options: ['Individual', 'Em equipe']
		},
		{
			id: 'nivel_experiencia',
			activityId: 'contexto',
			label: 'Qual seu nível de experiência com gestão de projetos?',
			required: true,
			dataTarget: 'answer',
			type: 'selecao',
			options: ['Iniciante', 'Intermediário', 'Experiente']
		},
		{
			id: 'estagio_atual',
			activityId: 'contexto',
			label: 'Qual o estágio atual?',
			required: true,
			dataTarget: 'answer',
			type: 'selecao',
			options: ['Ideia inicial', 'Em planejamento', 'Já em execução']
		}
	]
};

const problema: ActivityDefinition = {
	id: 'problema',
	phaseId: 'descoberta',
	order: 3,
	title: 'Problema ou oportunidade',
	mainQuestion: 'Qual situação precisa mudar?',
	why: 'Entender bem o problema é o que garante uma solução certeira. Quanto mais claro agora, menor o risco depois.',
	example: 'Hoje as solicitações internas chegam por e-mail e mensagens, sem prioridade ou histórico centralizado.',
	completionCriteria: 'O usuário descreveu o que acontece e por que a situação é problemática.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Problema ou oportunidade não foi detalhado',
	pendingItemDetail: 'As recomendações seguintes podem ser menos precisas sem essa informação.',
	fields: [
		{
			id: 'situacao',
			activityId: 'problema',
			label: 'Qual situação precisa mudar?',
			required: true,
			help: 'Descreva o problema de forma clara e objetiva.',
			placeholder: 'Descreva a situação atual e o que precisa mudar...',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'sinais_situacao',
			activityId: 'problema',
			label: 'Quais sinais representam melhor a situação?',
			required: true,
			help: 'Selecione os sinais que melhor descrevem o obstáculo — pode escolher mais de um.',
			dataTarget: 'answer',
			type: 'selecao_multipla',
			options: [
				{ id: 'too_many_steps', label: 'Excesso de etapas' },
				{ id: 'duplicated_information', label: 'Informação duplicada' },
				{ id: 'rework', label: 'Retrabalho' },
				{ id: 'lack_of_clarity', label: 'Falta de clareza' },
				{ id: 'dispersed_decisions', label: 'Decisões dispersas' },
				{ id: 'insufficient_tracking', label: 'Acompanhamento insuficiente' },
				{ id: 'other', label: 'Outro' }
			]
		},
		{
			id: 'sinais_situacao_outro',
			activityId: 'problema',
			label: 'Descreva o sinal "Outro"',
			required: false,
			help: 'Não alimenta nenhuma regra nesta prova.',
			placeholder: 'Descreva o sinal...',
			dataTarget: 'answer',
			type: 'texto_curto',
			revealWhen: { fieldId: 'sinais_situacao', optionId: 'other' }
		},
		{
			id: 'evidencias',
			activityId: 'problema',
			label: 'Evidências',
			required: false,
			placeholder: 'Dados, exemplos ou registros que comprovam o problema...',
			dataTarget: 'answer',
			type: 'texto_longo',
			optionalGroup: MAIS_CONTEXTO_GROUP
		},
		{
			id: 'consequencias',
			activityId: 'problema',
			label: 'Consequências de não agir',
			required: false,
			placeholder: 'O que acontece se essa situação continuar...',
			dataTarget: 'answer',
			type: 'texto_longo',
			optionalGroup: MAIS_CONTEXTO_GROUP
		},
		{
			id: 'hipotese_opt',
			activityId: 'problema',
			label: 'Hipótese',
			required: false,
			placeholder: 'Suposições que ainda precisam ser validadas...',
			dataTarget: 'answer',
			semanticRole: 'hypothesis',
			type: 'texto_longo',
			optionalGroup: MAIS_CONTEXTO_GROUP
		},
		{
			id: 'solucao_imaginada',
			activityId: 'problema',
			label: 'Solução imaginada',
			required: false,
			placeholder: 'Se já tem uma ideia de solução, descreva aqui...',
			dataTarget: 'answer',
			type: 'texto_longo',
			optionalGroup: MAIS_CONTEXTO_GROUP
		},
		{
			id: 'observacoes',
			activityId: 'problema',
			label: 'Observações',
			required: false,
			dataTarget: 'answer',
			type: 'texto_longo',
			optionalGroup: MAIS_CONTEXTO_GROUP
		}
	]
};

const publico: ActivityDefinition = {
	id: 'publico',
	phaseId: 'descoberta',
	order: 4,
	title: 'Público afetado',
	mainQuestion: 'Quem é afetado por esta situação, em detalhe?',
	why: 'Saber quem é afetado ajuda a priorizar requisitos e critérios de aceitação.',
	example: 'Agentes de atendimento e clientes que abrem e acompanham solicitações.',
	completionCriteria: 'O público afetado foi descrito com clareza.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Público afetado não foi detalhado',
	pendingItemDetail: 'Impacta decisões de priorização e critérios de aceitação.',
	fields: [
		{
			id: 'publico_detail',
			activityId: 'publico',
			label: 'Quem é afetado por esta situação, em detalhe?',
			required: true,
			help: 'Descreva pessoas ou áreas impactadas.',
			placeholder: 'Descreva o público afetado...',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const estadoAtual: ActivityDefinition = {
	id: 'estado_atual',
	phaseId: 'descoberta',
	order: 5,
	title: 'Estado atual',
	mainQuestion: 'Como a situação é tratada hoje, em detalhe?',
	why: 'Entender o estado atual em detalhe ajuda a dimensionar o esforço da mudança necessária.',
	example: 'Cada atendente mantém sua própria planilha, sem padrão entre times.',
	completionCriteria: 'O estado atual foi descrito com detalhe suficiente para orientar a próxima atividade.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Estado atual não foi detalhado',
	pendingItemDetail: 'Impacta o quão precisas serão as recomendações sobre a solução.',
	fields: [
		{
			id: 'estado_atual_detail',
			activityId: 'estado_atual',
			label: 'Como a situação é tratada hoje, em detalhe?',
			required: true,
			help: 'Descreva o processo, ferramentas e pessoas envolvidas.',
			placeholder: 'Descreva o estado atual em detalhe...',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const resultado: ActivityDefinition = {
	id: 'resultado',
	phaseId: 'descoberta',
	order: 6,
	title: 'Resultado desejado',
	mainQuestion: 'O que deverá estar diferente quando este projeto tiver sucesso?',
	why: 'Um resultado claro ajuda a priorizar funcionalidades e critérios de aceitação, evitando medir sucesso apenas por entregas.',
	example: 'As solicitações estarão centralizadas, priorizadas e poderão ser acompanhadas do início ao fim.',
	completionCriteria: 'Mudança esperada, beneficiário principal e forma de perceber a melhoria descritos com clareza.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Resultado desejado não foi definido',
	pendingItemDetail: 'Dificulta priorizar funcionalidades pelo impacto esperado.',
	fields: [
		{
			id: 'mudanca',
			activityId: 'resultado',
			label: 'O que deverá estar diferente quando este projeto tiver sucesso?',
			required: true,
			help: 'Descreva a mudança esperada.',
			placeholder: 'Descreva o que muda com o sucesso do projeto...',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'beneficiario',
			activityId: 'resultado',
			label: 'Quem é o principal beneficiário?',
			required: true,
			help: 'Identifique quem sente essa mudança primeiro.',
			placeholder: 'Ex.: clientes, equipe de atendimento...',
			dataTarget: 'answer',
			type: 'texto_longo',
			suggestedSource: {
				activityId: 'publico',
				fieldId: 'publico_detail',
				actionLabel: 'Usar Público afetado como ponto de partida',
				helpText:
					'Você poderá ajustar o texto para representar especificamente quem percebe essa mudança primeiro.'
			}
		},
		{
			id: 'percepcao',
			activityId: 'resultado',
			label: 'Como você vai perceber a melhoria?',
			required: true,
			help: 'Descreva sinais concretos, sem depender de métricas complexas.',
			placeholder: 'Descreva como a melhoria será percebida...',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const resumo: ActivityDefinition = {
	id: 'resumo',
	phaseId: 'descoberta',
	order: 7,
	title: 'Resumo da descoberta',
	mainQuestion: 'Revise o que entendemos até aqui antes de avançar.',
	why: 'Revisar o resumo garante que problema, público e resultado estão alinhados antes de seguir.',
	example: 'Revisão rápida dos blocos já preenchidos.',
	completionCriteria: 'Resumo revisado e confirmado.',
	completionMode: 'explicit_confirmation',
	allowsSkip: false
};

export const discoveryActivities: ActivityDefinition[] = [
	origem,
	contexto,
	problema,
	publico,
	estadoAtual,
	resultado,
	resumo
];
