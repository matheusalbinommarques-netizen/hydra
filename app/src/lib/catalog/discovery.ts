// Catálogo estático — fase Descoberta (catalogStatus: complete).
// Fonte: docs/core/DOMAIN_MODEL.md §7, docs/core/RELEASE_0_SPEC.md §4.2–4.7.

import type { ActivityDefinition, SelectOption } from '$lib/domain';

// Taxonomia de origem — capturada em /projects/new (criação do projeto) e
// gravada como a própria Answer desta atividade (mesmo campo, mesma
// atividade); ao chegar aqui na Descoberta, "Origem do projeto" já aparece
// concluída, sem repetir a pergunta. Substitui a taxonomia anterior de 6
// opções (D033-adjacent, Claude Design "Novo Projeto.dc.html").
export const ORIGIN_OPTIONS = [
	'Existe um problema',
	'Existe uma oportunidade',
	'Quero melhorar algo',
	'Quero criar algo novo',
	'Recebi uma solicitação',
	'Existe uma obrigação',
	'Ainda não sei direito'
] as const;

// Grupo "oportunidade" no espírito do Claude Design ("Entender a
// Situacao.dc.html", originGroup()) — as demais origens usam o vocabulário
// de problema. Export para /projects/new decidir texto de apoio, se preciso.
export const OPPORTUNITY_ORIGIN_LABELS: readonly string[] = ['Existe uma oportunidade', 'Quero melhorar algo', 'Quero criar algo novo'];

export function isOpportunityOrigin(originLabel: string | undefined): boolean {
	return !!originLabel && OPPORTUNITY_ORIGIN_LABELS.includes(originLabel);
}

// Opções de "O que está acontecendo?" (situacao_o_que) — união dos dois
// vocabulários (problema/oportunidade) do Claude Design, com ids
// namespaced (prob_/opor_) porque os mesmos conceitos têm rótulos
// diferentes conforme a origem (ex.: "custo" é "Está custando demais" no
// grupo problema e "Podemos reduzir custos" no grupo oportunidade) — um
// único id sem prefixo colidiria. A interface (Entender a Situação) filtra
// por prefixo conforme a origem do projeto.
export const SITUATION_WHAT_PROBLEM_OPTIONS: SelectOption[] = [
	{ id: 'prob_demora', label: 'Está demorando demais' },
	{ id: 'prob_custo', label: 'Está custando demais' },
	{ id: 'prob_erros', label: 'Há muitos erros' },
	{ id: 'prob_retrabalho', label: 'Existe muito retrabalho' },
	{ id: 'prob_insatisfacao', label: 'As pessoas estão insatisfeitas' },
	{ id: 'prob_manual', label: 'O processo é manual demais' },
	{ id: 'prob_visibilidade', label: 'Falta informação ou visibilidade' },
	{ id: 'prob_quebrado', label: 'Algo não funciona como deveria' },
	{ id: 'prob_risco', label: 'Existe um risco relevante' },
	{ id: 'prob_outro', label: 'Outro' }
];

export const SITUATION_WHAT_OPPORTUNITY_OPTIONS: SelectOption[] = [
	{ id: 'opor_tempo', label: 'Podemos economizar tempo' },
	{ id: 'opor_custo', label: 'Podemos reduzir custos' },
	{ id: 'opor_experiencia', label: 'Podemos melhorar a experiência' },
	{ id: 'opor_automacao', label: 'Existe algo que pode ser automatizado' },
	{ id: 'opor_necessidade', label: 'Há uma necessidade ainda não atendida' },
	{ id: 'opor_negocio', label: 'Há uma nova possibilidade de negócio' },
	{ id: 'opor_simplicidade', label: 'Podemos tornar algo mais simples' },
	{ id: 'opor_confiabilidade', label: 'Podemos tornar algo mais confiável' },
	{ id: 'opor_criacao', label: 'Podemos criar algo que hoje não existe' },
	{ id: 'opor_outro', label: 'Outro' }
];

// Opções de "Onde isso aparece principalmente?" (situacao_onde) — lista
// única, mesma para qualquer origem.
export const SITUATION_WHERE_OPTIONS: SelectOption[] = [
	{ id: 'area_clientes', label: 'Clientes ou usuários' },
	{ id: 'area_produto', label: 'Produto ou serviço' },
	{ id: 'area_processo', label: 'Processo' },
	{ id: 'area_operacao', label: 'Operação' },
	{ id: 'area_equipe', label: 'Equipe' },
	{ id: 'area_tecnologia', label: 'Tecnologia' },
	{ id: 'area_financeiro', label: 'Financeiro' },
	{ id: 'area_mercado', label: 'Mercado' },
	{ id: 'area_outra', label: 'Outra área' }
];

// Opções de "Qual é o peso disso hoje?" (situacao_peso) — selecao de
// escolha única, id = label (mesma convenção já usada nos demais campos
// selecao do catálogo).
export const SITUATION_WEIGHT_OPTIONS = [
	'É crítico',
	'Tem impacto relevante',
	'É um incômodo',
	'É mais uma oportunidade do que um problema',
	'Ainda não sabemos'
] as const;

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
			options: [...ORIGIN_OPTIONS]
		}
	]
};

// "Contexto inicial" (nome provisório, breve descrição, modo de trabalho,
// experiência, estágio atual) foi removida da jornada ativa em 10/08/2026 —
// decisão de produto: nome e origem já são capturados em /projects/new,
// e a contextualização livre foi substituída pela informação estruturada e
// pela síntese automática de "Entender a situação". Os três campos sem
// equivalente hoje (modo_trabalho, nivel_experiencia, estagio_atual) não
// foram redistribuídos — não havia necessidade técnica de preservá-los, e
// esse tipo de sinal (tailoring de profundidade/abordagem) fica para quando
// for realmente necessário, não antecipado aqui. Nenhuma tela substituta foi
// criada. Answers de projetos antigos com activityDefinitionId 'contexto'
// (se existirem) ficam órfãs, sem erro — todas as projeções desta fase
// iteram o catálogo, nunca a lista bruta de respostas.

// "Entender a situação" (Claude Design, projeto "Redesenho da tela /new") —
// substitui o mecanismo anterior baseado em texto livre por seleção
// estruturada em três passos (o quê / onde / peso), com síntese
// determinística gerada a partir das escolhas. `situacao` é preservado como
// campo real (texto_longo) para sustentar `suggestedSource` já existente em
// `product-definition.ts` e a leitura em `bancada-overview-view.ts`/
// `discovery-summary-view.ts` — não é mais digitado pelo usuário, é
// preenchido automaticamente com a síntese (ver
// `catalog/situation-synthesis.ts`) no momento da confirmação.
const problema: ActivityDefinition = {
	id: 'problema',
	phaseId: 'descoberta',
	order: 2,
	title: 'Entender a situação',
	mainQuestion: 'O que está acontecendo?',
	why: 'Entender bem a situação é o que garante uma solução certeira. Quanto mais claro agora, menor o risco depois.',
	example: 'Retrabalho e falta de visibilidade no atendimento, sentidos principalmente pelos clientes.',
	completionCriteria: 'O que está acontecendo foi selecionado e a síntese confirmada.',
	completionMode: 'required_fields',
	allowsSkip: true,
	pendingItemLabel: 'Situação não foi detalhada',
	pendingItemDetail: 'As recomendações seguintes podem ser menos precisas sem essa informação.',
	fields: [
		{
			id: 'situacao',
			activityId: 'problema',
			label: 'Síntese da situação',
			required: true,
			help: 'Gerada automaticamente a partir das seleções abaixo — não é digitada.',
			dataTarget: 'answer',
			type: 'texto_longo'
		},
		{
			id: 'situacao_o_que',
			activityId: 'problema',
			label: 'O que está acontecendo?',
			required: true,
			help: 'Selecione todos que se aplicam.',
			dataTarget: 'answer',
			type: 'selecao_multipla',
			options: [...SITUATION_WHAT_PROBLEM_OPTIONS, ...SITUATION_WHAT_OPPORTUNITY_OPTIONS]
		},
		{
			id: 'situacao_o_que_outro',
			activityId: 'problema',
			label: 'Descreva em poucas palavras',
			required: false,
			placeholder: 'Descreva em poucas palavras…',
			dataTarget: 'answer',
			type: 'texto_curto'
		},
		{
			id: 'situacao_onde',
			activityId: 'problema',
			label: 'Onde isso aparece principalmente?',
			required: false,
			help: 'Selecione uma ou mais áreas.',
			dataTarget: 'answer',
			type: 'selecao_multipla',
			options: SITUATION_WHERE_OPTIONS
		},
		{
			id: 'situacao_onde_outro',
			activityId: 'problema',
			label: 'Descreva em poucas palavras',
			required: false,
			placeholder: 'Descreva em poucas palavras…',
			dataTarget: 'answer',
			type: 'texto_curto'
		},
		{
			id: 'situacao_peso',
			activityId: 'problema',
			label: 'Qual é o peso disso hoje?',
			required: false,
			help: 'Uma estimativa vale mais que nada.',
			dataTarget: 'answer',
			type: 'selecao',
			options: [...SITUATION_WEIGHT_OPTIONS]
		},
		// Dormente nesta entrega: a interface redesenhada (EntenderSituacao.svelte)
		// não expõe este campo — o "Passo a passo" novo não tem uma etapa de
		// hipótese livre. Mantido no catálogo (não removido) só porque é o único
		// campo com semanticRole: 'hypothesis' hoje; removê-lo eliminaria a
		// metade "Descoberta" de computeHypotheses como efeito colateral desta
		// mudança, não como decisão própria — mesmo espírito de manter
		// orientation-engine/scope-suggestions dormente em vez de remover.
		{
			id: 'hipotese_opt',
			activityId: 'problema',
			label: 'Hipótese',
			required: false,
			placeholder: 'Suposições que ainda precisam ser validadas...',
			dataTarget: 'answer',
			semanticRole: 'hypothesis',
			type: 'texto_longo'
		}
	]
};

// "Quem é afetado" (era "Público afetado") — ETAPA 2 do rework (Claude
// Design, "Quem é Afetado.dc.html"): substitui o texto livre de
// `publico_detail` por um Mapa de Impacto que constrói e classifica objetos
// `AffectedGroup` reais (ver domain/state-types.ts e domain/transitions.ts,
// confirmAffectedGroups). completionMode passa de required_fields para
// explicit_confirmation — a conclusão deriva do estado estruturado dos
// grupos (pelo menos um grupo, todos com impacto e frequência classificados,
// "Ainda não sabemos" incluído), nunca de uma Answer. `publico_detail` deixa
// de ser escrito para projetos novos (ver AffectedGroup como fonte canônica);
// Answers legadas desse campo, se existirem em projetos antigos, permanecem
// no banco sem uso (mesmo tratamento já dado a `contexto` ao ser
// incorporada) — não há dual-write nem conversão automática de texto livre
// em grupos.
const publico: ActivityDefinition = {
	id: 'publico',
	phaseId: 'descoberta',
	order: 3,
	title: 'Quem é afetado',
	mainQuestion: 'Quem sente mais essa situação?',
	why: 'Saber quem é afetado ajuda a priorizar requisitos e critérios de aceitação.',
	example: 'Agentes de atendimento e clientes que abrem e acompanham solicitações.',
	completionCriteria: 'Pelo menos um grupo afetado foi adicionado, com impacto e frequência classificados.',
	completionMode: 'explicit_confirmation',
	allowsSkip: true,
	pendingItemLabel: 'Quem é afetado não foi mapeado',
	pendingItemDetail: 'Impacta decisões de priorização e critérios de aceitação.'
};

const estadoAtual: ActivityDefinition = {
	id: 'estado_atual',
	phaseId: 'descoberta',
	order: 4,
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
	order: 5,
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
			type: 'texto_longo'
			// suggestedSource para "Quem é afetado" (publico/publico_detail) foi
			// removido nesta etapa: o campo de origem não existe mais no catálogo
			// (ver AffectedGroup, ETAPA 2 do rework) — reaproveitar os grupos
			// estruturados como sugestão de texto livre exigiria um mecanismo novo,
			// fora do escopo deste corte (ver relatório do Gate 2).
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
	order: 6,
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
	problema,
	publico,
	estadoAtual,
	resultado,
	resumo
];
