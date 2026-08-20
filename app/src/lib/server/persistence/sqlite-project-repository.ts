// Adapter concreto de SQLite para a porta ProjectRepository — server-only
// ($lib/server é aplicado pelo próprio SvelteKit). Nenhum outro módulo deve
// falar com o banco diretamente.

import Database from 'better-sqlite3';
import type { Project, ProjectEvent, ProjectState } from '$lib/domain';
import type { ProjectEventFilter, ProjectRepository } from './project-repository';
import {
	mapActivityProgressRow,
	mapAffectedGroupRow,
	mapAnswerRow,
	mapCauseExplorationRow,
	mapCauseHypothesisRow,
	mapCurrentTreatmentRow,
	mapDesiredOutcomeRow,
	mapEvidenceRow,
	mapExternalActionRow,
	mapImpedimentRow,
	mapPendingItemRow,
	mapProjectEventRow,
	mapProjectRow,
	mapScopeItemRow,
	mapScopeVersionRow,
	mapTreatmentStepRow,
	mapWorkItemRow,
	type ActivityProgressRow,
	type AffectedGroupRow,
	type AnswerRow,
	type CauseExplorationRow,
	type CauseHypothesisRow,
	type CurrentTreatmentRow,
	type DesiredOutcomeRow,
	type EvidenceRow,
	type ExternalActionRow,
	type ImpedimentRow,
	type PendingItemRow,
	type ProjectEventRow,
	type ProjectRow,
	type ScopeItemRow,
	type ScopeVersionRow,
	type TreatmentStepRow,
	type WorkItemRow
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

// Quinta evolução do schema desde 0001_init.sql (ETAPA 6 do rework, D035,
// "Primeiro loop operacional") — mesmo caso de ensureScopeItemExecutionStatusColumn/
// D025: work_item_id é uma COLUNA nova numa tabela existente (impediment),
// não uma tabela nova, então `CREATE TABLE IF NOT EXISTS work_item` sozinho
// (que só cria a tabela nova, vazia) não afeta a tabela impediment já
// existente num banco criado antes desta etapa. Idempotente, isolado da
// inicialização, mesmo padrão. Projetos existentes continuam abrindo e todo
// impediment já persistido fica com work_item_id NULL — nenhum dado legado é
// promovido/vinculado automaticamente a um WorkItem.
function ensureImpedimentWorkItemIdColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(impediment)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'work_item_id');
	if (!hasColumn) {
		db.exec('ALTER TABLE impediment ADD COLUMN work_item_id TEXT REFERENCES work_item (id)');
	}
	// Precisa rodar depois de garantir a coluna acima — 0001_init.sql não
	// indexa work_item_id (ver comentário lá) exatamente por isso.
	db.exec('CREATE INDEX IF NOT EXISTS idx_impediment_work_item_id ON impediment (work_item_id)');
}

export function createSqliteProjectRepository(databasePath: string): SqliteProjectRepository {
	const db = new Database(databasePath);
	db.pragma('foreign_keys = ON');
	db.exec(initSql);
	ensureRouteStartPhaseColumn(db);
	ensureScopeItemExecutionStatusColumn(db);
	ensureCurrentTreatmentRows(db);
	ensureCauseExplorationRows(db);
	ensureImpedimentWorkItemIdColumn(db);

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

		// work_item precisa ser inserido antes de impediment: impediment.work_item_id
		// referencia work_item.id (FK checada imediatamente, foreign_keys = ON).
		const insertWorkItem = db.prepare(
			`INSERT INTO work_item (id, project_id, title, status, created_at, updated_at)
			 VALUES (@id, @projectId, @title, @status, @createdAt, @updatedAt)`
		);
		for (const item of state.workItems) {
			insertWorkItem.run(item);
		}

		const insertImpediment = db.prepare(
			`INSERT INTO impediment
			   (id, project_id, text, tipo, next_action, status, work_item_id, created_at, updated_at, resolved_at)
			 VALUES (@id, @projectId, @text, @tipo, @nextAction, @status, @workItemId, @createdAt, @updatedAt, @resolvedAt)`
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

		const insertDesiredOutcome = db.prepare(
			`INSERT INTO desired_outcome (id, project_id, change, target, outcome_order, created_at, updated_at)
			 VALUES (@id, @projectId, @change, @target, @order, @createdAt, @updatedAt)`
		);
		for (const outcome of state.desiredOutcomes) {
			insertDesiredOutcome.run(outcome);
		}
	}

	// Event log incremental (ETAPA 7 do rework) — append-only, nunca fora do
	// DELETE + reinsert de saveTransaction (project_event não está na lista
	// de DELETEs abaixo, de propósito: histórico não é apagado por save()).
	// events chega vazio na imensa maioria das chamadas (toda operação que
	// ainda não gera evento) — o loop simplesmente não roda.
	const insertEvent = db.prepare(
		`INSERT INTO project_event (id, project_id, type, entity_type, entity_id, payload, created_at)
		 VALUES (@id, @projectId, @type, @entityType, @entityId, @payload, @createdAt)`
	);
	function insertEvents(events: ProjectEvent[]): void {
		for (const event of events) {
			insertEvent.run({ ...event, payload: JSON.stringify(event.payload) });
		}
	}

	const insertTransaction = db.transaction((state: ProjectState, events: ProjectEvent[]) => {
		db.prepare(
			'INSERT INTO project (id, name, created_at, route_start_phase_id) VALUES (@id, @name, @createdAt, @routeStartPhaseId)'
		).run({
			id: state.project.id,
			name: state.project.name,
			createdAt: state.project.createdAt,
			routeStartPhaseId: state.project.routeStartPhaseId ?? null
		});
		insertChildren(state);
		insertEvents(events);
	});

	const saveTransaction = db.transaction((state: ProjectState, events: ProjectEvent[]) => {
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
		// impediment antes de work_item: impediment.work_item_id referencia
		// work_item.id (FK checada imediatamente, foreign_keys = ON).
		db.prepare('DELETE FROM impediment WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM work_item WHERE project_id = ?').run(state.project.id);
		// evidence/external_action apagados antes de affected_group — ambos
		// referenciam affected_group (FK sem ON DELETE, checagem imediata).
		db.prepare('DELETE FROM evidence WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM external_action WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM affected_group WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM treatment_step WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM current_treatment WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM cause_hypothesis WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM cause_exploration WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM desired_outcome WHERE project_id = ?').run(state.project.id);
		insertChildren(state);
		insertEvents(events);
	});

	return {
		async insert(state: ProjectState, events: ProjectEvent[] = []): Promise<void> {
			insertTransaction(state, events);
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
					`SELECT id, project_id, text, tipo, next_action, status, work_item_id, created_at, updated_at, resolved_at
					 FROM impediment WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ImpedimentRow[];

			const workItemRows = db
				.prepare(
					`SELECT id, project_id, title, status, created_at, updated_at
					 FROM work_item WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as WorkItemRow[];

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

			const desiredOutcomeRows = db
				.prepare(
					`SELECT id, project_id, change, target, outcome_order, created_at, updated_at
					 FROM desired_outcome WHERE project_id = ? ORDER BY outcome_order`
				)
				.all(projectId) as DesiredOutcomeRow[];

			return {
				project: mapProjectRow(projectRow),
				activityProgress: activityProgressRows.map(mapActivityProgressRow),
				answers: answerRows.map(mapAnswerRow),
				pendingItems: pendingItemRows.map(mapPendingItemRow),
				scopeItems: scopeItemRows.map(mapScopeItemRow),
				scopeVersion: mapScopeVersionRow(scopeVersionRow),
				impediments: impedimentRows.map(mapImpedimentRow),
				workItems: workItemRows.map(mapWorkItemRow),
				affectedGroups: affectedGroupRows.map(mapAffectedGroupRow),
				externalActions: externalActionRows.map(mapExternalActionRow),
				evidences: evidenceRows.map(mapEvidenceRow),
				currentTreatment: mapCurrentTreatmentRow(currentTreatmentRow),
				treatmentSteps: treatmentStepRows.map(mapTreatmentStepRow),
				causeExploration: mapCauseExplorationRow(causeExplorationRow),
				causeHypotheses: causeHypothesisRows.map(mapCauseHypothesisRow),
				desiredOutcomes: desiredOutcomeRows.map(mapDesiredOutcomeRow)
			};
		},

		async save(state: ProjectState, events: ProjectEvent[] = []): Promise<void> {
			saveTransaction(state, events);
		},

		async listRecent(): Promise<Project[]> {
			const rows = db
				.prepare(
					'SELECT id, name, created_at, route_start_phase_id FROM project ORDER BY created_at DESC, id DESC'
				)
				.all() as ProjectRow[];
			return rows.map(mapProjectRow);
		},

		// Event log incremental (ETAPA 7 do rework) — mais recente primeiro
		// (created_at DESC), com rowid DESC como desempate determinístico para
		// eventos com o mesmo created_at (mesmo espírito de listRecent acima):
		// preserva a ordem real de inserção em vez de uma ordem indefinida do
		// SQLite. filter.entityIds (quando presente e não vazio) restringe a
		// eventos de uma ou mais entidades — "histórico de item" usa um id,
		// "mudanças relacionadas" (WorkItem + Impediment vinculado) usa dois.
		async listEvents(projectId: string, filter?: ProjectEventFilter): Promise<ProjectEvent[]> {
			const entityIds = filter?.entityIds?.filter((id) => id.length > 0) ?? [];
			if (entityIds.length > 0) {
				const placeholders = entityIds.map(() => '?').join(', ');
				const rows = db
					.prepare(
						`SELECT id, project_id, type, entity_type, entity_id, payload, created_at
						 FROM project_event WHERE project_id = ? AND entity_id IN (${placeholders})
						 ORDER BY created_at DESC, rowid DESC`
					)
					.all(projectId, ...entityIds) as ProjectEventRow[];
				return rows.map(mapProjectEventRow);
			}
			const rows = db
				.prepare(
					`SELECT id, project_id, type, entity_type, entity_id, payload, created_at
					 FROM project_event WHERE project_id = ? ORDER BY created_at DESC, rowid DESC`
				)
				.all(projectId) as ProjectEventRow[];
			return rows.map(mapProjectEventRow);
		},

		close(): void {
			db.close();
		}
	};
}
