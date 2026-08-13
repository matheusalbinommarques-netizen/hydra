import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';
import {
	addAffectedGroup,
	addImpediment,
	addScopeItem,
	answerActivity,
	completeExternalAction,
	confirmAffectedGroups,
	confirmPlanningPriority,
	confirmScopeVersion,
	confirmSummary,
	getAffectedGroupConfirmationIssues,
	getScopeConfirmationIssues,
	isActivityFieldsValid,
	moveScopeItem,
	prepareExternalAction,
	removeAffectedGroup,
	removeScopeItem,
	renameProject,
	reopenImpediment,
	reorderAgoraItems,
	resolveImpediment,
	setAffectedGroupFrequency,
	setAffectedGroupImpact,
	setHypothesis,
	setImpedimentNextAction,
	setImpedimentType,
	setRouteStartPhase,
	setScopeItemEffort,
	setScopeItemExecutionStatus,
	setScopeItemText,
	shouldInvalidateSummary,
	skipActivity
} from './transitions';
import { encodePlanningItems } from './planning-items';
import type { Catalog, RequiredFieldsActivity } from './catalog-types';
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
		// Nenhuma atividade do catálogo real usa mais dataTarget: 'project_property'
		// desde a remoção de "Contexto inicial" (nome agora vem de /projects/new
		// na criação real) — fixture local só para cobrir o mecanismo genérico,
		// mesmo padrão de fixture_atividade em domain/test-support.ts.
		const projectPropertyActivity: RequiredFieldsActivity = {
			id: 'fixture_project_property',
			phaseId: 'descoberta',
			order: 1,
			title: 'Fixture de teste',
			mainQuestion: 'Pergunta fabricada de teste?',
			why: 'Fixture de teste.',
			example: 'Fixture de teste.',
			completionCriteria: 'Nome preenchido.',
			completionMode: 'required_fields',
			allowsSkip: true,
			pendingItemLabel: 'Pendência fabricada de teste',
			pendingItemDetail: 'Fixture de teste.',
			fields: [
				{
					id: 'nome_provisorio',
					activityId: 'fixture_project_property',
					label: 'Nome provisório do projeto',
					required: true,
					dataTarget: 'project_property',
					projectProperty: 'name',
					type: 'texto_curto'
				}
			]
		};
		const fixtureCatalog: Catalog = {
			phases: [{ id: 'descoberta', order: 1, label: 'Descoberta', catalogStatus: 'complete', activities: [projectPropertyActivity] }]
		};
		const state = createInitialProjectState(fixtureCatalog, 'proj-1', T1);
		expect(isActivityFieldsValid(projectPropertyActivity, state)).toBe(false);
		const complete = unwrap(
			answerActivity(fixtureCatalog, state, 'fixture_project_property', { nome_provisorio: 'Meu Projeto' }, T1)
		);
		expect(isActivityFieldsValid(projectPropertyActivity, complete)).toBe(true);
		expect(complete.project.name).toBe('Meu Projeto');
		expect(complete.answers.some((a) => a.fieldDefinitionId === 'nome_provisorio')).toBe(false);
	});

	it('lista_partes (C5-01): é false quando a coleção está vazia', () => {
		const decompor = findActivity('decompor_trabalho');
		expect(isActivityFieldsValid(decompor, freshState())).toBe(false);
	});

	it('lista_partes: é true quando há ao menos um item com texto não vazio', () => {
		const decompor = findActivity('decompor_trabalho');
		const answered = unwrap(
			answerActivity(
				catalog,
				freshState(),
				'decompor_trabalho',
				{ partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Tela de abertura' }]) },
				T1
			)
		);
		expect(isActivityFieldsValid(decompor, answered)).toBe(true);
	});

	it('lista_partes: é false quando todo item tem texto vazio (defesa contra escrita malformada)', () => {
		const decompor = findActivity('decompor_trabalho');
		const answered = unwrap(
			answerActivity(
				catalog,
				freshState(),
				'decompor_trabalho',
				{ partes_trabalho: encodePlanningItems([{ id: 'p1', text: '   ' }]) },
				T1
			)
		);
		expect(isActivityFieldsValid(decompor, answered)).toBe(false);
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
		const state = unwrap(
			answerActivity(catalog, freshState(), 'estado_atual', { estado_atual_detail: 'Clientes' }, T1)
		);
		const answer = state.answers.find((a) => a.fieldDefinitionId === 'estado_atual_detail');
		expect(answer).toEqual({
			projectId: 'proj-1',
			activityDefinitionId: 'estado_atual',
			fieldDefinitionId: 'estado_atual_detail',
			value: 'Clientes',
			createdAt: T1,
			updatedAt: T1
		});
	});

	it('resposta idêntica não altera timestamps nem cria uma segunda Answer', () => {
		const first = unwrap(
			answerActivity(catalog, freshState(), 'estado_atual', { estado_atual_detail: 'Clientes' }, T1)
		);
		const second = unwrap(
			answerActivity(catalog, first, 'estado_atual', { estado_atual_detail: 'Clientes' }, T2)
		);
		expect(second.answers).toEqual(first.answers); // updatedAt continua T1, não vira T2
		expect(second.answers).toHaveLength(1);
	});

	it('resposta diferente atualiza updatedAt mas preserva createdAt', () => {
		const first = unwrap(
			answerActivity(catalog, freshState(), 'estado_atual', { estado_atual_detail: 'Clientes' }, T1)
		);
		const second = unwrap(
			answerActivity(catalog, first, 'estado_atual', { estado_atual_detail: 'Clientes e atendentes' }, T2)
		);
		const answer = second.answers.find((a) => a.fieldDefinitionId === 'estado_atual_detail');
		expect(answer).toEqual({
			projectId: 'proj-1',
			activityDefinitionId: 'estado_atual',
			fieldDefinitionId: 'estado_atual_detail',
			value: 'Clientes e atendentes',
			createdAt: T1,
			updatedAt: T2
		});
	});

	// "renomear via project_property atualiza Project.name e não cria Answer"
	// já coberto acima ('valida o campo project_property contra Project.name,
	// não contra Answer') — sem duplicar a mesma fixture aqui.

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
		const skipped = unwrap(skipActivity(catalog, freshState(), 'problema', 'pend-1', T1));
		const partial = unwrap(answerActivity(catalog, skipped, 'problema', { situacao: 'x' }, T2));
		const progress = partial.activityProgress.find((p) => p.activityDefinitionId === 'problema');
		expect(progress?.status).toBe('pulada');
		expect(partial.pendingItems[0].status).toBe('aberta');
	});

	it('mudança real em atividade anterior invalida o Resumo já concluída', () => {
		const withSummary = unwrap(confirmSummary(catalog, freshState()));
		const answered = unwrap(
			answerActivity(catalog, withSummary, 'estado_atual', { estado_atual_detail: 'Clientes' }, T2)
		);
		const resumo = answered.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});

	it('mudança repetindo o mesmo valor não invalida o Resumo já concluída', () => {
		const answered = unwrap(
			answerActivity(catalog, freshState(), 'estado_atual', { estado_atual_detail: 'Clientes' }, T1)
		);
		const withSummary = unwrap(confirmSummary(catalog, answered));
		const reanswered = unwrap(
			answerActivity(catalog, withSummary, 'estado_atual', { estado_atual_detail: 'Clientes' }, T2)
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

	it('C5-01: continua localizando e confirmando o Resumo corretamente mesmo existindo uma segunda atividade explicit_confirmation no catálogo (skipActivity/answerActivity em "priorizar_entregas" não interferem)', () => {
		let state = freshState();
		// Interage com a outra explicit_confirmation antes — prova que
		// findExplicitConfirmationActivity/confirmSummary continuam resolvendo
		// para "resumo" por identidade de fase/posição, não por ser a única.
		state = unwrap(skipActivity(catalog, state, 'priorizar_entregas', 'pend-priorizar', T1));

		const confirmed = unwrap(confirmSummary(catalog, state));
		const resumoProgress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		const priorizarProgress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(resumoProgress?.status).toBe('concluída');
		expect(priorizarProgress?.status).toBe('pulada'); // intocada pela confirmação do Resumo

		// Editar uma resposta da Descoberta continua reabrindo só o Resumo —
		// inclusive uma mutação de AffectedGroup (publico deixou de ser
		// required_fields na ETAPA 2, mas shouldInvalidateSummary/invalidateSummary
		// continuam sendo acionados a partir de addAffectedGroup).
		const edited = unwrap(addAffectedGroup(catalog, confirmed, 'ag-1', 'Clientes', T2));
		const resumoAfterEdit = edited.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumoAfterEdit?.status).toBe('em_andamento');
	});
});

describe('AffectedGroup / Mapa de Impacto (ETAPA 2 — "Quem é afetado")', () => {
	it('addAffectedGroup cria um grupo com impact/frequency null e timestamps = occurredAt', () => {
		const state = unwrap(addAffectedGroup(catalog, freshState(), 'ag-1', 'Operação', T1));
		expect(state.affectedGroups).toEqual([
			{
				id: 'ag-1',
				projectId: 'proj-1',
				label: 'Operação',
				impact: null,
				frequency: null,
				createdAt: T1,
				updatedAt: T1
			}
		]);
	});

	it('getAffectedGroupConfirmationIssues: no_groups quando vazio', () => {
		expect(getAffectedGroupConfirmationIssues([])).toEqual([{ kind: 'no_groups' }]);
	});

	it('getAffectedGroupConfirmationIssues: missing_impact e missing_frequency apontam os ids certos, "desconhecido" conta como resposta válida', () => {
		let state = unwrap(addAffectedGroup(catalog, freshState(), 'ag-1', 'Operação', T1));
		state = unwrap(addAffectedGroup(catalog, state, 'ag-2', 'Clientes', T1));
		state = unwrap(setAffectedGroupImpact(catalog, state, 'ag-1', 'desconhecido', T1));
		state = unwrap(setAffectedGroupFrequency(catalog, state, 'ag-1', 'desconhecido', T1));
		// ag-1 totalmente classificado (com 'desconhecido', não null); ag-2 ainda
		// não tem nem impact nem frequency.
		expect(getAffectedGroupConfirmationIssues(state.affectedGroups)).toEqual([
			{ kind: 'missing_impact', groupIds: ['ag-2'] },
			{ kind: 'missing_frequency', groupIds: ['ag-2'] }
		]);
	});

	it('setAffectedGroupImpact: valor repetido é no-op (não altera updatedAt)', () => {
		const added = unwrap(addAffectedGroup(catalog, freshState(), 'ag-1', 'Operação', T1));
		const first = unwrap(setAffectedGroupImpact(catalog, added, 'ag-1', 'alto', T1));
		const second = unwrap(setAffectedGroupImpact(catalog, first, 'ag-1', 'alto', T2));
		expect(second).toBe(first);
	});

	it('setAffectedGroupImpact/Frequency: erro affected_group_not_found para id inexistente', () => {
		expect(setAffectedGroupImpact(catalog, freshState(), 'inexistente', 'alto', T1)).toEqual({
			ok: false,
			error: { kind: 'affected_group_not_found' }
		});
		expect(setAffectedGroupFrequency(catalog, freshState(), 'inexistente', 'raro', T1)).toEqual({
			ok: false,
			error: { kind: 'affected_group_not_found' }
		});
	});

	it('removeAffectedGroup remove o grupo; erro affected_group_not_found para id inexistente', () => {
		const added = unwrap(addAffectedGroup(catalog, freshState(), 'ag-1', 'Operação', T1));
		const removed = unwrap(removeAffectedGroup(catalog, added, 'ag-1'));
		expect(removed.affectedGroups).toEqual([]);
		expect(removeAffectedGroup(catalog, removed, 'ag-1')).toEqual({
			ok: false,
			error: { kind: 'affected_group_not_found' }
		});
	});

	function fullyClassifiedState(): ProjectState {
		let state = unwrap(addAffectedGroup(catalog, freshState(), 'ag-1', 'Operação', T1));
		state = unwrap(setAffectedGroupImpact(catalog, state, 'ag-1', 'alto', T1));
		state = unwrap(setAffectedGroupFrequency(catalog, state, 'ag-1', 'constante', T1));
		return state;
	}

	it('confirmAffectedGroups conclui "publico" quando o mapa está completo', () => {
		const state = unwrap(confirmAffectedGroups(catalog, fullyClassifiedState(), T2));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'publico');
		expect(progress?.status).toBe('concluída');
	});

	it('confirmAffectedGroups erro affected_group_confirmation_invalid quando incompleto', () => {
		const result = confirmAffectedGroups(catalog, freshState(), T1);
		expect(result).toEqual({
			ok: false,
			error: { kind: 'affected_group_confirmation_invalid', issues: [{ kind: 'no_groups' }] }
		});
	});

	it('confirmAffectedGroups erro transition_not_allowed se já concluída', () => {
		const confirmed = unwrap(confirmAffectedGroups(catalog, fullyClassifiedState(), T1));
		const result = confirmAffectedGroups(catalog, confirmed, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('confirmAffectedGroups resolve a PendingItem quando a atividade estava pulada', () => {
		const skipped = unwrap(skipActivity(catalog, fullyClassifiedState(), 'publico', 'pend-publico', T1));
		expect(skipped.pendingItems[0].status).toBe('aberta');
		const confirmed = unwrap(confirmAffectedGroups(catalog, skipped, T2));
		expect(confirmed.pendingItems[0]).toEqual({
			id: 'pend-publico',
			projectId: 'proj-1',
			activityDefinitionId: 'publico',
			status: 'resolvida',
			createdAt: T1,
			resolvedAt: T2
		});
	});

	it('adicionar um novo grupo (ainda por classificar) depois de concluído reabre "publico" (mesmo espírito de invalidateScopeConfirmation)', () => {
		const confirmed = unwrap(confirmAffectedGroups(catalog, fullyClassifiedState(), T1));
		const withNewGroup = unwrap(addAffectedGroup(catalog, confirmed, 'ag-2', 'Fornecedores', T2));
		const progress = withNewGroup.activityProgress.find((p) => p.activityDefinitionId === 'publico');
		expect(progress?.status).toBe('em_andamento');
	});

	it('editar o mapa depois de concluído SEM torná-lo incompleto não reabre "publico"', () => {
		const confirmed = unwrap(confirmAffectedGroups(catalog, fullyClassifiedState(), T1));
		const stillComplete = unwrap(setAffectedGroupFrequency(catalog, confirmed, 'ag-1', 'raro', T2));
		const progress = stillComplete.activityProgress.find((p) => p.activityDefinitionId === 'publico');
		expect(progress?.status).toBe('concluída');
	});

	it('remover o único grupo depois de concluído reabre "publico"', () => {
		const confirmed = unwrap(confirmAffectedGroups(catalog, fullyClassifiedState(), T1));
		const removed = unwrap(removeAffectedGroup(catalog, confirmed, 'ag-1'));
		const progress = removed.activityProgress.find((p) => p.activityDefinitionId === 'publico');
		expect(progress?.status).toBe('em_andamento');
	});

	it('addAffectedGroup invalida o Resumo já concluído (mesma regra de answerActivity)', () => {
		const withSummary = unwrap(confirmSummary(catalog, freshState()));
		const added = unwrap(addAffectedGroup(catalog, withSummary, 'ag-1', 'Operação', T2));
		const resumo = added.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});
});

describe('ExternalAction / Evidence (ETAPA 3 — "Evidence + primeira External Action")', () => {
	const preparation = {
		objective: 'Confirmar como essa situação aparece para Operação.',
		questions: ['Quando isso costuma acontecer?', 'O que você faz quando acontece?'],
		informationToTake: ['Operação', 'Impacto: Alto'],
		expectedResult: 'Tente voltar sabendo se isso realmente acontece dessa forma.'
	};

	function stateWithGroup(): ProjectState {
		return unwrap(addAffectedGroup(catalog, freshState(), 'ag-1', 'Operação', T1));
	}

	it('prepareExternalAction cria a ação aberta, com a preparação recebida e timestamps = occurredAt', () => {
		const state = unwrap(prepareExternalAction(catalog, stateWithGroup(), 'ea-1', 'ag-1', preparation, T1));
		expect(state.externalActions).toEqual([
			{
				id: 'ea-1',
				projectId: 'proj-1',
				kind: 'validate_affected_group',
				affectedGroupId: 'ag-1',
				status: 'aberta',
				...preparation,
				createdAt: T1,
				updatedAt: T1,
				completedAt: null
			}
		]);
	});

	it('prepareExternalAction erro affected_group_not_found para grupo inexistente', () => {
		expect(prepareExternalAction(catalog, freshState(), 'ea-1', 'inexistente', preparation, T1)).toEqual({
			ok: false,
			error: { kind: 'affected_group_not_found' }
		});
	});

	it('prepareExternalAction erro external_action_duplicate_open para o mesmo grupo, mas permite grupo diferente', () => {
		let state = stateWithGroup();
		state = unwrap(addAffectedGroup(catalog, state, 'ag-2', 'Clientes', T1));
		state = unwrap(prepareExternalAction(catalog, state, 'ea-1', 'ag-1', preparation, T1));

		expect(prepareExternalAction(catalog, state, 'ea-2', 'ag-1', preparation, T1)).toEqual({
			ok: false,
			error: { kind: 'external_action_duplicate_open' }
		});

		const withSecondGroup = unwrap(prepareExternalAction(catalog, state, 'ea-2', 'ag-2', preparation, T1));
		expect(withSecondGroup.externalActions.map((a) => a.id)).toEqual(['ea-1', 'ea-2']);
	});

	function stateWithOpenAction(): ProjectState {
		return unwrap(prepareExternalAction(catalog, stateWithGroup(), 'ea-1', 'ag-1', preparation, T1));
	}

	it('completeExternalAction cria a Evidence, conclui a ação (completedAt = occurredAt) e mantém o preparo capturado intacto', () => {
		const state = unwrap(
			completeExternalAction(catalog, stateWithOpenAction(), 'ea-1', 'ev-1', 'partially_confirmed', '  Aprendi algo real.  ', T2)
		);
		expect(state.externalActions).toEqual([
			{
				id: 'ea-1',
				projectId: 'proj-1',
				kind: 'validate_affected_group',
				affectedGroupId: 'ag-1',
				status: 'concluida',
				...preparation,
				createdAt: T1,
				updatedAt: T2,
				completedAt: T2
			}
		]);
		expect(state.evidences).toEqual([
			{
				id: 'ev-1',
				projectId: 'proj-1',
				externalActionId: 'ea-1',
				affectedGroupId: 'ag-1',
				kind: 'conversation',
				outcome: 'partially_confirmed',
				// learning é aparado (trim) antes de persistir.
				learning: 'Aprendi algo real.',
				createdAt: T2
			}
		]);
	});

	it('completeExternalAction erro external_action_not_found para id inexistente', () => {
		expect(completeExternalAction(catalog, freshState(), 'inexistente', 'ev-1', 'confirmed', 'Aprendi.', T1)).toEqual({
			ok: false,
			error: { kind: 'external_action_not_found' }
		});
	});

	it('completeExternalAction erro external_action_not_open ao tentar concluir duas vezes', () => {
		const completed = unwrap(
			completeExternalAction(catalog, stateWithOpenAction(), 'ea-1', 'ev-1', 'confirmed', 'Aprendi.', T2)
		);
		expect(completeExternalAction(catalog, completed, 'ea-1', 'ev-2', 'confirmed', 'De novo.', T2)).toEqual({
			ok: false,
			error: { kind: 'external_action_not_open' }
		});
	});

	it('completeExternalAction erro evidence_learning_required para texto vazio ou só espaços — não cria Evidence nem conclui a ação', () => {
		const state = stateWithOpenAction();
		for (const learning of ['', '   ']) {
			const result = completeExternalAction(catalog, state, 'ea-1', 'ev-1', 'confirmed', learning, T2);
			expect(result).toEqual({ ok: false, error: { kind: 'evidence_learning_required' } });
		}
	});

	it('os quatro outcomes são aceitos e persistidos', () => {
		const outcomes = ['confirmed', 'partially_confirmed', 'contradicted', 'new_discovery'] as const;
		let state = stateWithGroup();
		outcomes.forEach((outcome, index) => {
			const actionId = `ea-${index}`;
			state = unwrap(prepareExternalAction(catalog, state, actionId, 'ag-1', preparation, T1));
			state = unwrap(completeExternalAction(catalog, state, actionId, `ev-${index}`, outcome, 'Aprendi.', T2));
		});
		expect(state.evidences.map((e) => e.outcome)).toEqual(outcomes);
	});

	it('uma nova validação do mesmo grupo é permitida depois que a anterior foi concluída (AffectedGroup nunca fica "validado")', () => {
		const completed = unwrap(
			completeExternalAction(catalog, stateWithOpenAction(), 'ea-1', 'ev-1', 'confirmed', 'Aprendi.', T2)
		);
		const reopened = unwrap(prepareExternalAction(catalog, completed, 'ea-2', 'ag-1', preparation, T2));
		expect(reopened.externalActions.map((a) => ({ id: a.id, status: a.status }))).toEqual([
			{ id: 'ea-1', status: 'concluida' },
			{ id: 'ea-2', status: 'aberta' }
		]);
	});

	it('removeAffectedGroup é bloqueado quando o grupo tem ExternalAction relacionada (aberta)', () => {
		expect(removeAffectedGroup(catalog, stateWithOpenAction(), 'ag-1')).toEqual({
			ok: false,
			error: { kind: 'affected_group_has_references' }
		});
	});

	it('removeAffectedGroup é bloqueado quando o grupo tem Evidence relacionada (ação já concluída)', () => {
		const completed = unwrap(
			completeExternalAction(catalog, stateWithOpenAction(), 'ea-1', 'ev-1', 'confirmed', 'Aprendi.', T2)
		);
		expect(removeAffectedGroup(catalog, completed, 'ag-1')).toEqual({
			ok: false,
			error: { kind: 'affected_group_has_references' }
		});
	});
});

describe('confirmPlanningPriority (C5-01)', () => {
	function withPlanningItems(state: ProjectState, items: { id: string; text: string }[]): ProjectState {
		return unwrap(
			answerActivity(catalog, state, 'decompor_trabalho', { partes_trabalho: encodePlanningItems(items) }, T1)
		);
	}

	it('rejeita com planning_no_items quando a coleção de "Decompor o trabalho" está vazia', () => {
		const result = confirmPlanningPriority(catalog, freshState(), T1);
		expect(result).toEqual({ ok: false, error: { kind: 'planning_no_items' } });
	});

	it('conclui "Priorizar entregas" quando há ao menos um item', () => {
		const withItems = withPlanningItems(freshState(), [{ id: 'p1', text: 'Parte 1' }]);
		const state = unwrap(confirmPlanningPriority(catalog, withItems, T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(progress?.status).toBe('concluída');
	});

	it('erro transition_not_allowed ao confirmar uma prioridade já concluída', () => {
		const withItems = withPlanningItems(freshState(), [{ id: 'p1', text: 'Parte 1' }]);
		const state = unwrap(confirmPlanningPriority(catalog, withItems, T1));
		const result = confirmPlanningPriority(catalog, state, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('permite pular "Priorizar entregas" mesmo sendo explicit_confirmation (allowsSkip true)', () => {
		const withItems = withPlanningItems(freshState(), [{ id: 'p1', text: 'Parte 1' }]);
		const skipped = unwrap(skipActivity(catalog, withItems, 'priorizar_entregas', 'pend-1', T1));
		const progress = skipped.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(progress?.status).toBe('pulada');
		expect(skipped.pendingItems).toEqual([
			{ id: 'pend-1', projectId: 'proj-1', activityDefinitionId: 'priorizar_entregas', status: 'aberta', createdAt: T1 }
		]);
	});

	it('resolve a pendência aberta ao confirmar uma prioridade que estava pulada', () => {
		const withItems = withPlanningItems(freshState(), [{ id: 'p1', text: 'Parte 1' }]);
		const skipped = unwrap(skipActivity(catalog, withItems, 'priorizar_entregas', 'pend-1', T1));
		const confirmed = unwrap(confirmPlanningPriority(catalog, skipped, T2));
		const progress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(progress?.status).toBe('concluída');
		expect(confirmed.pendingItems[0].status).toBe('resolvida');
	});

	it('editar "Decompor o trabalho" depois de "Priorizar entregas" confirmada NÃO reabre a confirmação nem cria pendência (comportamento silencioso, C5-01)', () => {
		const withItems = withPlanningItems(freshState(), [{ id: 'p1', text: 'Parte 1' }]);
		const confirmed = unwrap(confirmPlanningPriority(catalog, withItems, T1));

		const edited = unwrap(
			answerActivity(
				catalog,
				confirmed,
				'decompor_trabalho',
				{
					partes_trabalho: encodePlanningItems([
						{ id: 'p1', text: 'Parte 1' },
						{ id: 'p2', text: 'Parte 2 adicionada depois' }
					])
				},
				T2
			)
		);

		const priorizarProgress = edited.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(priorizarProgress?.status).toBe('concluída');
		expect(edited.pendingItems).toHaveLength(0);
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

describe('setRouteStartPhase', () => {
	it('aceita null e define Project.routeStartPhaseId com o id de uma fase existente', () => {
		const state = unwrap(setRouteStartPhase(catalog, freshState(), 'estruturacao'));
		expect(state.project.routeStartPhaseId).toBe('estruturacao');
	});

	it('rejeita um id de fase inexistente no catálogo', () => {
		const result = setRouteStartPhase(catalog, freshState(), 'fase-inexistente');
		expect(result).toEqual({ ok: false, error: { kind: 'phase_not_found' } });
	});

	it('phaseId null restaura o percurso completo', () => {
		const withRoute = unwrap(setRouteStartPhase(catalog, freshState(), 'estruturacao'));
		const restored = unwrap(setRouteStartPhase(catalog, withRoute, null));
		expect(restored.project.routeStartPhaseId).toBeNull();
	});

	it('não altera ActivityProgress de nenhuma atividade', () => {
		const before = freshState();
		const after = unwrap(setRouteStartPhase(catalog, before, 'estruturacao'));
		expect(after.activityProgress).toEqual(before.activityProgress);
	});

	it('é idempotente quando o valor já está definido', () => {
		const withRoute = unwrap(setRouteStartPhase(catalog, freshState(), 'estruturacao'));
		const again = unwrap(setRouteStartPhase(catalog, withRoute, 'estruturacao'));
		expect(again).toBe(withRoute);
	});
});

describe('getScopeConfirmationIssues', () => {
	it('sem itens: no_items, no_now_items e missing_hypothesis (missing_effort é vacuamente satisfeito)', () => {
		const state = freshState();
		expect(getScopeConfirmationIssues(state.scopeItems, state.scopeVersion)).toEqual([
			{ kind: 'no_items' },
			{ kind: 'no_now_items' },
			{ kind: 'missing_hypothesis' }
		]);
	});

	it('array vazio quando todos os critérios são atendidos', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		expect(getScopeConfirmationIssues(state.scopeItems, state.scopeVersion)).toEqual([]);
	});

	it('no_now_items quando só há itens fora de agora', () => {
		const state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'depois', T1));
		const issues = getScopeConfirmationIssues(state.scopeItems, state.scopeVersion);
		expect(issues).toContainEqual({ kind: 'no_now_items' });
		expect(issues).not.toContainEqual({ kind: 'no_items' });
	});

	it('missing_effort só considera itens em agora, com os ids exatos que faltam', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Em agora', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Fora de agora', 'fora', T1));
		const issues = getScopeConfirmationIssues(state.scopeItems, state.scopeVersion);
		expect(issues).toContainEqual({ kind: 'missing_effort', itemIds: ['item-1'] });
		expect(issues).not.toContainEqual({ kind: 'no_now_items' });
	});

	it('missing_hypothesis para hipótese só com espaços', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, '   '));
		expect(getScopeConfirmationIssues(state.scopeItems, state.scopeVersion)).toEqual([
			{ kind: 'missing_hypothesis' }
		]);
	});
});

describe('addScopeItem', () => {
	it('item novo em "agora" recebe order 0 quando é o primeiro', () => {
		const state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Primeiro', 'agora', T1));
		expect(state.scopeItems).toEqual([
			{
				id: 'item-1',
				projectId: 'proj-1',
				text: 'Primeiro',
				bucket: 'agora',
				effort: null,
				order: 0,
				sourceSuggestionId: null,
				executionStatus: 'a_fazer',
				createdAt: T1,
				updatedAt: T1
			}
		]);
	});

	it('itens sucessivos em "agora" entram no fim (order contínuo)', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-3', 'Três', 'agora', T1));
		expect(state.scopeItems.map((i) => [i.id, i.order])).toEqual([
			['item-1', 0],
			['item-2', 1],
			['item-3', 2]
		]);
	});

	it('item novo fora de "agora" tem order null', () => {
		const state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Fora', 'fora', T1));
		expect(state.scopeItems[0].order).toBeNull();
	});

	it('item manual (sem sugestão) tem sourceSuggestionId null por padrão', () => {
		const state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Manual', 'agora', T1));
		expect(state.scopeItems[0].sourceSuggestionId).toBeNull();
	});

	it('item aceito a partir de uma sugestão mantém o sourceSuggestionId informado', () => {
		const state = unwrap(
			addScopeItem(catalog, freshState(), 'item-1', 'Reaproveitar informações já registradas', 'agora', T1, 'reuse_existing_information')
		);
		expect(state.scopeItems[0].sourceSuggestionId).toBe('reuse_existing_information');
	});

	it('editar o texto do item não remove a associação com a sugestão', () => {
		let state = unwrap(
			addScopeItem(catalog, freshState(), 'item-1', 'Texto original', 'agora', T1, 'reuse_existing_information')
		);
		state = unwrap(setScopeItemText(catalog, state, 'item-1', 'Texto revisado', T2));
		expect(state.scopeItems[0].sourceSuggestionId).toBe('reuse_existing_information');
	});

	it('adicionar item invalida uma confirmação existente', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));
		expect(state.scopeVersion.confirmedAt).toBe(T1);

		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'depois', T2));
		expect(state.scopeVersion.confirmedAt).toBeNull();
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'montar_proxima_versao');
		expect(progress?.status).toBe('em_andamento');
	});
});

describe('setScopeItemText / setScopeItemEffort', () => {
	it('erro scope_item_not_found para id inexistente', () => {
		expect(setScopeItemText(catalog, freshState(), 'inexistente', 'x', T1)).toEqual({
			ok: false,
			error: { kind: 'scope_item_not_found' }
		});
	});

	it('repetir o mesmo texto é no-op e não invalida confirmação', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Texto', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));

		const same = unwrap(setScopeItemText(catalog, state, 'item-1', 'Texto', T2));
		expect(same.scopeVersion.confirmedAt).toBe(T1);
	});

	it('mudar o texto invalida a confirmação existente', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Texto', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));

		const changed = unwrap(setScopeItemText(catalog, state, 'item-1', 'Texto novo', T2));
		expect(changed.scopeVersion.confirmedAt).toBeNull();
		expect(changed.scopeItems[0].text).toBe('Texto novo');
	});

	it('setScopeItemEffort atualiza o item e invalida confirmação em mudança real', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'grande', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));

		const reeffort = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T2));
		expect(reeffort.scopeItems[0].effort).toBe('pequeno');
		expect(reeffort.scopeVersion.confirmedAt).toBeNull();
	});

	it('effort de um item em "agora" não é limpo ao mover para "depois" ou "fora"', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'grande', T1));
		state = unwrap(moveScopeItem(catalog, state, 'item-1', 'fora', T2));
		expect(state.scopeItems[0].effort).toBe('grande');
	});

	it('effort permanece ao mover de volta para "agora" depois de ter saído', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'grande', T1));
		state = unwrap(moveScopeItem(catalog, state, 'item-1', 'depois', T2));
		state = unwrap(moveScopeItem(catalog, state, 'item-1', 'agora', T2));
		expect(state.scopeItems[0].effort).toBe('grande');
	});
});

describe('setScopeItemExecutionStatus', () => {
	function confirmedStateWithAgoraItem(): ProjectState {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));
		return state;
	}

	it('erro scope_item_not_found para id inexistente', () => {
		const state = confirmedStateWithAgoraItem();
		expect(setScopeItemExecutionStatus(catalog, state, 'inexistente', 'em_andamento', T2)).toEqual({
			ok: false,
			error: { kind: 'scope_item_not_found' }
		});
	});

	it('erro scope_item_not_agora para item em "depois" ou "fora"', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item agora', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Item depois', 'depois', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));

		expect(setScopeItemExecutionStatus(catalog, state, 'item-2', 'em_andamento', T2)).toEqual({
			ok: false,
			error: { kind: 'scope_item_not_agora' }
		});
	});

	it('erro scope_version_not_confirmed quando a versão de escopo ainda não foi confirmada', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Item', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));

		expect(setScopeItemExecutionStatus(catalog, state, 'item-1', 'em_andamento', T2)).toEqual({
			ok: false,
			error: { kind: 'scope_version_not_confirmed' }
		});
	});

	it('transita entre os três estados', () => {
		let state = confirmedStateWithAgoraItem();
		state = unwrap(setScopeItemExecutionStatus(catalog, state, 'item-1', 'em_andamento', T2));
		expect(state.scopeItems[0].executionStatus).toBe('em_andamento');

		state = unwrap(setScopeItemExecutionStatus(catalog, state, 'item-1', 'concluido', T2));
		expect(state.scopeItems[0].executionStatus).toBe('concluido');

		state = unwrap(setScopeItemExecutionStatus(catalog, state, 'item-1', 'a_fazer', T2));
		expect(state.scopeItems[0].executionStatus).toBe('a_fazer');
	});

	it('é idempotente quando o status já é o mesmo', () => {
		const state = confirmedStateWithAgoraItem();
		const result = setScopeItemExecutionStatus(catalog, state, 'item-1', 'a_fazer', T2);
		expect(result).toEqual({ ok: true, value: state });
	});

	it('não altera confirmedAt', () => {
		const state = confirmedStateWithAgoraItem();
		const changed = unwrap(setScopeItemExecutionStatus(catalog, state, 'item-1', 'em_andamento', T2));
		expect(changed.scopeVersion.confirmedAt).toBe(T1);
	});

	it('não altera texto, esforço, ordem, bucket ou outros itens', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-2', 'grande', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));

		const changed = unwrap(setScopeItemExecutionStatus(catalog, state, 'item-1', 'em_andamento', T2));
		const item1 = changed.scopeItems.find((i) => i.id === 'item-1')!;
		const item2 = changed.scopeItems.find((i) => i.id === 'item-2')!;
		expect(item1.text).toBe('Um');
		expect(item1.effort).toBe('pequeno');
		expect(item1.bucket).toBe('agora');
		expect(item1.order).toBe(0);
		expect(item2).toEqual(state.scopeItems.find((i) => i.id === 'item-2'));
	});
});

describe('moveScopeItem', () => {
	it('mover para "agora" a partir de outro bucket entra no fim', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'depois', T1));
		state = unwrap(moveScopeItem(catalog, state, 'item-2', 'agora', T2));

		const item2 = state.scopeItems.find((i) => i.id === 'item-2')!;
		expect(item2.order).toBe(1);
	});

	it('sair de "agora" zera order e fecha a lacuna dos itens restantes', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-3', 'Três', 'agora', T1));
		state = unwrap(moveScopeItem(catalog, state, 'item-2', 'fora', T2));

		expect(state.scopeItems.map((i) => [i.id, i.bucket, i.order])).toEqual([
			['item-1', 'agora', 0],
			['item-2', 'fora', null],
			['item-3', 'agora', 1]
		]);
	});

	it('mover para o mesmo bucket é no-op', () => {
		const state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		const result = unwrap(moveScopeItem(catalog, state, 'item-1', 'agora', T2));
		expect(result).toBe(state);
	});

	it('erro scope_item_not_found para id inexistente', () => {
		expect(moveScopeItem(catalog, freshState(), 'inexistente', 'agora', T1)).toEqual({
			ok: false,
			error: { kind: 'scope_item_not_found' }
		});
	});
});

describe('reorderAgoraItems', () => {
	function threeAgoraItems(): ProjectState {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-3', 'Três', 'agora', T1));
		return state;
	}

	it('reordena mantendo contiguidade 0..n-1', () => {
		const state = threeAgoraItems();
		const result = unwrap(reorderAgoraItems(catalog, state, ['item-3', 'item-1', 'item-2'], T2));
		expect(result.scopeItems.map((i) => [i.id, i.order])).toEqual([
			['item-1', 1],
			['item-2', 2],
			['item-3', 0]
		]);
	});

	it('erro scope_reorder_mismatch quando falta ou sobra um id', () => {
		const state = threeAgoraItems();
		expect(reorderAgoraItems(catalog, state, ['item-1', 'item-2'], T2)).toEqual({
			ok: false,
			error: { kind: 'scope_reorder_mismatch' }
		});
		expect(reorderAgoraItems(catalog, state, ['item-1', 'item-2', 'item-3', 'item-1'], T2)).toEqual({
			ok: false,
			error: { kind: 'scope_reorder_mismatch' }
		});
	});

	it('ordem idêntica é no-op', () => {
		const state = threeAgoraItems();
		const result = unwrap(reorderAgoraItems(catalog, state, ['item-1', 'item-2', 'item-3'], T2));
		expect(result).toBe(state);
	});
});

describe('removeScopeItem', () => {
	it('remove o item e fecha a lacuna de order em "agora"', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'agora', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-3', 'Três', 'agora', T1));

		const result = unwrap(removeScopeItem(catalog, state, 'item-2'));
		expect(result.scopeItems.map((i) => [i.id, i.order])).toEqual([
			['item-1', 0],
			['item-3', 1]
		]);
	});

	it('remover item invalida uma confirmação existente', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(addScopeItem(catalog, state, 'item-2', 'Dois', 'depois', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));

		const result = unwrap(removeScopeItem(catalog, state, 'item-2'));
		expect(result.scopeVersion.confirmedAt).toBeNull();
	});

	it('erro scope_item_not_found para id inexistente', () => {
		expect(removeScopeItem(catalog, freshState(), 'inexistente')).toEqual({
			ok: false,
			error: { kind: 'scope_item_not_found' }
		});
	});
});

describe('setHypothesis', () => {
	it('define a hipótese e invalida confirmação em mudança real', () => {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Original'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));

		const changed = unwrap(setHypothesis(catalog, state, 'Nova hipótese'));
		expect(changed.scopeVersion.hypothesis).toBe('Nova hipótese');
		expect(changed.scopeVersion.confirmedAt).toBeNull();
	});

	it('repetir o mesmo texto é no-op', () => {
		const state = unwrap(setHypothesis(catalog, freshState(), 'Hipótese'));
		const result = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		expect(result).toBe(state);
	});
});

describe('confirmScopeVersion', () => {
	function validState(): ProjectState {
		let state = unwrap(addScopeItem(catalog, freshState(), 'item-1', 'Um', 'agora', T1));
		state = unwrap(setScopeItemEffort(catalog, state, 'item-1', 'pequeno', T1));
		return unwrap(setHypothesis(catalog, state, 'Hipótese'));
	}

	it('confirma e conclui montar_proxima_versao quando todos os critérios são atendidos', () => {
		const result = unwrap(confirmScopeVersion(catalog, validState(), T1));
		expect(result.scopeVersion.confirmedAt).toBe(T1);
		const progress = result.activityProgress.find((p) => p.activityDefinitionId === 'montar_proxima_versao');
		expect(progress?.status).toBe('concluída');
	});

	it('erro scope_confirmation_invalid com os issues pendentes', () => {
		const result = confirmScopeVersion(catalog, freshState(), T1);
		expect(result).toEqual({
			ok: false,
			error: {
				kind: 'scope_confirmation_invalid',
				issues: [{ kind: 'no_items' }, { kind: 'no_now_items' }, { kind: 'missing_hypothesis' }]
			}
		});
	});

	it('erro transition_not_allowed ao confirmar de novo sem edição', () => {
		const state = unwrap(confirmScopeVersion(catalog, validState(), T1));
		expect(confirmScopeVersion(catalog, state, T2)).toEqual({
			ok: false,
			error: { kind: 'transition_not_allowed', from: 'concluída' }
		});
	});

	it('depois de invalidada por edição, confirmar de novo funciona', () => {
		let state = unwrap(confirmScopeVersion(catalog, validState(), T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese revisada'));
		const reconfirmed = unwrap(confirmScopeVersion(catalog, state, T2));
		expect(reconfirmed.scopeVersion.confirmedAt).toBe(T2);
	});
});

describe('addImpediment', () => {
	it('cria um Impediment aberto, sem nextAction, com timestamps iguais a occurredAt', () => {
		const state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Falta acesso ao ambiente', 'falta_de_recurso', T1));
		expect(state.impediments).toEqual([
			{
				id: 'imp-1',
				projectId: 'proj-1',
				text: 'Falta acesso ao ambiente',
				tipo: 'falta_de_recurso',
				nextAction: null,
				status: 'aberto',
				createdAt: T1,
				updatedAt: T1,
				resolvedAt: null
			}
		]);
	});

	it('acumula múltiplos impedimentos sem afetar os já existentes', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Um', 'outro', T1));
		state = unwrap(addImpediment(catalog, state, 'imp-2', 'Dois', 'bloqueio_tecnico', T1));
		expect(state.impediments.map((i) => i.id)).toEqual(['imp-1', 'imp-2']);
	});

	it('erro impediment_id_already_exists ao reutilizar um impedimentId existente, sem alterar o estado', () => {
		const state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Um', 'outro', T1));
		const result = addImpediment(catalog, state, 'imp-1', 'Outro texto', 'bloqueio_tecnico', T2);
		expect(result).toEqual({ ok: false, error: { kind: 'impediment_id_already_exists' } });
		expect(state.impediments).toHaveLength(1);
	});
});

describe('setImpedimentType', () => {
	it('atualiza tipo e updatedAt', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(setImpedimentType(catalog, state, 'imp-1', 'decisao_pendente', T2));
		expect(state.impediments[0].tipo).toBe('decisao_pendente');
		expect(state.impediments[0].updatedAt).toBe(T2);
	});

	it('mesmo tipo: no-op, não altera updatedAt', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(setImpedimentType(catalog, state, 'imp-1', 'outro', T2));
		expect(state.impediments[0].updatedAt).toBe(T1);
	});

	it('erro impediment_not_found para id inexistente', () => {
		const result = setImpedimentType(catalog, freshState(), 'nao-existe', 'outro', T1);
		expect(result).toEqual({ ok: false, error: { kind: 'impediment_not_found' } });
	});
});

describe('setImpedimentNextAction', () => {
	it('define a próxima ação e atualiza updatedAt', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(setImpedimentNextAction(catalog, state, 'imp-1', 'Solicitar acesso à TI', T2));
		expect(state.impediments[0].nextAction).toBe('Solicitar acesso à TI');
		expect(state.impediments[0].updatedAt).toBe(T2);
	});

	it('aceita voltar a null (limpar a próxima ação)', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(setImpedimentNextAction(catalog, state, 'imp-1', 'Ação', T2));
		state = unwrap(setImpedimentNextAction(catalog, state, 'imp-1', null, T2));
		expect(state.impediments[0].nextAction).toBeNull();
	});

	it('mesmo valor (incluindo null→null): no-op', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(setImpedimentNextAction(catalog, state, 'imp-1', null, T2));
		expect(state.impediments[0].updatedAt).toBe(T1);
	});

	it('erro impediment_not_found para id inexistente', () => {
		const result = setImpedimentNextAction(catalog, freshState(), 'nao-existe', 'Ação', T1);
		expect(result).toEqual({ ok: false, error: { kind: 'impediment_not_found' } });
	});
});

describe('resolveImpediment / reopenImpediment', () => {
	it('resolve: status vira resolvido, resolvedAt e updatedAt = occurredAt', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(resolveImpediment(catalog, state, 'imp-1', T2));
		expect(state.impediments[0]).toMatchObject({ status: 'resolvido', resolvedAt: T2, updatedAt: T2 });
	});

	it('resolver um já resolvido é no-op (idempotente)', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(resolveImpediment(catalog, state, 'imp-1', T2));
		const resolvedAgain = unwrap(resolveImpediment(catalog, state, 'imp-1', '2026-01-03T00:00:00.000Z'));
		expect(resolvedAgain.impediments[0].resolvedAt).toBe(T2);
		expect(resolvedAgain.impediments[0].updatedAt).toBe(T2);
	});

	it('reopen: status volta a aberto, resolvedAt volta a null', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(resolveImpediment(catalog, state, 'imp-1', T2));
		state = unwrap(reopenImpediment(catalog, state, 'imp-1', '2026-01-03T00:00:00.000Z'));
		expect(state.impediments[0]).toMatchObject({
			status: 'aberto',
			resolvedAt: null,
			updatedAt: '2026-01-03T00:00:00.000Z'
		});
	});

	it('reabrir um já aberto é no-op (idempotente)', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		const reopened = unwrap(reopenImpediment(catalog, state, 'imp-1', T2));
		expect(reopened.impediments[0].updatedAt).toBe(T1);
	});

	it('erro impediment_not_found para id inexistente em ambas', () => {
		expect(resolveImpediment(catalog, freshState(), 'nao-existe', T1)).toEqual({
			ok: false,
			error: { kind: 'impediment_not_found' }
		});
		expect(reopenImpediment(catalog, freshState(), 'nao-existe', T1)).toEqual({
			ok: false,
			error: { kind: 'impediment_not_found' }
		});
	});
});
