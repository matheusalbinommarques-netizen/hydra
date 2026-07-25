// Checagem estrutural do catálogo estático — uso exclusivo de testes (C2-05).
// Não verifica ActivityProgress nem qualquer estado de projeto — isso é
// responsabilidade da fábrica de estado (C2-06).

import type { Catalog, CatalogStatus } from '$lib/domain';

const EXPECTED_CATALOG_STATUS: Record<string, CatalogStatus> = {
	descoberta: 'complete',
	definicao: 'complete',
	estruturacao: 'complete',
	planejamento: 'complete',
	execucao: 'complete',
	validacao: 'complete'
};

/** Retorna a lista de violações encontradas; catálogo válido = array vazio. */
export function validateCatalog(catalog: Catalog): string[] {
	const violations: string[] = [];

	const phaseIds = new Set<string>();
	const phaseOrders = new Set<number>();
	const activityIds = new Set<string>();
	const fieldIds = new Set<string>();

	for (const phase of catalog.phases) {
		if (phaseIds.has(phase.id)) {
			violations.push(`Fase duplicada: id "${phase.id}"`);
		}
		phaseIds.add(phase.id);

		if (phaseOrders.has(phase.order)) {
			violations.push(`Ordem de fase duplicada: ${phase.order} (fase "${phase.id}")`);
		}
		phaseOrders.add(phase.order);

		const expectedStatus = EXPECTED_CATALOG_STATUS[phase.id];
		if (expectedStatus === undefined) {
			violations.push(`Fase "${phase.id}" não tem catalogStatus esperado registrado na checagem`);
		} else if (phase.catalogStatus !== expectedStatus) {
			violations.push(
				`Fase "${phase.id}" tem catalogStatus "${phase.catalogStatus}", esperado "${expectedStatus}"`
			);
		}

		const activityOrders = new Set<number>();

		for (const activity of phase.activities) {
			if (activityIds.has(activity.id)) {
				violations.push(`Atividade duplicada: id "${activity.id}"`);
			}
			activityIds.add(activity.id);

			if (activity.phaseId !== phase.id) {
				violations.push(
					`Atividade "${activity.id}" referencia phaseId "${activity.phaseId}", mas está aninhada em "${phase.id}"`
				);
			}

			if (activityOrders.has(activity.order)) {
				violations.push(`Ordem de atividade duplicada: ${activity.order} na fase "${phase.id}"`);
			}
			activityOrders.add(activity.order);

			const record = activity as unknown as Record<string, unknown>;

			if (activity.completionMode === 'explicit_confirmation') {
				if ('fields' in record && record.fields !== undefined) {
					violations.push(`Atividade "${activity.id}" é explicit_confirmation mas possui fields`);
				}
				if ('pendingItemLabel' in record && record.pendingItemLabel !== undefined) {
					violations.push(`Atividade "${activity.id}" é explicit_confirmation mas possui pendingItemLabel`);
				}
				if ('pendingItemDetail' in record && record.pendingItemDetail !== undefined) {
					violations.push(`Atividade "${activity.id}" é explicit_confirmation mas possui pendingItemDetail`);
				}
				if (record.allowsSkip !== false) {
					violations.push(`Atividade "${activity.id}" é explicit_confirmation mas allowsSkip não é false`);
				}
				continue;
			}

			// required_fields: valida cada FieldDefinition.
			for (const field of activity.fields) {
				if (fieldIds.has(field.id)) {
					violations.push(`Campo duplicado: id "${field.id}"`);
				}
				fieldIds.add(field.id);

				if (field.activityId !== activity.id) {
					violations.push(
						`Campo "${field.id}" referencia activityId "${field.activityId}", mas está na atividade "${activity.id}"`
					);
				}

				const fieldRecord = field as unknown as Record<string, unknown>;

				if (field.dataTarget === 'project_property') {
					if (fieldRecord.projectProperty !== 'name') {
						violations.push(
							`Campo "${field.id}" tem dataTarget project_property mas projectProperty não é "name"`
						);
					}
					if ('semanticRole' in fieldRecord && fieldRecord.semanticRole !== undefined) {
						violations.push(`Campo "${field.id}" é project_property mas possui semanticRole`);
					}
				} else {
					// dataTarget === 'answer'
					if ('projectProperty' in fieldRecord && fieldRecord.projectProperty !== undefined) {
						violations.push(`Campo "${field.id}" é answer mas possui projectProperty`);
					}
					if (field.type !== 'selecao' && 'options' in fieldRecord && fieldRecord.options !== undefined) {
						violations.push(`Campo "${field.id}" não é selecao mas possui options`);
					}
					if (field.type === 'selecao' && (!('options' in fieldRecord) || fieldRecord.options === undefined)) {
						violations.push(`Campo "${field.id}" é selecao mas não possui options`);
					}
				}
			}
		}
	}

	return violations;
}
