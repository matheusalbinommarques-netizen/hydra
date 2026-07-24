import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, confirmSummary, createInitialProjectState } from '$lib/domain';
import { computePhaseStatus } from './phase-status';

const T1 = '2026-01-01T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

const descoberta = catalog.phases.find((p) => p.id === 'descoberta')!;
const definicao = catalog.phases.find((p) => p.id === 'definicao')!;
const estruturacao = catalog.phases.find((p) => p.id === 'estruturacao')!;

function completeDiscovery(): ReturnType<typeof createInitialProjectState> {
	let state = createInitialProjectState(catalog, 'proj-1', T1);
	state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'Um problema' }, T1));
	state = unwrap(
		answerActivity(
			catalog,
			state,
			'contexto',
			{
				nome_provisorio: 'Portal',
				breve_descricao: 'x',
				modo_trabalho: 'Individual',
				nivel_experiencia: 'Iniciante',
				estagio_atual: 'Ideia inicial'
			},
			T1
		)
	);
	state = unwrap(answerActivity(catalog, state, 'problema', { situacao: 'x', dificuldade: 'y' }, T1));
	state = unwrap(answerActivity(catalog, state, 'publico', { publico_detail: 'x' }, T1));
	state = unwrap(answerActivity(catalog, state, 'estado_atual', { estado_atual_detail: 'x' }, T1));
	state = unwrap(
		answerActivity(catalog, state, 'resultado', { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }, T1)
	);
	state = unwrap(confirmSummary(catalog, state));
	return state;
}

describe('computePhaseStatus — fase complete (Descoberta)', () => {
	it('todas as atividades não_iniciada → não_iniciada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computePhaseStatus(descoberta, state.activityProgress, state.pendingItems)).toBe('não_iniciada');
	});

	it('uma atividade em_andamento (preenchimento parcial) → em_andamento', () => {
		// "contexto" tem 5 campos obrigatórios; preencher só 1 deixa a atividade em_andamento.
		const state = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'contexto',
				{ breve_descricao: 'x' },
				T1
			)
		);
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'contexto');
		expect(progress?.status).toBe('em_andamento');
		expect(computePhaseStatus(descoberta, state.activityProgress, state.pendingItems)).toBe('em_andamento');
	});

	it('todas concluídas (incluindo o Resumo confirmado) → concluída', () => {
		const state = completeDiscovery();
		expect(computePhaseStatus(descoberta, state.activityProgress, state.pendingItems)).toBe('concluída');
	});

	it('terminada com uma atividade pulada → concluída_com_pendências', () => {
		const activityProgress = descoberta.activities.map((a) => ({
			projectId: 'proj-1',
			activityDefinitionId: a.id,
			status: a.id === 'origem' ? ('pulada' as const) : ('concluída' as const)
		}));
		expect(computePhaseStatus(descoberta, activityProgress, [])).toBe('concluída_com_pendências');
	});

	it('terminada com pendência aberta vinculada → concluída_com_pendências', () => {
		const activityProgress = descoberta.activities.map((a) => ({
			projectId: 'proj-1',
			activityDefinitionId: a.id,
			status: 'concluída' as const
		}));
		const pendingItems = [
			{ id: 'p1', projectId: 'proj-1', activityDefinitionId: 'origem', status: 'aberta' as const, createdAt: T1 }
		];
		expect(computePhaseStatus(descoberta, activityProgress, pendingItems)).toBe('concluída_com_pendências');
	});
});

describe('computePhaseStatus — fase partial (Definição do produto)', () => {
	it('nova (atividade não_iniciada) → não_iniciada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computePhaseStatus(definicao, state.activityProgress, state.pendingItems)).toBe('não_iniciada');
	});

	it('com qualquer avanço (preenchimento parcial, em_andamento) → em_andamento', () => {
		// "usuario_principal" tem 1 campo obrigatório; um valor vazio mantém em_andamento.
		const state = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'usuario_principal', {}, T1)
		);
		expect(computePhaseStatus(definicao, state.activityProgress, state.pendingItems)).toBe('em_andamento');
	});

	it('com a atividade concluída → em_andamento (nunca concluída)', () => {
		const state = unwrap(
			answerActivity(
				catalog,
				createInitialProjectState(catalog, 'proj-1', T1),
				'usuario_principal',
				{ usuario_principal: 'Analista' },
				T1
			)
		);
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'usuario_principal');
		expect(progress?.status).toBe('concluída');
		expect(computePhaseStatus(definicao, state.activityProgress, state.pendingItems)).toBe('em_andamento');
	});
});

describe('computePhaseStatus — fase unavailable', () => {
	it('é sempre não_iniciada, independentemente dos progressos recebidos', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computePhaseStatus(estruturacao, state.activityProgress, state.pendingItems)).toBe('não_iniciada');

		// mesmo com progressos fabricados (fase sem atividades catalogadas, então
		// nada aqui deveria sequer ser lido — a checagem confirma isso).
		const fabricatedProgress = [
			{ projectId: 'proj-1', activityDefinitionId: 'qualquer', status: 'concluída' as const }
		];
		expect(computePhaseStatus(estruturacao, fabricatedProgress, [])).toBe('não_iniciada');
	});
});
