// Conversão linha SQLite ↔ objeto de domínio — uso interno deste módulo.
// Nenhum detalhe SQL (nomes de coluna, tipos SQL) atravessa a interface
// ProjectRepository.

import type {
	ActivityProgress,
	ActivityStatus,
	Answer,
	PendingItem,
	Project,
	ScopeBucket,
	ScopeEffort,
	ScopeItem,
	ScopeVersion
} from '$lib/domain';

export interface ProjectRow {
	id: string;
	name: string | null;
	created_at: string;
}

export interface ActivityProgressRow {
	project_id: string;
	activity_definition_id: string;
	status: ActivityStatus;
}

export interface AnswerRow {
	project_id: string;
	activity_definition_id: string;
	field_definition_id: string;
	value: string;
	created_at: string;
	updated_at: string;
}

export interface PendingItemRow {
	id: string;
	project_id: string;
	activity_definition_id: string;
	status: 'aberta' | 'resolvida';
	created_at: string;
	resolved_at: string | null;
}

export function mapProjectRow(row: ProjectRow): Project {
	return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function mapActivityProgressRow(row: ActivityProgressRow): ActivityProgress {
	return {
		projectId: row.project_id,
		activityDefinitionId: row.activity_definition_id,
		status: row.status
	};
}

export function mapAnswerRow(row: AnswerRow): Answer {
	return {
		projectId: row.project_id,
		activityDefinitionId: row.activity_definition_id,
		fieldDefinitionId: row.field_definition_id,
		value: row.value,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface ScopeItemRow {
	id: string;
	project_id: string;
	text: string;
	bucket: ScopeBucket;
	effort: ScopeEffort | null;
	item_order: number | null;
	source_suggestion_id: string | null;
	created_at: string;
	updated_at: string;
}

export interface ScopeVersionRow {
	project_id: string;
	hypothesis: string;
	confirmed_at: string | null;
}

export function mapScopeItemRow(row: ScopeItemRow): ScopeItem {
	return {
		id: row.id,
		projectId: row.project_id,
		text: row.text,
		bucket: row.bucket,
		effort: row.effort,
		order: row.item_order,
		sourceSuggestionId: row.source_suggestion_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function mapScopeVersionRow(row: ScopeVersionRow): ScopeVersion {
	return { projectId: row.project_id, hypothesis: row.hypothesis, confirmedAt: row.confirmed_at };
}

export function mapPendingItemRow(row: PendingItemRow): PendingItem {
	if (row.status === 'aberta') {
		return {
			id: row.id,
			projectId: row.project_id,
			activityDefinitionId: row.activity_definition_id,
			createdAt: row.created_at,
			status: 'aberta'
		};
	}
	if (row.resolved_at === null) {
		throw new Error(`pending_item "${row.id}" está resolvida mas não tem resolved_at (violação do schema)`);
	}
	return {
		id: row.id,
		projectId: row.project_id,
		activityDefinitionId: row.activity_definition_id,
		createdAt: row.created_at,
		status: 'resolvida',
		resolvedAt: row.resolved_at
	};
}
