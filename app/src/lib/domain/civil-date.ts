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

// Soma `days` (pode ser negativo) a uma data civil já validada, preservando
// dia real do calendário (mês/ano corretos, inclusive bissexto) — ETAPA 12
// do rework (§42, segundo microcorte: regra de precedência temporal
// derivada), primeiro consumidor real de aritmética de data civil.
//
// Usa `Date`/`getUTC*` deliberadamente: isto NÃO é o `new Date(...)` que o
// comentário do topo deste arquivo proíbe para round-trip/formatação de
// valor do usuário (aquele drift vem de interpretar 'YYYY-MM-DD' como
// meia-noite UTC e depois formatar de volta em timezone local). Aqui o
// `Date` nunca escapa da função nem é lido por accessor local — entra como
// três inteiros UTC, sai como três inteiros UTC — então não há timezone
// para causar drift; é só o motor de calendário (meses de tamanho
// variável, bissexto) sem reescrever manualmente.
//
// Deliberadamente `setUTCFullYear`, nunca `Date.UTC`/`new Date(y, m, d)`
// com o ano como argumento: o motor JS remapeia legado qualquer ano de
// 0 a 99 passado a `Date.UTC`/ao construtor para 1900-1999 (`Date.UTC(99,
// 0, 1)` vira 1999, não 99) — comportamento herdado do `Date` de duas
// posições, nunca documentado como parte da semântica de data civil.
// `isCivilDate` aceita legitimamente qualquer YYYY de 0000 a 9999
// calendaricamente válido, e essa função não pode estreitar esse contrato
// silenciosamente. `setUTCFullYear` (ao contrário do construtor/`Date.UTC`)
// não tem esse caso especial — grava o ano exatamente como recebido.
export function addCivilDays(date: string, days: number): string {
	const match = CIVIL_DATE_SHAPE.exec(date);
	if (!match) throw new Error(`addCivilDays: not a civil date: ${date}`);

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);

	const base = new Date(0);
	base.setUTCFullYear(year, month - 1, day);
	const shifted = new Date(base.getTime() + days * 86_400_000);

	const resultYear = shifted.getUTCFullYear();
	// YYYY tem exatamente 4 dígitos: um resultado fora de 0000-9999 não tem
	// representação civil válida. Falhar alto aqui, em vez de produzir uma
	// string truncada/negativa que passaria batido por quem não valida o
	// retorno com isCivilDate — nunca uma recusa de escrita nova em
	// setWorkItemSchedule, e nunca schema novo: é só a própria aritmética
	// derivada recusando devolver algo que ela sabe ser inválido.
	if (resultYear < 0 || resultYear > 9999) {
		throw new Error(`addCivilDays: resultado fora da faixa representável em YYYY-MM-DD (ano ${resultYear})`);
	}

	const resultYearStr = String(resultYear).padStart(4, '0');
	const resultMonth = String(shifted.getUTCMonth() + 1).padStart(2, '0');
	const resultDay = String(shifted.getUTCDate()).padStart(2, '0');
	return `${resultYearStr}-${resultMonth}-${resultDay}`;
}
