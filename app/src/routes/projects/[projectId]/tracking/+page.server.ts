import { fail } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import type { ImpedimentType } from '$lib/domain';
import { buildPhaseProgress } from '$lib/phase-progress';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildJourneyContext } from '../now/journey-context';
import { buildTrackingView } from './tracking-view';
import type { Actions, PageServerLoad } from './$types';

const IMPEDIMENT_TYPES: readonly ImpedimentType[] = [
	'dependencia_externa',
	'decisao_pendente',
	'falta_de_recurso',
	'bloqueio_tecnico',
	'outro'
];

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function readTipo(formData: FormData, key: string): ImpedimentType | null {
	const value = readString(formData, key);
	return value && (IMPEDIMENT_TYPES as readonly string[]).includes(value) ? (value as ImpedimentType) : null;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	const journeyContext = buildJourneyContext(catalog, view.nextActivity);
	const phaseProgress = buildPhaseProgress(catalog, view);

	const tracking = buildTrackingView({
		journeyContext,
		phaseProgress,
		nextActivity: view.nextActivity,
		workItems: view.workItems,
		milestones: view.milestones,
		impediments: view.impediments,
		risks: view.risks,
		openPendingItems: view.openPendingItems
	});

	return { tracking };
};

export const actions: Actions = {
	addImpediment: async ({ request, params }) => {
		const formData = await request.formData();
		const text = readString(formData, 'text');
		const tipo = readTipo(formData, 'tipo');
		if (!text || !tipo) {
			return fail(400, { message: 'Descreva o impedimento e selecione um tipo.' });
		}

		const result = await getProjectUseCases().addImpediment({ projectId: params.projectId, text, tipo });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setType: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		const tipo = readTipo(formData, 'tipo');
		if (!impedimentId || !tipo) return fail(400, { message: 'Impedimento ou tipo inválido.' });

		const result = await getProjectUseCases().setImpedimentType({
			projectId: params.projectId,
			impedimentId,
			tipo
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setNextAction: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		if (!impedimentId) return fail(400, { message: 'Impedimento inválido.' });
		const nextAction = readString(formData, 'nextAction');

		const result = await getProjectUseCases().setImpedimentNextAction({
			projectId: params.projectId,
			impedimentId,
			nextAction
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	resolve: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		if (!impedimentId) return fail(400, { message: 'Impedimento inválido.' });

		const result = await getProjectUseCases().resolveImpediment({ projectId: params.projectId, impedimentId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	reopen: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		if (!impedimentId) return fail(400, { message: 'Impedimento inválido.' });

		const result = await getProjectUseCases().reopenImpediment({ projectId: params.projectId, impedimentId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	addRisk: async ({ request, params }) => {
		const formData = await request.formData();
		const statement = readString(formData, 'statement');
		if (!statement) return fail(400, { message: 'Descreva o risco.' });

		const result = await getProjectUseCases().addRisk({ projectId: params.projectId, statement });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	editRiskStatement: async ({ request, params }) => {
		const formData = await request.formData();
		const riskId = readString(formData, 'riskId');
		const statement = readString(formData, 'statement');
		if (!riskId || !statement) return fail(400, { message: 'Risco ou declaração inválida.' });

		const result = await getProjectUseCases().editRiskStatement({ projectId: params.projectId, riskId, statement });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	closeRisk: async ({ request, params }) => {
		const formData = await request.formData();
		const riskId = readString(formData, 'riskId');
		if (!riskId) return fail(400, { message: 'Risco inválido.' });

		const result = await getProjectUseCases().closeRisk({ projectId: params.projectId, riskId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	reopenRisk: async ({ request, params }) => {
		const formData = await request.formData();
		const riskId = readString(formData, 'riskId');
		if (!riskId) return fail(400, { message: 'Risco inválido.' });

		const result = await getProjectUseCases().reopenRisk({ projectId: params.projectId, riskId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
