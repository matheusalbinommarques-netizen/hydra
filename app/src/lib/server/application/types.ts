// DTO, erros e casos de uso — ver docs/06-architecture/contracts.md §10.

import type {
	ActivityStatus,
	DomainTransitionError,
	ImpedimentType,
	ProjectStateParseError,
	Result,
	ScopeBucket,
	ScopeConfirmationIssue,
	ScopeEffort
} from '$lib/domain';
import type {
	CriteriaScopeConflict,
	FieldSuggestionView,
	HypothesisView,
	NextActivityResult,
	PendingItemView,
	PhaseStatus,
	ProjectStatus,
	ScopeProjectionView,
	ScopeSuggestionView
} from '$lib/orientation-engine';

// Histórico completo de pendências (Registros, C3-02) — deriva diretamente
// de state.pendingItems nesta camada (mesmo padrão já usado para popular
// `answers`), nunca de orientation-engine/: computeOpenPendingItems existe
// só para a Trilha B e continua filtrando apenas `aberta`. Discriminada por
// `status`, no mesmo estilo do PendingItem de domain/.
export type PendingItemHistoryView =
	| {
			id: string;
			activityDefinitionId: string;
			label: string;
			detail: string;
			status: 'aberta';
			createdAt: string;
			resolvedAt?: never;
		}
	| {
			id: string;
			activityDefinitionId: string;
			label: string;
			detail: string;
			status: 'resolvida';
			createdAt: string;
			resolvedAt: string;
		};

// Página inicial (C4-03A) — lista leve, sem snapshot completo: nunca expõe
// activityProgress/answers/pendingItems brutos. projectStatus (adicionado
// depois, ver project-use-cases.ts) reaproveita computeProjectStatus por
// projeto — não é um cálculo novo, só passou a ser lido também aqui.
export interface ProjectListItem {
	projectId: string;
	projectName: string | null;
	createdAt: string;
	projectStatus: ProjectStatus;
}

// "Escolha o próximo foco" (C5) — view leve de ScopeItem/ScopeVersion, sem
// projectId/createdAt/updatedAt, que a interface não precisa.
export interface ScopeItemView {
	id: string;
	text: string;
	bucket: ScopeBucket;
	effort: ScopeEffort | null;
	order: number | null;
	sourceSuggestionId: string | null;
}

export interface ScopeVersionView {
	hypothesis: string;
	confirmedAt: string | null;
}

// Cockpit (vertical 2, "Impedimentos") — view leve de Impediment, sem
// projectId/updatedAt, que a interface não precisa. createdAt/resolvedAt
// são exibidos como fato simples (mesmo padrão de PendingItemHistoryView),
// nunca usados para calcular "há quanto tempo está aberto" nesta rodada.
export interface ImpedimentView {
	id: string;
	text: string;
	tipo: ImpedimentType;
	nextAction: string | null;
	status: 'aberto' | 'resolvido';
	createdAt: string;
	resolvedAt: string | null;
}

export interface ProjectView {
	projectId: string;
	projectName: string | null;
	projectStatus: ProjectStatus;
	phaseStatuses: Record<string, PhaseStatus>;
	activityStatuses: Record<string, ActivityStatus>;
	answers: Record<string, string>;
	nextActivity: NextActivityResult;
	openPendingItems: PendingItemView[];
	pendingItemHistory: PendingItemHistoryView[];
	hypotheses: HypothesisView[];
	scopeItems: ScopeItemView[];
	scopeVersion: ScopeVersionView;
	// Sempre computado (não só sob demanda) para a interface poder desabilitar
	// o botão "Confirmar" e mostrar o checklist sem round-trip extra —
	// mesma função pura usada pelo domínio na confirmação (getScopeConfirmationIssues).
	scopeConfirmationIssues: ScopeConfirmationIssue[];
	// Projeção somente-leitura do artefato confirmado — sempre computada,
	// nunca persistida (computeScopeProjection); a tela do artefato confirmado
	// só a exibe quando scopeVersion.confirmedAt não é nulo.
	scopeProjection: ScopeProjectionView;
	// Sinal → sugestão (ver orientation-engine/scope-suggestions.ts) — só as
	// duas regras explícitas da prova, já filtradas das que viraram ScopeItem.
	scopeSuggestions: ScopeSuggestionView[];
	// Reaproveitamento explícito de resposta anterior (ver
	// orientation-engine/field-suggestions.ts) — sempre resolvido a partir das
	// Answers persistidas, independente de valores temporários de formulário em
	// andamento; já filtrado dos campos que já têm Answer própria.
	fieldSuggestions: FieldSuggestionView[];
	// Conflito critério × escopo (R2, Especificação de Recuperação v1.1) —
	// sinal de nível de projeto, não por critério individual (ver
	// orientation-engine/criteria-scope-conflict.ts). Sempre computado, nunca
	// persistido.
	criteriaScopeConflict: CriteriaScopeConflict;
	// Cockpit (vertical 2, "Impedimentos") — todos os impedimentos (abertos e
	// resolvidos); a tela /cockpit e a contagem em /now filtram por status
	// diretamente, sem campo derivado extra aqui (mesmo padrão de
	// openPendingItems.length usado direto no template).
	impediments: ImpedimentView[];
}

export type UseCaseError =
	| { kind: 'project_not_found' }
	| { kind: 'invalid_import'; reason: ProjectStateParseError }
	| { kind: 'import_id_collision'; projectId: string }
	| DomainTransitionError;

export type UseCaseOutcome<T> = Result<T, UseCaseError>;

export interface AnswerActivityInput {
	projectId: string;
	activityDefinitionId: string;
	values: Record<string, string>;
}

export interface SkipActivityInput {
	projectId: string;
	activityDefinitionId: string;
}

export interface ConfirmSummaryInput {
	projectId: string;
}

export interface RenameProjectInput {
	projectId: string;
	name: string;
}

export interface AddScopeItemInput {
	projectId: string;
	text: string;
	bucket: ScopeBucket;
	sourceSuggestionId?: string | null;
}

export interface SetScopeItemTextInput {
	projectId: string;
	itemId: string;
	text: string;
}

export interface MoveScopeItemInput {
	projectId: string;
	itemId: string;
	bucket: ScopeBucket;
}

export interface SetScopeItemEffortInput {
	projectId: string;
	itemId: string;
	effort: ScopeEffort;
}

export interface ReorderAgoraItemsInput {
	projectId: string;
	orderedItemIds: string[];
}

export interface RemoveScopeItemInput {
	projectId: string;
	itemId: string;
}

export interface SetHypothesisInput {
	projectId: string;
	hypothesis: string;
}

export interface ConfirmScopeVersionInput {
	projectId: string;
}

export interface AddImpedimentInput {
	projectId: string;
	text: string;
	tipo: ImpedimentType;
}

export interface SetImpedimentTypeInput {
	projectId: string;
	impedimentId: string;
	tipo: ImpedimentType;
}

export interface SetImpedimentNextActionInput {
	projectId: string;
	impedimentId: string;
	nextAction: string | null;
}

export interface ResolveImpedimentInput {
	projectId: string;
	impedimentId: string;
}

export interface ReopenImpedimentInput {
	projectId: string;
	impedimentId: string;
}

export interface ProjectUseCases {
	createProject(): Promise<UseCaseOutcome<ProjectView>>;
	listRecentProjects(): Promise<UseCaseOutcome<ProjectListItem[]>>;
	loadProjectView(projectId: string): Promise<UseCaseOutcome<ProjectView>>;
	renameProject(input: RenameProjectInput): Promise<UseCaseOutcome<ProjectView>>;
	answerActivity(input: AnswerActivityInput): Promise<UseCaseOutcome<ProjectView>>;
	skipActivity(input: SkipActivityInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmSummary(input: ConfirmSummaryInput): Promise<UseCaseOutcome<ProjectView>>;
	addScopeItem(input: AddScopeItemInput): Promise<UseCaseOutcome<ProjectView>>;
	setScopeItemText(input: SetScopeItemTextInput): Promise<UseCaseOutcome<ProjectView>>;
	moveScopeItem(input: MoveScopeItemInput): Promise<UseCaseOutcome<ProjectView>>;
	setScopeItemEffort(input: SetScopeItemEffortInput): Promise<UseCaseOutcome<ProjectView>>;
	reorderAgoraItems(input: ReorderAgoraItemsInput): Promise<UseCaseOutcome<ProjectView>>;
	removeScopeItem(input: RemoveScopeItemInput): Promise<UseCaseOutcome<ProjectView>>;
	setHypothesis(input: SetHypothesisInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmScopeVersion(input: ConfirmScopeVersionInput): Promise<UseCaseOutcome<ProjectView>>;
	addImpediment(input: AddImpedimentInput): Promise<UseCaseOutcome<ProjectView>>;
	setImpedimentType(input: SetImpedimentTypeInput): Promise<UseCaseOutcome<ProjectView>>;
	setImpedimentNextAction(input: SetImpedimentNextActionInput): Promise<UseCaseOutcome<ProjectView>>;
	resolveImpediment(input: ResolveImpedimentInput): Promise<UseCaseOutcome<ProjectView>>;
	reopenImpediment(input: ReopenImpedimentInput): Promise<UseCaseOutcome<ProjectView>>;
	exportProject(projectId: string): Promise<UseCaseOutcome<string>>;
	importProject(json: string): Promise<UseCaseOutcome<ProjectView>>;
}
