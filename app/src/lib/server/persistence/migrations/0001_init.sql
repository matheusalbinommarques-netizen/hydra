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

-- Entregas — ETAPA 9 do rework ("Do escopo ao trabalho — corredor de
-- entrega", Design Gate S9). Camada de priorização/escopo, distinta de
-- scope_item e de work_item: nenhuma coluna de status, progresso,
-- responsável, critério de aceite ou data, e nenhuma relação com work_item
-- neste corte.
--
-- source_scope_item_id é PROVENIÊNCIA, não integridade referencial: é
-- deliberadamente uma coluna TEXT sem REFERENCES, porque remover o
-- scope_item de origem NÃO pode remover nem impedir a entrega (proveniência
-- órfã é estado válido) — uma FK operacional, com ou sem ON DELETE, mudaria
-- essa semântica. A unicidade (uma origem promove no máximo uma entrega) é
-- garantida por índice único parcial, que ignora as entregas nativas (NULL).
--
-- Tabela NOVA: `CREATE TABLE IF NOT EXISTS` basta para bancos já existentes,
-- que passam a abrir com a coleção vazia. Nenhum backfill é feito nem seria
-- correto: promover scope_item é CONFIRM-TO-CONVERT, ato explícito do
-- usuário, nunca migration.
CREATE TABLE IF NOT EXISTS deliverable (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	bucket TEXT NOT NULL CHECK (bucket IN ('agora', 'depois', 'fora')),
	effort TEXT CHECK (effort IN ('pequeno', 'medio', 'grande')),
	item_order INTEGER,
	source_scope_item_id TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CONSTRAINT deliverable_order_matches_bucket CHECK (
		(bucket = 'agora' AND item_order IS NOT NULL) OR
		(bucket != 'agora' AND item_order IS NULL)
	)
);

-- Trabalho — ETAPA 6 do rework ("Primeiro loop operacional", D035,
-- docs/core/HYDRA_PRODUCT_REWORK.md §35/§36). Camada de execução, distinta de
-- Deliverable: unidade executável mínima, sem activity_definition_id, sem
-- colunas de responsável/prazo/prioridade/estimativa (fora desta etapa).
-- "Bloqueado" nunca é uma coluna aqui — é sempre derivado de
-- impediment.work_item_id (ver abaixo).
--
-- deliverable_id (ETAPA 9 do rework, segundo microcorte, D043/D044) —
-- vínculo real e opcional com a Deliverable de origem, ao contrário de
-- deliverable.source_scope_item_id (proveniência, sem FK): aqui a relação é
-- de pertencimento real, então tem REFERENCES de verdade. Cardinalidade 1
-- Deliverable → 0..N WorkItem, WorkItem → 0..1 Deliverable. Sem
-- ON DELETE CASCADE nem ON DELETE SET NULL: excluir uma Deliverable não pode
-- apagar o WorkItem, e o `null` que resulta da desassociação é sempre
-- escrito pelo domínio (removeDeliverable/setWorkItemDeliverable em
-- transitions.ts) antes da gravação, nunca pelo SQLite. Bancos criados antes
-- deste corte recebem esta coluna via ALTER TABLE idempotente em
-- sqlite-project-repository.ts, não aqui (mesmo padrão de
-- ensureImpedimentWorkItemIdColumn/ETAPA 6).
--
-- planned_start/duration_days (ETAPA 12 do rework, "Scheduling e Gantt",
-- §42, primeiro microcorte fundacional) — fato temporal MANUAL e declarado,
-- sem precedência, propagação, folga, caminho crítico ou baseline (próximos
-- itens da lista incremental de §42, ainda não implementados). planned_start
-- é data CIVIL YYYY-MM-DD (mesmo formato/CHECK de milestone.planned_date);
-- duration_days é dias corridos, inteiro >= 1. NULL/NULL é o caso normal e
-- permanentemente válido. A invariante do par fechado é garantida SEMPRE
-- pelo domínio (setWorkItemSchedule) e pela desserialização, e pela CHECK
-- cruzada `work_item_schedule_pair` abaixo APENAS em bancos criados do zero
-- por este corte — mesmo padrão de `risk_assessment_pair` (D051): SQLite não
-- permite anexar CHECK a uma tabela já existente via ALTER TABLE, então um
-- banco criado antes deste corte recebe as duas colunas via ALTER TABLE
-- idempotente (ensureWorkItemScheduleColumns), sem CHECK cruzada nenhuma
-- sobre elas — a proteção de banco nesse caso é só de FORMATO/POSITIVIDADE
-- por coluna, nunca do par.
CREATE TABLE IF NOT EXISTS work_item (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('a_fazer', 'em_andamento', 'concluido')),
	deliverable_id TEXT REFERENCES deliverable (id),
	planned_start TEXT,
	duration_days INTEGER,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CONSTRAINT work_item_planned_start_format CHECK (
		planned_start IS NULL OR planned_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
	),
	CONSTRAINT work_item_duration_days_positive CHECK (duration_days IS NULL OR duration_days >= 1),
	CONSTRAINT work_item_schedule_pair CHECK (
		(planned_start IS NULL AND duration_days IS NULL) OR (planned_start IS NOT NULL AND duration_days IS NOT NULL)
	)
);

-- Cockpit, vertical 2, fatia "Impedimentos" — ver app/src/lib/domain/state-types.ts.
-- Coleção independente do catálogo: sem activity_definition_id, não gera
-- pending_item, manipulada direto pela tela /cockpit.
-- work_item_id (ETAPA 6 do rework): vínculo opcional com o WorkItem que este
-- impedimento bloqueia — NULL continua sendo o caso normal (Impediment
-- sempre pôde existir no nível do projeto, sem relação com nenhum item de
-- trabalho). Bancos criados antes desta etapa recebem esta coluna via ALTER
-- TABLE idempotente em sqlite-project-repository.ts, não aqui.
-- decision_id (ETAPA 11 do rework, segundo microcorte, §41/§13.4): vínculo
-- opcional com a Decision que responde "qual decisão está pendente neste
-- impedimento?" — NULL é o caso normal; só é válido junto com
-- `tipo = 'decisao_pendente'` (garantido por setImpedimentDecision/
-- setImpedimentType em domain/transitions.ts, reforçado na desserialização,
-- não por CHECK aqui — a mesma razão de work_item_id não ter CHECK contra
-- status). Bancos criados antes deste corte recebem esta coluna via ALTER
-- TABLE idempotente (ensureImpedimentDecisionIdColumn), mesmo padrão.
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
	decision_id TEXT REFERENCES decision (id),
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

-- ProjectScheduleBaseline (ETAPA 12 do rework, "Scheduling e Gantt", §42,
-- quinto microcorte, hardening pós-dogfood) — ver
-- app/src/lib/domain/state-types.ts. REFERÊNCIA explicitamente aprovada
-- pelo usuário, IMUTÁVEL: nasce inteira por captureScheduleBaseline (nunca
-- UPDATE), e capturar de novo insere uma nova linha em vez de sobrescrever
-- — sem coluna de status "ativa". `version` (hardening) prova a ordem real
-- de captura: inteiro positivo, monotônico por projeto (primeira = 1,
-- próxima = maior já existente + 1) — a baseline ativa é sempre derivada
-- na leitura como a de maior `version`, nunca por `created_at`/`id`
-- (nenhum dos dois sobrevive a duas capturas no mesmo instante ou a um
-- relógio não estritamente monotônico). A UNIQUE nomeada abaixo é a mesma
-- invariante de unicidade por projeto que a desserialização também
-- reforça (validateInvariants, domain/serialization.ts). Sem `partial`:
-- cobertura é sempre DERIVADA varrendo schedule_baseline_entry por
-- baseline_id (existe alguma linha com planned_start/duration_days NULL?)
-- — segunda fonte da mesma verdade seria redundante. Tabela nova (mesmo
-- caso de `decision`/`risk` desde D053/D049): não exige `ensureX` de
-- backfill — um banco anterior a este corte simplesmente ainda não tem a
-- tabela, e `CREATE TABLE IF NOT EXISTS` sozinho já basta.
CREATE TABLE IF NOT EXISTS schedule_baseline (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	created_at TEXT NOT NULL,
	version INTEGER NOT NULL CHECK (version >= 1),
	CONSTRAINT schedule_baseline_unique_version UNIQUE (project_id, version)
);

-- ProjectScheduleBaselineEntry — sem coluna `id` própria (ver
-- state-types.ts): a chave primária composta (baseline_id, work_item_id)
-- já é a chave natural e única da relação, que nunca é lida, alterada ou
-- removida isoladamente fora da baseline inteira.
--
-- planned_start/duration_days (hardening pós-dogfood) — MEMBERSHIP: toda
-- captura grava uma linha para CADA WorkItem existente naquele instante,
-- com ou sem schedule — null/null é estado LEGÍTIMO (o WorkItem existia,
-- mas não tinha schedule ainda), nunca um dos dois sozinho. Ausência de
-- linha para um WorkItem+baseline é o único jeito de expressar "não
-- existia ainda" — nunca inferido de work_item.created_at. A CHECK
-- cruzada do par é nomeada e cabe aqui (ao contrário de
-- work_item_schedule_pair — ver comentário em work_item acima): esta
-- tabela é nova por este corte, então toda instância dela (fresh ou
-- upgrade futuro) já nasce com a CHECK, sem o caso de banco pré-existente
-- sem ela.
CREATE TABLE IF NOT EXISTS schedule_baseline_entry (
	baseline_id TEXT NOT NULL REFERENCES schedule_baseline (id),
	work_item_id TEXT NOT NULL REFERENCES work_item (id),
	planned_start TEXT,
	duration_days INTEGER,
	PRIMARY KEY (baseline_id, work_item_id),
	CONSTRAINT schedule_baseline_entry_planned_start_format CHECK (
		planned_start IS NULL OR planned_start GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
	),
	CONSTRAINT schedule_baseline_entry_duration_days_positive CHECK (duration_days IS NULL OR duration_days >= 1),
	CONSTRAINT schedule_baseline_entry_schedule_pair CHECK (
		(planned_start IS NULL AND duration_days IS NULL) OR (planned_start IS NOT NULL AND duration_days IS NOT NULL)
	)
);

-- Milestone (ETAPA 8 do rework, segundo microcorte) — ver
-- app/src/lib/domain/state-types.ts. Checkpoint DECLARADO no nível do
-- projeto: status é a única autoridade sobre aberto/alcancado, nunca
-- derivado do trabalho relacionado. Sem description e sem order (ordenação é
-- Roadmap, §38) — nada aqui é antecipado por uso futuro.
--
-- planned_date (microcorte de Timeline, §38) — data CIVIL YYYY-MM-DD, o dia
-- em que a equipe planeja alcançar o marco. NULL é o caso normal e
-- permanentemente válido. Deliberadamente NÃO participa de nenhuma CHECK
-- cruzada com status/reached_at: marco alcançado com data planejada futura ou
-- passada é estado legítimo, não inconsistência.
--
-- As três CHECK abaixo são NOMEADAS, como a regra derivada no fim deste
-- arquivo exige. As duas primeiras cobrem invariantes realmente FECHADAS
-- (R7/D038), não discriminante extensível: o conjunto de status do lifecycle,
-- e o par (status, reached_at), que reachMilestone/reopenMilestone sempre
-- alteram atomicamente — aberto => reached_at IS NULL; alcancado =>
-- reached_at IS NOT NULL.
--
-- A terceira é honestamente só defesa de FORMATO, não validação calendárica:
-- o GLOB recusa timestamp ISO completo e formato local, mas aceitaria
-- 2026-02-30. A validade real da data continua garantida em um único lugar —
-- isCivilDate (domain/civil-date.ts), aplicado na transição e na
-- desserialização. Nenhuma segunda implementação da regra vive aqui.
CREATE TABLE IF NOT EXISTS milestone (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	status TEXT NOT NULL,
	reached_at TEXT,
	planned_date TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CONSTRAINT milestone_status_values CHECK (status IN ('aberto', 'alcancado')),
	CONSTRAINT milestone_reached_at_matches_status CHECK (
		(status = 'aberto' AND reached_at IS NULL) OR (status = 'alcancado' AND reached_at IS NOT NULL)
	),
	CONSTRAINT milestone_planned_date_format CHECK (
		planned_date IS NULL OR planned_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
	)
);

-- MilestoneWorkItem — "trabalho relacionado/contribuinte para este marco",
-- N:N opcional dos dois lados. NÃO é conjunto exaustivo de condições: item
-- aberto não impede alcançar o marco, item concluído não o alcança. Sem
-- updated_at: a relação é imutável (só nasce e é removida, mesmo molde de
-- dependency/evidence). A UNIQUE nomeada cobre o único invariante fechado da
-- relação — o mesmo trabalho não se associa duas vezes ao mesmo marco.
CREATE TABLE IF NOT EXISTS milestone_work_item (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	milestone_id TEXT NOT NULL REFERENCES milestone (id),
	work_item_id TEXT NOT NULL REFERENCES work_item (id),
	created_at TEXT NOT NULL,
	CONSTRAINT milestone_work_item_unique_pair UNIQUE (milestone_id, work_item_id)
);

-- Risk (ETAPA 10 do rework, primeiro microcorte, D049; reviewed_at no
-- segundo microcorte) — ver app/src/lib/domain/state-types.ts. Objeto em
-- nível de projeto, sem FK para work_item/deliverable/milestone/impediment
-- nesta primeira fatia. `status` é a única autoridade sobre aberto/encerrado,
-- nunca derivado. `reviewed_at` é fato individual sem relação com o
-- lifecycle: nulo até a primeira revisão, sem CHECK de par (ao contrário de
-- closed_at, não há combinação de status que o torne obrigatório).
--
-- As duas CHECK abaixo são NOMEADAS, mesma regra de milestone acima: a
-- primeira cobre o conjunto fechado de status do lifecycle, a segunda o par
-- (status, closed_at), que closeRisk/reopenRisk sempre alteram atomicamente
-- — aberto => closed_at IS NULL; encerrado => closed_at IS NOT NULL.
--
-- Bancos criados entre D049 e este corte recebem reviewed_at via ALTER TABLE
-- idempotente em sqlite-project-repository.ts (ensureRiskReviewedAtColumn).
--
-- likelihood/impact/response (ETAPA 10 do rework, terceiro microcorte) —
-- avaliação qualitativa e resposta planejada, ambas opcionais. A CHECK
-- nomeada abaixo espelha risk_closed_at_matches_status: likelihood e
-- impact são sempre ambos NULL (sem avaliação) ou ambos preenchidos —
-- nunca um sozinho. Bancos criados entre este corte e o anterior recebem as
-- três colunas via ALTER TABLE idempotente
-- (ensureRiskAssessmentAndResponseColumns).
CREATE TABLE IF NOT EXISTS risk (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	statement TEXT NOT NULL,
	status TEXT NOT NULL,
	closed_at TEXT,
	reviewed_at TEXT,
	likelihood TEXT,
	impact TEXT,
	response TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CONSTRAINT risk_status_values CHECK (status IN ('aberto', 'encerrado')),
	CONSTRAINT risk_closed_at_matches_status CHECK (
		(status = 'aberto' AND closed_at IS NULL) OR (status = 'encerrado' AND closed_at IS NOT NULL)
	),
	CONSTRAINT risk_likelihood_values CHECK (likelihood IS NULL OR likelihood IN ('baixa', 'media', 'alta')),
	CONSTRAINT risk_impact_values CHECK (impact IS NULL OR impact IN ('baixo', 'medio', 'alto')),
	CONSTRAINT risk_assessment_pair CHECK (
		(likelihood IS NULL AND impact IS NULL) OR (likelihood IS NOT NULL AND impact IS NOT NULL)
	)
);

-- Decision (ETAPA 11 do rework, primeiro microcorte, §41) — ver
-- app/src/lib/domain/state-types.ts. Objeto em nível de projeto, sem FK para
-- work_item/deliverable/milestone/risk/impediment nesta primeira fatia.
-- `status` é a única autoridade sobre pendente/tomada, nunca derivado.
--
-- A CHECK nomeada abaixo é o par fechado (status, outcome, decided_at),
-- espelhando risk_closed_at_matches_status: pendente exige os dois NULL;
-- tomada exige os dois preenchidos. Garantida atomicamente por
-- decideDecision/editDecisionOutcome (domain/transitions.ts), reforçada aqui.
--
-- responsible (ETAPA 11 do rework, quarto microcorte, §41) — texto livre,
-- sem CHECK de obrigatoriedade (NULL é estado normal e permanentemente
-- válido). Bancos criados entre D053/D055 e este corte recebem a coluna via
-- ALTER TABLE idempotente em sqlite-project-repository.ts
-- (ensureDecisionResponsibleColumn).
CREATE TABLE IF NOT EXISTS decision (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	subject TEXT NOT NULL,
	options TEXT,
	due_date TEXT,
	responsible TEXT,
	status TEXT NOT NULL,
	outcome TEXT,
	decided_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CONSTRAINT decision_status_values CHECK (status IN ('pendente', 'tomada')),
	CONSTRAINT decision_outcome_matches_status CHECK (
		(status = 'pendente' AND outcome IS NULL AND decided_at IS NULL)
		OR (status = 'tomada' AND outcome IS NOT NULL AND decided_at IS NOT NULL)
	)
);

-- DecisionAffectedWorkItem (ETAPA 11 do rework, terceiro microcorte, §41) —
-- "este WorkItem foi afetado por esta Decision", N:N tipada e explícita,
-- mesmo molde de milestone_work_item acima (par único, sem updated_at, só
-- nasce e é removida). Deliberadamente NÃO é uma relação polimórfica
-- (entity_type/entity_id) — ver scout READ-ONLY anterior a este corte.
-- Nem decision nem work_item têm remoção hoje, então nenhuma política de
-- cascade/guard é decidida aqui.
CREATE TABLE IF NOT EXISTS decision_affected_work_item (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	decision_id TEXT NOT NULL REFERENCES decision (id),
	work_item_id TEXT NOT NULL REFERENCES work_item (id),
	created_at TEXT NOT NULL,
	CONSTRAINT decision_affected_work_item_unique_pair UNIQUE (decision_id, work_item_id)
);

-- Change (ETAPA 11 do rework, primeiro microcorte, §41) — ver
-- app/src/lib/domain/state-types.ts. Objeto em nível de projeto, sem
-- lifecycle e sem relação com nenhuma outra entidade nesta primeira fatia.
CREATE TABLE IF NOT EXISTS change (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES project (id) ON DELETE CASCADE,
	statement TEXT NOT NULL,
	impact TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_deliverable_project_id ON deliverable (project_id);
-- Uma origem promove no máximo uma entrega (CONFIRM-TO-CONVERT). Parcial: as
-- entregas nativas (NULL) não competem entre si.
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliverable_source_scope_item_id
	ON deliverable (source_scope_item_id) WHERE source_scope_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_item_project_id ON work_item (project_id);
-- idx_impediment_work_item_id NÃO fica aqui: work_item_id é uma coluna nova
-- em impediment, adicionada via ALTER TABLE idempotente em
-- sqlite-project-repository.ts (ensureImpedimentWorkItemIdColumn) para bancos
-- criados antes da ETAPA 6 — indexá-la aqui quebraria a inicialização desses
-- bancos (a coluna ainda não existiria neste ponto do exec). O índice é
-- criado junto com a coluna, na própria função idempotente.
CREATE INDEX IF NOT EXISTS idx_dependency_project_id ON dependency (project_id);
-- schedule_baseline_entry não recebe índice de project_id próprio: sua PK
-- composta (baseline_id, work_item_id) já cobre a leitura real (por
-- baseline_id, sempre a partir de uma schedule_baseline já filtrada por
-- projeto) — nenhuma consulta filtra schedule_baseline_entry por project_id
-- diretamente.
CREATE INDEX IF NOT EXISTS idx_schedule_baseline_project_id ON schedule_baseline (project_id);
CREATE INDEX IF NOT EXISTS idx_milestone_project_id ON milestone (project_id);
CREATE INDEX IF NOT EXISTS idx_milestone_work_item_project_id ON milestone_work_item (project_id);
CREATE INDEX IF NOT EXISTS idx_risk_project_id ON risk (project_id);
CREATE INDEX IF NOT EXISTS idx_decision_project_id ON decision (project_id);
CREATE INDEX IF NOT EXISTS idx_change_project_id ON change (project_id);
CREATE INDEX IF NOT EXISTS idx_affected_group_project_id ON affected_group (project_id);
CREATE INDEX IF NOT EXISTS idx_external_action_project_id ON external_action (project_id);
CREATE INDEX IF NOT EXISTS idx_evidence_project_id ON evidence (project_id);
CREATE INDEX IF NOT EXISTS idx_treatment_step_project_id ON treatment_step (project_id);
CREATE INDEX IF NOT EXISTS idx_cause_hypothesis_project_id ON cause_hypothesis (project_id);
CREATE INDEX IF NOT EXISTS idx_desired_outcome_project_id ON desired_outcome (project_id);
