// Catálogo estático — fase Execução e acompanhamento (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7.
//
// Limitação explícita desta versão: cada atividade representa o retrato
// ATUAL da execução, não um histórico. Editar uma resposta substitui a
// anterior — não há ciclos recorrentes, instâncias repetidas nem histórico
// de atualizações. O usuário revisita e edita essas respostas pelo Mapa.

import type { ActivityDefinition } from '$lib/domain';

const focoAtualExecucao: ActivityDefinition = {
	id: 'foco_atual_execucao',
	phaseId: 'execucao',
	order: 1,
	title: 'Definir foco atual da execução',
	mainQuestion: 'Qual é o foco atual da execução deste projeto?',
	why: 'Ter um foco atual claro ajuda a direcionar o esforço, em vez de tentar avançar tudo ao mesmo tempo.',
	example: 'Foco atual: implementar o fluxo de aprovação de solicitações.',
	completionCriteria: 'Foco atual da execução descrito com clareza.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'O foco atual da execução não foi definido',
	pendingItemDetail: 'Sem um foco claro, o esforço pode se dispersar entre várias frentes.',
	fields: [
		{
			id: 'foco_atual',
			activityId: 'foco_atual_execucao',
			label: 'Qual é o foco atual?',
			required: true,
			help: 'Esta resposta reflete o momento presente do projeto — editar substitui a resposta anterior; esta versão não mantém histórico de mudanças.',
			placeholder: 'Ex.: implementar o fluxo de aprovação de solicitações',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const registrarAndamento: ActivityDefinition = {
	id: 'registrar_andamento',
	phaseId: 'execucao',
	order: 2,
	title: 'Registrar andamento',
	mainQuestion: 'Como está o andamento do projeto até agora?',
	why: 'Registrar o andamento periodicamente ajuda a perceber progresso real e desvios cedo.',
	example: 'Andamento: abertura de solicitação concluída e testada; fluxo de aprovação em desenvolvimento.',
	completionCriteria: 'Andamento atual do projeto descrito.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'O andamento não foi registrado',
	pendingItemDetail: 'Sem esse registro, fica difícil perceber se o projeto está progredindo como esperado.',
	fields: [
		{
			id: 'andamento_atual',
			activityId: 'registrar_andamento',
			label: 'Como está o andamento até agora?',
			required: true,
			help: 'Esta resposta é o retrato mais recente — editar substitui o texto anterior, sem manter histórico nesta versão.',
			placeholder: 'Ex.: abertura de solicitação concluída e testada',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const impedimentosExecucao: ActivityDefinition = {
	id: 'impedimentos_execucao',
	phaseId: 'execucao',
	order: 3,
	title: 'Identificar e tratar impedimentos',
	mainQuestion: 'Existe algum impedimento afetando a execução agora?',
	why: 'Impedimentos não tratados tendem a se acumular e atrasar o projeto sem que ninguém perceba a tempo.',
	example: 'Impedimento: falta de acesso ao ambiente de testes. Tratamento: solicitado acesso à TI.',
	completionCriteria: 'Impedimentos atuais descritos, com o tratamento quando já houver um.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Os impedimentos atuais não foram registrados',
	pendingItemDetail: 'Sem isso, um bloqueio pode continuar parando o projeto sem que haja um plano para resolvê-lo.',
	fields: [
		{
			id: 'impedimentos_atuais',
			activityId: 'impedimentos_execucao',
			label: 'Quais impedimentos existem agora?',
			required: true,
			help: 'Se não houver nenhum, registre isso mesmo.',
			placeholder: "Ex.: falta de acesso ao ambiente de testes; ou 'nenhum impedimento no momento'",
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'tratamento_impedimentos',
			activityId: 'impedimentos_execucao',
			label: 'Como esses impedimentos estão sendo tratados?',
			required: false,
			placeholder: 'Ex.: acesso solicitado à TI',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const decisoesMudancas: ActivityDefinition = {
	id: 'decisoes_mudancas',
	phaseId: 'execucao',
	order: 4,
	title: 'Registrar decisões e mudanças',
	mainQuestion: 'Quais decisões ou mudanças relevantes ocorreram?',
	why: 'Registrar decisões e mudanças evita que elas se percam ou sejam esquecidas mais tarde.',
	example: 'Decisão: adiar a notificação por SMS para uma versão futura, mantendo só e-mail por enquanto.',
	completionCriteria: 'Decisões ou mudanças relevantes recentes estão descritas.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Decisões e mudanças não foram registradas',
	pendingItemDetail: 'Sem esse registro, decisões importantes podem ser esquecidas ou questionadas depois sem contexto.',
	fields: [
		{
			id: 'decisoes_mudancas_recentes',
			activityId: 'decisoes_mudancas',
			label: 'Quais decisões ou mudanças relevantes ocorreram?',
			required: true,
			help: 'Se nada relevante mudou desde a última atualização, registre isso.',
			placeholder: 'Ex.: adiada a notificação por SMS para uma versão futura',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const atualizarRiscos: ActivityDefinition = {
	id: 'atualizar_riscos',
	phaseId: 'execucao',
	order: 5,
	title: 'Atualizar riscos',
	mainQuestion: 'Como estão os riscos deste projeto agora?',
	why: 'Riscos mudam ao longo da execução — revisar periodicamente evita agir com base em uma avaliação desatualizada.',
	example: 'O risco de baixa adesão da equipe diminuiu depois dos primeiros testes positivos.',
	completionCriteria: 'Situação atual dos riscos descrita (novos, alterados ou encerrados).',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Os riscos não foram atualizados',
	pendingItemDetail: 'Sem essa atualização, decisões podem se basear numa avaliação de risco desatualizada.',
	fields: [
		{
			id: 'riscos_atualizados',
			activityId: 'atualizar_riscos',
			label: 'Como estão os riscos agora (novos, alterados, encerrados)?',
			required: true,
			placeholder: 'Ex.: risco de baixa adesão diminuiu após testes positivos',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const proximaAcaoAcompanhamento: ActivityDefinition = {
	id: 'proxima_acao_acompanhamento',
	phaseId: 'execucao',
	order: 6,
	title: 'Definir próxima ação de acompanhamento',
	mainQuestion: 'Qual é a próxima ação de acompanhamento deste projeto?',
	why: 'Terminar o acompanhamento com uma próxima ação clara evita que o projeto fique parado por falta de direção.',
	example: 'Próxima ação: concluir o fluxo de aprovação e testar com a equipe de atendimento.',
	completionCriteria: 'Próxima ação de acompanhamento descrita com clareza.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'A próxima ação de acompanhamento não foi definida',
	pendingItemDetail: 'Sem uma próxima ação clara, o acompanhamento do projeto pode perder ritmo.',
	fields: [
		{
			id: 'proxima_acao',
			activityId: 'proxima_acao_acompanhamento',
			label: 'Qual é a próxima ação?',
			required: true,
			placeholder: 'Ex.: concluir o fluxo de aprovação e testar com a equipe',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

export const executionActivities: ActivityDefinition[] = [
	focoAtualExecucao,
	registrarAndamento,
	impedimentosExecucao,
	decisoesMudancas,
	atualizarRiscos,
	proximaAcaoAcompanhamento
];
