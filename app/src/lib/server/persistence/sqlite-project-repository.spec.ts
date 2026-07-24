import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalog } from '../../catalog';
import { answerActivity, confirmSummary, createInitialProjectState, renameProject, skipActivity } from '$lib/domain';
import type { ProjectState } from '$lib/domain';
import { createSqliteProjectRepository, type SqliteProjectRepository } from './sqlite-project-repository';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
	if (!result.ok) throw new Error(`esperado ok, recebido erro: ${JSON.stringify(result.error)}`);
	return result.value as T;
}

const openRepos: SqliteProjectRepository[] = [];
const tempFiles: string[] = [];

function memoryRepo(): SqliteProjectRepository {
	const repo = createSqliteProjectRepository(':memory:');
	openRepos.push(repo);
	return repo;
}

function tempFilePath(): string {
	const filePath = path.join(os.tmpdir(), `hydra-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
	tempFiles.push(filePath);
	return filePath;
}

afterEach(() => {
	for (const repo of openRepos.splice(0)) {
		repo.close();
	}
	for (const filePath of tempFiles.splice(0)) {
		fs.rmSync(filePath, { force: true });
	}
});

function nonTrivialState(): ProjectState {
	let state = createInitialProjectState(catalog, 'proj-1', T1);
	state = unwrap(renameProject(catalog, state, 'Portal de Solicitações'));
	state = unwrap(
		answerActivity(
			catalog,
			state,
			'problema',
			{ situacao: 'x', dificuldade: 'y', hipotese_opt: 'Uma hipótese' },
			T1
		)
	);
	state = unwrap(skipActivity(catalog, state, 'publico', 'pend-1', T1));
	state = unwrap(answerActivity(catalog, state, 'estado_atual', { estado_atual_detail: 'x' }, T1));
	state = unwrap(
		answerActivity(catalog, state, 'resultado', { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }, T1)
	);
	state = unwrap(confirmSummary(catalog, state));
	// invalida o Resumo editando uma resposta anterior
	state = unwrap(answerActivity(catalog, state, 'estado_atual', { estado_atual_detail: 'y' }, T2));
	// resolve a pendência de "publico"
	state = unwrap(answerActivity(catalog, state, 'publico', { publico_detail: 'Clientes' }, T2));
	return state;
}

describe('createSqliteProjectRepository — schema', () => {
	it('aplica o schema em banco vazio (tabelas ficam consultáveis)', async () => {
		const repo = memoryRepo();
		await expect(repo.findById('inexistente')).resolves.toBeNull();
	});

	it('aplicação repetida da inicialização não corrompe o banco nem perde dados', async () => {
		const filePath = tempFilePath();
		const repo1 = createSqliteProjectRepository(filePath);
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo1.insert(state);
		repo1.close();

		// reabrir no mesmo arquivo reaplica 0001_init.sql (CREATE TABLE IF NOT EXISTS)
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		const found = await repo2.findById('proj-1');
		expect(found).toEqual(state);
	});
});

describe('createSqliteProjectRepository — insert/findById', () => {
	it('insert + findById do estado inicial (createInitialProjectState)', async () => {
		const repo = memoryRepo();
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('round-trip de agregado não trivial preserva o estado exatamente', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);
		await expect(repo.findById(state.project.id)).resolves.toEqual(state);
	});

	it('findById de um id inexistente retorna null', async () => {
		const repo = memoryRepo();
		await expect(repo.findById('nao-existe')).resolves.toBeNull();
	});

	it('insert duplicado rejeita, sem sobrescrever o projeto existente', async () => {
		const repo = memoryRepo();
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(state);

		const other = unwrap(renameProject(catalog, state, 'Outro Nome'));
		await expect(repo.insert(other)).rejects.toThrow();

		// o projeto original permanece intacto
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('rollback atômico: insert com dado inválido não deixa nada gravado', async () => {
		const repo = memoryRepo();
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		const broken: ProjectState = {
			...state,
			answers: [
				{
					projectId: 'proj-1',
					activityDefinitionId: 'origem',
					fieldDefinitionId: 'origem',
					value: 'a',
					createdAt: T1,
					updatedAt: T1
				},
				{
					projectId: 'proj-1',
					activityDefinitionId: 'origem',
					fieldDefinitionId: 'origem', // duplicado — viola a PK composta de answer
					value: 'b',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};

		await expect(repo.insert(broken)).rejects.toThrow();
		await expect(repo.findById('proj-1')).resolves.toBeNull(); // nem o project row ficou
	});

	it('isolamento entre dois projetos: nenhum dado de um aparece no outro', async () => {
		const repo = memoryRepo();
		const stateA = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-a', T1), 'origem', { origem: 'A' }, T1)
		);
		const stateB = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-b', T1), 'origem', { origem: 'B' }, T1)
		);
		await repo.insert(stateA);
		await repo.insert(stateB);

		await expect(repo.findById('proj-a')).resolves.toEqual(stateA);
		await expect(repo.findById('proj-b')).resolves.toEqual(stateB);
	});
});

describe('createSqliteProjectRepository — save', () => {
	it('atualiza o projeto e as coleções filhas de forma atômica', async () => {
		const repo = memoryRepo();
		const initial = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(initial);

		const updated = nonTrivialState();
		await repo.save(updated);

		await expect(repo.findById('proj-1')).resolves.toEqual(updated);
	});

	it('remove registros filhos que não existem mais no estado recebido', async () => {
		const repo = memoryRepo();
		const withPendency = unwrap(
			skipActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', 'pend-1', T1)
		);
		await repo.insert(withPendency);

		// resolve a pendência (ela deixa de existir como "aberta"; o save deve
		// refletir isso sem deixar o registro antigo por trás)
		const resolved = unwrap(answerActivity(catalog, withPendency, 'origem', { origem: 'x' }, T2));
		await repo.save(resolved);

		const found = await repo.findById('proj-1');
		expect(found).toEqual(resolved);
		expect(found?.pendingItems).toHaveLength(1);
		expect(found?.pendingItems[0].status).toBe('resolvida');
	});

	it('não duplica registros após múltiplos saves consecutivos', async () => {
		const repo = memoryRepo();
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(state);

		state = unwrap(answerActivity(catalog, state, 'origem', { origem: 'x' }, T1));
		await repo.save(state);
		await repo.save(state);
		await repo.save(state);

		const found = await repo.findById('proj-1');
		expect(found).toEqual(state);
		expect(found?.activityProgress).toHaveLength(state.activityProgress.length);
	});

	it('rollback atômico: save com dado inválido preserva o estado anterior', async () => {
		const repo = memoryRepo();
		const valid = unwrap(
			answerActivity(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'origem', { origem: 'x' }, T1)
		);
		await repo.insert(valid);

		const broken: ProjectState = {
			...valid,
			pendingItems: [
				{ id: 'p1', projectId: 'proj-1', activityDefinitionId: 'publico', status: 'aberta', createdAt: T1 },
				{ id: 'p1', projectId: 'proj-1', activityDefinitionId: 'estado_atual', status: 'aberta', createdAt: T1 } // id duplicado
			]
		};

		await expect(repo.save(broken)).rejects.toThrow();
		await expect(repo.findById('proj-1')).resolves.toEqual(valid); // inalterado
	});
});

describe('createSqliteProjectRepository — fechamento e reabertura', () => {
	it('fechar e reabrir o arquivo SQLite preserva o estado', async () => {
		const filePath = tempFilePath();
		const repo1 = createSqliteProjectRepository(filePath);
		const state = nonTrivialState();
		await repo1.insert(state);
		repo1.close();

		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById(state.project.id)).resolves.toEqual(state);
	});
});

describe('createSqliteProjectRepository — nenhuma projeção do motor persistida', () => {
	it('o ProjectState carregado contém só os 4 tipos de domínio, nada calculado pelo motor', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);
		const found = await repo.findById(state.project.id);

		expect(found && Object.keys(found).sort()).toEqual(
			['project', 'activityProgress', 'answers', 'pendingItems'].sort()
		);
		expect(found).not.toHaveProperty('phaseStatuses');
		expect(found).not.toHaveProperty('projectStatus');
		expect(found).not.toHaveProperty('nextActivity');
		expect(found).not.toHaveProperty('openPendingItems');
		expect(found).not.toHaveProperty('hypotheses');
	});
});
