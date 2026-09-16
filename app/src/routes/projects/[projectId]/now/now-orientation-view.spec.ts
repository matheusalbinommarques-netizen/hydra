import { describe, expect, it } from 'vitest';
import type { DecisionView, ImpedimentView, MilestoneView, WorkItemView } from '$lib/server/application/types';
import { buildNowOrientationView, type NowOrientationViewInput } from './now-orientation-view';

function baseInput(overrides: Partial<NowOrientationViewInput> = {}): NowOrientationViewInput {
	return {
		workItems: [],
		impediments: [],
		openPendingItems: [],
		decisions: [],
		milestones: [],
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

function makeImpediment(overrides: Partial<ImpedimentView> & Pick<ImpedimentView, 'id'>): ImpedimentView {
	return {
		id: overrides.id,
		text: overrides.text ?? `Impedimento ${overrides.id}`,
		tipo: overrides.tipo ?? 'outro',
		nextAction: overrides.nextAction ?? null,
		status: overrides.status ?? 'aberto',
		workItemId: overrides.workItemId ?? null,
		decisionId: overrides.decisionId ?? null,
		decisionSubject: overrides.decisionSubject ?? null,
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		resolvedAt: overrides.resolvedAt ?? null
	};
}

function makeDecision(overrides: Partial<DecisionView> & Pick<DecisionView, 'id'>): DecisionView {
	return {
		id: overrides.id,
		subject: overrides.subject ?? `Decisão ${overrides.id}`,
		options: overrides.options ?? null,
		dueDate: overrides.dueDate ?? null,
		responsible: overrides.responsible ?? null,
		status: overrides.status ?? 'pendente',
		outcome: overrides.outcome ?? null,
		decidedAt: overrides.decidedAt ?? null,
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		affectedWorkItems: overrides.affectedWorkItems ?? []
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

describe('buildNowOrientationView', () => {
	it('estado vazio não inventa nenhuma orientação', () => {
		const view = buildNowOrientationView(baseInput());

		expect(view).toEqual({ blocking: null, decision: null, work: null, milestone: null, isEmpty: true });
	});

	it('bloqueio aparece apenas quando existe um WorkItem realmente bloqueado', () => {
		const blocked = makeWorkItem({
			id: '1',
			status: 'em_andamento',
			blockedBy: { impedimentId: 'imp-1', text: 'Aguardando aprovação', tipo: 'outro' }
		});
		const view = buildNowOrientationView(baseInput({ workItems: [blocked] }));

		expect(view.blocking).toEqual({ count: 1, label: '1 bloqueio operacional aberto' });
	});

	it('bloqueio aparece apenas quando existe um Impediment de projeto aberto', () => {
		const impediment = makeImpediment({ id: 'imp-1', status: 'aberto', workItemId: null });
		const view = buildNowOrientationView(baseInput({ impediments: [impediment] }));

		expect(view.blocking?.count).toBe(1);
	});

	it('Impediment resolvido não conta como bloqueio', () => {
		const impediment = makeImpediment({ id: 'imp-1', status: 'resolvido', workItemId: null });
		const view = buildNowOrientationView(baseInput({ impediments: [impediment] }));

		expect(view.blocking).toBeNull();
	});

	it('PendingItem aberto nunca é promovido a bloqueio', () => {
		const view = buildNowOrientationView(
			baseInput({
				openPendingItems: [{ id: 'p1', label: 'Pendência', detail: 'Detalhe', activityDefinitionId: 'x' }]
			})
		);

		expect(view.blocking).toBeNull();
		expect(view.isEmpty).toBe(true);
	});

	it('Decision pendente aparece corretamente, e Decision tomada não conta', () => {
		const pending = makeDecision({ id: 'd1', subject: 'Escolher fornecedor', status: 'pendente' });
		const decided = makeDecision({ id: 'd2', subject: 'Já decidida', status: 'tomada' });
		const view = buildNowOrientationView(baseInput({ decisions: [pending, decided] }));

		expect(view.decision).toEqual({ id: 'd1', subject: 'Escolher fornecedor', otherCount: 0 });
	});

	it('conta as demais Decisions pendentes sem listar todas', () => {
		const decisions = [
			makeDecision({ id: 'd1', subject: 'Primeira', status: 'pendente' }),
			makeDecision({ id: 'd2', subject: 'Segunda', status: 'pendente' })
		];
		const view = buildNowOrientationView(baseInput({ decisions }));

		expect(view.decision).toEqual({ id: 'd1', subject: 'Primeira', otherCount: 1 });
	});

	it('WorkItem em andamento aparece corretamente, e os demais status não contam', () => {
		const workItems = [
			makeWorkItem({ id: '1', title: 'A fazer', status: 'a_fazer' }),
			makeWorkItem({ id: '2', title: 'Em execução', status: 'em_andamento' }),
			makeWorkItem({ id: '3', title: 'Feito', status: 'concluido' })
		];
		const view = buildNowOrientationView(baseInput({ workItems }));

		expect(view.work).toEqual({ id: '2', title: 'Em execução', otherCount: 0 });
	});

	it('marco planejado aparece somente a partir de um marco aberto com data', () => {
		const milestones = [
			makeMilestone({ id: 'm1', title: 'Sem data', plannedDate: null }),
			makeMilestone({ id: 'm2', title: 'Já alcançado', status: 'alcancado', plannedDate: '2026-01-01' })
		];
		const view = buildNowOrientationView(baseInput({ milestones }));

		expect(view.milestone).toBeNull();
	});

	it('marco planejado escolhe a data planejada mais próxima entre os abertos', () => {
		const milestones = [
			makeMilestone({ id: 'm1', title: 'Mais distante', plannedDate: '2026-12-01' }),
			makeMilestone({ id: 'm2', title: 'Mais próximo', plannedDate: '2026-10-01' })
		];
		const view = buildNowOrientationView(baseInput({ milestones }));

		expect(view.milestone).toEqual({ id: 'm2', title: 'Mais próximo', plannedDateLabel: '01/10/2026' });
	});

	it('composição não inclui nenhum campo de prioridade/score/ranking', () => {
		const view = buildNowOrientationView(
			baseInput({
				workItems: [makeWorkItem({ id: '1', status: 'em_andamento' })],
				decisions: [makeDecision({ id: 'd1', status: 'pendente' })],
				milestones: [makeMilestone({ id: 'm1', plannedDate: '2026-10-01' })]
			})
		);

		expect(Object.keys(view)).toEqual(['blocking', 'decision', 'work', 'milestone', 'isEmpty']);
	});
});
