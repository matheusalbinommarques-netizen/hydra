// Projeção pura de leitura para "Trabalho" (ETAPA 6 do rework, "Primeiro
// loop operacional") — agrupa WorkItems pelos três estados operacionais.
// Substitui semanticamente "Entregas" (ScopeItem.executionStatus, D025):
// WorkItem é o novo modelo canônico de execução (D035); ScopeItem continua
// existindo como precursor/candidato de Deliverable, camada de escopo, não
// de execução. Não lê nem grava persistência, não conhece ProjectState
// bruto. Mesmo padrão de buildRecordsView/buildMapView.

import type { WorkItemStatus } from '$lib/domain';
import type {
	SchedulePropagationChangeView,
	WorkItemDependencyView,
	WorkItemKnownFreeSlackView,
	WorkItemPrecedenceConflictView,
	WorkItemView
} from '$lib/server/application/types';

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

// Texto do painel quando o WorkItem aberto já está relacionado a todos os
// marcos que existem (ETAPA 8 do rework, segundo microcorte). Fica aqui, e não
// inline no template, pelo mesmo motivo de dependencyPresentation acima: é
// escolha de apresentação pura, testável sem montar a página. Achado de
// dogfood humano: com um único marco no projeto, a formulação plural ("todos
// os marcos existentes") soava errada.
export function allMilestonesLinkedHint(milestoneCount: number): string {
	return milestoneCount === 1
		? 'Este trabalho já está relacionado ao marco existente.'
		: 'Este trabalho já está relacionado a todos os marcos existentes.';
}

// dd/mm/aaaa a partir das partes da própria string — mesmo tratamento de
// tracking-view.ts (formatCivilDate): deliberadamente sem Date/Intl, porque
// a semântica é dia civil, e converter para instante desloca o dia em
// qualquer fuso a oeste de Greenwich. A string já chegou validada
// (domain/civil-date.ts, isCivilDate).
function formatCivilDate(civilDate: string): string {
	const [year, month, day] = civilDate.split('-');
	return `${day}/${month}/${year}`;
}

// Texto do aviso de precedência temporal DERIVADA (ETAPA 12 do rework,
// §42, segundo microcorte) — presença de `conflict` já significa "conflito
// provado" (buildWorkItemPrecedenceConflictView só retorna algo quando
// plannedStart do item é anterior ao maior início exigido por um
// predecessor agendado); esta função só formata a explicação, nunca decide
// se há conflito. Nomeia o predecessor que prova o limite e nunca afirma
// compatibilidade completa — pode existir outro predecessor sem schedule,
// ainda não avaliável.
//
// `kind: 'unrepresentable'` (reparo pós-dogfood do terceiro microcorte) —
// a aritmética de precedência exigiria uma data fora da faixa civil
// 0000-9999: não existe knownRequiredStart para formatar, então o aviso
// nomeia o predecessor e explica a impossibilidade em vez de mostrar uma
// data. Quem chama esta função (o template) nunca oferece replanejamento
// para este caso — não há para onde propagar.
export function precedenceConflictMessage(conflict: WorkItemPrecedenceConflictView): string {
	if (conflict.kind === 'unrepresentable') {
		return (
			`Não é possível calcular uma data válida para respeitar a dependência de "${conflict.dependsOnWorkItemTitle}" ` +
			`dentro do intervalo suportado (até 31/12/9999). Ajuste o cronograma do predecessor ou a dependência.`
		);
	}
	return (
		`Conflito de precedência. Este trabalho começa antes de "${conflict.dependsOnWorkItemTitle}" terminar. ` +
		`Considerando as dependências com cronograma, o início precisa ser ${formatCivilDate(conflict.knownRequiredStart)} ou depois.`
	);
}

// Texto da folga conhecida do cronograma (ETAPA 12 do rework, §42, quarto
// microcorte) — só formata, nunca decide. Copy explicável, deliberadamente
// sem jargão de CPM (nunca "free float"/"total float"/"buffer"/"margem de
// segurança" — ver contrato do quarto microcorte): folga é sobre o
// PRÓXIMO trabalho agendado conhecido, nunca sobre a rede inteira.
export function knownFreeSlackMessage(slack: WorkItemKnownFreeSlackView): string {
	switch (slack.kind) {
		case 'known': {
			if (slack.slackDays === 0) {
				return `Sem folga conhecida. Qualquer atraso deste trabalho pressiona "${slack.limitingWorkItemTitle}".`;
			}
			const dayWord = slack.slackDays === 1 ? 'dia' : 'dias';
			return (
				`Folga conhecida: ${slack.slackDays} ${dayWord}. Este trabalho pode deslizar até ${slack.slackDays} ` +
				`${dayWord} sem pressionar o próximo trabalho agendado: "${slack.limitingWorkItemTitle}".`
			);
		}
		case 'conflict':
			return (
				`Não há folga calculável: "${slack.limitingWorkItemTitle}" já começa antes do limite exigido por ` +
				`esta dependência.`
			);
		case 'unknown':
			return 'Folga ainda não calculável. Os trabalhos dependentes ainda não têm cronograma.';
		case 'no_known_limit':
			return 'Sem limite conhecido por dependências.';
		case 'unrepresentable':
			return (
				'Não é possível calcular a folga: o limite desta dependência cai fora do intervalo suportado ' +
				'(até 31/12/9999).'
			);
	}
}

// Nota de conhecimento parcial (ETAPA 12 do rework, §42, quarto
// microcorte) — separada de knownFreeSlackMessage porque só se aplica a
// `known`: existe sucessor sem cronograma que a conta não considerou.
// `null` quando não há nota a mostrar (mesmo padrão de outras funções de
// apresentação puras deste arquivo).
export function knownFreeSlackPartialHint(slack: WorkItemKnownFreeSlackView): string | null {
	if (slack.kind === 'known' && slack.partial) {
		return 'Há trabalhos dependentes sem cronograma; este valor considera somente os que já estão agendados.';
	}
	return null;
}

// Texto de uma mudança individual do preview de propagação (ETAPA 12 do
// rework, §42, terceiro microcorte) — mesmo espírito de
// precedenceConflictMessage: só formata, nunca decide. Nomeia o
// predecessor que prova o movimento, mesmo quando é o próprio item raiz.
export function schedulePropagationChangeMessage(change: SchedulePropagationChangeView): string {
	return (
		`${change.workItemTitle}: ${formatCivilDate(change.fromPlannedStart)} → ${formatCivilDate(change.toPlannedStart)} ` +
		`(dependência: "${change.viaWorkItemTitle}")`
	);
}
