import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { decodeMultiSelectValue, encodeMultiSelectValue } from '$lib/domain';
import type { ActivityDefinition, FieldDefinition, RequiredFieldsActivity } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { ProjectView } from '$lib/server/application/types';
import { buildBancadaOverviewView } from './bancada-overview-view';
import type { Actions, PageServerLoad } from './$types';

const DESCOBERTA_PHASE_ID = 'descoberta';

// Só estas três atividades ganham a apresentação "um campo por vez" nesta
// rodada (Bancada, Descoberta + Definição do produto) — as demais 33
// continuam mostrando todos os campos de uma vez, como hoje.
const DECOMPOSED_ACTIVITY_IDS = new Set(['problema', 'contexto', 'visao_produto']);

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

// Mesma checagem por campo de domain/transitions.ts (isActivityFieldsValid),
// só que lida a partir de ProjectView (answers/projectName já achatados),
// não de ProjectState — a interface não tem acesso ao estado bruto. Não
// substitui isActivityFieldsValid (que continua sendo a fonte da verdade
// para o status da atividade); serve só para decidir qual campo mostrar a
// seguir na progressão campo a campo.
function isFieldAnswered(field: FieldDefinition, view: ProjectView): boolean {
	if (field.dataTarget === 'project_property') {
		return !!view.projectName && view.projectName.trim().length > 0;
	}
	if (field.type === 'selecao_multipla') {
		const decoded = decodeMultiSelectValue(view.answers[field.id] ?? '');
		return !!decoded && decoded.length > 0;
	}
	const value = view.answers[field.id];
	return !!value && value.trim().length > 0;
}

// Campos opcionais ainda relevantes de uma atividade decomposta, para a
// etapa final agrupada. `revealWhen` é resolvido aqui de forma estática (a
// partir da Answer já persistida do campo-gatilho, que nunca aparece nesta
// etapa) e removido do campo retornado — sem isso, ActivityForm nunca
// mostraria o campo revelado, porque o campo-gatilho não está entre os
// fields renderizados nesta etapa (ver ActivityForm.svelte, isVisible()).
function resolveOptionalFields(activity: RequiredFieldsActivity, view: ProjectView): FieldDefinition[] {
	return activity.fields
		.filter((field) => !field.required)
		.filter((field) => {
			if (field.dataTarget !== 'answer' || !field.revealWhen) return true;
			const decoded = decodeMultiSelectValue(view.answers[field.revealWhen.fieldId] ?? '') ?? [];
			return decoded.includes(field.revealWhen.optionId);
		})
		.map((field): FieldDefinition => {
			if (field.dataTarget === 'answer' && field.revealWhen) {
				return { ...field, revealWhen: undefined };
			}
			return field;
		});
}

export const load: PageServerLoad = async ({ parent, url, params }) => {
	const { view } = await parent();
	const bancadaOverview = buildBancadaOverviewView(catalog, view.answers);

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
		// Edição a partir do Resumo sempre mostra o formulário inteiro, nunca
		// campo a campo — quem chega aqui já concluiu a atividade e quer
		// corrigir algo pontual, não ser levado pela sequência de novo.
		return { activity: editActivity, isResuming: false, isEditingFromSummary: true, stepKind: 'full' as const, bancadaOverview };
	}

	// Etapa opcional agrupada de uma atividade decomposta já concluída
	// (problema/contexto/visao_produto) — só alcançada via
	// `?activity=<id>&field=optional`, gerado pelo redirect da própria action
	// `answer` logo depois do último campo obrigatório. A recomendação normal
	// (view.nextActivity) já teria avançado para a atividade seguinte nesse
	// ponto, então esse parâmetro é o único jeito de "segurar" a tela nesta
	// mesma atividade só para os campos opcionais restantes.
	const requestedField = url.searchParams.get('field');
	if (resumeActivityId && requestedField === 'optional' && !resumingPendingItem && !fromSummary) {
		const stepActivity = findActivityDefinition(resumeActivityId);
		if (
			stepActivity &&
			stepActivity.completionMode === 'required_fields' &&
			DECOMPOSED_ACTIVITY_IDS.has(stepActivity.id) &&
			view.activityStatuses[stepActivity.id] === 'concluída'
		) {
			const unanswered = resolveOptionalFields(stepActivity, view).filter(
				(field) => !isFieldAnswered(field, view)
			);
			if (unanswered.length > 0) {
				return {
					activity: { ...stepActivity, fields: unanswered },
					isResuming: false,
					isEditingFromSummary: false,
					stepKind: 'optional' as const,
					bancadaOverview
				};
			}
		}
		// Parâmetro inválido ou etapa opcional já sem campos pendentes — volta
		// à rota canônica, que recomputa a atividade recomendada normalmente.
		redirect(303, `/projects/${params.projectId}/now`);
	}

	const activityId = resumingPendingItem
		? resumingPendingItem.activityDefinitionId
		: view.nextActivity.kind === 'recommendation'
			? view.nextActivity.activityDefinitionId
			: undefined;

	const activity = activityId ? findActivityDefinition(activityId) : undefined;

	// Campo a campo só no fluxo normal de avanço — nunca ao retomar uma
	// etapa pulada (quem pulou e está voltando quer ver tudo de uma vez).
	if (
		activity &&
		activity.completionMode === 'required_fields' &&
		DECOMPOSED_ACTIVITY_IDS.has(activity.id) &&
		!resumingPendingItem
	) {
		const requiredFields = activity.fields.filter((field) => field.required);
		const firstUnanswered = requiredFields.find((field) => !isFieldAnswered(field, view));
		if (firstUnanswered) {
			return {
				activity: { ...activity, fields: [firstUnanswered] },
				isResuming: false,
				isEditingFromSummary: false,
				stepKind: 'required' as const,
				bancadaOverview
			};
		}
		// Todos os campos obrigatórios já respondidos mas chegamos aqui sem
		// `field=optional` (ex.: navegação direta) — formulário inteiro como
		// rede de segurança, nunca uma tela sem nenhum campo.
	}

	return {
		activity,
		isResuming: Boolean(resumingPendingItem),
		isEditingFromSummary: false,
		stepKind: 'full' as const,
		bancadaOverview
	};
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

		// Presentes só quando o formulário renderizado é uma etapa da
		// progressão campo a campo (ver now/+page.svelte) — ausentes em
		// qualquer submissão de formulário inteiro (as 33 atividades comuns,
		// retomada de pulada, edição a partir do Resumo).
		const stepKindRaw = formData.get('_stepKind');
		const stepKind = stepKindRaw === 'required' || stepKindRaw === 'optional' ? stepKindRaw : null;
		const stepFieldIdsRaw = formData.get('_stepFieldIds');
		const stepFieldIds =
			typeof stepFieldIdsRaw === 'string' && stepFieldIdsRaw.length > 0 ? stepFieldIdsRaw.split(',') : null;

		const activity = findActivityDefinition(activityDefinitionId);
		// Restringe a que campos desta submissão se aplica o "garante '[]'
		// explícito" abaixo — sem isso, submeter só o campo de texto de
		// "problema" marcaria "sinais_situacao" (outro campo, ainda não
		// exibido nesta etapa) como respondido-e-vazio antes da hora.
		const relevantFieldIds = stepFieldIds ? new Set(stepFieldIds) : null;

		const multiSelectFieldIds = new Set(
			activity && activity.completionMode === 'required_fields'
				? activity.fields
						.filter(
							(field) =>
								field.dataTarget === 'answer' &&
								field.type === 'selecao_multipla' &&
								(!relevantFieldIds || relevantFieldIds.has(field.id))
						)
						.map((field) => field.id)
				: []
		);

		const values: Record<string, string> = {};
		for (const key of formData.keys()) {
			if (
				key === 'activityDefinitionId' ||
				key === 'returnTo' ||
				key === '_stepKind' ||
				key === '_stepFieldIds' ||
				values[key] !== undefined
			) {
				continue;
			}
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

		if (stepKind && activity && activity.completionMode === 'required_fields') {
			if (stepKind === 'optional') {
				// Etapa opcional: salvar aqui sempre libera a próxima atividade,
				// preenchido tudo ou não — não insiste de novo nos mesmos campos.
				redirect(303, `/projects/${params.projectId}/now`);
			}

			// stepKind === 'required': só avança para a etapa opcional (em vez
			// da rota canônica, que já pularia a atividade inteira) quando este
			// era de fato o último campo obrigatório e ainda sobra algum
			// opcional não respondido.
			const requiredFields = activity.fields.filter((field) => field.required);
			const stillMissingRequired = requiredFields.some((field) => !isFieldAnswered(field, result.value));
			if (!stillMissingRequired) {
				const unanswered = resolveOptionalFields(activity, result.value).filter(
					(field) => !isFieldAnswered(field, result.value)
				);
				if (unanswered.length > 0) {
					redirect(303, `/projects/${params.projectId}/now?activity=${activity.id}&field=optional`);
				}
			}
			redirect(303, `/projects/${params.projectId}/now`);
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
