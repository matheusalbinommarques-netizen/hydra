// Catálogo estático — fase Planejamento da entrega (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7. Os campos produzem um plano inicial
// compreensível em texto estruturado — não é o objetivo reproduzir um
// quadro de gestão de tarefas completo dentro do Hydra.
//
// "Decompor o trabalho" e "Priorizar entregas" (C5-01) foram o laboratório
// original da mecânica CONSTRUIR → OPERAR sobre PlanningItem[] (ver
// domain/planning-items.ts). Desde S9 (reconciliação da decomposição
// legada, docs/07-management/decision-log.md), `partes_trabalho` é
// READ-LEGACY (§13.2 do rework): a responsabilidade operacional de
// decompor/priorizar foi absorvida por WorkItem/Deliverable, e as duas
// Activities viraram `explicit_confirmation` — intervenções/checkpoints
// guiados, nunca fonte de dados. "Decompor o trabalho" confirma quando há
// ao menos um WorkItem real (`confirmDecomposition`); "Priorizar entregas"
// confirma quando há ao menos uma Deliverable real (`confirmPlanningPriority`,
// domain/transitions.ts) — nenhuma das duas lê nem escreve PlanningItem
// mais. PlanningItems antigos continuam legíveis só como histórico (Agora,
// Registros, export/import), sem nenhuma autoridade operacional.

import type { ActivityDefinition } from '$lib/domain';

const decomporTrabalho: ActivityDefinition = {
	id: 'decompor_trabalho',
	phaseId: 'planejamento',
	order: 1,
	title: 'Decompor o trabalho',
	mainQuestion: 'Como o trabalho deste projeto pode ser dividido em partes menores?',
	why: 'Dividir o trabalho em partes executáveis torna o esforço mais fácil de estimar, priorizar e acompanhar. Decompor de verdade acontece em WorkItem, criado em Entregas ou em Trabalho — aqui você só confirma que já fez isso.',
	example: 'Criar WorkItem em Entregas ou Trabalho: tela de abertura de solicitação, fluxo de aprovação, notificação por e-mail, painel de acompanhamento.',
	completionCriteria: 'Existe ao menos um WorkItem real no projeto, e o usuário confirmou que a decomposição foi feita.',
	completionMode: 'explicit_confirmation',
	allowsSkip: true,
	pendingItemLabel: 'O trabalho do projeto não foi decomposto aqui',
	pendingItemDetail: 'Crie ao menos um WorkItem em Entregas ou Trabalho e volte para confirmar — ou pule esta etapa.'
};

const priorizarEntregas: ActivityDefinition = {
	id: 'priorizar_entregas',
	phaseId: 'planejamento',
	order: 2,
	title: 'Priorizar entregas',
	mainQuestion: 'Qual é a ordem de prioridade entre as entregas deste projeto?',
	why: 'Priorizar evita tentar avançar tudo ao mesmo tempo e ajuda a entregar valor mais cedo. Priorizar de verdade acontece em Entregas, pela ordem entre Agora/Depois/Fora — aqui você só confirma que já revisou essa prioridade.',
	example: 'Entregas ordenadas em Agora/Depois/Fora, em Entregas — aqui você confirma que revisou essa ordem.',
	completionCriteria: 'Existe ao menos uma Deliverable real no projeto, e o usuário confirmou que revisou a prioridade em Entregas.',
	completionMode: 'explicit_confirmation',
	allowsSkip: true,
	pendingItemLabel: 'As entregas não foram priorizadas aqui',
	pendingItemDetail: 'Crie e ordene entregas em Entregas e volte para confirmar — ou pule esta etapa.'
};

// S9 (reconciliação de dependências legadas) — `dependencias_trabalho` é
// READ-LEGACY (§13.2): continua legível, mas nunca ganha nova escrita. A
// responsabilidade operacional de dependência real pertence a `Dependency`
// (D039, Trabalho). "Mapear dependências" vira `explicit_confirmation`
// contra o estado canônico — mas, ao contrário de "Decompor o trabalho"/
// "Priorizar entregas" (D045), ZERO Dependency é resultado válido: confirmar
// significa "revisei as dependências reais e o estado atual está correto",
// nunca "existe pelo menos uma". `confirmDependencyMapping`
// (domain/transitions.ts) nunca recusa por ausência de Dependency.
const mapearDependencias: ActivityDefinition = {
	id: 'mapear_dependencias',
	phaseId: 'planejamento',
	order: 3,
	title: 'Mapear dependências',
	mainQuestion: 'Existe alguma dependência entre as partes do trabalho?',
	why: 'Conhecer dependências evita começar algo que só pode ser concluído depois de outra parte estar pronta. Mapear de verdade acontece em Trabalho, como Dependency entre WorkItems — aqui você só confirma que revisou o estado atual, mesmo que ele seja "nenhuma dependência".',
	example: 'O fluxo de aprovação depende da tela de abertura de solicitação já existir — declarado em Trabalho.',
	completionCriteria:
		'O usuário confirmou que revisou as dependências reais do trabalho em Trabalho, mesmo que nenhuma exista.',
	completionMode: 'explicit_confirmation',
	allowsSkip: true,
	pendingItemLabel: 'As dependências do trabalho não foram revisadas aqui',
	pendingItemDetail: 'Revise as dependências em Trabalho e volte para confirmar — ou pule esta etapa.'
};

const estimarEsforcoCapacidade: ActivityDefinition = {
	id: 'estimar_esforco_capacidade',
	phaseId: 'planejamento',
	order: 4,
	title: 'Estimar esforço e capacidade',
	mainQuestion: 'Qual é a estimativa de esforço, e qual capacidade está disponível para executar?',
	why: 'Comparar esforço estimado com capacidade real evita compromissos que não podem ser cumpridos.',
	example: 'Esforço estimado: cerca de 20 horas para a primeira entrega. Capacidade: 5 horas por semana disponíveis.',
	completionCriteria: 'Estimativa de esforço e capacidade disponível estão descritas.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Esforço e capacidade não foram estimados',
	pendingItemDetail: 'Sem essa estimativa, prazos podem ser definidos sem relação com o tempo realmente disponível.',
	fields: [
		{
			id: 'estimativa_esforco',
			activityId: 'estimar_esforco_capacidade',
			label: 'Qual é a estimativa de esforço para o trabalho?',
			required: true,
			placeholder: 'Ex.: cerca de 20 horas para a primeira entrega',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'capacidade_disponivel',
			activityId: 'estimar_esforco_capacidade',
			label: 'Qual é a capacidade disponível para executar (tempo, pessoas)?',
			required: true,
			placeholder: 'Ex.: 5 horas por semana, um único desenvolvedor',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

// S9 (reconciliação de marcos legados) — `marcos_principais` é READ-LEGACY
// (§13.2): continua legível, mas nunca ganha nova escrita. A responsabilidade
// operacional de marco real pertence a `Milestone` (D040/D041, Trabalho).
// "Definir marcos" vira `explicit_confirmation` contra o estado canônico —
// mesmo molde de "Mapear dependências" acima: ZERO Milestone é resultado
// válido, confirmar significa "revisei os marcos reais e o estado atual está
// correto", nunca "existe pelo menos um". `confirmMilestoneReview`
// (domain/transitions.ts) nunca recusa por ausência de Milestone.
const definirMarcos: ActivityDefinition = {
	id: 'definir_marcos',
	phaseId: 'planejamento',
	order: 5,
	title: 'Definir marcos',
	mainQuestion: 'Quais marcos vão indicar progresso ao longo da entrega?',
	why: 'Marcos dão pontos de checagem intermediários, em vez de só descobrir o progresso no final. Definir de verdade acontece em Trabalho, como Milestone — aqui você só confirma que revisou o estado atual, mesmo que ele seja "nenhum marco".',
	example: 'Marco 1: tela de abertura de solicitação funcionando — declarado em Trabalho.',
	completionCriteria:
		'O usuário confirmou que revisou os marcos reais da entrega em Trabalho, mesmo que nenhum exista.',
	completionMode: 'explicit_confirmation',
	allowsSkip: true,
	pendingItemLabel: 'Os marcos da entrega não foram revisados aqui',
	pendingItemDetail: 'Revise os marcos em Trabalho e volte para confirmar — ou pule esta etapa.'
};

const criteriosAceitacaoEntrega: ActivityDefinition = {
	id: 'criterios_aceitacao_entrega',
	phaseId: 'planejamento',
	order: 6,
	title: 'Definir critérios de aceitação',
	mainQuestion: 'O que precisa ser verdade para considerar a entrega aceita?',
	why: 'Critérios de aceitação claros evitam divergência sobre se a entrega está realmente pronta.',
	example: 'A entrega é aceita quando uma solicitação pode ser aberta, aprovada e notificada por e-mail, sem erros.',
	completionCriteria: 'Critérios de aceitação da entrega estão descritos de forma verificável.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Os critérios de aceitação da entrega não foram definidos',
	pendingItemDetail: 'Sem isso, a entrega pode ser considerada pronta de formas diferentes por pessoas diferentes.',
	fields: [
		{
			id: 'criterios_aceitacao_entrega',
			activityId: 'criterios_aceitacao_entrega',
			label: 'Quais são os critérios de aceitação da entrega?',
			required: true,
			placeholder: 'Ex.: solicitação pode ser aberta, aprovada e notificada sem erros',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const consolidarPlanoEntrega: ActivityDefinition = {
	id: 'consolidar_plano_entrega',
	phaseId: 'planejamento',
	order: 7,
	title: 'Consolidar plano de entrega',
	mainQuestion: 'Como fica o plano de entrega consolidado a partir das respostas anteriores?',
	why: 'Consolidar o plano em um texto estruturado dá uma visão única para orientar a execução, sem depender de reunir informações espalhadas.',
	example:
		'Plano: decompor em quatro partes, priorizar abertura e aprovação primeiro, sem dependências externas, esforço estimado de 20 horas com 5h/semana, dois marcos principais, aceite quando o fluxo completo funcionar sem erros. Data-alvo: dentro de um mês.',
	completionCriteria: 'Resumo do plano de entrega registrado de forma coerente com as respostas anteriores desta fase.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'O plano de entrega não foi consolidado',
	pendingItemDetail: 'Sem esse resumo, as decisões desta fase ficam espalhadas em vez de formar um plano único.',
	fields: [
		{
			id: 'resumo_plano_entrega',
			activityId: 'consolidar_plano_entrega',
			label: 'Resuma o plano de entrega em texto estruturado.',
			required: true,
			help: 'Reúna numa frase ou parágrafo curto as decisões desta fase: partes, prioridade, dependências, esforço, marcos e critérios de aceitação.',
			placeholder: 'Ex.: decompor em quatro partes, priorizar abertura e aprovação, sem dependências externas...',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'data_alvo_entrega',
			activityId: 'consolidar_plano_entrega',
			label: 'Existe uma data-alvo para essa entrega?',
			required: false,
			placeholder: 'Ex.: dentro de um mês',
			dataTarget: 'answer',
			type: 'texto_curto'
		}
	]
};

export const planningActivities: ActivityDefinition[] = [
	decomporTrabalho,
	priorizarEntregas,
	mapearDependencias,
	estimarEsforcoCapacidade,
	definirMarcos,
	criteriosAceitacaoEntrega,
	consolidarPlanoEntrega
];
