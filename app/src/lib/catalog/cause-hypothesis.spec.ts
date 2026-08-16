import { describe, expect, it } from 'vitest';
import { causeHypothesisCountLabel } from './cause-hypothesis';

describe('causeHypothesisCountLabel', () => {
	it('retorna a frase de "ainda não sabemos" quando stillUnknown é true, mesmo com hipóteses', () => {
		expect(causeHypothesisCountLabel(true, 0)).toBe('Ainda não sabemos o que está por trás disso.');
	});

	it('retorna "nenhuma hipótese" quando não há hipóteses e stillUnknown é false', () => {
		expect(causeHypothesisCountLabel(false, 0)).toBe('Nenhuma hipótese registrada ainda.');
	});

	it('pluraliza corretamente', () => {
		expect(causeHypothesisCountLabel(false, 1)).toBe('1 hipótese em consideração.');
		expect(causeHypothesisCountLabel(false, 3)).toBe('3 hipóteses em consideração.');
	});
});
