// Vocabulário e síntese determinística de "Como é tratado hoje" (Claude
// Design, "Como e Tratado Hoje - Refinado.dc.html", Stage 4A do rework) —
// mesmo espírito de catalog/affected-group.ts: funções puras, sem IA,
// compartilhadas entre a interface (ComoETratadoHoje.svelte) e as projeções
// de leitura (Resumo da descoberta, Bancada/Documento do projeto), para não
// duplicar rótulos ou regras de texto em cada lugar que precisa apresentar um
// TreatmentStep.

import type { TreatmentFriction } from '$lib/domain';

export const TREATMENT_FRICTION_OPTIONS: readonly { id: TreatmentFriction; label: string }[] = [
	{ id: 'espera', label: 'Espera' },
	{ id: 'retrabalho', label: 'Retrabalho' },
	{ id: 'improviso', label: 'Improviso' },
	{ id: 'trava', label: 'Trava' }
];

const FRICTION_LABEL: Record<TreatmentFriction, string> = Object.fromEntries(
	TREATMENT_FRICTION_OPTIONS.map((option) => [option.id, option.label])
) as Record<TreatmentFriction, string>;

export function treatmentFrictionLabel(friction: TreatmentFriction): string {
	return FRICTION_LABEL[friction];
}

// Meio/ferramenta — sugestões genéricas seguras (prioridade 3 de
// HYDRA_PRODUCT_REWORK.md §34, "Sugestões"): categorias explicitamente
// aprovadas como exemplo legítimo e domain-agnostic, nunca conteúdo de demo
// específico de um cenário. "Outro" continua sempre disponível para texto
// livre.
export const TREATMENT_MEDIUM_SUGGESTIONS: readonly string[] = [
	'Planilha',
	'Sistema',
	'E-mail',
	'WhatsApp',
	'Conversa',
	'Processo manual'
];

function normalizeLabel(label: string): string {
	return label.trim().toLocaleLowerCase('pt-BR');
}

/** Filtra sugestões já usadas pelo passo atual — mesma regra de affectedGroupSuggestions. */
export function excludeUsedLabels(source: readonly string[], used: readonly string[]): string[] {
	const usedSet = new Set(used.map(normalizeLabel));
	return source.filter((label) => !usedSet.has(normalizeLabel(label)));
}

export interface TreatmentStepSynthesisInput {
	whatHappens: string;
	actors: readonly string[];
	medium: string | null;
	frictions: readonly TreatmentFriction[];
}

/** "Primeiro"/"Depois"/"Por fim" — null quando há um único passo (nada a sequenciar). */
function sequenceStepMarker(index: number, total: number): string | null {
	if (total <= 1) return null;
	if (index === 0) return 'Primeiro';
	if (index === total - 1 && total > 2) return 'Por fim';
	return 'Depois';
}

/** Fricções presentes na cadeia, sem duplicatas, na ordem em que aparecem pela primeira vez. */
function consolidateFrictions(steps: readonly TreatmentStepSynthesisInput[]): TreatmentFriction[] {
	const seen = new Set<TreatmentFriction>();
	const result: TreatmentFriction[] = [];
	for (const step of steps) {
		for (const friction of step.frictions) {
			if (!seen.has(friction)) {
				seen.add(friction);
				result.push(friction);
			}
		}
	}
	return result;
}

function joinWithAnd(items: readonly string[]): string {
	if (items.length <= 1) return items.join('');
	if (items.length === 2) return items.join(' e ');
	return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/**
 * Síntese determinística de "Como funciona hoje" — uma leitura reduzida do
 * fluxo, não uma serialização de cada TreatmentStep: um marcador de sequência
 * por passo ("Primeiro"/"Depois"/"Por fim", ausente com um único passo) mais
 * o que acontece, e as fricções da cadeia consolidadas ao final, sem
 * duplicatas. Ator e meio/ferramenta ficam só na cadeia (cet-step-card),
 * nunca repetidos aqui. Nunca editável, nunca source of truth (ver
 * HYDRA_PRODUCT_REWORK.md §34, "Síntese derivada"). `noTreatment: true` tem
 * sua própria frase fixa — não passa por aqui.
 */
export function summarizeTreatmentSteps(steps: readonly TreatmentStepSynthesisInput[]): string {
	if (steps.length === 0) return '';

	const sequence = steps
		.map((step, index) => {
			const marker = sequenceStepMarker(index, steps.length);
			return marker ? `${marker}: ${step.whatHappens}.` : `${step.whatHappens}.`;
		})
		.join(' ');

	const frictions = consolidateFrictions(steps);
	if (frictions.length === 0) return sequence;

	const frictionLabels = frictions.map((f) => treatmentFrictionLabel(f).toLowerCase());
	return `${sequence} Fricções observadas: ${joinWithAnd(frictionLabels)}.`;
}

export const NO_TREATMENT_SYNTHESIS = 'Hoje não existe um tratamento definido.';

/** Síntese/resumo compacto para projeções somente-leitura (Bancada/Resumo/Documento). */
export function summarizeCurrentTreatment(
	noTreatment: boolean,
	steps: readonly TreatmentStepSynthesisInput[]
): string {
	if (noTreatment) return NO_TREATMENT_SYNTHESIS;
	return summarizeTreatmentSteps(steps);
}

/** Rótulo curto ("3 etapas descritas"/"Sem tratamento definido hoje") — Bancada/Documento. */
export function treatmentStepCountLabel(noTreatment: boolean, stepCount: number): string {
	if (noTreatment) return 'Sem tratamento definido hoje';
	return `${stepCount} ${stepCount === 1 ? 'etapa descrita' : 'etapas descritas'}`;
}
