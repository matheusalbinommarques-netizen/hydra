// Tipos do estado do projeto — ver docs/06-architecture/contracts.md §2.

export type ActivityStatus = 'não_iniciada' | 'em_andamento' | 'concluída' | 'pulada';

export interface Project {
	id: string;
	name: string | null;
	createdAt: string; // ISO 8601
}

export interface ActivityProgress {
	projectId: string;
	activityDefinitionId: string;
	status: ActivityStatus;
}

export interface Answer {
	projectId: string;
	activityDefinitionId: string;
	fieldDefinitionId: string; // deve referenciar um AnswerFieldDefinition
	value: string;
	createdAt: string;
	updatedAt: string;
}

interface PendingItemBase {
	id: string;
	projectId: string;
	activityDefinitionId: string;
	createdAt: string;
}

export type PendingItem =
	| (PendingItemBase & { status: 'aberta'; resolvedAt?: never })
	| (PendingItemBase & { status: 'resolvida'; resolvedAt: string });

export interface ProjectState {
	project: Project;
	activityProgress: ActivityProgress[];
	answers: Answer[];
	pendingItems: PendingItem[];
}
