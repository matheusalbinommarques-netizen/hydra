import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, createInitialProjectState, encodeMultiSelectValue, skipActivity } from '$lib/domain';
import { computeSnapshot } from './snapshot';
import { computePhaseStatus } from './phase-status';
import { computeProjectStatus } from './project-status';
import { computeNextActivity } from './next-activity';
import { computeOpenPendingItems } from './pending-items';
import { computeHypotheses } from './hypotheses';

const T1 = '2026-01-01T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

describe('computeSnapshot', () => {
	it('agrega exatamente as 5 projeções do contrato, sem ProjectState bruto nem campos extras', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'problema',
				{ situacao: 'x', sinais_situacao: encodeMultiSelectValue(['too_many_steps']), hipotese_opt: 'Uma hipótese' },
				T1
			)
		);
		state = unwrap(skipActivity(catalog, state, 'publico', 'pend-1', T1));

		const snapshot = computeSnapshot(catalog, state);

		expect(Object.keys(snapshot).sort()).toEqual(
			['projectStatus', 'phaseStatuses', 'nextActivity', 'openPendingItems', 'hypotheses'].sort()
		);
		expect(snapshot).not.toHaveProperty('project');
		expect(snapshot).not.toHaveProperty('activityProgress');
		expect(snapshot).not.toHaveProperty('answers');
		expect(snapshot).not.toHaveProperty('pendingItems');

		expect(snapshot.projectStatus).toBe(computeProjectStatus(state.project, catalog, state.activityProgress));
		expect(snapshot.nextActivity).toEqual(computeNextActivity(catalog, state.activityProgress));
		expect(snapshot.openPendingItems).toEqual(computeOpenPendingItems(catalog, state.pendingItems));
		expect(snapshot.hypotheses).toEqual(computeHypotheses(catalog, state.answers));

		for (const phase of catalog.phases) {
			expect(snapshot.phaseStatuses[phase.id]).toBe(
				computePhaseStatus(phase, state.activityProgress, state.pendingItems)
			);
		}
	});

	it('num projeto recém-criado, mostra a Descoberta como não_iniciada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const snapshot = computeSnapshot(catalog, state);
		expect(snapshot.phaseStatuses.descoberta).toBe('não_iniciada');
	});
});
