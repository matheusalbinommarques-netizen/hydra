import { fail } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { computeRouteStartRecommendation } from '$lib/orientation-engine';
import { buildPhaseActivities } from '$lib/phase-activities';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { ROUTE_DIAGNOSTIC_FALLBACK, ROUTE_DIAGNOSTIC_QUESTIONS } from '$lib/route-diagnostic-questions';
import type { Actions, PageServerLoad } from './$types';

function parseDiagnosticAnswer(raw: FormDataEntryValue | null): boolean | null {
	if (raw === 'sim') return true;
	if (raw === 'nao') return false;
	return null;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return {
		phases: buildPhaseActivities(catalog, view),
		routeStartPhaseId: view.routeStartPhaseId,
		routeStartPhaseOptions: catalog.phases.map((phase) => ({ id: phase.id, label: phase.label }))
	};
};

export const actions: Actions = {
	setRouteStart: async ({ request, params }) => {
		const formData = await request.formData();
		const raw = formData.get('phaseId');
		const phaseId = typeof raw === 'string' && raw.length > 0 ? raw : null;

		const result = await getProjectUseCases().setRouteStartPhase({ projectId: params.projectId, phaseId });
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}
		return { success: true };
	},

	diagnoseRouteStart: async ({ request }) => {
		const formData = await request.formData();

		const entries = [];
		for (const question of ROUTE_DIAGNOSTIC_QUESTIONS) {
			const answer = parseDiagnosticAnswer(formData.get(question.phaseId));
			if (answer === null) {
				return fail(400, { diagnosticMessage: 'Responda todas as cinco perguntas do diagnóstico.' });
			}
			entries.push({
				phaseId: question.phaseId,
				phaseLabel: question.phaseLabel,
				structureLabel: question.structureLabel,
				answer
			});
		}

		const recommendation = computeRouteStartRecommendation(entries, ROUTE_DIAGNOSTIC_FALLBACK);

		return {
			diagnostic: {
				answers: Object.fromEntries(entries.map((entry) => [entry.phaseId, entry.answer])),
				recommendation
			}
		};
	}
};
