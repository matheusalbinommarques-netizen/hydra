import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { decodeMultiSelectValue } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildDiscoverySummaryView } from './discovery-summary-view';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');

	// Detalhes completos ("Ver todas as respostas da descoberta") — mesma
	// projeção de sempre, campo a campo; a visão geral compacta (acima dela na
	// tela) é que passa a selecionar as Answers canônicas, ver
	// discovery-summary-view.ts.
	const blocks = (descoberta?.activities ?? [])
		.filter((activity) => activity.completionMode === 'required_fields')
		.map((activity) => ({
			title: activity.title,
			fields: activity.fields
				.filter((field) => field.dataTarget === 'answer' && view.answers[field.id])
				.map((field) => {
					if (field.dataTarget === 'answer' && field.type === 'selecao_multipla') {
						const selectedIds = decodeMultiSelectValue(view.answers[field.id]) ?? [];
						const labelById = new Map(field.options.map((option) => [option.id, option.label]));
						return { label: field.label, value: selectedIds.map((id) => labelById.get(id) ?? id).join(', ') };
					}
					return { label: field.label, value: view.answers[field.id] };
				})
		}));

	const { overview, checklist, detailsOpenByDefault } = buildDiscoverySummaryView(
		catalog,
		view.answers,
		view.activityStatuses
	);

	return { blocks, overview, checklist, detailsOpenByDefault };
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
