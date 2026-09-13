import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';
import {
	addChange,
	addDecision,
	addDeliverable,
	addDependency,
	applySchedulePropagation,
	computeSchedulePropagationPlan,
	findWorkItemKnownFreeSlack,
	findWorkItemPrecedenceConflict,
	removeDependency,
	addMilestone,
	setMilestonePlannedDate,
	addWorkItem,
	moveWorkItem,
	setWorkItemSchedule,
	linkWorkItemToDecision,
	linkWorkItemToMilestone,
	reachMilestone,
	reopenMilestone,
	unlinkWorkItemFromDecision,
	unlinkWorkItemFromMilestone,
	addAffectedGroup,
	addCauseHypothesis,
	addDesiredOutcome,
	addImpediment,
	addScopeItem,
	addTreatmentStep,
	answerActivity,
	completeExternalAction,
	confirmAffectedGroups,
	confirmCauseHypotheses,
	confirmDecisionsAndChangesReview,
	confirmDecomposition,
	confirmDependencyMapping,
	confirmMilestoneReview,
	confirmDesiredOutcomes,
	confirmPlanningPriority,
	confirmScopeVersion,
	confirmSummary,
	confirmTreatment,
	decideDecision,
	editChangeStatement,
	editDecision,
	editDecisionOutcome,
	setChangeImpact,
	getAffectedGroupConfirmationIssues,
	getCauseHypothesesConfirmationIssues,
	getDesiredOutcomeConfirmationIssues,
	getScopeConfirmationIssues,
	getTreatmentConfirmationIssues,
	isActivityFieldsValid,
	markCauseExplorationUnknown,
	moveDesiredOutcome,
	moveScopeItem,
	moveTreatmentStep,
	prepareExternalAction,
	removeAffectedGroup,
	removeCauseHypothesis,
	removeDesiredOutcome,
	removeScopeItem,
	removeTreatmentStep,
	renameProject,
	reopenImpediment,
	reorderAgoraItems,
	resolveImpediment,
	setAffectedGroupFrequency,
	setAffectedGroupImpact,
	setCauseHypothesisExpectedIfTrue,
	setCauseHypothesisTitle,
	setCauseHypothesisWhatWeakensIt,
	setDesiredOutcomeChange,
	setDesiredOutcomeTarget,
	setHypothesis,
	setImpedimentDecision,
	setImpedimentNextAction,
	setImpedimentType,
	setRouteStartPhase,
	setScopeItemEffort,
	setScopeItemExecutionStatus,
	setScopeItemText,
	setTreatmentNoTreatment,
	setTreatmentStepActors,
	setTreatmentStepMedium,
	shouldInvalidateSummary,
	skipActivity,
	toggleCauseHypothesisEvidence,
	toggleTreatmentStepFriction,
	undoCauseExplorationUnknown
} from './transitions';
import { encodePlanningItems } from './planning-items';
import type { Catalog, RequiredFieldsActivity } from './catalog-types';
import type { ProjectState } from './state-types';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';
const T3 = '2026-01-03T00:00:00.000Z';
const T4 = '2026-01-04T00:00:00.000Z';

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

	// Nenhuma atividade do catálogo real usa mais dataTarget: 'answer'/type:
	// 'lista_partes' desde S9 (reconciliação da decomposição legada) —
	// "Decompor o trabalho" virou explicit_confirmation contra WorkItem
	// (domain/transitions.ts, confirmDecomposition). O tipo de campo em si
	// continua suportado genericamente por isActivityFieldsValid (infra
	// compartilhada com o formato legado de PlanningItem[] gravado antes
	// desta mudança) — cobrir via fixture local, mesmo padrão de
	// fixture_project_property acima.
	const listaPartesActivity: RequiredFieldsActivity = {
		id: 'fixture_lista_partes',
		phaseId: 'planejamento',
		order: 1,
		title: 'Fixture de teste',
		mainQuestion: 'Pergunta fabricada de teste?',
		why: 'Fixture de teste.',
		example: 'Fixture de teste.',
		completionCriteria: 'Ao menos uma parte com texto próprio.',
		completionMode: 'required_fields',
		allowsSkip: true,
		pendingItemLabel: 'Pendência fabricada de teste',
		pendingItemDetail: 'Fixture de teste.',
		fields: [
			{
				id: 'partes_trabalho',
				activityId: 'fixture_lista_partes',
				label: 'Partes do trabalho',
				required: true,
				dataTarget: 'answer',
				type: 'lista_partes'
			}
		]
	};
	const listaPartesCatalog: Catalog = {
		phases: [{ id: 'planejamento', order: 1, label: 'Planejamento', catalogStatus: 'complete', activities: [listaPartesActivity] }]
	};

	it('lista_partes (C5-01, infra genérica): é false quando a coleção está vazia', () => {
		const state = createInitialProjectState(listaPartesCatalog, 'proj-1', T1);
		expect(isActivityFieldsValid(listaPartesActivity, state)).toBe(false);
	});

	it('lista_partes: é true quando há ao menos um item com texto não vazio', () => {
		const state = createInitialProjectState(listaPartesCatalog, 'proj-1', T1);
		const answered = unwrap(
			answerActivity(
				listaPartesCatalog,
				state,
				'fixture_lista_partes',
				{ partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Tela de abertura' }]) },
				T1
			)
		);
		expect(isActivityFieldsValid(listaPartesActivity, answered)).toBe(true);
	});

	it('lista_partes: é false quando todo item tem texto vazio (defesa contra escrita malformada)', () => {
		const state = createInitialProjectState(listaPartesCatalog, 'proj-1', T1);
		const answered = unwrap(
			answerActivity(
				listaPartesCatalog,
				state,
				'fixture_lista_partes',
				{ partes_trabalho: encodePlanningItems([{ id: 'p1', text: '   ' }]) },
				T1
			)
		);
		expect(isActivityFieldsValid(listaPartesActivity, answered)).toBe(false);
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
		const state = unwrap(answerActivity(catalog, freshState(), 'problema', { situacao: 'Clientes' }, T1));
		const answer = state.answers.find((a) => a.fieldDefinitionId === 'situacao');
		expect(answer).toEqual({
			projectId: 'proj-1',
			activityDefinitionId: 'problema',
			fieldDefinitionId: 'situacao',
			value: 'Clientes',
			createdAt: T1,
			updatedAt: T1
		});
	});

	it('resposta idêntica não altera timestamps nem cria uma segunda Answer', () => {
		const first = unwrap(answerActivity(catalog, freshState(), 'problema', { situacao: 'Clientes' }, T1));
		const second = unwrap(answerActivity(catalog, first, 'problema', { situacao: 'Clientes' }, T2));
		expect(second.answers).toEqual(first.answers); // updatedAt continua T1, não vira T2
		expect(second.answers).toHaveLength(1);
	});

	it('resposta diferente atualiza updatedAt mas preserva createdAt', () => {
		const first = unwrap(answerActivity(catalog, freshState(), 'problema', { situacao: 'Clientes' }, T1));
		const second = unwrap(
			answerActivity(catalog, first, 'problema', { situacao: 'Clientes e atendentes' }, T2)
		);
		const answer = second.answers.find((a) => a.fieldDefinitionId === 'situacao');
		expect(answer).toEqual({
			projectId: 'proj-1',
			activityDefinitionId: 'problema',
			fieldDefinitionId: 'situacao',
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
		const answered = unwrap(answerActivity(catalog, withSummary, 'problema', { situacao: 'Clientes' }, T2));
		const resumo = answered.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});

	it('mudança repetindo o mesmo valor não invalida o Resumo já concluída', () => {
		const answered = unwrap(answerActivity(catalog, freshState(), 'problema', { situacao: 'Clientes' }, T1));
		const withSummary = unwrap(confirmSummary(catalog, answered));
		const reanswered = unwrap(answerActivity(catalog, withSummary, 'problema', { situacao: 'Clientes' }, T2));
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

describe('confirmDecomposition (S9)', () => {
	it('rejeita com decomposition_no_work_items quando o projeto não tem nenhum WorkItem', () => {
		const result = confirmDecomposition(catalog, freshState(), T1);
		expect(result).toEqual({ ok: false, error: { kind: 'decomposition_no_work_items' } });
	});

	it('PlanningItem legado (partes_trabalho) sozinho NÃO basta para confirmar — só WorkItem conta', () => {
		// Simula um projeto antigo: Answer legado gravado diretamente no estado
		// (não via answerActivity — decompor_trabalho não é mais required_fields,
		// ver teste "answerActivity recusa..." abaixo), sem nenhum WorkItem real.
		const legacyState: ProjectState = {
			...freshState(),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'decompor_trabalho',
					fieldDefinitionId: 'partes_trabalho',
					value: encodePlanningItems([{ id: 'p1', text: 'Parte legada' }]),
					createdAt: T1,
					updatedAt: T1
				}
			]
		};
		const result = confirmDecomposition(catalog, legacyState, T1);
		expect(result).toEqual({ ok: false, error: { kind: 'decomposition_no_work_items' } });
	});

	it('conclui "Decompor o trabalho" quando há ao menos um WorkItem real', () => {
		const withWorkItem = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item real', T1));
		const state = unwrap(confirmDecomposition(catalog, withWorkItem, T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'decompor_trabalho');
		expect(progress?.status).toBe('concluída');
	});

	it('erro transition_not_allowed ao confirmar uma decomposição já concluída', () => {
		const withWorkItem = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item real', T1));
		const state = unwrap(confirmDecomposition(catalog, withWorkItem, T1));
		const result = confirmDecomposition(catalog, state, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('permite pular "Decompor o trabalho" mesmo sendo explicit_confirmation (allowsSkip true)', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'decompor_trabalho', 'pend-1', T1));
		const progress = skipped.activityProgress.find((p) => p.activityDefinitionId === 'decompor_trabalho');
		expect(progress?.status).toBe('pulada');
		expect(skipped.pendingItems).toEqual([
			{ id: 'pend-1', projectId: 'proj-1', activityDefinitionId: 'decompor_trabalho', status: 'aberta', createdAt: T1 }
		]);
	});

	it('skip → pending → WorkItem canônico → confirmação resolve a pendência (falsificador do fluxo completo)', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'decompor_trabalho', 'pend-1', T1));
		const withWorkItem = unwrap(addWorkItem(catalog, skipped, 'wi-1', 'Item real', T2));
		const confirmed = unwrap(confirmDecomposition(catalog, withWorkItem, T3));
		const progress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'decompor_trabalho');
		expect(progress?.status).toBe('concluída');
		expect(confirmed.pendingItems[0].status).toBe('resolvida');
	});

	it('answerActivity recusa "decompor_trabalho" com wrong_completion_mode — não é mais required_fields, nunca escreve PlanningItem novo', () => {
		const result = answerActivity(
			catalog,
			freshState(),
			'decompor_trabalho',
			{ partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Parte nova' }]) },
			T1
		);
		expect(result).toEqual({ ok: false, error: { kind: 'wrong_completion_mode' } });
	});
});

describe('confirmPlanningPriority (S9)', () => {
	it('rejeita com priorization_no_deliverables quando o projeto não tem nenhuma Deliverable', () => {
		const result = confirmPlanningPriority(catalog, freshState(), T1);
		expect(result).toEqual({ ok: false, error: { kind: 'priorization_no_deliverables' } });
	});

	it('PlanningItem legado (partes_trabalho) sozinho NÃO basta para confirmar — só Deliverable conta', () => {
		const legacyState: ProjectState = {
			...freshState(),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'decompor_trabalho',
					fieldDefinitionId: 'partes_trabalho',
					value: encodePlanningItems([{ id: 'p1', text: 'Parte legada' }]),
					createdAt: T1,
					updatedAt: T1
				}
			]
		};
		const result = confirmPlanningPriority(catalog, legacyState, T1);
		expect(result).toEqual({ ok: false, error: { kind: 'priorization_no_deliverables' } });
	});

	it('conclui "Priorizar entregas" quando há ao menos uma Deliverable real', () => {
		const withDeliverable = unwrap(addDeliverable(catalog, freshState(), 'd-1', 'Entrega real', 'agora', T1));
		const state = unwrap(confirmPlanningPriority(catalog, withDeliverable, T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(progress?.status).toBe('concluída');
	});

	it('erro transition_not_allowed ao confirmar uma prioridade já concluída', () => {
		const withDeliverable = unwrap(addDeliverable(catalog, freshState(), 'd-1', 'Entrega real', 'agora', T1));
		const state = unwrap(confirmPlanningPriority(catalog, withDeliverable, T1));
		const result = confirmPlanningPriority(catalog, state, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('permite pular "Priorizar entregas" mesmo sendo explicit_confirmation (allowsSkip true)', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'priorizar_entregas', 'pend-1', T1));
		const progress = skipped.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(progress?.status).toBe('pulada');
		expect(skipped.pendingItems).toEqual([
			{ id: 'pend-1', projectId: 'proj-1', activityDefinitionId: 'priorizar_entregas', status: 'aberta', createdAt: T1 }
		]);
	});

	it('skip → pending → Deliverable canônica → confirmação resolve a pendência (falsificador do fluxo completo)', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'priorizar_entregas', 'pend-1', T1));
		const withDeliverable = unwrap(addDeliverable(catalog, skipped, 'd-1', 'Entrega real', 'agora', T2));
		const confirmed = unwrap(confirmPlanningPriority(catalog, withDeliverable, T3));
		const progress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'priorizar_entregas');
		expect(progress?.status).toBe('concluída');
		expect(confirmed.pendingItems[0].status).toBe('resolvida');
	});
});

// S9 (reconciliação de dependências legadas) — ao contrário de
// confirmDecomposition/confirmPlanningPriority acima, ZERO Dependency é
// resultado válido: confirmar significa "revisei o estado real", nunca
// "existe pelo menos um fato". Falsificadores centrais: confirma com zero,
// confirma com uma Dependency real, nunca cria/altera Dependency, e o Answer
// legado nunca ganha autoridade (nem impede, nem substitui a confirmação).
describe('confirmDependencyMapping (S9)', () => {
	it('conclui "Mapear dependências" com ZERO Dependency — 0 é resultado válido, nunca recusado', () => {
		const state = unwrap(confirmDependencyMapping(catalog, freshState(), T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'mapear_dependencias');
		expect(progress?.status).toBe('concluída');
		expect(state.dependencies).toEqual([]);
	});

	it('conclui "Mapear dependências" quando existe uma Dependency real, sem alterá-la', () => {
		let withDependency = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		withDependency = unwrap(addWorkItem(catalog, withDependency, 'wi-b', 'B', T1));
		withDependency = unwrap(addDependency(catalog, withDependency, 'dep-1', 'wi-a', 'wi-b', T1));
		const state = unwrap(confirmDependencyMapping(catalog, withDependency, T2));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'mapear_dependencias');
		expect(progress?.status).toBe('concluída');
		expect(state.dependencies).toEqual(withDependency.dependencies);
	});

	it('Answer legado (dependencias_trabalho) sozinho não impede nem é exigido para confirmar', () => {
		const legacyState: ProjectState = {
			...freshState(),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'mapear_dependencias',
					fieldDefinitionId: 'dependencias_trabalho',
					value: 'A depende de B; B depende de C',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};
		const state = unwrap(confirmDependencyMapping(catalog, legacyState, T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'mapear_dependencias');
		expect(progress?.status).toBe('concluída');
		expect(state.dependencies).toEqual([]);
	});

	it('erro transition_not_allowed ao confirmar uma revisão já concluída', () => {
		const state = unwrap(confirmDependencyMapping(catalog, freshState(), T1));
		const result = confirmDependencyMapping(catalog, state, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('permite pular "Mapear dependências" mesmo sendo explicit_confirmation (allowsSkip true)', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'mapear_dependencias', 'pend-1', T1));
		const progress = skipped.activityProgress.find((p) => p.activityDefinitionId === 'mapear_dependencias');
		expect(progress?.status).toBe('pulada');
		expect(skipped.pendingItems).toEqual([
			{ id: 'pend-1', projectId: 'proj-1', activityDefinitionId: 'mapear_dependencias', status: 'aberta', createdAt: T1 }
		]);
	});

	it('skip → pending → retomar → confirmação resolve a pendência, mesmo com ZERO Dependency', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'mapear_dependencias', 'pend-1', T1));
		const confirmed = unwrap(confirmDependencyMapping(catalog, skipped, T2));
		const progress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'mapear_dependencias');
		expect(progress?.status).toBe('concluída');
		expect(confirmed.pendingItems[0].status).toBe('resolvida');
	});

	it('answerActivity recusa "mapear_dependencias" com wrong_completion_mode — não é mais required_fields, nunca escreve Answer novo', () => {
		const result = answerActivity(
			catalog,
			freshState(),
			'mapear_dependencias',
			{ dependencias_trabalho: 'Nova dependência via texto livre' },
			T1
		);
		expect(result).toEqual({ ok: false, error: { kind: 'wrong_completion_mode' } });
	});
});

// S9 (reconciliação de marcos legados) — mesmo molde de confirmDependencyMapping
// acima: ZERO Milestone é resultado válido, confirmar significa "revisei o
// estado real", nunca "existe pelo menos um fato". Falsificadores centrais:
// confirma com zero, confirma com um Milestone real sem alterar lifecycle/
// plannedDate/relações, nunca cria/altera Milestone, e o Answer legado nunca
// ganha autoridade (nem impede, nem substitui a confirmação).
describe('confirmMilestoneReview (S9)', () => {
	it('conclui "Definir marcos" com ZERO Milestone — 0 é resultado válido, nunca recusado', () => {
		const state = unwrap(confirmMilestoneReview(catalog, freshState(), T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'definir_marcos');
		expect(progress?.status).toBe('concluída');
		expect(state.milestones).toEqual([]);
	});

	it('conclui "Definir marcos" quando existe um Milestone real, sem alterar lifecycle/plannedDate/relações', () => {
		const withMilestone = unwrap(addMilestone(catalog, freshState(), 'ms-1', 'Marco real', T1));
		const state = unwrap(confirmMilestoneReview(catalog, withMilestone, T2));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'definir_marcos');
		expect(progress?.status).toBe('concluída');
		expect(state.milestones).toEqual(withMilestone.milestones);
	});

	it('Answer legado (marcos_principais) sozinho não impede nem é exigido para confirmar', () => {
		const legacyState: ProjectState = {
			...freshState(),
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'definir_marcos',
					fieldDefinitionId: 'marcos_principais',
					value: 'Marco 1: tela de abertura funcionando',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};
		const state = unwrap(confirmMilestoneReview(catalog, legacyState, T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'definir_marcos');
		expect(progress?.status).toBe('concluída');
		expect(state.milestones).toEqual([]);
	});

	it('erro transition_not_allowed ao confirmar uma revisão já concluída', () => {
		const state = unwrap(confirmMilestoneReview(catalog, freshState(), T1));
		const result = confirmMilestoneReview(catalog, state, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('permite pular "Definir marcos" mesmo sendo explicit_confirmation (allowsSkip true)', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'definir_marcos', 'pend-1', T1));
		const progress = skipped.activityProgress.find((p) => p.activityDefinitionId === 'definir_marcos');
		expect(progress?.status).toBe('pulada');
		expect(skipped.pendingItems).toEqual([
			{ id: 'pend-1', projectId: 'proj-1', activityDefinitionId: 'definir_marcos', status: 'aberta', createdAt: T1 }
		]);
	});

	it('skip → pending → retomar → confirmação resolve a pendência, mesmo com ZERO Milestone', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'definir_marcos', 'pend-1', T1));
		const confirmed = unwrap(confirmMilestoneReview(catalog, skipped, T2));
		const progress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'definir_marcos');
		expect(progress?.status).toBe('concluída');
		expect(confirmed.pendingItems[0].status).toBe('resolvida');
	});

	it('answerActivity recusa "definir_marcos" com wrong_completion_mode — não é mais required_fields, nunca escreve Answer novo', () => {
		const result = answerActivity(
			catalog,
			freshState(),
			'definir_marcos',
			{ marcos_principais: 'Novo marco via texto livre' },
			T1
		);
		expect(result).toEqual({ ok: false, error: { kind: 'wrong_completion_mode' } });
	});
});

describe('confirmDecisionsAndChangesReview (S11)', () => {
	it('conclui "Registrar decisões e mudanças" com ZERO Decision/Change — 0 é resultado válido, nunca recusado', () => {
		const state = unwrap(confirmDecisionsAndChangesReview(catalog, freshState(), T1));
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'decisoes_mudancas');
		expect(progress?.status).toBe('concluída');
		expect(state.decisions).toEqual([]);
		expect(state.changes).toEqual([]);
	});

	it('erro transition_not_allowed ao confirmar uma revisão já concluída', () => {
		const state = unwrap(confirmDecisionsAndChangesReview(catalog, freshState(), T1));
		const result = confirmDecisionsAndChangesReview(catalog, state, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('permite pular "Registrar decisões e mudanças" mesmo sendo explicit_confirmation (allowsSkip true)', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'decisoes_mudancas', 'pend-1', T1));
		const progress = skipped.activityProgress.find((p) => p.activityDefinitionId === 'decisoes_mudancas');
		expect(progress?.status).toBe('pulada');
	});

	it('skip → pending → retomar → confirmação resolve a pendência, mesmo com ZERO Decision/Change', () => {
		const skipped = unwrap(skipActivity(catalog, freshState(), 'decisoes_mudancas', 'pend-1', T1));
		const confirmed = unwrap(confirmDecisionsAndChangesReview(catalog, skipped, T2));
		expect(confirmed.pendingItems[0].status).toBe('resolvida');
	});

	it('answerActivity recusa "decisoes_mudancas" com wrong_completion_mode — não é mais required_fields, nunca escreve Answer novo', () => {
		const result = answerActivity(
			catalog,
			freshState(),
			'decisoes_mudancas',
			{ decisoes_mudancas_recentes: 'Nova decisão via texto livre' },
			T1
		);
		expect(result).toEqual({ ok: false, error: { kind: 'wrong_completion_mode' } });
	});

	it('aceita qualquer combinação de Decision/Change existentes e nunca cria/edita/remove nenhuma delas', () => {
		let state = freshState();
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		state = unwrap(decideDecision(catalog, state, 'dec-1', 'Adiado', T1));
		state = unwrap(addDecision(catalog, state, 'dec-2', 'Trocar de fornecedor?', T1));
		state = unwrap(addChange(catalog, state, 'chg-1', 'Trocou o fornecedor de e-mail', T1));

		const decisionsBefore = state.decisions;
		const changesBefore = state.changes;
		const confirmed = unwrap(confirmDecisionsAndChangesReview(catalog, state, T2));

		expect(confirmed.decisions).toBe(decisionsBefore);
		expect(confirmed.changes).toBe(changesBefore);
		const progress = confirmed.activityProgress.find((p) => p.activityDefinitionId === 'decisoes_mudancas');
		expect(progress?.status).toBe('concluída');
	});
});

describe('Decision (ETAPA 11 do rework, primeiro microcorte, §41)', () => {
	it('nasce pendente, sem outcome/decidedAt/options/dueDate/responsible', () => {
		const state = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		expect(state.decisions).toEqual([
			{
				id: 'dec-1',
				projectId: 'proj-1',
				subject: 'Adiar o SMS?',
				options: null,
				dueDate: null,
				responsible: null,
				status: 'pendente',
				outcome: null,
				decidedAt: null,
				createdAt: T1,
				updatedAt: T1
			}
		]);
	});

	it('recusa subject vazio na criação', () => {
		const result = addDecision(catalog, freshState(), 'dec-1', '   ', T1);
		expect(result).toEqual({ ok: false, error: { kind: 'decision_subject_required' } });
	});

	it('editDecision atualiza subject/options/dueDate/responsible juntos, sem alterar status/outcome/decidedAt', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const edited = unwrap(
			editDecision(
				catalog,
				created,
				'dec-1',
				'Adiar o SMS?',
				'A: agora; B: depois',
				'2026-02-01',
				'Ana (produto)',
				T2
			)
		);
		expect(edited.decisions[0]).toEqual({
			id: 'dec-1',
			projectId: 'proj-1',
			subject: 'Adiar o SMS?',
			options: 'A: agora; B: depois',
			dueDate: '2026-02-01',
			responsible: 'Ana (produto)',
			status: 'pendente',
			outcome: null,
			decidedAt: null,
			createdAt: T1,
			updatedAt: T2
		});
	});

	it('editDecision recusa dueDate que não é data civil válida', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const result = editDecision(catalog, created, 'dec-1', 'Adiar o SMS?', null, '2026-13-40', null, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'decision_due_date_invalid' } });
	});

	it('editDecision define, troca e limpa responsible independentemente de status/outcome/decidedAt', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));

		const withResponsible = unwrap(
			editDecision(catalog, created, 'dec-1', 'Adiar o SMS?', null, null, 'Ana', T2)
		);
		expect(withResponsible.decisions[0]).toMatchObject({ responsible: 'Ana', status: 'pendente' });

		const swapped = unwrap(
			editDecision(catalog, withResponsible, 'dec-1', 'Adiar o SMS?', null, null, 'Bruno', T3)
		);
		expect(swapped.decisions[0]).toMatchObject({ responsible: 'Bruno' });

		const cleared = unwrap(editDecision(catalog, swapped, 'dec-1', 'Adiar o SMS?', null, null, null, T3));
		expect(cleared.decisions[0]).toMatchObject({ responsible: null });
	});

	it('decideDecision não exige responsible — Decision sem responsável também pode ser tomada', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const decided = unwrap(decideDecision(catalog, created, 'dec-1', 'Adiado para v2', T2));
		expect(decided.decisions[0]).toMatchObject({ responsible: null, status: 'tomada', outcome: 'Adiado para v2' });
	});

	it('decideDecision exige outcome não vazio, grava status/outcome/decidedAt juntos', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const decided = unwrap(decideDecision(catalog, created, 'dec-1', 'Adiado para v2', T2));
		expect(decided.decisions[0]).toMatchObject({
			status: 'tomada',
			outcome: 'Adiado para v2',
			decidedAt: T2
		});

		const missingOutcome = decideDecision(catalog, created, 'dec-1', '   ', T2);
		expect(missingOutcome).toEqual({ ok: false, error: { kind: 'decision_outcome_required' } });
	});

	it('decideDecision recusa decidir de novo uma decisão já tomada', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const decided = unwrap(decideDecision(catalog, created, 'dec-1', 'Adiado para v2', T2));
		const result = decideDecision(catalog, decided, 'dec-1', 'Outro resultado', T3);
		expect(result).toEqual({ ok: false, error: { kind: 'decision_already_decided' } });
	});

	it('editDecisionOutcome corrige o outcome de uma decisão tomada sem alterar status/decidedAt/responsible', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const withResponsible = unwrap(editDecision(catalog, created, 'dec-1', 'Adiar o SMS?', null, null, 'Ana', T1));
		const decided = unwrap(decideDecision(catalog, withResponsible, 'dec-1', 'Adiado para v2', T2));
		const corrected = unwrap(editDecisionOutcome(catalog, decided, 'dec-1', 'Adiado para v3', T3));
		expect(corrected.decisions[0]).toMatchObject({
			status: 'tomada',
			outcome: 'Adiado para v3',
			decidedAt: T2,
			responsible: 'Ana',
			createdAt: T1,
			updatedAt: T3
		});
	});

	it('editDecisionOutcome recusa decisão ainda pendente', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const result = editDecisionOutcome(catalog, created, 'dec-1', 'Resultado precoce', T2);
		expect(result).toEqual({ ok: false, error: { kind: 'decision_not_decided' } });
	});

	it('editDecisionOutcome recusa outcome vazio', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const decided = unwrap(decideDecision(catalog, created, 'dec-1', 'Adiado para v2', T2));
		const result = editDecisionOutcome(catalog, decided, 'dec-1', '   ', T3);
		expect(result).toEqual({ ok: false, error: { kind: 'decision_outcome_required' } });
	});

	it('editDecision recusa alterar subject/options/dueDate/responsible de uma decisão já tomada — outcome é a única correção possível', () => {
		const created = unwrap(addDecision(catalog, freshState(), 'dec-1', 'Adiar o SMS?', T1));
		const decided = unwrap(decideDecision(catalog, created, 'dec-1', 'Adiado para v2', T2));
		const result = editDecision(catalog, decided, 'dec-1', 'Novo assunto', 'Novas opções', '2026-03-01', 'Ana', T3);
		expect(result).toEqual({ ok: false, error: { kind: 'decision_already_decided' } });
		// Nenhum campo foi alterado pela tentativa recusada.
		expect(decided.decisions[0]).toMatchObject({ subject: 'Adiar o SMS?', options: null, dueDate: null, responsible: null });
	});
});

// setWorkItemSchedule (ETAPA 12 do rework, "Scheduling e Gantt", §42,
// primeiro microcorte fundacional) — fato temporal MANUAL, sem precedência
// nem propagação. Falsificadores centrais: par sempre fechado (nunca
// estado parcial), formato/duração validados, no-op idempotente, e nenhum
// efeito colateral sobre status/Dependency/Deliverable/Impediment.
describe('setWorkItemSchedule (ETAPA 12 do rework, §42, primeiro microcorte fundacional)', () => {
	it('WorkItem nasce sem schedule (plannedStart/durationDays null)', () => {
		const state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		expect(state.workItems[0]).toMatchObject({ plannedStart: null, durationDays: null });
	});

	it('define um schedule válido', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-1', '2026-09-12', 3, T2));
		expect(state.workItems[0]).toMatchObject({
			plannedStart: '2026-09-12',
			durationDays: 3,
			updatedAt: T2
		});
	});

	it('recusa work_item_not_found para WorkItem inexistente', () => {
		const result = setWorkItemSchedule(catalog, freshState(), 'nao-existe', '2026-09-12', 3, T1);
		expect(result).toEqual({ ok: false, error: { kind: 'work_item_not_found' } });
	});

	it('recusa estado parcial: plannedStart preenchido com durationDays null', () => {
		const state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		const result = setWorkItemSchedule(catalog, state, 'wi-1', '2026-09-12', null, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'work_item_schedule_incomplete' } });
	});

	it('recusa estado parcial: durationDays preenchido com plannedStart null', () => {
		const state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		const result = setWorkItemSchedule(catalog, state, 'wi-1', null, 3, T2);
		expect(result).toEqual({ ok: false, error: { kind: 'work_item_schedule_incomplete' } });
	});

	it('recusa data inválida (timestamp completo, formato local, dia inexistente)', () => {
		const state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		for (const invalid of ['2026-09-01T00:00:00.000Z', '01/09/2026', '2026-02-30']) {
			expect(setWorkItemSchedule(catalog, state, 'wi-1', invalid, 1, T2)).toEqual({
				ok: false,
				error: { kind: 'work_item_planned_start_invalid' }
			});
		}
	});

	it('recusa duração zero, negativa, fracionária ou não numérica', () => {
		const state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		for (const invalid of [0, -1, 1.5, NaN]) {
			expect(setWorkItemSchedule(catalog, state, 'wi-1', '2026-09-12', invalid, T2)).toEqual({
				ok: false,
				error: { kind: 'work_item_duration_invalid' }
			});
		}
	});

	it('limpa o schedule atomicamente (os dois voltam a null juntos)', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-1', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-1', null, null, T3));
		expect(state.workItems[0]).toMatchObject({ plannedStart: null, durationDays: null, updatedAt: T3 });
	});

	it('idempotência real: gravar o mesmo par preserva o objeto por referência, inclusive updatedAt', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-1', 'Item', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-1', '2026-09-12', 3, T2));
		const before = state.workItems[0];
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-1', '2026-09-12', 3, T3));
		expect(state.workItems[0]).toBe(before);
	});

	it('alterar o schedule não muda status, deliverableId nem as Dependency/Impediment do item', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(addImpediment(catalog, state, 'imp-1', 'Bloqueado', 'bloqueio_tecnico', T1, 'wi-a'));

		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));

		expect(state.workItems[0]).toMatchObject({ status: 'a_fazer', deliverableId: null });
		expect(state.dependencies).toHaveLength(1);
		expect(state.impediments[0]).toMatchObject({ status: 'aberto', workItemId: 'wi-a' });
		// moveWorkItem continua recusado pelo Impediment aberto, nunca por schedule.
		expect(moveWorkItem(catalog, state, 'wi-a', 'concluido', T3)).toEqual({
			ok: false,
			error: { kind: 'work_item_blocked' }
		});
	});
});

// findWorkItemPrecedenceConflict (ETAPA 12 do rework, "Scheduling e
// Gantt", §42, segundo microcorte) — regra de precedência temporal
// DERIVADA, nunca persistida, nunca bloqueante. Falsificadores centrais:
// fórmula exata do fim semântico/início exigido, múltiplos predecessores
// usa o maior limite CONHECIDO, predecessor sem schedule nem gera falso
// conflito nem esconde conflito real, status de execução é irrelevante, e
// nenhuma das duas escritas (addDependency/setWorkItemSchedule) ganha
// recusa nova por causa disto.
describe('findWorkItemPrecedenceConflict (ETAPA 12 do rework, §42, segundo microcorte)', () => {
	it('sem Dependency, sem conflito', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toBeNull();
	});

	it('sucessor sem schedule: indeterminado, não é conflito', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toBeNull();
	});

	it('predecessor sem schedule: indeterminado, não é conflito', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toBeNull();
	});

	it('duração 1: fim semântico == início; sucessor no mesmo dia é conflito, no dia seguinte não', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 1, T2));

		let withConflict = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 2, T2));
		expect(findWorkItemPrecedenceConflict(withConflict, 'wi-a')).toMatchObject({
			dependencyId: 'dep-1',
			dependsOnWorkItemId: 'wi-b',
			knownRequiredStart: '2026-09-13'
		});

		const withoutConflict = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-13', 2, T2));
		expect(findWorkItemPrecedenceConflict(withoutConflict, 'wi-a')).toBeNull();
	});

	it('duração 3: fim semântico = início + 2 dias; 14/09 conflita, 15/09 e 16/09 não', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));

		const conflicting = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));
		expect(findWorkItemPrecedenceConflict(conflicting, 'wi-a')).toMatchObject({
			knownRequiredStart: '2026-09-15'
		});

		for (const start of ['2026-09-15', '2026-09-16']) {
			const ok = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', start, 2, T2));
			expect(findWorkItemPrecedenceConflict(ok, 'wi-a')).toBeNull();
		}
	});

	it('múltiplos predecessores: usa o maior início exigido entre os agendados', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-a', 'wi-c', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2)); // exige 15/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-20', 1, T2)); // exige 21/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-15', 1, T2));

		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toMatchObject({
			dependencyId: 'dep-c',
			dependsOnWorkItemId: 'wi-c',
			knownRequiredStart: '2026-09-21'
		});
	});

	it('um predecessor sem schedule não esconde conflito provado por outro predecessor', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-a', 'wi-c', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2)); // exige 15/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 1, T2));
		// wi-c permanece sem schedule.

		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toMatchObject({
			dependencyId: 'dep-b',
			dependsOnWorkItemId: 'wi-b',
			knownRequiredStart: '2026-09-15'
		});
	});

	it('todos os predecessores sem schedule: nenhum conflito derivável', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 1, T2));
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toBeNull();
	});

	it('status de execução (inclusive concluido) nunca muda o resultado', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));

		const before = findWorkItemPrecedenceConflict(state, 'wi-a');
		state = unwrap(moveWorkItem(catalog, state, 'wi-b', 'em_andamento', T3));
		state = unwrap(moveWorkItem(catalog, state, 'wi-b', 'concluido', T3));
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toEqual(before);
	});

	it('criar a Dependency depois dos schedules revela o mesmo conflito que editar o schedule depois da Dependency', () => {
		let scheduleFirst = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		scheduleFirst = unwrap(addWorkItem(catalog, scheduleFirst, 'wi-b', 'B', T1));
		scheduleFirst = unwrap(setWorkItemSchedule(catalog, scheduleFirst, 'wi-b', '2026-09-12', 3, T2));
		scheduleFirst = unwrap(setWorkItemSchedule(catalog, scheduleFirst, 'wi-a', '2026-09-14', 2, T2));
		scheduleFirst = unwrap(addDependency(catalog, scheduleFirst, 'dep-1', 'wi-a', 'wi-b', T2));

		let dependencyFirst = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		dependencyFirst = unwrap(addWorkItem(catalog, dependencyFirst, 'wi-b', 'B', T1));
		dependencyFirst = unwrap(addDependency(catalog, dependencyFirst, 'dep-1', 'wi-a', 'wi-b', T1));
		dependencyFirst = unwrap(setWorkItemSchedule(catalog, dependencyFirst, 'wi-b', '2026-09-12', 3, T2));
		dependencyFirst = unwrap(setWorkItemSchedule(catalog, dependencyFirst, 'wi-a', '2026-09-14', 2, T2));

		expect(findWorkItemPrecedenceConflict(scheduleFirst, 'wi-a')).toEqual(
			findWorkItemPrecedenceConflict(dependencyFirst, 'wi-a')
		);
	});

	it('remover a Dependency remove o conflito; limpar o schedule remove a possibilidade de avaliar o par', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).not.toBeNull();

		const withoutDependency = unwrap(removeDependency(catalog, state, 'dep-1'));
		expect(findWorkItemPrecedenceConflict(withoutDependency, 'wi-a')).toBeNull();

		const withoutPredecessorSchedule = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', null, null, T3));
		expect(findWorkItemPrecedenceConflict(withoutPredecessorSchedule, 'wi-a')).toBeNull();
	});

	it('mudar o predecessor pode criar/remover conflito sem que o sucessor mude', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));

		const noConflict = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-01', 1, T2));
		expect(findWorkItemPrecedenceConflict(noConflict, 'wi-a')).toBeNull();

		const conflicting = unwrap(setWorkItemSchedule(catalog, noConflict, 'wi-b', '2026-09-13', 3, T3));
		expect(findWorkItemPrecedenceConflict(conflicting, 'wi-a')).toMatchObject({ knownRequiredStart: '2026-09-16' });
		expect(conflicting.workItems.find((item) => item.id === 'wi-a')).toMatchObject({ plannedStart: '2026-09-14' });
	});

	it('nenhum cálculo persiste estado: recalcular não muda a referência do state', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));

		const before = state;
		findWorkItemPrecedenceConflict(state, 'wi-a');
		expect(state).toBe(before);
	});

	it('addDependency não ganha recusa temporal: aceita ligar schedules já conflitantes', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));

		const result = addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T3);
		expect(result.ok).toBe(true);
	});

	it('setWorkItemSchedule não ganha recusa nova: aceita schedule que conflita com Dependency existente', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));

		const result = setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T3);
		expect(result.ok).toBe(true);
	});

	// Reparo pós-dogfood do terceiro microcorte de §42 — findWorkItemPrecedenceConflict
	// NUNCA lança, mesmo quando a aritmética de precedência exigiria uma data
	// fora da faixa civil 0000-9999. Falsificadores A/B/G do pedido de reparo.
	it('predecessor cujo requiredStart estoura a faixa civil: nunca lança, devolve unrepresentable', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		// Fim semântico de B já é 31/12/9999 — exigir +1 dia estoura a faixa civil.
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '9999-12-31', 1, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '9999-01-01', 1, T2));

		expect(() => findWorkItemPrecedenceConflict(state, 'wi-a')).not.toThrow();
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toEqual({
			kind: 'unrepresentable',
			dependencyId: 'dep-1',
			dependsOnWorkItemId: 'wi-b'
		});
	});

	it('estouro pela própria duração do predecessor (não só pelo +1 dia final): mesmo tratamento seguro', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		// semanticEnd(B) = 9999-12-01 + 60 dias já ultrapassa 9999-12-31 por si
		// só, antes mesmo de somar o +1 dia de finish-to-start.
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '9999-12-01', 60, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '9999-01-01', 1, T2));

		expect(() => findWorkItemPrecedenceConflict(state, 'wi-a')).not.toThrow();
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toMatchObject({ kind: 'unrepresentable' });
	});

	it('um predecessor irrepresentável não impede reportar outro predecessor com conflito comum representável', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-a', 'wi-c', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '9999-12-31', 1, T2)); // irrepresentável
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-12', 3, T2)); // exige 15/09/2026
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-01', 1, T2));

		// Irrepresentável vence a agregação: é mais severo do que qualquer
		// conflito comum (D059 nunca esconderia um problema real).
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toMatchObject({ kind: 'unrepresentable', dependsOnWorkItemId: 'wi-b' });
	});

	it('conflito comum continua exatamente como antes quando não há estouro em nenhum predecessor', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));

		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toEqual({
			kind: 'conflict',
			dependencyId: 'dep-1',
			dependsOnWorkItemId: 'wi-b',
			knownRequiredStart: '2026-09-15'
		});
	});
});

// findWorkItemKnownFreeSlack (ETAPA 12 do rework, "Scheduling e Gantt",
// §42, quarto microcorte) — folga LIVRE LOCAL derivada, nunca folga de
// rede/caminho crítico. Falsificadores centrais: fórmula exata do gap,
// múltiplos sucessores usa o menor gap, sucessor sem schedule marca
// `partial` sem impedir o cálculo dos agendados, sucessores todos sem
// schedule produz `unknown` (não `no_known_limit`), ausência de sucessor
// produz `no_known_limit` (nunca 0/Infinity), aresta em conflito nunca
// produz gap negativo, precedência de entrada não resolvida suprime a
// folga inteira, diamond permanece local às arestas diretas, status de
// execução é irrelevante, e overflow civil nunca lança.
describe('findWorkItemKnownFreeSlack (ETAPA 12 do rework, §42, quarto microcorte)', () => {
	it('exemplo canônico: A 12/09 dur.3 (fim 14/09) -> S 18/09 = 3 dias de folga', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-s', 'S', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-s', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-s', '2026-09-18', 1, T2));

		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({
			kind: 'known',
			slackDays: 3,
			limitingWorkItemId: 'wi-s',
			partial: false
		});
	});

	it('sucessor no requiredStart exato: 0 dias de folga, nunca negativo', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-s', 'S', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-s', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-s', '2026-09-15', 1, T2));

		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({
			kind: 'known',
			slackDays: 0,
			limitingWorkItemId: 'wi-s',
			partial: false
		});
	});

	it('sucessor antes do requiredStart: conflict, nunca gap negativo', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-s', 'S', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-s', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-s', '2026-09-14', 1, T2));

		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({
			kind: 'conflict',
			limitingWorkItemId: 'wi-s'
		});
	});

	it('múltiplos sucessores agendados: vence o menor gap', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-b', 'wi-a', T1));
		state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-c', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2)); // requiredStart 15/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-18', 1, T2)); // gap 3
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-16', 1, T2)); // gap 1

		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({
			kind: 'known',
			slackDays: 1,
			limitingWorkItemId: 'wi-c',
			partial: false
		});
	});

	it('empate exato de gap entre sucessores: tie-break determinístico por createdAt/id, independente da ordem de inserção de Dependency', () => {
		// wi-b e wi-c produzem o MESMO gap (2 dias) — o resultado não pode
		// depender da ordem em que as Dependency foram adicionadas.
		function buildState(firstDependency: 'b' | 'c'): ProjectState {
			let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
			state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
			state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
			if (firstDependency === 'b') {
				state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-b', 'wi-a', T1));
				state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-c', 'wi-a', T1));
			} else {
				state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-c', 'wi-a', T1));
				state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-b', 'wi-a', T1));
			}
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2)); // requiredStart 15/09
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-17', 1, T2)); // gap 2
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-17', 1, T2)); // gap 2
			return state;
		}

		// wi-b e wi-c têm o mesmo createdAt (T1) — tie-break cai para id:
		// 'wi-b' < 'wi-c' vence, em ambas as ordens de inserção.
		expect(findWorkItemKnownFreeSlack(buildState('b'), 'wi-a')).toEqual({
			kind: 'known',
			slackDays: 2,
			limitingWorkItemId: 'wi-b',
			partial: false
		});
		expect(findWorkItemKnownFreeSlack(buildState('c'), 'wi-a')).toEqual({
			kind: 'known',
			slackDays: 2,
			limitingWorkItemId: 'wi-b',
			partial: false
		});
	});

	it('empate exato de severidade entre sucessores em conflito: tie-break determinístico, ainda `conflict`', () => {
		// wi-b e wi-c começam na MESMA data, ambos violando a precedência — o
		// estado continua `conflict`, mas o sucessor nomeado é estável.
		function buildState(firstDependency: 'b' | 'c'): ProjectState {
			let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
			state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
			state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
			if (firstDependency === 'b') {
				state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-b', 'wi-a', T1));
				state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-c', 'wi-a', T1));
			} else {
				state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-c', 'wi-a', T1));
				state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-b', 'wi-a', T1));
			}
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2)); // requiredStart 15/09
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-14', 1, T2)); // conflito
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-14', 1, T2)); // conflito, mesma data
			return state;
		}

		expect(findWorkItemKnownFreeSlack(buildState('b'), 'wi-a')).toEqual({
			kind: 'conflict',
			limitingWorkItemId: 'wi-b'
		});
		expect(findWorkItemKnownFreeSlack(buildState('c'), 'wi-a')).toEqual({
			kind: 'conflict',
			limitingWorkItemId: 'wi-b'
		});
	});

	it('sucessor agendado + sucessor sem schedule: valor do agendado, partial true', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-b', 'wi-a', T1));
		state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-c', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-18', 1, T2));
		// wi-c permanece sem schedule.

		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({
			kind: 'known',
			slackDays: 3,
			limitingWorkItemId: 'wi-b',
			partial: true
		});
	});

	it('só existem sucessores sem schedule: unknown, não no_known_limit', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-s', 'S', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-s', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		// wi-s permanece sem schedule.

		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({ kind: 'unknown' });
	});

	it('nenhuma Dependency sucessora: no_known_limit, nunca 0 nem Infinity', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));

		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({ kind: 'no_known_limit' });
	});

	it('item sem schedule: null, nenhuma folga exibida', () => {
		const state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toBeNull();
	});

	it('precedência de entrada não resolvida suprime a folga inteira (nunca duplica o warning de D059)', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-p', 'P', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-s', 'S', T1));
		state = unwrap(addDependency(catalog, state, 'dep-p-a', 'wi-a', 'wi-p', T1));
		state = unwrap(addDependency(catalog, state, 'dep-a-s', 'wi-s', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-p', '2026-09-12', 3, T2)); // exige 15/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2)); // conflita com P
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-s', '2026-09-30', 1, T2));

		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).not.toBeNull();
		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toBeNull();
	});

	it('diamond: folga permanece local às arestas de saída diretas, sem traversal', () => {
		// B -> A, B -> C, A -> X, C -> X — folga de B só olha A e C
		// diretamente, nunca atravessa até X.
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-x', 'X', T1));
		state = unwrap(addDependency(catalog, state, 'dep-a-b', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-c-b', 'wi-c', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-x-a', 'wi-x', 'wi-a', T1));
		state = unwrap(addDependency(catalog, state, 'dep-x-c', 'wi-x', 'wi-c', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2)); // requiredStart 15/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-18', 1, T2)); // gap 3
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-16', 1, T2)); // gap 1
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-x', '2026-01-01', 1, T2)); // bem antes, irrelevante

		expect(findWorkItemKnownFreeSlack(state, 'wi-b')).toEqual({
			kind: 'known',
			slackDays: 1,
			limitingWorkItemId: 'wi-c',
			partial: false
		});
	});

	it('status de execução (inclusive concluido) nunca muda o resultado', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-s', 'S', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-s', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-s', '2026-09-18', 1, T2));

		const before = findWorkItemKnownFreeSlack(state, 'wi-a');
		state = unwrap(moveWorkItem(catalog, state, 'wi-a', 'em_andamento', T3));
		state = unwrap(moveWorkItem(catalog, state, 'wi-a', 'concluido', T3));
		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual(before);
	});

	it('overflow civil na própria aritmética do item: nunca lança, devolve unrepresentable', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		// semanticEnd(A) já é 9999-12-31; exigir +1 dia estoura a faixa civil.
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '9999-12-31', 1, T2));

		expect(() => findWorkItemKnownFreeSlack(state, 'wi-a')).not.toThrow();
		expect(findWorkItemKnownFreeSlack(state, 'wi-a')).toEqual({ kind: 'unrepresentable' });
	});

	it('nenhum cálculo persiste estado: recalcular não muda a referência do state', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-s', 'S', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-s', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-s', '2026-09-18', 1, T2));

		const before = state;
		findWorkItemKnownFreeSlack(state, 'wi-a');
		expect(state).toBe(before);
	});
});

// computeSchedulePropagationPlan / applySchedulePropagation (ETAPA 12 do
// rework, "Scheduling e Gantt", §42, terceiro microcorte) — propagação
// FORWARD-ONLY, explícita e atômica. Falsificadores centrais: cadeia só
// avança o necessário, item já compatível nunca é puxado para trás,
// predecessor mais cedo/mais curto nunca antecipa sucessor, diamonds
// convergem independente da ordem, múltiplos predecessores usa o maior
// limite, dados parciais nunca inventam schedule (só marcam `partial`),
// status de execução é irrelevante, plano vazio quando nada precisa mudar,
// aplicação recalcula contra o estado atual (nunca confia em plano
// obsoleto), estouro de faixa civil falha o plano inteiro sem aplicar
// nada, e só os itens realmente movidos ganham updatedAt (mesmo
// occurredAt entre eles).
describe('computeSchedulePropagationPlan / applySchedulePropagation (ETAPA 12 do rework, §42, terceiro microcorte)', () => {
	// B → A → X, mesmo cenário do dogfood do item: B 12/09 (3 dias, fim
	// 14/09, exige 15/09); A 14/09 (2 dias) conflita com B.
	function chainState(xPlannedStart: string, xDurationDays: number): ProjectState {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-x', 'X', T1));
		state = unwrap(addDependency(catalog, state, 'dep-a-b', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-x-a', 'wi-x', 'wi-a', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-x', xPlannedStart, xDurationDays, T2));
		return state;
	}

	it('cadeia: move A para o limite de B; move X só porque o novo fim de A agora o exige', () => {
		const state = chainState('2026-09-16', 2);
		const plan = unwrap(computeSchedulePropagationPlan(state, 'wi-a'));
		expect(plan.partial).toBe(false);
		expect(plan.changes).toEqual([
			{
				workItemId: 'wi-a',
				fromPlannedStart: '2026-09-14',
				toPlannedStart: '2026-09-15',
				viaDependencyId: 'dep-a-b',
				viaWorkItemId: 'wi-b'
			},
			{
				workItemId: 'wi-x',
				fromPlannedStart: '2026-09-16',
				toPlannedStart: '2026-09-17',
				viaDependencyId: 'dep-x-a',
				viaWorkItemId: 'wi-a'
			}
		]);
	});

	it('item já depois do requiredStart nunca é puxado para trás: X com folga suficiente não entra no plano', () => {
		const state = chainState('2026-09-25', 2);
		const plan = unwrap(computeSchedulePropagationPlan(state, 'wi-a'));
		expect(plan.changes.map((change) => change.workItemId)).toEqual(['wi-a']);
	});

	it('sem conflito na raiz: plano vazio, nunca oferece aplicação sem mudança', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-12', 3, T2));
		const plan = unwrap(computeSchedulePropagationPlan(state, 'wi-a'));
		expect(plan).toEqual({ rootWorkItemId: 'wi-a', changes: [], partial: false });
	});

	it('predecessor movido para mais cedo ou encurtado nunca antecipa o sucessor', () => {
		// A e X já compatíveis com B (sem conflito nenhum na cadeia).
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addDependency(catalog, state, 'dep-a-b', 'wi-a', 'wi-b', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-20', 2, T2));
		expect(findWorkItemPrecedenceConflict(state, 'wi-a')).toBeNull();

		// Move B para mais cedo e encurta a duração — A não tem conflito
		// (continua muito à frente), então propagar em A não move nada.
		const earlier = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-01', 1, T3));
		expect(unwrap(computeSchedulePropagationPlan(earlier, 'wi-a')).changes).toEqual([]);
	});

	it('removeDependency nunca puxa datas: remover a Dependency não altera nenhum plannedStart', () => {
		const state = chainState('2026-09-16', 2);
		const withoutDependency = unwrap(removeDependency(catalog, state, 'dep-a-b'));
		expect(withoutDependency.workItems).toEqual(state.workItems);
	});

	it('addDependency nunca propaga automaticamente: criar a Dependency não move nenhum plannedStart', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));

		const withDependency = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T3));
		expect(withDependency.workItems).toEqual(state.workItems);
		// O conflito passa a existir só como leitura — nada foi escrito.
		expect(findWorkItemPrecedenceConflict(withDependency, 'wi-a')).not.toBeNull();
	});

	it('predecessor sem schedule não bloqueia o conflito conhecido e marca o plano como parcial', () => {
		let state = chainState('2026-09-16', 2);
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addDependency(catalog, state, 'dep-a-c', 'wi-a', 'wi-c', T1));
		// wi-c permanece sem schedule.

		const plan = unwrap(computeSchedulePropagationPlan(state, 'wi-a'));
		expect(plan.partial).toBe(true);
		expect(plan.changes.find((change) => change.workItemId === 'wi-a')).toMatchObject({
			toPlannedStart: '2026-09-15',
			viaWorkItemId: 'wi-b'
		});
	});

	it('sucessor sem schedule nunca recebe schedule inventado; a cascata para naquele ramo e marca parcial', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-x', 'X', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-y', 'Y', T1));
		state = unwrap(addDependency(catalog, state, 'dep-a-b', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-x-a', 'wi-x', 'wi-a', T1));
		state = unwrap(addDependency(catalog, state, 'dep-y-x', 'wi-y', 'wi-x', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-14', 2, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-y', '2026-09-20', 2, T2));
		// wi-x (sucessor de A, predecessor de Y) permanece sem schedule.

		const plan = unwrap(computeSchedulePropagationPlan(state, 'wi-a'));
		expect(plan.partial).toBe(true);
		expect(plan.changes.map((change) => change.workItemId)).toEqual(['wi-a']);
		expect(plan.changes.some((change) => change.workItemId === 'wi-x' || change.workItemId === 'wi-y')).toBe(false);
	});

	it('diamond (B→A, B→C, A→X, C→X): resultado independe da ordem de visita', () => {
		function diamondState(dependencyOrder: readonly ['ab' | 'ac' | 'xa' | 'xc', string][]): ProjectState {
			let state = unwrap(addWorkItem(catalog, freshState(), 'wi-b', 'B', T1));
			state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
			state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
			state = unwrap(addWorkItem(catalog, state, 'wi-x', 'X', T1));
			const edges: Record<string, [string, string]> = {
				ab: ['wi-a', 'wi-b'],
				ac: ['wi-c', 'wi-b'],
				xa: ['wi-x', 'wi-a'],
				xc: ['wi-x', 'wi-c']
			};
			for (const [key, dependencyId] of dependencyOrder) {
				const [workItemId, dependsOnWorkItemId] = edges[key];
				state = unwrap(addDependency(catalog, state, dependencyId, workItemId, dependsOnWorkItemId, T1));
			}
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-01', 5, T2)); // fim 05/09, exige 06/09
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-01', 2, T2)); // conflita com B
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-10', 3, T2)); // já compatível com B; fim 12/09, exige 13/09
			state = unwrap(setWorkItemSchedule(catalog, state, 'wi-x', '2026-09-07', 2, T2));
			return state;
		}

		const orderOne = diamondState([
			['ab', 'dep-1'],
			['ac', 'dep-2'],
			['xa', 'dep-3'],
			['xc', 'dep-4']
		]);
		const orderTwo = diamondState([
			['xc', 'dep-4'],
			['xa', 'dep-3'],
			['ac', 'dep-2'],
			['ab', 'dep-1']
		]);

		const planOne = unwrap(computeSchedulePropagationPlan(orderOne, 'wi-a'));
		const planTwo = unwrap(computeSchedulePropagationPlan(orderTwo, 'wi-a'));

		// Ordem determinística (hardening pós-dogfood, §42 terceiro
		// microcorte) — igualdade exata de array, sem normalizar por sort:
		// a ordem de inserção das Dependency (invertida entre as duas
		// construções acima) não pode vazar para a ordem observável de
		// `changes`, porque o preview agora participa da comparação de
		// staleness em applySchedulePropagation.
		expect(planOne.changes).toEqual(planTwo.changes);

		// A move para o limite de B (06/09); X é decidido pelo maior limite
		// CONHECIDO — o de C (13/09), não o de A (08/09) — porque C nunca se
		// move (não é descendente de A) e seu limite já era maior.
		expect(planOne.changes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ workItemId: 'wi-a', toPlannedStart: '2026-09-06' }),
				expect.objectContaining({ workItemId: 'wi-x', toPlannedStart: '2026-09-13', viaWorkItemId: 'wi-c' })
			])
		);
		expect(planOne.changes).toHaveLength(2);
	});

	it('múltiplos predecessores: A usa o maior limite conhecido entre B e C', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
		state = unwrap(addDependency(catalog, state, 'dep-b', 'wi-a', 'wi-b', T1));
		state = unwrap(addDependency(catalog, state, 'dep-c', 'wi-a', 'wi-c', T1));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 3, T2)); // exige 15/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-c', '2026-09-20', 1, T2)); // exige 21/09
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '2026-09-01', 1, T2));

		const plan = unwrap(computeSchedulePropagationPlan(state, 'wi-a'));
		expect(plan.changes).toEqual([
			{
				workItemId: 'wi-a',
				fromPlannedStart: '2026-09-01',
				toPlannedStart: '2026-09-21',
				viaDependencyId: 'dep-c',
				viaWorkItemId: 'wi-c'
			}
		]);
	});

	it('WorkItem concluído: participa da cascata com a mesma matemática dos demais', () => {
		let state = chainState('2026-09-16', 2);
		state = unwrap(moveWorkItem(catalog, state, 'wi-a', 'em_andamento', T2));
		state = unwrap(moveWorkItem(catalog, state, 'wi-a', 'concluido', T2));

		const plan = unwrap(computeSchedulePropagationPlan(state, 'wi-a'));
		expect(plan.changes.map((change) => change.workItemId)).toEqual(['wi-a', 'wi-x']);
	});

	// expectationOf — mesma extração canônica que a camada de aplicação faz
	// do preview antes de devolvê-lo ao cliente (ver
	// SchedulePropagationExpectedChange, application/types.ts): só os campos
	// que a interface efetivamente mostrou, nunca viaDependencyId.
	function expectationOf(plan: { changes: readonly { workItemId: string; fromPlannedStart: string; toPlannedStart: string; viaWorkItemId: string }[]; partial: boolean }) {
		return {
			changes: plan.changes.map((change) => ({
				workItemId: change.workItemId,
				fromPlannedStart: change.fromPlannedStart,
				toPlannedStart: change.toPlannedStart,
				viaWorkItemId: change.viaWorkItemId
			})),
			partial: plan.partial
		};
	}

	it('applySchedulePropagation: transição atômica, só os itens movidos ganham updatedAt, mesmo occurredAt', () => {
		const state = chainState('2026-09-16', 2);
		const before = new Map(state.workItems.map((item) => [item.id, item]));
		const expected = expectationOf(unwrap(computeSchedulePropagationPlan(state, 'wi-a')));

		const applied = unwrap(applySchedulePropagation(catalog, state, 'wi-a', expected, T3));
		const a = applied.workItems.find((item) => item.id === 'wi-a')!;
		const x = applied.workItems.find((item) => item.id === 'wi-x')!;
		const b = applied.workItems.find((item) => item.id === 'wi-b')!;

		expect(a.plannedStart).toBe('2026-09-15');
		expect(a.updatedAt).toBe(T3);
		expect(x.plannedStart).toBe('2026-09-17');
		expect(x.updatedAt).toBe(T3);
		// B não fez parte do plano: permanece idêntico por referência.
		expect(b).toBe(before.get('wi-b'));
	});

	it('estouro de faixa civil: plano inválido, zero mudanças aplicadas', () => {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-b', 'B', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addDependency(catalog, state, 'dep-1', 'wi-a', 'wi-b', T1));
		// Fim semântico de B já é 31/12/9999 — exigir +1 dia estoura a faixa civil.
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '9999-12-31', 1, T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-a', '9999-01-01', 1, T2));

		expect(computeSchedulePropagationPlan(state, 'wi-a')).toEqual({
			ok: false,
			error: { kind: 'work_item_precedence_date_overflow' }
		});

		// Falsificador G do hardening — overflow no recálculo da confirmação
		// (o `expected` é irrelevante aqui: o recálculo falha antes de
		// qualquer comparação de staleness) continua erro explícito, zero
		// escrita.
		const before = state;
		const applied = applySchedulePropagation(catalog, state, 'wi-a', { changes: [], partial: false }, T3);
		expect(applied).toEqual({ ok: false, error: { kind: 'work_item_precedence_date_overflow' } });
		expect(state).toBe(before);
	});

	it('WorkItem inexistente: recusado', () => {
		const state = freshState();
		expect(computeSchedulePropagationPlan(state, 'inexistente')).toEqual({
			ok: false,
			error: { kind: 'work_item_not_found' }
		});
	});

	// Hardening pós-dogfood — preview obsoleto (§42 terceiro microcorte):
	// recalcular contra o estado atual é necessário mas não suficiente. Se o
	// plano recém-calculado não corresponder ao que o usuário confirmou
	// (`expected`), a confirmação é recusada por inteiro, nunca aplicada
	// parcialmente — mesmo quando o recálculo por si só teria sido um
	// resultado "válido" (ex.: plano vazio).
	describe('preview obsoleto (hardening pós-dogfood)', () => {
		// Falsificador A — nada mudou entre preview e confirmação: aplica
		// normalmente (já coberto pelo teste de atomicidade acima, que usa
		// exatamente este padrão: expected = plano recém-calculado do mesmo
		// estado). Este teste isola o caso sem side-effects de updatedAt.
		it('nada mudou entre preview e confirmação: aplica normalmente', () => {
			const state = chainState('2026-09-16', 2);
			const expected = expectationOf(unwrap(computeSchedulePropagationPlan(state, 'wi-a')));

			const applied = unwrap(applySchedulePropagation(catalog, state, 'wi-a', expected, T3));
			expect(applied.workItems.find((item) => item.id === 'wi-a')?.plannedStart).toBe('2026-09-15');
			expect(applied.workItems.find((item) => item.id === 'wi-x')?.plannedStart).toBe('2026-09-17');
		});

		// Falsificador B — o predecessor muda depois do preview, e o plano
		// recalculado exige datas diferentes: recusado como stale, zero
		// WorkItem movido (nem mesmo os que coincidiriam, porque a aplicação
		// é tudo-ou-nada contra UM `expected` coerente).
		it('predecessor muda depois do preview e altera as datas: stale, zero escrita', () => {
			const state = chainState('2026-09-16', 2);
			const expected = expectationOf(unwrap(computeSchedulePropagationPlan(state, 'wi-a')));
			// B estica para 4 dias depois do preview — novo requiredStart de A é 16/09, não mais 15/09.
			const changed = unwrap(setWorkItemSchedule(catalog, state, 'wi-b', '2026-09-12', 4, T2));

			const result = applySchedulePropagation(catalog, changed, 'wi-a', expected, T3);
			expect(result).toEqual({ ok: false, error: { kind: 'work_item_precedence_stale_preview' } });
			expect(changed.workItems.find((item) => item.id === 'wi-a')?.plannedStart).toBe('2026-09-14');
			expect(changed.workItems.find((item) => item.id === 'wi-x')?.plannedStart).toBe('2026-09-16');
		});

		// Falsificador C — a Dependency relevante é removida depois do
		// preview: o plano recalculado passa a ser vazio (nada para
		// resolver), o que diverge do `expected` (que tinha mudanças) —
		// stale, zero aplicação. Nunca "aplica o que ainda faz sentido".
		it('Dependency relevante é removida depois do preview: plano muda, stale, zero aplicação', () => {
			const state = chainState('2026-09-16', 2);
			const expected = expectationOf(unwrap(computeSchedulePropagationPlan(state, 'wi-a')));
			const changed = unwrap(removeDependency(catalog, state, 'dep-a-b'));

			const result = applySchedulePropagation(catalog, changed, 'wi-a', expected, T3);
			expect(result).toEqual({ ok: false, error: { kind: 'work_item_precedence_stale_preview' } });
			expect(changed.workItems.find((item) => item.id === 'wi-a')?.plannedStart).toBe('2026-09-14');
		});

		// Falsificador D — uma alteração que NÃO muda o plano (aqui: mover o
		// item concluído de status, que D059 já estabelece como ortogonal)
		// não é rejeitada por uma "versão global" artificial: a confirmação
		// aplica normalmente porque o plano recalculado é idêntico ao
		// confirmado.
		it('alteração irrelevante ao plano (status de um WorkItem envolvido) não gera falso stale', () => {
			const state = chainState('2026-09-16', 2);
			const expected = expectationOf(unwrap(computeSchedulePropagationPlan(state, 'wi-a')));
			let changed = unwrap(moveWorkItem(catalog, state, 'wi-b', 'em_andamento', T2));
			changed = unwrap(moveWorkItem(catalog, changed, 'wi-b', 'concluido', T2));

			const applied = unwrap(applySchedulePropagation(catalog, changed, 'wi-a', expected, T3));
			expect(applied.workItems.find((item) => item.id === 'wi-a')?.plannedStart).toBe('2026-09-15');
			expect(applied.workItems.find((item) => item.id === 'wi-x')?.plannedStart).toBe('2026-09-17');
		});

		// Falsificador E — as datas do plano coincidem, mas `partial` muda
		// (um novo predecessor sem schedule entra na conta do item raiz):
		// stale mesmo assim, porque partial é parte do que o usuário
		// confirmou (conhecimento completo vs. parcial nunca é detalhe).
		it('partial muda entre preview e confirmação, mesmo com as mesmas datas: stale', () => {
			const state = chainState('2026-09-16', 2);
			const expected = expectationOf(unwrap(computeSchedulePropagationPlan(state, 'wi-a')));
			expect(expected.partial).toBe(false);

			let changed = unwrap(addWorkItem(catalog, state, 'wi-c', 'C', T1));
			changed = unwrap(addDependency(catalog, changed, 'dep-a-c', 'wi-a', 'wi-c', T1));
			// wi-c permanece sem schedule — não muda nenhuma data do plano de
			// 'wi-a', mas o item raiz agora tem um predecessor sem schedule.
			const recomputed = unwrap(computeSchedulePropagationPlan(changed, 'wi-a'));
			expect(recomputed.changes).toEqual(unwrap(computeSchedulePropagationPlan(state, 'wi-a')).changes);
			expect(recomputed.partial).toBe(true);

			const result = applySchedulePropagation(catalog, changed, 'wi-a', expected, T3);
			expect(result).toEqual({ ok: false, error: { kind: 'work_item_precedence_stale_preview' } });
		});
	});
});

describe('DecisionAffectedWorkItem (ETAPA 11 do rework, terceiro microcorte, §41)', () => {
	function stateWithDecisionAndWorkItems(): ProjectState {
		let state = unwrap(addWorkItem(catalog, freshState(), 'wi-a', 'Trabalho A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'Trabalho B', T1));
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		return state;
	}

	it('zero relações é estado normal', () => {
		expect(stateWithDecisionAndWorkItems().decisionAffectedWorkItems).toEqual([]);
	});

	it('associa um WorkItem existente a uma Decision', () => {
		const state = unwrap(
			linkWorkItemToDecision(catalog, stateWithDecisionAndWorkItems(), 'dwi-1', 'dec-1', 'wi-a', T2)
		);
		expect(state.decisionAffectedWorkItems).toEqual([
			{ id: 'dwi-1', projectId: 'proj-1', decisionId: 'dec-1', workItemId: 'wi-a', createdAt: T2 }
		]);
	});

	it('associa vários WorkItems à mesma Decision (0..N)', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-2', 'dec-1', 'wi-b', T1));
		expect(state.decisionAffectedWorkItems).toHaveLength(2);
	});

	it('o mesmo WorkItem pode estar associado a várias Decisions (0..N)', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(addDecision(catalog, state, 'dec-2', 'Trocar de fornecedor?', T1));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-2', 'dec-2', 'wi-a', T1));
		expect(state.decisionAffectedWorkItems).toHaveLength(2);
	});

	it('recusa par duplicado, Decision inexistente e WorkItem inexistente', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));

		expect(linkWorkItemToDecision(catalog, state, 'dwi-2', 'dec-1', 'wi-a', T2)).toEqual({
			ok: false,
			error: { kind: 'decision_work_item_already_linked' }
		});
		expect(linkWorkItemToDecision(catalog, state, 'dwi-2', 'nao-existe', 'wi-a', T2)).toEqual({
			ok: false,
			error: { kind: 'decision_not_found' }
		});
		expect(linkWorkItemToDecision(catalog, state, 'dwi-2', 'dec-1', 'nao-existe', T2)).toEqual({
			ok: false,
			error: { kind: 'work_item_not_found' }
		});
	});

	it('remove a associação; remover relação inexistente é recusado', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));

		state = unwrap(unlinkWorkItemFromDecision(catalog, state, 'dwi-1'));
		expect(state.decisionAffectedWorkItems).toEqual([]);

		expect(unlinkWorkItemFromDecision(catalog, state, 'nao-existe')).toEqual({
			ok: false,
			error: { kind: 'decision_work_item_not_found' }
		});
	});

	it('Decision pendente e Decision tomada aceitam igualmente a associação', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));
		expect(state.decisions[0].status).toBe('pendente');

		state = unwrap(decideDecision(catalog, state, 'dec-1', 'Adiado para v2', T2));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-2', 'dec-1', 'wi-b', T3));
		expect(state.decisionAffectedWorkItems).toHaveLength(2);
	});

	it('decidir/corrigir a Decision preserva as relações existentes', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));

		state = unwrap(decideDecision(catalog, state, 'dec-1', 'Adiado para v2', T2));
		expect(state.decisionAffectedWorkItems).toEqual([
			{ id: 'dwi-1', projectId: 'proj-1', decisionId: 'dec-1', workItemId: 'wi-a', createdAt: T1 }
		]);

		state = unwrap(editDecisionOutcome(catalog, state, 'dec-1', 'Adiado para v3', T3));
		expect(state.decisionAffectedWorkItems).toEqual([
			{ id: 'dwi-1', projectId: 'proj-1', decisionId: 'dec-1', workItemId: 'wi-a', createdAt: T1 }
		]);
	});

	it('mover o WorkItem preserva as relações e não altera a Decision', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T1));

		state = unwrap(moveWorkItem(catalog, state, 'wi-a', 'concluido', T2));
		expect(state.decisionAffectedWorkItems).toEqual([
			{ id: 'dwi-1', projectId: 'proj-1', decisionId: 'dec-1', workItemId: 'wi-a', createdAt: T1 }
		]);
		expect(state.decisions[0]).toMatchObject({ status: 'pendente', outcome: null, decidedAt: null });
	});

	it('associar/desassociar nunca muda status/outcome/decidedAt da Decision nem status do WorkItem', () => {
		let state = stateWithDecisionAndWorkItems();
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-a', T2));
		expect(state.decisions[0]).toMatchObject({ status: 'pendente', outcome: null, decidedAt: null });
		expect(state.workItems.find((item) => item.id === 'wi-a')?.status).toBe('a_fazer');

		state = unwrap(unlinkWorkItemFromDecision(catalog, state, 'dwi-1'));
		expect(state.decisions[0]).toMatchObject({ status: 'pendente', outcome: null, decidedAt: null });
		expect(state.workItems.find((item) => item.id === 'wi-a')?.status).toBe('a_fazer');
	});
});

describe('Change (ETAPA 11 do rework, primeiro microcorte, §41)', () => {
	it('nasce sem impact', () => {
		const state = unwrap(addChange(catalog, freshState(), 'chg-1', 'Trocou o fornecedor de e-mail', T1));
		expect(state.changes).toEqual([
			{
				id: 'chg-1',
				projectId: 'proj-1',
				statement: 'Trocou o fornecedor de e-mail',
				impact: null,
				createdAt: T1,
				updatedAt: T1
			}
		]);
	});

	it('recusa statement vazio na criação', () => {
		const result = addChange(catalog, freshState(), 'chg-1', '   ', T1);
		expect(result).toEqual({ ok: false, error: { kind: 'change_statement_required' } });
	});

	it('editChangeStatement e setChangeImpact editam independentemente, impact aceita limpar com null', () => {
		const created = unwrap(addChange(catalog, freshState(), 'chg-1', 'Trocou o fornecedor de e-mail', T1));
		const withImpact = unwrap(setChangeImpact(catalog, created, 'chg-1', 'Atraso de 2 dias na migração', T2));
		expect(withImpact.changes[0].impact).toBe('Atraso de 2 dias na migração');

		const restated = unwrap(editChangeStatement(catalog, withImpact, 'chg-1', 'Trocou o fornecedor de e-mail (v2)', T3));
		expect(restated.changes[0]).toMatchObject({ statement: 'Trocou o fornecedor de e-mail (v2)', impact: 'Atraso de 2 dias na migração' });

		const cleared = unwrap(setChangeImpact(catalog, restated, 'chg-1', null, T4));
		expect(cleared.changes[0].impact).toBeNull();
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
				workItemId: null,
				decisionId: null,
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

	// ETAPA 11 do rework, segundo microcorte (§41/§13.4) — mudar tipo enquanto
	// decisionId estiver preenchido é recusado, nunca limpa a relação
	// silenciosamente.
	it('recusa mudar tipo enquanto decisionId estiver preenchido', () => {
		let state = unwrap(
			addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'decisao_pendente', T1)
		);
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Decidir algo', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));

		const before = state.impediments[0];
		const decisionBefore = state.decisions[0];
		const result = setImpedimentType(catalog, state, 'imp-1', 'outro', T2);
		expect(result).toEqual({ ok: false, error: { kind: 'impediment_type_change_blocked_by_decision' } });
		// A recusa preserva integralmente tipo, decisionId e a Decision — nunca
		// uma mutação parcial nem limpeza silenciosa da relação.
		expect(state.impediments[0]).toEqual(before);
		expect(state.impediments[0].tipo).toBe('decisao_pendente');
		expect(state.impediments[0].decisionId).toBe('dec-1');
		expect(state.decisions[0]).toEqual(decisionBefore);
	});

	it('permite mudar tipo depois de desassociar a Decision', () => {
		let state = unwrap(
			addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'decisao_pendente', T1)
		);
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Decidir algo', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', null, T1));

		state = unwrap(setImpedimentType(catalog, state, 'imp-1', 'outro', T2));
		expect(state.impediments[0].tipo).toBe('outro');
	});
});

describe('setImpedimentDecision', () => {
	function pendingImpedimentWithDecision() {
		let state = unwrap(
			addImpediment(catalog, freshState(), 'imp-1', 'Aguardando decisão', 'decisao_pendente', T1)
		);
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T1));
		return state;
	}

	it('Impediment nasce com decisionId: null', () => {
		const state = unwrap(
			addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'decisao_pendente', T1)
		);
		expect(state.impediments[0].decisionId).toBeNull();
	});

	it('associa uma Decision existente', () => {
		let state = pendingImpedimentWithDecision();
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T2));
		expect(state.impediments[0].decisionId).toBe('dec-1');
		expect(state.impediments[0].updatedAt).toBe(T2);
	});

	it('troca a associação para outra Decision', () => {
		let state = pendingImpedimentWithDecision();
		state = unwrap(addDecision(catalog, state, 'dec-2', 'Outro fornecedor?', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-2', T2));
		expect(state.impediments[0].decisionId).toBe('dec-2');
	});

	it('desassocia (decisionId: null)', () => {
		let state = pendingImpedimentWithDecision();
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', null, T2));
		expect(state.impediments[0].decisionId).toBeNull();
		expect(state.impediments[0].updatedAt).toBe(T2);
	});

	it('reassociar ao mesmo valor é no-op', () => {
		let state = pendingImpedimentWithDecision();
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));
		const result = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T2));
		expect(result.impediments[0].updatedAt).toBe(T1);
	});

	it('erro decision_not_found para Decision inexistente', () => {
		const state = pendingImpedimentWithDecision();
		const result = setImpedimentDecision(catalog, state, 'imp-1', 'nao-existe', T1);
		expect(result).toEqual({ ok: false, error: { kind: 'decision_not_found' } });
	});

	it('erro impediment_decision_requires_pending_type quando tipo não é decisao_pendente', () => {
		let state = unwrap(addImpediment(catalog, freshState(), 'imp-1', 'Texto', 'outro', T1));
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T1));
		const result = setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1);
		expect(result).toEqual({ ok: false, error: { kind: 'impediment_decision_requires_pending_type' } });
	});

	it('erro impediment_not_found para Impediment inexistente', () => {
		const result = setImpedimentDecision(catalog, freshState(), 'nao-existe', null, T1);
		expect(result).toEqual({ ok: false, error: { kind: 'impediment_not_found' } });
	});

	it('permite relacionar uma Decision já tomada', () => {
		let state = pendingImpedimentWithDecision();
		state = unwrap(decideDecision(catalog, state, 'dec-1', 'Fornecedor A', T1));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T2));
		expect(state.impediments[0].decisionId).toBe('dec-1');
		expect(state.decisions[0].status).toBe('tomada');
	});

	it('decidir/corrigir a Decision não altera o Impediment', () => {
		let state = pendingImpedimentWithDecision();
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));
		const before = state.impediments[0];
		state = unwrap(decideDecision(catalog, state, 'dec-1', 'Fornecedor A', T2));
		state = unwrap(editDecisionOutcome(catalog, state, 'dec-1', 'Fornecedor B', '2026-01-03T00:00:00.000Z'));
		expect(state.impediments[0]).toEqual(before);
	});

	it('resolver/reabrir o Impediment preserva decisionId e não altera a Decision', () => {
		let state = pendingImpedimentWithDecision();
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-1', 'dec-1', T1));
		const decisionBefore = state.decisions[0];
		state = unwrap(resolveImpediment(catalog, state, 'imp-1', T2));
		expect(state.impediments[0].decisionId).toBe('dec-1');
		expect(state.decisions[0]).toEqual(decisionBefore);
		state = unwrap(reopenImpediment(catalog, state, 'imp-1', '2026-01-03T00:00:00.000Z'));
		expect(state.impediments[0].decisionId).toBe('dec-1');
		expect(state.decisions[0]).toEqual(decisionBefore);
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

describe('CurrentTreatment / TreatmentStep (Stage 4A — "Como é tratado hoje")', () => {
	it('addTreatmentStep cria um passo com order/whatHappens/timestamps corretos e desliga noTreatment', () => {
		const state = unwrap(addTreatmentStep(catalog, freshState(), 'ts-1', '  Financeiro confere a planilha  ', T1));
		expect(state.treatmentSteps).toEqual([
			{
				id: 'ts-1',
				projectId: 'proj-1',
				order: 0,
				whatHappens: 'Financeiro confere a planilha',
				actors: [],
				medium: null,
				frictions: [],
				createdAt: T1,
				updatedAt: T1
			}
		]);
		expect(state.currentTreatment.noTreatment).toBe(false);
	});

	it('addTreatmentStep rejeita whatHappens vazio/só espaços', () => {
		expect(addTreatmentStep(catalog, freshState(), 'ts-1', '   ', T1)).toEqual({
			ok: false,
			error: { kind: 'invalid_field_value', fieldDefinitionId: 'whatHappens' }
		});
	});

	it('addTreatmentStep desliga noTreatment quando estava true (voltar a descrever)', () => {
		const none = unwrap(setTreatmentNoTreatment(catalog, freshState(), true, T1));
		const added = unwrap(addTreatmentStep(catalog, none, 'ts-1', 'Passo novo', T2));
		expect(added.currentTreatment.noTreatment).toBe(false);
		expect(added.treatmentSteps).toHaveLength(1);
	});

	it('getTreatmentConfirmationIssues: no_steps quando não há passos nem noTreatment; vazio quando noTreatment true', () => {
		expect(getTreatmentConfirmationIssues(false, [])).toEqual([{ kind: 'no_steps' }]);
		expect(getTreatmentConfirmationIssues(true, [])).toEqual([]);
	});

	function twoSteps(): ProjectState {
		let state = unwrap(addTreatmentStep(catalog, freshState(), 'ts-1', 'Primeiro passo', T1));
		state = unwrap(addTreatmentStep(catalog, state, 'ts-2', 'Segundo passo', T1));
		return state;
	}

	it('segundo passo entra com order 1, ao final da cadeia', () => {
		const state = twoSteps();
		expect(state.treatmentSteps.map((s) => ({ id: s.id, order: s.order }))).toEqual([
			{ id: 'ts-1', order: 0 },
			{ id: 'ts-2', order: 1 }
		]);
	});

	it('removeTreatmentStep remove o passo e reindexa order dos restantes; erro treatment_step_not_found para id inexistente', () => {
		let state = twoSteps();
		state = unwrap(addTreatmentStep(catalog, state, 'ts-3', 'Terceiro passo', T1));
		const removed = unwrap(removeTreatmentStep(catalog, state, 'ts-1', T2));
		expect(removed.treatmentSteps.map((s) => ({ id: s.id, order: s.order }))).toEqual([
			{ id: 'ts-2', order: 0 },
			{ id: 'ts-3', order: 1 }
		]);
		expect(removeTreatmentStep(catalog, removed, 'ts-1', T2)).toEqual({
			ok: false,
			error: { kind: 'treatment_step_not_found' }
		});
	});

	it('moveTreatmentStep troca order com o vizinho; nos limites é no-op', () => {
		const state = twoSteps();
		const moved = unwrap(moveTreatmentStep(catalog, state, 'ts-2', -1, T2));
		// A coleção mantém a ordem de inserção — só o campo `order` troca; quem
		// ordena por `order` para exibição é a camada de projeção (ProjectView).
		expect(moved.treatmentSteps.map((s) => ({ id: s.id, order: s.order }))).toEqual([
			{ id: 'ts-1', order: 1 },
			{ id: 'ts-2', order: 0 }
		]);

		const noopFirst = unwrap(moveTreatmentStep(catalog, state, 'ts-1', -1, T2));
		expect(noopFirst).toBe(state);
		const noopLast = unwrap(moveTreatmentStep(catalog, state, 'ts-2', 1, T2));
		expect(noopLast).toBe(state);
	});

	it('moveTreatmentStep: erro treatment_step_not_found para id inexistente', () => {
		expect(moveTreatmentStep(catalog, freshState(), 'inexistente', 1, T1)).toEqual({
			ok: false,
			error: { kind: 'treatment_step_not_found' }
		});
	});

	it('setTreatmentStepActors define a lista, remove espaços/vazios; erro treatment_step_not_found para id inexistente', () => {
		const state = unwrap(addTreatmentStep(catalog, freshState(), 'ts-1', 'Passo', T1));
		const withActors = unwrap(
			setTreatmentStepActors(catalog, state, 'ts-1', [' Financeiro ', '', 'Gestor'], T2)
		);
		expect(withActors.treatmentSteps[0].actors).toEqual(['Financeiro', 'Gestor']);
		expect(setTreatmentStepActors(catalog, freshState(), 'inexistente', ['x'], T1)).toEqual({
			ok: false,
			error: { kind: 'treatment_step_not_found' }
		});
	});

	it('setTreatmentStepMedium define/limpa o valor (string vazia ou null viram null)', () => {
		const state = unwrap(addTreatmentStep(catalog, freshState(), 'ts-1', 'Passo', T1));
		const withMedium = unwrap(setTreatmentStepMedium(catalog, state, 'ts-1', 'Planilha', T2));
		expect(withMedium.treatmentSteps[0].medium).toBe('Planilha');
		const cleared = unwrap(setTreatmentStepMedium(catalog, withMedium, 'ts-1', '', T2));
		expect(cleared.treatmentSteps[0].medium).toBeNull();
	});

	it('toggleTreatmentStepFriction alterna a presença da fricção; erro treatment_step_not_found para id inexistente', () => {
		const state = unwrap(addTreatmentStep(catalog, freshState(), 'ts-1', 'Passo', T1));
		const withFriction = unwrap(toggleTreatmentStepFriction(catalog, state, 'ts-1', 'espera', T2));
		expect(withFriction.treatmentSteps[0].frictions).toEqual(['espera']);
		const removed = unwrap(toggleTreatmentStepFriction(catalog, withFriction, 'ts-1', 'espera', T2));
		expect(removed.treatmentSteps[0].frictions).toEqual([]);
		expect(toggleTreatmentStepFriction(catalog, freshState(), 'inexistente', 'trava', T1)).toEqual({
			ok: false,
			error: { kind: 'treatment_step_not_found' }
		});
	});

	it('setTreatmentNoTreatment(true) remove todos os passos existentes (invariante: nunca os dois)', () => {
		const state = twoSteps();
		const none = unwrap(setTreatmentNoTreatment(catalog, state, true, T2));
		expect(none.currentTreatment.noTreatment).toBe(true);
		expect(none.treatmentSteps).toEqual([]);
	});

	it('setTreatmentNoTreatment: valor repetido é no-op (não altera updatedAt)', () => {
		const first = unwrap(setTreatmentNoTreatment(catalog, freshState(), true, T1));
		const second = unwrap(setTreatmentNoTreatment(catalog, first, true, T2));
		expect(second).toBe(first);
	});

	it('confirmTreatment conclui "estado_atual" com passos ou com noTreatment', () => {
		const withSteps = unwrap(confirmTreatment(catalog, twoSteps(), T2));
		expect(withSteps.activityProgress.find((p) => p.activityDefinitionId === 'estado_atual')?.status).toBe('concluída');

		const none = unwrap(setTreatmentNoTreatment(catalog, freshState(), true, T1));
		const confirmedNone = unwrap(confirmTreatment(catalog, none, T2));
		expect(confirmedNone.activityProgress.find((p) => p.activityDefinitionId === 'estado_atual')?.status).toBe(
			'concluída'
		);
	});

	it('confirmTreatment erro treatment_confirmation_invalid quando vazio e não noTreatment', () => {
		expect(confirmTreatment(catalog, freshState(), T1)).toEqual({
			ok: false,
			error: { kind: 'treatment_confirmation_invalid', issues: [{ kind: 'no_steps' }] }
		});
	});

	it('confirmTreatment erro transition_not_allowed se já concluída', () => {
		const confirmed = unwrap(confirmTreatment(catalog, twoSteps(), T1));
		expect(confirmTreatment(catalog, confirmed, T2)).toEqual({
			ok: false,
			error: { kind: 'transition_not_allowed', from: 'concluída' }
		});
	});

	it('adicionar um novo passo depois de concluído não reabre "estado_atual" (continua com passos)', () => {
		const confirmed = unwrap(confirmTreatment(catalog, twoSteps(), T1));
		const withNewStep = unwrap(addTreatmentStep(catalog, confirmed, 'ts-3', 'Terceiro passo', T2));
		expect(withNewStep.activityProgress.find((p) => p.activityDefinitionId === 'estado_atual')?.status).toBe(
			'concluída'
		);
	});

	it('remover o único passo depois de concluído reabre "estado_atual"', () => {
		let state = unwrap(addTreatmentStep(catalog, freshState(), 'ts-1', 'Único passo', T1));
		state = unwrap(confirmTreatment(catalog, state, T1));
		const removed = unwrap(removeTreatmentStep(catalog, state, 'ts-1', T2));
		expect(removed.activityProgress.find((p) => p.activityDefinitionId === 'estado_atual')?.status).toBe(
			'em_andamento'
		);
	});

	it('addTreatmentStep invalida o Resumo já concluído (mesma regra de answerActivity/addAffectedGroup)', () => {
		const withSummary = unwrap(confirmSummary(catalog, freshState()));
		const added = unwrap(addTreatmentStep(catalog, withSummary, 'ts-1', 'Novo passo', T2));
		const resumo = added.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});
});

describe('CauseHypothesis / CauseExploration (Stage 4B — "Entender as causas")', () => {
	function withEvidence(): { state: ProjectState; evidenceId: string } {
		let state = unwrap(addAffectedGroup(catalog, freshState(), 'ag-1', 'Equipe de vendas', T1));
		state = unwrap(
			prepareExternalAction(
				catalog,
				state,
				'ea-1',
				'ag-1',
				{ objective: 'Validar', questions: ['Pergunta?'], informationToTake: ['Info'], expectedResult: 'Resultado' },
				T1
			)
		);
		state = unwrap(completeExternalAction(catalog, state, 'ea-1', 'ev-1', 'confirmed', 'Aprendizado real', T2));
		return { state, evidenceId: 'ev-1' };
	}

	it('addCauseHypothesis cria uma hipótese com title/origin e desliga stillUnknown', () => {
		const marked = unwrap(markCauseExplorationUnknown(catalog, freshState(), T1));
		const state = unwrap(addCauseHypothesis(catalog, marked, 'ch-1', '  O aprovador só revisa uma vez por semana  ', 'Fricção observada', T2));
		expect(state.causeHypotheses).toEqual([
			{
				id: 'ch-1',
				projectId: 'proj-1',
				title: 'O aprovador só revisa uma vez por semana',
				origin: 'Fricção observada',
				expectedIfTrue: null,
				whatWeakensIt: null,
				evidenceIds: [],
				createdAt: T2,
				updatedAt: T2
			}
		]);
		expect(state.causeExploration.stillUnknown).toBe(false);
	});

	it('addCauseHypothesis rejeita title vazio/só espaços; origin ausente vira null', () => {
		expect(addCauseHypothesis(catalog, freshState(), 'ch-1', '   ', null, T1)).toEqual({
			ok: false,
			error: { kind: 'invalid_field_value', fieldDefinitionId: 'title' }
		});
		const state = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Hipótese', '   ', T1));
		expect(state.causeHypotheses[0].origin).toBeNull();
	});

	it('múltiplas hipóteses coexistem', () => {
		let state = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Primeira', null, T1));
		state = unwrap(addCauseHypothesis(catalog, state, 'ch-2', 'Segunda', null, T1));
		expect(state.causeHypotheses.map((h) => h.id)).toEqual(['ch-1', 'ch-2']);
	});

	it('setCauseHypothesisTitle edita; erro cause_hypothesis_not_found para id inexistente', () => {
		const state = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Original', null, T1));
		const edited = unwrap(setCauseHypothesisTitle(catalog, state, 'ch-1', '  Editada  ', T2));
		expect(edited.causeHypotheses[0].title).toBe('Editada');
		expect(setCauseHypothesisTitle(catalog, freshState(), 'inexistente', 'x', T1)).toEqual({
			ok: false,
			error: { kind: 'cause_hypothesis_not_found' }
		});
		expect(setCauseHypothesisTitle(catalog, state, 'ch-1', '   ', T1)).toEqual({
			ok: false,
			error: { kind: 'invalid_field_value', fieldDefinitionId: 'title' }
		});
	});

	it('setCauseHypothesisExpectedIfTrue/WhatWeakensIt definem e limpam (string vazia ou null viram null)', () => {
		const state = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Hipótese', null, T1));
		const withSigns = unwrap(setCauseHypothesisExpectedIfTrue(catalog, state, 'ch-1', 'Sinal esperado', T2));
		expect(withSigns.causeHypotheses[0].expectedIfTrue).toBe('Sinal esperado');
		const cleared = unwrap(setCauseHypothesisExpectedIfTrue(catalog, withSigns, 'ch-1', '', T2));
		expect(cleared.causeHypotheses[0].expectedIfTrue).toBeNull();

		const withWeakens = unwrap(setCauseHypothesisWhatWeakensIt(catalog, state, 'ch-1', 'Sinal contrário', T2));
		expect(withWeakens.causeHypotheses[0].whatWeakensIt).toBe('Sinal contrário');
		const clearedWeakens = unwrap(setCauseHypothesisWhatWeakensIt(catalog, withWeakens, 'ch-1', null, T2));
		expect(clearedWeakens.causeHypotheses[0].whatWeakensIt).toBeNull();
	});

	it('toggleCauseHypothesisEvidence liga/desliga; erro evidence_not_found para evidência inexistente', () => {
		const { state, evidenceId } = withEvidence();
		const withHypothesis = unwrap(addCauseHypothesis(catalog, state, 'ch-1', 'Hipótese', null, T2));
		const linked = unwrap(toggleCauseHypothesisEvidence(catalog, withHypothesis, 'ch-1', evidenceId, T2));
		expect(linked.causeHypotheses[0].evidenceIds).toEqual([evidenceId]);
		const unlinked = unwrap(toggleCauseHypothesisEvidence(catalog, linked, 'ch-1', evidenceId, T2));
		expect(unlinked.causeHypotheses[0].evidenceIds).toEqual([]);
		expect(toggleCauseHypothesisEvidence(catalog, withHypothesis, 'ch-1', 'ev-inexistente', T2)).toEqual({
			ok: false,
			error: { kind: 'evidence_not_found' }
		});
	});

	it('removeCauseHypothesis remove a hipótese; erro cause_hypothesis_not_found para id inexistente', () => {
		const state = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Hipótese', null, T1));
		const removed = unwrap(removeCauseHypothesis(catalog, state, 'ch-1'));
		expect(removed.causeHypotheses).toEqual([]);
		expect(removeCauseHypothesis(catalog, removed, 'ch-1')).toEqual({
			ok: false,
			error: { kind: 'cause_hypothesis_not_found' }
		});
	});

	it('markCauseExplorationUnknown só é permitido com zero hipóteses (invariante: nunca transição destrutiva)', () => {
		const withHypothesis = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Hipótese', null, T1));
		expect(markCauseExplorationUnknown(catalog, withHypothesis, T2)).toEqual({
			ok: false,
			error: { kind: 'cause_exploration_has_hypotheses' }
		});

		const marked = unwrap(markCauseExplorationUnknown(catalog, freshState(), T1));
		expect(marked.causeExploration.stillUnknown).toBe(true);
	});

	it('markCauseExplorationUnknown: valor repetido é no-op', () => {
		const marked = unwrap(markCauseExplorationUnknown(catalog, freshState(), T1));
		const again = unwrap(markCauseExplorationUnknown(catalog, marked, T2));
		expect(again).toBe(marked);
	});

	it('undoCauseExplorationUnknown desliga stillUnknown; no-op quando já false', () => {
		const marked = unwrap(markCauseExplorationUnknown(catalog, freshState(), T1));
		const undone = unwrap(undoCauseExplorationUnknown(catalog, marked, T2));
		expect(undone.causeExploration.stillUnknown).toBe(false);
		const noop = unwrap(undoCauseExplorationUnknown(catalog, undone, T2));
		expect(noop).toBe(undone);
	});

	it('getCauseHypothesesConfirmationIssues é sempre vazio', () => {
		expect(getCauseHypothesesConfirmationIssues()).toEqual([]);
	});

	it('confirmCauseHypotheses conclui "entender_causas" com zero hipóteses e stillUnknown false (nunca bloqueada)', () => {
		const confirmed = unwrap(confirmCauseHypotheses(catalog, freshState(), T1));
		expect(confirmed.activityProgress.find((p) => p.activityDefinitionId === 'entender_causas')?.status).toBe(
			'concluída'
		);
	});

	it('confirmCauseHypotheses conclui também com hipóteses ou com stillUnknown true', () => {
		const withHypothesis = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Hipótese', null, T1));
		const confirmedWithHypothesis = unwrap(confirmCauseHypotheses(catalog, withHypothesis, T2));
		expect(
			confirmedWithHypothesis.activityProgress.find((p) => p.activityDefinitionId === 'entender_causas')?.status
		).toBe('concluída');

		const marked = unwrap(markCauseExplorationUnknown(catalog, freshState(), T1));
		const confirmedUnknown = unwrap(confirmCauseHypotheses(catalog, marked, T2));
		expect(confirmedUnknown.activityProgress.find((p) => p.activityDefinitionId === 'entender_causas')?.status).toBe(
			'concluída'
		);
	});

	it('confirmCauseHypotheses: erro transition_not_allowed se já concluída', () => {
		const confirmed = unwrap(confirmCauseHypotheses(catalog, freshState(), T1));
		expect(confirmCauseHypotheses(catalog, confirmed, T2)).toEqual({
			ok: false,
			error: { kind: 'transition_not_allowed', from: 'concluída' }
		});
	});

	it('remover a única hipótese depois de concluído não reabre "entender_causas" (nunca bloqueada por estado incompleto)', () => {
		const withHypothesis = unwrap(addCauseHypothesis(catalog, freshState(), 'ch-1', 'Hipótese', null, T1));
		const confirmed = unwrap(confirmCauseHypotheses(catalog, withHypothesis, T1));
		const removed = unwrap(removeCauseHypothesis(catalog, confirmed, 'ch-1'));
		expect(removed.activityProgress.find((p) => p.activityDefinitionId === 'entender_causas')?.status).toBe(
			'concluída'
		);
	});

	it('addCauseHypothesis invalida o Resumo já concluído (mesma regra de addAffectedGroup/addTreatmentStep)', () => {
		const withSummary = unwrap(confirmSummary(catalog, freshState()));
		const added = unwrap(addCauseHypothesis(catalog, withSummary, 'ch-1', 'Nova hipótese', null, T2));
		const resumo = added.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});
});

describe('DesiredOutcome (Stage 4C — "Resultado desejado")', () => {
	it('addDesiredOutcome cria um resultado com target null, order = length atual e timestamps = occurredAt', () => {
		const state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Solicitações centralizadas', T1));
		expect(state.desiredOutcomes).toEqual([
			{
				id: 'do-1',
				projectId: 'proj-1',
				change: 'Solicitações centralizadas',
				target: null,
				order: 0,
				createdAt: T1,
				updatedAt: T1
			}
		]);
		const second = unwrap(addDesiredOutcome(catalog, state, 'do-2', 'Acompanhamento do início ao fim', T2));
		expect(second.desiredOutcomes[1].order).toBe(1);
	});

	it('addDesiredOutcome rejeita change vazio/só espaços', () => {
		expect(addDesiredOutcome(catalog, freshState(), 'do-1', '   ', T1)).toEqual({
			ok: false,
			error: { kind: 'invalid_field_value', fieldDefinitionId: 'change' }
		});
	});

	it('getDesiredOutcomeConfirmationIssues: no_outcomes quando vazio, vazio quando ao menos um outcome com change preenchido', () => {
		expect(getDesiredOutcomeConfirmationIssues([])).toEqual([{ kind: 'no_outcomes' }]);
		const state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Mudança real', T1));
		expect(getDesiredOutcomeConfirmationIssues(state.desiredOutcomes)).toEqual([]);
	});

	it('setDesiredOutcomeChange edita (trim); erro desired_outcome_not_found para id inexistente; rejeita change vazio', () => {
		const state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Original', T1));
		const edited = unwrap(setDesiredOutcomeChange(catalog, state, 'do-1', '  Editado  ', T2));
		expect(edited.desiredOutcomes[0].change).toBe('Editado');
		expect(setDesiredOutcomeChange(catalog, freshState(), 'inexistente', 'x', T1)).toEqual({
			ok: false,
			error: { kind: 'desired_outcome_not_found' }
		});
		expect(setDesiredOutcomeChange(catalog, state, 'do-1', '   ', T1)).toEqual({
			ok: false,
			error: { kind: 'invalid_field_value', fieldDefinitionId: 'change' }
		});
	});

	it('setDesiredOutcomeTarget define/limpa (string vazia ou null viram null); é sempre opcional', () => {
		const state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Mudança', T1));
		const withTarget = unwrap(setDesiredOutcomeTarget(catalog, state, 'do-1', '-30% de retrabalho', T2));
		expect(withTarget.desiredOutcomes[0].target).toBe('-30% de retrabalho');
		const cleared = unwrap(setDesiredOutcomeTarget(catalog, withTarget, 'do-1', '', T2));
		expect(cleared.desiredOutcomes[0].target).toBeNull();
		expect(setDesiredOutcomeTarget(catalog, freshState(), 'inexistente', 'x', T1)).toEqual({
			ok: false,
			error: { kind: 'desired_outcome_not_found' }
		});
	});

	it('removeDesiredOutcome remove e reindexa order dos restantes; erro desired_outcome_not_found para id inexistente', () => {
		let state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Primeiro', T1));
		state = unwrap(addDesiredOutcome(catalog, state, 'do-2', 'Segundo', T1));
		state = unwrap(addDesiredOutcome(catalog, state, 'do-3', 'Terceiro', T1));
		const removed = unwrap(removeDesiredOutcome(catalog, state, 'do-2', T2));
		expect(removed.desiredOutcomes.map((o) => [o.id, o.order])).toEqual([
			['do-1', 0],
			['do-3', 1]
		]);
		expect(removeDesiredOutcome(catalog, removed, 'do-2', T2)).toEqual({
			ok: false,
			error: { kind: 'desired_outcome_not_found' }
		});
	});

	it('moveDesiredOutcome troca order com o vizinho adjacente; fora dos limites é no-op', () => {
		let state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Primeiro', T1));
		state = unwrap(addDesiredOutcome(catalog, state, 'do-2', 'Segundo', T1));
		const moved = unwrap(moveDesiredOutcome(catalog, state, 'do-2', -1, T2));
		expect(moved.desiredOutcomes.map((o) => [o.id, o.order])).toEqual([
			['do-1', 1],
			['do-2', 0]
		]);
		const noop = unwrap(moveDesiredOutcome(catalog, moved, 'do-2', -1, T2));
		expect(noop).toBe(moved);
		expect(moveDesiredOutcome(catalog, freshState(), 'inexistente', -1, T1)).toEqual({
			ok: false,
			error: { kind: 'desired_outcome_not_found' }
		});
	});

	it('confirmDesiredOutcomes conclui "resultado" quando há ao menos um outcome válido', () => {
		const state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Mudança real', T1));
		const confirmed = unwrap(confirmDesiredOutcomes(catalog, state, T2));
		expect(confirmed.activityProgress.find((p) => p.activityDefinitionId === 'resultado')?.status).toBe('concluída');
	});

	it('confirmDesiredOutcomes erro desired_outcome_confirmation_invalid quando vazio (nunca conclui sem ao menos 1 outcome)', () => {
		expect(confirmDesiredOutcomes(catalog, freshState(), T1)).toEqual({
			ok: false,
			error: { kind: 'desired_outcome_confirmation_invalid', issues: [{ kind: 'no_outcomes' }] }
		});
	});

	it('confirmDesiredOutcomes: erro transition_not_allowed se já concluída', () => {
		const state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Mudança', T1));
		const confirmed = unwrap(confirmDesiredOutcomes(catalog, state, T1));
		expect(confirmDesiredOutcomes(catalog, confirmed, T2)).toEqual({
			ok: false,
			error: { kind: 'transition_not_allowed', from: 'concluída' }
		});
	});

	it('remover o único outcome depois de concluído reabre "resultado" (ao contrário de entender_causas, é bloqueada por estado incompleto)', () => {
		const state = unwrap(addDesiredOutcome(catalog, freshState(), 'do-1', 'Mudança real', T1));
		const confirmed = unwrap(confirmDesiredOutcomes(catalog, state, T1));
		const removed = unwrap(removeDesiredOutcome(catalog, confirmed, 'do-1', T2));
		expect(removed.activityProgress.find((p) => p.activityDefinitionId === 'resultado')?.status).toBe(
			'em_andamento'
		);
	});

	it('addDesiredOutcome invalida o Resumo já concluído (mesma regra de addAffectedGroup/addTreatmentStep/addCauseHypothesis)', () => {
		const withSummary = unwrap(confirmSummary(catalog, freshState()));
		const added = unwrap(addDesiredOutcome(catalog, withSummary, 'do-1', 'Nova mudança', T2));
		const resumo = added.activityProgress.find((p) => p.activityDefinitionId === 'resumo');
		expect(resumo?.status).toBe('em_andamento');
	});
});


// Milestone (ETAPA 8 do rework, segundo microcorte) — o ponto central destes
// testes é NEGATIVO: nada deriva o estado do marco do trabalho relacionado, em
// nenhuma direção. A associação significa "trabalho relacionado/contribuinte",
// nunca conjunto exaustivo de condições necessárias.
describe('Milestone (ETAPA 8 do rework, segundo microcorte)', () => {
	function stateWithWorkItems(): ProjectState {
		let state = freshState();
		state = unwrap(addWorkItem(catalog, state, 'wi-a', 'A', T1));
		state = unwrap(addWorkItem(catalog, state, 'wi-b', 'B', T1));
		return state;
	}

	it('addMilestone cria o marco aberto, sem reachedAt e sem vínculo', () => {
		const state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Fluxo ponta a ponta', T1));
		expect(state.milestones).toEqual([
			{
				id: 'ms-1',
				projectId: 'proj-1',
				title: 'Fluxo ponta a ponta',
				status: 'aberto',
				reachedAt: null,
				plannedDate: null,
				createdAt: T1,
				updatedAt: T1
			}
		]);
		expect(state.milestoneWorkItems).toEqual([]);
	});

	it('marco sem nenhum trabalho relacionado pode ser alcançado explicitamente', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		expect(state.milestoneWorkItems).toEqual([]);

		state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));
		expect(state.milestones[0].status).toBe('alcancado');
		expect(state.milestones[0].reachedAt).toBe(T2);
	});

	it('trabalho relacionado ainda aberto não impede reachMilestone', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));
		expect(state.workItems.find((item) => item.id === 'wi-a')?.status).toBe('a_fazer');

		state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));
		expect(state.milestones[0]).toMatchObject({ status: 'alcancado', reachedAt: T2 });
		// E o trabalho relacionado segue exatamente como estava.
		expect(state.workItems.find((item) => item.id === 'wi-a')?.status).toBe('a_fazer');
	});

	it('concluir todos os trabalhos relacionados NÃO alcança o marco', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-2', 'ms-1', 'wi-b', T1));

		state = unwrap(moveWorkItem(catalog, state, 'wi-a', 'concluido', T2));
		state = unwrap(moveWorkItem(catalog, state, 'wi-b', 'concluido', T2));

		expect(state.milestones[0].status).toBe('aberto');
		expect(state.milestones[0].reachedAt).toBeNull();
	});

	it('associar/desassociar trabalho nunca altera o status do marco', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));

		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T2));
		expect(state.milestones[0]).toMatchObject({ status: 'alcancado', reachedAt: T2 });

		state = unwrap(unlinkWorkItemFromMilestone(catalog, state, 'mwi-1'));
		expect(state.milestones[0]).toMatchObject({ status: 'alcancado', reachedAt: T2 });
		expect(state.milestoneWorkItems).toEqual([]);
	});

	it('reopenMilestone limpa reachedAt; o par status × reachedAt muda sempre junto', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));
		expect(state.milestones[0].reachedAt).toBe(T2);

		state = unwrap(reopenMilestone(catalog, state, 'ms-1', T2));
		expect(state.milestones[0]).toMatchObject({ status: 'aberto', reachedAt: null });
	});

	it('reachMilestone/reopenMilestone são idempotentes e não reescrevem o reachedAt original', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		state = unwrap(reachMilestone(catalog, state, 'ms-1', T1));
		const again = unwrap(reachMilestone(catalog, state, 'ms-1', T2));
		expect(again.milestones[0].reachedAt).toBe(T1);
		expect(again).toBe(state);

		const reopened = unwrap(reopenMilestone(catalog, again, 'ms-1', T2));
		expect(unwrap(reopenMilestone(catalog, reopened, 'ms-1', T2))).toBe(reopened);
	});

	it('recusa vínculo duplicado e referências inexistentes', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));

		expect(linkWorkItemToMilestone(catalog, state, 'mwi-2', 'ms-1', 'wi-a', T2)).toEqual({
			ok: false,
			error: { kind: 'milestone_work_item_already_linked' }
		});
		expect(linkWorkItemToMilestone(catalog, state, 'mwi-2', 'nao-existe', 'wi-a', T2)).toEqual({
			ok: false,
			error: { kind: 'milestone_not_found' }
		});
		expect(linkWorkItemToMilestone(catalog, state, 'mwi-2', 'ms-1', 'nao-existe', T2)).toEqual({
			ok: false,
			error: { kind: 'work_item_not_found' }
		});
		expect(reachMilestone(catalog, state, 'nao-existe', T2)).toEqual({
			ok: false,
			error: { kind: 'milestone_not_found' }
		});
		expect(unlinkWorkItemFromMilestone(catalog, state, 'nao-existe')).toEqual({
			ok: false,
			error: { kind: 'milestone_work_item_not_found' }
		});
	});

	// O mesmo trabalho pode contribuir para mais de um marco (N:N): o par
	// duplicado recusado acima é (marco, trabalho), não o trabalho sozinho.
	it('permite o mesmo trabalho relacionado a mais de um marco', () => {
		let state = stateWithWorkItems();
		state = unwrap(addMilestone(catalog, state, 'ms-1', 'Marco 1', T1));
		state = unwrap(addMilestone(catalog, state, 'ms-2', 'Marco 2', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-2', 'ms-2', 'wi-a', T1));
		expect(state.milestoneWorkItems).toHaveLength(2);
	});

	it('marco não interfere em moveWorkItem: nenhuma transição nova é recusada', () => {
		let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
		state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));
		state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));

		expect(moveWorkItem(catalog, state, 'wi-a', 'concluido', T2).ok).toBe(true);
	});

	// Data planejada (microcorte de Timeline) — o ponto central destes testes
	// também é NEGATIVO: a data é intenção declarada e não toca nada além dela
	// mesma. Se algum dia definir/limpar data alterar status, reachedAt ou
	// trabalho, o contrato do §38 foi quebrado aqui.
	describe('plannedDate', () => {
		it('define, reagenda e limpa pela mesma operação, sempre atualizando updatedAt', () => {
			let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
			expect(state.milestones[0].plannedDate).toBeNull();

			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2026-09-01', T2));
			expect(state.milestones[0].plannedDate).toBe('2026-09-01');
			expect(state.milestones[0].updatedAt).toBe(T2);

			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2026-10-15', T3));
			expect(state.milestones[0].plannedDate).toBe('2026-10-15');
			expect(state.milestones[0].updatedAt).toBe(T3);

			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', null, T4));
			expect(state.milestones[0].plannedDate).toBeNull();
			expect(state.milestones[0].updatedAt).toBe(T4);
		});

		it('é idempotente de verdade: repetir o mesmo valor não reescreve updatedAt', () => {
			let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2026-09-01', T2));

			const again = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2026-09-01', T3));
			expect(again.milestones[0].updatedAt).toBe(T2);

			// Limpar duas vezes segue a mesma regra.
			const cleared = unwrap(setMilestonePlannedDate(catalog, again, 'ms-1', null, T3));
			const clearedAgain = unwrap(setMilestonePlannedDate(catalog, cleared, 'ms-1', null, T4));
			expect(clearedAgain.milestones[0].updatedAt).toBe(T3);
		});

		it('recusa data que não é dia civil real', () => {
			const state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
			for (const invalid of ['2026-02-30', '2026-13-01', '2026-09-01T00:00:00.000Z', '01/09/2026', '2026-9-1', '']) {
				expect(setMilestonePlannedDate(catalog, state, 'ms-1', invalid, T2)).toEqual({
					ok: false,
					error: { kind: 'milestone_planned_date_invalid' }
				});
			}
		});

		it('não toca status, reachedAt, trabalho relacionado nem dependências', () => {
			let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
			state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-a', T1));
			const before = { workItems: state.workItems, links: state.milestoneWorkItems, deps: state.dependencies };

			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2026-09-01', T2));
			expect(state.milestones[0].status).toBe('aberto');
			expect(state.milestones[0].reachedAt).toBeNull();
			expect(state.workItems).toEqual(before.workItems);
			expect(state.milestoneWorkItems).toEqual(before.links);
			expect(state.dependencies).toEqual(before.deps);

			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', null, T3));
			expect(state.milestones[0].status).toBe('aberto');
			expect(state.milestones[0].reachedAt).toBeNull();
		});

		// Data futura e data passada num marco já alcançado são estado
		// LEGÍTIMO: o Hydra não corrige, não recusa e não interpreta.
		it('marco alcançado aceita data planejada futura e passada', () => {
			let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
			state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));

			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2099-12-31', T3));
			expect(state.milestones[0]).toMatchObject({ status: 'alcancado', reachedAt: T2, plannedDate: '2099-12-31' });

			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '1999-01-01', T3));
			expect(state.milestones[0]).toMatchObject({ status: 'alcancado', reachedAt: T2, plannedDate: '1999-01-01' });
		});

		// Simétrico: alcançar/reabrir também nunca mexem na data planejada.
		it('reachMilestone e reopenMilestone preservam a data planejada', () => {
			let state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
			state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-1', '2026-09-01', T2));

			state = unwrap(reachMilestone(catalog, state, 'ms-1', T3));
			expect(state.milestones[0].plannedDate).toBe('2026-09-01');

			state = unwrap(reopenMilestone(catalog, state, 'ms-1', T4));
			expect(state.milestones[0].plannedDate).toBe('2026-09-01');
		});

		it('marco inexistente é recusado', () => {
			const state = unwrap(addMilestone(catalog, stateWithWorkItems(), 'ms-1', 'Marco', T1));
			expect(setMilestonePlannedDate(catalog, state, 'nao-existe', '2026-09-01', T2)).toEqual({
				ok: false,
				error: { kind: 'milestone_not_found' }
			});
		});
	});
});
