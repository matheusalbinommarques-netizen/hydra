// Helpers internos de busca no catálogo — uso exclusivo deste módulo.
// Não exportado via index.ts.

import type { ActivityDefinition, Catalog, FieldDefinition } from '$lib/domain';

export function findActivityDefinition(catalog: Catalog, activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

export function findFieldDefinition(
	catalog: Catalog,
	activityId: string,
	fieldId: string
): FieldDefinition | undefined {
	const activity = findActivityDefinition(catalog, activityId);
	if (!activity || activity.completionMode !== 'required_fields') return undefined;
	return activity.fields.find((field) => field.id === fieldId);
}
