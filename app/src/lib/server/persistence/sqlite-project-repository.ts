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
	mapChangeRow,
	mapCurrentTreatmentRow,
	mapDecisionRow,
	mapDecisionAffectedWorkItemRow,
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
	mapDeliverableRow,
	mapDependencyRow,
	mapMilestoneRow,
	mapMilestoneWorkItemRow,
	mapRiskRow,
	mapScheduleBaselineRow,
	mapScheduleBaselineEntryRow,
	mapWorkItemRow,
	type ActivityProgressRow,
	type AffectedGroupRow,
	type AnswerRow,
	type CauseExplorationRow,
	type CauseHypothesisRow,
	type ChangeRow,
	type CurrentTreatmentRow,
	type DecisionRow,
	type DecisionAffectedWorkItemRow,
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
	type DeliverableRow,
	type DependencyRow,
	type MilestoneRow,
	type MilestoneWorkItemRow,
	type RiskRow,
	type ScheduleBaselineRow,
	type ScheduleBaselineEntryRow,
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

// Sexta evolução do schema desde 0001_init.sql (R1 da remediação) — primeira
// que precisa RECONSTRUIR uma tabela, não adicionar coluna nem fazer backfill
// de linhas.
//
// project_event nasceu (S7) com CHECK enumerando os quatro tipos de evento do
// loop WorkItem/Impediment. Como todo corte futuro que introduz um objeto vivo
// acrescenta tipos, essa enumeração vira um bloqueio: `CREATE TABLE IF NOT
// EXISTS` é no-op numa tabela existente, então um banco criado antes deste
// corte manteria o CHECK antigo e recusaria o INSERT de um tipo novo — e, como
// saveTransaction grava estado e eventos na MESMA transação, o rollback
// derrubaria a operação de domínio inteira, não só o histórico. Falha de
// escrita, não de leitura.
//
// Por que rebuild e não ALTER: o SQLite embutido aqui (3.53.x) suporta
// `ALTER TABLE ... DROP CONSTRAINT`, mas só para constraints NOMEADAS — as de
// project_event são anônimas e não há como endereçá-las (PRAGMA table_info não
// expõe constraints; só o texto de sqlite_master). Verificado empiricamente
// contra este runtime antes de escolher o mecanismo.
//
// Idempotente pela mesma regra das funções acima: a detecção é a presença de
// "CHECK" no DDL persistido, então um banco já convertido (ou recém-criado a
// partir de 0001_init.sql, que não tem mais CHECK aqui) simplesmente não entra.
function ensureProjectEventTaxonomyOpen(db: Database.Database): void {
	const row = db
		.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_event'")
		.get() as { sql: string } | undefined;
	if (!row || !/\bCHECK\b/i.test(row.sql)) return;

	// foreign_keys precisa ser desligado FORA de qualquer transação (dentro de
	// uma, o PRAGMA é silenciosamente ignorado) — procedimento oficial de
	// alteração de schema do SQLite.
	db.pragma('foreign_keys = OFF');
	try {
		db.transaction(() => {
			db.exec(
				`CREATE TABLE project_event_new (
					id TEXT PRIMARY KEY,
					project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
					type TEXT NOT NULL,
					entity_type TEXT NOT NULL,
					entity_id TEXT NOT NULL,
					payload TEXT NOT NULL,
					created_at TEXT NOT NULL
				)`
			);
			db.exec(
				`INSERT INTO project_event_new (id, project_id, type, entity_type, entity_id, payload, created_at)
				 SELECT id, project_id, type, entity_type, entity_id, payload, created_at FROM project_event`
			);
			db.exec('DROP TABLE project_event');
			db.exec('ALTER TABLE project_event_new RENAME TO project_event');
			// Índices vivem com a tabela: DROP TABLE levou os antigos junto.
			db.exec('CREATE INDEX IF NOT EXISTS idx_project_event_project_id ON project_event (project_id)');
			db.exec('CREATE INDEX IF NOT EXISTS idx_project_event_entity_id ON project_event (entity_id)');

			// Passo 10 do procedimento oficial: confere integridade referencial
			// antes do commit. Lançar aqui desfaz a transação inteira — um banco
			// que falhe a conversão continua com a tabela original intacta.
			const violations = db.pragma('foreign_key_check') as unknown[];
			if (violations.length > 0) {
				throw new Error(
					`Conversão de project_event abortada: ${violations.length} violação(ões) de foreign key detectada(s).`
				);
			}
		})();
	} finally {
		db.pragma('foreign_keys = ON');
	}
}

// Sétima evolução do schema desde 0001_init.sql (ETAPA 8 do rework,
// microcorte de Timeline) — mesmo caso de ensureImpedimentWorkItemIdColumn:
// planned_date é uma COLUNA nova numa tabela existente (milestone), e
// `CREATE TABLE IF NOT EXISTS milestone` é no-op num banco que já tem a
// tabela — inclusive nos bancos criados entre o corte de Milestone (D040) e
// este. Idempotente, isolado da inicialização, mesmo padrão.
//
// Marcos já persistidos ficam com planned_date NULL: nenhuma data é
// sintetizada, nem de created_at, nem do texto livre legado. A CHECK nomeada
// acompanha a coluna (ALTER TABLE ADD COLUMN com CONSTRAINT nomeada é aceito
// por este runtime — verificado empiricamente contra o SQLite 3.53.x embutido
// antes de escolher o mecanismo), e é só defesa de FORMATO: a validade
// calendárica vive em isCivilDate (domain/civil-date.ts), não aqui.
function ensureMilestonePlannedDateColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(milestone)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'planned_date');
	if (!hasColumn) {
		db.exec(
			`ALTER TABLE milestone ADD COLUMN planned_date TEXT
			 CONSTRAINT milestone_planned_date_format
			 CHECK (planned_date IS NULL OR planned_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`
		);
	}
}

// Oitava evolução do schema desde 0001_init.sql (ETAPA 9 do rework, segundo
// microcorte, D043/D044) — mesmo caso de ensureImpedimentWorkItemIdColumn:
// deliverable_id é uma COLUNA nova numa tabela existente (work_item), então
// `CREATE TABLE IF NOT EXISTS work_item` é no-op num banco criado antes deste
// corte (inclusive os criados entre o primeiro microcorte de Deliverable,
// D043, e este). Idempotente, isolado da inicialização, mesmo padrão.
// WorkItems já persistidos ficam com deliverable_id NULL — nenhum vínculo é
// inferido ou sintetizado a partir de título, ScopeItem, PlanningItem,
// posição, bucket ou Milestone.
function ensureWorkItemDeliverableIdColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(work_item)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'deliverable_id');
	if (!hasColumn) {
		db.exec('ALTER TABLE work_item ADD COLUMN deliverable_id TEXT REFERENCES deliverable (id)');
	}
	// Precisa rodar depois de garantir a coluna acima — 0001_init.sql não
	// indexa deliverable_id (mesma razão de idx_impediment_work_item_id).
	db.exec('CREATE INDEX IF NOT EXISTS idx_work_item_deliverable_id ON work_item (deliverable_id)');
}

// Nona evolução do schema desde 0001_init.sql (ETAPA 10 do rework, segundo
// microcorte) — mesmo caso de ensureImpedimentWorkItemIdColumn/
// ensureWorkItemDeliverableIdColumn: reviewed_at é uma COLUNA nova numa
// tabela existente (risk, criada em D049), então `CREATE TABLE IF NOT
// EXISTS risk` é no-op num banco criado antes deste corte — inclusive os
// criados entre D049 e este. Idempotente, isolado da inicialização, mesmo
// padrão. Risks já persistidos ficam com reviewed_at NULL — nenhuma revisão
// é sintetizada de created_at/updated_at/closed_at.
function ensureRiskReviewedAtColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(risk)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'reviewed_at');
	if (!hasColumn) {
		db.exec('ALTER TABLE risk ADD COLUMN reviewed_at TEXT');
	}
}

// Décima evolução do schema desde 0001_init.sql (ETAPA 10 do rework,
// terceiro microcorte) — mesmo caso de ensureRiskReviewedAtColumn: três
// colunas novas na mesma tabela `risk`. SQLite não valida CHECK constraints
// adicionadas depois via ALTER TABLE contra linhas já existentes, mas as
// linhas existentes ficam com as três colunas NULL (par válido:
// likelihood/impact ambos ausentes), então a invariante nunca é violada por
// esta migração. Nenhuma avaliação ou resposta é sintetizada de nenhum
// outro dado.
function ensureRiskAssessmentAndResponseColumns(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(risk)').all() as TableInfoRow[];
	const columnNames = new Set(columns.map((column) => column.name));
	if (!columnNames.has('likelihood')) {
		db.exec('ALTER TABLE risk ADD COLUMN likelihood TEXT');
	}
	if (!columnNames.has('impact')) {
		db.exec('ALTER TABLE risk ADD COLUMN impact TEXT');
	}
	if (!columnNames.has('response')) {
		db.exec('ALTER TABLE risk ADD COLUMN response TEXT');
	}
}

// Décima primeira evolução do schema desde 0001_init.sql (ETAPA 11 do
// rework, segundo microcorte, §41/§13.4) — mesmo caso de
// ensureImpedimentWorkItemIdColumn/ensureWorkItemDeliverableIdColumn:
// decision_id é uma COLUNA nova numa tabela existente (impediment), então
// `CREATE TABLE IF NOT EXISTS decision` sozinho (tabela nova desde D053, já
// existente nos bancos deste corte) não afeta a tabela impediment já criada
// num banco anterior a este microcorte. Idempotente, isolado da
// inicialização, mesmo padrão. Todo Impediment já persistido fica com
// decision_id NULL — nenhum vínculo é inferido de tipo === 'decisao_pendente'
// nem de nenhum outro dado.
function ensureImpedimentDecisionIdColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(impediment)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'decision_id');
	if (!hasColumn) {
		db.exec('ALTER TABLE impediment ADD COLUMN decision_id TEXT REFERENCES decision (id)');
	}
	// Precisa rodar depois de garantir a coluna acima — 0001_init.sql não
	// indexa decision_id (mesma razão de idx_impediment_work_item_id).
	db.exec('CREATE INDEX IF NOT EXISTS idx_impediment_decision_id ON impediment (decision_id)');
}

// Décima segunda evolução do schema desde 0001_init.sql (ETAPA 11 do rework,
// quarto microcorte, §41) — mesmo caso de ensureRiskReviewedAtColumn:
// responsible é uma COLUNA nova na tabela `decision`, já existente desde
// D053. Idempotente, isolado da inicialização, mesmo padrão. Decisions já
// persistidas ficam com responsible NULL — nenhum valor é inferido de
// `decisor_principal` ou de qualquer outro dado (§13.2, sem dual-write).
function ensureDecisionResponsibleColumn(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(decision)').all() as TableInfoRow[];
	const hasColumn = columns.some((column) => column.name === 'responsible');
	if (!hasColumn) {
		db.exec('ALTER TABLE decision ADD COLUMN responsible TEXT');
	}
}

// Décima terceira evolução do schema desde 0001_init.sql (ETAPA 12 do
// rework, "Scheduling e Gantt", §42, primeiro microcorte fundacional) —
// mesmo caso de ensureRiskAssessmentAndResponseColumns: duas colunas novas na
// mesma tabela `work_item`, já existente desde a ETAPA 6. Cada ALTER TABLE
// ADD COLUMN abaixo só pode carregar uma CHECK que referencie a própria
// coluna nova (restrição do SQLite) — por isso a CHECK cruzada do par
// (`work_item_schedule_pair`, ver 0001_init.sql) só existe numa tabela criada
// do zero por este corte, mesmo caso de `risk_assessment_pair` (D051): um
// banco upgradeado ganha as duas colunas com formato/positividade validados
// por coluna, mas SEM proteção de banco sobre o par — só o domínio
// (setWorkItemSchedule) e a desserialização protegem o par nesse caso,
// falsificado explicitamente em teste dedicado. Linhas já existentes ficam
// com as duas colunas NULL (par válido: sem schedule), então a invariante
// nunca é violada por esta migração em si. Nenhum schedule é sintetizado de
// nenhum outro dado (effort, capacity, data_alvo_entrega ou qualquer Answer
// legado).
function ensureWorkItemScheduleColumns(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(work_item)').all() as TableInfoRow[];
	const columnNames = new Set(columns.map((column) => column.name));
	if (!columnNames.has('planned_start')) {
		db.exec(
			`ALTER TABLE work_item ADD COLUMN planned_start TEXT
			 CONSTRAINT work_item_planned_start_format
			 CHECK (planned_start IS NULL OR planned_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`
		);
	}
	if (!columnNames.has('duration_days')) {
		db.exec(
			`ALTER TABLE work_item ADD COLUMN duration_days INTEGER
			 CONSTRAINT work_item_duration_days_positive
			 CHECK (duration_days IS NULL OR duration_days >= 1)`
		);
	}
}

// Décima quarta evolução do schema desde 0001_init.sql (ETAPA 14 do
// rework, "Ações externas maduras", §44, D070/D072/D073) — primeiro `kind`
// novo de ExternalAction (`approval`, subject Decision) desde a criação da
// tabela. Mesmo problema estrutural de ensureProjectEventTaxonomyOpen:
// `kind` tem CHECK fechado (`IN ('validate_affected_group')`) e
// `affected_group_id`/`objective`/`questions`/`information_to_take`/
// `expected_result` são NOT NULL — nada disso existe numa linha `approval`
// (que só tem decision_id). SQLite não altera CHECK nem remove NOT NULL
// via ALTER TABLE, então exige o mesmo procedimento oficial de rebuild
// (CREATE / INSERT SELECT / DROP / RENAME) — seguindo a regra já registrada
// em 0001_init.sql ("CHECK de banco para invariante realmente fechado; sem
// CHECK para discriminante extensível"): `kind` deixa de ter CHECK fechado
// (a união TS fecha os casos, mesmo tratamento de `project_event.type`), e
// a única CHECK que permanece (coerência status/completed_at) é a mesma
// invariante fechada de sempre, agora NOMEADA.
//
// Detecção de idempotência: ausência da coluna decision_id — um banco já
// convertido (ou recém-criado a partir de 0001_init.sql, que já nasce sem
// o CHECK fechado e com decision_id) simplesmente não entra.
function ensureExternalActionApprovalSupport(db: Database.Database): void {
	const columns = db.prepare('PRAGMA table_info(external_action)').all() as TableInfoRow[];
	const hasDecisionId = columns.some((column) => column.name === 'decision_id');
	if (hasDecisionId) return;

	// foreign_keys precisa ser desligado FORA de qualquer transação (dentro
	// de uma, o PRAGMA é silenciosamente ignorado) — procedimento oficial de
	// alteração de schema do SQLite, mesmo passo de ensureProjectEventTaxonomyOpen.
	db.pragma('foreign_keys = OFF');
	try {
		db.transaction(() => {
			db.exec(
				`CREATE TABLE external_action_new (
					id TEXT PRIMARY KEY,
					project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
					kind TEXT NOT NULL,
					affected_group_id TEXT REFERENCES affected_group (id),
					decision_id TEXT REFERENCES decision (id),
					status TEXT NOT NULL CHECK (status IN ('aberta', 'concluida')),
					objective TEXT,
					questions TEXT,
					information_to_take TEXT,
					expected_result TEXT,
					created_at TEXT NOT NULL,
					updated_at TEXT NOT NULL,
					completed_at TEXT,
					CONSTRAINT external_action_completed_matches_status CHECK (
						(status = 'aberta' AND completed_at IS NULL) OR
						(status = 'concluida' AND completed_at IS NOT NULL)
					)
				)`
			);
			db.exec(
				`INSERT INTO external_action_new
					(id, project_id, kind, affected_group_id, decision_id, status, objective, questions, information_to_take, expected_result, created_at, updated_at, completed_at)
				 SELECT id, project_id, kind, affected_group_id, NULL, status, objective, questions, information_to_take, expected_result, created_at, updated_at, completed_at
				 FROM external_action`
			);
			db.exec('DROP TABLE external_action');
			db.exec('ALTER TABLE external_action_new RENAME TO external_action');
			// Índice vive com a tabela: DROP TABLE levou o antigo junto (R5 da
			// remediação, mesmo cuidado de ensureProjectEventTaxonomyOpen).
			db.exec('CREATE INDEX IF NOT EXISTS idx_external_action_project_id ON external_action (project_id)');

			// Passo 10 do procedimento oficial: confere integridade referencial
			// antes do commit. Lançar aqui desfaz a transação inteira — um banco
			// que falhe a conversão continua com a tabela original intacta.
			const violations = db.pragma('foreign_key_check') as unknown[];
			if (violations.length > 0) {
				throw new Error(
					`Conversão de external_action abortada: ${violations.length} violação(ões) de foreign key detectada(s).`
				);
			}
		})();
	} finally {
		db.pragma('foreign_keys = ON');
	}
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
	ensureMilestonePlannedDateColumn(db);
	ensureWorkItemDeliverableIdColumn(db);
	ensureRiskReviewedAtColumn(db);
	ensureRiskAssessmentAndResponseColumns(db);
	ensureImpedimentDecisionIdColumn(db);
	ensureDecisionResponsibleColumn(db);
	ensureWorkItemScheduleColumns(db);
	ensureProjectEventTaxonomyOpen(db);
	ensureExternalActionApprovalSupport(db);

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

		// deliverable não tem FK para scope_item (proveniência, não integridade
		// referencial — ver 0001_init.sql), então a ordem de inserção em relação
		// a scope_item é indiferente.
		const insertDeliverable = db.prepare(
			`INSERT INTO deliverable
			   (id, project_id, title, bucket, effort, item_order, source_scope_item_id, created_at, updated_at)
			 VALUES (@id, @projectId, @title, @bucket, @effort, @order, @sourceScopeItemId, @createdAt, @updatedAt)`
		);
		for (const deliverable of state.deliverables) {
			insertDeliverable.run(deliverable);
		}

		// decision precisa ser inserida antes de impediment (movida para cá,
		// ETAPA 11 do rework, segundo microcorte, §41/§13.4):
		// impediment.decision_id passou a referenciar decision.id (FK checada
		// imediatamente, foreign_keys = ON). decision em si não depende de
		// nenhuma outra tabela além de project, então pode nascer aqui sem
		// problema — mesmo raciocínio de risk abaixo.
		const insertDecision = db.prepare(
			`INSERT INTO decision
			   (id, project_id, subject, options, due_date, responsible, status, outcome, decided_at, created_at, updated_at)
			 VALUES
			   (@id, @projectId, @subject, @options, @dueDate, @responsible, @status, @outcome, @decidedAt, @createdAt, @updatedAt)`
		);
		for (const decision of state.decisions) {
			insertDecision.run(decision);
		}

		// work_item precisa ser inserido depois de deliverable (deliverable_id
		// referencia deliverable.id) e antes de impediment: impediment.work_item_id
		// referencia work_item.id (FK checada imediatamente, foreign_keys = ON).
		const insertWorkItem = db.prepare(
			`INSERT INTO work_item
			   (id, project_id, title, status, deliverable_id, planned_start, duration_days, created_at, updated_at)
			 VALUES
			   (@id, @projectId, @title, @status, @deliverableId, @plannedStart, @durationDays, @createdAt, @updatedAt)`
		);
		for (const item of state.workItems) {
			insertWorkItem.run(item);
		}

		// impediment também depende de decision (decision_id, ETAPA 11 do rework,
		// segundo microcorte) além de work_item — por isso vem depois dos dois
		// blocos de insert acima.
		const insertImpediment = db.prepare(
			`INSERT INTO impediment
			   (id, project_id, text, tipo, next_action, status, work_item_id, decision_id, created_at, updated_at, resolved_at)
			 VALUES
			   (@id, @projectId, @text, @tipo, @nextAction, @status, @workItemId, @decisionId, @createdAt, @updatedAt, @resolvedAt)`
		);
		for (const impediment of state.impediments) {
			insertImpediment.run(impediment);
		}

		// dependency também depende de work_item (duas FKs), então vem depois do
		// bloco de work_item acima — mesma razão de impediment.
		const insertDependency = db.prepare(
			`INSERT INTO dependency (id, project_id, work_item_id, depends_on_work_item_id, created_at)
			 VALUES (@id, @projectId, @workItemId, @dependsOnWorkItemId, @createdAt)`
		);
		for (const dependency of state.dependencies) {
			insertDependency.run(dependency);
		}

		// schedule_baseline não depende de work_item (só de project) — pode
		// nascer em qualquer ponto depois do project row. schedule_baseline_entry
		// depende dos dois (FKs checadas imediatamente, foreign_keys = ON), por
		// isso vem depois do bloco de work_item acima.
		const insertScheduleBaseline = db.prepare(
			`INSERT INTO schedule_baseline (id, project_id, created_at, version)
			 VALUES (@id, @projectId, @createdAt, @version)`
		);
		for (const baseline of state.scheduleBaselines) {
			insertScheduleBaseline.run(baseline);
		}

		const insertScheduleBaselineEntry = db.prepare(
			`INSERT INTO schedule_baseline_entry (baseline_id, work_item_id, planned_start, duration_days)
			 VALUES (@baselineId, @workItemId, @plannedStart, @durationDays)`
		);
		for (const entry of state.scheduleBaselineEntries) {
			insertScheduleBaselineEntry.run(entry);
		}

		// milestone antes de milestone_work_item, e ambos depois de work_item:
		// milestone_work_item tem FK para os dois (checagem imediata,
		// foreign_keys = ON).
		const insertMilestone = db.prepare(
			`INSERT INTO milestone (id, project_id, title, status, reached_at, planned_date, created_at, updated_at)
			 VALUES (@id, @projectId, @title, @status, @reachedAt, @plannedDate, @createdAt, @updatedAt)`
		);
		for (const milestone of state.milestones) {
			insertMilestone.run(milestone);
		}

		const insertMilestoneWorkItem = db.prepare(
			`INSERT INTO milestone_work_item (id, project_id, milestone_id, work_item_id, created_at)
			 VALUES (@id, @projectId, @milestoneId, @workItemId, @createdAt)`
		);
		for (const link of state.milestoneWorkItems) {
			insertMilestoneWorkItem.run(link);
		}

		// decision_affected_work_item (ETAPA 11 do rework, terceiro microcorte,
		// §41) depende de decision e de work_item (duas FKs) — ambos já foram
		// inseridos acima, mesma razão de milestone_work_item.
		const insertDecisionAffectedWorkItem = db.prepare(
			`INSERT INTO decision_affected_work_item (id, project_id, decision_id, work_item_id, created_at)
			 VALUES (@id, @projectId, @decisionId, @workItemId, @createdAt)`
		);
		for (const link of state.decisionAffectedWorkItems) {
			insertDecisionAffectedWorkItem.run(link);
		}

		// risk é independente (sem FK além de project) — pode ser inserido em
		// qualquer ponto depois do project row.
		const insertRisk = db.prepare(
			`INSERT INTO risk
			   (id, project_id, statement, status, closed_at, reviewed_at, likelihood, impact, response, created_at, updated_at)
			 VALUES
			   (@id, @projectId, @statement, @status, @closedAt, @reviewedAt, @likelihood, @impact, @response, @createdAt, @updatedAt)`
		);
		for (const risk of state.risks) {
			insertRisk.run(risk);
		}

		// change é independente (sem FK além de project) — mesmo raciocínio de
		// risk acima. decision (também independente) foi movida para antes de
		// work_item/impediment — ver comentário lá.
		const insertChange = db.prepare(
			`INSERT INTO change (id, project_id, statement, impact, created_at, updated_at)
			 VALUES (@id, @projectId, @statement, @impact, @createdAt, @updatedAt)`
		);
		for (const change of state.changes) {
			insertChange.run(change);
		}

		const insertAffectedGroup = db.prepare(
			`INSERT INTO affected_group (id, project_id, label, impact, frequency, created_at, updated_at)
			 VALUES (@id, @projectId, @label, @impact, @frequency, @createdAt, @updatedAt)`
		);
		for (const group of state.affectedGroups) {
			insertAffectedGroup.run(group);
		}

		// external_action depende de affected_group e decision (FK, ETAPA 14),
		// evidence depende de external_action e affected_group — ordem de
		// insert importa com foreign_keys = ON (checagem imediata, não
		// deferida); decision já foi inserida acima.
		// União discriminada (ETAPA 14, §44, D070/D072/D073): cada variante só
		// preenche as colunas do seu subject, as demais gravam NULL — nunca
		// `objective`/roteiro para `approval`, nunca `decision_id` para
		// `validate_affected_group` (ver domain/state-types.ts).
		const insertExternalAction = db.prepare(
			`INSERT INTO external_action
			   (id, project_id, kind, affected_group_id, decision_id, status, objective, questions, information_to_take, expected_result, created_at, updated_at, completed_at)
			 VALUES (@id, @projectId, @kind, @affectedGroupId, @decisionId, @status, @objective, @questions, @informationToTake, @expectedResult, @createdAt, @updatedAt, @completedAt)`
		);
		for (const action of state.externalActions) {
			if (action.kind === 'approval') {
				insertExternalAction.run({
					id: action.id,
					projectId: action.projectId,
					kind: action.kind,
					affectedGroupId: null,
					decisionId: action.decisionId,
					status: action.status,
					objective: null,
					questions: null,
					informationToTake: null,
					expectedResult: null,
					createdAt: action.createdAt,
					updatedAt: action.updatedAt,
					completedAt: action.completedAt
				});
				continue;
			}

			insertExternalAction.run({
				id: action.id,
				projectId: action.projectId,
				kind: action.kind,
				affectedGroupId: action.affectedGroupId,
				decisionId: null,
				status: action.status,
				objective: action.objective,
				questions: JSON.stringify(action.questions),
				informationToTake: JSON.stringify(action.informationToTake),
				expectedResult: action.expectedResult,
				createdAt: action.createdAt,
				updatedAt: action.updatedAt,
				completedAt: action.completedAt
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
		// impediment/dependency/milestone_work_item antes de work_item: todos
		// referenciam work_item.id (FK checada imediatamente, foreign_keys = ON).
		db.prepare('DELETE FROM impediment WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM dependency WHERE project_id = ?').run(state.project.id);
		// schedule_baseline_entry antes de schedule_baseline e de work_item (FKs
		// para os dois, checagem imediata) — schedule_baseline_entry não tem
		// coluna project_id própria, então o DELETE é indireto via subquery.
		db.prepare(
			`DELETE FROM schedule_baseline_entry
			 WHERE baseline_id IN (SELECT id FROM schedule_baseline WHERE project_id = ?)`
		).run(state.project.id);
		db.prepare('DELETE FROM schedule_baseline WHERE project_id = ?').run(state.project.id);
		// milestone_work_item antes de milestone e de work_item (FKs para ambos).
		db.prepare('DELETE FROM milestone_work_item WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM milestone WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM risk WHERE project_id = ?').run(state.project.id);
		// evidence/external_action apagados antes de affected_group E de
		// decision — external_action referencia affected_group sempre e
		// decision quando kind='approval' (ETAPA 14, §44); ambas as FKs são
		// sem ON DELETE, checagem imediata.
		db.prepare('DELETE FROM evidence WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM external_action WHERE project_id = ?').run(state.project.id);
		// decision_affected_work_item antes de decision e de work_item (FKs para
		// ambos, ETAPA 11 do rework, terceiro microcorte, §41) — mesmo raciocínio
		// de milestone_work_item acima.
		db.prepare('DELETE FROM decision_affected_work_item WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM decision WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM change WHERE project_id = ?').run(state.project.id);
		// work_item antes de deliverable (ETAPA 9, segundo microcorte):
		// work_item.deliverable_id referencia deliverable.id.
		db.prepare('DELETE FROM work_item WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM deliverable WHERE project_id = ?').run(state.project.id);
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

			const deliverableRows = db
				.prepare(
					`SELECT id, project_id, title, bucket, effort, item_order, source_scope_item_id, created_at, updated_at
					 FROM deliverable WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as DeliverableRow[];

			const impedimentRows = db
				.prepare(
					`SELECT id, project_id, text, tipo, next_action, status, work_item_id, decision_id, created_at, updated_at, resolved_at
					 FROM impediment WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ImpedimentRow[];

			const workItemRows = db
				.prepare(
					`SELECT id, project_id, title, status, deliverable_id, planned_start, duration_days, created_at, updated_at
					 FROM work_item WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as WorkItemRow[];

			const dependencyRows = db
				.prepare(
					`SELECT id, project_id, work_item_id, depends_on_work_item_id, created_at
					 FROM dependency WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as DependencyRow[];

			const scheduleBaselineRows = db
				.prepare(
					`SELECT id, project_id, created_at, version
					 FROM schedule_baseline WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ScheduleBaselineRow[];

			const scheduleBaselineEntryRows = db
				.prepare(
					`SELECT baseline_id, work_item_id, planned_start, duration_days
					 FROM schedule_baseline_entry
					 WHERE baseline_id IN (SELECT id FROM schedule_baseline WHERE project_id = ?)
					 ORDER BY rowid`
				)
				.all(projectId) as ScheduleBaselineEntryRow[];

			const milestoneRows = db
				.prepare(
					`SELECT id, project_id, title, status, reached_at, planned_date, created_at, updated_at
					 FROM milestone WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as MilestoneRow[];

			const milestoneWorkItemRows = db
				.prepare(
					`SELECT id, project_id, milestone_id, work_item_id, created_at
					 FROM milestone_work_item WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as MilestoneWorkItemRow[];

			const riskRows = db
				.prepare(
					`SELECT id, project_id, statement, status, closed_at, reviewed_at, likelihood, impact, response,
					        created_at, updated_at
					 FROM risk WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as RiskRow[];

			const decisionRows = db
				.prepare(
					`SELECT id, project_id, subject, options, due_date, responsible, status, outcome, decided_at, created_at, updated_at
					 FROM decision WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as DecisionRow[];

			const decisionAffectedWorkItemRows = db
				.prepare(
					`SELECT id, project_id, decision_id, work_item_id, created_at
					 FROM decision_affected_work_item WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as DecisionAffectedWorkItemRow[];

			const changeRows = db
				.prepare(
					`SELECT id, project_id, statement, impact, created_at, updated_at
					 FROM change WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ChangeRow[];

			const affectedGroupRows = db
				.prepare(
					`SELECT id, project_id, label, impact, frequency, created_at, updated_at
					 FROM affected_group WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as AffectedGroupRow[];

			const externalActionRows = db
				.prepare(
					`SELECT id, project_id, kind, affected_group_id, decision_id, status, objective, questions, information_to_take, expected_result, created_at, updated_at, completed_at
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
				deliverables: deliverableRows.map(mapDeliverableRow),
				impediments: impedimentRows.map(mapImpedimentRow),
				workItems: workItemRows.map(mapWorkItemRow),
				dependencies: dependencyRows.map(mapDependencyRow),
				scheduleBaselines: scheduleBaselineRows.map(mapScheduleBaselineRow),
				scheduleBaselineEntries: scheduleBaselineEntryRows.map(mapScheduleBaselineEntryRow),
				milestones: milestoneRows.map(mapMilestoneRow),
				milestoneWorkItems: milestoneWorkItemRows.map(mapMilestoneWorkItemRow),
				risks: riskRows.map(mapRiskRow),
				decisions: decisionRows.map(mapDecisionRow),
				decisionAffectedWorkItems: decisionAffectedWorkItemRows.map(mapDecisionAffectedWorkItemRow),
				changes: changeRows.map(mapChangeRow),
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
