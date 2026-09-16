// Orientação operacional de Agora (ETAPA 13 do rework, S13, quarto
// microcorte, D065/D066) — composição factual sobre fatos vivos já
// conhecidos: bloqueio operacional, Decision pendente, WorkItem em
// andamento e marco planejado. Reaproveita as projeções neutras já
// existentes (buildAttentionsView, buildDecisions) para os dois primeiros
// fatos; os dois últimos são filtros/ordenações diretos sobre campos reais
// de WorkItem/Milestone, sem regra nova de domínio.
//
// Deliberadamente local a `/now`, não em `$lib/`: nenhuma outra rota
// consome esta composição específica (Atenções e Decisões já têm suas
// próprias telas completas em `$lib/attention-view.ts`/`$lib/decision-view.ts`).
// Não depende de `tracking/tracking-view.ts` nem de módulos internos de
// outras rotas — só dos tipos neutros de `$lib/server/application/types`.
//
// Isto é orientação factual, não priorização: a ordem fixa
// (bloqueio → decisão → trabalho → marco) é exigida pela composição do
// Design Gate (D066), não um ranking entre os fatos. Nenhum campo de
// urgência/health/score é calculado — `dueDate`/`reviewedAt`/proximidade de
// datas nunca decidem se um fato aparece ou como é ordenado.
import { buildAttentionsView, type AttentionsViewInput } from '$lib/attention-view';
import { buildDecisions } from '$lib/decision-view';
import type { DecisionView, MilestoneView, WorkItemView } from '$lib/server/application/types';

export interface NowOrientationBlockingFact {
	count: number;
	label: string;
}

export interface NowOrientationDecisionFact {
	id: string;
	subject: string;
	otherCount: number;
}

export interface NowOrientationWorkFact {
	id: string;
	title: string;
	otherCount: number;
}

export interface NowOrientationMilestoneFact {
	id: string;
	title: string;
	plannedDateLabel: string;
}

export interface NowOrientationView {
	blocking: NowOrientationBlockingFact | null;
	decision: NowOrientationDecisionFact | null;
	work: NowOrientationWorkFact | null;
	milestone: NowOrientationMilestoneFact | null;
	isEmpty: boolean;
}

// dd/mm/aaaa a partir das partes da própria string — mesmo tratamento de
// tracking-view.ts/work-view.ts/cronograma-view.ts (formatCivilDate):
// deliberadamente sem Date/Intl, porque a semântica é dia civil.
function formatCivilDate(civilDate: string): string {
	const [year, month, day] = civilDate.split('-');
	return `${day}/${month}/${year}`;
}

function buildBlockingFact(input: AttentionsViewInput): NowOrientationBlockingFact | null {
	const attentions = buildAttentionsView(input);
	const count = attentions.blockedWorkItems.length + attentions.impediments.open.length;
	if (count === 0) return null;
	return {
		count,
		label: count === 1 ? '1 bloqueio operacional aberto' : `${count} bloqueios operacionais abertos`
	};
}

function buildDecisionFact(decisions: DecisionView[]): NowOrientationDecisionFact | null {
	const pending = buildDecisions(decisions).pending;
	if (pending.length === 0) return null;
	const [first, ...rest] = pending;
	return { id: first.id, subject: first.subject, otherCount: rest.length };
}

function buildWorkFact(workItems: WorkItemView[]): NowOrientationWorkFact | null {
	const inProgress = workItems.filter((item) => item.status === 'em_andamento');
	if (inProgress.length === 0) return null;
	const [first, ...rest] = inProgress;
	return { id: first.id, title: first.title, otherCount: rest.length };
}

// Marco planejado conhecido: só marcos abertos (status 'aberto') COM data
// planejada — um marco alcançado já é fato do passado, não orientação para
// agora, e um marco sem data não é um schedule fact. Ordenação (plannedDate
// ASC, createdAt ASC, id ASC como desempate final) é a mesma convenção já
// usada por tracking-view.ts/cronograma-view.ts para "o próximo marco
// conhecido" — sem inventar prioridade nova, sem CPM, sem folga.
function buildMilestoneFact(milestones: MilestoneView[]): NowOrientationMilestoneFact | null {
	const planned = milestones.filter(
		(milestone): milestone is MilestoneView & { plannedDate: string } =>
			milestone.status === 'aberto' && milestone.plannedDate !== null
	);
	if (planned.length === 0) return null;
	const [next] = [...planned].sort((a, b) => {
		if (a.plannedDate !== b.plannedDate) return a.plannedDate < b.plannedDate ? -1 : 1;
		if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
		return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
	});
	return { id: next.id, title: next.title, plannedDateLabel: formatCivilDate(next.plannedDate) };
}

export interface NowOrientationViewInput {
	workItems: WorkItemView[];
	impediments: AttentionsViewInput['impediments'];
	openPendingItems: AttentionsViewInput['openPendingItems'];
	decisions: DecisionView[];
	milestones: MilestoneView[];
}

export function buildNowOrientationView(input: NowOrientationViewInput): NowOrientationView {
	const blocking = buildBlockingFact({
		workItems: input.workItems,
		impediments: input.impediments,
		openPendingItems: input.openPendingItems
	});
	const decision = buildDecisionFact(input.decisions);
	const work = buildWorkFact(input.workItems);
	const milestone = buildMilestoneFact(input.milestones);

	return {
		blocking,
		decision,
		work,
		milestone,
		isEmpty: blocking === null && decision === null && work === null && milestone === null
	};
}
