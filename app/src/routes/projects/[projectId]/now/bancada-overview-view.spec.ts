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

	it('bloco "Objetivo do projeto" usa objetivo_projeto, não entregaveis_principais', () => {
		const view = buildBancadaOverviewView(catalog, {
			objetivo_projeto: 'Lançar o Portal de Solicitações.',
			entregaveis_principais: 'Aplicação funcional, documentação, treinamento.'
		});
		const objetivo = view.blocks.find((b) => b.activityId === 'objetivo_entregaveis')!;
		expect(objetivo.heading).toBe('Objetivo do projeto');
		expect(objetivo.value).toBe('Lançar o Portal de Solicitações.');
	});

	it('bloco "Objetivo do projeto" não aparece só com entregaveis_principais respondido (campo canônico ausente)', () => {
		const view = buildBancadaOverviewView(catalog, {
			entregaveis_principais: 'Aplicação funcional, documentação, treinamento.'
		});
		expect(view.blocks.find((b) => b.activityId === 'objetivo_entregaveis')).toBeUndefined();
	});

	it('bloco "Partes interessadas" aparece com o campo canônico da atividade', () => {
		const view = buildBancadaOverviewView(catalog, {
			partes_interessadas: 'Equipe de atendimento, gestor da área, TI.',
			interesse_influencia: 'O gestor decide prioridades.'
		});
		const partes = view.blocks.find((b) => b.activityId === 'partes_interessadas')!;
		expect(partes.heading).toBe('Partes interessadas');
		expect(partes.value).toBe('Equipe de atendimento, gestor da área, TI.');
	});

	it('bloco "Papéis e responsabilidades" usa papeis_responsaveis, não decisor_principal', () => {
		const view = buildBancadaOverviewView(catalog, {
			papeis_responsaveis: 'Matheus — decisão e implementação.',
			decisor_principal: 'Matheus'
		});
		const papeis = view.blocks.find((b) => b.activityId === 'papeis_responsabilidades')!;
		expect(papeis.heading).toBe('Papéis e responsabilidades');
		expect(papeis.value).toBe('Matheus — decisão e implementação.');
	});

	it('bloco "Restrições do projeto" usa restricoes_projeto, não premissas_projeto', () => {
		const view = buildBancadaOverviewView(catalog, {
			restricoes_projeto: 'Sem orçamento para ferramentas pagas.',
			premissas_projeto: 'A equipe terá tempo disponível para testar.'
		});
		const restricoes = view.blocks.find((b) => b.activityId === 'restricoes_premissas')!;
		expect(restricoes.heading).toBe('Restrições do projeto');
		expect(restricoes.value).toBe('Sem orçamento para ferramentas pagas.');
	});

	it('bloco "Riscos identificados" usa riscos_identificados, não resposta_inicial_riscos', () => {
		const view = buildBancadaOverviewView(catalog, {
			riscos_identificados: 'Baixa adesão da equipe ao novo sistema.',
			resposta_inicial_riscos: 'Envolver a equipe desde os primeiros testes.'
		});
		const riscos = view.blocks.find((b) => b.activityId === 'riscos_projeto')!;
		expect(riscos.heading).toBe('Riscos identificados');
		expect(riscos.value).toBe('Baixa adesão da equipe ao novo sistema.');
	});

	it('bloco "Comunicação do projeto" usa forma_comunicacao, não forma_decisao', () => {
		const view = buildBancadaOverviewView(catalog, {
			forma_comunicacao: 'Atualização semanal para o gestor da área.',
			forma_decisao: 'Mudanças de escopo passam pelo gestor antes de valer.'
		});
		const comunicacao = view.blocks.find((b) => b.activityId === 'comunicacao_governanca')!;
		expect(comunicacao.heading).toBe('Comunicação do projeto');
		expect(comunicacao.value).toBe('Atualização semanal para o gestor da área.');
	});

	it('editar a resposta de uma atividade de Estruturação substitui o valor do bloco, sem manter o texto antigo nem afetar outros blocos', () => {
		const before = buildBancadaOverviewView(catalog, {
			papeis_responsaveis: 'Matheus — decisão e implementação.',
			restricoes_projeto: 'Sem orçamento para ferramentas pagas.'
		});
		const papeisBefore = before.blocks.find((b) => b.activityId === 'papeis_responsabilidades')!;
		expect(papeisBefore.value).toBe('Matheus — decisão e implementação.');

		// Mesma projeção pura, recalculada com a Answer já editada — é assim que
		// qualquer edição se reflete no painel, já que buildBancadaOverviewView
		// nunca guarda estado entre chamadas.
		const after = buildBancadaOverviewView(catalog, {
			papeis_responsaveis: 'Matheus e o gestor da área — decisão compartilhada.',
			restricoes_projeto: 'Sem orçamento para ferramentas pagas.'
		});
		const papeisAfter = after.blocks.find((b) => b.activityId === 'papeis_responsabilidades')!;
		expect(papeisAfter.value).toBe('Matheus e o gestor da área — decisão compartilhada.');
		expect(papeisAfter.value).not.toContain('Matheus — decisão e implementação.');
		expect(after.blocks.filter((b) => b.activityId === 'papeis_responsabilidades')).toHaveLength(1);

		// Bloco de outra atividade permanece intacto, sem qualquer influência da
		// edição acima.
		const restricoesAfter = after.blocks.find((b) => b.activityId === 'restricoes_premissas')!;
		expect(restricoesAfter.value).toBe('Sem orçamento para ferramentas pagas.');
	});

	it('resposta em branco ("") de uma atividade de Estruturação omite o bloco, nunca mostra string vazia', () => {
		const view = buildBancadaOverviewView(catalog, {
			riscos_identificados: '',
			forma_comunicacao: 'Atualização semanal para o gestor da área.'
		});
		expect(view.blocks.find((b) => b.activityId === 'riscos_projeto')).toBeUndefined();
		const comunicacao = view.blocks.find((b) => b.activityId === 'comunicacao_governanca')!;
		expect(comunicacao.value).toBe('Atualização semanal para o gestor da área.');
	});

	it('atividades fora de Descoberta/Definição/Estruturação nunca geram bloco', () => {
		// "montar_proxima_versao" (scope_confirmation, sem Answer) e qualquer
		// atividade de fases seguintes (Planejamento em diante) não têm spec —
		// mesmo com uma chave de answers coincidente por acidente, não deveriam
		// aparecer.
		const view = buildBancadaOverviewView(catalog, {
			origem: 'Um problema',
			partes_trabalho: 'Uma resposta de Planejamento, fora de escopo.'
		});
		expect(
			view.blocks.every((b) =>
				[
					'origem',
					'contexto',
					'problema',
					'publico',
					'estado_atual',
					'resultado',
					'usuario_principal',
					'visao_produto',
					'criterios_sucesso_produto',
					'objetivo_entregaveis',
					'partes_interessadas',
					'papeis_responsabilidades',
					'restricoes_premissas',
					'riscos_projeto',
					'comunicacao_governanca'
				].includes(b.activityId)
			)
		).toBe(true);
	});

	it('todos os blocos juntos, na ordem do catálogo (Descoberta, Definição, depois Estruturação)', () => {
		const view = buildBancadaOverviewView(catalog, {
			origem: 'Um problema',
			breve_descricao: 'Portal de solicitações.',
			situacao: 'Situação',
			publico_detail: 'Público',
			estado_atual_detail: 'Estado atual',
			mudanca: 'Resultado',
			usuario_principal: 'Usuário principal',
			necessidade_central: 'Necessidade central',
			sinais_sucesso: 'Sinais de sucesso',
			objetivo_projeto: 'Objetivo',
			partes_interessadas: 'Partes interessadas',
			papeis_responsaveis: 'Papéis',
			restricoes_projeto: 'Restrições',
			riscos_identificados: 'Riscos',
			forma_comunicacao: 'Comunicação'
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
			'criterios_sucesso_produto',
			'objetivo_entregaveis',
			'partes_interessadas',
			'papeis_responsabilidades',
			'restricoes_premissas',
			'riscos_projeto',
			'comunicacao_governanca'
		]);
	});
});
