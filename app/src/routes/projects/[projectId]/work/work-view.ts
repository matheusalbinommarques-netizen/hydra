// Projeção pura de leitura para "Trabalho" (ETAPA 6 do rework, "Primeiro
// loop operacional") — agrupa WorkItems pelos três estados operacionais.
// Substitui semanticamente "Entregas" (ScopeItem.executionStatus, D025):
// WorkItem é o novo modelo canônico de execução (D035); ScopeItem continua
// existindo como precursor/candidato de Deliverable, camada de escopo, não
// de execução. Não lê nem grava persistência, não conhece ProjectState
// bruto. Mesmo padrão de buildRecordsView/buildMapView.

import type { WorkItemStatus } from '$lib/domain';
import type { WorkItemDependencyView, WorkItemView } from '$lib/server/application/types';

export interface WorkItemBoardGroups {
	a_fazer: WorkItemView[];
	em_andamento: WorkItemView[];
	concluido: WorkItemView[];
}

export interface WorkItemBoardCounts {
	a_fazer: number;
	em_andamento: number;
	concluido: number;
}

export interface WorkBoardView {
	isEmpty: boolean;
	groups: WorkItemBoardGroups;
	counts: WorkItemBoardCounts;
}

const STATUSES: readonly WorkItemStatus[] = ['a_fazer', 'em_andamento', 'concluido'];

export function buildWorkView(workItems: WorkItemView[]): WorkBoardView {
	// Ordem original preservada (mesmo espírito de buildDeliveriesView): filter
	// mantém a ordem relativa do array de entrada.
	const groups: WorkItemBoardGroups = {
		a_fazer: workItems.filter((item) => item.status === 'a_fazer'),
		em_andamento: workItems.filter((item) => item.status === 'em_andamento'),
		concluido: workItems.filter((item) => item.status === 'concluido')
	};

	return {
		isEmpty: workItems.length === 0,
		groups,
		counts: {
			a_fazer: groups.a_fazer.length,
			em_andamento: groups.em_andamento.length,
			concluido: groups.concluido.length
		}
	};
}

export function nextWorkItemStatus(status: WorkItemStatus): WorkItemStatus | null {
	const index = STATUSES.indexOf(status);
	return index < STATUSES.length - 1 ? STATUSES[index + 1] : null;
}

export function previousWorkItemStatus(status: WorkItemStatus): WorkItemStatus | null {
	const index = STATUSES.indexOf(status);
	return index > 0 ? STATUSES[index - 1] : null;
}

// Como uma Dependency é apresentada (ETAPA 8 do rework). Três estados, nunca
// persistidos: derivam do par (status do dependente × `satisfied`, que é um
// fato sobre o predecessor).
//
// 'pendente' existe porque Dependency deliberadamente não é hard block: um
// WorkItem pode ser concluído com o predecessor ainda aberto (moveWorkItem não
// recusa nada por causa disso). Nesse caso a precedência continua sendo fato
// visível — a relação não é removida nem satisfeita — mas dizer que um item
// já concluído "aguarda" alguém é falso: ele não está esperando por nada.
export type DependencyPresentation = 'pronto' | 'aguardando' | 'pendente';

export function dependencyPresentation(
	dependentStatus: WorkItemStatus,
	dependency: WorkItemDependencyView
): DependencyPresentation {
	if (dependency.satisfied) return 'pronto';
	return dependentStatus === 'concluido' ? 'pendente' : 'aguardando';
}
