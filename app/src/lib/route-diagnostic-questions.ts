// Perguntas fixas do diagnóstico de rota (D024, docs/07-management/decision-log.md).
// Única fonte de phaseId, rótulo de fase, descrição da estrutura e pergunta
// usados pelo diagnóstico — route-recommendation.ts não conhece este
// conteúdo, e nenhuma action aceita phaseId/rótulo/justificativa vindos do
// formulário. Compartilhado pelo Mapa (`/projects/[projectId]/map`) e pela
// Nova iniciativa (`/projects/new`, etapa 7.2 do roadmap) — mesmo padrão de
// módulo solto sob $lib já usado por `project-status-label.ts`.

export interface RouteDiagnosticQuestion {
	phaseId: string;
	phaseLabel: string;
	question: string;
	structureLabel: string;
}

export const ROUTE_DIAGNOSTIC_QUESTIONS: RouteDiagnosticQuestion[] = [
	{
		phaseId: 'descoberta',
		phaseLabel: 'Descoberta',
		question: 'Problema, contexto e benefícios estão claros?',
		structureLabel: 'problema, contexto e benefícios estão claros'
	},
	{
		phaseId: 'definicao',
		phaseLabel: 'Definição do produto',
		question: 'Produto ou solução está definido?',
		structureLabel: 'produto ou solução está definido'
	},
	{
		phaseId: 'estruturacao',
		phaseLabel: 'Estruturação do projeto',
		question:
			'Objetivo, partes interessadas, responsabilidades, restrições, riscos e governança estão estruturados?',
		structureLabel:
			'objetivo, partes interessadas, responsabilidades, restrições, riscos e governança estão estruturados'
	},
	{
		phaseId: 'planejamento',
		phaseLabel: 'Planejamento da entrega',
		question: 'A entrega está planejada e priorizada?',
		structureLabel: 'a entrega está planejada e priorizada'
	},
	{
		phaseId: 'execucao',
		phaseLabel: 'Execução e acompanhamento',
		question: 'A execução começou e está sendo acompanhada?',
		structureLabel: 'a execução começou e está sendo acompanhada'
	}
];

export const ROUTE_DIAGNOSTIC_FALLBACK = { phaseId: 'validacao', phaseLabel: 'Validação e encerramento' };
