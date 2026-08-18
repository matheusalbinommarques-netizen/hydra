import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildDiscoveryCheckpointView, filterDiscoveryOpenPendingItems } from './discovery-summary-view';
import type { Actions, PageServerLoad } from './$types';

// "resumo" é a própria atividade do checkpoint (catalog/discovery.ts) — uma
// vez concluída (confirmSummary), a tela deixa de mostrar o checkpoint aberto
// e passa a mostrar o estado pós-conclusão (ver Design Gate, "closed").
const RESUMO_ACTIVITY_ID = 'resumo';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();

	const discoveryOpenPendingItems = filterDiscoveryOpenPendingItems(catalog, view.openPendingItems);

	const checkpoint = buildDiscoveryCheckpointView(
		view.activityStatuses,
		discoveryOpenPendingItems,
		view.answers['situacao'] ?? null,
		view.affectedGroups,
		view.currentTreatment,
		view.treatmentSteps,
		view.causeExploration,
		view.causeHypotheses.map((hypothesis) => ({ title: hypothesis.title, evidenceCount: hypothesis.evidenceIds.length })),
		view.desiredOutcomes
	);

	return {
		checkpoint,
		closed: view.activityStatuses[RESUMO_ACTIVITY_ID] === 'concluída',
		criteriaScopeConflict: view.criteriaScopeConflict
	};
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
