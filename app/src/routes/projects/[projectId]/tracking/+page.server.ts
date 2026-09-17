import { fail } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { buildPhaseProgress } from '$lib/phase-progress';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildJourneyContext } from '../now/journey-context';
import { buildTrackingView } from './tracking-view';
import type { Actions, PageServerLoad } from './$types';

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
		scheduleBaseline: view.scheduleBaseline
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
	}
};
