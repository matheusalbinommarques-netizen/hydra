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

	describe('publico_detail → beneficiario / usuario_principal', () => {
		it('publico_detail respondido gera sugestão para os dois destinos, com texto e ajuda corretos', () => {
			const answers = [
				answer({
					activityDefinitionId: 'publico',
					fieldDefinitionId: 'publico_detail',
					value: 'Agentes de atendimento'
				})
			];

			const suggestions = computeFieldSuggestions(catalog, answers);
			expect(suggestions.map((s) => s.fieldId).sort()).toEqual(['beneficiario', 'usuario_principal']);

			const beneficiario = suggestionFor(suggestions, 'beneficiario')!;
			expect(beneficiario.sourceValue).toBe('Agentes de atendimento');
			expect(beneficiario.actionLabel).toBe('Usar Público afetado como ponto de partida');
			expect(beneficiario.helpText.length).toBeGreaterThan(0);

			const usuarioPrincipal = suggestionFor(suggestions, 'usuario_principal')!;
			expect(usuarioPrincipal.sourceValue).toBe('Agentes de atendimento');
			expect(usuarioPrincipal.actionLabel).toBe('Usar Público afetado como ponto de partida');
		});

		it('destino já respondido não aparece mais, o outro continua aparecendo', () => {
			const answers = [
				answer({
					activityDefinitionId: 'publico',
					fieldDefinitionId: 'publico_detail',
					value: 'Agentes de atendimento'
				}),
				answer({ activityDefinitionId: 'resultado', fieldDefinitionId: 'beneficiario', value: 'Clientes finais' })
			];

			const suggestions = computeFieldSuggestions(catalog, answers);
			expect(suggestions.map((s) => s.fieldId)).toEqual(['usuario_principal']);
		});
	});

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

	describe('resultado.mudanca → visao_produto.beneficio_central', () => {
		it('gera sugestão com texto e ajuda corretos', () => {
			const answers = [
				answer({
					activityDefinitionId: 'resultado',
					fieldDefinitionId: 'mudanca',
					value: 'Solicitações centralizadas'
				})
			];

			const suggestions = computeFieldSuggestions(catalog, answers);
			const beneficio = suggestionFor(suggestions, 'beneficio_central')!;
			expect(beneficio).toBeDefined();
			expect(beneficio.sourceValue).toBe('Solicitações centralizadas');
			expect(beneficio.actionLabel).toBe('Usar o resultado desejado como ponto de partida');
			expect(beneficio.helpText.length).toBeGreaterThan(0);
		});

		it('origem sem Answer: nenhuma sugestão para beneficio_central', () => {
			expect(suggestionFor(computeFieldSuggestions(catalog, []), 'beneficio_central')).toBeUndefined();
		});
	});

	describe('resultado.percepcao → criterios_sucesso_produto.sinais_sucesso', () => {
		it('gera sugestão com texto e ajuda corretos', () => {
			const answers = [
				answer({
					activityDefinitionId: 'resultado',
					fieldDefinitionId: 'percepcao',
					value: 'Menos retrabalho perceptível'
				})
			];

			const suggestions = computeFieldSuggestions(catalog, answers);
			const sinais = suggestionFor(suggestions, 'sinais_sucesso')!;
			expect(sinais).toBeDefined();
			expect(sinais.sourceValue).toBe('Menos retrabalho perceptível');
			expect(sinais.actionLabel).toBe('Usar a percepção de melhoria como ponto de partida');
			expect(sinais.helpText.length).toBeGreaterThan(0);
		});

		it('destino já respondido: sugestão não aparece', () => {
			const answers = [
				answer({
					activityDefinitionId: 'resultado',
					fieldDefinitionId: 'percepcao',
					value: 'Menos retrabalho perceptível'
				}),
				answer({
					activityDefinitionId: 'criterios_sucesso_produto',
					fieldDefinitionId: 'sinais_sucesso',
					value: 'Já escrevi isso'
				})
			];
			expect(suggestionFor(computeFieldSuggestions(catalog, answers), 'sinais_sucesso')).toBeUndefined();
		});
	});

	it('todas as origens preenchidas ao mesmo tempo geram as cinco sugestões, sem interferência entre pares', () => {
		const answers = [
			answer({ activityDefinitionId: 'problema', fieldDefinitionId: 'situacao', value: 'Solicitações dispersas' }),
			answer({ activityDefinitionId: 'publico', fieldDefinitionId: 'publico_detail', value: 'Agentes de atendimento' }),
			answer({ activityDefinitionId: 'resultado', fieldDefinitionId: 'mudanca', value: 'Solicitações centralizadas' }),
			answer({ activityDefinitionId: 'resultado', fieldDefinitionId: 'percepcao', value: 'Menos retrabalho' })
		];

		const suggestions = computeFieldSuggestions(catalog, answers);
		expect(suggestions.map((s) => s.fieldId).sort()).toEqual(
			['beneficiario', 'usuario_principal', 'necessidade_central', 'beneficio_central', 'sinais_sucesso'].sort()
		);
	});
});
