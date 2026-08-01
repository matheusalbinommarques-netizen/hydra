import { error, fail, redirect } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const result = await getProjectUseCases().listRecentProjects();
	if (!result.ok) {
		error(500, mapUseCaseError(result.error));
	}
	return { projects: result.value };
};

export const actions: Actions = {
	create: async () => {
		const result = await getProjectUseCases().createProject();
		if (!result.ok) {
			return fail(500, { message: mapUseCaseError(result.error) });
		}
		redirect(303, `/projects/${result.value.projectId}/now`);
	}
};
