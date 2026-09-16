// Decisões (ETAPA 11 do rework, D041; surface própria em `/decisions` na
// ETAPA 13, S13, D065/D066) — projeção pura pendente/tomada sobre Decision,
// mesmo espírito de risk-view.ts. Vive em `$lib/` por ser consumida por mais
// de uma rota (`/tracking` e `/decisions`) sobre o mesmo lifecycle real de
// Decision — nenhuma das duas rotas pertence estruturalmente à outra.
import type { DecisionView } from '$lib/server/application/types';

export interface DecisionsView {
	pending: DecisionView[];
	decided: DecisionView[];
}

export function buildDecisions(decisions: DecisionView[]): DecisionsView {
	return {
		pending: decisions.filter((decision) => decision.status === 'pendente'),
		decided: decisions.filter((decision) => decision.status === 'tomada')
	};
}

// Opção enxuta para o seletor "Trabalhos afetados" de uma Decision — todos
// os WorkItems do projeto, sem filtrar por status: um WorkItem concluído
// continua podendo ser marcado como afetado por uma decisão registrada
// depois. Só usada por `/decisions` (a gestão de Decision não vive mais em
// `/tracking`).
export interface DecisionWorkItemOption {
	id: string;
	title: string;
}

export function buildDecisionWorkItemOptions(workItems: { id: string; title: string }[]): DecisionWorkItemOption[] {
	return workItems.map((item) => ({ id: item.id, title: item.title }));
}
