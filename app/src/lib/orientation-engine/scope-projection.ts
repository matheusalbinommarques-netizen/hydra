// Projeção somente-leitura do artefato "Escolha o próximo foco" — ver
// docs/core/ORIENTATION_ENGINE.md. Função pura: nunca persistida, recalculada
// a cada leitura a partir de ScopeItem[]/ScopeVersion, mesmo padrão de
// buildMapView/buildRecordsView. A única regra determinística (alerta de
// esforço concentrado em "agora") mora aqui — não é motor configurável, é um
// `if` simples, deliberadamente específico desta experiência.

import type { ScopeEffort, ScopeExecutionStatus, ScopeItem, ScopeVersion } from '$lib/domain';

export interface ScopeProjectionItemView {
	id: string;
	text: string;
	effort: ScopeEffort | null;
	// Só populado com sentido para itens de 'agora' (D025, decision-log.md) —
	// presente em todo item por simplicidade da projeção, a interface decide
	// se exibe conforme o bucket.
	executionStatus: ScopeExecutionStatus;
}

export interface ScopeAlert {
	triggered: boolean;
	message: string | null;
}

export interface ScopeProjectionView {
	agora: ScopeProjectionItemView[];
	depois: ScopeProjectionItemView[];
	fora: ScopeProjectionItemView[];
	hypothesis: string;
	alert: ScopeAlert;
}

// Mais de 5 itens de esforço médio/grande em "agora" é o sinal de que o
// recorte pode estar crescendo além do que a hipótese original previa.
const AGORA_HEAVY_EFFORT_ALERT_THRESHOLD = 5;
const HEAVY_EFFORTS: readonly ScopeEffort[] = ['medio', 'grande'];

function toItemView(item: ScopeItem): ScopeProjectionItemView {
	return { id: item.id, text: item.text, effort: item.effort, executionStatus: item.executionStatus ?? 'a_fazer' };
}

export function computeScopeProjection(scopeItems: ScopeItem[], scopeVersion: ScopeVersion): ScopeProjectionView {
	const agora = scopeItems
		.filter((item) => item.bucket === 'agora')
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map(toItemView);
	const depois = scopeItems.filter((item) => item.bucket === 'depois').map(toItemView);
	const fora = scopeItems.filter((item) => item.bucket === 'fora').map(toItemView);

	const heavyAgoraCount = agora.filter((item) => item.effort && HEAVY_EFFORTS.includes(item.effort)).length;
	const triggered = heavyAgoraCount > AGORA_HEAVY_EFFORT_ALERT_THRESHOLD;

	return {
		agora,
		depois,
		fora,
		hypothesis: scopeVersion.hypothesis,
		alert: {
			triggered,
			message: triggered
				? `${heavyAgoraCount} itens em "Agora" têm esforço médio ou grande — considere mover parte para "Depois" antes de avançar.`
				: null
		}
	};
}
