// Adapter concreto de SQLite para a porta ProjectRepository — server-only
// ($lib/server é aplicado pelo próprio SvelteKit). Nenhum outro módulo deve
// falar com o banco diretamente.

import Database from 'better-sqlite3';
import type { Project, ProjectState } from '$lib/domain';
import type { ProjectRepository } from './project-repository';
import {
	mapActivityProgressRow,
	mapAnswerRow,
	mapPendingItemRow,
	mapProjectRow,
	mapScopeItemRow,
	mapScopeVersionRow,
	type ActivityProgressRow,
	type AnswerRow,
	type PendingItemRow,
	type ProjectRow,
	type ScopeItemRow,
	type ScopeVersionRow
} from './mappers';
import initSql from './migrations/0001_init.sql?raw';

export interface SqliteProjectRepository extends ProjectRepository {
	close(): void;
}

export function createSqliteProjectRepository(databasePath: string): SqliteProjectRepository {
	const db = new Database(databasePath);
	db.pragma('foreign_keys = ON');
	db.exec(initSql);

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
			`INSERT INTO scope_item (id, project_id, text, bucket, value, effort, item_order, created_at, updated_at)
			 VALUES (@id, @projectId, @text, @bucket, @value, @effort, @order, @createdAt, @updatedAt)`
		);
		for (const item of state.scopeItems) {
			insertScopeItem.run(item);
		}

		db.prepare(
			`INSERT INTO scope_version (project_id, hypothesis, confirmed_at)
			 VALUES (@projectId, @hypothesis, @confirmedAt)`
		).run(state.scopeVersion);
	}

	const insertTransaction = db.transaction((state: ProjectState) => {
		db.prepare('INSERT INTO project (id, name, created_at) VALUES (@id, @name, @createdAt)').run({
			id: state.project.id,
			name: state.project.name,
			createdAt: state.project.createdAt
		});
		insertChildren(state);
	});

	const saveTransaction = db.transaction((state: ProjectState) => {
		const result = db
			.prepare('UPDATE project SET name = @name, created_at = @createdAt WHERE id = @id')
			.run({ id: state.project.id, name: state.project.name, createdAt: state.project.createdAt });
		if (result.changes === 0) {
			throw new Error(`Project "${state.project.id}" não existe — save() exige um projeto já inserido`);
		}
		db.prepare('DELETE FROM activity_progress WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM answer WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM pending_item WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM scope_item WHERE project_id = ?').run(state.project.id);
		db.prepare('DELETE FROM scope_version WHERE project_id = ?').run(state.project.id);
		insertChildren(state);
	});

	return {
		async insert(state: ProjectState): Promise<void> {
			insertTransaction(state);
		},

		async findById(projectId: string): Promise<ProjectState | null> {
			const projectRow = db
				.prepare('SELECT id, name, created_at FROM project WHERE id = ?')
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
					`SELECT id, project_id, text, bucket, value, effort, item_order, created_at, updated_at
					 FROM scope_item WHERE project_id = ? ORDER BY rowid`
				)
				.all(projectId) as ScopeItemRow[];

			const scopeVersionRow = db
				.prepare('SELECT project_id, hypothesis, confirmed_at FROM scope_version WHERE project_id = ?')
				.get(projectId) as ScopeVersionRow | undefined;
			if (!scopeVersionRow) {
				throw new Error(`Projeto "${projectId}" não tem scope_version (violação do schema — 1:1 com project)`);
			}

			return {
				project: mapProjectRow(projectRow),
				activityProgress: activityProgressRows.map(mapActivityProgressRow),
				answers: answerRows.map(mapAnswerRow),
				pendingItems: pendingItemRows.map(mapPendingItemRow),
				scopeItems: scopeItemRows.map(mapScopeItemRow),
				scopeVersion: mapScopeVersionRow(scopeVersionRow)
			};
		},

		async save(state: ProjectState): Promise<void> {
			saveTransaction(state);
		},

		async listRecent(): Promise<Project[]> {
			const rows = db
				.prepare('SELECT id, name, created_at FROM project ORDER BY created_at DESC, id DESC')
				.all() as ProjectRow[];
			return rows.map(mapProjectRow);
		},

		close(): void {
			db.close();
		}
	};
}
