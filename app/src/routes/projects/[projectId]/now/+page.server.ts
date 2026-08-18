import { fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { decodeMultiSelectValue, decodePlanningItems, encodeMultiSelectValue } from '$lib/domain';
import type { ActivityDefinition, FieldDefinition, RequiredFieldsActivity } from '$lib/domain';
import { buildPhaseProgress } from '$lib/phase-progress';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { ProjectView } from '$lib/server/application/types';
import { buildBancadaOverviewView } from './bancada-overview-view';
import { buildJourneyContext } from './journey-context';
import type { Actions, PageServerLoad } from './$types';

const DESCOBERTA_PHASE_ID = 'descoberta';

// C5-01 — "Priorizar entregas" opera sobre a MESMA coleção de PlanningItem
// que "Decompor o trabalho" produziu; a coleção pertence à Answer de
// `decompor_trabalho`/`partes_trabalho`, nunca duplicada. Decodificar aqui
// (server, único ponto além de records-view.ts) é o que mantém
// planning-items.ts como o único lugar que conhece o formato JSON interno —
// a rota só repassa um array já decodificado para o template.
const PRIORIZAR_ENTREGAS_ACTIVITY_ID = 'priorizar_entregas';
const PARTES_TRABALHO_FIELD_ID = 'partes_trabalho';

// S4D — "Resumo da descoberta" agora é representada pela tela dedicada
// /summary (Checkpoint da Descoberta), não mais por uma superfície própria
// dentro de /now. `resumo` nunca é allowsSkip, então nunca chega aqui via
// retomada de pendência — só via view.nextActivity no fluxo normal, tratado
// abaixo.
const RESUMO_ACTIVITY_ID = 'resumo';

// Conjunto fechado de origens de revisão reconhecidas (?from=<origem> na
// carga, returnTo=<origem> na action `answer`) — Resumo e Registros, os dois
// únicos lugares que hoje linkam para cá pedindo revisão de uma atividade já
// concluída. Qualquer outro valor (string arbitrária, ausência do parâmetro)
// vira `null` e cai no fluxo normal de Agora — nunca é usado para montar um
// redirect diretamente.
export type ReviewOrigin = 'summary' | 'records';

function parseReviewOrigin(value: unknown): ReviewOrigin | null {
	return value === 'summary' || value === 'records' ? value : null;
}

function reviewOriginRoute(projectId: string, origin: ReviewOrigin): string {
	switch (origin) {
		case 'summary':
			return `/projects/${projectId}/summary`;
		case 'records':
			return `/projects/${projectId}/records`;
	}
}

// Só estas atividades ganham a apresentação "um campo por vez" nesta rodada
// (Bancada, Descoberta + Definição do produto) — as demais continuam
// mostrando todos os campos de uma vez, como hoje. "problema" segue listada
// aqui só por compatibilidade estrutural do load — a própria apresentação
// campo a campo nunca chega a ser usada para essa atividade, que tem
// componente bespoke próprio (EntenderSituacao.svelte, ignora stepKind).
const DECOMPOSED_ACTIVITY_IDS = new Set(['problema', 'visao_produto']);

function findActivityDefinition(activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

// Edição a partir de Resumo ou Registros (?activity=<id>&from=summary|records):
// atividades required_fields da própria Descoberta, mais uma exceção nominal
// fora dela (C5-01) — só quando já concluída, nunca uma atividade ainda não
// alcançada pela Trilha A (não_iniciada/em_andamento nunca passa aqui), nem
// uma pulada (essa continua exclusiva do fluxo de retomada de pendência,
// acima).
//
// "Decompor o trabalho" entra aqui, fora da Descoberta, para viabilizar
// "voltar para editar" depois de "Priorizar entregas" já confirmada (C5-01,
// item 7 da decisão de implementação). É uma exceção nominal, não uma
// política geral de edição por fase. A próxima exceção fora desta lista deve
// provocar generalização da regra (ex.: um sinal explícito no catálogo,
// tipo "editableAfterConclusion"), não a adição de outro id aqui.
const REVIEWABLE_ACTIVITY_IDS_OUTSIDE_DESCOBERTA = new Set(['decompor_trabalho']);

// "Quem é afetado" (publico) e "Como é tratado hoje" (estado_atual) são as
// exceções não required_fields: o Mapa de Impacto (MapaDeImpacto.svelte,
// ETAPA 2 do rework) e "Como é tratado hoje" (ComoETratadoHoje.svelte, Stage
// 4A do rework) são editáveis diretamente mesmo depois de concluídos —
// adicionar/remover/reclassificar depois da confirmação reabre a atividade
// automaticamente quando o estado fica incompleto (ver domain/transitions.ts,
// confirmAffectedGroups/confirmTreatment). Sem esta exceção, não haveria como
// retomar a tela após concluí-la — `?activity=` só chega aqui via este
// mecanismo de revisão.
const REVIEWABLE_NON_REQUIRED_FIELDS_ACTIVITY_IDS = new Set(['publico', 'estado_atual', 'entender_causas', 'resultado']);

function findReviewableConcludedActivity(view: ProjectView, activityId: string): ActivityDefinition | undefined {
	const activity = findActivityDefinition(activityId);
	if (!activity) return undefined;
	const hasReviewableCompletionMode =
		activity.completionMode === 'required_fields' || REVIEWABLE_NON_REQUIRED_FIELDS_ACTIVITY_IDS.has(activity.id);
	if (!hasReviewableCompletionMode) return undefined;
	const isDescoberta = activity.phaseId === DESCOBERTA_PHASE_ID;
	const isNominalException = REVIEWABLE_ACTIVITY_IDS_OUTSIDE_DESCOBERTA.has(activity.id);
	if (!isDescoberta && !isNominalException) return undefined;
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
	const bancadaOverview = buildBancadaOverviewView(
		catalog,
		view.answers,
		view.affectedGroups,
		view.evidences,
		view.currentTreatment,
		view.treatmentSteps,
		view.causeExploration,
		view.causeHypotheses,
		view.desiredOutcomes
	);
	const journeyContext = buildJourneyContext(catalog, view.nextActivity);
	const phaseProgress = buildPhaseProgress(catalog, view);

	// Retomada de atividade pulada: só aceita um id que já corresponda a uma
	// pendência aberta do próprio projeto (view.openPendingItems), nunca um
	// activityDefinitionId arbitrário — isso impede abrir atividades futuras
	// ainda não alcançadas pela Trilha A.
	const resumeActivityId = url.searchParams.get('activity');
	const resumingPendingItem = resumeActivityId
		? view.openPendingItems.find((item) => item.activityDefinitionId === resumeActivityId)
		: undefined;

	// Edição a partir de Resumo ou Registros: parâmetro adicional e explícito
	// (from=summary | from=records), só resolvido quando não é um caso de
	// retomada de pendência. Mesma regra de elegibilidade para as duas origens
	// (findReviewableConcludedActivity: só atividade required_fields da
	// própria Descoberta, já concluída). Parâmetro presente mas inválido (id
	// de outra fase, id inexistente, ou atividade ainda não concluída) falha
	// de forma segura — redireciona à própria origem em vez de renderizar
	// qualquer atividade.
	const reviewOrigin = parseReviewOrigin(url.searchParams.get('from'));
	if (resumeActivityId && reviewOrigin && !resumingPendingItem) {
		const editActivity = findReviewableConcludedActivity(view, resumeActivityId);
		if (!editActivity) {
			redirect(303, reviewOriginRoute(params.projectId, reviewOrigin));
		}
		// Edição a partir de Resumo/Registros sempre mostra o formulário
		// inteiro, nunca campo a campo — quem chega aqui já concluiu a
		// atividade e quer corrigir algo pontual, não ser levado pela
		// sequência de novo.
		return {
			activity: editActivity,
			isResuming: false,
			reviewOrigin,
			stepKind: 'full' as const,
			bancadaOverview,
			journeyContext,
			phaseProgress
		};
	}

	// Etapa opcional agrupada de uma atividade decomposta já concluída
	// (problema/visao_produto) — só alcançada via
	// `?activity=<id>&field=optional`, gerado pelo redirect da própria action
	// `answer` logo depois do último campo obrigatório. A recomendação normal
	// (view.nextActivity) já teria avançado para a atividade seguinte nesse
	// ponto, então esse parâmetro é o único jeito de "segurar" a tela nesta
	// mesma atividade só para os campos opcionais restantes.
	const requestedField = url.searchParams.get('field');
	if (resumeActivityId && requestedField === 'optional' && !resumingPendingItem && !reviewOrigin) {
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
					reviewOrigin: null,
					stepKind: 'optional' as const,
					bancadaOverview,
					journeyContext
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

	// S4D — o fluxo normal de avanço nunca renderiza a superfície legada de
	// "resumo" dentro de /now; entra direto no Checkpoint da Descoberta.
	if (activity?.id === RESUMO_ACTIVITY_ID && !resumingPendingItem) {
		redirect(303, `/projects/${params.projectId}/summary`);
	}

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
				reviewOrigin: null,
				stepKind: 'required' as const,
				bancadaOverview,
				journeyContext,
				phaseProgress
			};
		}
		// Todos os campos obrigatórios já respondidos mas chegamos aqui sem
		// `field=optional` (ex.: navegação direta) — formulário inteiro como
		// rede de segurança, nunca uma tela sem nenhum campo.
	}

	// C5-01 — "Priorizar entregas" não tem fields próprios (explicit_confirmation):
	// a coleção que ela apresenta/reordena é a mesma Answer de "Decompor o
	// trabalho", decodificada aqui para o template não precisar conhecer o
	// formato JSON interno.
	const planningItems =
		activity?.id === PRIORIZAR_ENTREGAS_ACTIVITY_ID
			? decodePlanningItems(view.answers[PARTES_TRABALHO_FIELD_ID])
			: undefined;

	return {
		activity,
		isResuming: Boolean(resumingPendingItem),
		reviewOrigin: null,
		stepKind: 'full' as const,
		bancadaOverview,
		journeyContext,
		phaseProgress,
		planningItems
	};
};

export const actions: Actions = {
	answer: async ({ request, params }) => {
		const formData = await request.formData();
		const activityDefinitionId = formData.get('activityDefinitionId');
		if (typeof activityDefinitionId !== 'string' || !activityDefinitionId) {
			return fail(400, { message: 'Atividade inválida.' });
		}
		// Marca a origem de revisão (+page.svelte só inclui este campo quando
		// data.reviewOrigin não é null) — decide para onde voltar após salvar,
		// sem afetar em nada a validação/persistência. Validado contra o mesmo
		// conjunto fechado do loader — nunca usado para montar um redirect
		// diretamente a partir do valor recebido no formulário.
		const returnTarget = parseReviewOrigin(formData.get('returnTo'));

		// Presentes só quando o formulário renderizado é uma etapa da
		// progressão campo a campo (ver now/+page.svelte) — ausentes em
		// qualquer submissão de formulário inteiro (as 33 atividades comuns,
		// retomada de pulada, edição a partir de Resumo/Registros).
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

		if (returnTarget) {
			// Edição a partir de Resumo/Registros nunca avança para a próxima
			// atividade da jornada — sempre volta à própria origem, sucesso ou
			// não a atividade editada permanecer concluída (a invalidação, se
			// aplicável, já aconteceu dentro de answerActivity).
			redirect(303, reviewOriginRoute(params.projectId, returnTarget));
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
	},

	// C5-01 — confirma "Priorizar entregas". Não recebe nenhum dado de
	// PlanningItem: a coleção pertence à Answer de "Decompor o trabalho" e
	// não é tocada por esta action; a recusa por coleção vazia acontece no
	// domínio (confirmPlanningPriority → planning_no_items).
	confirmPlanningPriority: async ({ params }) => {
		const result = await getProjectUseCases().confirmPlanningPriority({ projectId: params.projectId });

		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}

		redirect(303, `/projects/${params.projectId}/now`);
	},

	// Mapa de Impacto ("Quem é afetado", ETAPA 2 do rework) — cada interação
	// persiste imediatamente (mesmo padrão de next-version/+page.server.ts
	// para ScopeItem): nunca staging local submetido de uma vez só. Não
	// redireciona — MapaDeImpacto.svelte permanece na mesma tela após cada
	// ação, atualizando via `update()` (use:enhance), exatamente como a
	// edição de ScopeItem em /next-version.
	addAffectedGroup: async ({ request, params }) => {
		const formData = await request.formData();
		const label = formData.get('label');
		if (typeof label !== 'string' || label.trim().length === 0) {
			return fail(400, { message: 'Informe um nome para o grupo.' });
		}

		const result = await getProjectUseCases().addAffectedGroup({ projectId: params.projectId, label: label.trim() });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setAffectedGroupImpact: async ({ request, params }) => {
		const formData = await request.formData();
		const groupId = formData.get('groupId');
		const impact = formData.get('impact');
		if (typeof groupId !== 'string' || !groupId) return fail(400, { message: 'Grupo inválido.' });
		if (
			typeof impact !== 'string' ||
			!(['alto', 'medio', 'baixo', 'desconhecido'] as const).includes(impact as never)
		) {
			return fail(400, { message: 'Impacto inválido.' });
		}

		const result = await getProjectUseCases().setAffectedGroupImpact({
			projectId: params.projectId,
			groupId,
			impact: impact as 'alto' | 'medio' | 'baixo' | 'desconhecido'
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setAffectedGroupFrequency: async ({ request, params }) => {
		const formData = await request.formData();
		const groupId = formData.get('groupId');
		const frequency = formData.get('frequency');
		if (typeof groupId !== 'string' || !groupId) return fail(400, { message: 'Grupo inválido.' });
		if (
			typeof frequency !== 'string' ||
			!(['constante', 'frequente', 'as_vezes', 'raro', 'desconhecido'] as const).includes(frequency as never)
		) {
			return fail(400, { message: 'Frequência inválida.' });
		}

		const result = await getProjectUseCases().setAffectedGroupFrequency({
			projectId: params.projectId,
			groupId,
			frequency: frequency as 'constante' | 'frequente' | 'as_vezes' | 'raro' | 'desconhecido'
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	removeAffectedGroup: async ({ request, params }) => {
		const formData = await request.formData();
		const groupId = formData.get('groupId');
		if (typeof groupId !== 'string' || !groupId) return fail(400, { message: 'Grupo inválido.' });

		const result = await getProjectUseCases().removeAffectedGroup({ projectId: params.projectId, groupId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	confirmAffectedGroups: async ({ params }) => {
		const result = await getProjectUseCases().confirmAffectedGroups({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		// Mesmo padrão de confirmPlanningPriority: a rota canônica de Agora
		// recomputa a atividade recomendada, que já avançou para a próxima da
		// jornada agora que "publico" está concluída.
		redirect(303, `/projects/${params.projectId}/now`);
	},

	// Validação Externa (ETAPA 3 do rework) — "Validar com essas pessoas"
	// dentro do Mapa de Impacto: cria a ExternalAction só quando o usuário
	// confirma "Pronto para conversar" (a pré-visualização da preparação é
	// puramente client-side, ver MapaDeImpacto.svelte). Não redireciona —
	// mesmo padrão das demais actions do Mapa de Impacto.
	prepareExternalAction: async ({ request, params }) => {
		const formData = await request.formData();
		const affectedGroupId = formData.get('affectedGroupId');
		if (typeof affectedGroupId !== 'string' || !affectedGroupId) {
			return fail(400, { message: 'Grupo inválido.' });
		}

		const result = await getProjectUseCases().prepareExternalAction({ projectId: params.projectId, affectedGroupId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	// Retorno/captura de uma ExternalAction "Em campo" (ETAPA 3 do rework) —
	// acionada tanto pelo Mapa de Impacto quanto pelo pill do shell do
	// projeto em qualquer página (`[projectId]/+layout.svelte`, action
	// apontando explicitamente para "?/completeExternalAction" nesta rota;
	// SvelteKit resolve a action pela URL do <form>, não pela página atual).
	completeExternalAction: async ({ request, params }) => {
		const formData = await request.formData();
		const actionId = formData.get('actionId');
		const outcome = formData.get('outcome');
		const learning = formData.get('learning');
		if (typeof actionId !== 'string' || !actionId) return fail(400, { message: 'Ação inválida.' });
		if (
			typeof outcome !== 'string' ||
			!(['confirmed', 'partially_confirmed', 'contradicted', 'new_discovery'] as const).includes(outcome as never)
		) {
			return fail(400, { message: 'Escolha um resultado.' });
		}
		if (typeof learning !== 'string' || learning.trim().length === 0) {
			return fail(400, { message: 'Descreva o que você aprendeu.' });
		}

		const result = await getProjectUseCases().completeExternalAction({
			projectId: params.projectId,
			actionId,
			outcome: outcome as 'confirmed' | 'partially_confirmed' | 'contradicted' | 'new_discovery',
			learning
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	// "Como é tratado hoje" (Stage 4A do rework) — mesmo padrão do Mapa de
	// Impacto: cada interação persiste imediatamente, sem redirecionar;
	// ComoETratadoHoje.svelte permanece na mesma tela após cada ação.
	addTreatmentStep: async ({ request, params }) => {
		const formData = await request.formData();
		const whatHappens = formData.get('whatHappens');
		if (typeof whatHappens !== 'string' || whatHappens.trim().length === 0) {
			return fail(400, { message: 'Descreva o que acontece nesse passo.' });
		}

		const result = await getProjectUseCases().addTreatmentStep({
			projectId: params.projectId,
			whatHappens: whatHappens.trim()
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	removeTreatmentStep: async ({ request, params }) => {
		const formData = await request.formData();
		const stepId = formData.get('stepId');
		if (typeof stepId !== 'string' || !stepId) return fail(400, { message: 'Passo inválido.' });

		const result = await getProjectUseCases().removeTreatmentStep({ projectId: params.projectId, stepId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	moveTreatmentStep: async ({ request, params }) => {
		const formData = await request.formData();
		const stepId = formData.get('stepId');
		const direction = formData.get('direction');
		if (typeof stepId !== 'string' || !stepId) return fail(400, { message: 'Passo inválido.' });
		if (direction !== '-1' && direction !== '1') return fail(400, { message: 'Direção inválida.' });

		const result = await getProjectUseCases().moveTreatmentStep({
			projectId: params.projectId,
			stepId,
			direction: direction === '-1' ? -1 : 1
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setTreatmentStepActors: async ({ request, params }) => {
		const formData = await request.formData();
		const stepId = formData.get('stepId');
		if (typeof stepId !== 'string' || !stepId) return fail(400, { message: 'Passo inválido.' });
		const actors = formData.getAll('actor').filter((v): v is string => typeof v === 'string');

		const result = await getProjectUseCases().setTreatmentStepActors({ projectId: params.projectId, stepId, actors });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setTreatmentStepMedium: async ({ request, params }) => {
		const formData = await request.formData();
		const stepId = formData.get('stepId');
		const medium = formData.get('medium');
		if (typeof stepId !== 'string' || !stepId) return fail(400, { message: 'Passo inválido.' });

		const result = await getProjectUseCases().setTreatmentStepMedium({
			projectId: params.projectId,
			stepId,
			medium: typeof medium === 'string' && medium.trim().length > 0 ? medium.trim() : null
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	toggleTreatmentStepFriction: async ({ request, params }) => {
		const formData = await request.formData();
		const stepId = formData.get('stepId');
		const friction = formData.get('friction');
		if (typeof stepId !== 'string' || !stepId) return fail(400, { message: 'Passo inválido.' });
		if (
			typeof friction !== 'string' ||
			!(['espera', 'retrabalho', 'improviso', 'trava'] as const).includes(friction as never)
		) {
			return fail(400, { message: 'Fricção inválida.' });
		}

		const result = await getProjectUseCases().toggleTreatmentStepFriction({
			projectId: params.projectId,
			stepId,
			friction: friction as 'espera' | 'retrabalho' | 'improviso' | 'trava'
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setTreatmentNoTreatment: async ({ request, params }) => {
		const formData = await request.formData();
		const noTreatment = formData.get('noTreatment');
		if (noTreatment !== 'true' && noTreatment !== 'false') {
			return fail(400, { message: 'Valor inválido.' });
		}

		const result = await getProjectUseCases().setTreatmentNoTreatment({
			projectId: params.projectId,
			noTreatment: noTreatment === 'true'
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	confirmTreatment: async ({ params }) => {
		const result = await getProjectUseCases().confirmTreatment({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		// Mesmo padrão de confirmAffectedGroups: a rota canônica de Agora
		// recomputa a atividade recomendada, que já avançou para a próxima da
		// jornada agora que "estado_atual" está concluída.
		redirect(303, `/projects/${params.projectId}/now`);
	},

	// "Entender as causas" (Stage 4B do rework) — mesmo padrão do Mapa de
	// Impacto/Como é tratado hoje: cada interação persiste imediatamente, sem
	// redirecionar; EntenderCausas.svelte permanece na mesma tela após cada
	// ação.
	addCauseHypothesis: async ({ request, params }) => {
		const formData = await request.formData();
		const title = formData.get('title');
		if (typeof title !== 'string' || title.trim().length === 0) {
			return fail(400, { message: 'Descreva a hipótese.' });
		}
		const origin = formData.get('origin');

		const result = await getProjectUseCases().addCauseHypothesis({
			projectId: params.projectId,
			title: title.trim(),
			origin: typeof origin === 'string' && origin.trim().length > 0 ? origin.trim() : null
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setCauseHypothesisTitle: async ({ request, params }) => {
		const formData = await request.formData();
		const hypothesisId = formData.get('hypothesisId');
		const title = formData.get('title');
		if (typeof hypothesisId !== 'string' || !hypothesisId) return fail(400, { message: 'Hipótese inválida.' });
		if (typeof title !== 'string' || title.trim().length === 0) {
			return fail(400, { message: 'Descreva a hipótese.' });
		}

		const result = await getProjectUseCases().setCauseHypothesisTitle({
			projectId: params.projectId,
			hypothesisId,
			title: title.trim()
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setCauseHypothesisExpectedIfTrue: async ({ request, params }) => {
		const formData = await request.formData();
		const hypothesisId = formData.get('hypothesisId');
		const value = formData.get('value');
		if (typeof hypothesisId !== 'string' || !hypothesisId) return fail(400, { message: 'Hipótese inválida.' });

		const result = await getProjectUseCases().setCauseHypothesisExpectedIfTrue({
			projectId: params.projectId,
			hypothesisId,
			value: typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setCauseHypothesisWhatWeakensIt: async ({ request, params }) => {
		const formData = await request.formData();
		const hypothesisId = formData.get('hypothesisId');
		const value = formData.get('value');
		if (typeof hypothesisId !== 'string' || !hypothesisId) return fail(400, { message: 'Hipótese inválida.' });

		const result = await getProjectUseCases().setCauseHypothesisWhatWeakensIt({
			projectId: params.projectId,
			hypothesisId,
			value: typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	toggleCauseHypothesisEvidence: async ({ request, params }) => {
		const formData = await request.formData();
		const hypothesisId = formData.get('hypothesisId');
		const evidenceId = formData.get('evidenceId');
		if (typeof hypothesisId !== 'string' || !hypothesisId) return fail(400, { message: 'Hipótese inválida.' });
		if (typeof evidenceId !== 'string' || !evidenceId) return fail(400, { message: 'Evidência inválida.' });

		const result = await getProjectUseCases().toggleCauseHypothesisEvidence({
			projectId: params.projectId,
			hypothesisId,
			evidenceId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	removeCauseHypothesis: async ({ request, params }) => {
		const formData = await request.formData();
		const hypothesisId = formData.get('hypothesisId');
		if (typeof hypothesisId !== 'string' || !hypothesisId) return fail(400, { message: 'Hipótese inválida.' });

		const result = await getProjectUseCases().removeCauseHypothesis({ projectId: params.projectId, hypothesisId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	markCauseExplorationUnknown: async ({ params }) => {
		const result = await getProjectUseCases().markCauseExplorationUnknown({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	undoCauseExplorationUnknown: async ({ params }) => {
		const result = await getProjectUseCases().undoCauseExplorationUnknown({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	confirmCauseHypotheses: async ({ params }) => {
		const result = await getProjectUseCases().confirmCauseHypotheses({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		// Mesmo padrão de confirmAffectedGroups/confirmTreatment: a rota
		// canônica de Agora recomputa a atividade recomendada, que já avançou
		// para a próxima da jornada agora que "entender_causas" está concluída.
		redirect(303, `/projects/${params.projectId}/now`);
	},

	// "Resultado desejado" (Stage 4C do rework) — mesmo padrão do Mapa de
	// Impacto/Como é tratado hoje/Entender as causas: cada interação persiste
	// imediatamente, sem redirecionar; ResultadoDesejado.svelte permanece na
	// mesma tela após cada ação.
	addDesiredOutcome: async ({ request, params }) => {
		const formData = await request.formData();
		const change = formData.get('change');
		if (typeof change !== 'string' || change.trim().length === 0) {
			return fail(400, { message: 'Descreva a mudança esperada.' });
		}

		const result = await getProjectUseCases().addDesiredOutcome({
			projectId: params.projectId,
			change: change.trim()
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setDesiredOutcomeChange: async ({ request, params }) => {
		const formData = await request.formData();
		const outcomeId = formData.get('outcomeId');
		const change = formData.get('change');
		if (typeof outcomeId !== 'string' || !outcomeId) return fail(400, { message: 'Resultado inválido.' });
		if (typeof change !== 'string' || change.trim().length === 0) {
			return fail(400, { message: 'Descreva a mudança esperada.' });
		}

		const result = await getProjectUseCases().setDesiredOutcomeChange({
			projectId: params.projectId,
			outcomeId,
			change: change.trim()
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setDesiredOutcomeTarget: async ({ request, params }) => {
		const formData = await request.formData();
		const outcomeId = formData.get('outcomeId');
		const target = formData.get('target');
		if (typeof outcomeId !== 'string' || !outcomeId) return fail(400, { message: 'Resultado inválido.' });

		const result = await getProjectUseCases().setDesiredOutcomeTarget({
			projectId: params.projectId,
			outcomeId,
			target: typeof target === 'string' && target.trim().length > 0 ? target.trim() : null
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	removeDesiredOutcome: async ({ request, params }) => {
		const formData = await request.formData();
		const outcomeId = formData.get('outcomeId');
		if (typeof outcomeId !== 'string' || !outcomeId) return fail(400, { message: 'Resultado inválido.' });

		const result = await getProjectUseCases().removeDesiredOutcome({ projectId: params.projectId, outcomeId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	moveDesiredOutcome: async ({ request, params }) => {
		const formData = await request.formData();
		const outcomeId = formData.get('outcomeId');
		const direction = formData.get('direction');
		if (typeof outcomeId !== 'string' || !outcomeId) return fail(400, { message: 'Resultado inválido.' });
		if (direction !== '-1' && direction !== '1') return fail(400, { message: 'Direção inválida.' });

		const result = await getProjectUseCases().moveDesiredOutcome({
			projectId: params.projectId,
			outcomeId,
			direction: direction === '-1' ? -1 : 1
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	confirmDesiredOutcomes: async ({ params }) => {
		const result = await getProjectUseCases().confirmDesiredOutcomes({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		// Mesmo padrão de confirmAffectedGroups/confirmTreatment/
		// confirmCauseHypotheses: a rota canônica de Agora recomputa a
		// atividade recomendada, que já avançou para a próxima da jornada
		// agora que "resultado" está concluída.
		redirect(303, `/projects/${params.projectId}/now`);
	}
};
