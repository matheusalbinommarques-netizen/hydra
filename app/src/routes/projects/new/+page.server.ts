import { fail, redirect } from '@sveltejs/kit';
import { ORIGIN_OPTIONS } from '$lib/catalog/discovery';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions } from './$types';

export const actions: Actions = {
	confirm: async ({ request }) => {
		const formData = await request.formData();
		const rawName = formData.get('name');
		const rawOrigin = formData.get('origin');
		const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : null;
		const origin = typeof rawOrigin === 'string' ? rawOrigin : '';

		if (!ORIGIN_OPTIONS.includes(origin as (typeof ORIGIN_OPTIONS)[number])) {
			return fail(400, { message: 'Escolha o que trouxe este projeto até aqui antes de confirmar.', name });
		}
		if (!name) {
			return fail(400, { message: 'Dê um nome ao projeto antes de confirmar.', name });
		}

		const result = await getProjectUseCases().createConfiguredProject({
			name,
			routeStartPhaseId: null,
			originAnswer: origin
		});
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error), name });
		}
		redirect(303, `/projects/${result.value.projectId}/now`);
	}
};
