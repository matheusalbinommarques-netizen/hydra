import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, createInitialProjectState } from '$lib/domain';
import { computeNextActivity } from './next-activity';
import { answerActivityMinimally, completePhase, skipActivityForTest, unwrapResult } from '$lib/domain/test-support';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

describe('computeNextActivity (Trilha A)', () => {
	it('recomenda "origem" num projeto novo', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'origem'
		});
	});

	it('recomenda a próxima atividade do catálogo após concluir a atual', () => {
		const state = answerActivityMinimally(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', T1);
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'contexto'
		});
	});

	it('nunca recomenda uma atividade pulada — avança para a próxima elegível', () => {
		const state = skipActivityForTest(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1);
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'contexto'
		});
	});

	it('o Resumo volta a ser recomendado quando invalidado (em_andamento) após concluído', () => {
		let state = completePhase(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'descoberta', T1);
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'usuario_principal'
		});

		// edita uma resposta anterior da Descoberta com um valor genuinamente
		// diferente (answerActivityMinimally reusaria o mesmo texto e não
		// contaria como mudança) → invalida o Resumo
		state = unwrapResult(answerActivity(catalog, state, 'publico', { publico_detail: 'Outro valor' }, T2));
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'resumo'
		});
	});

	it('recomenda a primeira atividade de cada fase seguinte, na ordem do catálogo, até catalog_limit_reached ao final', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		for (const phase of catalog.phases) {
			expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
				kind: 'recommendation',
				activityDefinitionId: phase.activities[0].id
			});
			state = completePhase(catalog, state, phase.id, T1);
		}
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({ kind: 'catalog_limit_reached' });
	});
});
