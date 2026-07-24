import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState } from './factory';

describe('createInitialProjectState', () => {
	it('cria um Project em rascunho (name = null) com o id e createdAt fornecidos', () => {
		const state = createInitialProjectState(catalog, 'proj-1', '2026-01-01T00:00:00.000Z');
		expect(state.project).toEqual({
			id: 'proj-1',
			name: null,
			createdAt: '2026-01-01T00:00:00.000Z'
		});
	});

	it('cria exatamente uma ActivityProgress por ActivityDefinition do catálogo, todas não_iniciada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', '2026-01-01T00:00:00.000Z');
		const activityIds = catalog.phases.flatMap((phase) => phase.activities.map((a) => a.id));

		expect(state.activityProgress).toHaveLength(activityIds.length);
		expect(state.activityProgress.map((p) => p.activityDefinitionId).sort()).toEqual(
			[...activityIds].sort()
		);
		for (const progress of state.activityProgress) {
			expect(progress.status).toBe('não_iniciada');
			expect(progress.projectId).toBe('proj-1');
		}
	});

	it('não cria Answer nem PendingItem', () => {
		const state = createInitialProjectState(catalog, 'proj-1', '2026-01-01T00:00:00.000Z');
		expect(state.answers).toEqual([]);
		expect(state.pendingItems).toEqual([]);
	});

	it('é pura: não gera efeitos colaterais nem depende de nada além dos argumentos', () => {
		const a = createInitialProjectState(catalog, 'proj-x', '2026-02-02T00:00:00.000Z');
		const b = createInitialProjectState(catalog, 'proj-x', '2026-02-02T00:00:00.000Z');
		expect(a).toEqual(b);
	});
});
