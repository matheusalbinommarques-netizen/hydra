// Projeção pura de leitura para a Tela Registros — cruza catalog/ (estático)
// com os campos já expostos por ProjectView (respostas e histórico de
// pendências). Não lê nem grava persistência, não conhece ProjectState bruto.

import type { ActivityDefinition, Catalog } from '$lib/domain';

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
	answers: Record<string, string>;
	pendingItemHistory: RecordsPendingItemInput[];
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
}

export interface RecordsPhaseAnswersView {
	phaseId: string;
	phaseLabel: string;
	activities: RecordsActivityAnswersView[];
}

export interface RecordsPendingItemView {
	id: string;
	activityTitle: string;
	label: string;
	detail: string;
	status: 'aberta' | 'resolvida';
	createdAt: string;
	resolvedAt?: string;
}

export interface RecordsView {
	phases: RecordsPhaseAnswersView[];
	openPendingItems: RecordsPendingItemView[];
	resolvedPendingItems: RecordsPendingItemView[];
}

function findActivityDefinition(catalog: Catalog, activityDefinitionId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityDefinitionId);
		if (found) return found;
	}
	return undefined;
}

function buildPendingItemView(catalog: Catalog, item: RecordsPendingItemInput): RecordsPendingItemView {
	const activity = findActivityDefinition(catalog, item.activityDefinitionId);
	return {
		id: item.id,
		activityTitle: activity?.title ?? item.activityDefinitionId,
		label: item.label,
		detail: item.detail,
		status: item.status,
		createdAt: item.createdAt,
		resolvedAt: item.resolvedAt
	};
}

export function buildRecordsView(catalog: Catalog, input: RecordsViewInput): RecordsView {
	const phases: RecordsPhaseAnswersView[] = [];

	for (const phase of catalog.phases) {
		const activities: RecordsActivityAnswersView[] = [];

		for (const activity of phase.activities) {
			if (activity.completionMode !== 'required_fields') continue;

			const fields: RecordsAnswerFieldView[] = activity.fields
				.filter((field) => field.dataTarget === 'answer' && input.answers[field.id])
				.map((field) => ({ id: field.id, label: field.label, value: input.answers[field.id] }));

			if (fields.length > 0) {
				activities.push({ activityId: activity.id, title: activity.title, fields });
			}
		}

		if (activities.length > 0) {
			phases.push({ phaseId: phase.id, phaseLabel: phase.label, activities });
		}
	}

	const openPendingItems = input.pendingItemHistory
		.filter((item) => item.status === 'aberta')
		.map((item) => buildPendingItemView(catalog, item));

	const resolvedPendingItems = input.pendingItemHistory
		.filter((item) => item.status === 'resolvida')
		.map((item) => buildPendingItemView(catalog, item));

	return { phases, openPendingItems, resolvedPendingItems };
}
