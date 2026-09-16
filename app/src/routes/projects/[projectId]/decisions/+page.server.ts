import { fail } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildDecisions, buildDecisionWorkItemOptions } from '$lib/decision-view';
import type { Actions, PageServerLoad } from './$types';

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return {
		decisions: buildDecisions(view.decisions),
		changes: view.changes,
		workItemOptions: buildDecisionWorkItemOptions(view.workItems)
	};
};

// Mesmo lifecycle real de Decision/Change já operado em Acompanhamento
// (`/tracking`, D065/D066) — nenhum estado, entidade ou regra nova; esta
// rota opera sobre os mesmos Decision/Change reais via project-use-cases.ts.
// `/tracking` continua lendo Decision (pendente/decidida) só como dado de
// apoio ao vínculo de Impediment `decisao_pendente`, sem gerir o lifecycle.
export const actions: Actions = {
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
		const responsible = readString(formData, 'responsible');

		const result = await getProjectUseCases().editDecision({
			projectId: params.projectId,
			decisionId,
			subject,
			options,
			dueDate,
			responsible
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

	// linkWorkItemToDecision/unlinkWorkItemFromDecision (ETAPA 11 do rework,
	// terceiro microcorte, §41) — "Trabalhos afetados" dentro da própria
	// Decision.
	linkWorkItem: async ({ request, params }) => {
		const formData = await request.formData();
		const decisionId = readString(formData, 'decisionId');
		const workItemId = readString(formData, 'workItemId');
		if (!decisionId || !workItemId) return fail(400, { message: 'Decisão ou trabalho inválido.' });

		const result = await getProjectUseCases().linkWorkItemToDecision({
			projectId: params.projectId,
			decisionId,
			workItemId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	unlinkWorkItem: async ({ request, params }) => {
		const formData = await request.formData();
		const decisionAffectedWorkItemId = readString(formData, 'decisionAffectedWorkItemId');
		if (!decisionAffectedWorkItemId) return fail(400, { message: 'Relação inválida.' });

		const result = await getProjectUseCases().unlinkWorkItemFromDecision({
			projectId: params.projectId,
			decisionAffectedWorkItemId
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
