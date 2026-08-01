// Projeção pura de leitura para "Entregas" — agrupa itens de escopo do
// bucket 'agora' pelos três estados de execução já existentes (D025,
// etapa 4 do roadmap). Não lê nem grava persistência, não conhece
// ProjectState bruto. Mesmo padrão de buildRecordsView/buildMapView.

import type { ScopeEffort, ScopeExecutionStatus } from '$lib/domain';

export interface DeliveriesScopeItemInput {
	id: string;
	text: string;
	bucket: string;
	effort: ScopeEffort | null;
	// Ausente em itens legados anteriores a D025 — tratado como 'a_fazer'.
	executionStatus?: ScopeExecutionStatus;
}

export interface DeliveriesScopeVersionInput {
	confirmedAt: string | null;
}

export interface DeliveryItemView {
	id: string;
	text: string;
	effort: ScopeEffort | null;
	executionStatus: ScopeExecutionStatus;
}

export interface DeliveriesGroups {
	a_fazer: DeliveryItemView[];
	em_andamento: DeliveryItemView[];
	concluido: DeliveryItemView[];
}

export interface DeliveriesCounts {
	a_fazer: number;
	em_andamento: number;
	concluido: number;
}

export interface DeliveriesView {
	confirmed: boolean;
	groups: DeliveriesGroups;
	counts: DeliveriesCounts;
}

function toItemView(item: DeliveriesScopeItemInput): DeliveryItemView {
	return { id: item.id, text: item.text, effort: item.effort, executionStatus: item.executionStatus ?? 'a_fazer' };
}

export function buildDeliveriesView(
	scopeItems: DeliveriesScopeItemInput[],
	scopeVersion: DeliveriesScopeVersionInput
): DeliveriesView {
	// Ordem original preservada: filter mantém a ordem relativa do array de
	// entrada, sem reordenar por ScopeItem.order (esse é o critério de
	// "Escolha o próximo foco", não de "Entregas").
	const agora = scopeItems.filter((item) => item.bucket === 'agora').map(toItemView);

	const groups: DeliveriesGroups = {
		a_fazer: agora.filter((item) => item.executionStatus === 'a_fazer'),
		em_andamento: agora.filter((item) => item.executionStatus === 'em_andamento'),
		concluido: agora.filter((item) => item.executionStatus === 'concluido')
	};

	return {
		confirmed: scopeVersion.confirmedAt !== null,
		groups,
		counts: {
			a_fazer: groups.a_fazer.length,
			em_andamento: groups.em_andamento.length,
			concluido: groups.concluido.length
		}
	};
}
