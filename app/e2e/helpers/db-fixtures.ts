// Fixtures de banco compartilhadas entre journeys (R2 — remediação E2E,
// docs/core/ENGINEERING_REMEDIATION.md). Escreve direto no SQLite do
// servidor efêmero, contra o schema documentado em
// server/persistence/migrations/0001_init.sql — mesma técnica já
// estabelecida individualmente em closure-view.journey.ts,
// records-view.journey.ts, skip-activity.journey.ts e
// problema-optional-group.journey.ts antes desta centralização.
//
// Cada função aqui espelha uma coluna/tabela real do schema (nunca um
// "setAnyProjectState" genérico) — usada por uma feature journey para
// alcançar o estado semântico que ela testa, sem percorrer pela UI
// atividades anteriores irrelevantes ao que o teste verifica.

import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

export type ActivityStatus = 'não_iniciada' | 'em_andamento' | 'concluída' | 'pulada';

export function openDb(dbPath: string): Database.Database {
	return new Database(dbPath);
}

export function setActivityStatus(
	db: Database.Database,
	projectId: string,
	activityId: string,
	status: ActivityStatus
): void {
	db.prepare(`UPDATE activity_progress SET status = ? WHERE project_id = ? AND activity_definition_id = ?`).run(
		status,
		projectId,
		activityId
	);
}

// Atualiza todas as linhas de activity_progress do projeto de uma vez —
// usado quando o estado semântico necessário é "catálogo inteiro num status
// terminal" (ex.: encerramento antes da validação, Mapa em
// catalog_limit_reached), sem depender da contagem real de atividades do
// catálogo (que muda conforme o produto evolui).
export function setAllActivityStatuses(db: Database.Database, projectId: string, status: ActivityStatus): void {
	db.prepare(`UPDATE activity_progress SET status = ? WHERE project_id = ?`).run(status, projectId);
}

export function insertAnswer(
	db: Database.Database,
	projectId: string,
	activityId: string,
	fieldId: string,
	value: string
): void {
	const now = new Date().toISOString();
	// ON CONFLICT (upsert): algumas journeys já respondem parte da Descoberta
	// pela UI real antes de usar a fixture para completar o restante (ex.:
	// skip-activity.journey.ts) — sem upsert, semear uma Answer que já existe
	// (mesma PK: project_id + activity_definition_id + field_definition_id)
	// violaria a constraint em vez de simplesmente refletir o valor mais
	// recente, que é o mesmo comportamento de responder a atividade de novo.
	db.prepare(
		`INSERT INTO answer (project_id, activity_definition_id, field_definition_id, value, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (project_id, activity_definition_id, field_definition_id)
		 DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
	).run(projectId, activityId, fieldId, value, now, now);
}

// Marca as cinco atividades peculiares da Descoberta (além de "Origem do
// projeto", já concluída na criação) como concluídas diretamente no banco —
// alcança o estado "Descoberta concluída" sem depender do wizard bespoke de
// "Entender a situação" nem dos demais formulários da fase, para journeys
// cujo objeto de teste é posterior à Descoberta.
//
// Não é só `UPDATE activity_progress` — cada atividade só é
// domain-alcançável como 'concluída' com um lastro específico (ver
// domain/transitions.ts), então esta função recria o mínimo desse lastro
// para que o estado persistido seja um que uma transição real do domínio
// também produziria, não apenas um rótulo de status isolado:
// - problema (required_fields): isActivityFieldsValid exige as Answers
//   `situacao` e `situacao_o_que` (únicos campos `required`);
// - publico (explicit_confirmation): confirmAffectedGroups exige
//   getAffectedGroupConfirmationIssues([...]) vazio — pelo menos um
//   AffectedGroup com impact e frequency preenchidos;
// - estado_atual (explicit_confirmation): confirmTreatment exige
//   getTreatmentConfirmationIssues(...) vazio — noTreatment=true satisfaz
//   sem precisar de nenhum TreatmentStep;
// - entender_causas (explicit_confirmation): a conclusão nunca é bloqueada
//   por estado incompleto (ver comentário em transitions.ts) — nenhum
//   lastro extra é necessário;
// - resultado (explicit_confirmation, Stage 4C do rework): confirmDesiredOutcomes
//   exige getDesiredOutcomeConfirmationIssues(...) vazio — pelo menos um
//   DesiredOutcome com `change` preenchido.
export function completeDiscoveryViaFixture(db: Database.Database, projectId: string): void {
	insertAnswer(db, projectId, 'problema', 'situacao', 'Fixture de teste — descoberta concluída.');
	insertAnswer(db, projectId, 'problema', 'situacao_o_que', JSON.stringify(['prob_retrabalho']));
	setActivityStatus(db, projectId, 'problema', 'concluída');

	const now = new Date().toISOString();
	db.prepare(
		`INSERT INTO affected_group (id, project_id, label, impact, frequency, created_at, updated_at)
		 VALUES (?, ?, 'Fixture de teste', 'alto', 'frequente', ?, ?)`
	).run(randomUUID(), projectId, now, now);
	setActivityStatus(db, projectId, 'publico', 'concluída');

	db.prepare('UPDATE current_treatment SET no_treatment = 1, updated_at = ? WHERE project_id = ?').run(
		now,
		projectId
	);
	setActivityStatus(db, projectId, 'estado_atual', 'concluída');

	setActivityStatus(db, projectId, 'entender_causas', 'concluída');

	db.prepare(
		`INSERT INTO desired_outcome (id, project_id, change, target, outcome_order, created_at, updated_at)
		 VALUES (?, ?, 'Fixture de teste — mudança esperada.', NULL, 0, ?, ?)`
	).run(randomUUID(), projectId, now, now);
	setActivityStatus(db, projectId, 'resultado', 'concluída');
}

// Cria um projeto direto no SQLite, sem passar pelos use cases — usado só
// para os cenários que precisam de um projeto sem nenhuma resposta ainda
// (hoje inalcançável pela UI real, que responde nome/origem atomicamente em
// /projects/new). scope_version/current_treatment/cause_exploration são 1:1
// com project e sempre presentes desde a criação real (ver
// sqlite-project-repository.ts) — sem essas linhas, findById lança erro de
// violação de schema.
export function createBareProject(dbPath: string, projectId: string, name: string): void {
	const db = openDb(dbPath);
	try {
		db.prepare('INSERT INTO project (id, name, created_at, route_start_phase_id) VALUES (?, ?, ?, NULL)').run(
			projectId,
			name,
			new Date().toISOString()
		);
		db.prepare("INSERT INTO scope_version (project_id, hypothesis, confirmed_at) VALUES (?, '', NULL)").run(
			projectId
		);
		db.prepare('INSERT INTO current_treatment (project_id, no_treatment, updated_at) VALUES (?, 0, ?)').run(
			projectId,
			new Date().toISOString()
		);
		db.prepare('INSERT INTO cause_exploration (project_id, still_unknown, updated_at) VALUES (?, 0, ?)').run(
			projectId,
			new Date().toISOString()
		);
	} finally {
		db.close();
	}
}
