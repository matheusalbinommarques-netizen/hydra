import { describe, expect, it } from 'vitest';
import {
	NO_TREATMENT_SYNTHESIS,
	excludeUsedLabels,
	summarizeCurrentTreatment,
	summarizeTreatmentSteps,
	treatmentFrictionLabel,
	treatmentStepCountLabel
} from './current-treatment';

describe('summarizeTreatmentSteps — síntese determinística ("Como funciona hoje")', () => {
	it('array vazio produz string vazia', () => {
		expect(summarizeTreatmentSteps([])).toBe('');
	});

	it('um único passo não finge sequência — sem marcador "Primeiro"', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Financeiro percebe o atraso', actors: [], medium: null, frictions: [] }
		]);
		expect(text).toBe('Financeiro percebe o atraso.');
	});

	it('dois passos usam "Primeiro"/"Depois", sem "Por fim"', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Financeiro percebe o atraso', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'gestor aprova manualmente', actors: [], medium: null, frictions: [] }
		]);
		expect(text).toBe('Primeiro: Financeiro percebe o atraso. Depois: gestor aprova manualmente.');
	});

	it('três passos usam "Primeiro"/"Depois"/"Por fim"', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Financeiro percebe o atraso', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'confere informações em uma planilha', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'gestor aprova manualmente', actors: [], medium: null, frictions: [] }
		]);
		expect(text).toBe(
			'Primeiro: Financeiro percebe o atraso. Depois: confere informações em uma planilha. Por fim: gestor aprova manualmente.'
		);
	});

	it('quatro ou mais passos repetem "Depois" nas etapas intermediárias, sem virar parágrafo complexo', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'A', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'B', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'C', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'D', actors: [], medium: null, frictions: [] }
		]);
		expect(text).toBe('Primeiro: A. Depois: B. Depois: C. Por fim: D.');
	});

	it('não injeta ator nem meio/ferramenta na síntese — só a cadeia mostra esses detalhes', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Gestor aprova', actors: ['Financeiro', 'Gestor direto'], medium: 'E-mail', frictions: [] }
		]);
		expect(text).toBe('Gestor aprova.');
	});

	it('consolida fricções de todos os passos ao final, sem duplicatas, na ordem de primeira aparição', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'A', actors: [], medium: null, frictions: ['improviso'] },
			{ whatHappens: 'B', actors: [], medium: null, frictions: ['trava', 'improviso'] },
			{ whatHappens: 'C', actors: [], medium: null, frictions: ['retrabalho'] }
		]);
		expect(text).toBe(
			'Primeiro: A. Depois: B. Por fim: C. Fricções observadas: improviso, trava e retrabalho.'
		);
	});

	it('sem nenhuma fricção em nenhum passo, não mostra a seção de fricções', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'A', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'B', actors: [], medium: null, frictions: [] }
		]);
		expect(text).toBe('Primeiro: A. Depois: B.');
	});

	it('uma única fricção não usa conector "e"', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'A', actors: [], medium: null, frictions: ['espera'] }
		]);
		expect(text).toBe('A. Fricções observadas: espera.');
	});

	it('duas fricções usam "e" sem vírgula', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'A', actors: [], medium: null, frictions: ['espera', 'trava'] }
		]);
		expect(text).toBe('A. Fricções observadas: espera e trava.');
	});
});

describe('summarizeCurrentTreatment', () => {
	it('noTreatment true retorna a frase fixa, ignorando steps', () => {
		expect(
			summarizeCurrentTreatment(true, [{ whatHappens: 'x', actors: [], medium: null, frictions: [] }])
		).toBe(NO_TREATMENT_SYNTHESIS);
	});

	it('noTreatment false delega para summarizeTreatmentSteps', () => {
		const steps = [{ whatHappens: 'Financeiro confere', actors: [], medium: null, frictions: [] }];
		expect(summarizeCurrentTreatment(false, steps)).toBe(summarizeTreatmentSteps(steps));
	});
});

describe('treatmentStepCountLabel', () => {
	it('singular para 1 etapa', () => {
		expect(treatmentStepCountLabel(false, 1)).toBe('1 etapa descrita');
	});

	it('plural para 0 ou 2+ etapas', () => {
		expect(treatmentStepCountLabel(false, 0)).toBe('0 etapas descritas');
		expect(treatmentStepCountLabel(false, 3)).toBe('3 etapas descritas');
	});

	it('noTreatment sempre retorna o rótulo fixo, ignorando a contagem', () => {
		expect(treatmentStepCountLabel(true, 5)).toBe('Sem tratamento definido hoje');
	});
});

describe('treatmentFrictionLabel', () => {
	it('mapeia os quatro literais aprovados para rótulos em português', () => {
		expect(treatmentFrictionLabel('espera')).toBe('Espera');
		expect(treatmentFrictionLabel('retrabalho')).toBe('Retrabalho');
		expect(treatmentFrictionLabel('improviso')).toBe('Improviso');
		expect(treatmentFrictionLabel('trava')).toBe('Trava');
	});
});

describe('excludeUsedLabels', () => {
	it('filtra por igualdade sem acento/caixa, mesma regra de affectedGroupSuggestions', () => {
		expect(excludeUsedLabels(['Planilha', 'E-mail'], ['planilha'])).toEqual(['E-mail']);
	});

	it('sem uso prévio retorna a lista completa', () => {
		expect(excludeUsedLabels(['Planilha', 'E-mail'], [])).toEqual(['Planilha', 'E-mail']);
	});
});
