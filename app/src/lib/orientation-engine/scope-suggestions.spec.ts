import { describe, expect, it } from 'vitest';
import { encodeMultiSelectValue } from '$lib/domain';
import type { Answer, ScopeItem } from '$lib/domain';
import { computeScopeSuggestions } from './scope-suggestions';

const T1 = '2026-01-01T00:00:00.000Z';

function signalsAnswer(ids: string[]): Answer {
	return {
		projectId: 'proj-1',
		activityDefinitionId: 'problema',
		fieldDefinitionId: 'sinais_situacao',
		value: encodeMultiSelectValue(ids),
		createdAt: T1,
		updatedAt: T1
	};
}

function scopeItem(overrides: Partial<ScopeItem> & Pick<ScopeItem, 'id'>): ScopeItem {
	return {
		id: overrides.id,
		projectId: 'proj-1',
		text: overrides.text ?? 'Item',
		bucket: overrides.bucket ?? 'agora',
		effort: overrides.effort ?? null,
		order: overrides.order ?? 0,
		sourceSuggestionId: overrides.sourceSuggestionId ?? null,
		createdAt: T1,
		updatedAt: T1
	};
}

describe('computeScopeSuggestions', () => {
	it('sem Answer de sinais: nenhuma sugestão', () => {
		expect(computeScopeSuggestions([], [])).toEqual([]);
	});

	it('duplicated_information gera a sugestão "reuse_existing_information" com o motivo correto', () => {
		const suggestions = computeScopeSuggestions([signalsAnswer(['duplicated_information'])], []);
		expect(suggestions).toEqual([
			{
				id: 'reuse_existing_information',
				title: 'Reaproveitar informações já registradas',
				reason: 'Sugerido porque você indicou informação duplicada.'
			}
		]);
	});

	it('too_many_steps gera a sugestão "combine_redundant_steps" com o motivo correto', () => {
		const suggestions = computeScopeSuggestions([signalsAnswer(['too_many_steps'])], []);
		expect(suggestions).toEqual([
			{
				id: 'combine_redundant_steps',
				title: 'Reduzir ou combinar etapas redundantes',
				reason: 'Sugerido porque você indicou excesso de etapas.'
			}
		]);
	});

	it('ambos os sinais geram as duas sugestões', () => {
		const suggestions = computeScopeSuggestions(
			[signalsAnswer(['duplicated_information', 'too_many_steps'])],
			[]
		);
		expect(suggestions.map((s) => s.id)).toEqual(['reuse_existing_information', 'combine_redundant_steps']);
	});

	it('rework gera a sugestão "investigate_rework_cause" com o motivo correto', () => {
		const suggestions = computeScopeSuggestions([signalsAnswer(['rework'])], []);
		expect(suggestions).toEqual([
			{
				id: 'investigate_rework_cause',
				title: 'Investigar a causa raiz do retrabalho',
				reason: 'Sugerido porque você indicou retrabalho.'
			}
		]);
	});

	it('outros sinais não implementados não geram sugestão nenhuma', () => {
		const suggestions = computeScopeSuggestions(
			[signalsAnswer(['lack_of_clarity', 'dispersed_decisions', 'insufficient_tracking', 'other'])],
			[]
		);
		expect(suggestions).toEqual([]);
	});

	it('os três sinais implementados juntos geram as três sugestões, na ordem dos ids do catálogo', () => {
		const suggestions = computeScopeSuggestions(
			[signalsAnswer(['duplicated_information', 'too_many_steps', 'rework'])],
			[]
		);
		expect(suggestions.map((s) => s.id)).toEqual([
			'reuse_existing_information',
			'combine_redundant_steps',
			'investigate_rework_cause'
		]);
	});

	it('sugestão não aceita (nenhum ScopeItem com o sourceSuggestionId) continua aparecendo', () => {
		const suggestions = computeScopeSuggestions(
			[signalsAnswer(['duplicated_information'])],
			[scopeItem({ id: 'item-1', sourceSuggestionId: null })]
		);
		expect(suggestions).toHaveLength(1);
	});

	it('sugestão já aceita (existe ScopeItem com o mesmo sourceSuggestionId) deixa de aparecer', () => {
		const suggestions = computeScopeSuggestions(
			[signalsAnswer(['duplicated_information', 'too_many_steps'])],
			[scopeItem({ id: 'item-1', sourceSuggestionId: 'reuse_existing_information' })]
		);
		expect(suggestions).toEqual([
			{
				id: 'combine_redundant_steps',
				title: 'Reduzir ou combinar etapas redundantes',
				reason: 'Sugerido porque você indicou excesso de etapas.'
			}
		]);
	});

	it('sugestão reaparece se o item que a aceitou não existe mais (mesmo efeito de exclusão)', () => {
		const withoutItem = computeScopeSuggestions([signalsAnswer(['duplicated_information'])], []);
		expect(withoutItem).toHaveLength(1);
	});
});
