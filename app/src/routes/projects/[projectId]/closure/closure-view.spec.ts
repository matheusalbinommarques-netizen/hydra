import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { buildClosureView } from './closure-view';

const PROJECT_ID = 'proj-1';

describe('buildClosureView', () => {
	it('agrupa as seis atividades reais de validacao nas três seções, na ordem definida', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {},
			answers: {},
			nextActivityPhaseId: null
		});

		expect(result.sections.map((section) => section.id)).toEqual(['resultados', 'transicao', 'encerramento']);
		expect(result.sections[0].title).toBe('Resultados e benefícios');
		expect(result.sections[1].title).toBe('Transição e adoção');
		expect(result.sections[2].title).toBe('Encerramento e aprendizado');

		expect(result.sections[0].activities.map((a) => a.id)).toEqual(['validar_entregas_criterios', 'coletar_feedback']);
		expect(result.sections[1].activities.map((a) => a.id)).toEqual(['transicao_proximos_passos']);
		expect(result.sections[2].activities.map((a) => a.id)).toEqual([
			'resolver_pendencias_finais',
			'licoes_aprendidas',
			'confirmar_encerramento'
		]);
	});

	it('títulos das atividades vêm do catálogo real, sem duplicar texto metodológico', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {},
			answers: {},
			nextActivityPhaseId: null
		});

		const validar = result.sections[0].activities[0];
		expect(validar.title).toBe('Validar entregas e critérios de aceitação');

		const confirmar = result.sections[2].activities[2];
		expect(confirmar.title).toBe('Confirmar encerramento do projeto');
	});

	it('mapeia os quatro estados para os rótulos aprovados', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {
				validar_entregas_criterios: 'não_iniciada',
				coletar_feedback: 'em_andamento',
				transicao_proximos_passos: 'concluída',
				resolver_pendencias_finais: 'pulada'
			},
			answers: {},
			nextActivityPhaseId: null
		});

		const byId = (id: string) => result.sections.flatMap((s) => s.activities).find((a) => a.id === id)!;
		expect(byId('validar_entregas_criterios').statusLabel).toBe('Ainda não iniciada');
		expect(byId('coletar_feedback').statusLabel).toBe('Em andamento');
		expect(byId('transicao_proximos_passos').statusLabel).toBe('Concluída');
		expect(byId('resolver_pendencias_finais').statusLabel).toBe('Atividade pulada');
	});

	it('atividade concluída mostra todos os campos e rótulos do catálogo, com respostas completas', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: { transicao_proximos_passos: 'concluída' },
			answers: {
				transicao_resultados: 'Mantido pela equipe de atendimento.',
				proximos_passos_pos_encerramento: 'Avaliar extensão do fluxo.'
			},
			nextActivityPhaseId: null
		});

		const transicao = result.sections[1].activities[0];
		expect(transicao.fields).toEqual([
			{ id: 'transicao_resultados', label: 'Como os resultados serão transferidos ou mantidos?', value: 'Mantido pela equipe de atendimento.', isEmpty: false },
			{ id: 'proximos_passos_pos_encerramento', label: 'Quais são os próximos passos possíveis?', value: 'Avaliar extensão do fluxo.', isEmpty: false }
		]);
	});

	it('atividade em andamento mostra os campos disponíveis e "Ainda não registrado" para campo vazio', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: { transicao_proximos_passos: 'em_andamento' },
			answers: { transicao_resultados: 'Mantido pela equipe de atendimento.' },
			nextActivityPhaseId: null
		});

		const transicao = result.sections[1].activities[0];
		expect(transicao.fields).toEqual([
			{ id: 'transicao_resultados', label: 'Como os resultados serão transferidos ou mantidos?', value: 'Mantido pela equipe de atendimento.', isEmpty: false },
			{ id: 'proximos_passos_pos_encerramento', label: 'Quais são os próximos passos possíveis?', value: null, isEmpty: true }
		]);
	});

	it('atividade pulada não mostra campos, mesmo com respostas parciais persistidas', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: { resolver_pendencias_finais: 'pulada' },
			answers: { pendencias_finais: 'resposta parcial que não deve aparecer' },
			nextActivityPhaseId: null
		});

		const pendencias = result.sections[2].activities[0];
		expect(pendencias.fields).toBeNull();
	});

	it('atividade não iniciada não mostra campos', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {},
			answers: {},
			nextActivityPhaseId: null
		});

		const validar = result.sections[0].activities[0];
		expect(validar.status).toBe('não_iniciada');
		expect(validar.fields).toBeNull();
	});

	it('hasPendingClosureWork é true quando pelo menos uma das seis atividades não é terminal', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {
				validar_entregas_criterios: 'concluída',
				coletar_feedback: 'concluída',
				transicao_proximos_passos: 'pulada',
				resolver_pendencias_finais: 'concluída',
				licoes_aprendidas: 'concluída',
				confirmar_encerramento: 'não_iniciada'
			},
			answers: {},
			nextActivityPhaseId: 'validacao'
		});

		expect(result.hasPendingClosureWork).toBe(true);
	});

	it('hasPendingClosureWork é false quando as seis atividades estão concluídas ou puladas', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {
				validar_entregas_criterios: 'concluída',
				coletar_feedback: 'concluída',
				transicao_proximos_passos: 'concluída',
				resolver_pendencias_finais: 'pulada',
				licoes_aprendidas: 'pulada',
				confirmar_encerramento: 'concluída'
			},
			answers: {},
			nextActivityPhaseId: null
		});

		expect(result.hasPendingClosureWork).toBe(false);
	});

	it('continuidade: trabalho pendente e a próxima atividade real pertence a validacao', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {},
			answers: {},
			nextActivityPhaseId: 'validacao'
		});

		expect(result.continuity).toEqual({
			kind: 'closure_cta',
			message: 'Ainda há atividades desta etapa para concluir.',
			ctaLabel: 'Continuar encerramento em Agora',
			href: `/projects/${PROJECT_ID}/now`
		});
	});

	it('continuidade: trabalho pendente mas a próxima atividade real é de uma fase anterior', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {},
			answers: {},
			nextActivityPhaseId: 'descoberta'
		});

		expect(result.continuity).toEqual({
			kind: 'earlier_cta',
			message: 'Conclua as etapas anteriores para avançar ao encerramento.',
			ctaLabel: 'Continuar projeto em Agora',
			href: `/projects/${PROJECT_ID}/now`
		});
	});

	it('continuidade: todas as seis atividades terminais — sem CTA', () => {
		const result = buildClosureView(catalog, {
			projectId: PROJECT_ID,
			activityStatuses: {
				validar_entregas_criterios: 'concluída',
				coletar_feedback: 'concluída',
				transicao_proximos_passos: 'concluída',
				resolver_pendencias_finais: 'pulada',
				licoes_aprendidas: 'pulada',
				confirmar_encerramento: 'concluída'
			},
			answers: {},
			nextActivityPhaseId: null
		});

		expect(result.continuity).toEqual({ kind: 'completed', message: 'Etapa de encerramento concluída.' });
	});

	it('recordsHref usa o projectId recebido — nenhuma montagem de rota é feita fora da projeção', () => {
		const result = buildClosureView(catalog, {
			projectId: 'outro-projeto-xyz',
			activityStatuses: {},
			answers: {},
			nextActivityPhaseId: null
		});

		expect(result.recordsHref).toBe('/projects/outro-projeto-xyz/records');
	});
});
