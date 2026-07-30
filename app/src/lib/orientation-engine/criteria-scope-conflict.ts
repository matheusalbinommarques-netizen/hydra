// Conflito critério × escopo — sinal de nível de projeto, não por critério
// individual. Função pura, nunca persistida, recalculada a cada leitura a
// partir de Answer[]/ScopeItem[], mesmo padrão de
// computeScopeSuggestions/computeScopeProjection.
//
// Regra: true quando existe pelo menos uma resposta não vazia em
// "criterios_sucesso_produto" (qualquer um dos seus campos) e não existe
// nenhum ScopeItem no bucket "agora" que possa sustentá-la. Deliberadamente
// grosseiro — "criterios_sucesso_produto" hoje é texto livre, sem estrutura
// de lista, então não há como apontar qual critério específico carece de
// suporte; isso é uma limitação aceita do schema atual, não um retrabalho
// pendente.

import type { Answer, ScopeItem } from '$lib/domain';

export interface CriteriaScopeConflict {
	triggered: boolean;
	message: string | null;
}

// Fonte fixa: a atividade "Definir critérios de sucesso do produto"
// (catalog/product-definition.ts). Específico de propósito — não genérico.
const CRITERIA_ACTIVITY_ID = 'criterios_sucesso_produto';

export function computeCriteriaScopeConflict(answers: Answer[], scopeItems: ScopeItem[]): CriteriaScopeConflict {
	const hasCriteriaDefined = answers.some(
		(answer) => answer.activityDefinitionId === CRITERIA_ACTIVITY_ID && answer.value.trim().length > 0
	);
	const hasScopeItemNow = scopeItems.some((item) => item.bucket === 'agora');

	const triggered = hasCriteriaDefined && !hasScopeItemNow;

	return {
		triggered,
		message: triggered
			? 'Você definiu critérios de sucesso, mas nenhum item de escopo em "Agora" os sustenta ainda.'
			: null
	};
}
