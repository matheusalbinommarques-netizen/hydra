// Vocabulário e síntese determinística do Mapa de Impacto ("Quem é afetado",
// Claude Design "Quem é Afetado.dc.html", ETAPA 2 do rework) — mesmo espírito
// de catalog/situation-synthesis.ts: funções puras, sem IA, compartilhadas
// entre a interface (MapaDeImpacto.svelte) e as projeções de leitura (Resumo
// da descoberta, Bancada/Documento do projeto), para não duplicar rótulos ou
// regras de texto em cada lugar que precisa apresentar um AffectedGroup.

import type { AffectedGroupFrequency, AffectedGroupImpact } from '$lib/domain';

export const AFFECTED_GROUP_IMPACT_OPTIONS: readonly { id: AffectedGroupImpact; label: string }[] = [
	{ id: 'alto', label: 'Alto' },
	{ id: 'medio', label: 'Médio' },
	{ id: 'baixo', label: 'Baixo' },
	{ id: 'desconhecido', label: 'Ainda não sabemos' }
];

export const AFFECTED_GROUP_FREQUENCY_OPTIONS: readonly { id: AffectedGroupFrequency; label: string }[] = [
	{ id: 'constante', label: 'Constantemente' },
	{ id: 'frequente', label: 'Frequentemente' },
	{ id: 'as_vezes', label: 'Às vezes' },
	{ id: 'raro', label: 'Raramente' },
	{ id: 'desconhecido', label: 'Ainda não sabemos' }
];

const IMPACT_LABEL: Record<AffectedGroupImpact, string> = Object.fromEntries(
	AFFECTED_GROUP_IMPACT_OPTIONS.map((option) => [option.id, option.label])
) as Record<AffectedGroupImpact, string>;

const FREQUENCY_LABEL: Record<AffectedGroupFrequency, string> = Object.fromEntries(
	AFFECTED_GROUP_FREQUENCY_OPTIONS.map((option) => [option.id, option.label])
) as Record<AffectedGroupFrequency, string>;

export function affectedGroupImpactLabel(impact: AffectedGroupImpact): string {
	return IMPACT_LABEL[impact];
}

export function affectedGroupFrequencyLabel(frequency: AffectedGroupFrequency): string {
	return FREQUENCY_LABEL[frequency];
}

// Faixas do Mapa de Impacto — "Alto/Médio/Baixo impacto" seguem a mesma
// ordem/rótulo de AFFECTED_GROUP_IMPACT_OPTIONS; 'desconhecido' vira "Ainda
// não sabemos". A faixa é sempre derivada de `impact`, nunca um campo
// próprio armazenado (ver domain/state-types.ts) — "Por classificar" não é
// uma faixa de impact, é a ausência dele (impact === null).
export const AFFECTED_GROUP_LANE_LABEL: Record<AffectedGroupImpact, string> = {
	alto: 'Alto impacto',
	medio: 'Médio impacto',
	baixo: 'Baixo impacto',
	desconhecido: 'Ainda não sabemos'
};

// Taxonomia fixa de grupos prováveis — determinística, sem IA, deliberadamente
// genérica (aplica a qualquer projeto do Hydra, não a um domínio específico de
// negócio). "Primária" é oferecida primeiro; "mais sugestões" fica atrás de
// "Ver mais sugestões" (mesma mecânica do Design). Não é um suggestion engine:
// é uma lista fixa, filtrada apenas pelos grupos já adicionados no projeto
// (ver affectedGroupSuggestions).
export const AFFECTED_GROUP_SUGGESTIONS_PRIMARY: readonly string[] = [
	'Equipe interna',
	'Clientes ou usuários',
	'Operação',
	'Gestores e liderança'
];

export const AFFECTED_GROUP_SUGGESTIONS_MORE: readonly string[] = [
	'Fornecedores',
	'Parceiros',
	'Suporte',
	'Financeiro',
	'Comercial',
	'Outras áreas'
];

function normalizeLabel(label: string): string {
	return label.trim().toLocaleLowerCase('pt-BR');
}

/** Filtra sugestões já usadas (comparação por label, sem acento/caixa) — evita repetir uma sugestão já aceita como grupo. */
export function affectedGroupSuggestions(
	source: readonly string[],
	existingLabels: readonly string[]
): string[] {
	const used = new Set(existingLabels.map(normalizeLabel));
	return source.filter((label) => !used.has(normalizeLabel(label)));
}

/** "Outro grupo": mesma checagem de duplicata óbvia usada pelas sugestões. */
export function isDuplicateAffectedGroupLabel(label: string, existingLabels: readonly string[]): boolean {
	return existingLabels.some((existing) => normalizeLabel(existing) === normalizeLabel(label));
}

export interface AffectedGroupSummaryInput {
	label: string;
	impact: AffectedGroupImpact | null;
}

const IMPACT_SORT_RANK: Record<AffectedGroupImpact, number> = { alto: 0, medio: 1, baixo: 2, desconhecido: 3 };

/**
 * Síntese determinística para projeções somente-leitura (Resumo da
 * descoberta, Bancada/Documento do projeto) — uma frase legível, ordenada
 * por impacto (alto → baixo → desconhecido), nunca o Mapa completo. Grupos
 * ainda "por classificar" (impact null) entram por último, sem rótulo de
 * impacto (a classificação ainda não existe, "Ainda não sabemos" seria uma
 * afirmação que o usuário não fez).
 */
export function summarizeAffectedGroups(groups: readonly AffectedGroupSummaryInput[]): string {
	if (groups.length === 0) return '';

	const sorted = [...groups].sort((a, b) => {
		const rankA = a.impact ? IMPACT_SORT_RANK[a.impact] : 4;
		const rankB = b.impact ? IMPACT_SORT_RANK[b.impact] : 4;
		return rankA - rankB;
	});

	const parts = sorted.map((group) =>
		group.impact ? `${group.label} (${affectedGroupImpactLabel(group.impact)})` : `${group.label} (por classificar)`
	);

	const prefix = groups.length === 1 ? 'Grupo afetado' : `${groups.length} grupos afetados`;
	return `${prefix}: ${parts.join(', ')}.`;
}
