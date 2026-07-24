import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';
import {
	answerActivity,
	confirmSummary,
	isActivityFieldsValid,
	renameProject,
	shouldInvalidateSummary,
	skipActivity
} from './transitions';
import type { RequiredFieldsActivity } from './catalog-types';
import type { ProjectState } from './state-types';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function freshState(): ProjectState {
	return createInitialProjectState(catalog, 'proj-1', T1);
}

function findActivity(id: string): RequiredFieldsActivity {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((a) => a.id === id);
		if (found && found.completionMode === 'required_fields') return found;
	}
	throw new Error(`atividade required_fields "${id}" não encontrada no catálogo`);
}

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

describe('isActivityFieldsValid', () => {
	it('é false quando o único campo obrigatório está vazio', () => {
		const origem = findActivity('origem');
		expect(isActivityFieldsValid(origem, freshState())).toBe(false);
	});

	it('é true quando todos os campos obrigatórios estão preenchidos', () => {
		const origem = findActivity('origem');
		const answered = unwrap(answerActivity(catalog, freshState(), 'origem', { origem: 'Um problema' }, T1));
		expect(isActivityFieldsValid(origem, answered)).toBe(true);
	});

	it('valida o campo project_property contra Project.name, não contra Answer', () => {
		const contexto = findActivity('contexto');
		const partial = unwrap(
			answerActivity(
				catalog,
				freshState(),
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
		expect(isActivityFieldsValid(contexto, partial)).toBe(false); // falta nome_provisorio
		const complete = unwrap(
			answerActivity(catalog, partial, 'contexto', { nome_provisorio: 'Meu Projeto' }, T1)
		);
		expect(isActivityFieldsValid(contexto, complete)).toBe(true);
		expect(complete.answers.some((a) => a.fieldDefinitionId === 'nome_provisorio')).toBe(false);
	});
});

describe('shouldInvalidateSummary', () => {
	it('é false quando o Resumo ainda não está concluída', () => {
		expect(
			shouldInvalidateSummary(catalog, freshState(), { kind: 'answer', activityDefinitionId: 'publico' })
		).toBe(false);
	});

	it('é true para mudança em atividade anterior na mesma fase, com Resumo concluída', () => {
		const state = unwrap(confirmSummary(catalog, freshState()));
		expect(
			shouldInvalidateSummary(catalog, state, { kind: 'answer', activityDefinitionId: 'publico' })
		).toBe(true);
	});

	it('é true para project_name, com Resumo concluída', () => {
		const state = unwrap(confirmSummary(catalog, freshState()));
		expect(shouldInvalidateSummary(catalog, state, { kind: 'project_name' })).toBe(true);
	});

	it('é false para atividade de outra fase (usuario_principal não é "anterior" ao Resumo)', () => {
		const state = unwrap(confirmSummary(catalog, freshState()));
		expect(
			shouldInvalidateSummary(catalog, state, {
				kind: 'answer',
				activityDefinitionId: 'usuario_principal'
			})
		).toBe(false);
	});

	it('é false para activityDefinitionId inexistente', () => {
		const state = unwrap(confirmSummary(catalog, freshState()));
		expect(
			shouldInvalidateSummary(catalog, state, { kind: 'answer', activityDefinitionId: 'inexistente' })
		).toBe(false);
	});
});

describe('answerActivity', () => {
	it('erro activity_not_found para atividade inexistente', () => {
		const result = answerActivity(catalog, freshState(), 'inexistente', {}, T1);
		expect(result).toEqual({ ok: false, error: { kind: 'activity_not_found' } });
	});

	it('erro wrong_completion_mode ao responder o Resumo (explicit_confirmation)', () => {
		const result = answerActivity(catalog, freshState(), 'resumo', {}, T1);
		expect(result).toEqual({ ok: false, error: { kind: 'wrong_completion_mode' } });
	});

	it('erro unknown_field para chave que não pertence à atividade', () => {
		const result = answerActivity(catalog, freshState(), 'origem', { campo_invalido: 'x' }, T1);
		expect(result).toEqual({ ok: false, error: { kind: 'unknown_field', fieldDefinitionId: 'campo_invalido' } });
	});

	it('campo answer gera uma Answer nova, com createdAt e updatedAt = occurredAt', () => {
		const state = unwrap(answerActivity(catalog, freshState(), 'publico', { publico_detail: 'Clientes' }, T1));
		const answer = state.answers.find((a) => a.fieldDefinitionId === 'publico_detail');
		expect(answer).toEqual({
			projectId: 'proj-1',
			activityDefinitionId: 'publico',
			fieldDefinitionId: 'publico_detail',
			value: 'Clientes',
			createdAt: T1,
			updatedAt: T1
		});
	});

	it('resposta idêntica não altera timestamps nem cria uma segunda Answer', () => {
		const first = unwrap(
			answerActivity(catalog, freshState(), 'publico', { publico_detail: 'Clientes' }, T1)
		);
		const second = unwrap(answerActivity(catalog, first, 'publico', { publico_detail: 'Clientes' }, T2));
		expect(second.answers).toEqual(first.answers); // updatedAt continua T1, não vira T2
		expect(second.answers).toHaveLength(1);
	});

	it('resposta diferente atualiza updatedAt mas preserva createdAt', () => {
		const first = unwrap(
			answerActivity(catalog, freshState(), 'publico', { publico_detail: 'Clientes' }, T1)
		);
		const second = unwrap(
			answerActivity(catalog, first, 'publico', { publico_detail: 'Clientes e atendentes' }, T2)
		);
		const answer = second.answers.find((a) => a.fieldDefinitionId === 'publico_detail');
		expect(answer).toEqual({
			projectId: 'proj-1',
			activityDefinitionId: 'publico',
			fieldDefinitionId: 'publico_detail',
			value: 'Clientes e atendentes',
			createdAt: T1,
			updatedAt: T2
		});
	});

	it('renomear o projeto via campo project_property atualiza Project.name e não cria Answer', () => {
		const state = unwrap(
			answerActivity(catalog, freshState(), 'contexto', { nome_provisorio: 'Portal' }, T1)
		);
		expect(state.project.name).toBe('Portal');
		expect(state.answers.some((a) => a.fieldDefinitionId === 'nome_provisorio')).toBe(false);
	});

	it('conclui a atividade quando todos os campos obrigatórios ficam válidos', () => {
		const state = unwrap(answerActivity(catalog, freshState(), 'origem', { origem: 'Um problema' }, T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'origem');
		expect(progress?.status).toBe('concluída');
	});

	it('concluída perde campo obrigatório → em_andamento, nunca pulada', () => {
		const done = unwrap(answerActivity(catalog, freshState(), 'origem', { origem: 'Um problema' }, T1));
		const cleared = unwrap(answerActivity(catalog, done, 'origem', { origem: '' }, T2));
		const progress = cleared.activityProgress.find((p) => p.activityDefinitionId === 'origem');
		expect(progress?.status).toBe('em_andamento');
	});

	it('pulada com preenchimento completo → concluída e resolve a pendência', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'origem', 'pend-1', T1));
		expect(skipped.pendingItems).toEqual([
			{ id: 'pend-1', projectId: 'proj-1', activityDefinitionId: 'origem', status: 'aberta', createdAt: T1 }
		]);

		const completed = unwrap(answerActivity(catalog, skipped, 'origem', { origem: 'Um problema' }, T2));
		const progress = completed.activityProgress.find((p) => p.activityDefinitionId === 'origem');
		expect(progress?.status).toBe('concluída');
		expect(completed.pendingItems).toEqual([
			{
				id: 'pend-1',
				projectId: 'proj-1',
				activityDefinitionId: 'origem',
				status: 'resolvida',
				createdAt: T1,
				resolvedAt: T2
			}
		]);
	});

	it('pulada com preenchimento parcial permanece pulada e a pendência continua aberta', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'contexto', 'pend-1', T1));
		const partial = unwrap(
			answerActivity(catalog, skipped, 'contexto', { breve_descricao: 'x' }, T2)
		);
		const progress = partial.activityProgress.find((p) => p.activityDefinitionId === 'contexto');
		expect(progress?.status).toBe('pulada');
		expect(partial.pendingItems[0].status).toBe('aberta');
	});

	it('mudança real em atividade anterior invalida o Resumo já concluída', () => {
		const withSummary = unwrap(confirmSummary(catalog, freshState()));
		const answered = unwrap(
			answerActivity(catalog, withSummary, 'publico', { publico_detail: 'Clientes' }, T2)
		);
		const resumo = answered.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});

	it('mudança repetindo o mesmo valor não invalida o Resumo já concluída', () => {
		const answered = unwrap(
			answerActivity(catalog, freshState(), 'publico', { publico_detail: 'Clientes' }, T1)
		);
		const withSummary = unwrap(confirmSummary(catalog, answered));
		const reanswered = unwrap(
			answerActivity(catalog, withSummary, 'publico', { publico_detail: 'Clientes' }, T2)
		);
		const resumo = reanswered.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('concluída');
	});
});

describe('skipActivity', () => {
	it('marca a atividade como pulada e cria exatamente uma PendingItem', () => {
		const state = unwrap(skipActivity(catalog, freshState(), 'origem', 'pend-1', T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'origem');
		expect(progress?.status).toBe('pulada');
		expect(state.pendingItems).toHaveLength(1);
	});

	it('erro activity_not_skippable ao pular o Resumo (explicit_confirmation)', () => {
		const result = skipActivity(catalog, freshState(), 'resumo', 'pend-1', T1);
		expect(result).toEqual({ ok: false, error: { kind: 'activity_not_skippable' } });
	});

	it('erro transition_not_allowed ao pular uma atividade já pulada', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'origem', 'pend-1', T1));
		const result = skipActivity(catalog, skipped, 'origem', 'pend-2', T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'pulada' } });
	});

	it('erro transition_not_allowed ao pular uma atividade já concluída', () => {
		const done = unwrap(answerActivity(catalog, freshState(), 'origem', { origem: 'Um problema' }, T1));
		const result = skipActivity(catalog, done, 'origem', 'pend-1', T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('nunca acumula uma segunda pendência para a mesma atividade, mesmo após resolvida e pulada de novo', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'origem', 'pend-1', T1));
		const completed = unwrap(answerActivity(catalog, skipped, 'origem', { origem: 'Um problema' }, T2));
		expect(completed.pendingItems[0].status).toBe('resolvida');

		const clearedBackToEmAndamento = unwrap(
			answerActivity(catalog, completed, 'origem', { origem: '' }, T2)
		);
		const skippedAgain = unwrap(
			skipActivity(catalog, clearedBackToEmAndamento, 'origem', 'pend-2', T2)
		);

		expect(skippedAgain.pendingItems).toHaveLength(1);
		expect(skippedAgain.pendingItems[0].id).toBe('pend-1');
		expect(skippedAgain.pendingItems[0].status).toBe('resolvida');
		const progress = skippedAgain.activityProgress.find((p) => p.activityDefinitionId === 'origem');
		expect(progress?.status).toBe('pulada');
	});
});

describe('confirmSummary', () => {
	it('conclui o Resumo a partir de não_iniciada', () => {
		const state = unwrap(confirmSummary(catalog, freshState()));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(progress?.status).toBe('concluída');
	});

	it('erro transition_not_allowed ao confirmar um Resumo já concluída', () => {
		const state = unwrap(confirmSummary(catalog, freshState()));
		const result = confirmSummary(catalog, state);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});
});

describe('renameProject', () => {
	it('atualiza Project.name', () => {
		const state = unwrap(renameProject(catalog, freshState(), 'Novo Nome'));
		expect(state.project.name).toBe('Novo Nome');
	});

	it('nome idêntico não invalida o Resumo já concluída', () => {
		const named = unwrap(renameProject(catalog, freshState(), 'Portal'));
		const withSummary = unwrap(confirmSummary(catalog, named));
		const renamedSame = unwrap(renameProject(catalog, withSummary, 'Portal'));
		const resumo = renamedSame.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('concluída');
	});

	it('nome diferente invalida o Resumo já concluída', () => {
		const named = unwrap(renameProject(catalog, freshState(), 'Portal'));
		const withSummary = unwrap(confirmSummary(catalog, named));
		const renamed = unwrap(renameProject(catalog, withSummary, 'Portal Novo'));
		const resumo = renamed.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});
});
