// Projeção pura de leitura para a visão geral do Resumo da descoberta — cruza
// catalog/ (estático) com os campos já expostos por ProjectView (answers,
// activityStatuses). Não lê nem grava persistência, não gera prosa nova:
// seleciona e organiza respostas já existentes (Answer canônica de cada
// campo), nunca interpreta ou reescreve o texto do usuário.

import { decodeMultiSelectValue } from '$lib/domain';
import type { ActivityStatus, Catalog } from '$lib/domain';
import type { PendingItemView } from '$lib/orientation-engine';
import { summarizeAffectedGroups } from '$lib/catalog/affected-group';
import type { AffectedGroupSummaryInput } from '$lib/catalog/affected-group';
import { summarizeAffectedGroupEvidences } from '$lib/catalog/external-action';
import { summarizeCurrentTreatment, treatmentStepCountLabel } from '$lib/catalog/current-treatment';
import type { TreatmentStepSynthesisInput } from '$lib/catalog/current-treatment';
import { causeHypothesisCountLabel } from '$lib/catalog/cause-hypothesis';

export interface DiscoveryOverviewBlock {
	activityId: string;
	heading: string;
	editLabel: string;
	value: string;
	chips?: string[];
}

export interface DiscoveryChecklistItem {
	label: string;
	complete: boolean;
}

export interface DiscoverySummaryView {
	overview: DiscoveryOverviewBlock[];
	checklist: DiscoveryChecklistItem[];
	// Abre "Ver todas as respostas da descoberta" por padrão quando alguma das
	// seis atividades da Descoberta ainda não está concluída — nunca uma regra
	// nova de completude, só reaproveita ActivityStatus já calculado.
	detailsOpenByDefault: boolean;
}

const DISCOVERY_REQUIRED_FIELDS_ACTIVITY_IDS = [
	'origem',
	'problema',
	'publico',
	'estado_atual',
	'entender_causas',
	'resultado'
];

function decodeMultiSelectLabels(catalog: Catalog, activityId: string, fieldId: string, encodedValue: string): string[] {
	for (const phase of catalog.phases) {
		const activity = phase.activities.find((a) => a.id === activityId);
		if (!activity || activity.completionMode !== 'required_fields') continue;
		const field = activity.fields.find((f) => f.id === fieldId);
		if (!field || field.dataTarget !== 'answer' || field.type !== 'selecao_multipla') continue;
		const selectedIds = decodeMultiSelectValue(encodedValue) ?? [];
		const labelById = new Map(field.options.map((option) => [option.id, option.label]));
		return selectedIds.map((id) => labelById.get(id) ?? id);
	}
	return [];
}

export function buildDiscoverySummaryView(
	catalog: Catalog,
	answers: Record<string, string>,
	activityStatuses: Record<string, ActivityStatus>,
	affectedGroups: AffectedGroupSummaryInput[] = [],
	evidences: readonly { affectedGroupId: string }[] = [],
	currentTreatment: { noTreatment: boolean } = { noTreatment: false },
	treatmentSteps: TreatmentStepSynthesisInput[] = [],
	causeExploration: { stillUnknown: boolean } = { stillUnknown: false },
	causeHypotheses: readonly { title: string }[] = []
): DiscoverySummaryView {
	const overview: DiscoveryOverviewBlock[] = [];

	const situacao = answers['situacao'];
	if (situacao) {
		const oQueValue = answers['situacao_o_que'];
		overview.push({
			activityId: 'problema',
			heading: 'Situação',
			editLabel: 'Editar situação',
			value: situacao,
			chips: oQueValue ? decodeMultiSelectLabels(catalog, 'problema', 'situacao_o_que', oQueValue) : undefined
		});
	}

	if (affectedGroups.length > 0) {
		// Evidência (ETAPA 3 do rework) — síntese curta anexada ao mesmo bloco,
		// sem redigitação e sem despejar a preparação/resultado inteiros (ver
		// HYDRA_PRODUCT_REWORK.md §33, "Resumo da descoberta").
		const evidenceCounts = new Map<string, number>();
		for (const evidence of evidences) {
			evidenceCounts.set(evidence.affectedGroupId, (evidenceCounts.get(evidence.affectedGroupId) ?? 0) + 1);
		}
		const evidenceSummary = summarizeAffectedGroupEvidences(
			affectedGroups.map((group) => ({ label: group.label, count: evidenceCounts.get(group.id) ?? 0 }))
		);
		overview.push({
			activityId: 'publico',
			heading: 'Quem é afetado',
			editLabel: 'Editar quem é afetado',
			value: evidenceSummary ? `${summarizeAffectedGroups(affectedGroups)} ${evidenceSummary}` : summarizeAffectedGroups(affectedGroups),
			chips: affectedGroups.map((group) => group.label)
		});
	}

	if (currentTreatment.noTreatment || treatmentSteps.length > 0) {
		overview.push({
			activityId: 'estado_atual',
			heading: 'Como é tratado hoje',
			editLabel: 'Editar como é tratado hoje',
			value: `${treatmentStepCountLabel(currentTreatment.noTreatment, treatmentSteps.length)}. ${summarizeCurrentTreatment(currentTreatment.noTreatment, treatmentSteps)}`.trim()
		});
	}

	if (causeExploration.stillUnknown || causeHypotheses.length > 0) {
		overview.push({
			activityId: 'entender_causas',
			heading: 'Hipóteses de causa',
			editLabel: 'Editar hipóteses de causa',
			value: causeHypothesisCountLabel(causeExploration.stillUnknown, causeHypotheses.length),
			chips: causeHypotheses.length > 0 ? causeHypotheses.map((hypothesis) => hypothesis.title) : undefined
		});
	}

	const mudanca = answers['mudanca'];
	if (mudanca) {
		overview.push({
			activityId: 'resultado',
			heading: 'Resultado desejado',
			editLabel: 'Editar resultado',
			value: mudanca
		});
	}

	const checklist: DiscoveryChecklistItem[] = [
		{ label: 'Problema definido', complete: activityStatuses['problema'] === 'concluída' },
		{ label: 'Público definido', complete: activityStatuses['publico'] === 'concluída' },
		{ label: 'Como é tratado hoje definido', complete: activityStatuses['estado_atual'] === 'concluída' },
		{ label: 'Causas exploradas', complete: activityStatuses['entender_causas'] === 'concluída' },
		{ label: 'Resultado definido', complete: activityStatuses['resultado'] === 'concluída' }
	];

	const detailsOpenByDefault = DISCOVERY_REQUIRED_FIELDS_ACTIVITY_IDS.some(
		(activityId) => activityStatuses[activityId] !== 'concluída'
	);

	return { overview, checklist, detailsOpenByDefault };
}

// Filtra as pendências abertas do projeto para as que pertencem às
// atividades da fase Descoberta — sem entidade nova, só cruza
// openPendingItems (já computado por ProjectView) com o catálogo estático.
export function filterDiscoveryOpenPendingItems(
	catalog: Catalog,
	openPendingItems: PendingItemView[]
): PendingItemView[] {
	const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
	const discoveryActivityIds = new Set((descoberta?.activities ?? []).map((activity) => activity.id));
	return openPendingItems.filter((item) => discoveryActivityIds.has(item.activityDefinitionId));
}
