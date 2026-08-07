// PlanningItem — valor estruturado dentro de Answer.value do campo
// `partes_trabalho` (atividade `decompor_trabalho`, FieldDefinition.type
// `lista_partes`) — experimento C5-01 ("Construir" → "Operar" na fase
// Planejamento da entrega). Mesmo padrão de domain/multi-select.ts: Answer
// continua com uma única linha por campo; o que muda é que `value` guarda um
// array JSON, nunca uma string separada por vírgula.
//
// Todo encode/decode do formato interno fica encapsulado aqui — nenhum outro
// módulo (componentes, routes, Records, application layer, transitions) deve
// chamar JSON.parse/JSON.stringify sobre este valor diretamente.
//
// PlanningItem é um valor estruturado deste experimento, não uma entidade
// universal do domínio: só id/text, ordem = posição no array. Se no futuro
// ganhar lifecycle ou atributos próprios (esforço, dependências,
// responsáveis, critérios etc.) ou passar a ser referenciado individualmente
// por outra atividade, isso é o sinal para reavaliar a promoção para
// entidade/tabela própria — não para expandir este formato.

export interface PlanningItem {
	id: string;
	text: string;
}

export function encodePlanningItems(items: readonly PlanningItem[]): string {
	return JSON.stringify(items);
}

export function decodePlanningItems(raw: string | null | undefined): PlanningItem[] {
	if (!raw) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];

	const items: PlanningItem[] = [];
	for (const entry of parsed) {
		if (
			entry &&
			typeof entry === 'object' &&
			typeof (entry as { id?: unknown }).id === 'string' &&
			typeof (entry as { text?: unknown }).text === 'string'
		) {
			items.push({ id: (entry as { id: string }).id, text: (entry as { text: string }).text });
		}
	}
	return items;
}

// Geração de id centralizada nesta única função — chamada uma vez pela UI ao
// adicionar um item novo (nunca no domínio, nunca no servidor: PlanningItem.id
// nasce no cliente, por decisão de C5-01). `crypto.randomUUID()` cobre todo
// navegador moderno em contexto seguro (HTTPS/localhost); o fallback só
// existe para o caso raro de ausência — nunca falha silenciosamente, nunca
// reintroduz dependência externa.
export function generatePlanningItemId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `planning-item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Novo item entra sempre no final — nunca reordena os itens já existentes. */
export function addPlanningItem(items: readonly PlanningItem[], id: string, text: string): PlanningItem[] {
	return [...items, { id, text }];
}

/** Mantém a posição do item no array — rename nunca move nada. */
export function renamePlanningItem(items: readonly PlanningItem[], id: string, text: string): PlanningItem[] {
	return items.map((item) => (item.id === id ? { ...item, text } : item));
}

/** Remove o item e preserva a ordem relativa dos demais (é só um filter). */
export function removePlanningItem(items: readonly PlanningItem[], id: string): PlanningItem[] {
	return items.filter((item) => item.id !== id);
}

export type PlanningItemMoveDirection = 'up' | 'down';

/**
 * Troca o item com o vizinho adjacente. Primeiro item não sobe, último não
 * desce — fora dos limites é uma operação sem efeito (nunca lança), mesma
 * postura defensiva de moveScopeItem/reorderAgoraItems.
 */
export function movePlanningItem(
	items: readonly PlanningItem[],
	id: string,
	direction: PlanningItemMoveDirection
): PlanningItem[] {
	const index = items.findIndex((item) => item.id === id);
	if (index === -1) return [...items];
	const targetIndex = direction === 'up' ? index - 1 : index + 1;
	if (targetIndex < 0 || targetIndex >= items.length) return [...items];
	const next = [...items];
	[next[index], next[targetIndex]] = [next[targetIndex], next[index]];
	return next;
}

/**
 * Confirma a edição de texto de um item (novo ou renomeado): aplica trim e,
 * se o resultado ficar vazio, remove o item em vez de persistir uma entrada
 * vazia — cobre tanto "renomeei para só espaços" quanto "adicionei um item e
 * saí sem digitar nada". Nunca cria um mínimo arbitrário de caracteres.
 */
export function commitPlanningItemText(items: readonly PlanningItem[], id: string, rawText: string): PlanningItem[] {
	const trimmed = rawText.trim();
	if (trimmed.length === 0) return removePlanningItem(items, id);
	return renamePlanningItem(items, id, trimmed);
}
