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

	it('um único passo sem contexto', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Financeiro percebe o atraso', actors: [], medium: null, frictions: [] }
		]);
		expect(text).toBe('Quando isso aparece, Financeiro percebe o atraso.');
	});

	it('usa "Em seguida" no segundo passo e "Depois" a partir do terceiro', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Financeiro percebe o atraso', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'confere informações em uma planilha', actors: [], medium: null, frictions: [] },
			{ whatHappens: 'gestor aprova manualmente', actors: [], medium: null, frictions: [] }
		]);
		expect(text).toBe(
			'Quando isso aparece, Financeiro percebe o atraso. Em seguida, confere informações em uma planilha. Depois, gestor aprova manualmente.'
		);
	});

	it('incorpora atores e meio entre parênteses quando presentes', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Gestor aprova', actors: ['Financeiro', 'Gestor direto'], medium: 'E-mail', frictions: [] }
		]);
		expect(text).toBe('Quando isso aparece, Gestor aprova (Financeiro e Gestor direto, usando E-mail).');
	});

	it('incorpora fricções como sufixo em minúsculas, separadas por vírgula', () => {
		const text = summarizeTreatmentSteps([
			{ whatHappens: 'Aprovação demora', actors: [], medium: null, frictions: ['espera', 'retrabalho'] }
		]);
		expect(text).toBe('Quando isso aparece, Aprovação demora — fricção: espera, retrabalho.');
	});

	it('combina contexto e fricção no mesmo passo, mantendo a frase natural', () => {
		const text = summarizeTreatmentSteps([
			{
				whatHappens: 'Dados são copiados para outra planilha',
				actors: ['Equipe interna'],
				medium: 'Planilha',
				frictions: ['retrabalho']
			}
		]);
		expect(text).toBe(
			'Quando isso aparece, Dados são copiados para outra planilha (Equipe interna, usando Planilha) — fricção: retrabalho.'
		);
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
