import { describe, expect, it } from 'vitest';
import type { DecisionView } from '$lib/server/application/types';
import { buildDecisionWorkItemOptions, buildDecisions } from './decision-view';

function makeDecision(overrides: Partial<DecisionView> & Pick<DecisionView, 'id' | 'status'>): DecisionView {
	return {
		subject: 'Decisão de teste',
		options: null,
		dueDate: null,
		responsible: null,
		outcome: null,
		decidedAt: null,
		createdAt: '2026-01-01T00:00:00.000Z',
		affectedWorkItems: [],
		...overrides
	};
}

describe('buildDecisions', () => {
	it('separa pendentes e tomadas pelo status declarado', () => {
		const pending = makeDecision({ id: 'p1', status: 'pendente' });
		const decided = makeDecision({ id: 'd1', status: 'tomada' });

		expect(buildDecisions([pending, decided])).toEqual({
			pending: [pending],
			decided: [decided]
		});
	});

	it('vazio quando o projeto não tem nenhuma Decision', () => {
		expect(buildDecisions([])).toEqual({ pending: [], decided: [] });
	});
});

// workItemOptions (ETAPA 11 do rework, terceiro microcorte, §41) — opções
// para o seletor "Trabalhos afetados" dentro de cada Decision. Migrado de
// tracking-view.ts para cá na ETAPA 13 (S13, segundo microcorte), junto com
// a gestão de Decision (D065/D066).
describe('buildDecisionWorkItemOptions', () => {
	it('vazio quando o projeto não tem nenhum WorkItem', () => {
		expect(buildDecisionWorkItemOptions([])).toEqual([]);
	});

	it('lista id/title de todos os WorkItems, independente de status', () => {
		const workItems = [
			{ id: '1', title: 'Formulário', status: 'a_fazer' },
			{ id: '2', title: 'Listagem', status: 'concluido' }
		];
		expect(buildDecisionWorkItemOptions(workItems)).toEqual([
			{ id: '1', title: 'Formulário' },
			{ id: '2', title: 'Listagem' }
		]);
	});
});
