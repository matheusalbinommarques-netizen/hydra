// DTO, erros e casos de uso — ver docs/06-architecture/contracts.md §10.

import type {
	ActivityStatus,
	DomainTransitionError,
	ImpedimentType,
	ProjectStateParseError,
	Result,
	ScopeBucket,
	ScopeConfirmationIssue,
	ScopeEffort,
	ScopeExecutionStatus
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
// nextAction (etapa 7 do roadmap, "Convergência da experiência e das
// telas") reaproveita o mesmo estado completo já carregado para
// projectStatus — nenhuma consulta nova. Deriva de computeSnapshot(...)
// .nextActivity (orientation-engine/snapshot.ts), a mesma fonte
// route-aware (respeita routeStartPhaseId, D023) que ProjectView.nextActivity
// usa em /now e /map — não de computeNextActivity direto sobre o catálogo
// completo. Estado explícito em vez de null/string mágica: 'completed' é o
// único caso sem atividade recomendada (kind === 'catalog_limit_reached').
export interface ProjectListItem {
	projectId: string;
	projectName: string | null;
	createdAt: string;
	projectStatus: ProjectStatus;
	nextAction:
		| {
				kind: 'activity';
				activityDefinitionId: string;
				label: string;
			}
		| {
				kind: 'completed';
			};
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
	// Acompanhamento de execução (D025, etapa 4 do roadmap) — só relevante
	// para bucket 'agora'; presente sempre (default 'a_fazer' vindo do
	// domínio), a interface decide se exibe conforme o bucket.
	executionStatus: ScopeExecutionStatus;
}

export interface ScopeVersionView {
	hypothesis: string;
	confirmedAt: string | null;
}

// Acompanhamento (vertical 2, "Impedimentos") — view leve de Impediment, sem
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
	createdAt: string;
	// Ponto de partida da rota recomendada (D023, decision-log.md) — null =
	// percurso completo. nextActivity abaixo já reflete essa escolha; este
	// campo existe só para a interface (`/map`) saber o que exibir selecionado.
	routeStartPhaseId: string | null;
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
	// Conflito critério × escopo — sinal de nível de projeto, não por
	// critério individual (ver orientation-engine/criteria-scope-conflict.ts).
	// Sempre computado, nunca persistido.
	criteriaScopeConflict: CriteriaScopeConflict;
	// Acompanhamento (vertical 2, "Impedimentos") — todos os impedimentos
	// (abertos e resolvidos); a tela /tracking e a contagem em /now filtram por status
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

// C5-01 — confirmação de "Priorizar entregas" (explicit_confirmation,
// allowsSkip true). Localiza a atividade por id fixo no domínio; não recebe
// nenhum dado de PlanningItem — a coleção pertence à Answer de "Decompor o
// trabalho" e não é tocada por esta transição.
export interface ConfirmPlanningPriorityInput {
	projectId: string;
}

export interface RenameProjectInput {
	projectId: string;
	name: string;
}

export interface SetRouteStartPhaseInput {
	projectId: string;
	phaseId: string | null;
}

// Nova iniciativa (`/projects/new`, etapa 7.2 do roadmap) — criação atômica:
// nome e fase inicial são aplicados ao estado em memória antes do único
// `repository.insert()` (ver project-use-cases.ts), nunca em gravações
// separadas. Reaproveita as mesmas transições/validações de renameProject e
// setRouteStartPhase — nenhuma regra nova.
export interface CreateConfiguredProjectInput {
	name?: string | null;
	routeStartPhaseId: string;
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

export interface SetScopeItemExecutionStatusInput {
	projectId: string;
	itemId: string;
	status: ScopeExecutionStatus;
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
	createConfiguredProject(input: CreateConfiguredProjectInput): Promise<UseCaseOutcome<ProjectView>>;
	listRecentProjects(): Promise<UseCaseOutcome<ProjectListItem[]>>;
	loadProjectView(projectId: string): Promise<UseCaseOutcome<ProjectView>>;
	renameProject(input: RenameProjectInput): Promise<UseCaseOutcome<ProjectView>>;
	setRouteStartPhase(input: SetRouteStartPhaseInput): Promise<UseCaseOutcome<ProjectView>>;
	answerActivity(input: AnswerActivityInput): Promise<UseCaseOutcome<ProjectView>>;
	skipActivity(input: SkipActivityInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmSummary(input: ConfirmSummaryInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmPlanningPriority(input: ConfirmPlanningPriorityInput): Promise<UseCaseOutcome<ProjectView>>;
	addScopeItem(input: AddScopeItemInput): Promise<UseCaseOutcome<ProjectView>>;
	setScopeItemText(input: SetScopeItemTextInput): Promise<UseCaseOutcome<ProjectView>>;
	moveScopeItem(input: MoveScopeItemInput): Promise<UseCaseOutcome<ProjectView>>;
	setScopeItemEffort(input: SetScopeItemEffortInput): Promise<UseCaseOutcome<ProjectView>>;
	setScopeItemExecutionStatus(input: SetScopeItemExecutionStatusInput): Promise<UseCaseOutcome<ProjectView>>;
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
