import { describe, expect, it } from 'vitest';
import { withEditAffordance } from './document-live-view';

describe('withEditAffordance', () => {
	it('só a Descoberta ganha edição; Definição e Estruturação nunca', () => {
		const view = withEditAffordance({
			sections: [
				{ phaseId: 'descoberta', phaseLabel: 'D', blocks: [{ activityId: 'origem', heading: 'h', value: 'v' }] },
				{ phaseId: 'definicao', phaseLabel: 'F', blocks: [{ activityId: 'x', heading: 'h', value: 'v' }] },
				{ phaseId: 'estruturacao', phaseLabel: 'E', blocks: [{ activityId: 'y', heading: 'h', value: 'v' }] }
			]
		});
		expect(view.sections.map((s) => s.blocks[0].editable)).toEqual([true, false, false]);
	});
});
