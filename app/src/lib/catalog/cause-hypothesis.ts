// Vocabulário de "Entender as causas" (Claude Design, "Entender as Causas -
// 1A Refinada.dc.html", Stage 4B do rework) — mesmo espírito de
// catalog/affected-group.ts e catalog/current-treatment.ts: funções puras,
// sem IA, compartilhadas entre a interface (EntenderCausas.svelte) e as
// projeções de leitura (Resumo da descoberta, Bancada/Documento do
// projeto). Diferente de summarizeTreatmentSteps, não existe uma síntese em
// prosa das hipóteses — o Design Gate as apresenta como uma lista de
// títulos, nunca fundidas numa frase (fundir hipóteses distintas numa
// síntese única sugeriria uma leitura consolidada que o Hydra não tem).

export const CAUSE_EXPLORATION_STILL_UNKNOWN_TEXT = 'Ainda não sabemos o que está por trás disso.';

/** Rótulo curto ("3 hipóteses em consideração"/"Ainda não sabemos o que está por trás disso") — Bancada/Resumo/Documento. */
export function causeHypothesisCountLabel(stillUnknown: boolean, hypothesisCount: number): string {
	if (stillUnknown) return CAUSE_EXPLORATION_STILL_UNKNOWN_TEXT;
	if (hypothesisCount === 0) return 'Nenhuma hipótese registrada ainda.';
	return `${hypothesisCount} ${hypothesisCount === 1 ? 'hipótese em consideração' : 'hipóteses em consideração'}.`;
}
