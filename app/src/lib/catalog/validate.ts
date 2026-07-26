// Checagem estrutural do catálogo estático — uso exclusivo de testes (C2-05).
// Não verifica ActivityProgress nem qualquer estado de projeto — isso é
// responsabilidade da fábrica de estado (C2-06).

import type { ActivityDefinition, Catalog, CatalogStatus, FieldDefinition } from '$lib/domain';

const TEXT_FIELD_TYPES = new Set(['texto_curto', 'texto_longo']);

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
	// Coletados durante o percurso principal para validar `suggestedSource`
	// numa segunda passagem, independente da ordem de declaração das
	// atividades/campos no catálogo.
	const activityById = new Map<string, ActivityDefinition>();
	const fieldById = new Map<string, FieldDefinition>();

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
			activityById.set(activity.id, activity);

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

			if (activity.completionMode === 'explicit_confirmation' || activity.completionMode === 'scope_confirmation') {
				const mode = activity.completionMode;
				if ('fields' in record && record.fields !== undefined) {
					violations.push(`Atividade "${activity.id}" é ${mode} mas possui fields`);
				}
				if ('pendingItemLabel' in record && record.pendingItemLabel !== undefined) {
					violations.push(`Atividade "${activity.id}" é ${mode} mas possui pendingItemLabel`);
				}
				if ('pendingItemDetail' in record && record.pendingItemDetail !== undefined) {
					violations.push(`Atividade "${activity.id}" é ${mode} mas possui pendingItemDetail`);
				}
				if (record.allowsSkip !== false) {
					violations.push(`Atividade "${activity.id}" é ${mode} mas allowsSkip não é false`);
				}
				continue;
			}

			// required_fields: valida cada FieldDefinition.
			const optionalGroupLabelById = new Map<string, string>();

			for (const field of activity.fields) {
				if (fieldIds.has(field.id)) {
					violations.push(`Campo duplicado: id "${field.id}"`);
				}
				fieldIds.add(field.id);
				fieldById.set(field.id, field);

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

					const isChoiceType = field.type === 'selecao' || field.type === 'selecao_multipla';
					if (!isChoiceType && 'options' in fieldRecord && fieldRecord.options !== undefined) {
						violations.push(`Campo "${field.id}" não é selecao/selecao_multipla mas possui options`);
					}
					if (isChoiceType && (!('options' in fieldRecord) || fieldRecord.options === undefined)) {
						violations.push(`Campo "${field.id}" é ${field.type} mas não possui options`);
					}
					if (field.type === 'selecao_multipla') {
						const seenOptionIds = new Set<string>();
						for (const option of field.options) {
							if (seenOptionIds.has(option.id)) {
								violations.push(`Campo "${field.id}" tem option.id duplicado: "${option.id}"`);
							}
							seenOptionIds.add(option.id);
						}
					}

					if (field.optionalGroup) {
						const existingLabel = optionalGroupLabelById.get(field.optionalGroup.id);
						if (existingLabel === undefined) {
							optionalGroupLabelById.set(field.optionalGroup.id, field.optionalGroup.label);
						} else if (existingLabel !== field.optionalGroup.label) {
							violations.push(
								`Campo "${field.id}" usa optionalGroup.id "${field.optionalGroup.id}" com label "${field.optionalGroup.label}", diferente do label já usado por outro campo do mesmo grupo ("${existingLabel}")`
							);
						}
					}
				}
			}
		}
	}

	// Segunda passagem: valida suggestedSource com os mapas completos
	// (activityById/fieldById), sem depender da ordem de declaração.
	for (const phase of catalog.phases) {
		for (const activity of phase.activities) {
			if (activity.completionMode !== 'required_fields') continue;

			for (const field of activity.fields) {
				if (field.dataTarget !== 'answer' || !field.suggestedSource) continue;
				const { activityId: sourceActivityId, fieldId: sourceFieldId } = field.suggestedSource;

				if (sourceActivityId === activity.id && sourceFieldId === field.id) {
					violations.push(`Campo "${field.id}" tem suggestedSource apontando para si mesmo`);
					continue;
				}

				const sourceActivity = activityById.get(sourceActivityId);
				if (!sourceActivity) {
					violations.push(
						`Campo "${field.id}" tem suggestedSource.activityId "${sourceActivityId}", que não existe no catálogo`
					);
					continue;
				}

				const sourceField = fieldById.get(sourceFieldId);
				if (!sourceField || sourceField.activityId !== sourceActivityId) {
					violations.push(
						`Campo "${field.id}" tem suggestedSource.fieldId "${sourceFieldId}", que não existe na atividade "${sourceActivityId}"`
					);
					continue;
				}

				if (sourceField.dataTarget !== 'answer') {
					violations.push(
						`Campo "${field.id}" tem suggestedSource apontando para "${sourceFieldId}", que não é um campo de resposta (dataTarget answer)`
					);
					continue;
				}

				if (!TEXT_FIELD_TYPES.has(sourceField.type) || !TEXT_FIELD_TYPES.has(field.type)) {
					violations.push(
						`Campo "${field.id}" tem suggestedSource incompatível: origem e destino precisam ser ambos texto_curto/texto_longo`
					);
				}
			}
		}
	}

	return violations;
}
