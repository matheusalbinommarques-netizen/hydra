import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import type { ActivityStatus } from '$lib/domain';
import type { PendingItemView } from '$lib/orientation-engine';
import { buildDiscoveryCheckpointView, filterDiscoveryOpenPendingItems } from './discovery-summary-view';

const ALL_NAO_INICIADA: Record<string, ActivityStatus> = {
	origem: 'não_iniciada',
	problema: 'não_iniciada',
	publico: 'não_iniciada',
	estado_atual: 'não_iniciada',
	entender_causas: 'não_iniciada',
	resultado: 'não_iniciada'
};

const ALL_CONCLUIDA: Record<string, ActivityStatus> = {
	origem: 'concluída',
	problema: 'concluída',
	publico: 'concluída',
	estado_atual: 'concluída',
	entender_causas: 'concluída',
	resultado: 'concluída'
};

const NO_TREATMENT = { noTreatment: false };
const NO_CAUSE_EXPLORATION = { stillUnknown: false };

function buildEmpty(activityStatuses: Record<string, ActivityStatus>) {
	return buildDiscoveryCheckpointView(activityStatuses, [], null, [], NO_TREATMENT, [], NO_CAUSE_EXPLORATION, [], []);
}

describe('buildDiscoveryCheckpointView — seções', () => {
	it('cinco seções, na ordem esperada', () => {
		const view = buildEmpty(ALL_NAO_INICIADA);
		expect(view.sections.map((section) => section.key)).toEqual([
			'situacao',
			'afetados',
			'estado',
			'causas',
			'resultado'
		]);
	});

	it('Situação: texto ausente vira seção sem situacaoText', () => {
		const view = buildEmpty(ALL_NAO_INICIADA);
		const situacao = view.sections.find((s) => s.key === 'situacao')!;
		expect(situacao.situacaoText).toBeUndefined();
	});

	it('Situação: texto presente é repassado tal como está', () => {
		const view = buildDiscoveryCheckpointView(
			ALL_NAO_INICIADA,
			[],
			'As solicitações chegam sem padrão.',
			[],
			NO_TREATMENT,
			[],
			NO_CAUSE_EXPLORATION,
			[],
			[]
		);
		const situacao = view.sections.find((s) => s.key === 'situacao')!;
		expect(situacao.situacaoText).toBe('As solicitações chegam sem padrão.');
	});

	it('Afetados: cada grupo vira um item com badge de impacto e nota de frequência', () => {
		const view = buildDiscoveryCheckpointView(
			ALL_NAO_INICIADA,
			[],
			null,
			[
				{ label: 'Agentes de atendimento', impact: 'alto', frequency: 'frequente' },
				{ label: 'Clientes', impact: null, frequency: null }
			],
			NO_TREATMENT,
			[],
			NO_CAUSE_EXPLORATION,
			[],
			[]
		);
		const afetados = view.sections.find((s) => s.key === 'afetados')!;
		expect(afetados.afetadosSummary).toBe('2 grupos mapeados');
		expect(afetados.afetadosGroups).toEqual([
			{ label: 'Agentes de atendimento', badge: 'Alto', note: 'Frequência: Frequentemente' },
			{ label: 'Clientes', badge: 'Por classificar', note: undefined }
		]);
	});

	it('Estado: noTreatment true não lista passos', () => {
		const view = buildDiscoveryCheckpointView(
			ALL_NAO_INICIADA,
			[],
			null,
			[],
			{ noTreatment: true },
			[],
			NO_CAUSE_EXPLORATION,
			[],
			[]
		);
		const estado = view.sections.find((s) => s.key === 'estado')!;
		expect(estado.estadoNoTreatment).toBe(true);
	});

	it('Estado: cada TreatmentStep vira um item com nota de atores/meio/fricção', () => {
		const view = buildDiscoveryCheckpointView(
			ALL_NAO_INICIADA,
			[],
			null,
			[],
			NO_TREATMENT,
			[
				{
					whatHappens: 'Financeiro reenvia a planilha por e-mail.',
					actors: ['Financeiro', 'Gestor'],
					medium: 'E-mail',
					frictions: ['espera', 'retrabalho']
				}
			],
			NO_CAUSE_EXPLORATION,
			[],
			[]
		);
		const estado = view.sections.find((s) => s.key === 'estado')!;
		expect(estado.estadoSteps).toEqual([
			{
				label: 'Financeiro reenvia a planilha por e-mail.',
				note: 'Financeiro e Gestor · E-mail · Fricção: espera e retrabalho'
			}
		]);
	});

	it('Causas: stillUnknown true não lista hipóteses', () => {
		const view = buildDiscoveryCheckpointView(
			ALL_NAO_INICIADA,
			[],
			null,
			[],
			NO_TREATMENT,
			[],
			{ stillUnknown: true },
			[],
			[]
		);
		const causas = view.sections.find((s) => s.key === 'causas')!;
		expect(causas.causasStillUnknown).toBe(true);
	});

	it('Causas: cada hipótese vira um item com contagem de evidências relacionadas', () => {
		const view = buildDiscoveryCheckpointView(
			ALL_NAO_INICIADA,
			[],
			null,
			[],
			NO_TREATMENT,
			[],
			NO_CAUSE_EXPLORATION,
			[
				{ title: 'O aprovador só revisa uma vez por semana', evidenceCount: 0 },
				{ title: 'Falta de padrão no processo', evidenceCount: 2 }
			],
			[]
		);
		const causas = view.sections.find((s) => s.key === 'causas')!;
		expect(causas.causasHypotheses).toEqual([
			{ label: 'O aprovador só revisa uma vez por semana', note: 'Nenhuma evidência relacionada' },
			{ label: 'Falta de padrão no processo', note: '2 evidências relacionadas' }
		]);
	});

	it('Resultado: cada DesiredOutcome vira um item, com meta opcional', () => {
		const view = buildDiscoveryCheckpointView(
			ALL_NAO_INICIADA,
			[],
			null,
			[],
			NO_TREATMENT,
			[],
			NO_CAUSE_EXPLORATION,
			[],
			[
				{ change: 'Reduzir o tempo médio de resposta', target: '30%' },
				{ change: 'Eliminar repetição de explicação', target: null }
			]
		);
		const resultado = view.sections.find((s) => s.key === 'resultado')!;
		expect(resultado.resultadoOutcomes).toEqual([
			{ label: 'Reduzir o tempo médio de resposta', note: 'Meta: 30%' },
			{ label: 'Eliminar repetição de explicação', note: undefined }
		]);
	});
});

describe('buildDiscoveryCheckpointView — status por seção', () => {
	it('seção obrigatória concluída vira "completa"', () => {
		const view = buildEmpty(ALL_CONCLUIDA);
		const situacao = view.sections.find((s) => s.key === 'situacao')!;
		expect(situacao.status).toBe('completa');
		expect(situacao.required).toBe(true);
	});

	it('seção obrigatória não concluída vira "pendente"', () => {
		const view = buildEmpty(ALL_NAO_INICIADA);
		const situacao = view.sections.find((s) => s.key === 'situacao')!;
		expect(situacao.status).toBe('pendente');
	});

	it('causas (não obrigatória) não concluída vira "opcional", nunca "pendente"', () => {
		const view = buildEmpty(ALL_NAO_INICIADA);
		const causas = view.sections.find((s) => s.key === 'causas')!;
		expect(causas.status).toBe('opcional');
		expect(causas.required).toBe(false);
	});

	it('causas concluída (mesmo com stillUnknown) vira "completa"', () => {
		const view = buildEmpty({ ...ALL_NAO_INICIADA, entender_causas: 'concluída' });
		const causas = view.sections.find((s) => s.key === 'causas')!;
		expect(causas.status).toBe('completa');
	});
});

describe('buildDiscoveryCheckpointView — ponto de atenção por seção', () => {
	it('sem PendingItem correspondente: flagText null', () => {
		const view = buildEmpty(ALL_NAO_INICIADA);
		expect(view.sections.every((section) => section.flagText === null)).toBe(true);
	});

	it('PendingItem aberto da atividade correspondente vira flagText da seção', () => {
		const pending: PendingItemView = {
			id: 'p1',
			activityDefinitionId: 'estado_atual',
			label: 'Como é tratado hoje não foi mapeado',
			detail: 'Impacta o quão precisas serão as recomendações sobre a solução.'
		};
		const view = buildDiscoveryCheckpointView(
			ALL_CONCLUIDA,
			[pending],
			null,
			[],
			NO_TREATMENT,
			[],
			NO_CAUSE_EXPLORATION,
			[],
			[]
		);
		const estado = view.sections.find((s) => s.key === 'estado')!;
		expect(estado.flagText).toBe('Impacta o quão precisas serão as recomendações sobre a solução.');
		// hasFlag é independente do status — uma seção completa ainda pode ter um ponto de atenção.
		expect(estado.status).toBe('completa');
	});
});

describe('buildDiscoveryCheckpointView — conclusão (CTA)', () => {
	it('todas as quatro seções obrigatórias concluídas: ctaDisabled false', () => {
		const view = buildEmpty(ALL_CONCLUIDA);
		expect(view.requiredDoneCount).toBe(4);
		expect(view.requiredTotal).toBe(4);
		expect(view.ctaDisabled).toBe(false);
		expect(view.missingRequiredTitles).toEqual([]);
	});

	it('causas nunca conta para requiredTotal', () => {
		const view = buildEmpty({ ...ALL_CONCLUIDA, entender_causas: 'não_iniciada' });
		expect(view.requiredTotal).toBe(4);
		expect(view.ctaDisabled).toBe(false);
	});

	it('uma seção obrigatória pendente: ctaDisabled true, listada em missingRequiredTitles', () => {
		const view = buildEmpty({ ...ALL_CONCLUIDA, resultado: 'não_iniciada' });
		expect(view.ctaDisabled).toBe(true);
		expect(view.missingRequiredTitles).toEqual(['O que o projeto deve produzir']);
	});

	it('nenhuma seção concluída: todas as quatro obrigatórias pendentes', () => {
		const view = buildEmpty(ALL_NAO_INICIADA);
		expect(view.requiredDoneCount).toBe(0);
		expect(view.ctaDisabled).toBe(true);
		expect(view.missingRequiredTitles).toHaveLength(4);
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
