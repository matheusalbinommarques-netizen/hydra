import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { encodeMultiSelectValue } from '$lib/domain';
import type { ActivityDefinition } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { ProjectView } from '$lib/server/application/types';
import type { Actions, PageServerLoad } from './$types';

const DESCOBERTA_PHASE_ID = 'descoberta';

function findActivityDefinition(activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

// Edição a partir do Resumo da descoberta (?activity=<id>&from=summary): só
// atividades required_fields da própria Descoberta, e só quando já
// concluída — nunca uma atividade de outra fase, nem uma ainda não alcançada
// pela Trilha A (não_iniciada/em_andamento nunca passa aqui), nem uma pulada
// (essa continua exclusiva do fluxo de retomada de pendência, acima).
function findDescobertaConcluidaActivity(view: ProjectView, activityId: string): ActivityDefinition | undefined {
	const activity = findActivityDefinition(activityId);
	if (!activity || activity.completionMode !== 'required_fields') return undefined;
	if (activity.phaseId !== DESCOBERTA_PHASE_ID) return undefined;
	if (view.activityStatuses[activityId] !== 'concluída') return undefined;
	return activity;
}

export const load: PageServerLoad = async ({ parent, url, params }) => {
	const { view } = await parent();

	// Retomada de atividade pulada: só aceita um id que já corresponda a uma
	// pendência aberta do próprio projeto (view.openPendingItems), nunca um
	// activityDefinitionId arbitrário — isso impede abrir atividades futuras
	// ainda não alcançadas pela Trilha A.
	const resumeActivityId = url.searchParams.get('activity');
	const resumingPendingItem = resumeActivityId
		? view.openPendingItems.find((item) => item.activityDefinitionId === resumeActivityId)
		: undefined;

	// Edição a partir do Resumo: parâmetro adicional e explícito
	// (from=summary), só resolvido quando não é um caso de retomada de
	// pendência. Parâmetro presente mas inválido (id de outra fase, id
	// inexistente, ou atividade ainda não concluída) falha de forma segura —
	// redireciona ao Resumo em vez de renderizar qualquer atividade.
	const fromSummary = url.searchParams.get('from') === 'summary';
	if (resumeActivityId && fromSummary && !resumingPendingItem) {
		const editActivity = findDescobertaConcluidaActivity(view, resumeActivityId);
		if (!editActivity) {
			redirect(303, `/projects/${params.projectId}/summary`);
		}
		return { activity: editActivity, isResuming: false, isEditingFromSummary: true };
	}

	const activityId = resumingPendingItem
		? resumingPendingItem.activityDefinitionId
		: view.nextActivity.kind === 'recommendation'
			? view.nextActivity.activityDefinitionId
			: undefined;

	const activity = activityId ? findActivityDefinition(activityId) : undefined;

	return { activity, isResuming: Boolean(resumingPendingItem), isEditingFromSummary: false };
};

export const actions: Actions = {
	answer: async ({ request, params }) => {
		const formData = await request.formData();
		const activityDefinitionId = formData.get('activityDefinitionId');
		if (typeof activityDefinitionId !== 'string' || !activityDefinitionId) {
			return fail(400, { message: 'Atividade inválida.' });
		}
		// Marca a origem "edição a partir do Resumo" (ActivityForm/+page.svelte
		// só a inclui quando data.isEditingFromSummary é true) — decide para
		// onde ir após salvar, sem afetar em nada a validação/persistência.
		const returnTo = formData.get('returnTo');
		const returnToSummary = returnTo === 'summary';

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
			if (key === 'activityDefinitionId' || key === 'returnTo' || values[key] !== undefined) continue;
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

		if (returnToSummary) {
			// Edição a partir do Resumo nunca avança para a próxima atividade da
			// jornada — sempre volta ao Resumo, sucesso ou não a atividade
			// editada permanecer concluída (a invalidação, se aplicável, já
			// aconteceu dentro de answerActivity).
			redirect(303, `/projects/${params.projectId}/summary`);
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
