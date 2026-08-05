import { fail } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return {
		projectId: view.projectId,
		name: view.projectName ?? '',
		createdAt: view.createdAt
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const formData = await request.formData();
		const raw = formData.get('name');
		const rawName = typeof raw === 'string' ? raw : '';
		const name = rawName.trim();

		if (name === '') {
			return fail(400, { message: 'Informe um nome para o projeto.', name: rawName });
		}

		const result = await getProjectUseCases().renameProject({ projectId: params.projectId, name });
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error), name: rawName });
		}

		return { success: true, name: result.value.projectName ?? name };
	}
};
