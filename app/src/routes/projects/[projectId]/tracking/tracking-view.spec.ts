import { describe, expect, it } from 'vitest';
import type { ImpedimentView, MilestoneView, WorkItemView } from '$lib/server/application/types';
import type { PendingItemView } from '$lib/orientation-engine';
import type { PhaseProgressView } from '$lib/phase-progress';
import type { JourneyContextView } from '../now/journey-context';
import { buildTrackingView, type TrackingViewInput } from './tracking-view';

function baseInput(overrides: Partial<TrackingViewInput> = {}): TrackingViewInput {
	return {
		journeyContext: { kind: 'in_progress', phaseLabel: 'Execução e acompanhamento', position: 5, total: 6 },
		phaseProgress: {
			phaseId: 'execucao',
			phaseLabel: 'Execução e acompanhamento',
			phaseOrder: 5,
			totalPhases: 6,
			totalActivities: 6,
			resolvedActivities: 2,
			groups: [
				{ key: 'concluidas', activities: [] },
				{
					key: 'atual',
					activities: [
						{ id: 'impedimentos', title: 'Identificar e tratar impedimentos', order: 3, status: 'em_andamento', isCurrent: true }
					]
				},
				{ key: 'pendentes', activities: [] },
				{ key: 'puladas', activities: [] }
			]
		},
		nextActivity: { kind: 'recommendation', activityDefinitionId: 'impedimentos' },
		workItems: [],
		milestones: [],
		impediments: [],
		risks: [],
		decisions: [],
		changes: [],
		openPendingItems: [],
		...overrides
	};
}

function makeMilestone(overrides: Partial<MilestoneView> & Pick<MilestoneView, 'id'>): MilestoneView {
	return {
		id: overrides.id,
		title: overrides.title ?? `Marco ${overrides.id}`,
		status: overrides.status ?? 'aberto',
		reachedAt: overrides.reachedAt ?? null,
		plannedDate: overrides.plannedDate ?? null,
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		relatedWorkItems: overrides.relatedWorkItems ?? [],
		relatedConcluded: overrides.relatedConcluded ?? 0
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

function blockedItem(
	overrides: { id?: string; title?: string; impedimentId?: string } = {}
): WorkItemView {
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
			dependency({
				dependencyId: `dep-${overrides.id}`,
				dependsOnWorkItemId: overrides.dependsOnId,
				title: 'predecessor'
			})
		]
	});
}

describe('buildTrackingView — situação e continuidade', () => {
	it('resume fase, atividade e progresso a partir de journeyContext/phaseProgress', () => {
		const result = buildTrackingView(baseInput());
		expect(result.situation).toEqual({
			phaseLabel: 'Execução e acompanhamento',
			positionLabel: 'Fase 5 de 6',
			activityLabel: 'Identificar e tratar impedimentos',
			progressLabel: '2 de 6 atividades concluídas',
			progressPercent: 33
		});
	});

	it('próxima atividade disponível reflete a mesma atividade da situação', () => {
		const result = buildTrackingView(baseInput());
		expect(result.continuity).toEqual({ completed: false, label: 'Próxima atividade: Identificar e tratar impedimentos' });
	});

	it('projeto concluído: journeyContext "completed" e nextActivity catalog_limit_reached', () => {
		const journeyContext: JourneyContextView = { kind: 'completed', total: 6 };
		const phaseProgress: PhaseProgressView = {
			phaseId: 'validacao',
			phaseLabel: 'Validação e encerramento',
			phaseOrder: 6,
			totalPhases: 6,
			totalActivities: 6,
			resolvedActivities: 6,
			groups: [
				{ key: 'concluidas', activities: [] },
				{ key: 'atual', activities: [] },
				{ key: 'pendentes', activities: [] },
				{ key: 'puladas', activities: [] }
			]
		};
		const result = buildTrackingView(
			baseInput({ journeyContext, phaseProgress, nextActivity: { kind: 'catalog_limit_reached' } })
		);
		expect(result.situation?.phaseLabel).toBe('Jornada concluída');
		expect(result.situation?.positionLabel).toBe('6 de 6 fases percorridas');
		expect(result.situation?.activityLabel).toBe('—');
		expect(result.continuity).toEqual({ completed: true, label: 'Não há próxima atividade — o projeto foi concluído.' });
	});
});

describe('buildTrackingView — Trabalho', () => {
	it('conta os três estados operacionais e lista os itens em andamento', () => {
		const result = buildTrackingView(
			baseInput({
				workItems: [
					makeWorkItem({ id: '1', title: 'Fluxo de aprovação', status: 'em_andamento' }),
					makeWorkItem({ id: '2', title: 'Notificação por e-mail', status: 'a_fazer' }),
					makeWorkItem({ id: '3', title: 'Item concluído', status: 'concluido' })
				]
			})
		);
		expect(result.work.counts).toEqual({ a_fazer: 1, em_andamento: 1, concluido: 1 });
		expect(result.work.inProgress.map((item) => item.id)).toEqual(['1']);
		expect(result.work.state).toBe('em_andamento');
	});

	it('estado "sem_andamento": há itens a fazer, nenhum em andamento', () => {
		const result = buildTrackingView(
			baseInput({ workItems: [makeWorkItem({ id: '1', status: 'a_fazer' })] })
		);
		expect(result.work.state).toBe('sem_andamento');
		expect(result.work.inProgress).toEqual([]);
	});

	it('estado "concluido": todos os itens foram concluídos', () => {
		const result = buildTrackingView(
			baseInput({ workItems: [makeWorkItem({ id: '1', status: 'concluido' })] })
		);
		expect(result.work.state).toBe('concluido');
	});

	it('estado "nenhuma": sem nenhum item de trabalho', () => {
		const result = buildTrackingView(baseInput({ workItems: [] }));
		expect(result.work.state).toBe('nenhuma');
	});

	it('não promove o primeiro item de "A fazer" a item em andamento', () => {
		const result = buildTrackingView(
			baseInput({
				workItems: [
					makeWorkItem({ id: '1', title: 'Primeiro da fila', status: 'a_fazer' }),
					makeWorkItem({ id: '2', title: 'Segundo da fila', status: 'a_fazer' })
				]
			})
		);
		expect(result.work.inProgress).toEqual([]);
		expect(result.work.state).toBe('sem_andamento');
	});
});

describe('buildTrackingView — Bloqueios (Precisa de você)', () => {
	it('fica vazio quando nenhum WorkItem está bloqueado', () => {
		const result = buildTrackingView(baseInput({ workItems: [makeWorkItem({ id: '1' })] }));
		expect(result.blockedWorkItems).toEqual([]);
	});

	it('expõe um card por WorkItem bloqueado, com impedimento e explicação', () => {
		const result = buildTrackingView(
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
		const result = buildTrackingView(baseInput({ workItems: [blockedItem(), makeWorkItem({ id: '2' })] }));
		expect(result.blockedWorkItems).toHaveLength(1);
		expect(result.blockedWorkItems[0].waitingWorkItems).toEqual([]);
		expect(result.blockedWorkItems[0].waitingLabel).toBeNull();
	});

	it('expõe o WorkItem aberto que depende do item bloqueado, nomeando-o quando é só um', () => {
		const result = buildTrackingView(
			baseInput({
				workItems: [blockedItem(), dependentItem({ id: '2', title: 'Integrar gateway', dependsOnId: '1' })]
			})
		);
		expect(result.blockedWorkItems).toHaveLength(1);
		expect(result.blockedWorkItems[0].waitingWorkItems).toEqual([{ workItemId: '2', title: 'Integrar gateway' }]);
		expect(result.blockedWorkItems[0].waitingLabel).toBe('Também mantém Integrar gateway aguardando.');
	});

	it('não conta como aguardando um dependente já concluído', () => {
		const result = buildTrackingView(
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
		const result = buildTrackingView(
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
		const result = buildTrackingView(
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
		const semDependencia = buildTrackingView(
			baseInput({ workItems: [blockedItem(), makeWorkItem({ id: '2', title: 'Integrar gateway' })] })
		);
		expect(semDependencia.blockedWorkItems[0].waitingLabel).toBeNull();
	});
});

describe('buildTrackingView — Atenções', () => {
	it('expõe pendências abertas com dados suficientes para a ação "Retomar atividade"', () => {
		const openPendingItems: PendingItemView[] = [
			{ id: 'p1', activityDefinitionId: 'proximo-foco', label: 'Foco não definido', detail: 'Defina o próximo foco.' }
		];
		const result = buildTrackingView(baseInput({ openPendingItems }));
		expect(result.attentionPendingItems).toEqual([
			{ id: 'p1', activityDefinitionId: 'proximo-foco', label: 'Foco não definido', detail: 'Defina o próximo foco.' }
		]);
	});
});

describe('buildTrackingView — impedimentos', () => {
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
		const result = buildTrackingView(baseInput({ impediments }));
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
		const result = buildTrackingView(baseInput({ impediments }));
		expect(result.impediments.open.map((i) => i.id)).toEqual(['i1']);
		expect(result.impediments.resolved.map((i) => i.id)).toEqual(['i3']);
	});
});


// Linha do tempo (ETAPA 8 do rework, microcorte de Timeline) — projeção
// cronológica de marcos DATADOS. Os testes abaixo são os falsificadores da
// promessa: se algum deles passar a afirmar atraso, proximidade ou progresso,
// o corte deixou de ser Timeline e virou scheduling.
describe('buildTrackingView — Linha do tempo', () => {
	it('omite marco sem data planejada', () => {
		const milestones = [
			makeMilestone({ id: 'm1', plannedDate: '2026-09-10' }),
			makeMilestone({ id: 'm2', plannedDate: null })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['m1']);
	});

	it('ordena por data civil ascendente, independente da ordem de criação', () => {
		const milestones = [
			makeMilestone({ id: 'm1', plannedDate: '2026-12-01' }),
			makeMilestone({ id: 'm2', plannedDate: '2026-02-28' }),
			makeMilestone({ id: 'm3', plannedDate: '2026-09-30' })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['m2', 'm3', 'm1']);
	});

	// Desempate por FATO, não por acaso: a ordem em que a projeção recebe os
	// marcos é deliberadamente invertida em relação à ordem de criação, para o
	// teste falhar se a ordenação voltar a depender da estabilidade do sort.
	it('desempata data igual pela ordem de criação, independente da ordem recebida', () => {
		const milestones = [
			makeMilestone({ id: 'zz', plannedDate: '2026-09-01', createdAt: '2026-03-01T00:00:00.000Z' }),
			makeMilestone({ id: 'aa', plannedDate: '2026-09-01', createdAt: '2026-01-01T00:00:00.000Z' }),
			makeMilestone({ id: 'mm', plannedDate: '2026-09-01', createdAt: '2026-02-01T00:00:00.000Z' }),
			makeMilestone({ id: 'anterior', plannedDate: '2026-08-31', createdAt: '2026-12-01T00:00:00.000Z' })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['anterior', 'aa', 'mm', 'zz']);
	});

	// Caso extremo restante: mesma data planejada E mesmo instante de criação.
	// O id resolve deterministicamente — a lista nunca fica à mercê da ordem de
	// entrada.
	it('desempata por id quando data planejada e createdAt são idênticos', () => {
		const createdAt = '2026-01-01T00:00:00.000Z';
		const milestones = [
			makeMilestone({ id: 'ms-c', plannedDate: '2026-09-01', createdAt }),
			makeMilestone({ id: 'ms-a', plannedDate: '2026-09-01', createdAt }),
			makeMilestone({ id: 'ms-b', plannedDate: '2026-09-01', createdAt })
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['ms-a', 'ms-b', 'ms-c']);
	});

	it('um único marco datado já produz Linha do tempo', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-01' })];
		expect(buildTrackingView(baseInput({ milestones })).timeline).toHaveLength(1);
	});

	it('nenhum marco datado produz Linha do tempo vazia (a seção não existe na página)', () => {
		const milestones = [makeMilestone({ id: 'm1' }), makeMilestone({ id: 'm2' })];
		expect(buildTrackingView(baseInput({ milestones })).timeline).toEqual([]);
		expect(buildTrackingView(baseInput({ milestones: [] })).timeline).toEqual([]);
	});

	it('formata a data como dia civil pt-BR, sem deslocamento de dia', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-01-01' })];
		const [entry] = buildTrackingView(baseInput({ milestones })).timeline;
		expect(entry.plannedDate).toBe('2026-01-01');
		expect(entry.plannedDateLabel).toBe('01/01/2026');
	});

	it('mostra status declarado e reachedAt como fatos, sem afirmar atraso nem adiantamento', () => {
		// Alcançado depois da data planejada e alcançado antes dela: os dois são
		// estado legítimo, exibidos igual. A entrada não carrega nenhum campo de
		// variação/atraso/proximidade — e é isso que este teste protege.
		const milestones = [
			makeMilestone({
				id: 'atrasado',
				plannedDate: '2026-01-10',
				status: 'alcancado',
				reachedAt: '2026-03-02T10:00:00.000Z'
			}),
			makeMilestone({
				id: 'adiantado',
				plannedDate: '2026-06-10',
				status: 'alcancado',
				reachedAt: '2026-02-01T10:00:00.000Z'
			})
		];
		const result = buildTrackingView(baseInput({ milestones }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['atrasado', 'adiantado']);
		for (const entry of result.timeline) {
			expect(entry.statusLabel).toBe('Alcançado');
			expect(Object.keys(entry).sort()).toEqual(
				['createdAt', 'id', 'kind', 'plannedDate', 'plannedDateLabel', 'reachedAt', 'status', 'statusLabel', 'title'].sort()
			);
		}
	});

	it('marco aberto aparece com reachedAt null e status declarado', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-01' })];
		const [entry] = buildTrackingView(baseInput({ milestones })).timeline;
		expect(entry.status).toBe('aberto');
		expect(entry.statusLabel).toBe('Em aberto');
		expect(entry.kind).toBe('milestone');
		if (entry.kind !== 'milestone') throw new Error('esperado marco');
		expect(entry.reachedAt).toBeNull();
	});

	// WorkItem com schedule (ETAPA 12 do rework, §42, primeiro microcorte
	// fundacional) — segunda variante da mesma Linha do tempo, mesmos
	// falsificadores: nenhuma barra, nenhum plannedEnd, nenhuma propagação.
	it('inclui WorkItem com schedule completo e exclui WorkItem sem schedule', () => {
		const workItems = [
			makeWorkItem({ id: 'w1', title: 'Com schedule', plannedStart: '2026-09-12', durationDays: 3 }),
			makeWorkItem({ id: 'w2', title: 'Sem schedule' })
		];
		const result = buildTrackingView(baseInput({ workItems }));
		expect(result.timeline.map((entry) => entry.id)).toEqual(['w1']);
		expect(result.timeline[0].kind).toBe('workItem');
	});

	it('WorkItem no schedule expõe exatamente os campos do contrato, sem plannedEnd', () => {
		const workItems = [makeWorkItem({ id: 'w1', title: 'Migração', plannedStart: '2026-09-12', durationDays: 3 })];
		const [entry] = buildTrackingView(baseInput({ workItems })).timeline;
		expect(entry).toMatchObject({
			kind: 'workItem',
			id: 'w1',
			title: 'Migração',
			plannedDate: '2026-09-12',
			plannedDateLabel: '12/09/2026',
			durationDays: 3,
			durationLabel: '3 dias'
		});
		expect(Object.keys(entry).sort()).toEqual(
			['createdAt', 'durationDays', 'durationLabel', 'id', 'kind', 'plannedDate', 'plannedDateLabel', 'status', 'statusLabel', 'title'].sort()
		);
		expect('plannedEnd' in entry).toBe(false);
	});

	it('duração de 1 dia usa singular no rótulo', () => {
		const workItems = [makeWorkItem({ id: 'w1', plannedStart: '2026-09-12', durationDays: 1 })];
		const [entry] = buildTrackingView(baseInput({ workItems })).timeline;
		expect(entry.kind === 'workItem' && entry.durationLabel).toBe('1 dia');
	});

	it('marcos e WorkItems com schedule aparecem juntos, ordenados por data civil', () => {
		const milestones = [makeMilestone({ id: 'm1', plannedDate: '2026-09-20' })];
		const workItems = [
			makeWorkItem({ id: 'w1', plannedStart: '2026-09-10', durationDays: 2 }),
			makeWorkItem({ id: 'w2', title: 'Sem schedule' })
		];
		const result = buildTrackingView(baseInput({ milestones, workItems }));
		expect(result.timeline.map((entry) => ({ id: entry.id, kind: entry.kind }))).toEqual([
			{ id: 'w1', kind: 'workItem' },
			{ id: 'm1', kind: 'milestone' }
		]);
	});
});

// workItemOptions (ETAPA 11 do rework, terceiro microcorte, §41) — opções
// para o seletor "Trabalhos afetados" dentro de cada Decision.
describe('workItemOptions', () => {
	it('vazio quando o projeto não tem nenhum WorkItem', () => {
		expect(buildTrackingView(baseInput({ workItems: [] })).workItemOptions).toEqual([]);
	});

	it('lista id/title de todos os WorkItems, independente de status', () => {
		const workItems = [
			makeWorkItem({ id: '1', title: 'Formulário', status: 'a_fazer' }),
			makeWorkItem({ id: '2', title: 'Listagem', status: 'concluido' })
		];
		expect(buildTrackingView(baseInput({ workItems })).workItemOptions).toEqual([
			{ id: '1', title: 'Formulário' },
			{ id: '2', title: 'Listagem' }
		]);
	});
});
