import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		phases: catalog.phases.map((phase) => ({ id: phase.id, label: phase.label }))
	};
};

export const actions: Actions = {
	confirm: async ({ request }) => {
		const formData = await request.formData();
		const rawName = formData.get('name');
		const rawPhaseId = formData.get('phaseId');
		const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : null;
		const phaseId = typeof rawPhaseId === 'string' && rawPhaseId.length > 0 ? rawPhaseId : null;

		if (!phaseId) {
			return fail(400, { message: 'Escolha uma fase inicial antes de confirmar.' });
		}

		const result = await getProjectUseCases().createConfiguredProject({ name, routeStartPhaseId: phaseId });
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}
		redirect(303, `/projects/${result.value.projectId}/now`);
	}
};
