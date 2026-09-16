import { describe, expect, it } from 'vitest';
import type { ImpedimentView, WorkItemView } from '$lib/server/application/types';
import type { PendingItemView } from '$lib/orientation-engine';
import { buildAttentionsView, type AttentionsViewInput } from './attention-view';

function baseInput(overrides: Partial<AttentionsViewInput> = {}): AttentionsViewInput {
	return {
		workItems: [],
		impediments: [],
		openPendingItems: [],
		...overrides
	};
}

function makeWorkItem(overrides: Partial<WorkItemView> & Pick<WorkItemView, 'id'>): WorkItemView {
	return {
		id: overrides.id,
		title: overrides.title ?? `Item ${overrides.id}`,
		status: overrides.status ?? 'a_fazer',
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		blockedBy: overrides.blockedBy ?? null,
		dependsOn: overrides.dependsOn ?? [],
		deliverable: overrides.deliverable ?? null,
		plannedStart: overrides.plannedStart ?? null,
		durationDays: overrides.durationDays ?? null,
		precedenceConflict: overrides.precedenceConflict ?? null,
		knownFreeSlack: overrides.knownFreeSlack ?? null
	};
}

function dependency(overrides: { dependencyId: string; dependsOnWorkItemId: string; title: string }) {
	return { ...overrides, satisfied: false };
}

function blockedItem(overrides: { id?: string; title?: string; impedimentId?: string } = {}): WorkItemView {
	return makeWorkItem({
		id: overrides.id ?? '1',
		title: overrides.title ?? 'Migrar base de clientes',
		status: 'em_andamento',
		blockedBy: {
			impedimentId: overrides.impedimentId ?? 'imp-1',
			text: 'Acesso ao CRM ainda não liberado',
			tipo: 'dependencia_externa'
		}
	});
}

function dependentItem(overrides: {
	id: string;
	title: string;
	dependsOnId: string;
	status?: WorkItemView['status'];
}): WorkItemView {
	return makeWorkItem({
		id: overrides.id,
		title: overrides.title,
		status: overrides.status ?? 'a_fazer',
		dependsOn: [
			dependency({ dependencyId: `dep-${overrides.id}`, dependsOnWorkItemId: overrides.dependsOnId, title: 'predecessor' })
		]
	});
}

describe('buildAttentionsView — Bloqueios (Precisa de você)', () => {
	it('fica vazio quando nenhum WorkItem está bloqueado', () => {
		const result = buildAttentionsView(baseInput({ workItems: [makeWorkItem({ id: '1' })] }));
		expect(result.blockedWorkItems).toEqual([]);
	});

	it('expõe um card por WorkItem bloqueado, com impedimento e explicação', () => {
		const result = buildAttentionsView(
			baseInput({
				workItems: [
					makeWorkItem({
						id: '1',
						title: 'Migrar base de clientes',
						status: 'em_andamento',
						blockedBy: { impedimentId: 'imp-1', text: 'Acesso ao CRM ainda não liberado', tipo: 'dependencia_externa' }
					}),
					makeWorkItem({ id: '2', title: 'Item livre', status: 'a_fazer' })
				]
			})
		);
		expect(result.blockedWorkItems).toEqual([
			{
				workItemId: '1',
				title: 'Migrar base de clientes',
				status: 'em_andamento',
				impedimentId: 'imp-1',
				impedimentText: 'Acesso ao CRM ainda não liberado',
				impedimentTipo: 'dependencia_externa',
				why: 'Este impedimento está bloqueando trabalho atualmente em "Em andamento".',
				waitingWorkItems: [],
				waitingLabel: null
			}
		]);
	});

	it('não acrescenta impacto quando ninguém depende do item bloqueado', () => {
		const result = buildAttentionsView(baseInput({ workItems: [blockedItem(), makeWorkItem({ id: '2' })] }));
		expect(result.blockedWorkItems).toHaveLength(1);
		expect(result.blockedWorkItems[0].waitingWorkItems).toEqual([]);
		expect(result.blockedWorkItems[0].waitingLabel).toBeNull();
	});

	it('expõe o WorkItem aberto que depende do item bloqueado, nomeando-o quando é só um', () => {
		const result = buildAttentionsView(
			baseInput({
				workItems: [blockedItem(), dependentItem({ id: '2', title: 'Integrar gateway', dependsOnId: '1' })]
			})
		);
		expect(result.blockedWorkItems).toHaveLength(1);
		expect(result.blockedWorkItems[0].waitingWorkItems).toEqual([{ workItemId: '2', title: 'Integrar gateway' }]);
		expect(result.blockedWorkItems[0].waitingLabel).toBe('Também mantém Integrar gateway aguardando.');
	});

	it('não conta como aguardando um dependente já concluído', () => {
		const result = buildAttentionsView(
			baseInput({
				workItems: [
					blockedItem(),
					dependentItem({ id: '2', title: 'Já entregue', dependsOnId: '1', status: 'concluido' })
				]
			})
		);
		expect(result.blockedWorkItems[0].waitingWorkItems).toEqual([]);
		expect(result.blockedWorkItems[0].waitingLabel).toBeNull();
	});

	it('mantém um único card do item bloqueado quando vários dependentes aguardam, com contagem', () => {
		const result = buildAttentionsView(
			baseInput({
				workItems: [
					blockedItem(),
					dependentItem({ id: '2', title: 'Integrar gateway', dependsOnId: '1' }),
					dependentItem({ id: '3', title: 'Publicar cobrança', dependsOnId: '1', status: 'em_andamento' })
				]
			})
		);
		expect(result.blockedWorkItems).toHaveLength(1);
		expect(result.blockedWorkItems[0].waitingWorkItems).toEqual([
			{ workItemId: '2', title: 'Integrar gateway' },
			{ workItemId: '3', title: 'Publicar cobrança' }
		]);
		expect(result.blockedWorkItems[0].waitingLabel).toBe('Também mantém 2 trabalhos aguardando.');
	});

	it('mostra o mesmo dependente no impacto de cada predecessor bloqueado, sem duplicar a ação de um impedimento', () => {
		const result = buildAttentionsView(
			baseInput({
				workItems: [
					blockedItem({ id: '1', title: 'Definir contrato', impedimentId: 'imp-1' }),
					blockedItem({ id: '2', title: 'Aprovar orçamento', impedimentId: 'imp-2' }),
					makeWorkItem({
						id: '3',
						title: 'Integrar gateway',
						dependsOn: [
							dependency({ dependencyId: 'dep-1', dependsOnWorkItemId: '1', title: 'Definir contrato' }),
							dependency({ dependencyId: 'dep-2', dependsOnWorkItemId: '2', title: 'Aprovar orçamento' })
						]
					})
				]
			})
		);
		expect(result.blockedWorkItems.map((blocked) => blocked.impedimentId)).toEqual(['imp-1', 'imp-2']);
		expect(result.blockedWorkItems[0].waitingLabel).toBe('Também mantém Integrar gateway aguardando.');
		expect(result.blockedWorkItems[1].waitingLabel).toBe('Também mantém Integrar gateway aguardando.');
	});

	it('remove o impacto por derivação quando a Dependency deixa de existir', () => {
		const semDependencia = buildAttentionsView(
			baseInput({ workItems: [blockedItem(), makeWorkItem({ id: '2', title: 'Integrar gateway' })] })
		);
		expect(semDependencia.blockedWorkItems[0].waitingLabel).toBeNull();
	});
});

describe('buildAttentionsView — pendências', () => {
	it('expõe pendências abertas com dados suficientes para a ação "Retomar atividade"', () => {
		const openPendingItems: PendingItemView[] = [
			{ id: 'p1', activityDefinitionId: 'proximo-foco', label: 'Foco não definido', detail: 'Defina o próximo foco.' }
		];
		const result = buildAttentionsView(baseInput({ openPendingItems }));
		expect(result.pendingItems).toEqual([
			{ id: 'p1', activityDefinitionId: 'proximo-foco', label: 'Foco não definido', detail: 'Defina o próximo foco.' }
		]);
	});
});

describe('buildAttentionsView — impedimentos', () => {
	it('separa impedimentos abertos e resolvidos', () => {
		const impediments: ImpedimentView[] = [
			{
				id: 'i1',
				text: 'Falta de acesso',
				tipo: 'falta_de_recurso',
				nextAction: 'Solicitar à TI',
				status: 'aberto',
				workItemId: null,
				decisionId: null,
				decisionSubject: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			},
			{
				id: 'i2',
				text: 'Licença expirada',
				tipo: 'falta_de_recurso',
				nextAction: null,
				status: 'resolvido',
				workItemId: null,
				decisionId: null,
				decisionSubject: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: '2026-01-02T00:00:00.000Z'
			}
		];
		const result = buildAttentionsView(baseInput({ impediments }));
		expect(result.impediments.open.map((i) => i.id)).toEqual(['i1']);
		expect(result.impediments.resolved.map((i) => i.id)).toEqual(['i2']);
	});

	it('exclui impedimentos abertos vinculados a um WorkItem — já aparecem em "Precisa de você"', () => {
		const impediments: ImpedimentView[] = [
			{
				id: 'i1',
				text: 'Impedimento livre, sem WorkItem',
				tipo: 'outro',
				nextAction: null,
				status: 'aberto',
				workItemId: null,
				decisionId: null,
				decisionSubject: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			},
			{
				id: 'i2',
				text: 'Bloqueia um WorkItem',
				tipo: 'dependencia_externa',
				nextAction: null,
				status: 'aberto',
				workItemId: 'wi-1',
				decisionId: null,
				decisionSubject: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			},
			{
				id: 'i3',
				text: 'Bloqueava um WorkItem, já resolvido',
				tipo: 'dependencia_externa',
				nextAction: null,
				status: 'resolvido',
				workItemId: 'wi-1',
				decisionId: null,
				decisionSubject: null,
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: '2026-01-02T00:00:00.000Z'
			}
		];
		const result = buildAttentionsView(baseInput({ impediments }));
		expect(result.impediments.open.map((i) => i.id)).toEqual(['i1']);
		expect(result.impediments.resolved.map((i) => i.id)).toEqual(['i3']);
	});
});
