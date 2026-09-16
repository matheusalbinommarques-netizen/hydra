// Atenções (ETAPA 13 do rework, S13, terceiro microcorte, D065/D066) —
// projeção pura sobre fatos A-known já congelados: WorkItem bloqueado,
// Impediment aberto, PendingItem aberto. Migrado de tracking-view.ts
// (buildBlockedWorkItems/buildImpediments/buildAttentionPendingItems), sem
// alterar a lógica de não-duplicação já estabelecida ali: um Impediment
// vinculado a um WorkItem bloqueado aparece só como o card do bloqueio,
// nunca duas vezes. Vive em `$lib/` (mesmo espírito de risk-view.ts/
// decision-view.ts) por representar leitura sobre o mesmo lifecycle real de
// Impediment/PendingItem que outras rotas também tocam.
//
// Risk aberto e Decision pendente NÃO entram aqui (D065/D066) — Atenções é
// composição factual estreita, não um agregador de tudo que "importa".
import type { ImpedimentType, WorkItemStatus } from '$lib/domain';
import type { PendingItemView } from '$lib/orientation-engine';
import type { ImpedimentView, WorkItemView } from '$lib/server/application/types';

export interface AttentionBlockedWaitingWorkItem {
	workItemId: string;
	title: string;
}

// Mesmo contrato de TrackingBlockedWorkItem (tracking-view.ts, ETAPA 6 do
// rework) — um WorkItem por card, só quando bloqueado por um Impediment
// aberto, com a explicação sempre textual (nunca health score/semáforo) e o
// impacto downstream (WorkItems abertos que dependem deste) exposto por
// inteiro, não só como contagem.
export interface AttentionBlockedWorkItem {
	workItemId: string;
	title: string;
	status: WorkItemStatus;
	impedimentId: string;
	impedimentText: string;
	impedimentTipo: ImpedimentType;
	why: string;
	waitingWorkItems: AttentionBlockedWaitingWorkItem[];
	waitingLabel: string | null;
}

export interface AttentionPendingItem {
	id: string;
	label: string;
	detail: string;
	activityDefinitionId: string;
}

export interface AttentionImpedimentsView {
	open: ImpedimentView[];
	resolved: ImpedimentView[];
}

export interface AttentionsView {
	blockedWorkItems: AttentionBlockedWorkItem[];
	impediments: AttentionImpedimentsView;
	pendingItems: AttentionPendingItem[];
}

export interface AttentionsViewInput {
	workItems: WorkItemView[];
	impediments: ImpedimentView[];
	openPendingItems: PendingItemView[];
}

const WORK_STATUS_LABEL: Record<WorkItemStatus, string> = {
	a_fazer: 'A fazer',
	em_andamento: 'Em andamento',
	concluido: 'Concluído'
};

function buildBlockedWorkItems(workItems: WorkItemView[]): AttentionBlockedWorkItem[] {
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

// Quem depende deste item bloqueado e ainda está aberto — mesma regra de
// tracking-view.ts: um WorkItem já concluído não aguarda ninguém (Dependency
// não impede conclusão, D039), e um item bloqueado por Impediment aberto
// nunca está 'concluido' (moveWorkItem recusa a transição).
function buildWaitingWorkItems(workItems: WorkItemView[], blockedWorkItemId: string): AttentionBlockedWaitingWorkItem[] {
	return workItems
		.filter(
			(candidate) =>
				candidate.status !== 'concluido' &&
				candidate.dependsOn.some((dependency) => dependency.dependsOnWorkItemId === blockedWorkItemId)
		)
		.map((candidate) => ({ workItemId: candidate.id, title: candidate.title }));
}

// "Mantém aguardando", nunca "destrava"/"libera": resolver o impedimento não
// satisfaz a Dependency (mesmo espírito de tracking-view.ts).
function buildWaitingLabel(waitingWorkItems: AttentionBlockedWaitingWorkItem[]): string | null {
	if (waitingWorkItems.length === 0) return null;
	if (waitingWorkItems.length === 1) return `Também mantém ${waitingWorkItems[0].title} aguardando.`;
	return `Também mantém ${waitingWorkItems.length} trabalhos aguardando.`;
}

// Impedimentos vinculados a um WorkItem (workItemId !== null) já têm sua
// própria projeção acionável em buildBlockedWorkItems — mantê-los também
// aqui duplicaria o mesmo fato operacional (achado de dogfooding original,
// preservado ao migrar de tracking-view.ts). Impedimentos sem WorkItem (o
// caso normal de impedimento no nível do projeto) continuam aparecendo
// normalmente. Resolvidos ficam juntos: histórico passivo.
function buildImpediments(impediments: ImpedimentView[]): AttentionImpedimentsView {
	return {
		open: impediments.filter((impediment) => impediment.status === 'aberto' && impediment.workItemId === null),
		resolved: impediments.filter((impediment) => impediment.status === 'resolvido')
	};
}

function buildPendingItems(openPendingItems: PendingItemView[]): AttentionPendingItem[] {
	return openPendingItems.map((item) => ({
		id: item.id,
		label: item.label,
		detail: item.detail,
		activityDefinitionId: item.activityDefinitionId
	}));
}

export function buildAttentionsView(input: AttentionsViewInput): AttentionsView {
	return {
		blockedWorkItems: buildBlockedWorkItems(input.workItems),
		impediments: buildImpediments(input.impediments),
		pendingItems: buildPendingItems(input.openPendingItems)
	};
}
