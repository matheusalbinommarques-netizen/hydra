import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { encodePlanningItems } from '$lib/domain';
import { buildRecordsView } from './records-view';

const PROJECT_ID = 'proj-1';

describe('buildRecordsView', () => {
	it('não lista fases quando não há respostas', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: {},
			pendingItemHistory: [],
			activityStatuses: {}
		});
		expect(result.phases).toEqual([]);
	});

	it('agrupa respostas por fase e atividade, com rótulos legíveis do catálogo, na ordem do catálogo', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { origem: 'Um problema', situacao: 'Situação de teste', usuario_principal: 'Analistas' },
			pendingItemHistory: [],
			activityStatuses: {}
		});

		expect(result.phases.map((phase) => phase.phaseId)).toEqual(['descoberta', 'definicao']);

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		expect(descoberta.phaseLabel).toBe('Descoberta');

		const origemActivity = descoberta.activities.find((activity) => activity.activityId === 'origem')!;
		expect(origemActivity.title).toBe('Origem do projeto');
		expect(origemActivity.fields).toEqual([
			{ id: 'origem', label: 'O que deu origem a este projeto?', value: 'Um problema' }
		]);

		const problemaActivity = descoberta.activities.find((activity) => activity.activityId === 'problema')!;
		expect(problemaActivity.fields).toEqual([
			{ id: 'situacao', label: 'Síntese da situação', value: 'Situação de teste' }
		]);
	});

	it('contagem de respostas por fase é determinística: soma dos campos não vazios de todas as atividades', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { origem: 'Um problema', situacao: 'Situação de teste' },
			pendingItemHistory: [],
			activityStatuses: {}
		});

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		expect(descoberta.answerCount).toBe(2);
	});

	it('não inclui fases sem nenhuma resposta no índice/lista de fases', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { origem: 'Um problema' },
			pendingItemHistory: [],
			activityStatuses: {}
		});

		expect(result.phases).toHaveLength(1);
		expect(result.phases[0].phaseId).toBe('descoberta');
	});

	it('não inclui atividades sem respostas nem o campo project_property (nome do projeto)', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { origem: 'Um problema', nome_provisorio: 'Nome não deve aparecer' },
			pendingItemHistory: [],
			activityStatuses: {}
		});

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		expect(descoberta.activities.map((activity) => activity.activityId)).toEqual(['origem']);
		const allValues = descoberta.activities.flatMap((activity) => activity.fields.map((field) => field.value));
		expect(allValues).not.toContain('Nome não deve aparecer');
	});

	it('editHref é a URL completa (com from=records) só para atividade concluída da Descoberta', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { origem: 'Um problema', usuario_principal: 'Analistas' },
			pendingItemHistory: [],
			activityStatuses: { origem: 'concluída', usuario_principal: 'concluída' }
		});

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		const origemActivity = descoberta.activities.find((activity) => activity.activityId === 'origem')!;
		expect(origemActivity.editHref).toBe(`/projects/${PROJECT_ID}/now?activity=origem&from=records`);

		// Definição do produto não é a fase editável — mesmo com a atividade
		// concluída, não há destino real.
		const definicao = result.phases.find((phase) => phase.phaseId === 'definicao')!;
		const usuarioActivity = definicao.activities.find((activity) => activity.activityId === 'usuario_principal')!;
		expect(usuarioActivity.editHref).toBeNull();
	});

	it('editHref é null quando a atividade da Descoberta ainda não está concluída', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { origem: 'Um problema' },
			pendingItemHistory: [],
			activityStatuses: { origem: 'em_andamento' }
		});

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		const origemActivity = descoberta.activities.find((activity) => activity.activityId === 'origem')!;
		expect(origemActivity.editHref).toBeNull();
	});

	it('editHref usa o projectId recebido — nenhuma montagem de rota é feita fora da projeção', () => {
		const result = buildRecordsView(catalog, {
			projectId: 'outro-projeto-xyz',
			answers: { origem: 'Um problema' },
			pendingItemHistory: [],
			activityStatuses: { origem: 'concluída' }
		});

		const descoberta = result.phases.find((phase) => phase.phaseId === 'descoberta')!;
		const origemActivity = descoberta.activities.find((activity) => activity.activityId === 'origem')!;
		expect(origemActivity.editHref).toBe('/projects/outro-projeto-xyz/now?activity=origem&from=records');
	});

	it('C5-01: lista_partes vira conteúdo humano numerado — nunca a serialização interna', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: {
				partes_trabalho: encodePlanningItems([
					{ id: 'p1', text: 'Tela de abertura' },
					{ id: 'p2', text: 'Fluxo de aprovação' }
				])
			},
			pendingItemHistory: [],
			activityStatuses: {}
		});

		const planejamento = result.phases.find((phase) => phase.phaseId === 'planejamento')!;
		const decomporActivity = planejamento.activities.find((activity) => activity.activityId === 'decompor_trabalho')!;
		expect(decomporActivity.fields).toEqual([
			{
				id: 'partes_trabalho',
				label: 'Partes do trabalho',
				value: '1. Tela de abertura; 2. Fluxo de aprovação'
			}
		]);
		expect(decomporActivity.fields[0].value).not.toContain('{');
		expect(decomporActivity.fields[0].value).not.toContain('"id"');
	});

	it('C5-01: editHref é a URL completa (com from=records) para "Decompor o trabalho" concluída, fora da Descoberta', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Parte 1' }]) },
			pendingItemHistory: [],
			activityStatuses: { decompor_trabalho: 'concluída' }
		});

		const planejamento = result.phases.find((phase) => phase.phaseId === 'planejamento')!;
		const decomporActivity = planejamento.activities.find((activity) => activity.activityId === 'decompor_trabalho')!;
		expect(decomporActivity.editHref).toBe(`/projects/${PROJECT_ID}/now?activity=decompor_trabalho&from=records`);
	});

	it('C5-01: "Priorizar entregas" (explicit_confirmation, sem fields) nunca aparece em Registros', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: { partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Parte 1' }]) },
			pendingItemHistory: [],
			activityStatuses: { decompor_trabalho: 'concluída', priorizar_entregas: 'concluída' }
		});

		const planejamento = result.phases.find((phase) => phase.phaseId === 'planejamento')!;
		const priorizarActivity = planejamento.activities.find((activity) => activity.activityId === 'priorizar_entregas');
		expect(priorizarActivity).toBeUndefined();
	});

	it('não expõe pendências abertas — só pendências resolvidas, com o título da atividade relacionada', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
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
			],
			activityStatuses: {}
		});

		expect(result).not.toHaveProperty('openPendingItems');
		expect(result.resolvedPendingItems).toEqual([
			{
				id: 'pend-2',
				activityTitle: 'Quem é afetado',
				label: 'Público afetado não foi detalhado',
				detail: 'detalhe resolvida'
			}
		]);
	});

	it('estado vazio: sem pendências resolvidas', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: {},
			pendingItemHistory: [],
			activityStatuses: {}
		});
		expect(result.resolvedPendingItems).toEqual([]);
	});

	it('quarta combinação de estados: sem respostas mas com pendência resolvida — fases vazias, pendência presente', () => {
		// Fixture controlada: no domínio real, resolver uma pendência sempre
		// implica responder a atividade (answerActivity → resolvePendingItem,
		// ver domain/transitions.ts), então essa combinação nunca ocorre via
		// jornada normal — mas o contrato da projeção precisa se comportar
		// corretamente mesmo assim (ver também records-view.journey.ts, que
		// verifica o efeito na tela a partir do mesmo tipo de fixture).
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: {},
			pendingItemHistory: [
				{
					id: 'pend-1',
					activityDefinitionId: 'publico',
					label: 'Público afetado não foi detalhado',
					detail: 'detalhe resolvida',
					status: 'resolvida',
					createdAt: '2026-01-01T00:00:00.000Z',
					resolvedAt: '2026-01-02T00:00:00.000Z'
				}
			],
			activityStatuses: {}
		});

		expect(result.phases).toEqual([]);
		expect(result.resolvedPendingItems).toEqual([
			{
				id: 'pend-1',
				activityTitle: 'Quem é afetado',
				label: 'Público afetado não foi detalhado',
				detail: 'detalhe resolvida'
			}
		]);
	});

	it('projeto sem nenhum registro: fases vazias e pendências resolvidas vazias', () => {
		const result = buildRecordsView(catalog, {
			projectId: PROJECT_ID,
			answers: {},
			pendingItemHistory: [],
			activityStatuses: {}
		});
		expect(result).toEqual({ phases: [], resolvedPendingItems: [] });
	});
});
