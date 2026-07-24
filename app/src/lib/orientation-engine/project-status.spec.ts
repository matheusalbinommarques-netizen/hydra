import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, confirmSummary, createInitialProjectState, renameProject } from '$lib/domain';
import { computeProjectStatus } from './project-status';

const T1 = '2026-01-01T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

describe('computeProjectStatus', () => {
	it('é rascunho quando Project.name ainda não foi definido', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computeProjectStatus(state.project, catalog, state.activityProgress)).toBe('rascunho');
	});

	it('é em_andamento assim que o nome é definido, mesmo sem mais nada preenchido', () => {
		const state = unwrap(renameProject(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'Portal'));
		expect(computeProjectStatus(state.project, catalog, state.activityProgress)).toBe('em_andamento');
	});

	it('concluído é inalcançável nesta versão: mesmo com Descoberta e "Definir usuário principal" completas, permanece em_andamento', () => {
		let state = unwrap(renameProject(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'Portal'));
		state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'Um problema' }, T1));
		state = unwrap(
			answerActivity(
				catalog,
				state,
				'contexto',
				{
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

		expect(computeProjectStatus(state.project, catalog, state.activityProgress)).toBe('em_andamento');
	});
});
