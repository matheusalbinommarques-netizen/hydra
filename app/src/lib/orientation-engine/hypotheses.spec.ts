import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, createInitialProjectState } from '$lib/domain';
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
				{ situacao: 'x', dificuldade: 'y', hipotese_opt: 'A centralização reduzirá o retrabalho' },
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
				{ situacao: 'x', dificuldade: 'y', evidencias: 'dados internos' },
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
				{ situacao: 'x', dificuldade: 'y', hipotese_opt: '' },
				T1
			)
		);
		expect(computeHypotheses(catalog, state.answers)).toEqual([]);
	});
});
