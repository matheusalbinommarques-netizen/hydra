import { fail } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import type { ImpedimentType, RiskImpact, RiskLikelihood } from '$lib/domain';
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

const RISK_LIKELIHOODS: readonly RiskLikelihood[] = ['baixa', 'media', 'alta'];
const RISK_IMPACTS: readonly RiskImpact[] = ['baixo', 'medio', 'alto'];

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

// Select vazio é o caminho de "limpar avaliação" (par null/null), não erro —
// distinto de um valor presente fora da lista aprovada, que é entrada
// inválida.
type RiskAssessmentFieldResult<T> = { ok: true; value: T | null } | { ok: false };

function readRiskAssessmentField<T extends string>(
	formData: FormData,
	key: string,
	allowed: readonly T[]
): RiskAssessmentFieldResult<T> {
	const raw = formData.get(key);
	if (typeof raw !== 'string' || raw.trim().length === 0) return { ok: true, value: null };
	const trimmed = raw.trim();
	return (allowed as readonly string[]).includes(trimmed) ? { ok: true, value: trimmed as T } : { ok: false };
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
		decisions: view.decisions,
		changes: view.changes,
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
	},

	reviewRisk: async ({ request, params }) => {
		const formData = await request.formData();
		const riskId = readString(formData, 'riskId');
		if (!riskId) return fail(400, { message: 'Risco inválido.' });

		const result = await getProjectUseCases().reviewRisk({ projectId: params.projectId, riskId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setRiskAssessment: async ({ request, params }) => {
		const formData = await request.formData();
		const riskId = readString(formData, 'riskId');
		if (!riskId) return fail(400, { message: 'Risco inválido.' });

		const likelihood = readRiskAssessmentField(formData, 'likelihood', RISK_LIKELIHOODS);
		const impact = readRiskAssessmentField(formData, 'impact', RISK_IMPACTS);
		if (!likelihood.ok || !impact.ok) return fail(400, { message: 'Probabilidade ou impacto inválido.' });

		const result = await getProjectUseCases().setRiskAssessment({
			projectId: params.projectId,
			riskId,
			likelihood: likelihood.value,
			impact: impact.value
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setRiskResponse: async ({ request, params }) => {
		const formData = await request.formData();
		const riskId = readString(formData, 'riskId');
		if (!riskId) return fail(400, { message: 'Risco inválido.' });
		const response = readString(formData, 'response');

		const result = await getProjectUseCases().setRiskResponse({ projectId: params.projectId, riskId, response });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	addDecision: async ({ request, params }) => {
		const formData = await request.formData();
		const subject = readString(formData, 'subject');
		if (!subject) return fail(400, { message: 'Descreva o que precisa ser decidido.' });

		const result = await getProjectUseCases().addDecision({ projectId: params.projectId, subject });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	editDecision: async ({ request, params }) => {
		const formData = await request.formData();
		const decisionId = readString(formData, 'decisionId');
		const subject = readString(formData, 'subject');
		if (!decisionId || !subject) return fail(400, { message: 'Decisão ou assunto inválido.' });
		const options = readString(formData, 'options');
		const dueDate = readString(formData, 'dueDate');

		const result = await getProjectUseCases().editDecision({
			projectId: params.projectId,
			decisionId,
			subject,
			options,
			dueDate
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	decideDecision: async ({ request, params }) => {
		const formData = await request.formData();
		const decisionId = readString(formData, 'decisionId');
		const outcome = readString(formData, 'outcome');
		if (!decisionId || !outcome) return fail(400, { message: 'Decisão ou resultado inválido.' });

		const result = await getProjectUseCases().decideDecision({ projectId: params.projectId, decisionId, outcome });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	editDecisionOutcome: async ({ request, params }) => {
		const formData = await request.formData();
		const decisionId = readString(formData, 'decisionId');
		const outcome = readString(formData, 'outcome');
		if (!decisionId || !outcome) return fail(400, { message: 'Decisão ou resultado inválido.' });

		const result = await getProjectUseCases().editDecisionOutcome({
			projectId: params.projectId,
			decisionId,
			outcome
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	addChange: async ({ request, params }) => {
		const formData = await request.formData();
		const statement = readString(formData, 'statement');
		if (!statement) return fail(400, { message: 'Descreva o que mudou.' });

		const result = await getProjectUseCases().addChange({ projectId: params.projectId, statement });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	editChangeStatement: async ({ request, params }) => {
		const formData = await request.formData();
		const changeId = readString(formData, 'changeId');
		const statement = readString(formData, 'statement');
		if (!changeId || !statement) return fail(400, { message: 'Mudança ou declaração inválida.' });

		const result = await getProjectUseCases().editChangeStatement({ projectId: params.projectId, changeId, statement });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setChangeImpact: async ({ request, params }) => {
		const formData = await request.formData();
		const changeId = readString(formData, 'changeId');
		if (!changeId) return fail(400, { message: 'Mudança inválida.' });
		const impact = readString(formData, 'impact');

		const result = await getProjectUseCases().setChangeImpact({ projectId: params.projectId, changeId, impact });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
