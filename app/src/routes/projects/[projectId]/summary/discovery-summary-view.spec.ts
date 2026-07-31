import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { encodeMultiSelectValue } from '$lib/domain';
import type { ActivityStatus } from '$lib/domain';
import type { PendingItemView } from '$lib/orientation-engine';
import { buildDiscoverySummaryView, filterDiscoveryOpenPendingItems } from './discovery-summary-view';

const ALL_NAO_INICIADA: Record<string, ActivityStatus> = {
	origem: 'não_iniciada',
	contexto: 'não_iniciada',
	problema: 'não_iniciada',
	publico: 'não_iniciada',
	estado_atual: 'não_iniciada',
	resultado: 'não_iniciada'
};

const ALL_CONCLUIDA: Record<string, ActivityStatus> = {
	origem: 'concluída',
	contexto: 'concluída',
	problema: 'concluída',
	publico: 'concluída',
	estado_atual: 'concluída',
	resultado: 'concluída'
};

describe('buildDiscoverySummaryView — visão geral (overview)', () => {
	it('sem nenhuma Answer: visão geral vazia', () => {
		const view = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA);
		expect(view.overview).toEqual([]);
	});

	it('bloco "Problema" só aparece quando situacao existe, com chips decodificados de sinais_situacao', () => {
		const view = buildDiscoverySummaryView(
			catalog,
			{
				situacao: 'As solicitações chegam sem padrão.',
				sinais_situacao: encodeMultiSelectValue(['too_many_steps', 'duplicated_information'])
			},
			ALL_NAO_INICIADA
		);

		const problema = view.overview.find((block) => block.activityId === 'problema')!;
		expect(problema).toBeDefined();
		expect(problema.heading).toBe('Problema');
		expect(problema.editLabel).toBe('Editar problema');
		expect(problema.value).toBe('As solicitações chegam sem padrão.');
		expect(problema.chips).toEqual(['Excesso de etapas', 'Informação duplicada']);
	});

	it('bloco "Problema" sem sinais_situacao respondido não tem chips', () => {
		const view = buildDiscoverySummaryView(catalog, { situacao: 'Situação X' }, ALL_NAO_INICIADA);
		const problema = view.overview.find((block) => block.activityId === 'problema')!;
		expect(problema.chips).toBeUndefined();
	});

	it('bloco "Público afetado" só aparece quando publico_detail existe', () => {
		const semResposta = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA);
		expect(semResposta.overview.find((b) => b.activityId === 'publico')).toBeUndefined();

		const comResposta = buildDiscoverySummaryView(
			catalog,
			{ publico_detail: 'Agentes de atendimento' },
			ALL_NAO_INICIADA
		);
		const publico = comResposta.overview.find((b) => b.activityId === 'publico')!;
		expect(publico.heading).toBe('Público afetado');
		expect(publico.editLabel).toBe('Editar público');
		expect(publico.value).toBe('Agentes de atendimento');
	});

	it('bloco "Estado atual" só aparece quando estado_atual_detail existe', () => {
		const view = buildDiscoverySummaryView(
			catalog,
			{ estado_atual_detail: 'Cada time usa sua planilha.' },
			ALL_NAO_INICIADA
		);
		const estadoAtual = view.overview.find((b) => b.activityId === 'estado_atual')!;
		expect(estadoAtual.heading).toBe('Estado atual');
		expect(estadoAtual.editLabel).toBe('Editar estado atual');
		expect(estadoAtual.value).toBe('Cada time usa sua planilha.');
	});

	it('bloco "Resultado desejado" só aparece quando mudanca existe (usa mudanca, não beneficiario/percepcao)', () => {
		const view = buildDiscoverySummaryView(
			catalog,
			{ mudanca: 'Solicitações centralizadas.', beneficiario: 'Time de suporte', percepcao: 'Menos retrabalho' },
			ALL_NAO_INICIADA
		);
		const resultado = view.overview.find((b) => b.activityId === 'resultado')!;
		expect(resultado.heading).toBe('Resultado desejado');
		expect(resultado.editLabel).toBe('Editar resultado');
		expect(resultado.value).toBe('Solicitações centralizadas.');
	});

	it('todos os blocos juntos, na ordem esperada', () => {
		const view = buildDiscoverySummaryView(
			catalog,
			{
				situacao: 'Situação',
				sinais_situacao: encodeMultiSelectValue(['rework']),
				publico_detail: 'Público',
				estado_atual_detail: 'Estado atual',
				mudanca: 'Resultado'
			},
			ALL_NAO_INICIADA
		);
		expect(view.overview.map((b) => b.activityId)).toEqual(['problema', 'publico', 'estado_atual', 'resultado']);
	});
});

describe('buildDiscoverySummaryView — conferência (checklist)', () => {
	it('reflete ActivityStatus de cada atividade, não a mera presença de uma Answer', () => {
		const view = buildDiscoverySummaryView(catalog, { situacao: 'Preenchido, mas sinais ainda faltam' }, {
			...ALL_NAO_INICIADA,
			problema: 'em_andamento'
		});
		const problemaItem = view.checklist.find((item) => item.label === 'Problema definido')!;
		expect(problemaItem.complete).toBe(false);
	});

	it('todos concluídos: checklist inteiro completo', () => {
		const view = buildDiscoverySummaryView(catalog, {}, ALL_CONCLUIDA);
		expect(view.checklist.every((item) => item.complete)).toBe(true);
		expect(view.checklist.map((item) => item.label)).toEqual([
			'Problema definido',
			'Público definido',
			'Estado atual definido',
			'Resultado definido'
		]);
	});
});

describe('filterDiscoveryOpenPendingItems', () => {
	const discoveryPending: PendingItemView = {
		id: 'p1',
		activityDefinitionId: 'problema',
		label: 'Problema pendente',
		detail: 'Detalhe do problema'
	};
	const otherPhasePending: PendingItemView = {
		id: 'p2',
		activityDefinitionId: 'riscos_projeto',
		label: 'Risco pendente',
		detail: 'Detalhe do risco'
	};

	it('inclui pendência aberta de atividade da fase Descoberta', () => {
		const result = filterDiscoveryOpenPendingItems(catalog, [discoveryPending]);
		expect(result).toEqual([discoveryPending]);
	});

	it('exclui pendência de atividade de outra fase', () => {
		const result = filterDiscoveryOpenPendingItems(catalog, [otherPhasePending]);
		expect(result).toEqual([]);
	});

	it('sem pendências: retorna lista vazia', () => {
		expect(filterDiscoveryOpenPendingItems(catalog, [])).toEqual([]);
	});

	it('preserva a ordem original recebida', () => {
		const second: PendingItemView = { ...discoveryPending, id: 'p3', activityDefinitionId: 'publico' };
		const result = filterDiscoveryOpenPendingItems(catalog, [second, discoveryPending, otherPhasePending]);
		expect(result.map((item) => item.id)).toEqual(['p3', 'p1']);
	});
});

describe('buildDiscoverySummaryView — detailsOpenByDefault', () => {
	it('true quando qualquer uma das seis atividades da Descoberta não está concluída', () => {
		const view = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA);
		expect(view.detailsOpenByDefault).toBe(true);
	});

	it('false quando as seis atividades da Descoberta estão concluídas', () => {
		const view = buildDiscoverySummaryView(catalog, {}, ALL_CONCLUIDA);
		expect(view.detailsOpenByDefault).toBe(false);
	});

	it('true mesmo com só uma atividade pendente (contexto em_andamento, resto concluída)', () => {
		const view = buildDiscoverySummaryView(catalog, {}, { ...ALL_CONCLUIDA, contexto: 'em_andamento' });
		expect(view.detailsOpenByDefault).toBe(true);
	});
});
