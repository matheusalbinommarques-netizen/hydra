import { fail, redirect } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions } from './$types';

export const actions: Actions = {
	create: async () => {
		const result = await getProjectUseCases().createProject();
		if (!result.ok) {
			return fail(500, { message: mapUseCaseError(result.error) });
		}
		redirect(303, `/projects/${result.value.projectId}/now`);
	},

	import: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Selecione um arquivo JSON para importar.' });
		}

		const json = await file.text();
		const result = await getProjectUseCases().importProject(json);
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}
		redirect(303, `/projects/${result.value.projectId}/now`);
	}
};
