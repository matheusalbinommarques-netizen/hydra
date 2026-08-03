import { error } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const result = await getProjectUseCases().listRecentProjects();
	if (!result.ok) {
		error(500, mapUseCaseError(result.error));
	}
	return { projects: result.value };
};
