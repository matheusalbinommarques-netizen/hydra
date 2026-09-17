import { catalog } from '$lib/catalog';
import { buildPhaseProgress } from '$lib/phase-progress';
import { buildJourneyContext } from '../now/journey-context';
import { buildTrackingView } from './tracking-view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	const journeyContext = buildJourneyContext(catalog, view.nextActivity);
	const phaseProgress = buildPhaseProgress(catalog, view);

	const tracking = buildTrackingView({
		journeyContext,
		phaseProgress,
		nextActivity: view.nextActivity,
		workItems: view.workItems,
		milestones: view.milestones,
		scheduleBaseline: view.scheduleBaseline
	});

	return { tracking };
};
