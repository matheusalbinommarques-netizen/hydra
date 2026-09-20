import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { closeProject, createInitialProjectState, renameProject } from '$lib/domain';
import { computeProjectStatus } from './project-status';
import { completeEntireCatalog, completePhase, unwrapResult } from '$lib/domain/test-support';

const T1 = '2026-01-01T00:00:00.000Z';

describe('computeProjectStatus', () => {
	it('é rascunho quando Project.name ainda não foi definido', () => {
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		expect(computeProjectStatus(state.project)).toBe('rascunho');
	});

	it('é em_andamento assim que o nome é definido, mesmo sem mais nada preenchido', () => {
		const state = unwrapResult(renameProject(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'Portal'));
		expect(computeProjectStatus(state.project)).toBe('em_andamento');
	});

	it('permanece em_andamento enquanto restarem fases não concluídas', () => {
		// Nome definido explicitamente (renameProject) — desde a remoção de
		// "Contexto inicial" (nome agora vem de /projects/new na criação real),
		// nenhuma atividade do catálogo define Project.name.
		const named = unwrapResult(renameProject(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'Portal'));
		const state = completePhase(catalog, named, 'descoberta', T1);
		expect(computeProjectStatus(state.project)).toBe('em_andamento');
	});

	it('catálogo completo SEM closedAt continua em_andamento (D083)', () => {
		const named = unwrapResult(renameProject(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'Portal'));
		const state = completeEntireCatalog(catalog, named, T1);
		expect(computeProjectStatus(state.project)).toBe('em_andamento');
	});

	it('closedAt implica concluído, mesmo sem nenhuma atividade concluída', () => {
		const named = unwrapResult(renameProject(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'Portal'));
		const state = unwrapResult(closeProject(named, null, T1));
		expect(computeProjectStatus(state.project)).toBe('concluído');
	});
});
