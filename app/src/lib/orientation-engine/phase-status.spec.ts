import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { answerActivity, createInitialProjectState } from '$lib/domain';
import { computePhaseStatus } from './phase-status';
import {
	answerActivityMinimally,
	completePhase,
	fabricatedPartialCatalog,
	fabricatedPartialPhase,
	fabricatedUnavailablePhase,
	unwrapResult
} from '$lib/domain/test-support';

const T1 = '2026-01-01T00:00:00.000Z';

const descoberta = catalog.phases.find((p) => p.id === 'descoberta')!;

describe('computePhaseStatus — fase complete (Descoberta)', () => {
	it('todas as atividades não_iniciada → não_iniciada', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computePhaseStatus(descoberta, state.activityProgress, state.pendingItems)).toBe('não_iniciada');
	});

	it('uma atividade em_andamento (preenchimento parcial) → em_andamento', () => {
		// "problema" tem 2 campos obrigatórios (situacao, situacao_o_que);
		// preencher só 1 deixa a atividade em_andamento.
		const state = unwrapResult(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'problema', { situacao: 'x' }, T1)
		);
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'problema');
		expect(progress?.status).toBe('em_andamento');
		expect(computePhaseStatus(descoberta, state.activityProgress, state.pendingItems)).toBe('em_andamento');
	});

	it('todas concluídas (incluindo o Resumo confirmado) → concluída', () => {
		const state = completePhase(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'descoberta', T1);
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

describe('computePhaseStatus — fase partial (fixture fabricada)', () => {
	// Nesta versão do catálogo real não há mais nenhuma fase 'partial' (todas
	// as seis são 'complete') — este comportamento continua fazendo parte do
	// modelo geral (STATE_MACHINE.md §2) e é testado aqui com uma fixture
	// fabricada, independente do conteúdo do catálogo real.
	it('nova (atividade não_iniciada) → não_iniciada', () => {
		const state = createInitialProjectState(fabricatedPartialCatalog, 'proj-1', T1);
		expect(computePhaseStatus(fabricatedPartialPhase, state.activityProgress, state.pendingItems)).toBe('não_iniciada');
	});

	it('com qualquer avanço (preenchimento parcial, em_andamento) → em_andamento', () => {
		const state = unwrapResult(
			answerActivity(
				fabricatedPartialCatalog,
				createInitialProjectState(fabricatedPartialCatalog, 'proj-1', T1),
				'fixture_atividade',
				{},
				T1
			)
		);
		expect(computePhaseStatus(fabricatedPartialPhase, state.activityProgress, state.pendingItems)).toBe('em_andamento');
	});

	it('com a atividade concluída → em_andamento (nunca concluída)', () => {
		const state = answerActivityMinimally(
			fabricatedPartialCatalog,
			createInitialProjectState(fabricatedPartialCatalog, 'proj-1', T1),
			'fixture_atividade',
			T1
		);
		const progress = state.activityProgress.find((p) => p.activityDefinitionId === 'fixture_atividade');
		expect(progress?.status).toBe('concluída');
		expect(computePhaseStatus(fabricatedPartialPhase, state.activityProgress, state.pendingItems)).toBe('em_andamento');
	});
});

describe('computePhaseStatus — fase unavailable', () => {
	// Idem: nenhuma fase real é 'unavailable' nesta versão; comportamento
	// testado com fixture fabricada.
	it('é sempre não_iniciada, independentemente dos progressos recebidos', () => {
		expect(computePhaseStatus(fabricatedUnavailablePhase, [], [])).toBe('não_iniciada');

		const fabricatedProgress = [
			{ projectId: 'proj-1', activityDefinitionId: 'qualquer', status: 'concluída' as const }
		];
		expect(computePhaseStatus(fabricatedUnavailablePhase, fabricatedProgress, [])).toBe('não_iniciada');
	});
});
