import { catalog } from '$lib/catalog';
import type { ActivityDefinition } from '$lib/domain';
import { fail } from '@sveltejs/kit';
import type { DesiredOutcomeAssessmentState } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildClosureOutcomes, buildClosureView, CLOSURE_OUTCOME_STATE_OPTIONS } from './closure-view';
import type { Actions, PageServerLoad } from './$types';

function findActivityDefinition(activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();

	const nextActivityPhaseId =
		view.nextActivity.kind === 'recommendation'
			? (findActivityDefinition(view.nextActivity.activityDefinitionId)?.phaseId ?? null)
			: null;

	return {
		...buildClosureView(catalog, {
			projectId: view.projectId,
			activityStatuses: view.activityStatuses,
			answers: view.answers,
			nextActivityPhaseId
		}),
		outcomes: buildClosureOutcomes(view.desiredOutcomes),
		closure: view.closure,
		unassessedCount: view.desiredOutcomes.filter((outcome) => outcome.assessment === null).length,
		outcomeStateOptions: CLOSURE_OUTCOME_STATE_OPTIONS
	};
};

export const actions: Actions = {
	assessDesiredOutcome: async ({ request, params }) => {
		const formData = await request.formData();
		const outcomeId = formData.get('outcomeId');
		const state = formData.get('state');
		const rationale = formData.get('rationale');
		if (typeof outcomeId !== 'string' || outcomeId.length === 0) {
			return fail(400, { message: 'Resultado desejado inválido.', outcomeId: null });
		}
		if (typeof state !== 'string' || !CLOSURE_OUTCOME_STATE_OPTIONS.some((option) => option.value === state)) {
			return fail(400, { message: 'Escolha um dos estados de avaliação disponíveis.', outcomeId });
		}
		const result = await getProjectUseCases().setDesiredOutcomeAssessment({
			projectId: params.projectId,
			outcomeId,
			state: state as DesiredOutcomeAssessmentState,
			rationale: typeof rationale === 'string' ? rationale : ''
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error), outcomeId });
		return { success: true };
	},

	closeProject: async ({ request, params }) => {
		const formData = await request.formData();
		if (formData.get('confirm') !== 'on') {
			return fail(400, { closeMessage: 'Confirme o encerramento para continuar.' });
		}
		const note = formData.get('note');
		const result = await getProjectUseCases().closeProject({
			projectId: params.projectId,
			note: typeof note === 'string' ? note : null
		});
		if (!result.ok) return fail(400, { closeMessage: mapUseCaseError(result.error) });
		return { closed: true };
	}
};
