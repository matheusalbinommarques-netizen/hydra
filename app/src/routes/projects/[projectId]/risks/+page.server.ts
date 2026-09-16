import { fail } from '@sveltejs/kit';
import type { RiskImpact, RiskLikelihood } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildRisks } from '$lib/risk-view';
import type { Actions, PageServerLoad } from './$types';

const RISK_LIKELIHOODS: readonly RiskLikelihood[] = ['baixa', 'media', 'alta'];
const RISK_IMPACTS: readonly RiskImpact[] = ['baixo', 'medio', 'alto'];

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

// Select vazio é o caminho de "limpar avaliação" (par null/null), não erro —
// distinto de um valor presente fora da lista aprovada, que é entrada
// inválida. Mesmo padrão de tracking/+page.server.ts.
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
	return { risks: buildRisks(view.risks) };
};

// Mesmo lifecycle real de Risk já operado em Acompanhamento (`/tracking`,
// D065/D066) — nenhum estado, entidade ou regra nova; as duas surfaces
// operam sobre os mesmos Risks reais via project-use-cases.ts.
export const actions: Actions = {
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
	}
};
