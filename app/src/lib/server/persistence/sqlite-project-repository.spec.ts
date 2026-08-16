import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalog } from '../../catalog';
import {
	addAffectedGroup,
	addCauseHypothesis,
	addImpediment,
	addScopeItem,
	addTreatmentStep,
	answerActivity,
	completeExternalAction,
	confirmAffectedGroups,
	confirmCauseHypotheses,
	confirmScopeVersion,
	confirmSummary,
	confirmTreatment,
	createInitialProjectState,
	encodeMultiSelectValue,
	moveScopeItem,
	prepareExternalAction,
	renameProject,
	resolveImpediment,
	setAffectedGroupFrequency,
	setAffectedGroupImpact,
	setCauseHypothesisExpectedIfTrue,
	setCauseHypothesisWhatWeakensIt,
	setHypothesis,
	setImpedimentNextAction,
	setRouteStartPhase,
	setScopeItemEffort,
	setScopeItemExecutionStatus,
	skipActivity,
	toggleCauseHypothesisEvidence
} from '$lib/domain';
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
	state = unwrap(setRouteStartPhase(catalog, state, 'estruturacao'));
	state = unwrap(
		answerActivity(
			catalog,
			state,
			'problema',
			{ situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']), hipotese_opt: 'Uma hipótese' },
			T1
		)
	);
	state = unwrap(skipActivity(catalog, state, 'publico', 'pend-1', T1));
	state = unwrap(addTreatmentStep(catalog, state, 'ts-1', 'Financeiro confere manualmente', T1));
	state = unwrap(confirmTreatment(catalog, state, T1));
	state = unwrap(
		answerActivity(catalog, state, 'resultado', { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }, T1)
	);
	state = unwrap(confirmSummary(catalog, state));
	// invalida o Resumo mutando "Como é tratado hoje" (novo passo) depois da confirmação
	state = unwrap(addTreatmentStep(catalog, state, 'ts-2', 'Depois disso, é arquivado', T2));
	// resolve a pendência de "publico" (Mapa de Impacto, ETAPA 2 do rework)
	state = unwrap(addAffectedGroup(catalog, state, 'ag-1', 'Clientes', T2));
	state = unwrap(setAffectedGroupImpact(catalog, state, 'ag-1', 'alto', T2));
	state = unwrap(setAffectedGroupFrequency(catalog, state, 'ag-1', 'constante', T2));
	state = unwrap(confirmAffectedGroups(catalog, state, T2));

	// ExternalAction/Evidence (ETAPA 3 do rework) — uma ação concluída com
	// Evidence (ag-1) e outra ainda aberta (ag-2, grupo novo), para exercitar
	// o roundtrip completo dos dois estados do lifecycle.
	const preparation = {
		objective: 'Confirmar como isso aparece para Clientes.',
		questions: ['Quando acontece?', 'O que você faz?'],
		informationToTake: ['Clientes', 'Impacto: Alto', 'Frequência: Constantemente'],
		expectedResult: 'Tente voltar sabendo se isso realmente acontece dessa forma.'
	};
	state = unwrap(prepareExternalAction(catalog, state, 'ea-1', 'ag-1', preparation, T2));
	state = unwrap(completeExternalAction(catalog, state, 'ea-1', 'ev-1', 'partially_confirmed', 'Confirma em parte.', T2));
	state = unwrap(addAffectedGroup(catalog, state, 'ag-2', 'Operação', T2));
	state = unwrap(prepareExternalAction(catalog, state, 'ea-2', 'ag-2', preparation, T2));

	state = unwrap(addScopeItem(catalog, state, 'scope-1', 'Criar projeto', 'agora', T1));
	state = unwrap(addScopeItem(catalog, state, 'scope-2', 'Relatórios avançados', 'agora', T1));
	state = unwrap(addScopeItem(catalog, state, 'scope-3', 'Integrações externas', 'fora', T1));
	state = unwrap(moveScopeItem(catalog, state, 'scope-3', 'depois', T2));
	state = unwrap(setScopeItemEffort(catalog, state, 'scope-1', 'pequeno', T1));
	state = unwrap(setScopeItemEffort(catalog, state, 'scope-2', 'grande', T1));
	state = unwrap(setScopeItemEffort(catalog, state, 'scope-3', 'medio', T1));
	state = unwrap(setHypothesis(catalog, state, 'Usuários concluem a jornada sem ajuda externa'));
	state = unwrap(confirmScopeVersion(catalog, state, T2));

	state = unwrap(addImpediment(catalog, state, 'imp-1', 'Falta acesso ao ambiente', 'falta_de_recurso', T1));
	state = unwrap(setImpedimentNextAction(catalog, state, 'imp-1', 'Solicitar acesso à TI', T1));
	state = unwrap(addImpediment(catalog, state, 'imp-2', 'Decisão pendente do time', 'decisao_pendente', T1));
	state = unwrap(resolveImpediment(catalog, state, 'imp-2', T2));

	// CauseHypothesis / CauseExploration (Stage 4B do rework, "Entender as
	// causas") — duas hipóteses, uma delas com aprofundamento e ligada à
	// Evidence já criada acima (ev-1), para exercitar o roundtrip completo
	// (origin, expectedIfTrue/whatWeakensIt, evidenceIds).
	state = unwrap(addCauseHypothesis(catalog, state, 'ch-1', 'O aprovador só revisa uma vez por semana', 'Fricção observada', T2));
	state = unwrap(setCauseHypothesisExpectedIfTrue(catalog, state, 'ch-1', 'Atrasos concentrados numa mesma janela', T2));
	state = unwrap(setCauseHypothesisWhatWeakensIt(catalog, state, 'ch-1', 'Atrasos distribuídos ao longo da semana', T2));
	state = unwrap(toggleCauseHypothesisEvidence(catalog, state, 'ch-1', 'ev-1', T2));
	state = unwrap(addCauseHypothesis(catalog, state, 'ch-2', 'O formulário exige anexos difíceis de obter', null, T2));
	state = unwrap(confirmCauseHypotheses(catalog, state, T2));
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

	it('abre um banco pré-D023 (sem route_start_phase_id) e adiciona a coluna de forma idempotente', async () => {
		const filePath = tempFilePath();

		// Simula um banco criado antes de D023: só as colunas de 0001_init.sql
		// originais, sem route_start_phase_id.
		const legacyDb = new Database(filePath);
		legacyDb.exec('CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, created_at TEXT NOT NULL)');
		legacyDb.prepare('INSERT INTO project (id, name, created_at) VALUES (?, ?, ?)').run('legacy-1', null, T1);
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		// Projeto pré-existente (sem child rows) permanece legível; interpretado
		// pelo domínio, mas findById exige child rows presentes — checamos
		// diretamente via nova conexão que a coluna foi adicionada com NULL.
		const verifyDb = new Database(filePath);
		const row = verifyDb.prepare('SELECT route_start_phase_id FROM project WHERE id = ?').get('legacy-1') as {
			route_start_phase_id: string | null;
		};
		expect(row.route_start_phase_id).toBeNull();
		verifyDb.close();

		// Novo projeto, inserido normalmente pelo repositório já migrado.
		const state = unwrap(
			setRouteStartPhase(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'estruturacao')
		);
		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('reabrir um banco já migrado não falha nem duplica a coluna', async () => {
		const filePath = tempFilePath();
		const repo1 = createSqliteProjectRepository(filePath);
		await repo1.insert(createInitialProjectState(catalog, 'proj-1', T1));
		repo1.close();

		// já tem a coluna — ensureRouteStartPhaseColumn deve ser no-op
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.not.toBeNull();
	});

	it('abre um banco pré-D025 (scope_item sem execution_status) e adiciona a coluna com default "a_fazer"', async () => {
		const filePath = tempFilePath();

		// Simula um banco criado antes de D025: scope_item sem execution_status,
		// já com route_start_phase_id (pós-D023).
		const legacyDb = new Database(filePath);
		legacyDb.exec('CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, created_at TEXT NOT NULL, route_start_phase_id TEXT)');
		legacyDb.exec(
			`CREATE TABLE scope_item (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL,
				text TEXT NOT NULL,
				bucket TEXT NOT NULL,
				effort TEXT,
				item_order INTEGER,
				source_suggestion_id TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`
		);
		legacyDb.prepare('INSERT INTO project (id, name, created_at) VALUES (?, ?, ?)').run('legacy-1', null, T1);
		legacyDb
			.prepare(
				`INSERT INTO scope_item (id, project_id, text, bucket, effort, item_order, source_suggestion_id, created_at, updated_at)
				 VALUES ('scope-legacy', 'legacy-1', 'Item legado', 'agora', NULL, 0, NULL, ?, ?)`
			)
			.run(T1, T1);
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const verifyDb = new Database(filePath);
		const row = verifyDb.prepare('SELECT execution_status FROM scope_item WHERE id = ?').get('scope-legacy') as {
			execution_status: string;
		};
		expect(row.execution_status).toBe('a_fazer');
		verifyDb.close();

		// Novo projeto, inserido normalmente pelo repositório já migrado.
		const state = unwrap(
			addScopeItem(catalog, createInitialProjectState(catalog, 'proj-2', T1), 'scope-1', 'Item', 'agora', T1)
		);
		await repo.insert(state);
		await expect(repo.findById('proj-2')).resolves.toEqual(state);
	});

	it('abre um banco pré-Stage 4A (sem a tabela current_treatment) e faz backfill de uma linha por projeto existente, sem inventar TreatmentStep nem tocar Answer legada', async () => {
		const filePath = tempFilePath();

		// Simula um banco criado antes do Stage 4A ("Como é tratado hoje"):
		// current_treatment/treatment_step não existem ainda — só as tabelas já
		// presentes desde antes desse corte, incluindo scope_version (1:1 com
		// project desde sempre) e uma Answer legada de estado_atual_detail
		// (era required_fields antes da ETAPA correspondente).
		const legacyDb = new Database(filePath);
		legacyDb.exec(
			'CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, created_at TEXT NOT NULL, route_start_phase_id TEXT)'
		);
		legacyDb.exec(
			'CREATE TABLE scope_version (project_id TEXT PRIMARY KEY, hypothesis TEXT NOT NULL, confirmed_at TEXT)'
		);
		legacyDb.exec(
			`CREATE TABLE answer (
				project_id TEXT NOT NULL,
				activity_definition_id TEXT NOT NULL,
				field_definition_id TEXT NOT NULL,
				value TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`
		);
		legacyDb
			.prepare('INSERT INTO project (id, name, created_at, route_start_phase_id) VALUES (?, ?, ?, NULL)')
			.run('legacy-1', 'Projeto pré-Stage-4A', T1);
		legacyDb.prepare("INSERT INTO scope_version (project_id, hypothesis, confirmed_at) VALUES ('legacy-1', '', NULL)").run();
		legacyDb
			.prepare(
				`INSERT INTO answer (project_id, activity_definition_id, field_definition_id, value, created_at, updated_at)
				 VALUES ('legacy-1', 'estado_atual', 'estado_atual_detail', ?, ?, ?)`
			)
			.run('Cada time usa sua própria planilha, sem padrão.', T1, T1);
		legacyDb.close();

		// Abrir com o repositório atual aplica 0001_init.sql (cria
		// current_treatment/treatment_step, ambas vazias) e o backfill de
		// current_treatment deve preencher a linha que faltava para "legacy-1".
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const found = await repo.findById('legacy-1');
		expect(found).not.toBeNull();
		if (!found) return;

		// CurrentTreatment inicial: exatamente o mesmo estado que
		// createInitialProjectState produz para um projeto novo — nunca
		// interpretado a partir de estado_atual_detail.
		expect(found.currentTreatment).toEqual({ projectId: 'legacy-1', noTreatment: false, updatedAt: T1 });
		expect(found.treatmentSteps).toEqual([]);

		// Mesmo banco também não tinha cause_exploration/cause_hypothesis
		// (Stage 4B, "Entender as causas") — mesmo backfill idempotente
		// (ensureCauseExplorationRows) preenche a linha 1:1 que faltava.
		expect(found.causeExploration).toEqual({ projectId: 'legacy-1', stillUnknown: false, updatedAt: T1 });
		expect(found.causeHypotheses).toEqual([]);

		// A Answer legada permanece exatamente como estava — nunca lida para
		// gerar TreatmentStep, nunca reescrita (sem dual-write).
		const legacyAnswer = found.answers.find(
			(a) => a.activityDefinitionId === 'estado_atual' && a.fieldDefinitionId === 'estado_atual_detail'
		);
		expect(legacyAnswer?.value).toBe('Cada time usa sua própria planilha, sem padrão.');
		expect(legacyAnswer?.updatedAt).toBe(T1);

		// Reabrir a mesma conexão/arquivo não duplica a linha nem falha
		// (idempotência, mesmo padrão das duas ensure* acima).
		repo.close();
		openRepos.length = 0;
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('legacy-1')).resolves.toEqual(found);

		// Um novo projeto, inserido normalmente pelo repositório já migrado,
		// continua funcionando sem alteração de contrato.
		const state = unwrap(
			addTreatmentStep(catalog, createInitialProjectState(catalog, 'proj-novo', T1), 'ts-1', 'Passo real', T1)
		);
		await repo2.insert(state);
		await expect(repo2.findById('proj-novo')).resolves.toEqual(state);
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

	it('round-trip preserva executionStatus não-padrão de um item "agora"', async () => {
		const repo = memoryRepo();
		let state = unwrap(
			addScopeItem(catalog, createInitialProjectState(catalog, 'proj-1', T1), 'scope-1', 'Item', 'agora', T1)
		);
		state = unwrap(setScopeItemEffort(catalog, state, 'scope-1', 'pequeno', T1));
		state = unwrap(setHypothesis(catalog, state, 'Hipótese'));
		state = unwrap(confirmScopeVersion(catalog, state, T1));
		state = unwrap(setScopeItemExecutionStatus(catalog, state, 'scope-1', 'em_andamento', T2));

		await repo.insert(state);
		const found = await repo.findById('proj-1');
		expect(found?.scopeItems[0].executionStatus).toBe('em_andamento');
		expect(found).toEqual(state);
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

describe('createSqliteProjectRepository — listRecent', () => {
	it('banco vazio retorna []', async () => {
		const repo = memoryRepo();
		await expect(repo.listRecent()).resolves.toEqual([]);
	});

	it('retorna múltiplos projetos ordenados por createdAt DESC', async () => {
		const repo = memoryRepo();
		await repo.insert(createInitialProjectState(catalog, 'proj-1', T1));
		await repo.insert(createInitialProjectState(catalog, 'proj-2', T2));

		await expect(repo.listRecent()).resolves.toEqual([
			{ id: 'proj-2', name: null, createdAt: T2, routeStartPhaseId: null },
			{ id: 'proj-1', name: null, createdAt: T1, routeStartPhaseId: null }
		]);
	});

	it('empate de createdAt usa id DESC como desempate determinístico', async () => {
		const repo = memoryRepo();
		await repo.insert(createInitialProjectState(catalog, 'proj-a', T1));
		await repo.insert(createInitialProjectState(catalog, 'proj-b', T1));

		await expect(repo.listRecent()).resolves.toEqual([
			{ id: 'proj-b', name: null, createdAt: T1, routeStartPhaseId: null },
			{ id: 'proj-a', name: null, createdAt: T1, routeStartPhaseId: null }
		]);
	});

	it('retorna somente id/name/createdAt/routeStartPhaseId — nunca activityProgress, answers ou pendingItems', async () => {
		const repo = memoryRepo();
		await repo.insert(nonTrivialState());

		const [project] = await repo.listRecent();
		expect(Object.keys(project).sort()).toEqual(['id', 'name', 'createdAt', 'routeStartPhaseId'].sort());
	});

	it('listRecent não modifica nenhum projeto existente', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);

		await repo.listRecent();

		await expect(repo.findById(state.project.id)).resolves.toEqual(state);
	});
});

describe('createSqliteProjectRepository — nenhuma projeção do motor persistida', () => {
	it('o ProjectState carregado contém só os 12 tipos de domínio, nada calculado pelo motor', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);
		const found = await repo.findById(state.project.id);

		expect(found && Object.keys(found).sort()).toEqual(
			[
				'project',
				'activityProgress',
				'answers',
				'pendingItems',
				'scopeItems',
				'scopeVersion',
				'impediments',
				'affectedGroups',
				'externalActions',
				'evidences',
				'currentTreatment',
				'treatmentSteps',
				'causeExploration',
				'causeHypotheses'
			].sort()
		);
		expect(found).not.toHaveProperty('phaseStatuses');
		expect(found).not.toHaveProperty('projectStatus');
		expect(found).not.toHaveProperty('nextActivity');
		expect(found).not.toHaveProperty('openPendingItems');
		expect(found).not.toHaveProperty('hypotheses');
	});
});
