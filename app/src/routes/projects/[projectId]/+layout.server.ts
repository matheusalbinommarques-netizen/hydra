import { error } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	const result = await getProjectUseCases().loadProjectView(params.projectId);
	if (!result.ok) {
		error(404, 'Projeto não encontrado.');
	}
	return { view: result.value };
};
