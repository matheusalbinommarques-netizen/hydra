// Projeção pura de leitura para "Acompanhamento" (etapa 7.4 do roadmap;
// seção "Bloqueios" adicionada na ETAPA 6 do rework, "Primeiro loop
// operacional") — compõe situação atual, síntese de Trabalho, bloqueios,
// atenções e continuidade a partir de projeções e campos já existentes
// (buildJourneyContext, buildPhaseProgress, buildWorkView, view.impediments,
// view.workItems, view.openPendingItems). Não lê catálogo nem persistência
// diretamente, não decide nada (isso já foi decidido por orientation-engine/
// e pelas projeções reaproveitadas), não introduz estado de domínio novo.

import type { ImpedimentType, MilestoneStatus, WorkItemStatus } from '$lib/domain';
import type {
	ChangeView,
	DecisionView,
	ImpedimentView,
	MilestoneView,
	RiskView,
	ScheduleBaselineView,
	WorkItemView
} from '$lib/server/application/types';
import type { NextActivityResult, PendingItemView } from '$lib/orientation-engine';
import type { PhaseProgressView } from '$lib/phase-progress';
import type { JourneyContextView } from '../now/journey-context';
import { buildWorkView, type WorkItemBoardCounts } from '../work/work-view';

export interface TrackingSituationView {
	phaseLabel: string;
	positionLabel: string;
	activityLabel: string;
	progressLabel: string;
	progressPercent: number;
}

export type TrackingWorkState = 'em_andamento' | 'sem_andamento' | 'concluido' | 'nenhuma';

export interface TrackingWorkView {
	counts: WorkItemBoardCounts;
	inProgress: WorkItemView[];
	state: TrackingWorkState;
}

export interface TrackingAttentionPendingItem {
	id: string;
	label: string;
	detail: string;
	activityDefinitionId: string;
}

export interface TrackingImpedimentsView {
	open: ImpedimentView[];
	resolved: ImpedimentView[];
}

// Riscos (ETAPA 10 do rework, primeiro microcorte, D049) — mesmo molde de
// TrackingImpedimentsView: abertos/encerrados separados, sem promoção
// automática a "Precisa de você" nem a "Atenções" — sem avaliação/urgência
// estruturada, isso fingiria acionabilidade que o modelo ainda não conhece.
export interface TrackingRisksView {
	open: RiskView[];
	closed: RiskView[];
}

// Decisões/mudanças (ETAPA 11 do rework, primeiro microcorte, §41) — mesmo
// molde de TrackingRisksView: pendentes/tomadas separadas, sem promoção
// automática a "Precisa de você" nem a "Atenções" — ter prazo declarado não
// implica nenhuma regra de urgência automática nesta fatia.
export interface TrackingDecisionsView {
	pending: DecisionView[];
	decided: DecisionView[];
}

// Bloqueios (ETAPA 6 do rework) — sinal estreito, derivado, explicável e
// acionável (contrato de Signal, ver HYDRA_PRODUCT_REWORK.md §15): um
// WorkItem por card, só quando bloqueado por um Impediment aberto. `why` é
// texto simples (mesmo espírito de TrackingContinuityView.label), não um
// health score nem semáforo — a explicação é sempre "este impedimento está
// bloqueando trabalho no estado X", nunca um cálculo de severidade.
export interface TrackingBlockedWorkItem {
	workItemId: string;
	title: string;
	// Estado operacional atual do WorkItem — exposto para a interface poder
	// explicar, antes da ação de "marcar como resolvido", que esse estado NÃO
	// muda automaticamente (só o bloqueio é removido). Achado de dogfooding:
	// "Resolver impedimento" parecia resolver o problema sozinho; a interface
	// precisa desta informação para dar contexto antes da mutação.
	status: WorkItemStatus;
	impedimentId: string;
	impedimentText: string;
	impedimentTipo: ImpedimentType;
	why: string;
	// Impacto downstream (ETAPA 8 do rework, terceiro microcorte) — WorkItems
	// ainda abertos que declararam depender deste item bloqueado. Derivado
	// aqui, nunca persistido, e composto só a partir de fatos que a projeção
	// já recebe: A.dependsOn -> B.id -> B.blockedBy. Os itens afetados reais
	// ficam expostos (não só uma contagem) para a derivação continuar
	// explicável e testável. Não é um sinal novo nem um card novo: enriquece
	// o card do impedimento que já existe, para não oferecer duas ações
	// concorrentes sobre o mesmo Impediment.
	waitingWorkItems: TrackingBlockedWaitingWorkItem[];
	waitingLabel: string | null;
}

// Um WorkItem afetado, visto a partir do item bloqueado (mesmo espírito de
// WorkItemDependencyView: título junto, para a interface não cruzar listas).
export interface TrackingBlockedWaitingWorkItem {
	workItemId: string;
	title: string;
}

// Linha do tempo (ETAPA 8 do rework, microcorte de Timeline;
// HYDRA_PRODUCT_REWORK.md §16 "Linha do tempo" e §17, prontidão "datas/marcos").
// LISTA cronológica declarada, nunca gráfico de scheduling: sem barra, sem
// escala espacial, sem "hoje", sem atraso, sem folga e sem comparação entre
// plannedDate e reachedAt — variação é §42.
//
// `status` é o estado DECLARADO do marco e continua sendo a única autoridade
// (D040): a Timeline não corrige nem interpreta um marco alcançado com data
// futura ou passada, só mostra os dois fatos.
export interface TrackingMilestoneTimelineEntry {
	kind: 'milestone';
	// Comum às duas variantes (ver TrackingWorkItemTimelineEntry) — chave de
	// lista e desempate de ordenação (ver compareTimelineEntries).
	id: string;
	title: string;
	// Data civil crua (YYYY-MM-DD), preservada para ordenação/teste.
	plannedDate: string;
	// Mesmo dia em pt-BR (dd/mm/aaaa), formatado por manipulação de string —
	// plannedDate nunca vira Date, que deslocaria o dia por timezone.
	plannedDateLabel: string;
	status: MilestoneStatus;
	statusLabel: string;
	// Instante real do alcance, cru: é timestamp (fato do sistema), não dia
	// civil, e a interface o formata com o tratamento de timestamp já usado no
	// repo. null enquanto o marco está aberto.
	reachedAt: string | null;
	// Só desempate (ver compareTimelineEntries). Nunca exibido: a Linha do
	// tempo afirma data planejada e estado declarado, não quando o marco foi
	// cadastrado.
	createdAt: string;
}

// WorkItem com schedule (ETAPA 12 do rework, "Scheduling e Gantt", §42,
// primeiro microcorte fundacional) — segunda variante da Linha do tempo,
// primeiro leitor real do fato temporal manual introduzido em
// WorkItem.plannedStart/durationDays. Só entram aqui WorkItems com schedule
// COMPLETO (ver buildWorkItemTimelineEntries) — sem schedule, o WorkItem
// continua existindo normalmente em Trabalho, fora desta lista. Sem
// plannedEnd exposto (não calculado nem persistido nesta rodada) e sem
// nenhuma promessa de precedência/propagação: `durationLabel` é só o dado
// declarado, formatado.
export interface TrackingWorkItemTimelineEntry {
	kind: 'workItem';
	id: string;
	title: string;
	plannedDate: string;
	plannedDateLabel: string;
	durationDays: number;
	durationLabel: string;
	status: WorkItemStatus;
	statusLabel: string;
	createdAt: string;
}

export type TrackingTimelineEntry = TrackingMilestoneTimelineEntry | TrackingWorkItemTimelineEntry;

export interface TrackingContinuityView {
	completed: boolean;
	label: string;
}

// Opção enxuta para o seletor "Trabalhos afetados" de uma Decision (ETAPA 11
// do rework, terceiro microcorte, §41) — mesmo espírito de allDecisions em
// +page.svelte (todos os WorkItems do projeto, sem filtrar por status: um
// WorkItem concluído continua podendo ser marcado como afetado por uma
// decisão registrada depois).
export interface TrackingWorkItemOption {
	id: string;
	title: string;
}

export interface TrackingView {
	situation: TrackingSituationView | undefined;
	work: TrackingWorkView;
	// Vazia quando nenhum marco tem data planejada — nesse caso a seção
	// simplesmente não existe na página (§17: surface só aparece quando há
	// dados suficientes; nada de aba/placeholder vazio).
	timeline: TrackingTimelineEntry[];
	// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte) —
	// passthrough direto de ProjectView.scheduleBaseline (já projetado com
	// títulos denormalizados por project-view.ts); `null` é o caso normal
	// (nenhuma baseline capturada ainda).
	scheduleBaseline: ScheduleBaselineView | null;
	blockedWorkItems: TrackingBlockedWorkItem[];
	attentionPendingItems: TrackingAttentionPendingItem[];
	impediments: TrackingImpedimentsView;
	risks: TrackingRisksView;
	decisions: TrackingDecisionsView;
	// Opções para o seletor "Trabalhos afetados" dentro de cada Decision —
	// todos os WorkItems do projeto (ver TrackingWorkItemOption acima).
	workItemOptions: TrackingWorkItemOption[];
	changes: ChangeView[];
	continuity: TrackingContinuityView;
}

export interface TrackingViewInput {
	journeyContext: JourneyContextView | undefined;
	phaseProgress: PhaseProgressView | undefined;
	nextActivity: NextActivityResult;
	workItems: WorkItemView[];
	milestones: MilestoneView[];
	scheduleBaseline: ScheduleBaselineView | null;
	impediments: ImpedimentView[];
	risks: RiskView[];
	decisions: DecisionView[];
	changes: ChangeView[];
	openPendingItems: PendingItemView[];
}

const WORK_STATUS_LABEL: Record<WorkItemView['status'], string> = {
	a_fazer: 'A fazer',
	em_andamento: 'Em andamento',
	concluido: 'Concluído'
};

function buildSituation(
	journeyContext: JourneyContextView | undefined,
	phaseProgress: PhaseProgressView | undefined
): TrackingSituationView | undefined {
	if (!journeyContext) return undefined;

	const positionLabel =
		journeyContext.kind === 'in_progress'
			? `Fase ${journeyContext.position} de ${journeyContext.total}`
			: `${journeyContext.total} de ${journeyContext.total} fases percorridas`;
	const phaseLabel = journeyContext.kind === 'in_progress' ? journeyContext.phaseLabel : 'Jornada concluída';

	if (!phaseProgress) {
		return { phaseLabel, positionLabel, activityLabel: '—', progressLabel: 'Sem atividades aplicáveis.', progressPercent: 0 };
	}

	// A fase-alvo de buildPhaseProgress já é a fase da atividade recomendada
	// (Trilha A) — o grupo "atual" contém exatamente essa atividade, a mesma
	// que view.nextActivity aponta. Reaproveitado também pela Continuidade,
	// abaixo, para não duplicar a busca da atividade atual.
	const current = phaseProgress.groups.find((group) => group.key === 'atual')?.activities[0];
	const progressPercent =
		phaseProgress.totalActivities > 0
			? Math.round((phaseProgress.resolvedActivities / phaseProgress.totalActivities) * 100)
			: 0;

	return {
		phaseLabel,
		positionLabel,
		activityLabel: current?.title ?? '—',
		progressLabel: `${phaseProgress.resolvedActivities} de ${phaseProgress.totalActivities} atividades concluídas`,
		progressPercent
	};
}

function buildWork(workItems: WorkItemView[]): TrackingWorkView {
	const board = buildWorkView(workItems);
	const total = board.counts.a_fazer + board.counts.em_andamento + board.counts.concluido;

	let state: TrackingWorkState;
	if (total === 0) {
		state = 'nenhuma';
	} else if (board.groups.em_andamento.length > 0) {
		state = 'em_andamento';
	} else if (board.counts.concluido === total) {
		state = 'concluido';
	} else {
		state = 'sem_andamento';
	}

	return { counts: board.counts, inProgress: board.groups.em_andamento, state };
}

function buildBlockedWorkItems(workItems: WorkItemView[]): TrackingBlockedWorkItem[] {
	return workItems
		.filter((item) => item.blockedBy !== null)
		.map((item) => {
			const waitingWorkItems = buildWaitingWorkItems(workItems, item.id);
			return {
				workItemId: item.id,
				title: item.title,
				status: item.status,
				// filter acima já garante blockedBy !== null.
				impedimentId: item.blockedBy!.impedimentId,
				impedimentText: item.blockedBy!.text,
				impedimentTipo: item.blockedBy!.tipo,
				why: `Este impedimento está bloqueando trabalho atualmente em "${WORK_STATUS_LABEL[item.status]}".`,
				waitingWorkItems,
				waitingLabel: buildWaitingLabel(waitingWorkItems)
			};
		});
}

// Quem depende deste item bloqueado e ainda está aberto. `status !==
// 'concluido'` não é detalhe: um WorkItem já concluído não aguarda ninguém —
// Dependency deliberadamente não impede a conclusão (D039), e afirmar que ele
// aguarda seria falso, o mesmo defeito que produziu a apresentação 'pendente'
// em Trabalho. Nenhuma condição extra sobre a aresta é necessária: um item
// bloqueado por Impediment aberto nunca está 'concluido' (moveWorkItem recusa
// a transição), logo a precedência é sempre insatisfeita aqui.
function buildWaitingWorkItems(workItems: WorkItemView[], blockedWorkItemId: string): TrackingBlockedWaitingWorkItem[] {
	return workItems
		.filter(
			(candidate) =>
				candidate.status !== 'concluido' &&
				candidate.dependsOn.some((dependency) => dependency.dependsOnWorkItemId === blockedWorkItemId)
		)
		.map((candidate) => ({ workItemId: candidate.id, title: candidate.title }));
}

// "Mantém aguardando", nunca "destrava"/"libera": resolver o impedimento não
// satisfaz a Dependency — os afetados continuam aguardando até o predecessor
// ser CONCLUÍDO. Escolha pura e testável (mesmo padrão de
// allMilestonesLinkedHint em work-view.ts); `null` quando não há afetados, e a
// interface simplesmente não desenha a linha.
function buildWaitingLabel(waitingWorkItems: TrackingBlockedWaitingWorkItem[]): string | null {
	if (waitingWorkItems.length === 0) return null;
	if (waitingWorkItems.length === 1) return `Também mantém ${waitingWorkItems[0].title} aguardando.`;
	return `Também mantém ${waitingWorkItems.length} trabalhos aguardando.`;
}

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
	aberto: 'Em aberto',
	alcancado: 'Alcançado'
};

// dd/mm/aaaa a partir das partes da própria string. Deliberadamente sem Date e
// sem Intl: a semântica é dia civil, e converter para instante desloca o dia em
// qualquer fuso a oeste de Greenwich (2026-09-01 viraria 31/08). A string já
// chegou aqui validada por isCivilDate (domain/civil-date.ts).
function formatCivilDate(plannedDate: string): string {
	const [year, month, day] = plannedDate.split('-');
	return `${day}/${month}/${year}`;
}

// Só marcos COM data planejada: um marco sem data não tem fato temporal e
// continua existindo normalmente em Trabalho. Mesma regra para WorkItem: só
// entram aqui os com schedule COMPLETO (ver buildWorkItemTimelineEntries).
//
// Ordenação totalmente determinística, sem depender da estabilidade do `sort`
// nem da ordem incidental em que a projeção recebeu marcos/WorkItems:
//   1. plannedDate ASC — comparação lexicográfica de YYYY-MM-DD é exatamente a
//      ordem cronológica, sem construir Date;
//   2. createdAt ASC — mesma data planejada mantém a ordem de criação;
//   3. id ASC — resolve o caso extremo restante (mesma data e mesmo instante
//      de criação), para a lista nunca depender de acaso.
// Nenhum dos três é ordenação de PRODUTO: não existe campo `order` em
// Milestone nem em WorkItem, e prioridade/recorte continuam pertencendo a
// Roadmap (§38)/Entregas.
function compareTimelineEntries(a: TrackingTimelineEntry, b: TrackingTimelineEntry): number {
	if (a.plannedDate !== b.plannedDate) return a.plannedDate < b.plannedDate ? -1 : 1;
	if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildMilestoneTimelineEntries(milestones: MilestoneView[]): TrackingMilestoneTimelineEntry[] {
	return milestones
		.filter((milestone) => milestone.plannedDate !== null)
		.map((milestone) => ({
			kind: 'milestone',
			id: milestone.id,
			// filter acima já garante plannedDate !== null.
			plannedDate: milestone.plannedDate!,
			plannedDateLabel: formatCivilDate(milestone.plannedDate!),
			title: milestone.title,
			status: milestone.status,
			statusLabel: MILESTONE_STATUS_LABEL[milestone.status],
			reachedAt: milestone.reachedAt,
			createdAt: milestone.createdAt
		}));
}

function durationLabel(durationDays: number): string {
	return durationDays === 1 ? '1 dia' : `${durationDays} dias`;
}

// Só WorkItems com schedule COMPLETO (plannedStart e durationDays não-null —
// a invariante do domínio já garante que os dois vêm juntos, ver WorkItem em
// domain/state-types.ts). Sem plannedEnd: não é calculado nem persistido
// nesta rodada, e não há consumidor real ainda (ver HYDRA_PRODUCT_REWORK.md
// §42).
function buildWorkItemTimelineEntries(workItems: WorkItemView[]): TrackingWorkItemTimelineEntry[] {
	return workItems
		.filter((item): item is WorkItemView & { plannedStart: string; durationDays: number } =>
			item.plannedStart !== null && item.durationDays !== null
		)
		.map((item) => ({
			kind: 'workItem',
			id: item.id,
			plannedDate: item.plannedStart,
			plannedDateLabel: formatCivilDate(item.plannedStart),
			durationDays: item.durationDays,
			durationLabel: durationLabel(item.durationDays),
			title: item.title,
			status: item.status,
			statusLabel: WORK_STATUS_LABEL[item.status],
			createdAt: item.createdAt
		}));
}

function buildTimeline(milestones: MilestoneView[], workItems: WorkItemView[]): TrackingTimelineEntry[] {
	return [...buildMilestoneTimelineEntries(milestones), ...buildWorkItemTimelineEntries(workItems)].sort(
		compareTimelineEntries
	);
}

function buildAttentionPendingItems(openPendingItems: PendingItemView[]): TrackingAttentionPendingItem[] {
	return openPendingItems.map((item) => ({
		id: item.id,
		label: item.label,
		detail: item.detail,
		activityDefinitionId: item.activityDefinitionId
	}));
}

// Impedimentos vinculados a um WorkItem (workItemId !== null) já têm sua
// própria projeção acionável e explicável em "Precisa de você"
// (buildBlockedWorkItems, acima) — mantê-los também aqui duplicaria o mesmo
// fato operacional em "Atenções" e ofereceria uma segunda superfície
// administrativa concorrente ("Gestão de impedimentos") para o mesmo
// bloqueio (achado real de dogfooding, não hipotético). Impedimentos sem
// WorkItem (o caso normal de impedimento no nível do projeto) continuam
// aparecendo aqui exatamente como antes — este filtro não muda o
// comportamento deles. Resolvidos continuam todos juntos: histórico passivo,
// não é uma segunda superfície de ação sobre um bloqueio ainda aberto.
function buildImpediments(impediments: ImpedimentView[]): TrackingImpedimentsView {
	return {
		open: impediments.filter((impediment) => impediment.status === 'aberto' && impediment.workItemId === null),
		resolved: impediments.filter((impediment) => impediment.status === 'resolvido')
	};
}

function buildRisks(risks: RiskView[]): TrackingRisksView {
	return {
		open: risks.filter((risk) => risk.status === 'aberto'),
		closed: risks.filter((risk) => risk.status === 'encerrado')
	};
}

function buildDecisions(decisions: DecisionView[]): TrackingDecisionsView {
	return {
		pending: decisions.filter((decision) => decision.status === 'pendente'),
		decided: decisions.filter((decision) => decision.status === 'tomada')
	};
}

function buildContinuity(
	nextActivity: NextActivityResult,
	situation: TrackingSituationView | undefined
): TrackingContinuityView {
	if (nextActivity.kind === 'catalog_limit_reached') {
		return { completed: true, label: 'Não há próxima atividade — o projeto foi concluído.' };
	}
	return { completed: false, label: `Próxima atividade: ${situation?.activityLabel ?? '—'}` };
}

function buildWorkItemOptions(workItems: WorkItemView[]): TrackingWorkItemOption[] {
	return workItems.map((item) => ({ id: item.id, title: item.title }));
}

export function buildTrackingView(input: TrackingViewInput): TrackingView {
	const situation = buildSituation(input.journeyContext, input.phaseProgress);

	return {
		situation,
		work: buildWork(input.workItems),
		timeline: buildTimeline(input.milestones, input.workItems),
		scheduleBaseline: input.scheduleBaseline,
		blockedWorkItems: buildBlockedWorkItems(input.workItems),
		attentionPendingItems: buildAttentionPendingItems(input.openPendingItems),
		impediments: buildImpediments(input.impediments),
		risks: buildRisks(input.risks),
		decisions: buildDecisions(input.decisions),
		workItemOptions: buildWorkItemOptions(input.workItems),
		changes: input.changes,
		continuity: buildContinuity(input.nextActivity, situation)
	};
}
