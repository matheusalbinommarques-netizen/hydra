-- Schema inicial (versão 1) — deriva diretamente dos tipos de ProjectState
-- (app/src/lib/domain/state-types.ts). Nenhuma estratégia de migração além
-- desta aplicação determinística está decidida nesta versão.

CREATE TABLE IF NOT EXISTS project (
	id TEXT PRIMARY KEY,
	name TEXT,
	created_at TEXT NOT NULL
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
