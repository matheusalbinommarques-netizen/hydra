import { fail } from '@sveltejs/kit';
import { isCronogramaReady } from '$lib/schedule-readiness';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildCronogramaTimeline, buildCronogramaView } from './cronograma-view';
import type { Actions, PageServerLoad } from './$types';

// Readiness (ETAPA 12 do rework, §42, sexto microcorte; reachability
// resolvida na ETAPA 13, §43, absorção de Acompanhamento) — a rota é sempre
// alcançável, mesmo antes de existir ≥1 WorkItem com schedule completo
// (mesmo critério de `$lib/schedule-readiness`). Antes da readiness, a
// página mostra a Linha do tempo de baixa fidelidade (`buildCronogramaTimeline`)
// em vez do Gantt completo — nunca redireciona para fora, e nunca as duas
// apresentações juntas.
export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	const ready = isCronogramaReady(view.workItems);

	return {
		projectId: view.projectId,
		ready,
		cronograma: ready
			? buildCronogramaView({
					workItems: view.workItems,
					deliverables: view.deliverables,
					milestones: view.milestones,
					scheduleBaseline: view.scheduleBaseline
				})
			: null,
		timeline: ready ? [] : buildCronogramaTimeline(view.milestones, view.workItems)
	};
};

// Referência do cronograma (ETAPA 13 do rework, §43 — D068 resolve o
// conflito sinalizado por D066: capturar/rebaselinear a referência é gestão
// explícita da referência, não edição do plano, e por isso pertence ao
// Cronograma sem violar seu caráter read-only quanto a scheduling). Mesmo
// contrato exato que vivia em tracking/+page.server.ts antes desta absorção
// (ETAPA 12, §42, quinto microcorte) — só o dono da capability muda.
//
// O candidato canônico que a interface mostrou (ver work/+page.server.ts,
// readExpectedPropagationPlan, mesmo padrão), serializado num único campo
// oculto. `null` (JSON ausente/malformado/shape errado) vira "preview
// obsoleto" na action, mesma resposta de uma divergência real: em qualquer
// um dos dois casos, a única saída correta é pedir uma prévia nova, nunca
// adivinhar ou aplicar parcialmente.
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

export const actions: Actions = {
	// previewScheduleBaselineCapture nunca grava, mesmo espírito de
	// previewSchedulePropagation (work/+page.server.ts): devolve o candidato
	// inteiro (um por WorkItem existente) para a interface mostrar e depois
	// devolver como `expected` na confirmação. captureScheduleBaseline
	// recalcula o candidato contra o estado atual no domínio e só aplica se
	// corresponder ao que a interface mostrou — divergência
	// (`expectedCandidate` ausente/malformado, ou preview realmente obsoleto)
	// é recusada por inteiro como preview obsoleto, nunca aplicada
	// parcialmente.
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
