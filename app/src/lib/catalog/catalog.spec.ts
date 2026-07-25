import { describe, expect, it } from 'vitest';
import { catalog } from './catalog';
import { validateCatalog } from './validate';

describe('catalog', () => {
	it('respeita a checagem estrutural (nenhuma violação)', () => {
		expect(validateCatalog(catalog)).toEqual([]);
	});

	it('tem exatamente 6 fases', () => {
		expect(catalog.phases).toHaveLength(6);
	});

	it('tem exatamente 10 atividades no total', () => {
		const total = catalog.phases.reduce((sum, phase) => sum + phase.activities.length, 0);
		expect(total).toBe(10);
	});

	it('Descoberta é complete com as 7 atividades na ordem esperada', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		expect(descoberta?.catalogStatus).toBe('complete');
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

	it('Definição do produto é partial com as três atividades catalogadas, na ordem esperada', () => {
		const definicao = catalog.phases.find((phase) => phase.id === 'definicao');
		expect(definicao?.catalogStatus).toBe('partial');
		expect(definicao?.activities.map((activity) => activity.id)).toEqual([
			'usuario_principal',
			'visao_produto',
			'funcionalidades_essenciais'
		]);
	});

	it('"Definir visão do produto" tem três campos obrigatórios e um opcional', () => {
		const definicao = catalog.phases.find((phase) => phase.id === 'definicao');
		const visao = definicao?.activities.find((activity) => activity.id === 'visao_produto');
		if (!visao || visao.completionMode !== 'required_fields') {
			throw new Error('atividade "visao_produto" deveria ser required_fields');
		}
		const required = visao.fields.filter((field) => field.required).map((field) => field.id);
		expect(required).toEqual(['tipo_produto', 'necessidade_central', 'beneficio_central']);
		const optional = visao.fields.filter((field) => !field.required).map((field) => field.id);
		expect(optional).toEqual(['diferencial']);
	});

	it('"Definir funcionalidades essenciais" tem dois campos obrigatórios e um opcional', () => {
		const definicao = catalog.phases.find((phase) => phase.id === 'definicao');
		const funcionalidades = definicao?.activities.find(
			(activity) => activity.id === 'funcionalidades_essenciais'
		);
		if (!funcionalidades || funcionalidades.completionMode !== 'required_fields') {
			throw new Error('atividade "funcionalidades_essenciais" deveria ser required_fields');
		}
		const required = funcionalidades.fields.filter((field) => field.required).map((field) => field.id);
		expect(required).toEqual(['funcionalidades_essenciais', 'valor_entregue']);
		const optional = funcionalidades.fields.filter((field) => !field.required).map((field) => field.id);
		expect(optional).toEqual(['fora_escopo_inicial']);
	});

	it('fases 3 a 6 são unavailable e sem atividades catalogadas', () => {
		for (const id of ['estruturacao', 'planejamento', 'execucao', 'validacao']) {
			const phase = catalog.phases.find((p) => p.id === id);
			expect(phase?.catalogStatus).toBe('unavailable');
			expect(phase?.activities).toEqual([]);
		}
	});

	it('"Resumo da descoberta" é explicit_confirmation, não pulável e sem fields', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		const resumo = descoberta?.activities.find((activity) => activity.id === 'resumo');
		expect(resumo?.completionMode).toBe('explicit_confirmation');
		expect(resumo?.allowsSkip).toBe(false);
		expect('fields' in (resumo ?? {})).toBe(false);
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
