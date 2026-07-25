// Catálogo estático — fase Validação e encerramento (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7.
//
// "Confirmar encerramento do projeto" usa completionMode: required_fields
// com allowsSkip: false, e não explicit_confirmation — a única atividade de
// explicit_confirmation suportada nesta versão do motor é "Resumo da
// descoberta" (transitions.ts localiza a atividade de confirmação explícita
// por completionMode, sem receber um id, então não há como endereçar uma
// segunda). required_fields + allowsSkip: false já é suficiente para exigir
// uma decisão explícita (o campo obrigatório não pode ser pulado) sem exigir
// nenhuma mudança em domain/, persistence/ ou application/.

import type { ActivityDefinition } from '$lib/domain';

const validarEntregasCriterios: ActivityDefinition = {
	id: 'validar_entregas_criterios',
	phaseId: 'validacao',
	order: 1,
	title: 'Validar entregas e critérios de aceitação',
	mainQuestion: 'As entregas atendem aos critérios de aceitação definidos?',
	why: 'Validar contra os critérios definidos evita encerrar o projeto sem confirmar que ele realmente entrega o que foi combinado.',
	example: 'As entregas atendem aos critérios: uma solicitação pode ser aberta, aprovada e notificada sem erros, como definido no planejamento.',
	completionCriteria: 'Resultado da validação descrito, com pendências quando houver.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'As entregas não foram validadas contra os critérios de aceitação',
	pendingItemDetail: 'Sem essa validação, o projeto pode ser encerrado sem confirmar que a entrega realmente funciona como esperado.',
	fields: [
		{
			id: 'resultado_validacao',
			activityId: 'validar_entregas_criterios',
			label: 'As entregas atendem aos critérios definidos? Descreva o resultado.',
			required: true,
			placeholder: 'Ex.: sim, o fluxo completo funciona sem erros, como definido no planejamento',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'pendencias_validacao',
			activityId: 'validar_entregas_criterios',
			label: 'Ficou alguma pendência dessa validação?',
			required: false,
			placeholder: 'Ex.: um ajuste visual pequeno ficou para depois',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const coletarFeedback: ActivityDefinition = {
	id: 'coletar_feedback',
	phaseId: 'validacao',
	order: 2,
	title: 'Coletar feedback',
	mainQuestion: 'Que feedback foi coletado sobre o resultado entregue?',
	why: 'Feedback direto de quem usa o resultado é a evidência mais confiável de que o valor esperado foi entregue.',
	example: 'A equipe de atendimento relatou que abrir e acompanhar solicitações ficou mais rápido do que pelo processo anterior.',
	completionCriteria: 'Feedback coletado sobre o resultado entregue está descrito.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'O feedback sobre o resultado não foi coletado',
	pendingItemDetail: 'Sem feedback direto, fica mais difícil confirmar se o valor esperado foi realmente percebido.',
	fields: [
		{
			id: 'feedback_coletado',
			activityId: 'coletar_feedback',
			label: 'Que feedback foi coletado?',
			required: true,
			placeholder: 'Ex.: a equipe relatou que abrir solicitações ficou mais rápido',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const resolverPendenciasFinais: ActivityDefinition = {
	id: 'resolver_pendencias_finais',
	phaseId: 'validacao',
	order: 3,
	title: 'Resolver pendências finais',
	mainQuestion: 'Existem pendências finais a resolver antes de encerrar?',
	why: 'Resolver ou decidir conscientemente sobre pendências finais evita encerrar o projeto com questões em aberto sem decisão registrada.',
	example: 'Pendência final: melhorar a mensagem de erro de colisão de importação — decidida como aceitável para esta versão, candidata a melhoria futura.',
	completionCriteria: 'Pendências finais descritas, com o que foi resolvido ou a decisão tomada sobre cada uma.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'As pendências finais não foram resolvidas',
	pendingItemDetail: 'Sem isso, o projeto pode ser encerrado com questões em aberto sem nenhuma decisão registrada.',
	fields: [
		{
			id: 'pendencias_finais',
			activityId: 'resolver_pendencias_finais',
			label: 'Quais pendências finais existem e como foram resolvidas?',
			required: true,
			help: 'Se não houver nenhuma, registre isso mesmo.',
			placeholder: 'Ex.: nenhuma pendência final identificada',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const licoesAprendidas: ActivityDefinition = {
	id: 'licoes_aprendidas',
	phaseId: 'validacao',
	order: 4,
	title: 'Registrar lições aprendidas',
	mainQuestion: 'Que lições este projeto deixou?',
	why: 'Registrar lições aprendidas evita repetir os mesmos erros e ajuda a aproveitar o que funcionou bem no próximo projeto.',
	example: 'Lição: começar pela Descoberta guiada ajudou a evitar retrabalho — vale manter essa ordem em projetos futuros.',
	completionCriteria: 'Lições aprendidas relevantes estão descritas.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'As lições aprendidas não foram registradas',
	pendingItemDetail: 'Sem esse registro, aprendizados importantes deste projeto podem se perder.',
	fields: [
		{
			id: 'licoes_aprendidas',
			activityId: 'licoes_aprendidas',
			label: 'Quais lições você aprendeu com este projeto?',
			required: true,
			placeholder: 'Ex.: começar pela Descoberta guiada ajudou a evitar retrabalho',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const transicaoProximosPassos: ActivityDefinition = {
	id: 'transicao_proximos_passos',
	phaseId: 'validacao',
	order: 5,
	title: 'Definir transição e próximos passos',
	mainQuestion: 'O que acontece com este projeto e seus resultados depois do encerramento?',
	why: 'Definir a transição evita que o resultado do projeto fique sem dono ou sem continuidade depois de encerrado.',
	example: 'Transição: o sistema passa a ser mantido pela própria equipe de atendimento. Próximo passo possível: avaliar a extensão do fluxo para solicitações externas.',
	completionCriteria: 'Forma de transição dos resultados e próximos passos possíveis estão descritos.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'A transição e os próximos passos não foram definidos',
	pendingItemDetail: 'Sem isso, o resultado do projeto pode ficar sem continuidade clara depois do encerramento.',
	fields: [
		{
			id: 'transicao_resultados',
			activityId: 'transicao_proximos_passos',
			label: 'Como os resultados serão transferidos ou mantidos?',
			required: true,
			placeholder: 'Ex.: o sistema passa a ser mantido pela equipe de atendimento',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'proximos_passos_pos_encerramento',
			activityId: 'transicao_proximos_passos',
			label: 'Quais são os próximos passos possíveis?',
			required: false,
			placeholder: 'Ex.: avaliar extensão do fluxo para solicitações externas',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

const confirmarEncerramento: ActivityDefinition = {
	id: 'confirmar_encerramento',
	phaseId: 'validacao',
	order: 6,
	title: 'Confirmar encerramento do projeto',
	mainQuestion: 'Você confirma o encerramento deste projeto?',
	why: 'Encerrar formalmente evita que o projeto fique em um estado ambíguo, e consolida o aprendizado antes de seguir para o próximo passo.',
	example: 'Projeto encerrado após validar as entregas, coletar feedback positivo da equipe de atendimento e registrar as lições aprendidas.',
	completionCriteria: 'Resumo do encerramento registrado — sua existência é a própria confirmação da decisão de encerrar o projeto.',
	completionMode: 'required_fields',
	allowsSkip: false,
	pendingItemLabel: 'O encerramento do projeto não foi confirmado',
	pendingItemDetail: 'Sem essa confirmação, o projeto permanece formalmente em andamento.',
	fields: [
		{
			id: 'resumo_encerramento',
			activityId: 'confirmar_encerramento',
			label: 'Resumo do encerramento',
			required: true,
			help: 'Escreva um resumo final: o que foi entregue, o resultado alcançado e por que o projeto está sendo encerrado agora. Registrar esse resumo é a confirmação do encerramento — esta atividade não pode ser pulada.',
			placeholder:
				'Ex.: projeto encerrado após validar as entregas e coletar feedback positivo; lições registradas para o próximo projeto.',
			dataTarget: 'answer',
			type: 'texto_longo'
		}
	]
};

export const closureActivities: ActivityDefinition[] = [
	validarEntregasCriterios,
	coletarFeedback,
	resolverPendenciasFinais,
	licoesAprendidas,
	transicaoProximosPassos,
	confirmarEncerramento
];
