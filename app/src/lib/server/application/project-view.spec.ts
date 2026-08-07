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
		scopeVersion: { projectId: 'p1', hypothesis: '', confirmedAt: null },
		impediments: [],
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
			label: 'As entregas não foram priorizadas',
			detail: 'Sem prioridade clara, o trabalho pode avançar em várias frentes sem nenhuma pronta.',
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
		if (!publico || publico.completionMode !== 'required_fields') {
			throw new Error('fixture inválida: atividade "publico" precisa ser required_fields');
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
				'phaseStatuses',
				'activityStatuses',
				'answers',
				'nextActivity',
				'openPendingItems',
				'pendingItemHistory',
				'hypotheses',
				'scopeItems',
				'scopeVersion',
				'scopeConfirmationIssues',
				'scopeProjection',
				'scopeSuggestions',
				'fieldSuggestions',
				'criteriaScopeConflict',
				'impediments'
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
			createdAt: '2026-01-02T00:00:00.000Z',
			resolvedAt: '2026-01-03T00:00:00.000Z'
		});
	});
});
