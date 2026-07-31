import { fail } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildMapView } from './map-view';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return {
		phases: buildMapView(catalog, view),
		routeStartPhaseId: view.routeStartPhaseId,
		routeStartPhaseOptions: catalog.phases.map((phase) => ({ id: phase.id, label: phase.label }))
	};
};

export const actions: Actions = {
	setRouteStart: async ({ request, params }) => {
		const formData = await request.formData();
		const raw = formData.get('phaseId');
		const phaseId = typeof raw === 'string' && raw.length > 0 ? raw : null;

		const result = await getProjectUseCases().setRouteStartPhase({ projectId: params.projectId, phaseId });
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}
		return { success: true };
	}
};
