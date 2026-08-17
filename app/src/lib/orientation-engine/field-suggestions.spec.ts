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

function suggestionFor(suggestions: ReturnType<typeof computeFieldSuggestions>, fieldId: string) {
	return suggestions.find((s) => s.fieldId === fieldId);
}

describe('computeFieldSuggestions', () => {
	it('sem nenhuma Answer: nenhuma sugestão', () => {
		expect(computeFieldSuggestions(catalog, [])).toEqual([]);
	});

	it('não sugere nada para um campo que não é origem nem destino de nenhum suggestedSource', () => {
		const answers = [answer({ activityDefinitionId: 'problema', fieldDefinitionId: 'evidencias', value: 'Algo' })];
		expect(computeFieldSuggestions(catalog, answers)).toEqual([]);
	});

	// publico_detail → beneficiario/usuario_principal foi removido nesta
	// suite: "Quem é afetado" deixou de ter um campo de texto livre (ETAPA 2
	// do rework, ver catalog/discovery.ts) — os suggestedSource que apontavam
	// para ele foram removidos do catálogo (beneficiario em
	// catalog/discovery.ts, usuario_principal em catalog/product-definition.ts).
	// AffectedGroup não alimenta este mecanismo de sugestão de texto.

	describe('problema.situacao → visao_produto.necessidade_central', () => {
		it('gera sugestão com texto e ajuda corretos', () => {
			const answers = [
				answer({ activityDefinitionId: 'problema', fieldDefinitionId: 'situacao', value: 'Solicitações dispersas' })
			];

			const suggestions = computeFieldSuggestions(catalog, answers);
			const necessidade = suggestionFor(suggestions, 'necessidade_central')!;
			expect(necessidade).toBeDefined();
			expect(necessidade.sourceValue).toBe('Solicitações dispersas');
			expect(necessidade.actionLabel).toBe('Usar o problema como ponto de partida');
			expect(necessidade.helpText.length).toBeGreaterThan(0);
		});

		it('origem vazia (Answer existe mas valor é string vazia): nenhuma sugestão para necessidade_central', () => {
			const answers = [answer({ activityDefinitionId: 'problema', fieldDefinitionId: 'situacao', value: '   ' })];
			expect(suggestionFor(computeFieldSuggestions(catalog, answers), 'necessidade_central')).toBeUndefined();
		});

		it('destino já respondido: sugestão não aparece', () => {
			const answers = [
				answer({ activityDefinitionId: 'problema', fieldDefinitionId: 'situacao', value: 'Solicitações dispersas' }),
				answer({
					activityDefinitionId: 'visao_produto',
					fieldDefinitionId: 'necessidade_central',
					value: 'Já escrevi isso'
				})
			];
			expect(suggestionFor(computeFieldSuggestions(catalog, answers), 'necessidade_central')).toBeUndefined();
		});
	});

	// resultado.mudanca → visao_produto.beneficio_central e
	// resultado.percepcao → criterios_sucesso_produto.sinais_sucesso foram
	// removidos nesta suite: "Resultado desejado" deixou de ter campos de
	// texto livre (Stage 4C do rework, ver catalog/discovery.ts) — os
	// suggestedSource que apontavam para eles foram removidos do catálogo
	// (ver catalog/product-definition.ts). DesiredOutcome não alimenta este
	// mecanismo de sugestão de texto (mesmo caso de AffectedGroup acima).

	it('sem os pares removidos, sobra só necessidade_central mesmo com todas as origens restantes preenchidas', () => {
		const answers = [answer({ activityDefinitionId: 'problema', fieldDefinitionId: 'situacao', value: 'Solicitações dispersas' })];

		const suggestions = computeFieldSuggestions(catalog, answers);
		expect(suggestions.map((s) => s.fieldId).sort()).toEqual(['necessidade_central']);
	});
});
