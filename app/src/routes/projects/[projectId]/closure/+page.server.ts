import { catalog } from '$lib/catalog';
import type { ActivityDefinition } from '$lib/domain';
import { buildClosureView } from './closure-view';
import type { PageServerLoad } from './$types';

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

	return buildClosureView(catalog, {
		projectId: view.projectId,
		activityStatuses: view.activityStatuses,
		answers: view.answers,
		nextActivityPhaseId
	});
};
