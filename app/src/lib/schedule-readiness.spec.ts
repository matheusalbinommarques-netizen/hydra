import { describe, expect, it } from 'vitest';
import type { WorkItemView } from '$lib/server/application/types';
import { isCronogramaReady } from './schedule-readiness';

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

describe('isCronogramaReady', () => {
	it('false sem nenhum WorkItem', () => {
		expect(isCronogramaReady([])).toBe(false);
	});

	it('false quando nenhum WorkItem tem schedule completo', () => {
		expect(isCronogramaReady([makeWorkItem({ id: 'w1' })])).toBe(false);
	});

	it('true quando ao menos um WorkItem tem schedule completo', () => {
		expect(
			isCronogramaReady([
				makeWorkItem({ id: 'w1' }),
				makeWorkItem({ id: 'w2', plannedStart: '2026-09-01', durationDays: 1 })
			])
		).toBe(true);
	});

	// Caminho inverso 1 → 0 (hardening pós-dogfood, ETAPA 12 do rework, §42):
	// limpar o único WorkItem agendado precisa reverter a prontidão — o
	// mesmo par atômico null/null que D058 já garante na escrita
	// (setWorkItemSchedule) deve ser reconhecido aqui como "sem schedule".
	it('reverte para false quando o único WorkItem agendado tem o schedule limpo', () => {
		const scheduled = [makeWorkItem({ id: 'w1', plannedStart: '2026-09-01', durationDays: 3 })];
		expect(isCronogramaReady(scheduled)).toBe(true);

		const cleared = [makeWorkItem({ id: 'w1', plannedStart: null, durationDays: null })];
		expect(isCronogramaReady(cleared)).toBe(false);
	});
});
