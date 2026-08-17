// Vocabulário de "Resultado desejado" (Stage 4C do rework,
// docs/core/HYDRA_PRODUCT_REWORK.md §32) — mesmo espírito de
// catalog/cause-hypothesis.ts/catalog/affected-group.ts: funções puras, sem
// IA, compartilhadas entre a interface (ResultadoDesejado.svelte) e as
// projeções de leitura (Resumo da descoberta, Bancada/Documento do
// projeto). Sem síntese em prosa: o Design apresenta os resultados como uma
// lista ordenada, nunca fundidos numa frase única (fundir mudanças distintas
// sugeriria uma leitura consolidada que o Hydra não tem).

/** Rótulo curto ("3 resultados esperados"/"Nenhum resultado registrado ainda.") — Bancada/Resumo/Documento. */
export function desiredOutcomeCountLabel(outcomeCount: number): string {
	if (outcomeCount === 0) return 'Nenhum resultado registrado ainda.';
	return `${outcomeCount} ${outcomeCount === 1 ? 'resultado esperado' : 'resultados esperados'}.`;
}
