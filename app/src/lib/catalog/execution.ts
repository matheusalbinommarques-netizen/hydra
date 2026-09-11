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
			help: 'Se não houver nenhum, registre isso mesmo. Este é um retrato pontual, sem histórico — para acompanhar cada impedimento individualmente até resolver, use o Acompanhamento.',
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

// S11 (ETAPA 11 do rework, "Decision e Change", §41) — igual a
// riscos_projeto/atualizar_riscos (S10, D049): a atividade deixa de
// required_fields (texto livre misturando decisão e mudança) e vira
// explicit_confirmation contra as coleções canônicas Decision/Change. O
// campo legado `decisoes_mudancas_recentes` passa a READ-LEGACY (ver
// domain/legacy-answers.ts) — nunca recebe nova escrita.
const decisoesMudancas: ActivityDefinition = {
	id: 'decisoes_mudancas',
	phaseId: 'execucao',
	order: 4,
	title: 'Registrar decisões e mudanças',
	mainQuestion: 'Quais decisões ou mudanças relevantes ocorreram?',
	why: 'Registrar decisões e mudanças evita que elas se percam ou sejam esquecidas mais tarde. Registrar de verdade acontece em Acompanhamento, como Decision e Change — aqui você só confirma que revisou o estado atual, mesmo que ele seja "nenhuma decisão ou mudança".',
	example: 'Decisão: adiar a notificação por SMS para uma versão futura, mantendo só e-mail por enquanto — declarada em Acompanhamento.',
	completionCriteria:
		'O usuário confirmou que revisou o estado real de decisões e mudanças do projeto em Acompanhamento, mesmo que nenhuma exista.',
	completionMode: 'explicit_confirmation',
	allowsSkip: true,
	pendingItemLabel: 'Decisões e mudanças não foram revisadas aqui',
	pendingItemDetail: 'Revise decisões e mudanças em Acompanhamento e volte para confirmar — ou pule esta etapa.'
};

// S10 (D049, reconciliação de risco legado, ver
// docs/core/HYDRA_PRODUCT_REWORK.md §40) — `riscos_atualizados` é
// READ-LEGACY (§13.2): continua legível, mas nunca ganha nova escrita.
// Mesma coleção canônica de `riscos_projeto` (Estruturação) — `Risk` é
// operado em Acompanhamento, não por fase. "Atualizar riscos" vira
// `explicit_confirmation`, mesmo molde de "Identificar riscos do projeto":
// ZERO Risk é resultado válido. `confirmRiskUpdate` (domain/transitions.ts)
// nunca recusa por ausência de Risk.
const atualizarRiscos: ActivityDefinition = {
	id: 'atualizar_riscos',
	phaseId: 'execucao',
	order: 5,
	title: 'Atualizar riscos',
	mainQuestion: 'Como estão os riscos deste projeto agora?',
	why: 'Riscos mudam ao longo da execução — revisar periodicamente evita agir com base em uma avaliação desatualizada. Atualizar de verdade acontece em Acompanhamento, como Risk — aqui você só confirma que revisou o estado atual, mesmo que ele seja "nenhum risco".',
	example: 'O risco de baixa adesão da equipe foi encerrado em Acompanhamento depois dos primeiros testes positivos.',
	completionCriteria:
		'O usuário confirmou que revisou os riscos reais do projeto em Acompanhamento, mesmo que nenhum exista.',
	completionMode: 'explicit_confirmation',
	allowsSkip: true,
	pendingItemLabel: 'Os riscos não foram revisados aqui',
	pendingItemDetail: 'Revise os riscos em Acompanhamento e volte para confirmar — ou pule esta etapa.'
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
