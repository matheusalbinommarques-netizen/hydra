import { describe, expect, it } from 'vitest';
import { catalog } from './catalog';
import { validateCatalog } from './validate';

describe('catalog', () => {
	it('respeita a checagem estrutural (nenhuma violação)', () => {
		expect(validateCatalog(catalog)).toEqual([]);
	});

	it('tem exatamente 6 fases, todas complete e com pelo menos uma atividade', () => {
		expect(catalog.phases).toHaveLength(6);
		for (const phase of catalog.phases) {
			expect(phase.catalogStatus).toBe('complete');
			expect(phase.activities.length).toBeGreaterThan(0);
		}
	});

	it('Descoberta tem as 7 atividades na ordem esperada', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		expect(descoberta?.activities.map((activity) => activity.id)).toEqual([
			'origem',
			'contexto',
			'problema',
			'publico',
			'estado_atual',
			'resultado',
			'resumo'
		]);
	});

	it('Definição do produto tem as 4 atividades na ordem esperada', () => {
		const definicao = catalog.phases.find((phase) => phase.id === 'definicao');
		expect(definicao?.activities.map((activity) => activity.id)).toEqual([
			'usuario_principal',
			'visao_produto',
			'montar_proxima_versao',
			'criterios_sucesso_produto'
		]);
	});

	it('Estruturação do projeto tem as 6 atividades na ordem esperada', () => {
		const estruturacao = catalog.phases.find((phase) => phase.id === 'estruturacao');
		expect(estruturacao?.activities.map((activity) => activity.id)).toEqual([
			'objetivo_entregaveis',
			'partes_interessadas',
			'papeis_responsabilidades',
			'restricoes_premissas',
			'riscos_projeto',
			'comunicacao_governanca'
		]);
	});

	it('Planejamento da entrega tem as 7 atividades na ordem esperada', () => {
		const planejamento = catalog.phases.find((phase) => phase.id === 'planejamento');
		expect(planejamento?.activities.map((activity) => activity.id)).toEqual([
			'decompor_trabalho',
			'priorizar_entregas',
			'mapear_dependencias',
			'estimar_esforco_capacidade',
			'definir_marcos',
			'criterios_aceitacao_entrega',
			'consolidar_plano_entrega'
		]);
	});

	it('Execução e acompanhamento tem as 6 atividades na ordem esperada', () => {
		const execucao = catalog.phases.find((phase) => phase.id === 'execucao');
		expect(execucao?.activities.map((activity) => activity.id)).toEqual([
			'foco_atual_execucao',
			'registrar_andamento',
			'impedimentos_execucao',
			'decisoes_mudancas',
			'atualizar_riscos',
			'proxima_acao_acompanhamento'
		]);
	});

	it('Validação e encerramento tem as 6 atividades na ordem esperada', () => {
		const validacao = catalog.phases.find((phase) => phase.id === 'validacao');
		expect(validacao?.activities.map((activity) => activity.id)).toEqual([
			'validar_entregas_criterios',
			'coletar_feedback',
			'resolver_pendencias_finais',
			'licoes_aprendidas',
			'transicao_proximos_passos',
			'confirmar_encerramento'
		]);
	});

	it('"Resumo da descoberta" é explicit_confirmation, não pulável e sem fields', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		const resumo = descoberta?.activities.find((activity) => activity.id === 'resumo');
		expect(resumo?.completionMode).toBe('explicit_confirmation');
		expect(resumo?.allowsSkip).toBe(false);
		expect('fields' in (resumo ?? {})).toBe(false);
	});

	it('"Confirmar encerramento do projeto" é required_fields com allowsSkip false', () => {
		const validacao = catalog.phases.find((phase) => phase.id === 'validacao');
		const confirmar = validacao?.activities.find((activity) => activity.id === 'confirmar_encerramento');
		expect(confirmar?.completionMode).toBe('required_fields');
		expect(confirmar?.allowsSkip).toBe(false);
	});

	it('só "Resumo da descoberta", "Monte a próxima versão" e "Confirmar encerramento do projeto" têm allowsSkip false', () => {
		const nonSkippable = catalog.phases
			.flatMap((phase) => phase.activities)
			.filter((activity) => activity.allowsSkip === false)
			.map((activity) => activity.id)
			.sort();
		expect(nonSkippable).toEqual(['confirmar_encerramento', 'montar_proxima_versao', 'resumo']);
	});

	it('"Monte a próxima versão" é scope_confirmation, não pulável e sem fields', () => {
		const definicao = catalog.phases.find((phase) => phase.id === 'definicao');
		const montar = definicao?.activities.find((activity) => activity.id === 'montar_proxima_versao');
		expect(montar?.completionMode).toBe('scope_confirmation');
		expect(montar?.allowsSkip).toBe(false);
		expect('fields' in (montar ?? {})).toBe(false);
	});

	it('"Problema ou oportunidade" tem só situação e dificuldade como obrigatórios', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		const problema = descoberta?.activities.find((activity) => activity.id === 'problema');
		if (!problema || problema.completionMode !== 'required_fields') {
			throw new Error('atividade "problema" deveria ser required_fields');
		}
		const required = problema.fields.filter((field) => field.required).map((field) => field.id);
		expect(required).toEqual(['situacao', 'dificuldade']);
		const optional = problema.fields.filter((field) => !field.required).map((field) => field.id);
		expect(optional).toEqual([
			'evidencias',
			'consequencias',
			'hipotese_opt',
			'solucao_imaginada',
			'observacoes'
		]);
	});

	it('"Contexto inicial" tem o campo de nome como project_property, sem gerar Answer', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		const contexto = descoberta?.activities.find((activity) => activity.id === 'contexto');
		if (!contexto || contexto.completionMode !== 'required_fields') {
			throw new Error('atividade "contexto" deveria ser required_fields');
		}
		const nome = contexto.fields.find((field) => field.id === 'nome_provisorio');
		expect(nome?.dataTarget).toBe('project_property');
		expect(nome?.projectProperty).toBe('name');
	});
});
