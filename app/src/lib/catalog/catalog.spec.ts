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

	it('Descoberta tem as 6 atividades na ordem esperada', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		expect(descoberta?.activities.map((activity) => activity.id)).toEqual([
			'origem',
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

	it('só "Resumo da descoberta", "Escolha o próximo foco" e "Confirmar encerramento do projeto" têm allowsSkip false', () => {
		const nonSkippable = catalog.phases
			.flatMap((phase) => phase.activities)
			.filter((activity) => activity.allowsSkip === false)
			.map((activity) => activity.id)
			.sort();
		expect(nonSkippable).toEqual(['confirmar_encerramento', 'montar_proxima_versao', 'resumo']);
	});

	it('"Escolha o próximo foco" é scope_confirmation, não pulável e sem fields', () => {
		const definicao = catalog.phases.find((phase) => phase.id === 'definicao');
		const montar = definicao?.activities.find((activity) => activity.id === 'montar_proxima_versao');
		expect(montar?.title).toBe('Escolha o próximo foco');
		expect(montar?.completionMode).toBe('scope_confirmation');
		expect(montar?.allowsSkip).toBe(false);
		expect('fields' in (montar ?? {})).toBe(false);
	});

	it('C5-01: "Decompor o trabalho" tem um único campo lista_partes, required_fields, allowsSkip true', () => {
		const planejamento = catalog.phases.find((phase) => phase.id === 'planejamento');
		const decompor = planejamento?.activities.find((activity) => activity.id === 'decompor_trabalho');
		if (!decompor || decompor.completionMode !== 'required_fields') {
			throw new Error('atividade "decompor_trabalho" deveria ser required_fields');
		}
		expect(decompor.allowsSkip).toBe(true);
		expect(decompor.fields.map((field) => field.id)).toEqual(['partes_trabalho']);
		expect(decompor.fields[0].type).toBe('lista_partes');
	});

	it('C5-01: "Priorizar entregas" é explicit_confirmation, allowsSkip true, sem fields, com pendingItemLabel/Detail', () => {
		const planejamento = catalog.phases.find((phase) => phase.id === 'planejamento');
		const priorizar = planejamento?.activities.find((activity) => activity.id === 'priorizar_entregas');
		expect(priorizar?.completionMode).toBe('explicit_confirmation');
		expect(priorizar?.allowsSkip).toBe(true);
		expect('fields' in (priorizar ?? {})).toBe(false);
		expect(priorizar?.pendingItemLabel).toBeTruthy();
		expect(priorizar?.pendingItemDetail).toBeTruthy();
	});

	it('há exatamente quatro atividades explicit_confirmation, com allowsSkip diferentes', () => {
		const explicitConfirmationActivities = catalog.phases
			.flatMap((phase) => phase.activities)
			.filter((activity) => activity.completionMode === 'explicit_confirmation');
		expect(explicitConfirmationActivities.map((activity) => activity.id).sort()).toEqual([
			'estado_atual',
			'priorizar_entregas',
			'publico',
			'resumo'
		]);
		const byId = Object.fromEntries(explicitConfirmationActivities.map((activity) => [activity.id, activity]));
		expect(byId.resumo.allowsSkip).toBe(false);
		expect(byId.priorizar_entregas.allowsSkip).toBe(true);
		expect(byId.publico.allowsSkip).toBe(true);
		expect(byId.estado_atual.allowsSkip).toBe(true);
	});

	it('ETAPA 2: "Quem é afetado" (publico) é explicit_confirmation, allowsSkip true, sem fields, com pendingItemLabel/Detail', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		const publico = descoberta?.activities.find((activity) => activity.id === 'publico');
		expect(publico?.title).toBe('Quem é afetado');
		expect(publico?.completionMode).toBe('explicit_confirmation');
		expect(publico?.allowsSkip).toBe(true);
		expect('fields' in (publico ?? {})).toBe(false);
		expect(publico?.pendingItemLabel).toBeTruthy();
		expect(publico?.pendingItemDetail).toBeTruthy();
	});

	it('"Entender a situação" tem só a síntese e "o que está acontecendo" como obrigatórios', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		const problema = descoberta?.activities.find((activity) => activity.id === 'problema');
		if (!problema || problema.completionMode !== 'required_fields') {
			throw new Error('atividade "problema" deveria ser required_fields');
		}
		const required = problema.fields.filter((field) => field.required).map((field) => field.id);
		expect(required).toEqual(['situacao', 'situacao_o_que']);
		const optional = problema.fields.filter((field) => !field.required).map((field) => field.id);
		expect(optional).toEqual([
			'situacao_o_que_outro',
			'situacao_onde',
			'situacao_onde_outro',
			'situacao_peso',
			'hipotese_opt'
		]);
	});

	it('"situacao_o_que" é selecao_multipla com as opções de problema e de oportunidade namespaced', () => {
		const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
		const problema = descoberta?.activities.find((activity) => activity.id === 'problema');
		if (!problema || problema.completionMode !== 'required_fields') {
			throw new Error('atividade "problema" deveria ser required_fields');
		}
		const oQue = problema.fields.find((field) => field.id === 'situacao_o_que');
		if (!oQue || oQue.dataTarget !== 'answer' || oQue.type !== 'selecao_multipla') {
			throw new Error('"situacao_o_que" deveria ser selecao_multipla');
		}
		expect(oQue.options.map((option) => option.id)).toEqual([
			'prob_demora',
			'prob_custo',
			'prob_erros',
			'prob_retrabalho',
			'prob_insatisfacao',
			'prob_manual',
			'prob_visibilidade',
			'prob_quebrado',
			'prob_risco',
			'prob_outro',
			'opor_tempo',
			'opor_custo',
			'opor_experiencia',
			'opor_automacao',
			'opor_necessidade',
			'opor_negocio',
			'opor_simplicidade',
			'opor_confiabilidade',
			'opor_criacao',
			'opor_outro'
		]);

		const outro = problema.fields.find((field) => field.id === 'situacao_o_que_outro');
		expect(outro?.required).toBe(false);
	});

	// "Contexto inicial" (nome provisório como project_property) foi removida
	// do catálogo em 10/08/2026 — nome do projeto agora vem de /projects/new
	// na criação. Cobertura do mecanismo genérico project_property segue em
	// domain/transitions.spec.ts e domain/serialization.spec.ts, com fixture
	// local (nenhuma atividade real usa mais esse dataTarget).
});
