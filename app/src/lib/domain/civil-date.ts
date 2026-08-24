// Data civil estrita `YYYY-MM-DD` — ETAPA 8 do rework, microcorte de
// Timeline (docs/core/HYDRA_PRODUCT_REWORK.md §38). Primeiro fato temporal
// PLANEJADO do Hydra (Milestone.plannedDate): um DIA declarado pelo usuário,
// não um instante do sistema.
//
// Helper único — usado pelo domínio (setMilestonePlannedDate), pela
// desserialização e pelos testes; nenhum consumidor deve reimplementar esta
// validação (mesmo espírito de multi-select.ts/planning-items.ts).
//
// Por que não Date.parse: `Date.parse` é deliberadamente permissivo e aceita
// um timestamp ISO completo ('2026-09-01T12:00:00.000Z') como se fosse uma
// data — exatamente o valor que este contrato precisa recusar. Ele também
// interpreta 'YYYY-MM-DD' como meia-noite UTC, e é essa conversão a instante
// que desloca o dia em qualquer formatação com timezone. Por isso a validação
// aqui é puramente sintática + calendárica, sem construir Date nenhuma, e
// plannedDate nunca deve passar por `new Date(...)` em round-trip ou
// formatação.

const CIVIL_DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Aceita somente o shape YYYY-MM-DD representando um dia real do calendário.
// Recusa timestamp ISO completo, formato local (01/09/2026), mês inexistente
// (2026-13-01) e dia inexistente no mês (2026-02-30, 2027-02-29).
export function isCivilDate(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const match = CIVIL_DATE_SHAPE.exec(value);
	if (!match) return false;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);

	if (month < 1 || month > 12) return false;
	const maxDay = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
	return day >= 1 && day <= maxDay;
}
