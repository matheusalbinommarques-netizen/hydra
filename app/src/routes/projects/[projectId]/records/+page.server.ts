import { catalog } from '$lib/catalog';
import { buildRecordsView } from './records-view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return buildRecordsView(catalog, {
		projectId: view.projectId,
		answers: view.answers,
		pendingItemHistory: view.pendingItemHistory,
		activityStatuses: view.activityStatuses
	});
};
