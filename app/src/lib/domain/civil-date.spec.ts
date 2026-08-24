import { describe, expect, it } from 'vitest';
import { isCivilDate } from './civil-date';

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
