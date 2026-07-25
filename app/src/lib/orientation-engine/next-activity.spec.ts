import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, confirmSummary, createInitialProjectState, skipActivity } from '$lib/domain';
import { computeNextActivity } from './next-activity';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

describe('computeNextActivity (Trilha A)', () => {
	it('recomenda "origem" num projeto novo', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'origem'
		});
	});

	it('recomenda a próxima atividade do catálogo após concluir a atual', () => {
		const state = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', { origem: 'x' }, T1)
		);
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'contexto'
		});
	});

	it('nunca recomenda uma atividade pulada — avança para a próxima elegível', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(skipActivity(catalog, state, 'origem', 'pend-1', T1));
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'contexto'
		});
	});

	it('o Resumo volta a ser recomendado quando invalidado (em_andamento) após concluído', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'x' }, T1));
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'contexto',
				{
					nome_provisorio: 'Portal',
					breve_descricao: 'x',
					modo_trabalho: 'Individual',
					nivel_experiencia: 'Iniciante',
					estagio_atual: 'Ideia inicial'
				},
				T1
			)
		);
		state = unwrap(answerActivity(catalog, state, 'problema', { situacao: 'x', dificuldade: 'y' }, T1));
		state = unwrap(answerActivity(catalog, state, 'publico', { publico_detail: 'x' }, T1));
		state = unwrap(answerActivity(catalog, state, 'estado_atual', { estado_atual_detail: 'x' }, T1));
		state = unwrap(
			answerActivity(catalog, state, 'resultado', { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }, T1)
		);
		state = unwrap(confirmSummary(catalog, state));
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'usuario_principal'
		});

		// edita uma resposta anterior → invalida o Resumo
		state = unwrap(answerActivity(catalog, state, 'publico', { publico_detail: 'Outro valor' }, T2));
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'resumo'
		});
	});

	it('recomenda "Definir usuário principal" depois de concluir toda a Descoberta', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'x' }, T1));
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'contexto',
				{
					nome_provisorio: 'Portal',
					breve_descricao: 'x',
					modo_trabalho: 'Individual',
					nivel_experiencia: 'Iniciante',
					estagio_atual: 'Ideia inicial'
				},
				T1
			)
		);
		state = unwrap(answerActivity(catalog, state, 'problema', { situacao: 'x', dificuldade: 'y' }, T1));
		state = unwrap(answerActivity(catalog, state, 'publico', { publico_detail: 'x' }, T1));
		state = unwrap(answerActivity(catalog, state, 'estado_atual', { estado_atual_detail: 'x' }, T1));
		state = unwrap(
			answerActivity(catalog, state, 'resultado', { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }, T1)
		);
		state = unwrap(confirmSummary(catalog, state));
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'usuario_principal'
		});
	});

	it('recomenda "Definir visão do produto" depois de concluir "Definir usuário principal"', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'x' }, T1));
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'contexto',
				{
					nome_provisorio: 'Portal',
					breve_descricao: 'x',
					modo_trabalho: 'Individual',
					nivel_experiencia: 'Iniciante',
					estagio_atual: 'Ideia inicial'
				},
				T1
			)
		);
		state = unwrap(answerActivity(catalog, state, 'problema', { situacao: 'x', dificuldade: 'y' }, T1));
		state = unwrap(answerActivity(catalog, state, 'publico', { publico_detail: 'x' }, T1));
		state = unwrap(answerActivity(catalog, state, 'estado_atual', { estado_atual_detail: 'x' }, T1));
		state = unwrap(
			answerActivity(catalog, state, 'resultado', { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }, T1)
		);
		state = unwrap(confirmSummary(catalog, state));
		state = unwrap(
			answerActivity(catalog, state, 'usuario_principal', { usuario_principal: 'Analista' }, T1)
		);

		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'visao_produto'
		});
	});

	it('retorna catalog_limit_reached depois de concluir as 9 atividades disponíveis', () => {
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'x' }, T1));
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'contexto',
				{
					nome_provisorio: 'Portal',
					breve_descricao: 'x',
					modo_trabalho: 'Individual',
					nivel_experiencia: 'Iniciante',
					estagio_atual: 'Ideia inicial'
				},
				T1
			)
		);
		state = unwrap(answerActivity(catalog, state, 'problema', { situacao: 'x', dificuldade: 'y' }, T1));
		state = unwrap(answerActivity(catalog, state, 'publico', { publico_detail: 'x' }, T1));
		state = unwrap(answerActivity(catalog, state, 'estado_atual', { estado_atual_detail: 'x' }, T1));
		state = unwrap(
			answerActivity(catalog, state, 'resultado', { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }, T1)
		);
		state = unwrap(confirmSummary(catalog, state));
		state = unwrap(
			answerActivity(catalog, state, 'usuario_principal', { usuario_principal: 'Analista' }, T1)
		);
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'visao_produto',
				{
					tipo_produto: 'Aplicativo web',
					necessidade_central: 'x',
					beneficio_central: 'y'
				},
				T1
			)
		);

		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({ kind: 'catalog_limit_reached' });
	});
});
