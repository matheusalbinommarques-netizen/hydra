import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { encodeMultiSelectValue } from '$lib/domain';
import type { ActivityStatus } from '$lib/domain';
import type { PendingItemView } from '$lib/orientation-engine';
import { buildDiscoverySummaryView, filterDiscoveryOpenPendingItems } from './discovery-summary-view';

const ALL_NAO_INICIADA: Record<string, ActivityStatus> = {
	origem: 'não_iniciada',
	problema: 'não_iniciada',
	publico: 'não_iniciada',
	estado_atual: 'não_iniciada',
	resultado: 'não_iniciada'
};

const ALL_CONCLUIDA: Record<string, ActivityStatus> = {
	origem: 'concluída',
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

	it('bloco "Situação" só aparece quando situacao existe, com chips decodificados de situacao_o_que', () => {
		const view = buildDiscoverySummaryView(
			catalog,
			{
				situacao: 'As solicitações chegam sem padrão.',
				situacao_o_que: encodeMultiSelectValue(['prob_manual', 'prob_visibilidade'])
			},
			ALL_NAO_INICIADA
		);

		const problema = view.overview.find((block) => block.activityId === 'problema')!;
		expect(problema).toBeDefined();
		expect(problema.heading).toBe('Situação');
		expect(problema.editLabel).toBe('Editar situação');
		expect(problema.value).toBe('As solicitações chegam sem padrão.');
		expect(problema.chips).toEqual(['O processo é manual demais', 'Falta informação ou visibilidade']);
	});

	it('bloco "Situação" sem situacao_o_que respondido não tem chips', () => {
		const view = buildDiscoverySummaryView(catalog, { situacao: 'Situação X' }, ALL_NAO_INICIADA);
		const problema = view.overview.find((block) => block.activityId === 'problema')!;
		expect(problema.chips).toBeUndefined();
	});

	it('bloco "Quem é afetado" só aparece quando há AffectedGroup, nunca a partir de publico_detail', () => {
		const semGrupos = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA, []);
		expect(semGrupos.overview.find((b) => b.activityId === 'publico')).toBeUndefined();

		const comGrupos = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA, [
			{ id: 'ag-1', label: 'Agentes de atendimento', impact: 'alto' }
		]);
		const publico = comGrupos.overview.find((b) => b.activityId === 'publico')!;
		expect(publico.heading).toBe('Quem é afetado');
		expect(publico.editLabel).toBe('Editar quem é afetado');
		expect(publico.value).toBe('Grupo afetado: Agentes de atendimento (Alto).');
		expect(publico.chips).toEqual(['Agentes de atendimento']);
	});

	it('bloco "Quem é afetado" reflete Evidence (ETAPA 3 do rework) sem redigitação, discretamente anexada ao mesmo bloco', () => {
		const semEvidencia = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA, [
			{ id: 'ag-1', label: 'Operação', impact: 'alto' }
		]);
		const publicoSemEvidencia = semEvidencia.overview.find((b) => b.activityId === 'publico')!;
		expect(publicoSemEvidencia.value).toBe('Grupo afetado: Operação (Alto).');

		const comEvidencia = buildDiscoverySummaryView(
			catalog,
			{},
			ALL_NAO_INICIADA,
			[{ id: 'ag-1', label: 'Operação', impact: 'alto' }],
			[{ affectedGroupId: 'ag-1' }]
		);
		const publicoComEvidencia = comEvidencia.overview.find((b) => b.activityId === 'publico')!;
		expect(publicoComEvidencia.value).toBe('Grupo afetado: Operação (Alto). Evidências: Operação (1 evidência).');
	});

	it('bloco "Como é tratado hoje" só aparece quando há TreatmentStep ou noTreatment, nunca a partir de estado_atual_detail', () => {
		const semNada = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA, [], [], { noTreatment: false }, []);
		expect(semNada.overview.find((b) => b.activityId === 'estado_atual')).toBeUndefined();

		const view = buildDiscoverySummaryView(
			catalog,
			{},
			ALL_NAO_INICIADA,
			[],
			[],
			{ noTreatment: false },
			[{ whatHappens: 'Cada time usa sua planilha.', actors: [], medium: null, frictions: [] }]
		);
		const estadoAtual = view.overview.find((b) => b.activityId === 'estado_atual')!;
		expect(estadoAtual.heading).toBe('Como é tratado hoje');
		expect(estadoAtual.editLabel).toBe('Editar como é tratado hoje');
		expect(estadoAtual.value).toBe('1 etapa descrita. Cada time usa sua planilha..');

		const semTratamento = buildDiscoverySummaryView(catalog, {}, ALL_NAO_INICIADA, [], [], { noTreatment: true }, []);
		const bloco = semTratamento.overview.find((b) => b.activityId === 'estado_atual')!;
		expect(bloco.value).toBe('Sem tratamento definido hoje. Hoje não existe um tratamento definido.');
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
				mudanca: 'Resultado'
			},
			ALL_NAO_INICIADA,
			[{ id: 'ag-1', label: 'Público', impact: 'alto' }],
			[],
			{ noTreatment: false },
			[{ whatHappens: 'Estado atual', actors: [], medium: null, frictions: [] }]
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
			'Como é tratado hoje definido',
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

	it('false quando as cinco atividades da Descoberta estão concluídas', () => {
		const view = buildDiscoverySummaryView(catalog, {}, ALL_CONCLUIDA);
		expect(view.detailsOpenByDefault).toBe(false);
	});

	it('true mesmo com só uma atividade pendente (problema em_andamento, resto concluída)', () => {
		const view = buildDiscoverySummaryView(catalog, {}, { ...ALL_CONCLUIDA, problema: 'em_andamento' });
		expect(view.detailsOpenByDefault).toBe(true);
	});
});
