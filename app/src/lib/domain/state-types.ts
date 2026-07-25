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

// Escopo da "Monte a próxima versão" (scope_confirmation) — ver
// docs/core/DOMAIN_MODEL.md §7. bucket é escolhido no ato de adicionar o
// item (nunca nasce implícito); value/effort começam null até o usuário
// classificar; order só é definido para bucket === 'agora', numa sequência
// contígua começando em 0.
export type ScopeBucket = 'agora' | 'depois' | 'fora';
export type ScopeValue = 'baixo' | 'medio' | 'alto';
export type ScopeEffort = 'pequeno' | 'medio' | 'grande';

export interface ScopeItem {
	id: string;
	projectId: string;
	text: string;
	bucket: ScopeBucket;
	value: ScopeValue | null;
	effort: ScopeEffort | null;
	order: number | null;
	createdAt: string;
	updatedAt: string;
}

// 1:1 com Project, sempre presente desde a criação (mesmo padrão de Project
// em si) — evita branch de "existe ainda?" espalhado pelo código.
export interface ScopeVersion {
	projectId: string;
	hypothesis: string;
	confirmedAt: string | null;
}

export interface ProjectState {
	project: Project;
	activityProgress: ActivityProgress[];
	answers: Answer[];
	pendingItems: PendingItem[];
	scopeItems: ScopeItem[];
	scopeVersion: ScopeVersion;
}
