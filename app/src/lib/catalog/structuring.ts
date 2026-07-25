// Catálogo estático — fase Estruturação do projeto (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7.

import type { ActivityDefinition } from '$lib/domain';

const objetivoEntregaveis: ActivityDefinition = {
	id: 'objetivo_entregaveis',
	phaseId: 'estruturacao',
	order: 1,
	title: 'Definir objetivo e entregáveis',
	mainQuestion: 'Qual é o objetivo deste projeto e quais entregáveis ele deve produzir?',
	why: 'Um objetivo claro e entregáveis definidos dão à equipe um alvo comum para orientar todas as decisões seguintes.',
	example: 'Objetivo: lançar o Portal de Solicitações para centralizar pedidos internos. Entregáveis: aplicação funcional, documentação básica de uso, treinamento rápido para a equipe de atendimento.',
	completionCriteria: 'Objetivo do projeto e principais entregáveis descritos com clareza.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Objetivo e entregáveis do projeto não foram definidos',
	pendingItemDetail: 'Sem isso, fica difícil alinhar expectativas sobre o que o projeto realmente vai produzir.',
	fields: [
		{
			id: 'objetivo_projeto',
			activityId: 'objetivo_entregaveis',
			label: 'Qual é o objetivo deste projeto?',
			required: true,
			placeholder: 'Ex.: lançar o Portal de Solicitações para centralizar pedidos internos',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'entregaveis_principais',
			activityId: 'objetivo_entregaveis',
			label: 'Quais são os principais entregáveis?',
			required: true,
			placeholder: 'Ex.: aplicação funcional, documentação de uso, treinamento da equipe',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const partesInteressadas: ActivityDefinition = {
	id: 'partes_interessadas',
	phaseId: 'estruturacao',
	order: 2,
	title: 'Identificar partes interessadas',
	mainQuestion: 'Quem são as partes interessadas deste projeto?',
	why: 'Saber quem é afetado ou influencia o projeto ajuda a antecipar expectativas e evitar surpresas durante a execução.',
	example: 'Partes interessadas: equipe de atendimento (usuários diretos), gestor da área (patrocinador), TI (suporte técnico). O gestor tem alta influência sobre prioridades.',
	completionCriteria: 'Partes interessadas identificadas, com interesse ou influência descritos quando relevante.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Partes interessadas não foram identificadas',
	pendingItemDetail: 'Sem essa identificação, decisões podem ignorar quem realmente é afetado pelo projeto.',
	fields: [
		{
			id: 'partes_interessadas',
			activityId: 'partes_interessadas',
			label: 'Quem são as partes interessadas?',
			required: true,
			placeholder: 'Ex.: equipe de atendimento, gestor da área, TI',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'interesse_influencia',
			activityId: 'partes_interessadas',
			label: 'Qual é o interesse ou influência de cada uma?',
			required: false,
			placeholder: 'Ex.: o gestor decide prioridades; a equipe de atendimento usa o sistema diariamente',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const papeisResponsabilidades: ActivityDefinition = {
	id: 'papeis_responsabilidades',
	phaseId: 'estruturacao',
	order: 3,
	title: 'Definir papéis e responsabilidades',
	mainQuestion: 'Quem faz o quê neste projeto?',
	why: 'Papéis claros evitam retrabalho, tarefas esquecidas e decisões travadas por falta de dono.',
	example: 'Matheus: decisão final e implementação. Gestor da área: validação de prioridades e aceite das entregas.',
	completionCriteria: 'Papéis principais e quem os ocupa estão descritos; o responsável pela decisão final está identificado quando existir.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Papéis e responsabilidades não foram definidos',
	pendingItemDetail: 'Sem isso, decisões importantes podem ficar sem um responsável claro.',
	fields: [
		{
			id: 'papeis_responsaveis',
			activityId: 'papeis_responsabilidades',
			label: 'Quais papéis existem neste projeto, e quem os ocupa?',
			required: true,
			placeholder: 'Ex.: Matheus — decisão e implementação; gestor da área — validação',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'decisor_principal',
			activityId: 'papeis_responsabilidades',
			label: 'Quem toma a decisão final quando necessário?',
			required: false,
			placeholder: 'Ex.: Matheus',
			dataTarget: 'answer',
			type: 'texto_curto'
		}
	]
};

const restricoesPremissas: ActivityDefinition = {
	id: 'restricoes_premissas',
	phaseId: 'estruturacao',
	order: 4,
	title: 'Registrar restrições e premissas',
	mainQuestion: 'Quais restrições e premissas afetam este projeto?',
	why: 'Tornar restrições e premissas explícitas evita decisões baseadas em suposições não verificadas.',
	example: 'Restrição: sem orçamento para ferramentas pagas. Premissa: a equipe de atendimento terá disponibilidade para testar o sistema antes do lançamento.',
	completionCriteria: 'Restrições conhecidas e premissas assumidas estão descritas.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Restrições e premissas não foram registradas',
	pendingItemDetail: 'Sem isso, o projeto corre risco de ser surpreendido por limites ou suposições erradas.',
	fields: [
		{
			id: 'restricoes_projeto',
			activityId: 'restricoes_premissas',
			label: 'Quais restrições precisam ser respeitadas?',
			required: true,
			placeholder: 'Ex.: sem orçamento para ferramentas pagas, prazo de dois meses',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'premissas_projeto',
			activityId: 'restricoes_premissas',
			label: 'Quais premissas você está assumindo como verdadeiras?',
			required: true,
			placeholder: 'Ex.: a equipe de atendimento terá tempo disponível para testar',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const riscosProjeto: ActivityDefinition = {
	id: 'riscos_projeto',
	phaseId: 'estruturacao',
	order: 5,
	title: 'Identificar riscos do projeto',
	mainQuestion: 'Quais riscos podem afetar este projeto?',
	why: 'Identificar riscos cedo permite reduzir a chance de que eles se tornem problemas reais mais tarde.',
	example: 'Risco: baixa adesão da equipe ao novo sistema. Resposta inicial: envolver a equipe de atendimento desde os primeiros testes.',
	completionCriteria: 'Riscos relevantes identificados, com uma resposta inicial quando possível.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Riscos do projeto não foram identificados',
	pendingItemDetail: 'Sem essa identificação, riscos podem só aparecer quando já causaram impacto.',
	fields: [
		{
			id: 'riscos_identificados',
			activityId: 'riscos_projeto',
			label: 'Quais riscos você já identifica?',
			required: true,
			placeholder: 'Ex.: baixa adesão da equipe ao novo sistema',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'resposta_inicial_riscos',
			activityId: 'riscos_projeto',
			label: 'Qual seria uma resposta inicial a esses riscos?',
			required: false,
			placeholder: 'Ex.: envolver a equipe desde os primeiros testes',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const comunicacaoGovernanca: ActivityDefinition = {
	id: 'comunicacao_governanca',
	phaseId: 'estruturacao',
	order: 6,
	title: 'Definir comunicação e governança',
	mainQuestion: 'Como as decisões serão tomadas e comunicadas neste projeto?',
	why: 'Combinar isso com antecedência evita ruído e decisões que ninguém sabia que tinham sido tomadas.',
	example: 'Comunicação: atualização semanal por mensagem para o gestor da área. Decisão: mudanças de escopo passam pelo gestor antes de serem implementadas.',
	completionCriteria: 'Forma de comunicação e forma de tomar decisões importantes estão descritas.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Comunicação e governança não foram definidas',
	pendingItemDetail: 'Sem isso, decisões e atualizações do projeto podem ficar informais e inconsistentes.',
	fields: [
		{
			id: 'forma_comunicacao',
			activityId: 'comunicacao_governanca',
			label: 'Como e com que frequência o andamento será comunicado?',
			required: true,
			placeholder: 'Ex.: atualização semanal por mensagem para o gestor da área',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'forma_decisao',
			activityId: 'comunicacao_governanca',
			label: 'Como as decisões importantes serão tomadas?',
			required: false,
			placeholder: 'Ex.: mudanças de escopo passam pelo gestor antes de valer',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

export const structuringActivities: ActivityDefinition[] = [
	objetivoEntregaveis,
	partesInteressadas,
	papeisResponsabilidades,
	restricoesPremissas,
	riscosProjeto,
	comunicacaoGovernanca
];
