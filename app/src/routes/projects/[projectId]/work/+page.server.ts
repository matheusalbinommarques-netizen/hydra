import { fail } from '@sveltejs/kit';
import type { ImpedimentType, WorkItemStatus } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions } from './$types';

const WORK_ITEM_STATUSES: readonly WorkItemStatus[] = ['a_fazer', 'em_andamento', 'concluido'];
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

function readWorkItemStatus(formData: FormData, key: string): WorkItemStatus | null {
	const value = readString(formData, key);
	return value && (WORK_ITEM_STATUSES as readonly string[]).includes(value) ? (value as WorkItemStatus) : null;
}

function readTipo(formData: FormData, key: string): ImpedimentType | null {
	const value = readString(formData, key);
	return value && (IMPEDIMENT_TYPES as readonly string[]).includes(value) ? (value as ImpedimentType) : null;
}

// Propagação de cronograma (ETAPA 12 do rework, §42, terceiro microcorte,
// hardening pós-dogfood) — o subconjunto canônico do plano que a interface
// mostrou (ver work-view.ts/+page.svelte), serializado num único campo
// oculto porque não há lista dinâmica de linhas de formulário mais simples
// no repo para isto. Validação estrutural aqui é só higiene de entrada —
// `null` (JSON ausente/malformado/shape errado) vira "preview obsoleto",
// mesma resposta de uma divergência real: em qualquer um dos dois casos, a
// única saída correta é pedir para gerar o replanejamento de novo, nunca
// adivinhar ou aplicar parcialmente.
interface ExpectedPropagationChange {
	workItemId: string;
	fromPlannedStart: string;
	toPlannedStart: string;
	viaWorkItemId: string;
}

function readExpectedPropagationPlan(
	formData: FormData
): { changes: ExpectedPropagationChange[]; partial: boolean } | null {
	const raw = formData.get('expectedPlan');
	if (typeof raw !== 'string') return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof parsed !== 'object' || parsed === null) return null;
	const { changes, partial } = parsed as { changes?: unknown; partial?: unknown };
	if (typeof partial !== 'boolean' || !Array.isArray(changes)) return null;

	const validated: ExpectedPropagationChange[] = [];
	for (const change of changes) {
		if (
			typeof change !== 'object' ||
			change === null ||
			typeof (change as Record<string, unknown>).workItemId !== 'string' ||
			typeof (change as Record<string, unknown>).fromPlannedStart !== 'string' ||
			typeof (change as Record<string, unknown>).toPlannedStart !== 'string' ||
			typeof (change as Record<string, unknown>).viaWorkItemId !== 'string'
		) {
			return null;
		}
		const c = change as ExpectedPropagationChange;
		validated.push({
			workItemId: c.workItemId,
			fromPlannedStart: c.fromPlannedStart,
			toPlannedStart: c.toPlannedStart,
			viaWorkItemId: c.viaWorkItemId
		});
	}
	return { changes: validated, partial };
}

export const actions: Actions = {
	create: async ({ request, params }) => {
		const formData = await request.formData();
		const title = readString(formData, 'title');
		if (!title) return fail(400, { message: 'Descreva o item de trabalho.' });

		const result = await getProjectUseCases().addWorkItem({ projectId: params.projectId, title });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	move: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		const status = readWorkItemStatus(formData, 'status');
		if (!workItemId || !status) return fail(400, { message: 'Item ou status inválido.' });

		const result = await getProjectUseCases().moveWorkItem({ projectId: params.projectId, workItemId, status });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	// setWorkItemSchedule (ETAPA 12 do rework, "Scheduling e Gantt", §42,
	// primeiro microcorte fundacional) — schedule MANUAL e atômico: campo vazio
	// em ambos significa LIMPAR (null/null), não erro. Estado parcial (só um
	// preenchido) é recusado pelo domínio, não aqui — esta action só distingue
	// "veio vazio" de "veio algo", mesmo espírito de setMilestonePlannedDate.
	setWorkItemSchedule: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		if (!workItemId) return fail(400, { message: 'Item de trabalho inválido.' });
		const plannedStart = readString(formData, 'plannedStart');
		const durationDaysRaw = readString(formData, 'durationDays');
		const durationDays = durationDaysRaw === null ? null : Number(durationDaysRaw);

		const result = await getProjectUseCases().setWorkItemSchedule({
			projectId: params.projectId,
			workItemId,
			plannedStart,
			durationDays
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	// Dependency (ETAPA 8 do rework) — precedência planejada, nunca bloqueio:
	// nada aqui interfere na action `move` acima.
	addDependency: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		const dependsOnWorkItemId = readString(formData, 'dependsOnWorkItemId');
		if (!workItemId || !dependsOnWorkItemId) {
			return fail(400, { message: 'Selecione o item do qual este trabalho depende.' });
		}

		const result = await getProjectUseCases().addDependency({
			projectId: params.projectId,
			workItemId,
			dependsOnWorkItemId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	removeDependency: async ({ request, params }) => {
		const formData = await request.formData();
		const dependencyId = readString(formData, 'dependencyId');
		if (!dependencyId) return fail(400, { message: 'Dependência inválida.' });

		const result = await getProjectUseCases().removeDependency({
			projectId: params.projectId,
			dependencyId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	// Propagação de cronograma (ETAPA 12 do rework, §42, terceiro microcorte)
	// — previewSchedulePropagation nunca grava; devolve o plano para a
	// interface mostrar antes de qualquer confirmação. confirmSchedulePropagation
	// recalcula contra o estado atual no domínio (nunca confia num plano vindo
	// do cliente) e só aplica se o recálculo corresponder ao que a interface
	// mostrou (`expectedPlan`, hardening pós-dogfood) — divergência é
	// recusada por inteiro como preview obsoleto, nunca aplicada
	// parcialmente. O navegador nunca é fonte de verdade: `expectedPlan` só
	// serve de expectativa para essa comparação.
	previewSchedulePropagation: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		if (!workItemId) return fail(400, { message: 'Item de trabalho inválido.' });

		const result = await getProjectUseCases().previewSchedulePropagation({
			projectId: params.projectId,
			workItemId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true, preview: result.value };
	},

	confirmSchedulePropagation: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		if (!workItemId) return fail(400, { message: 'Item de trabalho inválido.' });
		const expected = readExpectedPropagationPlan(formData);
		if (!expected) {
			return fail(400, { message: 'O cronograma mudou desde este preview. Gere o replanejamento novamente antes de confirmar.' });
		}

		const result = await getProjectUseCases().applySchedulePropagation({
			projectId: params.projectId,
			workItemId,
			expected
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	// Milestone (ETAPA 8 do rework, segundo microcorte) — checkpoint
	// declarado. `reachMilestone` NUNCA é chamado a partir da action `move`
	// acima, e `move` nunca é recusado por causa de marco: as duas coisas são
	// independentes por design.
	createMilestone: async ({ request, params }) => {
		const formData = await request.formData();
		const title = readString(formData, 'title');
		if (!title) return fail(400, { message: 'Descreva o marco.' });

		const result = await getProjectUseCases().addMilestone({ projectId: params.projectId, title });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	reachMilestone: async ({ request, params }) => {
		const formData = await request.formData();
		const milestoneId = readString(formData, 'milestoneId');
		if (!milestoneId) return fail(400, { message: 'Marco inválido.' });

		const result = await getProjectUseCases().reachMilestone({ projectId: params.projectId, milestoneId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	reopenMilestone: async ({ request, params }) => {
		const formData = await request.formData();
		const milestoneId = readString(formData, 'milestoneId');
		if (!milestoneId) return fail(400, { message: 'Marco inválido.' });

		const result = await getProjectUseCases().reopenMilestone({ projectId: params.projectId, milestoneId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	// Data planejada do marco (microcorte de Timeline). Campo vazio significa
	// LIMPAR (null), não erro — definir, reagendar e limpar são a mesma ação.
	// A validade da data é decidida pelo domínio (isCivilDate), não aqui: esta
	// action só distingue "veio vazio" de "veio algo".
	setMilestonePlannedDate: async ({ request, params }) => {
		const formData = await request.formData();
		const milestoneId = readString(formData, 'milestoneId');
		if (!milestoneId) return fail(400, { message: 'Marco inválido.' });
		const plannedDate = readString(formData, 'plannedDate');

		const result = await getProjectUseCases().setMilestonePlannedDate({
			projectId: params.projectId,
			milestoneId,
			plannedDate
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	linkMilestone: async ({ request, params }) => {
		const formData = await request.formData();
		const milestoneId = readString(formData, 'milestoneId');
		const workItemId = readString(formData, 'workItemId');
		if (!milestoneId || !workItemId) return fail(400, { message: 'Selecione o marco relacionado.' });

		const result = await getProjectUseCases().linkWorkItemToMilestone({
			projectId: params.projectId,
			milestoneId,
			workItemId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	unlinkMilestone: async ({ request, params }) => {
		const formData = await request.formData();
		const milestoneWorkItemId = readString(formData, 'milestoneWorkItemId');
		if (!milestoneWorkItemId) return fail(400, { message: 'Relação inválida.' });

		const result = await getProjectUseCases().unlinkWorkItemFromMilestone({
			projectId: params.projectId,
			milestoneWorkItemId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	registerImpediment: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		const text = readString(formData, 'text');
		const tipo = readTipo(formData, 'tipo');
		if (!workItemId || !text || !tipo) {
			return fail(400, { message: 'Descreva o impedimento e selecione um tipo.' });
		}

		const result = await getProjectUseCases().addImpediment({ projectId: params.projectId, text, tipo, workItemId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
