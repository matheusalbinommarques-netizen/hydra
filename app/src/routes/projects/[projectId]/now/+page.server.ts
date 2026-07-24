import { fail } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import type { ActivityDefinition } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
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
	const activity =
		view.nextActivity.kind === 'recommendation'
			? findActivityDefinition(view.nextActivity.activityDefinitionId)
			: undefined;
	return { activity };
};

export const actions: Actions = {
	answer: async ({ request, params }) => {
		const formData = await request.formData();
		const activityDefinitionId = formData.get('activityDefinitionId');
		if (typeof activityDefinitionId !== 'string' || !activityDefinitionId) {
			return fail(400, { message: 'Atividade inválida.' });
		}

		const values: Record<string, string> = {};
		for (const [key, value] of formData.entries()) {
			if (key === 'activityDefinitionId') continue;
			values[key] = typeof value === 'string' ? value : '';
		}

		const result = await getProjectUseCases().answerActivity({
			projectId: params.projectId,
			activityDefinitionId,
			values
		});

		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error), values });
		}
		return { success: true, values: undefined };
	}
};
