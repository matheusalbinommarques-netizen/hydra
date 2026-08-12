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

-- Cockpit, vertical 2, fatia "Impedimentos" — ver app/src/lib/domain/state-types.ts.
-- Coleção independente do catálogo: sem activity_definition_id, não gera
-- pending_item, manipulada direto pela tela /cockpit.
CREATE TABLE IF NOT EXISTS impediment (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	text TEXT NOT NULL,
	tipo TEXT NOT NULL CHECK (
		tipo IN ('dependencia_externa', 'decisao_pendente', 'falta_de_recurso', 'bloqueio_tecnico', 'outro')
	),
	next_action TEXT,
	status TEXT NOT NULL CHECK (status IN ('aberto', 'resolvido')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	resolved_at TEXT,
	CHECK (
		(status = 'aberto' AND resolved_at IS NULL) OR
		(status = 'resolvido' AND resolved_at IS NOT NULL)
	)
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
