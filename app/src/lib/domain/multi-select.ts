// Codificação de FieldDefinition.type 'selecao_multipla' — ver
// docs/core/DOMAIN_MODEL.md. Answer continua com uma única linha por campo
// (mesma PK de sempre); o que muda é que Answer.value guarda um array JSON
// de ids selecionados, nunca uma string separada por vírgula (evita
// ambiguidade caso um id contenha vírgula, e falha alto em JSON malformado
// em vez de aceitar silenciosamente um valor parcial).
//
// Helpers únicos — usados pelo domínio (isActivityFieldsValid,
// answerActivity), pela interface (ActivityForm) e pelos testes; nenhum
// consumidor deve reimplementar este encode/decode.

export function encodeMultiSelectValue(ids: readonly string[]): string {
	return JSON.stringify(ids);
}

export function decodeMultiSelectValue(raw: string): string[] | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) {
		return null;
	}
	return parsed;
}

/** JSON inválido, algo que não seja array de strings, ids duplicados ou ids fora de validIds: inválido. */
export function isValidMultiSelectValue(raw: string, validIds: readonly string[]): boolean {
	const decoded = decodeMultiSelectValue(raw);
	if (!decoded) return false;
	if (new Set(decoded).size !== decoded.length) return false;
	return decoded.every((id) => validIds.includes(id));
}
