import { describe, expect, it } from 'vitest';
import { computeRouteStartRecommendation, type RouteRecommendationEntry } from './route-recommendation';

const fallback = { phaseId: 'validacao', phaseLabel: 'Validação e encerramento' };

function entries(answers: boolean[]): RouteRecommendationEntry[] {
	const ids = ['descoberta', 'definicao', 'estruturacao', 'planejamento', 'execucao'];
	const phaseLabels = [
		'Descoberta',
		'Definição do produto',
		'Estruturação do projeto',
		'Planejamento da entrega',
		'Execução e acompanhamento'
	];
	const structureLabels = [
		'problema, contexto e benefícios estão claros',
		'produto ou solução está definido',
		'objetivo, partes interessadas, responsabilidades, restrições, riscos e governança estão estruturados',
		'a entrega está planejada e priorizada',
		'a execução começou e está sendo acompanhada'
	];
	return answers.map((answer, index) => ({
		phaseId: ids[index],
		phaseLabel: phaseLabels[index],
		structureLabel: structureLabels[index],
		answer
	}));
}

describe('computeRouteStartRecommendation', () => {
	it('primeira resposta negativa recomenda a fase correspondente', () => {
		const result = computeRouteStartRecommendation(entries([false, true, true, true, true]), fallback);
		expect(result.phaseId).toBe('descoberta');
		expect(result.phaseLabel).toBe('Descoberta');
	});

	it('negativa posterior quando todas as anteriores são positivas', () => {
		const result = computeRouteStartRecommendation(entries([true, true, true, false, true]), fallback);
		expect(result.phaseId).toBe('planejamento');
	});

	it('negativa anterior prevalece sobre respostas positivas posteriores', () => {
		const result = computeRouteStartRecommendation(entries([true, false, true, true, true]), fallback);
		expect(result.phaseId).toBe('definicao');
	});

	it('todas positivas retornam o fallback', () => {
		const result = computeRouteStartRecommendation(entries([true, true, true, true, true]), fallback);
		expect(result).toEqual({
			phaseId: 'validacao',
			phaseLabel: 'Validação e encerramento',
			justification:
				'Todas as estruturas anteriores estão confirmadas — o projeto está pronto para validação e encerramento.'
		});
	});

	it('justificativa corresponde ao rótulo da estrutura ausente, não ao rótulo da fase', () => {
		const result = computeRouteStartRecommendation(entries([true, true, false, true, true]), fallback);
		expect(result.phaseLabel).toBe('Estruturação do projeto');
		expect(result.justification).toBe(
			'Ainda não há confirmação de que: objetivo, partes interessadas, responsabilidades, restrições, riscos e governança estão estruturados'
		);
	});

	it('respeita a ordem recebida, não a ordem alfabética ou de id', () => {
		const reordered: RouteRecommendationEntry[] = [
			{ phaseId: 'execucao', phaseLabel: 'Execução e acompanhamento', structureLabel: 'execução', answer: true },
			{ phaseId: 'descoberta', phaseLabel: 'Descoberta', structureLabel: 'descoberta', answer: false },
			{ phaseId: 'planejamento', phaseLabel: 'Planejamento da entrega', structureLabel: 'planejamento', answer: true }
		];
		const result = computeRouteStartRecommendation(reordered, fallback);
		expect(result.phaseId).toBe('descoberta');
	});
});
