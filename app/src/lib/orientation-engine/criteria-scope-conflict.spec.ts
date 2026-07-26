import { describe, expect, it } from 'vitest';
import type { Answer, ScopeItem } from '$lib/domain';
import { computeCriteriaScopeConflict } from './criteria-scope-conflict';

const T1 = '2026-01-01T00:00:00.000Z';

function criteriaAnswer(fieldDefinitionId: string, value: string): Answer {
	return {
		projectId: 'proj-1',
		activityDefinitionId: 'criterios_sucesso_produto',
		fieldDefinitionId,
		value,
		createdAt: T1,
		updatedAt: T1
	};
}

function scopeItem(overrides: Partial<ScopeItem> & Pick<ScopeItem, 'id' | 'bucket'>): ScopeItem {
	return {
		id: overrides.id,
		projectId: 'proj-1',
		text: overrides.text ?? 'Item',
		bucket: overrides.bucket,
		effort: overrides.effort ?? null,
		order: overrides.bucket === 'agora' ? (overrides.order ?? 0) : null,
		sourceSuggestionId: overrides.sourceSuggestionId ?? null,
		createdAt: T1,
		updatedAt: T1
	};
}

describe('computeCriteriaScopeConflict', () => {
	it('nenhum critério respondido: não dispara, mesmo sem item em "agora"', () => {
		expect(computeCriteriaScopeConflict([], [])).toEqual({ triggered: false, message: null });
	});

	it('critério respondido com item em "agora": não dispara', () => {
		const answers = [criteriaAnswer('sinais_sucesso', 'Usuários voltam a usar o produto')];
		const scopeItems = [scopeItem({ id: 'item-1', bucket: 'agora' })];
		expect(computeCriteriaScopeConflict(answers, scopeItems)).toEqual({ triggered: false, message: null });
	});

	it('critério respondido sem nenhum item em "agora": dispara', () => {
		const answers = [criteriaAnswer('sinais_sucesso', 'Usuários voltam a usar o produto')];
		const scopeItems = [scopeItem({ id: 'item-1', bucket: 'depois' })];
		const result = computeCriteriaScopeConflict(answers, scopeItems);
		expect(result.triggered).toBe(true);
		expect(result.message).toBeTruthy();
	});

	it('critério respondido, escopo totalmente vazio: dispara', () => {
		const answers = [criteriaAnswer('condicao_minima_validacao', 'Pelo menos um usuário real completa o fluxo')];
		expect(computeCriteriaScopeConflict(answers, []).triggered).toBe(true);
	});

	it('resposta de critério em branco não conta como "definido"', () => {
		const answers = [criteriaAnswer('sinais_sucesso', '   ')];
		expect(computeCriteriaScopeConflict(answers, []).triggered).toBe(false);
	});

	it('respostas de outras atividades não disparam o conflito', () => {
		const answers: Answer[] = [
			{
				projectId: 'proj-1',
				activityDefinitionId: 'problema',
				fieldDefinitionId: 'situacao',
				value: 'Algo precisa mudar',
				createdAt: T1,
				updatedAt: T1
			}
		];
		expect(computeCriteriaScopeConflict(answers, []).triggered).toBe(false);
	});

	it('item em "agora" some (movido/excluído) depois de um critério respondido: volta a disparar', () => {
		const answers = [criteriaAnswer('sinais_sucesso', 'Usuários voltam a usar o produto')];
		const scopeItems = [scopeItem({ id: 'item-1', bucket: 'fora' })];
		expect(computeCriteriaScopeConflict(answers, scopeItems).triggered).toBe(true);
	});
});
