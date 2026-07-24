import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');

	const blocks = (descoberta?.activities ?? [])
		.filter((activity) => activity.completionMode === 'required_fields')
		.map((activity) => ({
			title: activity.title,
			fields: activity.fields
				.filter((field) => field.dataTarget === 'answer' && view.answers[field.id])
				.map((field) => ({ label: field.label, value: view.answers[field.id] }))
		}));

	return { blocks };
};

export const actions: Actions = {
	confirm: async ({ params }) => {
		const result = await getProjectUseCases().confirmSummary({ projectId: params.projectId });
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}
		redirect(303, `/projects/${params.projectId}/now`);
	}
};
