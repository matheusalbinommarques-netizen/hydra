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

const DISCOVERY_REQUIRED_FIELDS_ACTIVITY_IDS = ['origem', 'problema', 'publico', 'estado_atual', 'resultado'];

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
	affectedGroups: AffectedGroupSummaryInput[] = []
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
		overview.push({
			activityId: 'publico',
			heading: 'Quem é afetado',
			editLabel: 'Editar quem é afetado',
			value: summarizeAffectedGroups(affectedGroups),
			chips: affectedGroups.map((group) => group.label)
		});
	}

	const estadoAtualDetail = answers['estado_atual_detail'];
	if (estadoAtualDetail) {
		overview.push({
			activityId: 'estado_atual',
			heading: 'Estado atual',
			editLabel: 'Editar estado atual',
			value: estadoAtualDetail
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
		{ label: 'Estado atual definido', complete: activityStatuses['estado_atual'] === 'concluída' },
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
