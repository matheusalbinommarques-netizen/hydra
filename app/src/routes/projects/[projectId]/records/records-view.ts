// Projeção pura de leitura para a Tela Registros — cruza catalog/ (estático)
// com os campos já expostos por ProjectView (respostas, histórico de
// pendências resolvidas e status de atividade). Não lê nem grava
// persistência, não conhece ProjectState bruto.
//
// Pendências abertas não fazem parte deste contrato: já pertencem a
// Acompanhamento (síntese de atenções, tracking-view.ts) e a Agora (ponto de
// resolução) — mostrá-las aqui duplicaria o mesmo dado sob outro nome
// (auditoria de sustentação semântica das categorias do mockup, etapa 7.4).

import { decodeMultiSelectValue, decodePlanningItems } from '$lib/domain';
import type { ActivityDefinition, ActivityStatus, Catalog } from '$lib/domain';

export interface RecordsPendingItemInput {
	id: string;
	activityDefinitionId: string;
	label: string;
	detail: string;
	status: 'aberta' | 'resolvida';
	createdAt: string;
	resolvedAt?: string;
}

export interface RecordsViewInput {
	projectId: string;
	answers: Record<string, string>;
	pendingItemHistory: RecordsPendingItemInput[];
	activityStatuses: Record<string, ActivityStatus>;
}

export interface RecordsAnswerFieldView {
	id: string;
	label: string;
	value: string;
}

export interface RecordsActivityAnswersView {
	activityId: string;
	title: string;
	fields: RecordsAnswerFieldView[];
	// Destino completo de edição, ou null quando não há um real. A
	// apresentação só decide se renderiza o link — não monta rota, não conhece
	// a regra de editabilidade. Ver buildEditHref() para a regra e a
	// justificativa do parâmetro `from`.
	editHref: string | null;
}

export interface RecordsPhaseAnswersView {
	phaseId: string;
	phaseLabel: string;
	answerCount: number;
	activities: RecordsActivityAnswersView[];
}

export interface RecordsResolvedPendingItemView {
	id: string;
	activityTitle: string;
	label: string;
	detail: string;
}

export interface RecordsView {
	phases: RecordsPhaseAnswersView[];
	resolvedPendingItems: RecordsResolvedPendingItemView[];
}

const EDITABLE_PHASE_ID = 'descoberta';
// Exceção nominal fora da Descoberta (C5-01) — mesma exceção e mesmo
// comentário de now/+page.server.ts (REVIEWABLE_ACTIVITY_IDS_OUTSIDE_DESCOBERTA):
// a próxima exceção fora desta lista deve provocar generalização da regra,
// não a adição de outro id aqui.
const EDITABLE_ACTIVITY_IDS_OUTSIDE_PHASE = new Set(['decompor_trabalho']);

function findActivityDefinition(catalog: Catalog, activityDefinitionId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityDefinitionId);
		if (found) return found;
	}
	return undefined;
}

// Único mecanismo de edição pós-conclusão que existe hoje é
// now/+page.server.ts (findDescobertaConcluidaActivity), restrito a
// atividades required_fields já concluídas da própria Descoberta — mesma
// restrição que document-view.ts já aplica (EDITABLE_PHASE_ID). Não amplia
// para outras fases: fora da Descoberta não existe destino real.
//
// `from=records` é reconhecido por now/+page.server.ts (ReviewOrigin =
// 'summary' | 'records') como origem de revisão própria de Registros — texto,
// botão e retorno pós-salvamento específicos de Registros, distintos dos de
// `from=summary` (usado pelo Resumo). Não é o mesmo mecanismo do Documento
// (que usa `from=summary`, sem retorno próprio): Registros tem sua própria
// origem, com seu próprio destino de retorno.
function buildEditHref(
	projectId: string,
	phaseId: string,
	activityId: string,
	activityStatuses: Record<string, ActivityStatus>
): string | null {
	if (phaseId !== EDITABLE_PHASE_ID && !EDITABLE_ACTIVITY_IDS_OUTSIDE_PHASE.has(activityId)) return null;
	if (activityStatuses[activityId] !== 'concluída') return null;
	return `/projects/${projectId}/now?activity=${activityId}&from=records`;
}

export function buildRecordsView(catalog: Catalog, input: RecordsViewInput): RecordsView {
	const phases: RecordsPhaseAnswersView[] = [];

	for (const phase of catalog.phases) {
		const activities: RecordsActivityAnswersView[] = [];

		for (const activity of phase.activities) {
			if (activity.completionMode !== 'required_fields') continue;

			const fields: RecordsAnswerFieldView[] = activity.fields
				.filter((field) => field.dataTarget === 'answer' && input.answers[field.id])
				.map((field) => {
					if (field.dataTarget === 'answer' && field.type === 'selecao_multipla') {
						const selectedIds = decodeMultiSelectValue(input.answers[field.id]) ?? [];
						const labelById = new Map(field.options.map((option) => [option.id, option.label]));
						return {
							id: field.id,
							label: field.label,
							value: selectedIds.map((id) => labelById.get(id) ?? id).join(', ')
						};
					}
					if (field.dataTarget === 'answer' && field.type === 'lista_partes') {
						// PlanningItem[] (C5-01) — conteúdo humano, nunca a
						// serialização interna: lista numerada na ordem atual (que é a
						// própria prioridade, se já reordenada em "Priorizar entregas").
						const items = decodePlanningItems(input.answers[field.id]);
						return {
							id: field.id,
							label: field.label,
							value: items.map((item, index) => `${index + 1}. ${item.text}`).join('; ')
						};
					}
					return { id: field.id, label: field.label, value: input.answers[field.id] };
				});

			if (fields.length > 0) {
				activities.push({
					activityId: activity.id,
					title: activity.title,
					fields,
					editHref: buildEditHref(input.projectId, phase.id, activity.id, input.activityStatuses)
				});
			}
		}

		if (activities.length > 0) {
			const answerCount = activities.reduce((total, activity) => total + activity.fields.length, 0);
			phases.push({ phaseId: phase.id, phaseLabel: phase.label, answerCount, activities });
		}
	}

	const resolvedPendingItems: RecordsResolvedPendingItemView[] = input.pendingItemHistory
		.filter((item) => item.status === 'resolvida')
		.map((item) => {
			const activity = findActivityDefinition(catalog, item.activityDefinitionId);
			return {
				id: item.id,
				activityTitle: activity?.title ?? item.activityDefinitionId,
				label: item.label,
				detail: item.detail
			};
		});

	return { phases, resolvedPendingItems };
}
