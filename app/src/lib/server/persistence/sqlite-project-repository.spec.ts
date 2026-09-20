import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DocumentSnapshotParseError } from '../../domain';
import type { DocumentSnapshotContentV1 } from '../../domain';
import { catalog } from '../../catalog';
import {
	addAffectedGroup,
	addCauseHypothesis,
	addChange,
	addDecision,
	addDeliverable,
	addDesiredOutcome,
	setDesiredOutcomeAssessment,
	addImpediment,
	addMilestone,
	addRisk,
	decideDecision,
	editDecision,
	setChangeImpact,
	setMilestonePlannedDate,
	linkWorkItemToDecision,
	linkWorkItemToMilestone,
	unlinkWorkItemFromDecision,
	addScopeItem,
	addTreatmentStep,
	addWorkItem,
	setWorkItemSchedule,
	captureScheduleBaseline,
	previewScheduleBaselineCapture,
	answerActivity,
	completeApprovalExternalAction,
	completeExternalAction,
	confirmAffectedGroups,
	confirmCauseHypotheses,
	confirmDesiredOutcomes,
	confirmScopeVersion,
	confirmSummary,
	confirmTreatment,
	createInitialProjectState,
	encodeMultiSelectValue,
	moveScopeItem,
	reachMilestone,
	moveWorkItem,
	prepareApprovalExternalAction,
	prepareExternalAction,
	promoteScopeItemToDeliverable,
	removeDeliverable,
	removeScopeItem,
	renameProject,
	reopenImpediment,
	resolveImpediment,
	reviewRisk,
	setRiskAssessment,
	setRiskResponse,
	setAffectedGroupFrequency,
	setAffectedGroupImpact,
	setCauseHypothesisExpectedIfTrue,
	setCauseHypothesisWhatWeakensIt,
	setDeliverableEffort,
	setDesiredOutcomeTarget,
	setHypothesis,
	setImpedimentDecision,
	setImpedimentNextAction,
	setRouteStartPhase,
	setScopeItemEffort,
	setScopeItemExecutionStatus,
	setWorkItemDeliverable,
	skipActivity,
	toggleCauseHypothesisEvidence
} from '$lib/domain';
import type { ProjectEvent, ProjectState } from '$lib/domain';
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

function nonTrivialStateSemMarcos(): ProjectState {
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
	// DesiredOutcome (Stage 4C do rework, "Resultado desejado") — dois
	// resultados, um deles com alvo quantitativo, para exercitar o roundtrip
	// completo (change/target/order).
	state = unwrap(addDesiredOutcome(catalog, state, 'do-1', 'Solicitações centralizadas e priorizadas', T1));
	state = unwrap(setDesiredOutcomeTarget(catalog, state, 'do-1', '-30% de retrabalho', T1));
	state = unwrap(addDesiredOutcome(catalog, state, 'do-2', 'Acompanhamento do início ao fim', T1));
	state = unwrap(confirmDesiredOutcomes(catalog, state, T1));
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

	// WorkItem (ETAPA 6 do rework, "Primeiro loop operacional") — um item
	// movido para "em_andamento" sem impedimento, e outro bloqueado por um
	// Impediment vinculado (work_item_id), para exercitar o roundtrip
	// completo do vínculo, inclusive a FK impediment.work_item_id.
	state = unwrap(addWorkItem(catalog, state, 'wi-1', 'Revisar contrato com fornecedor', T1));
	state = unwrap(moveWorkItem(catalog, state, 'wi-1', 'em_andamento', T2));
	state = unwrap(addWorkItem(catalog, state, 'wi-2', 'Migrar base de clientes', T1));
	state = unwrap(addImpediment(catalog, state, 'imp-3', 'Acesso ao novo CRM ainda não liberado', 'dependencia_externa', T2, 'wi-2'));

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

// Milestone (ETAPA 8 do rework, segundo microcorte) — dois marcos que cobrem
// os dois casos que o modelo precisa suportar: um alcançado cujo trabalho
// relacionado (wi-2) NÃO está concluído (coexistência legítima), e um aberto
// sem nenhum trabalho relacionado.
function nonTrivialState(): ProjectState {
	let state = nonTrivialStateSemMarcos();
	state = unwrap(addMilestone(catalog, state, 'ms-1', 'Primeira versão utilizável', T1));
	state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-1', 'ms-1', 'wi-1', T1));
	state = unwrap(linkWorkItemToMilestone(catalog, state, 'mwi-2', 'ms-1', 'wi-2', T1));
	state = unwrap(reachMilestone(catalog, state, 'ms-1', T2));
	state = unwrap(addMilestone(catalog, state, 'ms-2', 'Migração concluída', T2));
	// Um marco datado e outro sem data: o round-trip precisa preservar os dois.
	state = unwrap(setMilestonePlannedDate(catalog, state, 'ms-2', '2026-09-01', T2));
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

	// ETAPA 14 do rework ("Ações externas maduras", §44, D070/D072/D073) —
	// bancos criados antes desta etapa têm external_action com CHECK fechado
	// (kind IN ('validate_affected_group')) e affected_group_id NOT NULL,
	// incompatíveis com o kind novo `approval` (subject Decision). Prova as
	// três garantias exigidas pelo upgrade idempotente
	// (ensureExternalActionApprovalSupport, rebuild de tabela): o banco
	// antigo abre, a ExternalAction legada permanece íntegra, e uma
	// `approval` nova pode ser persistida depois da conversão.
	it('abre um banco pré-ETAPA-14 (external_action com CHECK fechado e affected_group_id NOT NULL), preserva a ExternalAction legada e aceita uma approval nova após o upgrade', async () => {
		const filePath = tempFilePath();

		const legacyDb = new Database(filePath);
		legacyDb.exec(
			'CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, created_at TEXT NOT NULL, route_start_phase_id TEXT)'
		);
		legacyDb.exec(
			'CREATE TABLE scope_version (project_id TEXT PRIMARY KEY, hypothesis TEXT NOT NULL, confirmed_at TEXT)'
		);
		legacyDb.exec(
			`CREATE TABLE affected_group (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL,
				label TEXT NOT NULL,
				impact TEXT,
				frequency TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`
		);
		// Shape físico pré-ETAPA-14, idêntico ao 0001_init.sql anterior a este
		// corte: CHECK fechado + affected_group_id NOT NULL, sem decision_id.
		legacyDb.exec(
			`CREATE TABLE external_action (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL,
				kind TEXT NOT NULL CHECK (kind IN ('validate_affected_group')),
				affected_group_id TEXT NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('aberta', 'concluida')),
				objective TEXT NOT NULL,
				questions TEXT NOT NULL,
				information_to_take TEXT NOT NULL,
				expected_result TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				completed_at TEXT
			)`
		);
		legacyDb
			.prepare('INSERT INTO project (id, name, created_at, route_start_phase_id) VALUES (?, ?, ?, NULL)')
			.run('legacy-1', 'Projeto pré-ETAPA-14', T1);
		legacyDb.prepare("INSERT INTO scope_version (project_id, hypothesis, confirmed_at) VALUES ('legacy-1', '', NULL)").run();
		legacyDb
			.prepare(
				`INSERT INTO affected_group (id, project_id, label, impact, frequency, created_at, updated_at)
				 VALUES ('ag-1', 'legacy-1', 'Clientes', 'alto', 'constante', ?, ?)`
			)
			.run(T1, T1);
		legacyDb
			.prepare(
				`INSERT INTO external_action
					(id, project_id, kind, affected_group_id, status, objective, questions, information_to_take, expected_result, created_at, updated_at, completed_at)
				 VALUES ('ea-legacy', 'legacy-1', 'validate_affected_group', 'ag-1', 'aberta', 'Confirmar com Clientes.', '["Pergunta 1"]', '["Clientes"]', 'Voltar com a resposta.', ?, ?, NULL)`
			)
			.run(T1, T1);
		legacyDb.close();

		// Abrir com o repositório atual aplica 0001_init.sql (cria decision e
		// as demais tabelas novas, vazias) e ensureExternalActionApprovalSupport
		// deve reconstruir external_action preservando a linha legada.
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const found = await repo.findById('legacy-1');
		expect(found).not.toBeNull();
		if (!found) return;

		expect(found.externalActions).toEqual([
			{
				id: 'ea-legacy',
				projectId: 'legacy-1',
				kind: 'validate_affected_group',
				affectedGroupId: 'ag-1',
				status: 'aberta',
				objective: 'Confirmar com Clientes.',
				questions: ['Pergunta 1'],
				informationToTake: ['Clientes'],
				expectedResult: 'Voltar com a resposta.',
				createdAt: T1,
				updatedAt: T1,
				completedAt: null
			}
		]);

		// Reabrir não duplica nem falha (idempotência do rebuild).
		repo.close();
		openRepos.length = 0;
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('legacy-1')).resolves.toEqual(found);

		// Uma `approval` nova — kind que não existia fisicamente no schema
		// antigo — pode ser preparada e persistida depois do upgrade, sem
		// perder a ExternalAction legada.
		let state = unwrap(addDecision(catalog, found, 'dec-1', 'Aprovar o orçamento do trimestre?', T2));
		state = unwrap(prepareApprovalExternalAction(catalog, state, 'ea-approval-1', 'dec-1', T2));
		await repo2.save(state);

		const afterApproval = await repo2.findById('legacy-1');
		expect(afterApproval).not.toBeNull();
		if (!afterApproval) return;
		expect(afterApproval.externalActions).toContainEqual({
			id: 'ea-legacy',
			projectId: 'legacy-1',
			kind: 'validate_affected_group',
			affectedGroupId: 'ag-1',
			status: 'aberta',
			objective: 'Confirmar com Clientes.',
			questions: ['Pergunta 1'],
			informationToTake: ['Clientes'],
			expectedResult: 'Voltar com a resposta.',
			createdAt: T1,
			updatedAt: T1,
			completedAt: null
		});
		expect(afterApproval.externalActions).toContainEqual({
			id: 'ea-approval-1',
			projectId: 'legacy-1',
			kind: 'approval',
			decisionId: 'dec-1',
			status: 'aberta',
			createdAt: T2,
			updatedAt: T2,
			completedAt: null
		});

		// Fluxo completo: retorno com a Decision ainda pendente decide a
		// Decision e conclui a ExternalAction na mesma reconciliação.
		state = unwrap(completeApprovalExternalAction(catalog, state, 'ea-approval-1', 'Aprovado com ressalvas.', T2));
		await repo2.save(state);
		const afterComplete = await repo2.findById('legacy-1');
		expect(afterComplete?.decisions).toContainEqual(
			expect.objectContaining({ id: 'dec-1', status: 'tomada', outcome: 'Aprovado com ressalvas.', decidedAt: T2 })
		);
		expect(afterComplete?.externalActions).toContainEqual(
			expect.objectContaining({ id: 'ea-approval-1', kind: 'approval', status: 'concluida', completedAt: T2 })
		);
	});
});

describe('createSqliteProjectRepository — índices de project_id (R5)', () => {
	const TABLES_WITH_PROJECT_ID_INDEX = [
		'scope_item',
		'impediment',
		'affected_group',
		'external_action',
		'evidence',
		'treatment_step',
		'cause_hypothesis'
	];

	function hasProjectIdIndex(db: Database.Database, table: string): boolean {
		const indexes = db.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[];
		return indexes.some((index) => {
			const columns = db.prepare(`PRAGMA index_info(${index.name})`).all() as { name: string }[];
			return columns.some((column) => column.name === 'project_id');
		});
	}

	it('banco novo já nasce com índice de project_id nas tabelas sem outra constraint que o cubra', async () => {
		const filePath = tempFilePath();
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const db = new Database(filePath, { readonly: true });
		for (const table of TABLES_WITH_PROJECT_ID_INDEX) {
			expect(hasProjectIdIndex(db, table), `${table} deveria ter índice de project_id`).toBe(true);
		}
		db.close();
	});

	it('banco existente sem os índices os recebe ao passar pela inicialização atual (CREATE INDEX IF NOT EXISTS)', async () => {
		const filePath = tempFilePath();

		// Simula um banco criado antes deste corte: schema completo (0001_init.sql
		// sem os `CREATE INDEX` novos), sem nenhum índice além dos automáticos de PK.
		const legacyDb = new Database(filePath);
		legacyDb.exec(
			`CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, created_at TEXT NOT NULL, route_start_phase_id TEXT);
			 CREATE TABLE scope_version (project_id TEXT PRIMARY KEY, hypothesis TEXT NOT NULL, confirmed_at TEXT);
			 CREATE TABLE scope_item (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, text TEXT NOT NULL, bucket TEXT NOT NULL, effort TEXT, item_order INTEGER, source_suggestion_id TEXT, execution_status TEXT NOT NULL DEFAULT 'a_fazer', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
			 CREATE TABLE impediment (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, text TEXT NOT NULL, tipo TEXT NOT NULL, next_action TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT);
			 CREATE TABLE affected_group (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, label TEXT NOT NULL, impact TEXT, frequency TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
			 CREATE TABLE external_action (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, affected_group_id TEXT NOT NULL, status TEXT NOT NULL, objective TEXT NOT NULL, questions TEXT NOT NULL, information_to_take TEXT NOT NULL, expected_result TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT);
			 CREATE TABLE evidence (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, external_action_id TEXT NOT NULL, affected_group_id TEXT NOT NULL, kind TEXT NOT NULL, outcome TEXT NOT NULL, learning TEXT NOT NULL, created_at TEXT NOT NULL);
			 CREATE TABLE current_treatment (project_id TEXT PRIMARY KEY, no_treatment INTEGER NOT NULL, updated_at TEXT NOT NULL);
			 CREATE TABLE treatment_step (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, step_order INTEGER NOT NULL, what_happens TEXT NOT NULL, actors TEXT NOT NULL, medium TEXT, frictions TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
			 CREATE TABLE cause_exploration (project_id TEXT PRIMARY KEY, still_unknown INTEGER NOT NULL, updated_at TEXT NOT NULL);
			 CREATE TABLE cause_hypothesis (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, origin TEXT, expected_if_true TEXT, what_weakens_it TEXT, evidence_ids TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
			 CREATE TABLE answer (project_id TEXT NOT NULL, activity_definition_id TEXT NOT NULL, field_definition_id TEXT NOT NULL, value TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (project_id, activity_definition_id, field_definition_id));
			 CREATE TABLE activity_progress (project_id TEXT NOT NULL, activity_definition_id TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY (project_id, activity_definition_id));
			 CREATE TABLE pending_item (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, activity_definition_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT, UNIQUE (project_id, activity_definition_id));`
		);
		legacyDb
			.prepare('INSERT INTO project (id, name, created_at, route_start_phase_id) VALUES (?, ?, ?, NULL)')
			.run('legacy-1', 'Projeto pré-índices', T1);
		legacyDb.prepare("INSERT INTO scope_version (project_id, hypothesis, confirmed_at) VALUES ('legacy-1', '', NULL)").run();
		legacyDb.prepare("INSERT INTO current_treatment (project_id, no_treatment, updated_at) VALUES ('legacy-1', 0, ?)").run(T1);
		legacyDb.prepare("INSERT INTO cause_exploration (project_id, still_unknown, updated_at) VALUES ('legacy-1', 0, ?)").run(T1);
		legacyDb.close();

		const verifyBefore = new Database(filePath, { readonly: true });
		for (const table of TABLES_WITH_PROJECT_ID_INDEX) {
			expect(hasProjectIdIndex(verifyBefore, table), `${table} não deveria ter índice antes da inicialização`).toBe(
				false
			);
		}
		verifyBefore.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		await expect(repo.findById('legacy-1')).resolves.not.toBeNull();

		const verifyAfter = new Database(filePath, { readonly: true });
		for (const table of TABLES_WITH_PROJECT_ID_INDEX) {
			expect(hasProjectIdIndex(verifyAfter, table), `${table} deveria ter índice após a inicialização atual`).toBe(
				true
			);
		}
		verifyAfter.close();
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

// Event log incremental (ETAPA 7 do rework, "Event log incremental") —
// mesmos padrões já usados acima (memoryRepo/tempFilePath, unwrap,
// rollback atômico via dado inválido) aplicados ao novo caminho de escrita
// de project_event.
describe('createSqliteProjectRepository — event log (ETAPA 7 do rework)', () => {
	function workItemCreatedEvent(overrides: Partial<ProjectEvent> = {}): ProjectEvent {
		return {
			id: 'evt-1',
			projectId: 'proj-1',
			type: 'work_item.created',
			entityType: 'work_item',
			entityId: 'wi-1',
			payload: { title: 'Revisar contrato' },
			createdAt: T1,
			...overrides
		} as ProjectEvent;
	}

	it('banco novo: listEvents de um projeto sem eventos retorna []', async () => {
		const repo = memoryRepo();
		await repo.insert(createInitialProjectState(catalog, 'proj-1', T1));
		await expect(repo.listEvents('proj-1')).resolves.toEqual([]);
	});

	it('abre um banco pré-S7 (sem a tabela project_event) e listEvents retorna [] sem quebrar — sem backfill', async () => {
		const filePath = tempFilePath();

		// Simula um banco criado antes da S7: schema sem project_event, mas com
		// um projeto já existente (mesmo espírito dos testes pré-D023/D025
		// acima — aqui não há coluna nem tabela 1:1 a migrar, só a ausência de
		// uma tabela 0:N nova).
		const legacyDb = new Database(filePath);
		legacyDb.exec(
			'CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, created_at TEXT NOT NULL, route_start_phase_id TEXT)'
		);
		legacyDb.prepare('INSERT INTO project (id, name, created_at) VALUES (?, ?, ?)').run('legacy-1', null, T1);
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		// project_event foi criada vazia (CREATE TABLE IF NOT EXISTS) — nenhuma
		// linha foi inventada para o projeto pré-existente (sem ensureX de
		// backfill, ao contrário de current_treatment/cause_exploration).
		await expect(repo.listEvents('legacy-1')).resolves.toEqual([]);
	});

	// R1 da remediação — project_event nasceu (S7) com CHECK enumerando os
	// quatro tipos do loop WorkItem/Impediment. Como CREATE TABLE IF NOT EXISTS
	// é no-op numa tabela existente, um banco pré-R1 manteria esse CHECK e
	// recusaria qualquer tipo novo; e como save() grava estado e eventos na
	// mesma transação, o INSERT recusado derruba a operação de domínio inteira.
	// Este é o teste que faltava: o de "banco pré-S7" acima cobre só o caso
	// fácil (tabela ausente → criada já no formato novo).
	//
	// A fixture é construída rebaixando um banco válido ao formato antigo, em
	// vez de reescrever o schema inteiro no teste: assim ela não sai de sincronia
	// com 0001_init.sql quando outras tabelas mudarem.
	it('abre um banco pré-R1 (project_event com CHECK fechado), preserva histórico e estado, e passa a aceitar tipo de evento novo', async () => {
		const filePath = tempFilePath();

		const seed = createSqliteProjectRepository(filePath);
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		await seed.insert(state);
		state = unwrap(addWorkItem(catalog, state, 'wi-1', 'Revisar contrato', T1));
		await seed.save(state, [workItemCreatedEvent()]);
		seed.close();

		const legacyDb = new Database(filePath);
		legacyDb.exec(
			`CREATE TABLE project_event_legacy (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
				type TEXT NOT NULL CHECK (
					type IN ('work_item.created', 'work_item.status_changed', 'impediment.registered', 'impediment.status_changed')
				),
				entity_type TEXT NOT NULL CHECK (entity_type IN ('work_item', 'impediment')),
				entity_id TEXT NOT NULL,
				payload TEXT NOT NULL,
				created_at TEXT NOT NULL
			);
			INSERT INTO project_event_legacy (id, project_id, type, entity_type, entity_id, payload, created_at)
				SELECT id, project_id, type, entity_type, entity_id, payload, created_at FROM project_event;
			DROP TABLE project_event;
			ALTER TABLE project_event_legacy RENAME TO project_event;`
		);
		// A fixture só vale se realmente reproduzir o bloqueio que motivou o corte.
		expect(() =>
			legacyDb
				.prepare(
					'INSERT INTO project_event (id, project_id, type, entity_type, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
				)
				.run('evt-futuro', 'proj-1', 'dependency.created', 'dependency', 'dep-1', '{}', T2)
		).toThrow(/CHECK/i);
		legacyDb.close();

		// A conversão roda na abertura, junto das demais ensureX.
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		// Nada do histórico já gravado se perde...
		await expect(repo.listEvents('proj-1')).resolves.toEqual([workItemCreatedEvent()]);
		// ...e o estado do projeto continua íntegro.
		await expect(repo.findById('proj-1')).resolves.toEqual(state);

		// Um tipo que ainda nem existe na união ProjectEvent de hoje (o cast
		// documenta exatamente isso) passa a ser aceito pelo caminho real de
		// escrita — é o que os cortes seguintes do rework precisam.
		const futureEvent = {
			id: 'evt-futuro',
			projectId: 'proj-1',
			type: 'dependency.created',
			entityType: 'dependency',
			entityId: 'dep-1',
			payload: { kind: 'external' },
			createdAt: T2
		} as unknown as ProjectEvent;
		await repo.save(state, [futureEvent]);

		const events = await repo.listEvents('proj-1');
		expect(events.map((event) => event.type)).toContain('dependency.created');
		// O estado sobreviveu ao save que carregou o evento de tipo novo.
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('reabrir um banco já convertido é no-op — a conversão não roda duas vezes', async () => {
		const filePath = tempFilePath();
		const first = createSqliteProjectRepository(filePath);
		const state = createInitialProjectState(catalog, 'proj-1', T1);
		await first.insert(state);
		await first.save(state, [workItemCreatedEvent()]);
		first.close();

		const reopened = createSqliteProjectRepository(filePath);
		openRepos.push(reopened);
		await expect(reopened.listEvents('proj-1')).resolves.toEqual([workItemCreatedEvent()]);
	});

	it('save(state, events) grava estado e evento na mesma transação', async () => {
		const repo = memoryRepo();
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(state);

		state = unwrap(addWorkItem(catalog, state, 'wi-1', 'Revisar contrato', T1));
		await repo.save(state, [workItemCreatedEvent()]);

		await expect(repo.findById('proj-1')).resolves.toEqual(state);
		const events = await repo.listEvents('proj-1');
		expect(events).toEqual([workItemCreatedEvent()]);
	});

	it('atomicidade: save com dado inválido não deixa nem o estado nem o evento gravados', async () => {
		const repo = memoryRepo();
		const valid = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(valid);

		const broken: ProjectState = {
			...valid,
			pendingItems: [
				{ id: 'p1', projectId: 'proj-1', activityDefinitionId: 'publico', status: 'aberta', createdAt: T1 },
				{ id: 'p1', projectId: 'proj-1', activityDefinitionId: 'estado_atual', status: 'aberta', createdAt: T1 } // id duplicado
			]
		};

		await expect(repo.save(broken, [workItemCreatedEvent()])).rejects.toThrow();
		await expect(repo.findById('proj-1')).resolves.toEqual(valid); // estado inalterado
		await expect(repo.listEvents('proj-1')).resolves.toEqual([]); // nenhum evento órfão
	});

	it('evento sobrevive a saves posteriores que não passam events (histórico nunca é apagado por save)', async () => {
		const repo = memoryRepo();
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(state);

		state = unwrap(addWorkItem(catalog, state, 'wi-1', 'Revisar contrato', T1));
		await repo.save(state, [workItemCreatedEvent()]);

		// save "normal", sem segundo argumento — mesmo caminho usado por toda
		// operação que ainda não gera evento (ver project-use-cases.ts).
		state = unwrap(renameProject(catalog, state, 'Novo nome'));
		await repo.save(state);

		await expect(repo.listEvents('proj-1')).resolves.toEqual([workItemCreatedEvent()]);
	});

	it('resolve → reopen produz dois eventos impediment.status_changed em ordem, com fromStatus/toStatus corretos', async () => {
		const repo = memoryRepo();
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(state);

		state = unwrap(addImpediment(catalog, state, 'imp-1', 'Falta acesso', 'falta_de_recurso', T1));
		state = unwrap(resolveImpediment(catalog, state, 'imp-1', T1));
		const resolvedEvent: ProjectEvent = {
			id: 'evt-resolved',
			projectId: 'proj-1',
			type: 'impediment.status_changed',
			entityType: 'impediment',
			entityId: 'imp-1',
			payload: { fromStatus: 'aberto', toStatus: 'resolvido' },
			createdAt: T1
		};
		await repo.save(state, [resolvedEvent]);

		state = unwrap(reopenImpediment(catalog, state, 'imp-1', T2));
		const reopenedEvent: ProjectEvent = {
			id: 'evt-reopened',
			projectId: 'proj-1',
			type: 'impediment.status_changed',
			entityType: 'impediment',
			entityId: 'imp-1',
			payload: { fromStatus: 'resolvido', toStatus: 'aberto' },
			createdAt: T2
		};
		await repo.save(state, [reopenedEvent]);

		// mais recente primeiro (ORDER BY created_at DESC)
		await expect(repo.listEvents('proj-1')).resolves.toEqual([reopenedEvent, resolvedEvent]);
	});

	it('listEvents com filtro entityIds retorna só os eventos das entidades pedidas', async () => {
		const repo = memoryRepo();
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		await repo.insert(state);

		state = unwrap(addWorkItem(catalog, state, 'wi-1', 'Item A', T1));
		const eventA = workItemCreatedEvent({ id: 'evt-a', entityId: 'wi-1' });
		state = unwrap(addWorkItem(catalog, state, 'wi-2', 'Item B', T1));
		const eventB = workItemCreatedEvent({ id: 'evt-b', entityId: 'wi-2', payload: { title: 'Item B' } });
		await repo.save(state, [eventA, eventB]);

		await expect(repo.listEvents('proj-1', { entityIds: ['wi-1'] })).resolves.toEqual([eventA]);
		await expect(repo.listEvents('proj-1', { entityIds: ['wi-1', 'wi-2'] })).resolves.toEqual(
			expect.arrayContaining([eventA, eventB])
		);
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
	it('o ProjectState carregado contém só os 14 tipos de domínio, nada calculado pelo motor', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);
		const found = await repo.findById(state.project.id);

		expect(found && Object.keys(found).sort()).toEqual(
			Object.keys(createInitialProjectState(catalog, 'irrelevante', T1)).sort()
		);
		expect(found).not.toHaveProperty('phaseStatuses');
		expect(found).not.toHaveProperty('projectStatus');
		expect(found).not.toHaveProperty('nextActivity');
		expect(found).not.toHaveProperty('openPendingItems');
		expect(found).not.toHaveProperty('hypotheses');
	});
});


// Milestone (ETAPA 8 do rework, segundo microcorte) — o risco concreto aqui é
// de UPGRADE: um banco criado antes deste corte não tem as tabelas novas, e a
// invariante fechada do lifecycle passou a ser CONSTRAINT nomeada (D038).
describe('createSqliteProjectRepository — Milestone (ETAPA 8 do rework)', () => {
	it('abre um banco anterior a este corte (sem as tabelas de marco) e passa a gravá-los, sem backfill', async () => {
		const filePath = tempFilePath();

		// banco "antigo": criado pela inicialização atual, depois com as duas
		// tabelas removidas — simula um arquivo gerado antes deste corte.
		const legacy = createSqliteProjectRepository(filePath);
		await legacy.insert(nonTrivialStateSemMarcos());
		legacy.close();

		const raw = new Database(filePath);
		raw.exec('DROP TABLE milestone_work_item; DROP TABLE milestone;');
		raw.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		// o projeto pré-corte continua legível e nasce sem nenhum marco —
		// nada é sintetizado a partir do Answer legado marcos_principais.
		const loaded = await repo.findById('proj-1');
		expect(loaded?.milestones).toEqual([]);
		expect(loaded?.milestoneWorkItems).toEqual([]);

		// e as tabelas novas passam a aceitar escrita normalmente
		if (!loaded) throw new Error('esperado estado');
		let next = unwrap(addMilestone(catalog, loaded, 'ms-1', 'Fluxo ponta a ponta', T2));
		next = unwrap(linkWorkItemToMilestone(catalog, next, 'mwi-1', 'ms-1', 'wi-1', T2));
		await repo.save(next);

		await expect(repo.findById('proj-1')).resolves.toEqual(next);
	});

	it('round-trip preserva marco alcançado com trabalho relacionado ainda aberto', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);

		const found = await repo.findById('proj-1');
		expect(found).toEqual(state);
		// o marco alcançado tem um trabalho relacionado que NÃO está concluído —
		// estado legítimo que a persistência não pode recusar nem "corrigir".
		const reached = found?.milestones.find((milestone) => milestone.status === 'alcancado');
		expect(reached?.reachedAt).toBe(T2);
		const relatedIds = found?.milestoneWorkItems
			.filter((link) => link.milestoneId === reached?.id)
			.map((link) => link.workItemId);
		expect(relatedIds).toContain('wi-2');
		expect(found?.workItems.find((item) => item.id === 'wi-2')?.status).not.toBe('concluido');
	});

	it('a CONSTRAINT nomeada recusa o par (status, reached_at) inconsistente', async () => {
		const filePath = tempFilePath();
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		await repo.insert(createInitialProjectState(catalog, 'proj-1', T1));

		const raw = new Database(filePath);
		try {
			expect(() =>
				raw
					.prepare(
						`INSERT INTO milestone (id, project_id, title, status, reached_at, created_at, updated_at)
						 VALUES (?, ?, ?, ?, ?, ?, ?)`
					)
					.run('ms-x', 'proj-1', 'Marco', 'alcancado', null, T1, T1)
			).toThrow(/milestone_reached_at_matches_status/);
			expect(() =>
				raw
					.prepare(
						`INSERT INTO milestone (id, project_id, title, status, reached_at, created_at, updated_at)
						 VALUES (?, ?, ?, ?, ?, ?, ?)`
					)
					.run('ms-y', 'proj-1', 'Marco', 'aberto', T2, T1, T1)
			).toThrow(/milestone_reached_at_matches_status/);
		} finally {
			raw.close();
		}
	});

	// Data planejada (microcorte de Timeline) — o risco concreto aqui é de
	// UPGRADE de COLUNA: bancos criados antes deste corte (inclusive os criados
	// entre o corte de Milestone e este) têm a tabela milestone sem
	// planned_date, e `CREATE TABLE IF NOT EXISTS` é no-op neles.
	it('abre um banco cuja tabela milestone não tem planned_date, sem sintetizar data, e volta a aceitar escrita', async () => {
		const filePath = tempFilePath();

		const legacy = createSqliteProjectRepository(filePath);
		await legacy.insert(nonTrivialStateSemMarcos());
		legacy.close();

		// Reconstrói milestone/milestone_work_item na forma anterior a este
		// corte (sem planned_date) e grava um marco "antigo" direto no SQL —
		// DROP COLUMN não serve aqui porque a coluna participa de uma CHECK.
		const raw = new Database(filePath);
		raw.exec('DROP TABLE milestone_work_item; DROP TABLE milestone;');
		raw.exec(
			`CREATE TABLE milestone (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
				title TEXT NOT NULL,
				status TEXT NOT NULL,
				reached_at TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				CONSTRAINT milestone_status_values CHECK (status IN ('aberto', 'alcancado'))
			);
			CREATE TABLE milestone_work_item (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
				milestone_id TEXT NOT NULL REFERENCES milestone (id),
				work_item_id TEXT NOT NULL REFERENCES work_item (id),
				created_at TEXT NOT NULL,
				CONSTRAINT milestone_work_item_unique_pair UNIQUE (milestone_id, work_item_id)
			);`
		);
		raw
			.prepare(
				`INSERT INTO milestone (id, project_id, title, status, reached_at, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.run('ms-legacy', 'proj-1', 'Marco antigo', 'aberto', null, T1, T1);
		raw.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		// O marco pré-coluna continua válido e simplesmente não tem data: nada
		// é sintetizado a partir de created_at nem de texto livre legado.
		const loaded = await repo.findById('proj-1');
		expect(loaded?.milestones).toEqual([
			{
				id: 'ms-legacy',
				projectId: 'proj-1',
				title: 'Marco antigo',
				status: 'aberto',
				reachedAt: null,
				plannedDate: null,
				createdAt: T1,
				updatedAt: T1
			}
		]);

		if (!loaded) throw new Error('esperado estado');
		const next = unwrap(setMilestonePlannedDate(catalog, loaded, 'ms-legacy', '2026-09-01', T2));
		await repo.save(next);
		await expect(repo.findById('proj-1')).resolves.toEqual(next);
	});

	it('round-trip preserva a data planejada exatamente como dia civil, sem deslocamento', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);

		const found = await repo.findById('proj-1');
		expect(found?.milestones.find((milestone) => milestone.id === 'ms-2')?.plannedDate).toBe('2026-09-01');
		expect(found?.milestones.find((milestone) => milestone.id === 'ms-1')?.plannedDate).toBeNull();
	});

	// Honestamente só defesa de FORMATO: recusa timestamp e formato local, mas
	// não valida calendário (2026-02-30 passaria aqui). A validade real vive em
	// isCivilDate, coberta em domain/civil-date.spec.ts — nenhuma segunda
	// implementação da regra existe no schema.
	it('a CONSTRAINT de formato recusa planned_date que não tem o shape de data civil', async () => {
		const filePath = tempFilePath();
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		await repo.insert(createInitialProjectState(catalog, 'proj-1', T1));

		const raw = new Database(filePath);
		try {
			for (const invalid of ['2026-09-01T00:00:00.000Z', '01/09/2026', '2026-9-1']) {
				expect(() =>
					raw
						.prepare(
							`INSERT INTO milestone (id, project_id, title, status, reached_at, planned_date, created_at, updated_at)
							 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
						)
						.run('ms-x', 'proj-1', 'Marco', 'aberto', null, invalid, T1, T1)
				).toThrow(/milestone_planned_date_format/);
			}
		} finally {
			raw.close();
		}
	});

	// A UNIQUE continua NOMEADA no schema (D038 exige nome para permitir
	// ALTER TABLE ... DROP CONSTRAINT), mas o SQLite reporta violação de UNIQUE
	// pelas colunas, não pelo nome — ao contrário de CHECK, testada acima pelo
	// nome. A asserção segue o que o motor realmente emite.
	it('a UNIQUE recusa o mesmo trabalho associado duas vezes ao mesmo marco', async () => {
		const filePath = tempFilePath();
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		await repo.insert(nonTrivialState());

		const raw = new Database(filePath);
		try {
			const existing = raw.prepare('SELECT milestone_id, work_item_id FROM milestone_work_item LIMIT 1').get() as {
				milestone_id: string;
				work_item_id: string;
			};
			expect(() =>
				raw
					.prepare(
						`INSERT INTO milestone_work_item (id, project_id, milestone_id, work_item_id, created_at)
						 VALUES (?, ?, ?, ?, ?)`
					)
					.run('mwi-dup', 'proj-1', existing.milestone_id, existing.work_item_id, T2)
			).toThrow(/UNIQUE constraint failed: milestone_work_item/);
		} finally {
			raw.close();
		}
	});
});

// Risco específico deste corte (ETAPA 9 do rework): deliverable é uma TABELA
// nova. `CREATE TABLE IF NOT EXISTS` cria a tabela vazia num banco já
// existente, e é exatamente isso que o contrato pede — coleção vazia, zero
// backfill, nenhum ScopeItem promovido pela abertura. Ao contrário de
// current_treatment/cause_exploration (1:1 com project, que exigiram
// ensureX), aqui NÃO existe linha a inventar.
describe('createSqliteProjectRepository — Deliverable (ETAPA 9 do rework)', () => {
	it('abre um banco pré-S9 (sem a tabela deliverable) com coleção vazia, sem promover nenhum ScopeItem', async () => {
		const filePath = tempFilePath();

		// Fixture construída rebaixando um banco válido: o projeto já tem
		// ScopeItems e uma ScopeVersion confirmada, e a tabela deliverable é
		// removida para simular o estado anterior a este corte.
		const seed = createSqliteProjectRepository(filePath);
		const state = nonTrivialState();
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(filePath);
		legacyDb.exec('DROP TABLE deliverable');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const restored = await repo.findById('proj-1');
		expect(restored).not.toBeNull();
		expect(restored?.deliverables).toEqual([]);
		// O escopo continua exatamente como estava — nada foi convertido.
		expect(restored?.scopeItems).toEqual(state.scopeItems);
		expect(restored?.scopeVersion).toEqual(state.scopeVersion);
	});

	it('round-trip preserva entregas nativas e promovidas, com bucket/effort/order e proveniência', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addDeliverable(catalog, state, 'del-nativa', 'Portal', 'agora', T2));
		state = unwrap(setDeliverableEffort(catalog, state, 'del-nativa', 'grande', T2));
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'del-promovida', 'scope-1', T2));
		state = unwrap(addDeliverable(catalog, state, 'del-fora', 'Relatórios', 'fora', T2));

		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('proveniência órfã sobrevive: remover o ScopeItem de origem não remove nem altera a entrega', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(promoteScopeItemToDeliverable(catalog, state, 'del-1', 'scope-1', T2));
		await repo.insert(state);

		const promoted = state.deliverables[0];
		state = unwrap(removeScopeItem(catalog, state, 'scope-1'));
		await repo.save(state);

		const restored = await repo.findById('proj-1');
		expect(restored?.deliverables).toEqual([promoted]);
		expect(restored?.scopeItems.some((item) => item.id === 'scope-1')).toBe(false);
	});

	it('o schema recusa duas entregas com a mesma origem (índice único parcial)', async () => {
		const repo = memoryRepo();
		const state = nonTrivialState();
		await repo.insert(state);

		const duplicated: ProjectState = {
			...state,
			deliverables: [
				{
					id: 'del-1',
					projectId: 'proj-1',
					title: 'A',
					bucket: 'depois',
					effort: null,
					order: null,
					sourceScopeItemId: 'scope-1',
					createdAt: T2,
					updatedAt: T2
				},
				{
					id: 'del-2',
					projectId: 'proj-1',
					title: 'B',
					bucket: 'depois',
					effort: null,
					order: null,
					sourceScopeItemId: 'scope-1',
					createdAt: T2,
					updatedAt: T2
				}
			]
		};

		await expect(repo.save(duplicated)).rejects.toThrow();
		// Rollback atômico: o estado anterior continua íntegro.
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});
});

describe('createSqliteProjectRepository — WorkItem.deliverableId (ETAPA 9, segundo microcorte)', () => {
	it('abre um banco pós-D043 sem a coluna deliverable_id, adiciona-a de forma idempotente, e WorkItems existentes ficam desassociados', async () => {
		const filePath = tempFilePath();

		// Fixture construída rebaixando um banco válido (mesmo espírito do teste
		// de deliverable acima): o projeto já tem WorkItems, e a coluna
		// deliverable_id — introduzida só neste corte — é removida para simular
		// o estado do primeiro microcorte de Deliverable (D043), quando
		// work_item ainda não tinha nenhuma relação com ela.
		const seed = createSqliteProjectRepository(filePath);
		let state = nonTrivialState();
		state = unwrap(addWorkItem(catalog, state, 'wi-legacy', 'Item pré-existente', T1));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(filePath);
		// O índice criado por ensureWorkItemDeliverableIdColumn referencia a
		// coluna — precisa ser removido antes, senão DROP COLUMN falha.
		legacyDb.exec('DROP INDEX idx_work_item_deliverable_id');
		legacyDb.exec('ALTER TABLE work_item DROP COLUMN deliverable_id');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const restored = await repo.findById('proj-1');
		const legacyItem = restored?.workItems.find((item) => item.id === 'wi-legacy');
		expect(legacyItem?.deliverableId).toBeNull();

		// Reabrir de novo não falha nem duplica a coluna/índice.
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.not.toBeNull();
	});

	it('round-trip preserva a associação WorkItem → Deliverable', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addDeliverable(catalog, state, 'del-1', 'Portal', 'agora', T2));
		state = unwrap(addWorkItem(catalog, state, 'wi-new', 'Tarefa', T2, 'del-1'));

		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('remover a Deliverable persiste o WorkItem sobrevivente e desassociado', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addDeliverable(catalog, state, 'del-1', 'Portal', 'agora', T2));
		state = unwrap(addWorkItem(catalog, state, 'wi-new', 'Tarefa', T2, 'del-1'));
		await repo.insert(state);

		state = unwrap(removeDeliverable(catalog, state, 'del-1', T2));
		await repo.save(state);

		const restored = await repo.findById('proj-1');
		expect(restored?.deliverables).toHaveLength(0);
		expect(restored?.workItems.find((item) => item.id === 'wi-1')?.deliverableId).toBeNull();
	});

	it('associar/desassociar via setWorkItemDeliverable persiste corretamente', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addDeliverable(catalog, state, 'del-1', 'Portal', 'agora', T2));
		state = unwrap(addWorkItem(catalog, state, 'wi-new', 'Tarefa', T2));
		await repo.insert(state);

		state = unwrap(setWorkItemDeliverable(catalog, state, 'wi-new', 'del-1', T2));
		await repo.save(state);
		let restored = await repo.findById('proj-1');
		expect(restored?.workItems.find((item) => item.id === 'wi-new')?.deliverableId).toBe('del-1');

		state = unwrap(setWorkItemDeliverable(catalog, state, 'wi-new', null, T2));
		await repo.save(state);
		restored = await repo.findById('proj-1');
		expect(restored?.workItems.find((item) => item.id === 'wi-new')?.deliverableId).toBeNull();
	});
});

// WorkItem.plannedStart/durationDays (ETAPA 12 do rework, "Scheduling e
// Gantt", §42, primeiro microcorte fundacional) — mesmo molde de
// Risk.reviewedAt/likelihood/impact: colunas novas na mesma tabela,
// já existente desde a ETAPA 6.
describe('createSqliteProjectRepository — WorkItem.plannedStart/durationDays (ETAPA 12 do rework, §42)', () => {
	it('round-trip preserva o schedule definido, alterado e limpo', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addWorkItem(catalog, state, 'wi-new', 'Tarefa', T2));
		await repo.insert(state);

		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-new', '2026-09-12', 3, T2));
		await repo.save(state);
		let restored = await repo.findById('proj-1');
		expect(restored?.workItems.find((item) => item.id === 'wi-new')).toMatchObject({
			plannedStart: '2026-09-12',
			durationDays: 3
		});

		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-new', null, null, T2));
		await repo.save(state);
		restored = await repo.findById('proj-1');
		expect(restored?.workItems.find((item) => item.id === 'wi-new')).toMatchObject({
			plannedStart: null,
			durationDays: null
		});
	});

	// planned_start/duration_days participam de CHECK — DROP COLUMN não serve
	// aqui (mesma razão do teste de milestone.planned_date acima): recria
	// work_item na forma anterior a este corte e grava um WorkItem "antigo"
	// direto no SQL, isolado (sem dependency/impediment/milestone_work_item
	// apontando para ele, então recriar a tabela é seguro).
	it('abre um banco cuja tabela work_item não tem planned_start/duration_days, sem sintetizar schedule, e volta a aceitar escrita', async () => {
		const filePath = tempFilePath();

		const seed = createSqliteProjectRepository(filePath);
		await seed.insert(createInitialProjectState(catalog, 'proj-1', T1));
		seed.close();

		const raw = new Database(filePath);
		raw.exec('DROP TABLE work_item;');
		raw.exec(
			`CREATE TABLE work_item (
				id TEXT PRIMARY KEY,
				project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
				title TEXT NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('a_fazer', 'em_andamento', 'concluido')),
				deliverable_id TEXT REFERENCES deliverable (id),
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);`
		);
		raw
			.prepare(
				`INSERT INTO work_item (id, project_id, title, status, deliverable_id, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.run('wi-legacy', 'proj-1', 'Item pré-existente', 'a_fazer', null, T1, T1);
		raw.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		// O WorkItem pré-coluna continua válido e simplesmente não tem schedule:
		// nada é sintetizado de created_at nem de nenhum outro dado.
		const loaded = await repo.findById('proj-1');
		expect(loaded?.workItems).toEqual([
			{
				id: 'wi-legacy',
				projectId: 'proj-1',
				title: 'Item pré-existente',
				status: 'a_fazer',
				deliverableId: null,
				plannedStart: null,
				durationDays: null,
				createdAt: T1,
				updatedAt: T1
			}
		]);

		if (!loaded) throw new Error('esperado estado');
		const next = unwrap(setWorkItemSchedule(catalog, loaded, 'wi-legacy', '2026-09-12', 3, T2));
		await repo.save(next);
		await expect(repo.findById('proj-1')).resolves.toEqual(next);

		// Reabrir de novo não falha nem duplica as colunas.
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.not.toBeNull();
	});

	// A CHECK nomeada work_item_schedule_pair (0001_init.sql) só existe na
	// tabela criada por CREATE TABLE IF NOT EXISTS — mesmo caso de
	// risk_assessment_pair (D051): um banco pré-existente que já tinha a
	// tabela `work_item` (sem essa CHECK) recebe as duas colunas novas só via
	// ALTER TABLE ADD COLUMN (ensureWorkItemScheduleColumns), e cada ALTER só
	// pode carregar uma CHECK referenciando a própria coluna nova — nunca uma
	// CHECK cruzando as duas. Falsificação explícita: a invariante do par
	// (plannedStart/durationDays ambos null ou ambos preenchidos) NÃO é
	// protegida pelo SQLite num banco upgradeado — só pelo domínio
	// (setWorkItemSchedule) e pela desserialização (validateInvariants).
	// Reconstruir a tabela inteira só para ganhar essa CHECK em bancos antigos
	// seria migration machinery nova por simetria cosmética, não exigida pelo
	// contrato deste corte.
	it('a CHECK do par plannedStart/durationDays não protege um banco upgradeado (só o criado do zero)', async () => {
		const upgradedPath = tempFilePath();
		const seed = createSqliteProjectRepository(upgradedPath);
		// Estado isolado (sem dependency/impediment/milestone_work_item
		// apontando para o WorkItem): DROP TABLE work_item abaixo falharia por
		// violação de FK (foreign_keys = ON) se algum outro registro
		// referenciasse esta linha.
		let state = createInitialProjectState(catalog, 'proj-1', T1);
		state = unwrap(addWorkItem(catalog, state, 'wi-sched-1', 'Tarefa', T1));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(upgradedPath);
		legacyDb.exec(
			`CREATE TABLE work_item_legacy AS
			   SELECT id, project_id, title, status, deliverable_id, created_at, updated_at FROM work_item;
			 DROP TABLE work_item;
			 ALTER TABLE work_item_legacy RENAME TO work_item;`
		);
		legacyDb.close();

		// Abrir e fechar o repositório roda ensureWorkItemScheduleColumns na
		// construção — as duas colunas já existem depois disto, sem CHECK
		// cruzada nenhuma sobre elas. Fechado antes de abrir uma conexão raw
		// própria para evitar duas conexões concorrentes no mesmo arquivo.
		const upgraded = createSqliteProjectRepository(upgradedPath);
		upgraded.close();

		const upgradedDb = new Database(upgradedPath);
		expect(() =>
			upgradedDb.prepare('UPDATE work_item SET planned_start = ? WHERE id = ?').run('2026-09-12', 'wi-sched-1')
		).not.toThrow();
		upgradedDb.close();

		// No mesmo cenário, um banco criado do zero por este corte tem a CHECK
		// e recusa a mesma escrita parcial.
		const freshPath = tempFilePath();
		const fresh = createSqliteProjectRepository(freshPath);
		let freshState = nonTrivialState();
		freshState = unwrap(addWorkItem(catalog, freshState, 'wi-sched-1', 'Tarefa', T1));
		await fresh.insert(freshState);
		fresh.close();

		const freshDb = new Database(freshPath);
		expect(() =>
			freshDb.prepare('UPDATE work_item SET planned_start = ? WHERE id = ?').run('2026-09-12', 'wi-sched-1')
		).toThrow(/work_item_schedule_pair/);
		freshDb.close();
	});
});

// ScheduleBaseline (ETAPA 12 do rework, §42, quinto microcorte, hardening
// pós-dogfood) — tabelas NOVAS (schedule_baseline/schedule_baseline_entry),
// mesmo molde de decision_affected_work_item: o risco concreto é de
// UPGRADE (banco anterior a este corte não tem as tabelas), não de coluna
// nova em tabela existente — CREATE TABLE IF NOT EXISTS sozinho já basta,
// sem ensureX nenhum. schedule_baseline_entry.planned_start/duration_days
// são NULLABLE (membership: toda captura registra uma entry por WorkItem
// existente, com ou sem schedule) — round-trip precisa provar os dois.
describe('createSqliteProjectRepository — ScheduleBaseline (ETAPA 12 do rework, §42, quinto microcorte, hardening pós-dogfood)', () => {
	function captureWithFreshPreview(state: ProjectState, baselineId: string, occurredAt: string): ProjectState {
		const preview = unwrap(previewScheduleBaselineCapture(state));
		return unwrap(captureScheduleBaseline(catalog, state, baselineId, { entries: preview.entries }, occurredAt));
	}

	it('round-trip preserva baseline e entradas (inclusive null/null), rebaseline com version crescente', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addWorkItem(catalog, state, 'wi-new', 'Tarefa', T2));
		state = unwrap(addWorkItem(catalog, state, 'wi-sem-schedule', 'Sem cronograma', T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-new', '2026-09-12', 3, T2));
		await repo.insert(state);

		state = captureWithFreshPreview(state, 'baseline-1', T2);
		await repo.save(state);
		let restored = await repo.findById('proj-1');
		expect(restored?.scheduleBaselines).toEqual(state.scheduleBaselines);
		expect(restored?.scheduleBaselineEntries).toEqual(state.scheduleBaselineEntries);
		expect(restored?.scheduleBaselineEntries).toContainEqual({
			baselineId: 'baseline-1',
			workItemId: 'wi-sem-schedule',
			plannedStart: null,
			durationDays: null
		});

		// Rebaseline: segunda captura ADICIONA, nunca sobrescreve a primeira,
		// com version estritamente crescente.
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-new', '2026-09-14', 3, T2));
		state = captureWithFreshPreview(state, 'baseline-2', T2);
		await repo.save(state);
		restored = await repo.findById('proj-1');
		expect(restored?.scheduleBaselines.map((b) => ({ id: b.id, version: b.version }))).toEqual([
			{ id: 'baseline-1', version: 1 },
			{ id: 'baseline-2', version: 2 }
		]);
		expect(restored?.scheduleBaselineEntries).toEqual(state.scheduleBaselineEntries);
	});

	it('banco anterior a este corte (sem as tabelas schedule_baseline/schedule_baseline_entry) abre e importa como coleções vazias, e volta a aceitar escrita', async () => {
		const filePath = tempFilePath();
		const seed = createSqliteProjectRepository(filePath);
		let state = nonTrivialState();
		state = unwrap(addWorkItem(catalog, state, 'wi-new', 'Tarefa', T2));
		state = unwrap(setWorkItemSchedule(catalog, state, 'wi-new', '2026-09-12', 3, T2));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(filePath);
		legacyDb.exec('DROP TABLE schedule_baseline_entry; DROP TABLE schedule_baseline;');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		const loaded = await repo.findById('proj-1');
		expect(loaded?.scheduleBaselines).toEqual([]);
		expect(loaded?.scheduleBaselineEntries).toEqual([]);

		if (!loaded) throw new Error('esperado estado');
		const next = captureWithFreshPreview(loaded, 'baseline-1', T2);
		await repo.save(next);
		await expect(repo.findById('proj-1')).resolves.toEqual(next);

		// Reabrir de novo não falha nem duplica as tabelas.
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.not.toBeNull();
	});
});

describe('createSqliteProjectRepository — Risk.reviewedAt (ETAPA 10 do rework, segundo microcorte)', () => {
	it('round-trip preserva reviewedAt', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addRisk(catalog, state, 'risk-1', 'Risco', T1));
		state = unwrap(reviewRisk(catalog, state, 'risk-1', T2));

		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('abre um banco pós-D049 sem a coluna reviewed_at, adiciona-a de forma idempotente, e Risks existentes ficam com reviewedAt null', async () => {
		const filePath = tempFilePath();

		// Fixture construída rebaixando um banco válido (mesmo espírito do teste
		// de WorkItem.deliverableId acima): o projeto já tem um Risk, e a coluna
		// reviewed_at — introduzida só neste corte — é removida para simular o
		// estado do primeiro microcorte de Risk (D049), quando a tabela ainda
		// não tinha nenhuma noção de revisão.
		const seed = createSqliteProjectRepository(filePath);
		let state = nonTrivialState();
		state = unwrap(addRisk(catalog, state, 'risk-legacy', 'Risco pré-existente', T1));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(filePath);
		legacyDb.exec('ALTER TABLE risk DROP COLUMN reviewed_at');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const restored = await repo.findById('proj-1');
		const legacyRisk = restored?.risks.find((risk) => risk.id === 'risk-legacy');
		expect(legacyRisk).toMatchObject({ statement: 'Risco pré-existente', status: 'aberto', reviewedAt: null });

		// Reabrir de novo não falha nem duplica a coluna.
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.not.toBeNull();
	});
});

describe('createSqliteProjectRepository — Risk.likelihood/impact/response (ETAPA 10 do rework, terceiro microcorte)', () => {
	it('round-trip preserva avaliação e resposta', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addRisk(catalog, state, 'risk-1', 'Risco', T1));
		state = unwrap(setRiskAssessment(catalog, state, 'risk-1', 'alta', 'alto', T2));
		state = unwrap(setRiskResponse(catalog, state, 'risk-1', 'Plano de resposta', T2));

		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('abre um banco pós-D050 sem as colunas likelihood/impact/response, adiciona-as de forma idempotente, e Risks existentes ficam sem avaliação/resposta', async () => {
		const filePath = tempFilePath();

		// Mesmo espírito do teste de reviewed_at acima: o projeto já tem um Risk
		// com lifecycle e reviewedAt reais (não só os valores de nascimento), e
		// as três colunas — introduzidas só neste corte — são removidas para
		// simular o estado do segundo microcorte de Risk (D050).
		const seed = createSqliteProjectRepository(filePath);
		let state = nonTrivialState();
		state = unwrap(addRisk(catalog, state, 'risk-legacy', 'Risco pré-existente', T1));
		state = unwrap(reviewRisk(catalog, state, 'risk-legacy', T2));
		await seed.insert(state);
		seed.close();

		// DROP COLUMN direto falha aqui: likelihood/impact participam de CHECK
		// constraints da tabela atual, e SQLite recusa remover uma coluna
		// referenciada por CHECK. Reconstruir a tabela sem essas colunas (e sem
		// as constraints, como a tabela real era antes deste corte) simula o
		// schema pós-D050 fielmente.
		const legacyDb = new Database(filePath);
		legacyDb.exec(
			`CREATE TABLE risk_legacy AS
			   SELECT id, project_id, statement, status, closed_at, reviewed_at, created_at, updated_at FROM risk;
			 DROP TABLE risk;
			 ALTER TABLE risk_legacy RENAME TO risk;`
		);
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const restored = await repo.findById('proj-1');
		const legacyRisk = restored?.risks.find((risk) => risk.id === 'risk-legacy');
		// Lifecycle/reviewedAt (fatos já existentes antes deste corte) chegam
		// intactos; nenhuma Answer legada (riscos_identificados/
		// resposta_inicial_riscos/riscos_atualizados) é lida nem interpretada
		// para preencher os campos novos — eles nascem null, nunca sintetizados.
		expect(legacyRisk).toEqual({
			id: 'risk-legacy',
			projectId: 'proj-1',
			statement: 'Risco pré-existente',
			status: 'aberto',
			closedAt: null,
			reviewedAt: T2,
			likelihood: null,
			impact: null,
			response: null,
			createdAt: T1,
			updatedAt: T2
		});

		// Reabrir de novo não falha, não duplica as colunas, e não altera nada.
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		const restoredAgain = await repo2.findById('proj-1');
		expect(restoredAgain?.risks.find((risk) => risk.id === 'risk-legacy')).toEqual(legacyRisk);
	});

	// A CHECK nomeada risk_assessment_pair (0001_init.sql) só existe na tabela
	// criada por CREATE TABLE IF NOT EXISTS — um banco pré-existente que já
	// tinha a tabela `risk` (sem essa CHECK) recebe as três colunas novas só
	// via ALTER TABLE ADD COLUMN (ensureRiskAssessmentAndResponseColumns), e
	// SQLite não permite anexar uma CHECK a uma tabela existente por ALTER
	// TABLE. Falsificação explícita: a invariante do par (likelihood/impact
	// ambos null ou ambos preenchidos) NÃO é protegida pelo SQLite num banco
	// upgradeado — só pelo domínio (setRiskAssessment) e pela desserialização
	// (validateInvariants). Reconstruir a tabela inteira só para ganhar essa
	// CHECK em bancos antigos seria migration machinery nova por simetria
	// cosmética, não exigida pelo contrato deste corte.
	it('a CHECK do par likelihood/impact não protege um banco upgradeado (só a criado do zero)', async () => {
		const upgradedPath = tempFilePath();
		const seed = createSqliteProjectRepository(upgradedPath);
		let state = nonTrivialState();
		state = unwrap(addRisk(catalog, state, 'risk-1', 'Risco', T1));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(upgradedPath);
		legacyDb.exec(
			`CREATE TABLE risk_legacy AS
			   SELECT id, project_id, statement, status, closed_at, reviewed_at, created_at, updated_at FROM risk;
			 DROP TABLE risk;
			 ALTER TABLE risk_legacy RENAME TO risk;`
		);
		legacyDb.close();

		// Abrir e fechar o repositório roda ensureRiskAssessmentAndResponseColumns
		// na construção — as três colunas já existem depois disto, sem CHECK
		// nenhuma sobre elas. Fechado antes de abrir uma conexão raw própria
		// para evitar duas conexões concorrentes no mesmo arquivo.
		const upgraded = createSqliteProjectRepository(upgradedPath);
		upgraded.close();

		const upgradedDb = new Database(upgradedPath);
		expect(() =>
			upgradedDb.prepare('UPDATE risk SET likelihood = ? WHERE id = ?').run('alta', 'risk-1')
		).not.toThrow();
		upgradedDb.close();

		// No mesmo cenário, um banco criado do zero por este corte tem a CHECK
		// e recusa a mesma escrita parcial.
		const freshPath = tempFilePath();
		const fresh = createSqliteProjectRepository(freshPath);
		let freshState = nonTrivialState();
		freshState = unwrap(addRisk(catalog, freshState, 'risk-1', 'Risco', T1));
		await fresh.insert(freshState);
		fresh.close();

		const freshDb = new Database(freshPath);
		expect(() =>
			freshDb.prepare('UPDATE risk SET likelihood = ? WHERE id = ?').run('alta', 'risk-1')
		).toThrow(/risk_assessment_pair/);
		freshDb.close();
	});
});

describe('createSqliteProjectRepository — Decision/Change (ETAPA 11 do rework, primeiro microcorte, §41)', () => {
	it('round-trip preserva Decision pendente e tomada, e Change com/sem impacto', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		state = unwrap(editDecision(catalog, state, 'dec-1', 'Adiar o SMS?', 'A ou B', '2026-02-01', 'Ana', T1));
		state = unwrap(addDecision(catalog, state, 'dec-2', 'Trocar de fornecedor?', T1));
		state = unwrap(decideDecision(catalog, state, 'dec-2', 'Mantido o atual', T2));
		state = unwrap(addChange(catalog, state, 'chg-1', 'Trocou o fornecedor de e-mail', T1));
		state = unwrap(setChangeImpact(catalog, state, 'chg-1', 'Atraso de 2 dias', T2));
		state = unwrap(addChange(catalog, state, 'chg-2', 'Mudou o escopo do MVP', T1));

		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('a CHECK decision_outcome_matches_status recusa escrita direta que viole o par status/outcome/decidedAt', async () => {
		const filePath = tempFilePath();
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		let state = nonTrivialState();
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Adiar o SMS?', T1));
		await repo.insert(state);

		const rawDb = new Database(filePath);
		expect(() =>
			rawDb.prepare("UPDATE decision SET status = 'tomada' WHERE id = ?").run('dec-1')
		).toThrow(/decision_outcome_matches_status/);
		rawDb.close();
	});

	it('banco anterior a este corte (sem as tabelas decision/change) abre e importa como coleções vazias', async () => {
		const filePath = tempFilePath();
		const seed = createSqliteProjectRepository(filePath);
		await seed.insert(createInitialProjectState(catalog, 'proj-1', T1));
		seed.close();

		const legacyDb = new Database(filePath);
		legacyDb.exec('DROP TABLE decision; DROP TABLE change;');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		const restored = await repo.findById('proj-1');
		expect(restored?.decisions).toEqual([]);
		expect(restored?.changes).toEqual([]);
	});

	it('abre um banco anterior a este corte (sem a coluna responsible), adiciona-a de forma idempotente, e Decisions existentes ficam com responsible null', async () => {
		const filePath = tempFilePath();

		const seed = createSqliteProjectRepository(filePath);
		let state = nonTrivialState();
		state = unwrap(addDecision(catalog, state, 'dec-legacy', 'Decisão anterior a este corte', T1));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(filePath);
		legacyDb.exec('ALTER TABLE decision DROP COLUMN responsible');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const restored = await repo.findById('proj-1');
		const legacyDecision = restored?.decisions.find((decision) => decision.id === 'dec-legacy');
		expect(legacyDecision?.responsible).toBeNull();

		// Reabrir de novo não falha nem duplica a coluna.
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.not.toBeNull();
	});
});

describe('createSqliteProjectRepository — Impediment.decisionId (ETAPA 11 do rework, segundo microcorte, §41/§13.4)', () => {
	it('round-trip preserva a associação Impediment → Decision', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addImpediment(catalog, state, 'imp-new', 'Aguardando decisão', 'decisao_pendente', T2));
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T2));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-new', 'dec-1', T2));

		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('associar/trocar/desassociar via setImpedimentDecision persiste corretamente', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addImpediment(catalog, state, 'imp-new', 'Aguardando decisão', 'decisao_pendente', T2));
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T2));
		state = unwrap(addDecision(catalog, state, 'dec-2', 'Qual data?', T2));
		await repo.insert(state);

		state = unwrap(setImpedimentDecision(catalog, state, 'imp-new', 'dec-1', T2));
		await repo.save(state);
		let restored = await repo.findById('proj-1');
		expect(restored?.impediments.find((item) => item.id === 'imp-new')?.decisionId).toBe('dec-1');

		state = unwrap(setImpedimentDecision(catalog, state, 'imp-new', 'dec-2', T2));
		await repo.save(state);
		restored = await repo.findById('proj-1');
		expect(restored?.impediments.find((item) => item.id === 'imp-new')?.decisionId).toBe('dec-2');

		state = unwrap(setImpedimentDecision(catalog, state, 'imp-new', null, T2));
		await repo.save(state);
		restored = await repo.findById('proj-1');
		expect(restored?.impediments.find((item) => item.id === 'imp-new')?.decisionId).toBeNull();
	});

	it('resolver/reabrir o Impediment preserva decisionId, e a Decision permanece intocada', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addImpediment(catalog, state, 'imp-new', 'Aguardando decisão', 'decisao_pendente', T2));
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T2));
		state = unwrap(setImpedimentDecision(catalog, state, 'imp-new', 'dec-1', T2));
		await repo.insert(state);

		state = unwrap(resolveImpediment(catalog, state, 'imp-new', T2));
		await repo.save(state);
		let restored = await repo.findById('proj-1');
		expect(restored?.impediments.find((item) => item.id === 'imp-new')?.decisionId).toBe('dec-1');
		expect(restored?.decisions.find((decision) => decision.id === 'dec-1')?.status).toBe('pendente');

		state = unwrap(reopenImpediment(catalog, state, 'imp-new', T2));
		await repo.save(state);
		restored = await repo.findById('proj-1');
		expect(restored?.impediments.find((item) => item.id === 'imp-new')?.decisionId).toBe('dec-1');
	});

	it('abre um banco anterior a este corte (sem a coluna decision_id), adiciona-a de forma idempotente, e Impediments existentes ficam com decisionId null', async () => {
		const filePath = tempFilePath();

		// Fixture construída rebaixando um banco válido (mesmo espírito do teste
		// de WorkItem.deliverableId acima): o projeto já tem um Impediment
		// `decisao_pendente`, e a coluna decision_id — introduzida só neste
		// corte — é removida para simular o estado anterior a ele.
		const seed = createSqliteProjectRepository(filePath);
		let state = nonTrivialState();
		state = unwrap(addImpediment(catalog, state, 'imp-legacy', 'Aguardando decisão antiga', 'decisao_pendente', T1));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(filePath);
		// O índice criado por ensureImpedimentDecisionIdColumn referencia a
		// coluna — precisa ser removido antes, senão DROP COLUMN falha.
		legacyDb.exec('DROP INDEX idx_impediment_decision_id');
		legacyDb.exec('ALTER TABLE impediment DROP COLUMN decision_id');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);

		const restored = await repo.findById('proj-1');
		const legacyImpediment = restored?.impediments.find((item) => item.id === 'imp-legacy');
		expect(legacyImpediment?.decisionId).toBeNull();

		// Reabrir de novo não falha nem duplica a coluna/índice.
		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.not.toBeNull();
	});
});

// DecisionAffectedWorkItem (ETAPA 11 do rework, terceiro microcorte, §41) —
// tabela nova, mesmo molde de milestone_work_item: o risco concreto aqui é
// de UPGRADE (banco anterior a este corte não tem a tabela), coberto por
// CREATE TABLE IF NOT EXISTS, sem coluna nova em tabela existente.
describe('createSqliteProjectRepository — DecisionAffectedWorkItem (ETAPA 11 do rework, terceiro microcorte, §41)', () => {
	it('round-trip preserva a associação N:N em ambos os sentidos', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T2));
		state = unwrap(addDecision(catalog, state, 'dec-2', 'Adiar o SMS?', T2));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-1', T2));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-2', 'dec-1', 'wi-2', T2));
		// mesmo WorkItem afetado por mais de uma Decision (N:N do outro lado).
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-3', 'dec-2', 'wi-1', T2));

		await repo.insert(state);
		await expect(repo.findById('proj-1')).resolves.toEqual(state);
	});

	it('a UNIQUE nomeada recusa o par (decision_id, work_item_id) duplicado em escrita direta', async () => {
		const filePath = tempFilePath();
		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		let state = nonTrivialState();
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T2));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-1', T2));
		await repo.insert(state);

		const rawDb = new Database(filePath);
		expect(() =>
			rawDb
				.prepare(
					`INSERT INTO decision_affected_work_item (id, project_id, decision_id, work_item_id, created_at)
					 VALUES (?, ?, ?, ?, ?)`
				)
				.run('dwi-2', 'proj-1', 'dec-1', 'wi-1', T2)
		).toThrow(/UNIQUE constraint failed: decision_affected_work_item/);
		rawDb.close();
	});

	it('remover a associação persiste corretamente, sem afetar Decision nem WorkItem', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T2));
		state = unwrap(linkWorkItemToDecision(catalog, state, 'dwi-1', 'dec-1', 'wi-1', T2));
		await repo.insert(state);

		state = unwrap(unlinkWorkItemFromDecision(catalog, state, 'dwi-1'));
		await repo.save(state);

		const restored = await repo.findById('proj-1');
		expect(restored?.decisionAffectedWorkItems).toEqual([]);
		expect(restored?.decisions.find((decision) => decision.id === 'dec-1')?.status).toBe('pendente');
		// wi-1 em nonTrivialState() já está 'em_andamento' — a associação/
		// desassociação com a Decision não pode ter mexido nisso.
		expect(restored?.workItems.find((item) => item.id === 'wi-1')?.status).toBe('em_andamento');
	});

	it('banco anterior a este corte (sem a tabela decision_affected_work_item) abre e importa como coleção vazia, e volta a aceitar escrita', async () => {
		const filePath = tempFilePath();
		const seed = createSqliteProjectRepository(filePath);
		let state = nonTrivialState();
		state = unwrap(addDecision(catalog, state, 'dec-1', 'Qual fornecedor?', T2));
		await seed.insert(state);
		seed.close();

		const legacyDb = new Database(filePath);
		legacyDb.exec('DROP TABLE decision_affected_work_item');
		legacyDb.close();

		const repo = createSqliteProjectRepository(filePath);
		openRepos.push(repo);
		const restored = await repo.findById('proj-1');
		expect(restored?.decisionAffectedWorkItems).toEqual([]);

		if (!restored) throw new Error('esperado estado');
		const next = unwrap(linkWorkItemToDecision(catalog, restored, 'dwi-1', 'dec-1', 'wi-1', T2));
		await repo.save(next);
		await expect(repo.findById('proj-1')).resolves.toEqual(next);
	});

	describe('DocumentSnapshot (ETAPA 15, D076/D077)', () => {
		const content: DocumentSnapshotContentV1 = {
			sections: [
				{
					phaseId: 'descoberta',
					phaseLabel: 'Descoberta',
					blocks: [
						{ activityId: 'origem', heading: 'Origem do projeto', value: 'Um problema', chips: ['a'] },
						{
							activityId: 'publico',
							heading: 'Público',
							value: 'Analistas',
							evidenceItems: [{ groupLabel: 'Analistas', outcomeLabel: 'Confirmado', learning: 'Sim' }]
						}
					]
				}
			]
		};

		async function seed(repo: SqliteProjectRepository) {
			const state = createInitialProjectState(catalog, 'proj-1', T1);
			await repo.insert(state);
			return state;
		}

		it('primeira captura cria v1 e a segunda cria v2; lista mais recente primeiro; find devolve o conteúdo', async () => {
			const repo = createSqliteProjectRepository(':memory:');
			openRepos.push(repo);
			await seed(repo);

			const first = await repo.insertDocumentSnapshot({ id: 's-1', projectId: 'proj-1', capturedAt: T1, content });
			const second = await repo.insertDocumentSnapshot({ id: 's-2', projectId: 'proj-1', capturedAt: T2, content });
			expect(first?.version).toBe(1);
			expect(second?.version).toBe(2);

			await expect(repo.listDocumentSnapshots('proj-1')).resolves.toEqual([
				{ id: 's-2', projectId: 'proj-1', version: 2, capturedAt: T2 },
				{ id: 's-1', projectId: 'proj-1', version: 1, capturedAt: T1 }
			]);
			await expect(repo.findDocumentSnapshot('proj-1', 1)).resolves.toEqual({
				id: 's-1',
				projectId: 'proj-1',
				version: 1,
				capturedAt: T1,
				content
			});
			await expect(repo.findDocumentSnapshot('proj-1', 3)).resolves.toBeNull();
		});

		it('projeto inexistente devolve null e não grava nada', async () => {
			const repo = createSqliteProjectRepository(':memory:');
			openRepos.push(repo);
			await expect(
				repo.insertDocumentSnapshot({ id: 's-1', projectId: 'nao-existe', capturedAt: T1, content })
			).resolves.toBeNull();
			await expect(repo.listDocumentSnapshots('nao-existe')).resolves.toEqual([]);
		});

		it('save() de mutações do projeto nunca altera o snapshot (linha byte-idêntica)', async () => {
			const filePath = tempFilePath();
			const repo = createSqliteProjectRepository(filePath);
			openRepos.push(repo);
			const state = await seed(repo);
			await repo.insertDocumentSnapshot({ id: 's-1', projectId: 'proj-1', capturedAt: T1, content });

			const raw = new Database(filePath);
			const before = raw.prepare('SELECT * FROM document_snapshot').all();

			await repo.save(unwrap(renameProject(catalog, state, 'Outro nome')));

			expect(raw.prepare('SELECT * FROM document_snapshot').all()).toEqual(before);
			raw.close();
		});

		it('UPDATE cru é rejeitado pelo trigger de imutabilidade; a linha continua intacta', async () => {
			const filePath = tempFilePath();
			const repo = createSqliteProjectRepository(filePath);
			openRepos.push(repo);
			await seed(repo);
			await repo.insertDocumentSnapshot({ id: 's-1', projectId: 'proj-1', capturedAt: T1, content });

			const raw = new Database(filePath);
			expect(() => raw.prepare("UPDATE document_snapshot SET content_json = '{}'").run()).toThrow(/imutável/);
			raw.close();
			await expect(repo.findDocumentSnapshot('proj-1', 1)).resolves.toMatchObject({ content });
		});

		it('UNIQUE(project_id, version) é a segunda barreira: INSERT cru com versão repetida falha', async () => {
			const filePath = tempFilePath();
			const repo = createSqliteProjectRepository(filePath);
			openRepos.push(repo);
			await seed(repo);
			await repo.insertDocumentSnapshot({ id: 's-1', projectId: 'proj-1', capturedAt: T1, content });

			const raw = new Database(filePath);
			expect(() =>
				raw
					.prepare(
						`INSERT INTO document_snapshot (id, project_id, version, captured_at, schema_version, content_json)
						 VALUES ('dup', 'proj-1', 1, ?, 1, '{"sections":[]}')`
					)
					.run(T2)
			).toThrow(/UNIQUE/);
			raw.close();
		});

		it('reabrir o banco preserva versões e conteúdo', async () => {
			const filePath = tempFilePath();
			const first = createSqliteProjectRepository(filePath);
			await seed(first);
			await first.insertDocumentSnapshot({ id: 's-1', projectId: 'proj-1', capturedAt: T1, content });
			first.close();

			const reopened = createSqliteProjectRepository(filePath);
			openRepos.push(reopened);
			await expect(reopened.findDocumentSnapshot('proj-1', 1)).resolves.toMatchObject({ version: 1, content });
			const next = await reopened.insertDocumentSnapshot({ id: 's-2', projectId: 'proj-1', capturedAt: T2, content });
			expect(next?.version).toBe(2);
		});

		it('schema_version desconhecida é rejeitada explicitamente na leitura', async () => {
			const filePath = tempFilePath();
			const repo = createSqliteProjectRepository(filePath);
			openRepos.push(repo);
			await seed(repo);
			const raw = new Database(filePath);
			raw
				.prepare(
					`INSERT INTO document_snapshot (id, project_id, version, captured_at, schema_version, content_json)
					 VALUES ('s-x', 'proj-1', 1, ?, 2, '{"sections":[]}')`
				)
				.run(T1);
			raw.close();
			await expect(repo.findDocumentSnapshot('proj-1', 1)).rejects.toThrow(DocumentSnapshotParseError);
		});

		it('banco REALMENTE pré-S15 (schema pré-S15 versionado + projeto existente) abre, recebe tabela/trigger, preserva o projeto e aceita v1', async () => {
			// 1) Projeto real gravado pelo repositório atual num banco descartável —
			// só fonte de linhas realistas.
			const seedPath = tempFilePath();
			const seedRepo = createSqliteProjectRepository(seedPath);
			const initial = createInitialProjectState(catalog, 'proj-1', T1);
			const state = unwrap(renameProject(catalog, initial, 'Projeto antigo'));
			await seedRepo.insert(initial);
			await seedRepo.save(state);
			seedRepo.close();

			// 2) Banco pré-S15: schema de 0001_init.sql exatamente como em 9bae129
			// (último commit antes da S15), versionado em fixtures/pre-s15-schema.sql
			// — sem depender de histórico Git, e não uma cópia editada do schema atual.
			const oldSql = fs.readFileSync(path.join(__dirname, 'fixtures', 'pre-s15-schema.sql'), 'utf8');
			expect(oldSql).not.toContain('document_snapshot');

			const legacyPath = tempFilePath();
			const legacy = new Database(legacyPath);
			legacy.exec(oldSql);
			legacy.exec(`ATTACH DATABASE '${seedPath.replace(/'/g, "''")}' AS seed`);
			const tableNames = (
				legacy
					.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
					.all() as { name: string }[]
			).map((row) => row.name);
			for (const name of tableNames) {
				const mainCols = (legacy.prepare(`PRAGMA main.table_info("${name}")`).all() as { name: string }[]).map(
					(c) => c.name
				);
				const seedCols = (legacy.prepare(`PRAGMA seed.table_info("${name}")`).all() as { name: string }[]).map(
					(c) => c.name
				);
				const shared = mainCols
					.filter((c) => seedCols.includes(c))
					.map((c) => `"${c}"`)
					.join(', ');
				legacy.exec(`INSERT INTO main."${name}" (${shared}) SELECT ${shared} FROM seed."${name}"`);
			}
			legacy.exec('DETACH DATABASE seed');
			expect(legacy.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'document_snapshot%'").all()).toEqual([]);
			legacy.close();

			// 3) Upgrade: abrir com o repositório atual.
			const repo = createSqliteProjectRepository(legacyPath);
			openRepos.push(repo);

			await expect(repo.findById('proj-1')).resolves.toEqual(state);
			const check = new Database(legacyPath);
			const objects = (
				check.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'document_snapshot%'").all() as {
					name: string;
				}[]
			).map((row) => row.name);
			check.close();
			expect(objects).toContain('document_snapshot');
			expect(objects).toContain('document_snapshot_immutable');

			const captured = await repo.insertDocumentSnapshot({ id: 's-1', projectId: 'proj-1', capturedAt: T2, content });
			expect(captured?.version).toBe(1);
			await expect(repo.findById('proj-1')).resolves.toEqual(state);
		});
	});
});


describe('createSqliteProjectRepository — DesiredOutcome.assessment (ETAPA 16, D080/D081)', () => {
	const STATES = ['alcancado', 'parcialmente_alcancado', 'nao_alcancado', 'ainda_nao_verificavel'] as const;

	it('round-trip preserva os quatro estados e null; reavaliar substitui a avaliação atual', async () => {
		const repo = memoryRepo();
		let state = nonTrivialState();
		expect(state.desiredOutcomes.length).toBeGreaterThanOrEqual(2);
		await repo.insert(state);
		const [first, second] = state.desiredOutcomes;
		expect((await repo.findById('proj-1'))?.desiredOutcomes.map((o) => o.assessment)).toEqual(
			state.desiredOutcomes.map(() => null)
		);

		for (const st of STATES) {
			state = unwrap(setDesiredOutcomeAssessment(catalog, state, first.id, st, `racional ${st}`, T2));
			await repo.save(state);
			await expect(repo.findById('proj-1')).resolves.toEqual(state);
		}
		const restored = await repo.findById('proj-1');
		expect(restored?.desiredOutcomes.find((o) => o.id === first.id)?.assessment?.state).toBe('ainda_nao_verificavel');
		expect(restored?.desiredOutcomes.find((o) => o.id === second.id)?.assessment).toBeNull();
	});

	it('fresh schema recusa bloco parcial, estado inválido e racional vazio (CHECK)', async () => {
		const filePath = tempFilePath();
		const repo = createSqliteProjectRepository(filePath);
		await repo.insert(nonTrivialState());
		repo.close();
		const db = new Database(filePath);
		const upd = (set: string) => () => db.exec(`UPDATE desired_outcome SET ${set} WHERE id = 'do-1'`);
		expect(upd("assessment_state = 'alcancado'")).toThrow(/CHECK/);
		expect(upd("assessment_state = 'sucesso', assessment_rationale = 'x', assessed_at = 'y'")).toThrow(/CHECK/);
		expect(upd("assessment_state = 'alcancado', assessment_rationale = '   ', assessed_at = 'y'")).toThrow(/CHECK/);
		db.close();
	});

	it('banco REALMENTE pré-S16 abre com assessment null, Answers intactas, upgrade idempotente, e o CHECK vale após o upgrade', async () => {
		const seedPath = tempFilePath();
		const seedRepo = createSqliteProjectRepository(seedPath);
		const state = nonTrivialState();
		await seedRepo.insert(state);
		seedRepo.close();

		const oldSql = fs.readFileSync(path.join(__dirname, 'fixtures', 'pre-s16-schema.sql'), 'utf8');
		expect(oldSql).not.toContain('assessment_state');

		const legacyPath = tempFilePath();
		const legacy = new Database(legacyPath);
		legacy.exec(oldSql);
		legacy.exec(`ATTACH DATABASE '${seedPath.replace(/'/g, "''")}' AS seed`);
		const tableNames = (
			legacy
				.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
				.all() as { name: string }[]
		).map((row) => row.name);
		for (const name of tableNames) {
			const mainCols = (legacy.prepare(`PRAGMA main.table_info("${name}")`).all() as { name: string }[]).map((c) => c.name);
			const seedCols = (legacy.prepare(`PRAGMA seed.table_info("${name}")`).all() as { name: string }[]).map((c) => c.name);
			const shared = mainCols.filter((c) => seedCols.includes(c)).map((c) => `"${c}"`).join(', ');
			legacy.exec(`INSERT INTO main."${name}" (${shared}) SELECT ${shared} FROM seed."${name}"`);
		}
		legacy.exec('DETACH DATABASE seed');
		legacy.close();

		const repo = createSqliteProjectRepository(legacyPath);
		openRepos.push(repo);
		const restored = await repo.findById('proj-1');
		expect(restored).toEqual(state); // assessment null em todos; Answers e o resto intactos
		expect(restored?.desiredOutcomes.every((o) => o.assessment === null)).toBe(true);
		expect(restored?.answers).toEqual(state.answers);

		// Reabrir não falha nem duplica colunas.
		const repo2 = createSqliteProjectRepository(legacyPath);
		openRepos.push(repo2);
		await expect(repo2.findById('proj-1')).resolves.toEqual(state);
		const db = new Database(legacyPath);
		const cols = (db.prepare('PRAGMA table_info(desired_outcome)').all() as { name: string }[]).map((c) => c.name);
		expect(cols.filter((c) => c.startsWith('assess')).sort()).toEqual([
			'assessed_at',
			'assessment_rationale',
			'assessment_state'
		]);
		// CHECK cross-column aceito no ADD COLUMN e ativo no banco atualizado.
		expect(() => db.exec("UPDATE desired_outcome SET assessment_state = 'alcancado' WHERE id = 'do-1'")).toThrow(/CHECK/);
		db.close();

		const next = unwrap(setDesiredOutcomeAssessment(catalog, state, 'do-1', 'nao_alcancado', 'r', T2));
		await repo2.save(next);
		await expect(repo2.findById('proj-1')).resolves.toEqual(next);
	});
});
