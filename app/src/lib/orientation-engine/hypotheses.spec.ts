import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, createInitialProjectState, encodeMultiSelectValue } from '$lib/domain';
import { computeHypotheses } from './hypotheses';

const T1 = '2026-01-01T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

describe('computeHypotheses', () => {
	it('é vazia num projeto novo', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computeHypotheses(catalog, state.answers)).toEqual([]);
	});

	it('inclui a resposta do campo hipotese_opt (semanticRole: hypothesis)', () => {
		const state = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'problema',
				{ situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']), hipotese_opt: 'A centralização reduzirá o retrabalho' },
				T1
			)
		);
		expect(computeHypotheses(catalog, state.answers)).toEqual([
			{ text: 'A centralização reduzirá o retrabalho' }
		]);
	});

	it('não inclui respostas de campos sem semanticRole: hypothesis', () => {
		const state = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'problema',
				{ situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']), situacao_peso: 'É crítico' },
				T1
			)
		);
		expect(computeHypotheses(catalog, state.answers)).toEqual([]);
	});

	it('não inclui uma hipótese com valor vazio', () => {
		const state = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'problema',
				{ situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']), hipotese_opt: '' },
				T1
			)
		);
		expect(computeHypotheses(catalog, state.answers)).toEqual([]);
	});

	it('não inclui scopeVersion.hypothesis quando não confirmada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const withHypothesis = { ...state, scopeVersion: { ...state.scopeVersion, hypothesis: 'Rascunho' } };
		expect(computeHypotheses(catalog, withHypothesis.answers, withHypothesis.scopeVersion)).toEqual([]);
	});

	it('inclui scopeVersion.hypothesis quando confirmada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const confirmed = {
			...state,
			scopeVersion: { ...state.scopeVersion, hypothesis: 'Escopo validado', confirmedAt: T1 }
		};
		expect(computeHypotheses(catalog, confirmed.answers, confirmed.scopeVersion)).toEqual([
			{ text: 'Escopo validado' }
		]);
	});

	it('deduplica quando a hipótese de Answer e a de ScopeVersion têm o mesmo texto', () => {
		const answered = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'problema',
				{ situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']), hipotese_opt: 'Mesmo texto' },
				T1
			)
		);
		const confirmed = {
			...answered,
			scopeVersion: { ...answered.scopeVersion, hypothesis: 'Mesmo texto', confirmedAt: T1 }
		};
		expect(computeHypotheses(catalog, confirmed.answers, confirmed.scopeVersion)).toEqual([
			{ text: 'Mesmo texto' }
		]);
	});

	it('combina as duas fontes quando os textos são diferentes', () => {
		const answered = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'problema',
				{ situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']), hipotese_opt: 'Hipótese da Descoberta' },
				T1
			)
		);
		const confirmed = {
			...answered,
			scopeVersion: { ...answered.scopeVersion, hypothesis: 'Hipótese do escopo', confirmedAt: T1 }
		};
		expect(computeHypotheses(catalog, confirmed.answers, confirmed.scopeVersion)).toEqual([
			{ text: 'Hipótese da Descoberta' },
			{ text: 'Hipótese do escopo' }
		]);
	});
});
