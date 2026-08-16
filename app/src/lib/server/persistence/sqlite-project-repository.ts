// Adapter concreto de SQLite para a porta ProjectRepository — server-only
// ($lib/server é aplicado pelo próprio SvelteKit). Nenhum outro módulo deve
// falar com o banco diretamente.

import Database from 'better-sqlite3';
import type { Project, ProjectState } from '$lib/domain';
import type { ProjectRepository } from './project-repository';
import {
	mapActivityProgressRow,
	mapAffectedGroupRow,
	mapAnswerRow,
	mapCauseExplorationRow,
	mapCauseHypothesisRow,
	mapCurrentTreatmentRow,
	mapEvidenceRow,
	mapExternalActionRow,
	mapImpedimentRow,
	mapPendingItemRow,
	mapProjectRow,
	mapScopeItemRow,
	mapScopeVersionRow,
	mapTreatmentStepRow,
	type ActivityProgressRow,
	type AffectedGroupRow,
	type AnswerRow,
	type CauseExplorationRow,
	type CauseHypothesisRow,
	type CurrentTreatmentRow,
	type EvidenceRow,
	type ExternalActionRow,
	type ImpedimentRow,
	type PendingItemRow,
	type ProjectRow,
	type ScopeItemRow,
	type ScopeVersionRow,
	type TreatmentStepRow
} from './mappers';
import initSql from './migrations/0001_init.sql?raw';

export interface SqliteProjectRepository extends ProjectRepository {
	close(): void;
}

interface TableInfoRow {
	name: string;
}

// Primeira evolução do schema desde 0001_init.sql (D023, decision-log.md) —
// bancos criados antes dessa decisão não têm route_start_phase_id ainda.
// Idempotente e isolado da inicialização (nunca dentro dos métodos CRUD):
// roda uma única vez por conexão, antes de qualquer insert/save/findById.
function ensureRouteStartPhaseColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(project)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'route_start_phase_id');
	if (!hasColumn) {
		db.exec('ALTER TABLE project ADD COLUMN route_start_phase_id TEXT');
	}
}

// Segunda evolução do schema desde 0001_init.sql (D025, decision-log.md) —
// bancos criados antes dessa decisão não têm execution_status ainda. Mesmo
// mecanismo idempotente de ensureRouteStartPhaseColumn/D023: PRAGMA +
// ALTER TABLE só quando a coluna faltar, fora dos métodos CRUD.
function ensureScopeItemExecutionStatusColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(scope_item)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'execution_status');
	if (!hasColumn) {
		db.exec("ALTER TABLE scope_item ADD COLUMN execution_status TEXT NOT NULL DEFAULT 'a_fazer'");
	}
}

// Terceira evolução do schema desde 0001_init.sql (Stage 4A do rework,
// "Como é tratado hoje") — diferente de D023/D025 acima, current_treatment é
// uma TABELA nova 1:1 com project (mesmo molde de scope_version), não uma
// coluna adicionada a uma tabela existente: `CREATE TABLE IF NOT EXISTS`
// cria a tabela vazia num banco já existente, mas não gera automaticamente
// uma linha por projeto já cadastrado — ao contrário de `ALTER TABLE ... ADD
// COLUMN ... DEFAULT`, que preenche todas as linhas existentes sozinho. Sem
// este backfill, findById() lança "violação do schema" para todo projeto
// criado antes deste corte (bug real encontrado em dogfooding). Idempotente
// (INSERT ... SELECT só dos projetos ainda sem linha) e isolado da
// inicialização, mesmo espírito das duas funções acima — primeira vez que o
// Hydra precisa fazer backfill de uma tabela nova (não de uma coluna); não
// existe um mecanismo canônico anterior para isso além do padrão geral
// "idempotente, fora do CRUD, uma vez por conexão, antes de qualquer
// insert/save/findById".
//
// Estado inicial escrito é sempre o mesmo que createInitialProjectState
// produziria para um projeto novo (noTreatment: false, sem passos) — nunca
// interpreta `estado_atual_detail` legado (READ-LEGACY, ver
// domain/legacy-answers.ts): esse dado continua intocado, sem dual-write,
// sem conversão automática de texto em passos. `updated_at` usa
// `project.created_at` como timestamp coerente, mesmo padrão de
// scopeVersion inicial (`{ hypothesis: '', confirmedAt: null }`) não ter um
// timestamp próprio a inventar.
function ensureCurrentTreatmentRows(db: Database.Database): void {
	db.prepare(
		`INSERT INTO current_treatment (project_id, no_treatment, updated_at)
		 SELECT p.id, 0, p.created_at
		 FROM project p
		 LEFT JOIN current_treatment ct ON ct.project_id = p.id
		 WHERE ct.project_id IS NULL`
	).run();
}

// Quarta evolução do schema desde 0001_init.sql (Stage 4B do rework, "Entender
// as causas") — mesmo caso de ensureCurrentTreatmentRows acima:
// cause_exploration é uma TABELA nova 1:1 com project, não uma coluna
// adicionada a uma tabela existente, então `CREATE TABLE IF NOT EXISTS`
// sozinho não gera a linha para projetos já cadastrados. Idempotente e
// isolado da inicialização, mesmo padrão. Estado inicial sempre
// stillUnknown: 0 (nunca inferido de nenhum dado legado — não existia campo
// de causas antes deste corte).
function ensureCauseExplorationRows(db: Database.Database): void {
	db.prepare(
		`INSERT INTO cause_exploration (project_id, still_unknown, updated_at)
		 SELECT p.id, 0, p.created_at
		 FROM project p
		 LEFT JOIN cause_exploration ce ON ce.project_id = p.id
		 WHERE ce.project_id IS NULL`
	).run();
}

export function createSqliteProjectRepository(databasePath: string): SqliteProjectRepository {
	const db = new Database(databasePath);
	db.pragma('foreign_keys = ON');
	db.exec(initSql);
	ensureRouteStartPhaseColumn(db);
	ensureScopeItemExecutionStatusColumn(db);
	ensureCurrentTreatmentRows(db);
	ensureCauseExplorationRows(db);

	function insertChildren(state: ProjectState): void {
		const insertActivityProgress = db.prepare(
			`INSERT INTO activity_progress (project_id, activity_definition_id, status)
			 VALUES (@projectId, @activityDefinitionId, @status)`
		);
		for (const progress of state.activityProgress) {
			insertActivityProgress.run(progress);
		}

		const insertAnswer = db.prepare(
			`INSERT INTO answer
			   (project_id, activity_definition_id, field_definition_id, value, created_at, updated_at)
			 VALUES (@projectId, @activityDefinitionId, @fieldDefinitionId, @value, @createdAt, @updatedAt)`
		);
		for (const answer of state.answers) {
			insertAnswer.run(answer);
		}

		const insertPendingItem = db.prepare(
			`INSERT INTO pending_item (id, project_id, activity_definition_id, status, created_at, resolved_at)
			 VALUES (@id, @projectId, @activityDefinitionId, @status, @createdAt, @resolvedAt)`
		);
		for (const item of state.pendingItems) {
			insertPendingItem.run({
				id: item.id,
				projectId: item.projectId,
				activityDefinitionId: item.activityDefinitionId,
				status: item.status,
				createdAt: item.createdAt,
				resolvedAt: item.status === 'resolvida' ? item.resolvedAt : null
			});
		}

		const insertScopeItem = db.prepare(
			`INSERT INTO scope_item
			   (id, project_id, text, bucket, effort, item_order, source_suggestion_id, execution_status, created_at, updated_at)
			 VALUES (@id, @projectId, @text, @bucket, @effort, @order, @sourceSuggestionId, @executionStatus, @createdAt, @updatedAt)`
		);
		for (const item of state.scopeItems) {
			insertScopeItem.run({ ...item, executionStatus: item.executionStatus ?? 'a_fazer' });
		}

		db.prepare(
			`INSERT INTO scope_version (project_id, hypothesis, confirmed_at)
			 VALUES (@projectId, @hypothesis, @confirmedAt)`
		).run(state.scopeVersion);

		const insertImpediment = db.prepare(
			`INSERT INTO impediment
			   (id, project_id, text, tipo, next_action, status, created_at, updated_at, resolved_at)
			 VALUES (@id, @projectId, @text, @tipo, @nextAction, @status, @createdAt, @updatedAt, @resolvedAt)`
		);
		for (const impediment of state.impediments) {
			insertImpediment.run(impediment);
		}

		const insertAffectedGroup = db.prepare(
			`INSERT INTO affected_group (id, project_id, label, impact, frequency, created_at, updated_at)
			 VALUES (@id, @projectId, @label, @impact, @frequency, @createdAt, @updatedAt)`
		);
		for (const group of state.affectedGroups) {
			insertAffectedGroup.run(group);
		}

		// external_action depende de affected_group (FK), evidence depende de
		// external_action e affected_group — ordem de insert importa com
		// foreign_keys = ON (checagem imediata, não deferida).
		const insertExternalAction = db.prepare(
			`INSERT INTO external_action
			   (id, project_id, kind, affected_group_id, status, objective, questions, information_to_take, expected_result, created_at, updated_at, completed_at)
			 VALUES (@id, @projectId, @kind, @affectedGroupId, @status, @objective, @questions, @informationToTake, @expectedResult, @createdAt, @updatedAt, @completedAt)`
		);
		for (const action of state.externalActions) {
			insertExternalAction.run({
				...action,
				questions: JSON.stringify(action.questions),
				informationToTake: JSON.stringify(action.informationToTake)
			});
		}

		const insertEvidence = db.prepare(
			`INSERT INTO evidence (id, project_id, external_action_id, affected_group_id, kind, outcome, learning, created_at)
			 VALUES (@id, @projectId, @externalActionId, @affectedGroupId, @kind, @outcome, @learning, @createdAt)`
		);
		for (const evidence of state.evidences) {
			insertEvidence.run(evidence);
		}

		db.prepare(
			`INSERT INTO current_treatment (project_id, no_treatment, updated_at)
			 VALUES (@projectId, @noTreatment, @updatedAt)`
		).run({
			projectId: state.currentTreatment.projectId,
			noTreatment: state.currentTreatment.noTreatment ? 1 : 0,
			updatedAt: state.currentTreatment.updatedAt
		});

		const insertTreatmentStep = db.prepare(
			`INSERT INTO treatment_step (id, project_id, step_order, what_happens, actors, medium, frictions, created_at, updated_at)
			 VALUES (@id, @projectId, @order, @whatHappens, @actors, @medium, @frictions, @createdAt, @updatedAt)`
		);
		for (const step of state.treatmentSteps) {
			insertTreatmentStep.run({
				...step,
				actors: JSON.stringify(step.actors),
				frictions: JSON.stringify(step.frictions)
			});
		}

		db.prepare(
			`INSERT INTO cause_exploration (project_id, still_unknown, updated_at)
			 VALUES (@projectId, @stillUnknown, @updatedAt)`
		).run({
			projectId: state.causeExploration.projectId,
			stillUnknown: state.causeExploration.stillUnknown ? 1 : 0,
			updatedAt: state.causeExploration.updatedAt
		});

		const insertCauseHypothesis = db.prepare(
			`INSERT INTO cause_hypothesis
			   (id, project_id, title, origin, expected_if_true, what_weakens_it, evidence_ids, created_at, updated_at)
			 VALUES (@id, @projectId, @title, @origin, @expectedIfTrue, @whatWeakensIt, @evidenceIds, @createdAt, @updatedAt)`
		);
		for (const hypothesis of state.causeHypotheses) {
			insertCauseHypothesis.run({ ...hypothesis, evidenceIds: JSON.stringify(hypothesis.evidenceIds) });
		}
	}

	const insertTransaction = db.transaction((state: ProjectState) => {
		db.prepare(
			'INSERT INTO project (id, name, created_at, route_start_phase_id) VALUES (@id, @name, @createdAt, @routeStartPhaseId)'
		).run({
			id: state.project.id,
			name: state.project.name,
			createdAt: state.project.createdAt,
			routeStartPhaseId: state.project.routeStartPhaseId ?? null
		});
		insertChildren(state);
	});

	const saveTransaction = db.transaction((state: ProjectState) => {
		const result = db
			.prepare(
				'UPDATE project SET name = @name, created_at = @createdAt, route_start_phase_id = @routeStartPhaseId WHERE id = @id'
			)
			.run({
				id: state.project.id,
				name: state.project.name,
				createdAt: state.project.createdAt,
				routeStartPhaseId: state.project.routeStartPhaseId ?? null
			});
		if (result.changes === 0) {
			throw new Error(`Project "${state.project.id}" não existe — save() exige um projeto já inserido`);
		}
		db.prepare('DELETE FROM activity_progress WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM answer WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM pending_item WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM scope_item WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM scope_version WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM impediment WHERE project_id = ?').run(state.project.id);
		// evidence/external_action apagados antes de affected_group — ambos
		// referenciam affected_group (FK sem ON DELETE, checagem imediata).
		db.prepare('DELETE FROM evidence WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM external_action WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM affected_group WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM treatment_step WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM current_treatment WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM cause_hypothesis WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM cause_exploration WHERE project_id = ?').run(state.project.id);
		insertChildren(state);
	});

	return {
		async insert(state: ProjectState): Promise<void> {
			insertTransaction(state);
		},

		async findById(projectId: string): Promise<ProjectState | null> {
			const projectRow = db
				.prepare('SELECT id, name, created_at, route_start_phase_id FROM project WHERE id = ?')
				.get(projectId) as ProjectRow | undefined;
			if (!projectRow) return null;

			// ORDER BY rowid: SQLite não garante ordem sem ORDER BY; o rowid
			// implícito preserva a ordem de inserção de forma determinística.
			const activityProgressRows = db
				.prepare(
					`SELECT project_id, activity_definition_id, status FROM activity_progress
					 WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ActivityProgressRow[];

			const answerRows = db
				.prepare(
					`SELECT project_id, activity_definition_id, field_definition_id, value, created_at, updated_at
					 FROM answer WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as AnswerRow[];

			const pendingItemRows = db
				.prepare(
					`SELECT id, project_id, activity_definition_id, status, created_at, resolved_at
					 FROM pending_item WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as PendingItemRow[];

			const scopeItemRows = db
				.prepare(
					`SELECT id, project_id, text, bucket, effort, item_order, source_suggestion_id, execution_status, created_at, updated_at
					 FROM scope_item WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ScopeItemRow[];

			const scopeVersionRow = db
				.prepare('SELECT project_id, hypothesis, confirmed_at FROM scope_version WHERE project_id = ?')
				.get(projectId) as ScopeVersionRow | undefined;
			if (!scopeVersionRow) {
				throw new Error(`Projeto "${projectId}" não tem scope_version (violação do schema — 1:1 com project)`);
			}

			const impedimentRows = db
				.prepare(
					`SELECT id, project_id, text, tipo, next_action, status, created_at, updated_at, resolved_at
					 FROM impediment WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ImpedimentRow[];

			const affectedGroupRows = db
				.prepare(
					`SELECT id, project_id, label, impact, frequency, created_at, updated_at
					 FROM affected_group WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as AffectedGroupRow[];

			const externalActionRows = db
				.prepare(
					`SELECT id, project_id, kind, affected_group_id, status, objective, questions, information_to_take, expected_result, created_at, updated_at, completed_at
					 FROM external_action WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ExternalActionRow[];

			const evidenceRows = db
				.prepare(
					`SELECT id, project_id, external_action_id, affected_group_id, kind, outcome, learning, created_at
					 FROM evidence WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as EvidenceRow[];

			const currentTreatmentRow = db
				.prepare('SELECT project_id, no_treatment, updated_at FROM current_treatment WHERE project_id = ?')
				.get(projectId) as CurrentTreatmentRow | undefined;
			if (!currentTreatmentRow) {
				throw new Error(`Projeto "${projectId}" não tem current_treatment (violação do schema — 1:1 com project)`);
			}

			const treatmentStepRows = db
				.prepare(
					`SELECT id, project_id, step_order, what_happens, actors, medium, frictions, created_at, updated_at
					 FROM treatment_step WHERE project_id = ? ORDER BY step_order`
				)
				.all(projectId) as TreatmentStepRow[];

			const causeExplorationRow = db
				.prepare('SELECT project_id, still_unknown, updated_at FROM cause_exploration WHERE project_id = ?')
				.get(projectId) as CauseExplorationRow | undefined;
			if (!causeExplorationRow) {
				throw new Error(`Projeto "${projectId}" não tem cause_exploration (violação do schema — 1:1 com project)`);
			}

			const causeHypothesisRows = db
				.prepare(
					`SELECT id, project_id, title, origin, expected_if_true, what_weakens_it, evidence_ids, created_at, updated_at
					 FROM cause_hypothesis WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as CauseHypothesisRow[];

			return {
				project: mapProjectRow(projectRow),
				activityProgress: activityProgressRows.map(mapActivityProgressRow),
				answers: answerRows.map(mapAnswerRow),
				pendingItems: pendingItemRows.map(mapPendingItemRow),
				scopeItems: scopeItemRows.map(mapScopeItemRow),
				scopeVersion: mapScopeVersionRow(scopeVersionRow),
				impediments: impedimentRows.map(mapImpedimentRow),
				affectedGroups: affectedGroupRows.map(mapAffectedGroupRow),
				externalActions: externalActionRows.map(mapExternalActionRow),
				evidences: evidenceRows.map(mapEvidenceRow),
				currentTreatment: mapCurrentTreatmentRow(currentTreatmentRow),
				treatmentSteps: treatmentStepRows.map(mapTreatmentStepRow),
				causeExploration: mapCauseExplorationRow(causeExplorationRow),
				causeHypotheses: causeHypothesisRows.map(mapCauseHypothesisRow)
			};
		},

		async save(state: ProjectState): Promise<void> {
			saveTransaction(state);
		},

		async listRecent(): Promise<Project[]> {
			const rows = db
				.prepare(
					'SELECT id, name, created_at, route_start_phase_id FROM project ORDER BY created_at DESC, id DESC'
				)
				.all() as ProjectRow[];
			return rows.map(mapProjectRow);
		},

		close(): void {
			db.close();
		}
	};
}
