import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { encodeMultiSelectValue } from '$lib/domain';
import type { ActivityDefinition } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions, PageServerLoad } from './$types';

function findActivityDefinition(activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { view } = await parent();

	// Retomada de atividade pulada: só aceita um id que já corresponda a uma
	// pendência aberta do próprio projeto (view.openPendingItems), nunca um
	// activityDefinitionId arbitrário — isso impede abrir atividades futuras
	// ainda não alcançadas pela Trilha A.
	const resumeActivityId = url.searchParams.get('activity');
	const resumingPendingItem = resumeActivityId
		? view.openPendingItems.find((item) => item.activityDefinitionId === resumeActivityId)
		: undefined;

	const activityId = resumingPendingItem
		? resumingPendingItem.activityDefinitionId
		: view.nextActivity.kind === 'recommendation'
			? view.nextActivity.activityDefinitionId
			: undefined;

	const activity = activityId ? findActivityDefinition(activityId) : undefined;

	return { activity, isResuming: Boolean(resumingPendingItem) };
};

export const actions: Actions = {
	answer: async ({ request, params }) => {
		const formData = await request.formData();
		const activityDefinitionId = formData.get('activityDefinitionId');
		if (typeof activityDefinitionId !== 'string' || !activityDefinitionId) {
			return fail(400, { message: 'Atividade inválida.' });
		}

		const activity = findActivityDefinition(activityDefinitionId);
		const multiSelectFieldIds = new Set(
			activity && activity.completionMode === 'required_fields'
				? activity.fields
						.filter((field) => field.dataTarget === 'answer' && field.type === 'selecao_multipla')
						.map((field) => field.id)
				: []
		);

		const values: Record<string, string> = {};
		for (const key of formData.keys()) {
			if (key === 'activityDefinitionId' || values[key] !== undefined) continue;
			if (multiSelectFieldIds.has(key)) {
				values[key] = encodeMultiSelectValue(
					formData.getAll(key).filter((v): v is string => typeof v === 'string')
				);
			} else {
				const value = formData.get(key);
				values[key] = typeof value === 'string' ? value : '';
			}
		}
		// Nenhuma caixa marcada nunca aparece em formData — garante "[]"
		// explícito em vez de deixar o campo ausente (que a validação de
		// obrigatoriedade trataria como "nunca respondido", não como "vazio").
		for (const fieldId of multiSelectFieldIds) {
			if (values[fieldId] === undefined) values[fieldId] = encodeMultiSelectValue([]);
		}

		const result = await getProjectUseCases().answerActivity({
			projectId: params.projectId,
			activityDefinitionId,
			values
		});

		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error), values });
		}
		return { success: true, values: undefined };
	},

	skip: async ({ request, params }) => {
		const formData = await request.formData();
		const activityDefinitionId = formData.get('activityDefinitionId');
		if (typeof activityDefinitionId !== 'string' || !activityDefinitionId) {
			return fail(400, { message: 'Atividade inválida.' });
		}

		const result = await getProjectUseCases().skipActivity({
			projectId: params.projectId,
			activityDefinitionId
		});

		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}

		// Rota canônica de Agora, sem preservar o parâmetro de retomada.
		redirect(303, `/projects/${params.projectId}/now`);
	}
};
