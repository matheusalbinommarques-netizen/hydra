import { fail } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import type { RiskImpact, RiskLikelihood } from '$lib/domain';
import { buildPhaseProgress } from '$lib/phase-progress';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildJourneyContext } from '../now/journey-context';
import { buildTrackingView } from './tracking-view';
import type { Actions, PageServerLoad } from './$types';

const RISK_LIKELIHOODS: readonly RiskLikelihood[] = ['baixa', 'media', 'alta'];
const RISK_IMPACTS: readonly RiskImpact[] = ['baixo', 'medio', 'alto'];

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte,
// hardening pós-dogfood) — o candidato canônico que a interface mostrou
// (ver work/+page.server.ts, readExpectedPropagationPlan, mesmo padrão),
// serializado num único campo oculto. `null` (JSON ausente/malformado/
// shape errado) vira "preview obsoleto" na action, mesma resposta de uma
// divergência real: em qualquer um dos dois casos, a única saída correta
// é pedir uma prévia nova, nunca adivinhar ou aplicar parcialmente.
interface ExpectedBaselineCandidateEntry {
	workItemId: string;
	plannedStart: string | null;
	durationDays: number | null;
}

function readExpectedBaselineCandidate(formData: FormData): { entries: ExpectedBaselineCandidateEntry[] } | null {
	const raw = formData.get('expectedCandidate');
	if (typeof raw !== 'string') return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const { entries } = parsed as { entries?: unknown };
	if (!Array.isArray(entries)) return null;

	const validated: ExpectedBaselineCandidateEntry[] = [];
	for (const entry of entries) {
		if (typeof entry !== 'object' || entry === null) return null;
		const { workItemId, plannedStart, durationDays } = entry as Record<string, unknown>;
		if (typeof workItemId !== 'string') return null;
		if (plannedStart !== null && typeof plannedStart !== 'string') return null;
		if (durationDays !== null && typeof durationDays !== 'number') return null;
		if ((plannedStart === null) !== (durationDays === null)) return null;
		validated.push({ workItemId, plannedStart, durationDays });
	}
	return { entries: validated };
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
		scheduleBaseline: view.scheduleBaseline,
		risks: view.risks
	});

	return { tracking };
};

export const actions: Actions = {
	// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte,
	// hardening pós-dogfood) — previewScheduleBaselineCapture nunca grava,
	// mesmo espírito de previewSchedulePropagation (work/+page.server.ts):
	// devolve o candidato inteiro (um por WorkItem existente) para a
	// interface mostrar e depois devolver como `expected` na confirmação.
	// captureScheduleBaseline recalcula o candidato contra o estado atual no
	// domínio e só aplica se corresponder ao que a interface mostrou —
	// divergência (`expectedCandidate` ausente/malformado, ou preview
	// realmente obsoleto) é recusada por inteiro como preview obsoleto,
	// nunca aplicada parcialmente.
	previewScheduleBaselineCapture: async ({ params }) => {
		const result = await getProjectUseCases().previewScheduleBaselineCapture({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true, baselinePreview: result.value };
	},

	captureScheduleBaseline: async ({ request, params }) => {
		const formData = await request.formData();
		const expected = readExpectedBaselineCandidate(formData);
		if (!expected) {
			return fail(400, {
				message: 'O cronograma mudou desde este preview. Gere a prévia novamente antes de confirmar a referência.'
			});
		}

		const result = await getProjectUseCases().captureScheduleBaseline({ projectId: params.projectId, expected });
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
	}
};
