// Catálogo estático — fase Planejamento da entrega (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7. Os campos produzem um plano inicial
// compreensível em texto estruturado — não é o objetivo reproduzir um
// quadro de gestão de tarefas completo dentro do Hydra.

import type { ActivityDefinition } from '$lib/domain';

const decomporTrabalho: ActivityDefinition = {
	id: 'decompor_trabalho',
	phaseId: 'planejamento',
	order: 1,
	title: 'Decompor o trabalho',
	mainQuestion: 'Como o trabalho deste projeto pode ser dividido em partes menores?',
	why: 'Dividir o trabalho em partes menores torna o esforço mais fácil de estimar, priorizar e acompanhar.',
	example: 'Partes: tela de abertura de solicitação, fluxo de aprovação, notificação por e-mail, painel de acompanhamento.',
	completionCriteria: 'Principais partes ou itens de trabalho estão listados.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'O trabalho do projeto não foi decomposto',
	pendingItemDetail: 'Sem isso, fica difícil estimar esforço ou priorizar o que fazer primeiro.',
	fields: [
		{
			id: 'partes_trabalho',
			activityId: 'decompor_trabalho',
			label: 'Quais são as principais partes ou itens de trabalho?',
			required: true,
			placeholder: 'Ex.: tela de abertura de solicitação, fluxo de aprovação',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const priorizarEntregas: ActivityDefinition = {
	id: 'priorizar_entregas',
	phaseId: 'planejamento',
	order: 2,
	title: 'Priorizar entregas',
	mainQuestion: 'Qual é a ordem de prioridade entre essas partes do trabalho?',
	why: 'Priorizar evita tentar avançar tudo ao mesmo tempo e ajuda a entregar valor mais cedo.',
	example: 'Prioridade: 1) abertura de solicitação, 2) fluxo de aprovação, 3) notificação por e-mail. Critério: o que entrega valor sozinho primeiro.',
	completionCriteria: 'Ordem de prioridade definida, com o critério usado quando relevante.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'As entregas não foram priorizadas',
	pendingItemDetail: 'Sem prioridade clara, o trabalho pode avançar em várias frentes sem nenhuma pronta.',
	fields: [
		{
			id: 'ordem_prioridade_entregas',
			activityId: 'priorizar_entregas',
			label: 'Qual é a ordem de prioridade?',
			required: true,
			placeholder: 'Ex.: 1) abertura de solicitação, 2) fluxo de aprovação',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'criterio_priorizacao',
			activityId: 'priorizar_entregas',
			label: 'Qual critério orientou essa priorização?',
			required: false,
			placeholder: 'Ex.: o que entrega valor sozinho primeiro',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const mapearDependencias: ActivityDefinition = {
	id: 'mapear_dependencias',
	phaseId: 'planejamento',
	order: 3,
	title: 'Mapear dependências',
	mainQuestion: 'Existe alguma dependência entre as partes do trabalho?',
	why: 'Conhecer dependências evita começar algo que só pode ser concluído depois de outra parte estar pronta.',
	example: 'O fluxo de aprovação depende da tela de abertura de solicitação já existir.',
	completionCriteria:
		'Dependências relevantes entre as partes do trabalho estão descritas, mesmo que a resposta seja que não há nenhuma.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'As dependências do trabalho não foram mapeadas',
	pendingItemDetail: 'Sem isso, o projeto corre risco de iniciar algo fora de ordem.',
	fields: [
		{
			id: 'dependencias_trabalho',
			activityId: 'mapear_dependencias',
			label: 'Quais dependências existem entre as partes do trabalho?',
			required: true,
			placeholder: "Ex.: o fluxo de aprovação depende da tela de abertura existir; ou 'nenhuma dependência identificada'",
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
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

const definirMarcos: ActivityDefinition = {
	id: 'definir_marcos',
	phaseId: 'planejamento',
	order: 5,
	title: 'Definir marcos',
	mainQuestion: 'Quais marcos vão indicar progresso ao longo da entrega?',
	why: 'Marcos dão pontos de checagem intermediários, em vez de só descobrir o progresso no final.',
	example: 'Marco 1: tela de abertura de solicitação funcionando. Marco 2: fluxo de aprovação completo.',
	completionCriteria: 'Principais marcos da entrega estão descritos.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Os marcos da entrega não foram definidos',
	pendingItemDetail: 'Sem marcos, é difícil perceber atraso antes do prazo final.',
	fields: [
		{
			id: 'marcos_principais',
			activityId: 'definir_marcos',
			label: 'Quais são os principais marcos?',
			required: true,
			placeholder: 'Ex.: tela de abertura funcionando; fluxo de aprovação completo',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
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
