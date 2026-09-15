// Projeção pura de leitura para "Cronograma" (ETAPA 12 do rework,
// "Scheduling e Gantt", §42, sexto microcorte — primeiro corte do Gantt) —
// Design Gate aprovado (corredor Acompanhamento → Cronograma → WorkItem).
// Read-only: nenhuma mutação nasce aqui. Só formata/deriva, nunca decide —
// precedência/propagação/folga já foram decididas em domain/transitions.ts
// (D059-D061) e chegam prontas via WorkItemView.
//
// Escopo deste microcorte (instrução do Design Gate, não o estado final
// congelado do artefato): só entram WorkItems com schedule COMPLETO.
// Referência (baseline), folga, zoom, filtros adicionais e caminho crítico
// continuam DEFER — nenhum deles muda o layout base desta rodada.

import { addCivilDays, civilDaysBetween } from '$lib/domain';
import type { MilestoneStatus, WorkItemStatus } from '$lib/domain';
import type { DeliverableView, MilestoneView, WorkItemView } from '$lib/server/application/types';

export interface CronogramaWorkItemRow {
	id: string;
	title: string;
	status: WorkItemStatus;
	statusLabel: string;
	plannedStartLabel: string;
	durationLabel: string;
	// Fim SEMÂNTICO, sempre derivado aqui — nunca persistido (mesmo
	// contrato de D058: fim = plannedStart + (durationDays - 1) dias).
	semanticEndLabel: string;
	hasConflict: boolean;
	conflictLabel: string | null;
	// Geometria da barra, em DIAS a partir de axis.startLabel — a interface
	// multiplica por uma largura de dia própria (detalhe de apresentação,
	// não desta projeção). `null` só no caso defensivo em que a aritmética
	// de data civil deste item específico excede a faixa representável
	// (nunca fabricar geometria inventada — ver domain/civil-date.ts).
	geometry: { offsetDays: number; widthDays: number } | null;
}

export interface CronogramaGroup {
	key: string;
	title: string;
	items: CronogramaWorkItemRow[];
}

export interface CronogramaMilestoneEntry {
	id: string;
	title: string;
	plannedDateLabel: string;
	status: MilestoneStatus;
	statusLabel: string;
	geometry: { offsetDays: number } | null;
}

// Uma aresta de Dependency FS lag-zero entre dois WorkItems que APARECEM
// nesta projeção (ambos com schedule completo) — Dependency com uma ponta
// sem schedule simplesmente não produz conector (nenhuma posição
// inventada). `conflict` reaproveita WorkItemView.precedenceConflict do
// dependente: true só quando esta é a aresta que PROVA o limite conhecido
// (D059) — não "qualquer predecessor deste item", que poderia marcar mais
// de uma aresta como culpada por um único conflito.
export interface CronogramaDependencyEdge {
	id: string;
	fromWorkItemId: string;
	toWorkItemId: string;
	conflict: boolean;
}

export interface CronogramaAxis {
	// Data civil crua (YYYY-MM-DD) — a interface usa isto para derivar marcas
	// intermediárias da régua (addCivilDays), nunca para reconstruir o
	// intervalo por conta própria.
	startDate: string;
	endDate: string;
	startLabel: string;
	endLabel: string;
	totalDays: number;
}

export interface CronogramaView {
	groups: CronogramaGroup[];
	milestones: CronogramaMilestoneEntry[];
	dependencies: CronogramaDependencyEdge[];
	axis: CronogramaAxis | null;
}

const WORK_STATUS_LABEL: Record<WorkItemStatus, string> = {
	a_fazer: 'A fazer',
	em_andamento: 'Em andamento',
	concluido: 'Concluído'
};

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
	aberto: 'Em aberto',
	alcancado: 'Alcançado'
};

const NO_DELIVERABLE_KEY = '__sem_entrega__';

// dd/mm/aaaa a partir das partes da própria string — mesmo tratamento de
// tracking-view.ts/work-view.ts: deliberadamente sem Date/Intl (a semântica
// é dia civil, e converter para instante desloca o dia em qualquer fuso a
// oeste de Greenwich).
function formatCivilDate(civilDate: string): string {
	const [year, month, day] = civilDate.split('-');
	return `${day}/${month}/${year}`;
}

function durationLabel(durationDays: number): string {
	return durationDays === 1 ? '1 dia' : `${durationDays} dias`;
}

interface ScheduledWorkItem extends WorkItemView {
	plannedStart: string;
	durationDays: number;
}

function isScheduled(item: WorkItemView): item is ScheduledWorkItem {
	return item.plannedStart !== null && item.durationDays !== null;
}

// Fim semântico, tentando a aritmética civil — `null` só quando a data
// resultante excede 0000-9999 (defesa, nunca esperado num projeto real:
// mesmo caso extremo já tratado por findWorkItemPrecedenceConflict/
// findWorkItemKnownFreeSlack no domínio).
function trySemanticEnd(item: ScheduledWorkItem): string | null {
	try {
		return addCivilDays(item.plannedStart, item.durationDays - 1);
	} catch {
		return null;
	}
}

function compareChronologically(
	a: { plannedDate: string; createdAt: string; id: string },
	b: { plannedDate: string; createdAt: string; id: string }
): number {
	if (a.plannedDate !== b.plannedDate) return a.plannedDate < b.plannedDate ? -1 : 1;
	if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function groupTitle(deliverableId: string | null, deliverables: readonly DeliverableView[]): string {
	if (deliverableId === null) return 'Sem entrega';
	return deliverables.find((deliverable) => deliverable.id === deliverableId)?.title ?? 'Entrega';
}

function buildRow(item: ScheduledWorkItem, axisStart: string | null, semanticEnd: string | null): CronogramaWorkItemRow {
	const geometry =
		axisStart !== null && semanticEnd !== null
			? { offsetDays: civilDaysBetween(axisStart, item.plannedStart), widthDays: item.durationDays }
			: null;

	return {
		id: item.id,
		title: item.title,
		status: item.status,
		statusLabel: WORK_STATUS_LABEL[item.status],
		plannedStartLabel: formatCivilDate(item.plannedStart),
		durationLabel: durationLabel(item.durationDays),
		semanticEndLabel: semanticEnd !== null ? formatCivilDate(semanticEnd) : 'Não calculável',
		hasConflict: item.precedenceConflict !== null,
		conflictLabel:
			item.precedenceConflict === null
				? null
				: item.precedenceConflict.kind === 'conflict'
					? `Conflito de precedência com "${item.precedenceConflict.dependsOnWorkItemTitle}".`
					: `Precedência com "${item.precedenceConflict.dependsOnWorkItemTitle}" fora do intervalo suportado.`,
		geometry
	};
}

function buildGroups(
	scheduledItems: readonly ScheduledWorkItem[],
	deliverables: readonly DeliverableView[],
	axisStart: string | null,
	semanticEndByWorkItemId: ReadonlyMap<string, string | null>
): CronogramaGroup[] {
	const byGroup = new Map<string, ScheduledWorkItem[]>();
	for (const item of scheduledItems) {
		const key = item.deliverable?.deliverableId ?? NO_DELIVERABLE_KEY;
		const bucket = byGroup.get(key);
		if (bucket) bucket.push(item);
		else byGroup.set(key, [item]);
	}

	const deliverableGroupKeys = [...byGroup.keys()].filter((key) => key !== NO_DELIVERABLE_KEY);
	const orderedDeliverableKeys = deliverableGroupKeys.sort((a, b) => {
		const orderA = deliverables.find((deliverable) => deliverable.id === a)?.order ?? Number.POSITIVE_INFINITY;
		const orderB = deliverables.find((deliverable) => deliverable.id === b)?.order ?? Number.POSITIVE_INFINITY;
		if (orderA !== orderB) return orderA - orderB;
		return a < b ? -1 : a > b ? 1 : 0;
	});
	// "Sem entrega" sempre por último quando existir (mesmo padrão visual do
	// Design Gate — grupo residual, não uma entrega como as demais).
	const orderedKeys = byGroup.has(NO_DELIVERABLE_KEY)
		? [...orderedDeliverableKeys, NO_DELIVERABLE_KEY]
		: orderedDeliverableKeys;

	return orderedKeys.map((key) => {
		const items = [...(byGroup.get(key) ?? [])].sort((a, b) =>
			compareChronologically(
				{ plannedDate: a.plannedStart, createdAt: a.createdAt, id: a.id },
				{ plannedDate: b.plannedStart, createdAt: b.createdAt, id: b.id }
			)
		);
		return {
			key,
			title: groupTitle(key === NO_DELIVERABLE_KEY ? null : key, deliverables),
			items: items.map((item) => buildRow(item, axisStart, semanticEndByWorkItemId.get(item.id) ?? null))
		};
	});
}

function buildMilestones(milestones: readonly MilestoneView[], axisStart: string | null): CronogramaMilestoneEntry[] {
	return milestones
		.filter((milestone): milestone is MilestoneView & { plannedDate: string } => milestone.plannedDate !== null)
		.sort((a, b) =>
			compareChronologically(
				{ plannedDate: a.plannedDate, createdAt: a.createdAt, id: a.id },
				{ plannedDate: b.plannedDate, createdAt: b.createdAt, id: b.id }
			)
		)
		.map((milestone) => ({
			id: milestone.id,
			title: milestone.title,
			plannedDateLabel: formatCivilDate(milestone.plannedDate),
			status: milestone.status,
			statusLabel: MILESTONE_STATUS_LABEL[milestone.status],
			geometry: axisStart !== null ? { offsetDays: civilDaysBetween(axisStart, milestone.plannedDate) } : null
		}));
}

// Só uma aresta por Dependency, e só quando AMBAS as pontas têm schedule
// completo (falsificador: predecessor sem schedule nunca produz conector
// apontando para posição inventada). `conflict` marca especificamente a
// aresta que WorkItemView.precedenceConflict já identificou como a que
// PROVA o limite — nunca todas as arestas do dependente.
function buildDependencies(scheduledItems: readonly ScheduledWorkItem[]): CronogramaDependencyEdge[] {
	const scheduledIds = new Set(scheduledItems.map((item) => item.id));
	const edges: CronogramaDependencyEdge[] = [];
	for (const item of scheduledItems) {
		for (const dependency of item.dependsOn) {
			if (!scheduledIds.has(dependency.dependsOnWorkItemId)) continue;
			const conflict =
				item.precedenceConflict !== null && item.precedenceConflict.dependsOnWorkItemId === dependency.dependsOnWorkItemId;
			edges.push({
				id: dependency.dependencyId,
				fromWorkItemId: dependency.dependsOnWorkItemId,
				toWorkItemId: item.id,
				conflict
			});
		}
	}
	return edges;
}

export function buildCronogramaView(input: {
	workItems: readonly WorkItemView[];
	deliverables: readonly DeliverableView[];
	milestones: readonly MilestoneView[];
}): CronogramaView {
	const scheduledItems = input.workItems.filter(isScheduled);

	const semanticEndByWorkItemId = new Map<string, string | null>();
	for (const item of scheduledItems) {
		semanticEndByWorkItemId.set(item.id, trySemanticEnd(item));
	}

	const datedMilestones = input.milestones.filter(
		(milestone): milestone is MilestoneView & { plannedDate: string } => milestone.plannedDate !== null
	);

	// Menor intervalo que enquadra honestamente o que será exibido: início
	// dos WorkItems agendados + Milestones planejados; fim dos mesmos
	// WorkItems (fim semântico, quando calculável) + Milestones. Comparação
	// lexicográfica de YYYY-MM-DD já é ordem cronológica — sem Date.
	const candidateStarts: string[] = [
		...scheduledItems.map((item) => item.plannedStart),
		...datedMilestones.map((milestone) => milestone.plannedDate)
	];
	const candidateEnds: string[] = [
		...[...semanticEndByWorkItemId.values()].filter((value): value is string => value !== null),
		...datedMilestones.map((milestone) => milestone.plannedDate)
	];

	let axis: CronogramaAxis | null = null;
	let axisStart: string | null = null;
	if (candidateStarts.length > 0 && candidateEnds.length > 0) {
		axisStart = candidateStarts.reduce((min, value) => (value < min ? value : min));
		const axisEnd = candidateEnds.reduce((max, value) => (value > max ? value : max));
		axis = {
			startDate: axisStart,
			endDate: axisEnd,
			startLabel: formatCivilDate(axisStart),
			endLabel: formatCivilDate(axisEnd),
			totalDays: civilDaysBetween(axisStart, axisEnd) + 1
		};
	}

	return {
		groups: buildGroups(scheduledItems, input.deliverables, axisStart, semanticEndByWorkItemId),
		milestones: buildMilestones(input.milestones, axisStart),
		dependencies: buildDependencies(scheduledItems),
		axis
	};
}
