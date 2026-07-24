import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { buildRecordsView } from './records-view';

describe('buildRecordsView', () => {
	it('não lista fases quando não há respostas', () => {
		const result = buildRecordsView(catalog, { answers: {}, pendingItemHistory: [] });
		expect(result.phases).toEqual([]);
	});

	it('agrupa respostas por fase e atividade, com rótulos legíveis do catálogo', () => {
		const result = buildRecordsView(catalog, {
			answers: { origem: 'Um problema', situacao: 'Situação de teste' },
			pendingItemHistory: []
		});

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		expect(descoberta.phaseLabel).toBe('Descoberta');

		const origemActivity = descoberta.activities.find((activity) => activity.activityId === 'origem')!;
		expect(origemActivity.title).toBe('Origem do projeto');
		expect(origemActivity.fields).toEqual([
			{ id: 'origem', label: 'O que deu origem a este projeto?', value: 'Um problema' }
		]);

		const problemaActivity = descoberta.activities.find((activity) => activity.activityId === 'problema')!;
		expect(problemaActivity.fields).toEqual([
			{ id: 'situacao', label: 'Qual situação precisa mudar?', value: 'Situação de teste' }
		]);
	});

	it('não inclui atividades sem respostas nem o campo project_property (nome do projeto)', () => {
		const result = buildRecordsView(catalog, {
			answers: { origem: 'Um problema', nome_provisorio: 'Nome não deve aparecer' },
			pendingItemHistory: []
		});

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		expect(descoberta.activities.map((activity) => activity.activityId)).toEqual(['origem']);
		const allValues = descoberta.activities.flatMap((activity) => activity.fields.map((field) => field.value));
		expect(allValues).not.toContain('Nome não deve aparecer');
	});

	it('separa pendências abertas e resolvidas, com título da atividade relacionada', () => {
		const result = buildRecordsView(catalog, {
			answers: {},
			pendingItemHistory: [
				{
					id: 'pend-1',
					activityDefinitionId: 'origem',
					label: 'Origem do projeto não foi definida',
					detail: 'detalhe aberta',
					status: 'aberta',
					createdAt: '2026-01-01T00:00:00.000Z'
				},
				{
					id: 'pend-2',
					activityDefinitionId: 'publico',
					label: 'Público afetado não foi detalhado',
					detail: 'detalhe resolvida',
					status: 'resolvida',
					createdAt: '2026-01-01T00:00:00.000Z',
					resolvedAt: '2026-01-02T00:00:00.000Z'
				}
			]
		});

		expect(result.openPendingItems).toHaveLength(1);
		expect(result.openPendingItems[0]).toEqual({
			id: 'pend-1',
			activityTitle: 'Origem do projeto',
			label: 'Origem do projeto não foi definida',
			detail: 'detalhe aberta',
			status: 'aberta',
			createdAt: '2026-01-01T00:00:00.000Z',
			resolvedAt: undefined
		});

		expect(result.resolvedPendingItems).toHaveLength(1);
		expect(result.resolvedPendingItems[0]).toEqual({
			id: 'pend-2',
			activityTitle: 'Público afetado',
			label: 'Público afetado não foi detalhado',
			detail: 'detalhe resolvida',
			status: 'resolvida',
			createdAt: '2026-01-01T00:00:00.000Z',
			resolvedAt: '2026-01-02T00:00:00.000Z'
		});
	});

	it('estados vazios: sem pendências abertas nem resolvidas', () => {
		const result = buildRecordsView(catalog, { answers: {}, pendingItemHistory: [] });
		expect(result.openPendingItems).toEqual([]);
		expect(result.resolvedPendingItems).toEqual([]);
	});
});
