import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { encodeMultiSelectValue } from '$lib/domain';
import { buildBancadaOverviewView } from './bancada-overview-view';

describe('buildBancadaOverviewView', () => {
	it('sem nenhuma Answer: painel vazio', () => {
		const view = buildBancadaOverviewView(catalog, {});
		expect(view.blocks).toEqual([]);
	});

	it('bloco "Origem do projeto" aparece assim que origem existe (primeira atividade da jornada)', () => {
		const view = buildBancadaOverviewView(catalog, { origem: 'Um problema' });
		expect(view.blocks).toEqual([{ activityId: 'origem', heading: 'Origem do projeto', value: 'Um problema' }]);
	});

	it('bloco "Contexto inicial" usa breve_descricao, não nome_provisorio (project_property, fora de answers)', () => {
		const view = buildBancadaOverviewView(catalog, { breve_descricao: 'Portal de solicitações internas.' });
		const contexto = view.blocks.find((b) => b.activityId === 'contexto')!;
		expect(contexto.heading).toBe('Contexto inicial');
		expect(contexto.value).toBe('Portal de solicitações internas.');
	});

	it('bloco "Problema" com chips decodificados de sinais_situacao', () => {
		const view = buildBancadaOverviewView(catalog, {
			situacao: 'As solicitações chegam sem padrão.',
			sinais_situacao: encodeMultiSelectValue(['too_many_steps', 'rework'])
		});
		const problema = view.blocks.find((b) => b.activityId === 'problema')!;
		expect(problema.value).toBe('As solicitações chegam sem padrão.');
		expect(problema.chips).toEqual(['Excesso de etapas', 'Retrabalho']);
	});

	it('bloco "Problema" sem sinais_situacao respondido não tem chips', () => {
		const view = buildBancadaOverviewView(catalog, { situacao: 'Situação X' });
		const problema = view.blocks.find((b) => b.activityId === 'problema')!;
		expect(problema.chips).toBeUndefined();
	});

	it('bloco "Resultado desejado" usa mudanca, não beneficiario/percepcao', () => {
		const view = buildBancadaOverviewView(catalog, {
			mudanca: 'Solicitações centralizadas.',
			beneficiario: 'Time de suporte',
			percepcao: 'Menos retrabalho'
		});
		const resultado = view.blocks.find((b) => b.activityId === 'resultado')!;
		expect(resultado.value).toBe('Solicitações centralizadas.');
	});

	it('bloco "Usuário principal" aparece com o único campo da atividade', () => {
		const view = buildBancadaOverviewView(catalog, {
			usuario_principal: 'Analista de atendimento.'
		});
		expect(view.blocks.find((b) => b.activityId === 'usuario_principal')?.value).toBe(
			'Analista de atendimento.'
		);
	});

	it('bloco "Visão do produto" usa necessidade_central, não tipo_produto/beneficio_central/diferencial', () => {
		const view = buildBancadaOverviewView(catalog, {
			tipo_produto: 'Portal web',
			necessidade_central: 'Centralizar solicitações internas.',
			beneficio_central: 'Resposta mais rápida',
			diferencial: 'Orientação contextual'
		});
		const visao = view.blocks.find((b) => b.activityId === 'visao_produto')!;
		expect(visao.value).toBe('Centralizar solicitações internas.');
	});

	it('bloco "Critérios de sucesso do produto" usa sinais_sucesso', () => {
		const view = buildBancadaOverviewView(catalog, {
			sinais_sucesso: 'Usuários concluem a jornada sem abandonar.',
			evidencias_indicadores: 'Taxa de conclusão',
			condicao_minima_validacao: 'Um usuário real completa o fluxo.'
		});
		const criterios = view.blocks.find((b) => b.activityId === 'criterios_sucesso_produto')!;
		expect(criterios.value).toBe('Usuários concluem a jornada sem abandonar.');
	});

	it('atividades fora de Descoberta/Definição do produto nunca geram bloco', () => {
		// "montar_proxima_versao" (scope_confirmation, sem Answer) e qualquer
		// atividade de fases seguintes não têm spec — mesmo com uma chave de
		// answers coincidente por acidente, não deveriam aparecer.
		const view = buildBancadaOverviewView(catalog, { origem: 'Um problema' });
		expect(view.blocks.every((b) => ['origem', 'contexto', 'problema', 'publico', 'estado_atual', 'resultado', 'usuario_principal', 'visao_produto', 'criterios_sucesso_produto'].includes(b.activityId))).toBe(true);
	});

	it('todos os blocos juntos, na ordem do catálogo (Descoberta antes de Definição)', () => {
		const view = buildBancadaOverviewView(catalog, {
			origem: 'Um problema',
			breve_descricao: 'Portal de solicitações.',
			situacao: 'Situação',
			publico_detail: 'Público',
			estado_atual_detail: 'Estado atual',
			mudanca: 'Resultado',
			usuario_principal: 'Usuário principal',
			necessidade_central: 'Necessidade central',
			sinais_sucesso: 'Sinais de sucesso'
		});
		expect(view.blocks.map((b) => b.activityId)).toEqual([
			'origem',
			'contexto',
			'problema',
			'publico',
			'estado_atual',
			'resultado',
			'usuario_principal',
			'visao_produto',
			'criterios_sucesso_produto'
		]);
	});
});
