import { describe, expect, it } from 'vitest';
import { catalog } from '../../catalog';
import type { ProjectState } from '../../domain';
import { buildProjectView } from './project-view';

function baseState(overrides: Partial<ProjectState> = {}): ProjectState {
	return {
		project: { id: 'p1', name: null, createdAt: '2026-01-01T00:00:00.000Z' },
		activityProgress: [],
		answers: [],
		pendingItems: [],
		scopeItems: [],
		deliverables: [],
		scopeVersion: { projectId: 'p1', hypothesis: '', confirmedAt: null },
		impediments: [],
		workItems: [],
		dependencies: [],
		scheduleBaselines: [],
		scheduleBaselineEntries: [],
		milestones: [],
		milestoneWorkItems: [],
		risks: [],
		decisions: [],
		decisionAffectedWorkItems: [],
		changes: [],
		affectedGroups: [],
		externalActions: [],
		evidences: [],
		currentTreatment: { projectId: 'p1', noTreatment: false, updatedAt: '2026-01-01T00:00:00.000Z' },
		treatmentSteps: [],
		causeExploration: { projectId: 'p1', stillUnknown: false, updatedAt: '2026-01-01T00:00:00.000Z' },
		causeHypotheses: [],
		desiredOutcomes: [],
		...overrides
	};
}

describe('buildProjectView — pendingItemHistory', () => {
	it('fica vazio quando não há pendências', () => {
		const view = buildProjectView(catalog, baseState());
		expect(view.pendingItemHistory).toEqual([]);
	});

	it('projeta uma pendência aberta corretamente, sem resolvedAt', () => {
		const state = baseState({
			pendingItems: [
				{
					id: 'pend-1',
					projectId: 'p1',
					activityDefinitionId: 'origem',
					status: 'aberta',
					createdAt: '2026-01-02T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.pendingItemHistory).toHaveLength(1);
		expect(view.pendingItemHistory[0]).toEqual({
			id: 'pend-1',
			activityDefinitionId: 'origem',
			label: 'Origem do projeto não foi definida',
			detail: 'Ajuda o Hydra a calibrar o tom e a profundidade das próximas perguntas.',
			status: 'aberta',
			createdAt: '2026-01-02T00:00:00.000Z'
		});
		expect(view.pendingItemHistory[0]).not.toHaveProperty('resolvedAt');
	});

	it('C5-01: projeta a pendência de "Priorizar entregas" (explicit_confirmation, allowsSkip true)', () => {
		const state = baseState({
			pendingItems: [
				{
					id: 'pend-priorizar',
					projectId: 'p1',
					activityDefinitionId: 'priorizar_entregas',
					status: 'aberta',
					createdAt: '2026-01-02T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.pendingItemHistory).toHaveLength(1);
		expect(view.pendingItemHistory[0]).toEqual({
			id: 'pend-priorizar',
			activityDefinitionId: 'priorizar_entregas',
			label: 'As entregas não foram priorizadas aqui',
			detail: 'Crie e ordene entregas em Entregas e volte para confirmar — ou pule esta etapa.',
			status: 'aberta',
			createdAt: '2026-01-02T00:00:00.000Z'
		});
	});

	it('C5-01: nunca projeta pendência de "Escolha o próximo foco" (scope_confirmation, sem pendingItemLabel)', () => {
		const state = baseState({
			pendingItems: [
				{
					id: 'pend-scope',
					projectId: 'p1',
					activityDefinitionId: 'montar_proxima_versao',
					status: 'aberta',
					createdAt: '2026-01-02T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.pendingItemHistory).toEqual([]);
	});

	it('projeta uma pendência resolvida corretamente, com resolvedAt', () => {
		const state = baseState({
			pendingItems: [
				{
					id: 'pend-2',
					projectId: 'p1',
					activityDefinitionId: 'origem',
					status: 'resolvida',
					createdAt: '2026-01-02T00:00:00.000Z',
					resolvedAt: '2026-01-03T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.pendingItemHistory).toHaveLength(1);
		expect(view.pendingItemHistory[0]).toEqual({
			id: 'pend-2',
			activityDefinitionId: 'origem',
			label: 'Origem do projeto não foi definida',
			detail: 'Ajuda o Hydra a calibrar o tom e a profundidade das próximas perguntas.',
			status: 'resolvida',
			createdAt: '2026-01-02T00:00:00.000Z',
			resolvedAt: '2026-01-03T00:00:00.000Z'
		});
	});

	it('resolvedAt só aparece para pendências resolvidas, nunca para abertas', () => {
		const state = baseState({
			pendingItems: [
				{
					id: 'pend-aberta',
					projectId: 'p1',
					activityDefinitionId: 'origem',
					status: 'aberta',
					createdAt: '2026-01-02T00:00:00.000Z'
				},
				{
					id: 'pend-resolvida',
					projectId: 'p1',
					activityDefinitionId: 'publico',
					status: 'resolvida',
					createdAt: '2026-01-02T00:00:00.000Z',
					resolvedAt: '2026-01-03T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		const aberta = view.pendingItemHistory.find((item) => item.id === 'pend-aberta')!;
		const resolvida = view.pendingItemHistory.find((item) => item.id === 'pend-resolvida')!;
		expect(aberta.status).toBe('aberta');
		expect('resolvedAt' in aberta).toBe(false);
		expect(resolvida.status).toBe('resolvida');
		expect(resolvida.resolvedAt).toBe('2026-01-03T00:00:00.000Z');
	});

	it('openPendingItems (Trilha B) continua funcionando separadamente de pendingItemHistory', () => {
		const state = baseState({
			pendingItems: [
				{
					id: 'pend-aberta',
					projectId: 'p1',
					activityDefinitionId: 'origem',
					status: 'aberta',
					createdAt: '2026-01-02T00:00:00.000Z'
				},
				{
					id: 'pend-resolvida',
					projectId: 'p1',
					activityDefinitionId: 'publico',
					status: 'resolvida',
					createdAt: '2026-01-01T00:00:00.000Z',
					resolvedAt: '2026-01-02T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.openPendingItems).toHaveLength(1);
		expect(view.openPendingItems[0].activityDefinitionId).toBe('origem');
		expect(view.pendingItemHistory).toHaveLength(2);
	});

	it('label e detail vêm de ActivityDefinition.pendingItemLabel/pendingItemDetail do catálogo', () => {
		const publico = catalog.phases
			.flatMap((phase) => phase.activities)
			.find((activity) => activity.id === 'publico');
		if (!publico || publico.completionMode !== 'explicit_confirmation') {
			throw new Error('fixture inválida: atividade "publico" precisa ser explicit_confirmation');
		}

		const state = baseState({
			pendingItems: [
				{
					id: 'pend-1',
					projectId: 'p1',
					activityDefinitionId: 'publico',
					status: 'aberta',
					createdAt: '2026-01-02T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.pendingItemHistory[0].label).toBe(publico.pendingItemLabel);
		expect(view.pendingItemHistory[0].detail).toBe(publico.pendingItemDetail);
	});

	it('ProjectView nunca expõe ProjectState bruto', () => {
		const view = buildProjectView(catalog, baseState());
		expect(view).not.toHaveProperty('pendingItems');
		expect(view).not.toHaveProperty('activityProgress');
		expect(view).not.toHaveProperty('project');
		expect(Object.keys(view).sort()).toEqual(
			[
				'projectId',
				'projectName',
				'createdAt',
				'routeStartPhaseId',
				'projectStatus',
				'currentPhase',
				'phaseStatuses',
				'activityStatuses',
				'answers',
				'nextActivity',
				'openPendingItems',
				'pendingItemHistory',
				'hypotheses',
				'scopeItems',
				'scopeVersion',
				'deliverables',
				'scopeConfirmationIssues',
				'scopeProjection',
				'scopeSuggestions',
				'fieldSuggestions',
				'criteriaScopeConflict',
				'impediments',
				'workItems',
				'milestones',
				'scheduleBaseline',
				'risks',
				'decisions',
				'changes',
				'affectedGroups',
				'affectedGroupConfirmationIssues',
				'externalActions',
				'evidences',
				'currentTreatment',
				'treatmentSteps',
				'treatmentConfirmationIssues',
				'causeExploration',
				'causeHypotheses',
				'causeHypothesisConfirmationIssues',
				'desiredOutcomes',
				'desiredOutcomeConfirmationIssues',
				'closure'
			].sort()
		);
	});
});

describe('buildProjectView — impediments', () => {
	it('fica vazio quando não há impedimentos', () => {
		const view = buildProjectView(catalog, baseState());
		expect(view.impediments).toEqual([]);
	});

	it('projeta um impedimento aberto, sem projectId/updatedAt', () => {
		const state = baseState({
			impediments: [
				{
					id: 'imp-1',
					projectId: 'p1',
					text: 'Falta acesso ao ambiente',
					tipo: 'falta_de_recurso',
					nextAction: null,
					status: 'aberto',
					workItemId: null,
					decisionId: null,
					createdAt: '2026-01-02T00:00:00.000Z',
					updatedAt: '2026-01-02T00:00:00.000Z',
					resolvedAt: null
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.impediments).toEqual([
			{
				id: 'imp-1',
				text: 'Falta acesso ao ambiente',
				tipo: 'falta_de_recurso',
				nextAction: null,
				status: 'aberto',
				workItemId: null,
				decisionId: null,
				decisionSubject: null,
				createdAt: '2026-01-02T00:00:00.000Z',
				resolvedAt: null
			}
		]);
	});

	it('projeta um impedimento resolvido, com resolvedAt', () => {
		const state = baseState({
			impediments: [
				{
					id: 'imp-2',
					projectId: 'p1',
					text: 'Decisão pendente',
					tipo: 'decisao_pendente',
					nextAction: 'Aguardar reunião',
					status: 'resolvido',
					workItemId: null,
					decisionId: null,
					createdAt: '2026-01-02T00:00:00.000Z',
					updatedAt: '2026-01-03T00:00:00.000Z',
					resolvedAt: '2026-01-03T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.impediments[0]).toEqual({
			id: 'imp-2',
			text: 'Decisão pendente',
			tipo: 'decisao_pendente',
			nextAction: 'Aguardar reunião',
			status: 'resolvido',
			workItemId: null,
			decisionId: null,
			decisionSubject: null,
			createdAt: '2026-01-02T00:00:00.000Z',
			resolvedAt: '2026-01-03T00:00:00.000Z'
		});
	});

	it('projeta decisionSubject denormalizado quando decisionId aponta para uma Decision existente', () => {
		const state = baseState({
			impediments: [
				{
					id: 'imp-3',
					projectId: 'p1',
					text: 'Aguardando decisão sobre fornecedor',
					tipo: 'decisao_pendente',
					nextAction: null,
					status: 'aberto',
					workItemId: null,
					decisionId: 'dec-1',
					createdAt: '2026-01-02T00:00:00.000Z',
					updatedAt: '2026-01-02T00:00:00.000Z',
					resolvedAt: null
				}
			],
			decisions: [
				{
					id: 'dec-1',
					projectId: 'p1',
					subject: 'Qual fornecedor escolher?',
					options: null,
					dueDate: null,
					responsible: null,
					status: 'pendente',
					outcome: null,
					decidedAt: null,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z'
				}
			]
		});

		const view = buildProjectView(catalog, state);
		// toEqual com a forma exata de ImpedimentView — prova que a projeção
		// nunca vaza projectId/updatedAt nem qualquer outro campo de
		// ProjectState bruto, só o necessário (decisionId/decisionSubject
		// incluídos).
		expect(view.impediments[0]).toEqual({
			id: 'imp-3',
			text: 'Aguardando decisão sobre fornecedor',
			tipo: 'decisao_pendente',
			nextAction: null,
			status: 'aberto',
			workItemId: null,
			decisionId: 'dec-1',
			decisionSubject: 'Qual fornecedor escolher?',
			createdAt: '2026-01-02T00:00:00.000Z',
			resolvedAt: null
		});
	});
});

// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte,
// hardening pós-dogfood) — foco na PROJEÇÃO: `null` sem baseline, seleção
// determinística da baseline ATIVA pela maior `version` (nunca
// createdAt/id — não sobrevivem a empate ou a relógio não estritamente
// monotônico), `partial` sempre DERIVADO das entries (nunca persistido), e
// denormalização de título nas entradas de comparação.
describe('buildProjectView — scheduleBaseline', () => {
	it('é null quando nenhuma baseline foi capturada', () => {
		const view = buildProjectView(catalog, baseState());
		expect(view.scheduleBaseline).toBeNull();
	});

	it('projeta a baseline de maior version como ativa, com título denormalizado', () => {
		const state = baseState({
			workItems: [
				{
					id: 'wi-a',
					projectId: 'p1',
					title: 'A',
					status: 'a_fazer',
					deliverableId: null,
					plannedStart: '2026-09-12',
					durationDays: 3,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z'
				}
			],
			scheduleBaselines: [
				{ id: 'baseline-1', projectId: 'p1', createdAt: '2026-01-01T00:00:00.000Z', version: 1 },
				{ id: 'baseline-2', projectId: 'p1', createdAt: '2026-01-02T00:00:00.000Z', version: 2 }
			],
			scheduleBaselineEntries: [
				{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: '2026-09-01', durationDays: 1 },
				{ baselineId: 'baseline-2', workItemId: 'wi-a', plannedStart: '2026-09-12', durationDays: 3 }
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.scheduleBaseline).toEqual({
			createdAt: '2026-01-02T00:00:00.000Z',
			partial: false,
			entries: [
				{
					kind: 'compared',
					workItemId: 'wi-a',
					workItemTitle: 'A',
					startVarianceDays: 0,
					finishVarianceDays: 0,
					durationVarianceDays: 0,
					baselinePlannedStart: '2026-09-12',
					baselineDurationDays: 3
				}
			]
		});
	});

	// Hardening pós-dogfood: mesmo createdAt (relógio não estritamente
	// monotônico) não pode empatar a noção de "mais recente" — só `version`
	// prova a ordem real de captura.
	it('mesmo createdAt entre baselines é resolvido por version, nunca por empate de id', () => {
		const state = baseState({
			scheduleBaselines: [
				{ id: 'baseline-z', projectId: 'p1', createdAt: '2026-01-01T00:00:00.000Z', version: 1 },
				{ id: 'baseline-a', projectId: 'p1', createdAt: '2026-01-01T00:00:00.000Z', version: 2 }
			],
			scheduleBaselineEntries: []
		});

		const view = buildProjectView(catalog, state);
		// version 2 vence mesmo com id lexicograficamente menor que baseline-z
		// e mesmo createdAt — se a seleção usasse id como tie-break,
		// baseline-z (id maior) venceria erroneamente.
		expect(view.scheduleBaseline).toEqual({ createdAt: '2026-01-01T00:00:00.000Z', partial: false, entries: [] });
	});

	it('partial é derivado de qualquer entry null/null na baseline ativa, nunca de um campo persistido', () => {
		const state = baseState({
			workItems: [
				{
					id: 'wi-a',
					projectId: 'p1',
					title: 'A',
					status: 'a_fazer',
					deliverableId: null,
					plannedStart: null,
					durationDays: null,
					createdAt: '2026-01-01T00:00:00.000Z',
					updatedAt: '2026-01-01T00:00:00.000Z'
				}
			],
			scheduleBaselines: [{ id: 'baseline-1', projectId: 'p1', createdAt: '2026-01-01T00:00:00.000Z', version: 1 }],
			scheduleBaselineEntries: [
				{ baselineId: 'baseline-1', workItemId: 'wi-a', plannedStart: null, durationDays: null }
			]
		});

		const view = buildProjectView(catalog, state);
		expect(view.scheduleBaseline?.partial).toBe(true);
	});
});
