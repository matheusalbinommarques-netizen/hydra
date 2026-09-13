import { describe, expect, it } from 'vitest';
import { addCivilDays, isCivilDate } from './civil-date';

// Contrato estreito e deliberadamente rígido: Milestone.plannedDate é um DIA,
// não um instante. Os casos negativos abaixo são exatamente os que Date.parse
// aceitaria (timestamp completo) ou aceitaria errado, e por isso Date.parse não
// é a autoridade aqui.
describe('isCivilDate', () => {
	it('aceita dia real do calendário no shape YYYY-MM-DD', () => {
		for (const valid of ['2026-01-01', '2026-09-30', '2026-12-31', '2024-02-29', '2000-02-29']) {
			expect(isCivilDate(valid)).toBe(true);
		}
	});

	it('recusa timestamp ISO completo', () => {
		expect(isCivilDate('2026-09-01T00:00:00.000Z')).toBe(false);
		expect(isCivilDate('2026-09-01T12:00:00')).toBe(false);
	});

	it('recusa dia que não existe no mês', () => {
		expect(isCivilDate('2026-02-30')).toBe(false);
		expect(isCivilDate('2026-04-31')).toBe(false);
		expect(isCivilDate('2027-02-29')).toBe(false);
		expect(isCivilDate('1900-02-29')).toBe(false);
	});

	it('recusa mês e dia fora de faixa', () => {
		expect(isCivilDate('2026-13-01')).toBe(false);
		expect(isCivilDate('2026-00-10')).toBe(false);
		expect(isCivilDate('2026-01-00')).toBe(false);
		expect(isCivilDate('2026-01-32')).toBe(false);
	});

	it('recusa formatos que não são o shape canônico', () => {
		for (const invalid of ['01/09/2026', '2026-9-1', '20260901', '2026-09', '', ' 2026-09-01', '2026-09-01 ']) {
			expect(isCivilDate(invalid)).toBe(false);
		}
	});

	it('recusa qualquer valor que não seja string', () => {
		for (const invalid of [null, undefined, 0, 20260901, new Date(), {}, ['2026-09-01']]) {
			expect(isCivilDate(invalid)).toBe(false);
		}
	});
});

// addCivilDays (ETAPA 12 do rework, §42, segundo microcorte) — primeiro
// consumidor real de aritmética de data civil. Contrato: preserva dia real
// do calendário através de virada de mês, ano e ano bissexto; nunca sofre
// drift de timezone (a suíte roda em qualquer TZ do CI/dev sem variar
// resultado, porque a função nunca lê um accessor local de Date).
describe('addCivilDays', () => {
	it('soma dias dentro do mesmo mês', () => {
		expect(addCivilDays('2026-09-12', 0)).toBe('2026-09-12');
		expect(addCivilDays('2026-09-12', 1)).toBe('2026-09-13');
		expect(addCivilDays('2026-09-12', 2)).toBe('2026-09-14');
	});

	it('atravessa virada de mês e de ano', () => {
		expect(addCivilDays('2026-09-30', 1)).toBe('2026-10-01');
		expect(addCivilDays('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('respeita ano bissexto', () => {
		expect(addCivilDays('2024-02-28', 1)).toBe('2024-02-29');
		expect(addCivilDays('2026-02-28', 1)).toBe('2026-03-01');
	});

	it('aceita deslocamento negativo', () => {
		expect(addCivilDays('2026-01-01', -1)).toBe('2025-12-31');
	});

	it('fim de mês com 30/31 dias e fevereiro comum', () => {
		expect(addCivilDays('2026-04-30', 1)).toBe('2026-05-01');
		expect(addCivilDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(addCivilDays('2026-02-28', 1)).toBe('2026-03-01'); // 2026 não é bissexto
	});

	it('fevereiro bissexto: 29 existe e é seguido por 1º de março', () => {
		expect(addCivilDays('2024-02-29', 0)).toBe('2024-02-29');
		expect(addCivilDays('2024-02-29', 1)).toBe('2024-03-01');
		expect(addCivilDays('2000-02-28', 1)).toBe('2000-02-29'); // bissexto (divisível por 400)
		expect(addCivilDays('1900-02-28', 1)).toBe('1900-03-01'); // NÃO bissexto (divisível por 100, não por 400)
	});

	it('virada de ano em ambas as direções', () => {
		expect(addCivilDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addCivilDays('2027-01-01', -1)).toBe('2026-12-31');
	});

	// Falsificador central: Date.UTC/o construtor Date remapeiam legado
	// qualquer ano de 0 a 99 para 1900-1999 (Date.UTC(99, 0, 1) vira 1999).
	// isCivilDate aceita esses anos como YYYY calendaricamente válidos — se
	// addCivilDays usasse Date.UTC diretamente, corromperia silenciosamente
	// qualquer data nessa faixa. setUTCFullYear não tem esse caso especial.
	it('preserva anos de dois dígitos (0000-0099), sem o remapeamento legado de Date.UTC/construtor Date', () => {
		expect(isCivilDate('0099-01-01')).toBe(true);
		expect(isCivilDate('0000-01-01')).toBe(true);

		expect(addCivilDays('0099-01-01', 0)).toBe('0099-01-01');
		expect(addCivilDays('0099-12-31', 1)).toBe('0100-01-01');
		expect(addCivilDays('0000-01-01', 0)).toBe('0000-01-01');
		expect(addCivilDays('0000-12-31', 1)).toBe('0001-01-01');
		// Falsificaria diretamente o bug do Date.UTC se addCivilDays voltasse
		// a usá-lo: 99 viraria 1999, produzindo '1999-01-02' em vez de
		// '0099-01-02'.
		expect(addCivilDays('0099-01-01', 1)).toBe('0099-01-02');
	});

	it('recusa produzir uma data civil fora da faixa representável YYYY (0000-9999)', () => {
		expect(() => addCivilDays('9999-12-31', 1)).toThrow();
		expect(() => addCivilDays('0000-01-01', -1)).toThrow();
		// A borda exata (ano 9999/0000) continua representável.
		expect(addCivilDays('9999-12-30', 1)).toBe('9999-12-31');
		expect(addCivilDays('0000-01-02', -1)).toBe('0000-01-01');
	});
});
