-- Schema inicial (versão 1) — deriva diretamente dos tipos de ProjectState
-- (app/src/lib/domain/state-types.ts). Nenhuma estratégia de migração além
-- desta aplicação determinística está decidida nesta versão.

-- route_start_phase_id (D023, docs/07-management/decision-log.md): fase do
-- catálogo em que o projeto realmente começa; NULL = percurso completo.
-- Bancos criados antes de D023 recebem esta coluna via ALTER TABLE
-- idempotente em sqlite-project-repository.ts (createSqliteProjectRepository),
-- não aqui — CREATE TABLE IF NOT EXISTS não afeta tabelas já existentes.
CREATE TABLE IF NOT EXISTS project (
	id TEXT PRIMARY KEY,
	name TEXT,
	created_at TEXT NOT NULL,
	route_start_phase_id TEXT
);

CREATE TABLE IF NOT EXISTS activity_progress (
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	activity_definition_id TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('não_iniciada', 'em_andamento', 'concluída', 'pulada')),
	PRIMARY KEY (project_id, activity_definition_id)
);

CREATE TABLE IF NOT EXISTS answer (
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	activity_definition_id TEXT NOT NULL,
	field_definition_id TEXT NOT NULL,
	value TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	PRIMARY KEY (project_id, activity_definition_id, field_definition_id)
);

CREATE TABLE IF NOT EXISTS pending_item (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	activity_definition_id TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('aberta', 'resolvida')),
	created_at TEXT NOT NULL,
	resolved_at TEXT,
	UNIQUE (project_id, activity_definition_id),
	CHECK (
		(status = 'aberta' AND resolved_at IS NULL) OR
		(status = 'resolvida' AND resolved_at IS NOT NULL)
	)
);

-- Escopo da "Escolha o próximo foco" (scope_confirmation) — ver
-- app/src/lib/domain/state-types.ts. item_order (não "order", palavra
-- reservada em SQL) só é preenchido para bucket = 'agora'.
-- execution_status (D025, docs/07-management/decision-log.md): status de
-- execução do primeiro backlog executável, só relevante para bucket =
-- 'agora'. Bancos criados antes de D025 recebem esta coluna via ALTER
-- TABLE idempotente em sqlite-project-repository.ts
-- (createSqliteProjectRepository), não aqui.
CREATE TABLE IF NOT EXISTS scope_item (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	text TEXT NOT NULL,
	bucket TEXT NOT NULL CHECK (bucket IN ('agora', 'depois', 'fora')),
	effort TEXT CHECK (effort IN ('pequeno', 'medio', 'grande')),
	item_order INTEGER,
	-- Rastreia a sugestão estruturada aceita que originou este item (ver
	-- orientation-engine/scope-suggestions.ts) — null para item manual.
	source_suggestion_id TEXT,
	execution_status TEXT NOT NULL DEFAULT 'a_fazer' CHECK (execution_status IN ('a_fazer', 'em_andamento', 'concluido')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CHECK (
		(bucket = 'agora' AND item_order IS NOT NULL) OR
		(bucket != 'agora' AND item_order IS NULL)
	)
);

-- 1:1 com project — sempre exatamente uma linha por projeto, criada junto
-- com ele (ver createInitialProjectState).
CREATE TABLE IF NOT EXISTS scope_version (
	project_id TEXT PRIMARY KEY REFERENCES project (id) ON DELETE CASCADE,
	hypothesis TEXT NOT NULL,
	confirmed_at TEXT
);

-- Trabalho — ETAPA 6 do rework ("Primeiro loop operacional", D035,
-- docs/core/HYDRA_PRODUCT_REWORK.md §35/§36). Camada de execução, distinta de
-- Deliverable (ainda não introduzida): unidade executável mínima, sem
-- activity_definition_id, sem colunas de responsável/prazo/prioridade/
-- estimativa (fora desta etapa). "Bloqueado" nunca é uma coluna aqui — é
-- sempre derivado de impediment.work_item_id (ver abaixo).
CREATE TABLE IF NOT EXISTS work_item (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('a_fazer', 'em_andamento', 'concluido')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- Cockpit, vertical 2, fatia "Impedimentos" — ver app/src/lib/domain/state-types.ts.
-- Coleção independente do catálogo: sem activity_definition_id, não gera
-- pending_item, manipulada direto pela tela /cockpit.
-- work_item_id (ETAPA 6 do rework): vínculo opcional com o WorkItem que este
-- impedimento bloqueia — NULL continua sendo o caso normal (Impediment
-- sempre pôde existir no nível do projeto, sem relação com nenhum item de
-- trabalho). Bancos criados antes desta etapa recebem esta coluna via ALTER
-- TABLE idempotente em sqlite-project-repository.ts, não aqui.
CREATE TABLE IF NOT EXISTS impediment (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	text TEXT NOT NULL,
	tipo TEXT NOT NULL CHECK (
		tipo IN ('dependencia_externa', 'decisao_pendente', 'falta_de_recurso', 'bloqueio_tecnico', 'outro')
	),
	next_action TEXT,
	status TEXT NOT NULL CHECK (status IN ('aberto', 'resolvido')),
	work_item_id TEXT REFERENCES work_item (id),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	resolved_at TEXT,
	CHECK (
		(status = 'aberto' AND resolved_at IS NULL) OR
		(status = 'resolvido' AND resolved_at IS NOT NULL)
	)
);

-- Dependency (ETAPA 8 do rework, primeiro microcorte) — ver
-- app/src/lib/domain/state-types.ts. Precedência planejada entre dois
-- work_item do mesmo projeto ("A depende da conclusão de B"), nunca bloqueio
-- operacional: não existe coluna de status aqui, "aguardando" é sempre
-- derivado do status do predecessor na leitura, mesmo espírito de
-- impediment.work_item_id → "bloqueado". Sem updated_at: a relação é
-- imutável (só nasce e é removida, mesmo molde de evidence).
-- As duas CHECK/UNIQUE abaixo cobrem invariantes realmente fechados da
-- própria relação (R7/D038): auto-referência e par duplicado. Ciclo
-- transitivo NÃO é expressável em CHECK — fica no domínio
-- (addDependency) e na desserialização.
CREATE TABLE IF NOT EXISTS dependency (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	work_item_id TEXT NOT NULL REFERENCES work_item (id),
	depends_on_work_item_id TEXT NOT NULL REFERENCES work_item (id),
	created_at TEXT NOT NULL,
	CONSTRAINT dependency_no_self_reference CHECK (work_item_id <> depends_on_work_item_id),
	CONSTRAINT dependency_unique_pair UNIQUE (work_item_id, depends_on_work_item_id)
);

-- Mapa de Impacto ("Quem é afetado", ETAPA 2 do rework) — ver
-- app/src/lib/domain/state-types.ts. Ligado à atividade `publico` do
-- catálogo (completion deriva do estado destes grupos, ver
-- domain/transitions.ts, confirmAffectedGroups), mas sem
-- activity_definition_id próprio: a ligação é fixa, não um dado armazenado
-- por linha. impact/frequency aceitam NULL (por classificar) além dos
-- literais aprovados — 'desconhecido' é uma resposta explícita do usuário
-- ("Ainda não sabemos"), diferente de NULL.
CREATE TABLE IF NOT EXISTS affected_group (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	label TEXT NOT NULL,
	impact TEXT CHECK (impact IN ('alto', 'medio', 'baixo', 'desconhecido')),
	frequency TEXT CHECK (frequency IN ('constante', 'frequente', 'as_vezes', 'raro', 'desconhecido')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- ExternalAction / Evidence (ETAPA 3 do rework, "Evidence + primeira
-- External Action") — ver app/src/lib/domain/state-types.ts. affected_group_id
-- não usa ON DELETE CASCADE/SET NULL: a referência bloqueia a remoção do
-- grupo (aplicado em domain/transitions.ts, removeAffectedGroup, antes de
-- qualquer SQL rodar) — o padrão NO ACTION do SQLite aqui é só defesa em
-- profundidade, nunca o mecanismo primário. questions/information_to_take
-- guardam um array JSON em TEXT (mesmo espírito de PlanningItem dentro de
-- Answer.value, aqui decodificado no mapper em vez de domain/).
CREATE TABLE IF NOT EXISTS external_action (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	kind TEXT NOT NULL CHECK (kind IN ('validate_affected_group')),
	affected_group_id TEXT NOT NULL REFERENCES affected_group (id),
	status TEXT NOT NULL CHECK (status IN ('aberta', 'concluida')),
	objective TEXT NOT NULL,
	questions TEXT NOT NULL,
	information_to_take TEXT NOT NULL,
	expected_result TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	completed_at TEXT,
	CHECK (
		(status = 'aberta' AND completed_at IS NULL) OR
		(status = 'concluida' AND completed_at IS NOT NULL)
	)
);

-- kind fixo 'conversation' nesta primeira versão (sem taxonomia genérica de
-- Evidence, ver HYDRA_PRODUCT_REWORK.md §33/§20). Sem ON DELETE em
-- external_action_id/affected_group_id pelo mesmo motivo de external_action
-- acima — a integridade real é garantida pelo domínio (completeExternalAction
-- é a única transição que cria uma linha aqui).
CREATE TABLE IF NOT EXISTS evidence (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	external_action_id TEXT NOT NULL REFERENCES external_action (id),
	affected_group_id TEXT NOT NULL REFERENCES affected_group (id),
	kind TEXT NOT NULL CHECK (kind IN ('conversation')),
	outcome TEXT NOT NULL CHECK (outcome IN ('confirmed', 'partially_confirmed', 'contradicted', 'new_discovery')),
	learning TEXT NOT NULL,
	created_at TEXT NOT NULL
);

-- Tratamento atual — Descoberta, "Como é tratado hoje" (Stage 4A do rework,
-- ver app/src/lib/domain/state-types.ts). 1:1 com project (mesmo molde de
-- scope_version): o cabeçalho que guarda noTreatment; a cadeia ordenada de
-- passos vive em treatment_step, abaixo.
CREATE TABLE IF NOT EXISTS current_treatment (
	project_id TEXT PRIMARY KEY REFERENCES project (id) ON DELETE CASCADE,
	no_treatment INTEGER NOT NULL CHECK (no_treatment IN (0, 1)),
	updated_at TEXT NOT NULL
);

-- actors/frictions: JSON array em TEXT — mesmo padrão de encoding já usado
-- por external_action.questions/information_to_take (ver mappers.ts).
CREATE TABLE IF NOT EXISTS treatment_step (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	step_order INTEGER NOT NULL,
	what_happens TEXT NOT NULL,
	actors TEXT NOT NULL,
	medium TEXT,
	frictions TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- Hipóteses de causa — Descoberta, "Entender as causas" (Stage 4B do rework,
-- ver app/src/lib/domain/state-types.ts). 1:1 com project (mesmo molde de
-- current_treatment): o cabeçalho que guarda stillUnknown; a coleção de
-- hipóteses vive em cause_hypothesis, abaixo.
CREATE TABLE IF NOT EXISTS cause_exploration (
	project_id TEXT PRIMARY KEY REFERENCES project (id) ON DELETE CASCADE,
	still_unknown INTEGER NOT NULL CHECK (still_unknown IN (0, 1)),
	updated_at TEXT NOT NULL
);

-- evidence_ids: JSON array em TEXT — mesmo padrão de encoding já usado por
-- treatment_step.actors/frictions acima (ver mappers.ts). Sem FK própria:
-- referencia Evidence por id, validado em domain/serialization.ts, nunca
-- pelo schema (Evidence nunca é removida, então uma FK aqui não traria
-- integridade adicional real, só complexidade).
CREATE TABLE IF NOT EXISTS cause_hypothesis (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	origin TEXT,
	expected_if_true TEXT,
	what_weakens_it TEXT,
	evidence_ids TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- Resultado desejado — Descoberta, "Resultado desejado" (Stage 4C do rework,
-- ver app/src/lib/domain/state-types.ts). Coleção ordenada ligada ao
-- projeto, mesmo molde de treatment_step (outcome_order, sem FK própria além
-- de project_id — nunca referencia affected_group: beneficiário/percepção do
-- modelo antigo não têm equivalente aqui).
CREATE TABLE IF NOT EXISTS desired_outcome (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	change TEXT NOT NULL,
	target TEXT,
	outcome_order INTEGER NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- Event log incremental — ETAPA 7 do rework ("Event log incremental", ver
-- app/src/lib/domain/events.ts). Histórico auxiliar append-only: nunca
-- apagado por saveTransaction (ao contrário de todas as tabelas acima, que
-- são DELETE + reinsert a cada save), nunca usado para reconstruir
-- ProjectState. Coleção 0:N que legitimamente começa vazia — sem função
-- ensureX de backfill (mesmo padrão de work_item/impediment na ETAPA 6:
-- CREATE TABLE IF NOT EXISTS já é suficiente para bancos existentes, um
-- projeto pré-S7 simplesmente não tem nenhuma linha aqui). payload é JSON em
-- TEXT, mesmo padrão de encoding já usado por
-- treatment_step.actors/external_action.questions acima.
--
-- type/entity_type SEM CHECK de enumeração (R1 da remediação): são
-- discriminantes deliberadamente extensíveis — cada corte futuro que
-- introduz um objeto vivo novo acrescenta tipos de evento. A validação
-- continua existindo e é exaustiva, mas no lugar certo: a união fechada
-- ProjectEvent em app/src/lib/domain/events.ts, checada pelo compilador.
--
-- Por que não CHECK aqui: a primeira versão enumerava os quatro tipos do
-- loop WorkItem/Impediment. Como CREATE TABLE IF NOT EXISTS é no-op numa
-- tabela que já existe, todo banco criado antes deste corte manteria o CHECK
-- antigo e passaria a REJEITAR eventos de tipo novo — e, como save() grava
-- estado e eventos na mesma transação, o INSERT recusado derrubaria a
-- operação de domínio inteira, não só o log. Bancos existentes são
-- convertidos por ensureProjectEventTaxonomyOpen em
-- sqlite-project-repository.ts.
--
-- Regra geral derivada deste corte: CHECK de banco para invariante realmente
-- fechado (ex.: work_item.status); sem CHECK para discriminante extensível
-- (este caso). Toda CHECK que deliberadamente permanecer no schema daqui em
-- diante deve ser NOMEADA (CONSTRAINT <nome> CHECK (...)) — o SQLite 3.53+
-- suporta ALTER TABLE ... DROP CONSTRAINT, mas só alcança constraints com
-- nome; as anônimas exigem rebuild da tabela inteira.
CREATE TABLE IF NOT EXISTS project_event (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	type TEXT NOT NULL,
	entity_type TEXT NOT NULL,
	entity_id TEXT NOT NULL,
	payload TEXT NOT NULL,
	created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_project_event_project_id ON project_event (project_id);
CREATE INDEX IF NOT EXISTS idx_project_event_entity_id ON project_event (entity_id);

-- Índices de project_id (R5, ENGINEERING_REMEDIATION.md) — só nas tabelas
-- cuja PK não cobre project_id como coluna líder (scope_version,
-- current_treatment, cause_exploration usam project_id como PK; project_id
-- é a coluna líder da PK composta de activity_progress/answer; pending_item
-- tem UNIQUE(project_id, activity_definition_id)). As sete tabelas abaixo
-- têm `id` como PK e nenhuma outra constraint cobrindo project_id, então
-- toda leitura por project_id em findById()/save() fazia table scan.
-- CREATE INDEX IF NOT EXISTS roda a cada abertura (db.exec(initSql) em
-- createSqliteProjectRepository), então também cobre bancos já existentes.
CREATE INDEX IF NOT EXISTS idx_scope_item_project_id ON scope_item (project_id);
CREATE INDEX IF NOT EXISTS idx_impediment_project_id ON impediment (project_id);
CREATE INDEX IF NOT EXISTS idx_work_item_project_id ON work_item (project_id);
-- idx_impediment_work_item_id NÃO fica aqui: work_item_id é uma coluna nova
-- em impediment, adicionada via ALTER TABLE idempotente em
-- sqlite-project-repository.ts (ensureImpedimentWorkItemIdColumn) para bancos
-- criados antes da ETAPA 6 — indexá-la aqui quebraria a inicialização desses
-- bancos (a coluna ainda não existiria neste ponto do exec). O índice é
-- criado junto com a coluna, na própria função idempotente.
CREATE INDEX IF NOT EXISTS idx_dependency_project_id ON dependency (project_id);
CREATE INDEX IF NOT EXISTS idx_affected_group_project_id ON affected_group (project_id);
CREATE INDEX IF NOT EXISTS idx_external_action_project_id ON external_action (project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_project_id ON evidence (project_id);
CREATE INDEX IF NOT EXISTS idx_treatment_step_project_id ON treatment_step (project_id);
CREATE INDEX IF NOT EXISTS idx_cause_hypothesis_project_id ON cause_hypothesis (project_id);
CREATE INDEX IF NOT EXISTS idx_desired_outcome_project_id ON desired_outcome (project_id);
