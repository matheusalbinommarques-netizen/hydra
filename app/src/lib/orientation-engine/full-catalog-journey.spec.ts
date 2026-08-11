// Jornada automatizada de integração — prova que o catálogo completo (fases
// 1 a 6) atravessa corretamente todas as fronteiras entre fases usando
// somente o motor de orientação genérico e o catálogo real, sem nenhuma
// lógica específica de fase ou atividade. Complementa (não substitui) os
// testes focados de cada módulo (next-activity/phase-status/project-status).

import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { createInitialProjectState, renameProject } from '$lib/domain';
import { computeNextActivity } from './next-activity';
import { computePhaseStatus } from './phase-status';
import { computeProjectStatus } from './project-status';
import { completePhase, unwrapResult } from '$lib/domain/test-support';

const T1 = '2026-01-01T00:00:00.000Z';

describe('jornada completa do catálogo (fases 1–6)', () => {
	it('recomenda a primeira atividade de cada fase na hora certa e termina com o projeto concluído', () => {
		// Nome definido explicitamente — desde a remoção de "Contexto inicial",
		// nenhuma atividade do catálogo define Project.name (agora vem de
		// /projects/new na criação real, fora desta jornada de catálogo).
		let state = unwrapResult(renameProject(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'Portal'));

		expect(catalog.phases.map((phase) => phase.id)).toEqual([
			'descoberta',
			'definicao',
			'estruturacao',
			'planejamento',
			'execucao',
			'validacao'
		]);

		for (const phase of catalog.phases) {
			// a primeira atividade não concluída/pulada da fase é a recomendação atual
			expect(computeNextActivity(catalog, state.activityProgress)).toEqual({
				kind: 'recommendation',
				activityDefinitionId: phase.activities[0].id
			});

			state = completePhase(catalog, state, phase.id, T1);

			// a fase inteira, recém-completada, já deve refletir concluída
			expect(computePhaseStatus(phase, state.activityProgress, state.pendingItems)).toBe('concluída');
		}

		// última atividade concluída (Confirmar encerramento do projeto) → catálogo esgotado
		expect(computeNextActivity(catalog, state.activityProgress)).toEqual({ kind: 'catalog_limit_reached' });

		// nenhuma fase permanece indisponível ou parcial — todas concluídas
		for (const phase of catalog.phases) {
			expect(computePhaseStatus(phase, state.activityProgress, state.pendingItems)).toBe('concluída');
		}

		// estado final do projeto: concluído é alcançável de ponta a ponta
		expect(computeProjectStatus(state.project, catalog, state.activityProgress)).toBe('concluído');

		// nenhuma atividade ficou para trás
		const allActivityIds = catalog.phases.flatMap((phase) => phase.activities.map((activity) => activity.id));
		for (const activityId of allActivityIds) {
			const progress = state.activityProgress.find((p) => p.activityDefinitionId === activityId);
			expect(progress?.status).toBe('concluída');
		}
	});
});
