// Projeção pura de leitura para "Cronograma" (ETAPA 12 do rework,
// "Scheduling e Gantt", §42, sexto microcorte — primeiro corte do Gantt) —
// Design Gate aprovado (corredor Acompanhamento → Cronograma → WorkItem).
// Read-only: nenhuma mutação nasce aqui. Só formata/deriva, nunca decide —
// precedência/propagação/folga já foram decididas em domain/transitions.ts
// (D059-D061) e chegam prontas via WorkItemView.
//
// Escopo original do sexto microcorte (instrução do Design Gate, não o
// estado final congelado do artefato): só entravam WorkItems com schedule
// COMPLETO. O oitavo microcorte (§42, "identidade sem cronograma") amplia
// isso: todo WorkItem CURRENT agora aparece — com geometria completa
// quando tem schedule, ou só identidade + "Sem cronograma" quando não tem
// e não é `removed` na baseline. Folga, zoom, filtros adicionais e caminho
// crítico continuam DEFER.

import { addCivilDays, civilDaysBetween } from '$lib/domain';
import type { MilestoneStatus, WorkItemStatus } from '$lib/domain';
import type { DeliverableView, MilestoneView, ScheduleBaselineView, WorkItemView } from '$lib/server/application/types';

// Ghost da referência (ETAPA 12 do rework, §42, sétimo microcorte — Design
// Gate aprovado, opção A do Scout) — geometria e rótulos da baseline ATIVA
// para um WorkItem `compared` ou `removed`. `null` só quando a aritmética
// civil do PRÓPRIO ponto histórico (fim = início + duração - 1) excede a
// faixa representável — falha isolada dessa referência, nunca derruba a
// surface (mesmo espírito de CronogramaWorkItemRow.geometry).
export interface CronogramaGhost {
	offsetDays: number;
	widthDays: number;
	plannedStartLabel: string;
	semanticEndLabel: string;
	durationLabel: string;
}

export interface CronogramaWorkItemRow {
	id: string;
	title: string;
	status: WorkItemStatus;
	statusLabel: string;
	// `null` só para uma linha `removed` (ghost-only): o WorkItem continua
	// existindo, mas não tem schedule atual — nunca um valor fabricado.
	plannedStartLabel: string | null;
	durationLabel: string | null;
	// Fim SEMÂNTICO, sempre derivado aqui — nunca persistido (mesmo
	// contrato de D058: fim = plannedStart + (durationDays - 1) dias).
	semanticEndLabel: string | null;
	hasConflict: boolean;
	conflictLabel: string | null;
	// Geometria da barra ATUAL, em DIAS a partir de axis.startLabel — a
	// interface multiplica por uma largura de dia própria (detalhe de
	// apresentação, não desta projeção). `null` quando a aritmética de data
	// civil deste item específico excede a faixa representável, OU quando a
	// linha é `removed` (nenhuma barra atual — ver removedFromBaseline).
	geometry: { offsetDays: number; widthDays: number } | null;
	// Referência da baseline ativa para esta linha — só populada para
	// `compared` (junto da barra atual) e `removed` (sozinho). `scheduled_after`,
	// `added_after` e `compared_unrepresentable` nunca recebem ghost (nenhuma
	// referência histórica inventada).
	ghost: CronogramaGhost | null;
	// `true` só quando esta linha existe na projeção exclusivamente por ter
	// sido `removed` na baseline ativa (WorkItem sem schedule atual). Uma
	// linha `removed` nunca tem `geometry`.
	removedFromBaseline: boolean;
	removedNote: string | null;
	// `true` para um WorkItem CURRENT sem schedule completo que não é
	// `removed` na baseline ativa (ETAPA 12 do rework, §42, oitavo
	// microcorte — visibilidade de identidade sem cronograma). Identidade e
	// agrupamento normais, nenhuma geometria/ghost/conector — só o rótulo
	// factual "Sem cronograma".
	unscheduled: boolean;
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
	// Referência do cronograma (ETAPA 13 do rework, §43 — D068: a gestão da
	// referência pertence ao Cronograma) — passthrough direto de
	// ProjectView.scheduleBaseline, mesmo contrato que já existia em
	// TrackingView antes desta absorção; `null` é o caso normal (nenhuma
	// referência capturada ainda).
	scheduleBaseline: ScheduleBaselineView | null;
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
	return tryAddSemanticEnd(item.plannedStart, item.durationDays);
}

function tryAddSemanticEnd(plannedStart: string, durationDays: number): string | null {
	try {
		return addCivilDays(plannedStart, durationDays - 1);
	} catch {
		return null;
	}
}

const REMOVED_NOTE = 'Removido do cronograma atual — permanece na referência.';

// Ghost da referência ativa (compared/removed) — `null` só quando o FIM
// histórico (início + duração - 1) excede a faixa civil representável;
// falha isolada dessa referência específica, nunca fabrica geometria.
function buildGhost(baselinePlannedStart: string, baselineDurationDays: number, axisStart: string | null): CronogramaGhost | null {
	if (axisStart === null) return null;
	const baselineEnd = tryAddSemanticEnd(baselinePlannedStart, baselineDurationDays);
	if (baselineEnd === null) return null;
	return {
		offsetDays: civilDaysBetween(axisStart, baselinePlannedStart),
		widthDays: baselineDurationDays,
		plannedStartLabel: formatCivilDate(baselinePlannedStart),
		semanticEndLabel: formatCivilDate(baselineEnd),
		durationLabel: durationLabel(baselineDurationDays)
	};
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

function buildRow(
	item: ScheduledWorkItem,
	axisStart: string | null,
	semanticEnd: string | null,
	baselineGhostEntry: { baselinePlannedStart: string; baselineDurationDays: number } | undefined
): CronogramaWorkItemRow {
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
		geometry,
		ghost: baselineGhostEntry
			? buildGhost(baselineGhostEntry.baselinePlannedStart, baselineGhostEntry.baselineDurationDays, axisStart)
			: null,
		removedFromBaseline: false,
		removedNote: null,
		unscheduled: false
	};
}

// Linha `removed` (ETAPA 12 do rework, §42, sétimo microcorte) — identidade
// do WorkItem ATUAL (título/status/agrupamento), geometria exclusivamente da
// baseline. Nunca uma barra atual inventada.
function buildRemovedRow(
	item: WorkItemView,
	baselinePlannedStart: string,
	baselineDurationDays: number,
	axisStart: string | null
): CronogramaWorkItemRow {
	return {
		id: item.id,
		title: item.title,
		status: item.status,
		statusLabel: WORK_STATUS_LABEL[item.status],
		plannedStartLabel: null,
		durationLabel: null,
		semanticEndLabel: null,
		hasConflict: false,
		conflictLabel: null,
		geometry: null,
		ghost: buildGhost(baselinePlannedStart, baselineDurationDays, axisStart),
		removedFromBaseline: true,
		removedNote: REMOVED_NOTE,
		unscheduled: false
	};
}

// Sentinela de ordenação (ETAPA 12 do rework, §42, oitavo microcorte) — um
// WorkItem sem schedule e sem baseline não tem nenhuma data honesta para
// ordenar; maior que qualquer YYYY-MM-DD civil real, garante que a linha
// vá para o fim do próprio grupo em vez de competir por uma posição
// cronológica que não existe.
const UNSCHEDULED_SORT_KEY = '9999-99-99';

// Linha de identidade sem cronograma (ETAPA 12 do rework, §42, oitavo
// microcorte) — o WorkItem CURRENT existe e é visível (identidade +
// agrupamento), mas não tem schedule completo nem é `removed` na baseline
// ativa. Nenhuma geometria, ghost ou conector: só o fato "Sem cronograma".
function buildUnscheduledRow(item: WorkItemView): CronogramaWorkItemRow {
	return {
		id: item.id,
		title: item.title,
		status: item.status,
		statusLabel: WORK_STATUS_LABEL[item.status],
		plannedStartLabel: null,
		durationLabel: null,
		semanticEndLabel: null,
		hasConflict: false,
		conflictLabel: null,
		geometry: null,
		ghost: null,
		removedFromBaseline: false,
		removedNote: null,
		unscheduled: true
	};
}

// Uma linha agrupável — ou um WorkItem com schedule atual (`compared` e
// demais variantes sem ghost), ou uma linha `removed` ghost-only. A data
// usada para ordenação cronológica é a atual quando existe, senão a da
// própria referência histórica (única data honesta disponível para a
// linha).
interface GroupableRow {
	deliverableId: string | null;
	sortDate: string;
	createdAt: string;
	id: string;
	row: CronogramaWorkItemRow;
}

function buildGroups(rows: readonly GroupableRow[], deliverables: readonly DeliverableView[]): CronogramaGroup[] {
	const byGroup = new Map<string, GroupableRow[]>();
	for (const entry of rows) {
		const key = entry.deliverableId ?? NO_DELIVERABLE_KEY;
		const bucket = byGroup.get(key);
		if (bucket) bucket.push(entry);
		else byGroup.set(key, [entry]);
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
		const entries = [...(byGroup.get(key) ?? [])].sort((a, b) =>
			compareChronologically(
				{ plannedDate: a.sortDate, createdAt: a.createdAt, id: a.id },
				{ plannedDate: b.sortDate, createdAt: b.createdAt, id: b.id }
			)
		);
		return {
			key,
			title: groupTitle(key === NO_DELIVERABLE_KEY ? null : key, deliverables),
			items: entries.map((entry) => entry.row)
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
	// Baseline ATIVA (ETAPA 12 do rework, §42, sétimo microcorte) — `null`/
	// ausente reproduz exatamente o comportamento anterior a este microcorte
	// (falsificador A: sem baseline, o Cronograma não muda).
	scheduleBaseline?: ScheduleBaselineView | null;
}): CronogramaView {
	const scheduledItems = input.workItems.filter(isScheduled);
	const workItemById = new Map(input.workItems.map((item) => [item.id, item]));

	// Só `compared` e `removed` carregam referência histórica (D062/D063) —
	// `scheduled_after`, `added_after` e `compared_unrepresentable` nunca
	// recebem ghost (ver ScheduleBaselineComparisonEntryView).
	const comparedByWorkItemId = new Map<string, { baselinePlannedStart: string; baselineDurationDays: number }>();
	const removedEntries: { workItemId: string; baselinePlannedStart: string; baselineDurationDays: number }[] = [];
	for (const entry of input.scheduleBaseline?.entries ?? []) {
		if (entry.kind === 'compared') {
			comparedByWorkItemId.set(entry.workItemId, {
				baselinePlannedStart: entry.baselinePlannedStart,
				baselineDurationDays: entry.baselineDurationDays
			});
		} else if (entry.kind === 'removed') {
			removedEntries.push({
				workItemId: entry.workItemId,
				baselinePlannedStart: entry.baselinePlannedStart,
				baselineDurationDays: entry.baselineDurationDays
			});
		}
	}

	const semanticEndByWorkItemId = new Map<string, string | null>();
	for (const item of scheduledItems) {
		semanticEndByWorkItemId.set(item.id, trySemanticEnd(item));
	}

	const datedMilestones = input.milestones.filter(
		(milestone): milestone is MilestoneView & { plannedDate: string } => milestone.plannedDate !== null
	);

	// Menor intervalo que enquadra honestamente o que será exibido: início
	// dos WorkItems agendados + Milestones planejados + referências
	// históricas representáveis de `compared`/`removed`; fim dos mesmos
	// WorkItems (fim semântico, quando calculável) + Milestones + fins
	// históricos representáveis. Comparação lexicográfica de YYYY-MM-DD já é
	// ordem cronológica — sem Date. Início histórico sempre entra (é um dado
	// já persistido, válido por construção); fim histórico só entra quando a
	// aritmética civil não estourar (mesmo tratamento do fim atual).
	const baselineHistoricalEntries = [...comparedByWorkItemId.values(), ...removedEntries];
	const candidateStarts: string[] = [
		...scheduledItems.map((item) => item.plannedStart),
		...datedMilestones.map((milestone) => milestone.plannedDate),
		...baselineHistoricalEntries.map((entry) => entry.baselinePlannedStart)
	];
	const candidateEnds: string[] = [
		...[...semanticEndByWorkItemId.values()].filter((value): value is string => value !== null),
		...datedMilestones.map((milestone) => milestone.plannedDate),
		...baselineHistoricalEntries
			.map((entry) => tryAddSemanticEnd(entry.baselinePlannedStart, entry.baselineDurationDays))
			.filter((value): value is string => value !== null)
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

	const scheduledRows: GroupableRow[] = scheduledItems.map((item) => ({
		deliverableId: item.deliverable?.deliverableId ?? null,
		sortDate: item.plannedStart,
		createdAt: item.createdAt,
		id: item.id,
		row: buildRow(item, axisStart, semanticEndByWorkItemId.get(item.id) ?? null, comparedByWorkItemId.get(item.id))
	}));

	// `removed`: identidade/agrupamento vêm do WorkItem ATUAL (continua
	// existindo); WorkItem ausente seria estado corrompido — filtrado, nunca
	// quebra a surface (mesmo tratamento de buildScheduleBaselineComparisonEntryView).
	const removedRows: GroupableRow[] = [];
	const removedWorkItemIds = new Set<string>();
	for (const entry of removedEntries) {
		const item = workItemById.get(entry.workItemId);
		if (!item) continue;
		removedWorkItemIds.add(entry.workItemId);
		removedRows.push({
			deliverableId: item.deliverable?.deliverableId ?? null,
			sortDate: entry.baselinePlannedStart,
			createdAt: item.createdAt,
			id: item.id,
			row: buildRemovedRow(item, entry.baselinePlannedStart, entry.baselineDurationDays, axisStart)
		});
	}

	// Identidade sem cronograma (ETAPA 12 do rework, §42, oitavo microcorte)
	// — todo WorkItem CURRENT que não tem schedule completo e não já
	// apareceu como `removed` (essa linha já cobre sua identidade sozinha,
	// nunca duplicada aqui). Não participa de axis nem de Dependency —
	// scheduledIds/axisStart continuam derivados só de scheduledItems.
	const scheduledWorkItemIds = new Set(scheduledItems.map((item) => item.id));
	const unscheduledRows: GroupableRow[] = [];
	for (const item of input.workItems) {
		if (scheduledWorkItemIds.has(item.id) || removedWorkItemIds.has(item.id)) continue;
		unscheduledRows.push({
			deliverableId: item.deliverable?.deliverableId ?? null,
			sortDate: UNSCHEDULED_SORT_KEY,
			createdAt: item.createdAt,
			id: item.id,
			row: buildUnscheduledRow(item)
		});
	}

	return {
		groups: buildGroups([...scheduledRows, ...removedRows, ...unscheduledRows], input.deliverables),
		milestones: buildMilestones(input.milestones, axisStart),
		dependencies: buildDependencies(scheduledItems),
		axis,
		scheduleBaseline: input.scheduleBaseline ?? null
	};
}
