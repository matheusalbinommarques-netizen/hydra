// Prontidão do Cronograma (ETAPA 12 do rework, §42, sexto microcorte —
// primeiro corte do Gantt) — HYDRA_PRODUCT_REWORK.md §17: "Gantt | datas +
// duração + dependências suficientes". Esta etapa usa o critério mínimo já
// congelado por D058/D063: existe ao menos um WorkItem com schedule
// completo (plannedStart e durationDays não-null; o par é sempre atômico,
// ver domain/state-types.ts). Dependency/Milestone não são exigidos para a
// rota existir — são consumidos pela superfície quando presentes, nunca
// pré-requisito de prontidão.
//
// Único critério de prontidão do Cronograma — compartilhado pelo shell
// (nav condicional), por Acompanhamento (Timeline × card) e pela própria
// rota /cronograma (redirect quando ainda não pronta), para as três nunca
// divergirem sobre o mesmo fato.
import type { WorkItemView } from '$lib/server/application/types';

export function isCronogramaReady(workItems: readonly WorkItemView[]): boolean {
	return workItems.some((item) => item.plannedStart !== null && item.durationDays !== null);
}
