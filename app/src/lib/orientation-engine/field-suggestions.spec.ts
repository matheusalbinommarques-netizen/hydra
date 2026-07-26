import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import type { Answer } from '$lib/domain';
import { computeFieldSuggestions } from './field-suggestions';

const T1 = '2026-01-01T00:00:00.000Z';

function answer(overrides: Partial<Answer> & Pick<Answer, 'activityDefinitionId' | 'fieldDefinitionId' | 'value'>): Answer {
	return {
		projectId: 'proj-1',
		createdAt: T1,
		updatedAt: T1,
		...overrides
	};
}

describe('computeFieldSuggestions', () => {
	it('sem nenhuma Answer: nenhuma sugestão', () => {
		expect(computeFieldSuggestions(catalog, [])).toEqual([]);
	});

	it('publico_detail respondido gera sugestão para beneficiario e usuario_principal', () => {
		const answers = [
			answer({ activityDefinitionId: 'publico', fieldDefinitionId: 'publico_detail', value: 'Agentes de atendimento' })
		];

		const suggestions = computeFieldSuggestions(catalog, answers);
		const fieldIds = suggestions.map((s) => s.fieldId).sort();
		expect(fieldIds).toEqual(['beneficiario', 'usuario_principal']);

		const beneficiario = suggestions.find((s) => s.fieldId === 'beneficiario')!;
		expect(beneficiario.sourceValue).toBe('Agentes de atendimento');
		expect(beneficiario.sourceActivityTitle).toBe('Público afetado');
		expect(beneficiario.helpText.length).toBeGreaterThan(0);

		const usuarioPrincipal = suggestions.find((s) => s.fieldId === 'usuario_principal')!;
		expect(usuarioPrincipal.sourceValue).toBe('Agentes de atendimento');
		expect(usuarioPrincipal.sourceActivityTitle).toBe('Público afetado');
	});

	it('origem inexistente (nenhuma Answer para publico_detail): nenhuma sugestão', () => {
		expect(computeFieldSuggestions(catalog, [])).toEqual([]);
	});

	it('origem vazia (Answer existe mas valor é string vazia): nenhuma sugestão', () => {
		const answers = [answer({ activityDefinitionId: 'publico', fieldDefinitionId: 'publico_detail', value: '   ' })];
		expect(computeFieldSuggestions(catalog, answers)).toEqual([]);
	});

	it('destino já respondido (beneficiario tem Answer própria): sugestão não aparece para esse campo', () => {
		const answers = [
			answer({ activityDefinitionId: 'publico', fieldDefinitionId: 'publico_detail', value: 'Agentes de atendimento' }),
			answer({ activityDefinitionId: 'resultado', fieldDefinitionId: 'beneficiario', value: 'Clientes finais' })
		];

		const suggestions = computeFieldSuggestions(catalog, answers);
		expect(suggestions.map((s) => s.fieldId)).toEqual(['usuario_principal']);
	});

	it('destino com Answer em branco (string vazia) ainda é considerado "não respondido"', () => {
		const answers = [
			answer({ activityDefinitionId: 'publico', fieldDefinitionId: 'publico_detail', value: 'Agentes de atendimento' }),
			answer({ activityDefinitionId: 'resultado', fieldDefinitionId: 'beneficiario', value: '' })
		];

		const suggestions = computeFieldSuggestions(catalog, answers);
		expect(suggestions.map((s) => s.fieldId).sort()).toEqual(['beneficiario', 'usuario_principal']);
	});

	it('não sugere nada para campos sem suggestedSource configurado', () => {
		const answers = [answer({ activityDefinitionId: 'problema', fieldDefinitionId: 'situacao', value: 'Algo' })];
		expect(computeFieldSuggestions(catalog, answers)).toEqual([]);
	});
});
