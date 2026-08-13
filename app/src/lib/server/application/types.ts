// DTO, erros e casos de uso — ver docs/06-architecture/contracts.md §10.

import type {
	ActivityStatus,
	AffectedGroupConfirmationIssue,
	AffectedGroupFrequency,
	AffectedGroupImpact,
	DomainTransitionError,
	EvidenceOutcome,
	ExternalActionStatus,
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
// currentPhase (Ciclo 6, C6-01): resumo mínimo de fase para a Home — fase
// alvo pela mesma regra de app/src/lib/phase-progress.ts (fase da atividade
// recomendada; ou a última fase aplicável quando o catálogo já foi
// esgotado), mas computado aqui em vez de reaproveitar
// buildPhaseProgress/buildPhaseActivities: aqueles são projeção de
// apresentação (ver phase-progress.ts), e server/application/ não deve
// depender de um helper de apresentação só para evitar repetir um cálculo
// pequeno — camada errada de dependência. completedActivities conta só
// status 'concluída' (nunca 'pulada' — pulada não é "concluída" para este
// texto). undefined só quando o catálogo não tem nenhuma fase aplicável
// (não deveria ocorrer com o catálogo atual).
//
// movementSignal/lastMovementAt (Ciclo 6, C6-01): sinal real de "Continue
// de onde parou" na Home — nunca persistido, sempre recalculado a partir
// dos timestamps já existentes em ProjectState (Answer.updatedAt,
// ScopeItem.updatedAt, Impediment.updatedAt, PendingItem.createdAt/
// resolvedAt, ScopeVersion.confirmedAt — nunca Project.createdAt, que não
// entra em lastMovementAt). 'bloqueado' tem prioridade sobre
// 'parado'/'avancando'. Sem nenhuma movimentação real, Project.createdAt
// vira fallback só para medir inatividade (nunca gera 'avancando'):
// projeto criado há menos de 7 dias fica sem nenhum sinal (undefined —
// "Rascunho" já comunica a situação); criado há 7 dias ou mais vira
// 'parado'.
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
				// Home (Ciclo 6, C6-01, convergência visual): texto de apoio da
				// próxima ação, sempre dado real — reaproveita
				// ActivityDefinition.why (já usado em ActivityForm/journey-context),
				// nunca texto inventado para a tela.
				why: string;
			}
		| {
				kind: 'completed';
			};
	currentPhase:
		| {
				phaseId: string;
				phaseLabel: string;
				completedActivities: number;
				totalActivities: number;
			}
		| undefined;
	movementSignal: 'bloqueado' | 'parado' | 'avancando' | undefined;
	lastMovementAt: string | null;
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

// Mapa de Impacto ("Quem é afetado", ETAPA 2 do rework) — view leve de
// AffectedGroup, sem projectId/createdAt/updatedAt, que a interface não
// precisa (mesmo padrão de ScopeItemView/ImpedimentView).
export interface AffectedGroupView {
	id: string;
	label: string;
	impact: AffectedGroupImpact | null;
	frequency: AffectedGroupFrequency | null;
}

// Validação Externa (ETAPA 3 do rework) — view leve de ExternalAction, sem
// projectId/kind (só um kind existe nesta versão — a interface não precisa
// distingui-lo). questions/informationToTake chegam já decodificados (a
// interface nunca precisa conhecer o encoding JSON usado na persistência).
export interface ExternalActionView {
	id: string;
	affectedGroupId: string;
	status: ExternalActionStatus;
	objective: string;
	questions: string[];
	informationToTake: string[];
	expectedResult: string;
}

// View leve de Evidence, sem projectId (a interface não precisa).
export interface EvidenceView {
	id: string;
	externalActionId: string;
	affectedGroupId: string;
	outcome: EvidenceOutcome;
	learning: string;
	createdAt: string;
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
	// Mapa de Impacto ("Quem é afetado", ETAPA 2 do rework) — todos os grupos
	// afetados do projeto; a interface (MapaDeImpacto.svelte) agrupa em faixas
	// por `impact` (derivado, nunca persistido, ver
	// catalog/affected-group.ts). Sempre computado (não só sob demanda) para a
	// interface poder desabilitar "Concluir mapa" sem round-trip extra — mesma
	// função pura usada pelo domínio na confirmação
	// (getAffectedGroupConfirmationIssues).
	affectedGroups: AffectedGroupView[];
	affectedGroupConfirmationIssues: AffectedGroupConfirmationIssue[];
	// Validação Externa (ETAPA 3 do rework) — todas as ExternalActions e
	// Evidences do projeto; a interface filtra por status/affectedGroupId
	// diretamente (mesmo padrão de impediments acima), sem campo derivado
	// extra aqui.
	externalActions: ExternalActionView[];
	evidences: EvidenceView[];
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

// Nova iniciativa (`/projects/new`) — criação atômica: nome, fase inicial e
// origem são aplicados ao estado em memória antes do único
// `repository.insert()` (ver project-use-cases.ts), nunca em gravações
// separadas. Reaproveita as mesmas transições/validações de renameProject,
// setRouteStartPhase e answerActivity — nenhuma regra nova.
// `routeStartPhaseId: null` — o redesenho de /projects/new (Claude Design,
// "Novo Projeto.dc.html") não faz mais o diagnóstico de rota nesta tela;
// `null` preserva o comportamento padrão (jornada completa a partir da
// Descoberta). O diagnóstico continua disponível em /map (D023/D024),
// sem alteração — este campo apenas deixou de ser obrigatório aqui.
// `originAnswer` — rótulo de `catalog/discovery.ts` (ORIGIN_OPTIONS),
// gravado como a própria Answer da atividade "Origem do projeto"
// (activityDefinitionId 'origem', fieldDefinitionId 'origem') via
// answerActivity — não um campo novo de projeto, o mesmo dado que a
// atividade sempre usou, só capturado mais cedo.
export interface CreateConfiguredProjectInput {
	name?: string | null;
	routeStartPhaseId: string | null;
	originAnswer?: string | null;
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

// Mapa de Impacto ("Quem é afetado", ETAPA 2 do rework) — mesmo padrão dos
// inputs de ScopeItem/Impediment: id gerado pelo caso de uso
// (idGenerator), nunca recebido do cliente.
export interface AddAffectedGroupInput {
	projectId: string;
	label: string;
}

export interface SetAffectedGroupImpactInput {
	projectId: string;
	groupId: string;
	impact: AffectedGroupImpact;
}

export interface SetAffectedGroupFrequencyInput {
	projectId: string;
	groupId: string;
	frequency: AffectedGroupFrequency;
}

export interface RemoveAffectedGroupInput {
	projectId: string;
	groupId: string;
}

export interface ConfirmAffectedGroupsInput {
	projectId: string;
}

// Validação Externa (ETAPA 3 do rework) — mesmo padrão dos inputs acima: id
// gerado pelo caso de uso, nunca recebido do cliente. A preparação
// (objective/questions/informationToTake/expectedResult) é derivada dentro
// do próprio caso de uso, a partir do AffectedGroup atual (ver
// catalog/external-action.ts) — não recebida do cliente, para que o texto
// persistido seja sempre o que o Hydra realmente conhece do projeto no
// momento da confirmação, nunca algo que o cliente poderia forjar.
export interface PrepareExternalActionInput {
	projectId: string;
	affectedGroupId: string;
}

export interface CompleteExternalActionInput {
	projectId: string;
	actionId: string;
	outcome: EvidenceOutcome;
	learning: string;
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
	addAffectedGroup(input: AddAffectedGroupInput): Promise<UseCaseOutcome<ProjectView>>;
	setAffectedGroupImpact(input: SetAffectedGroupImpactInput): Promise<UseCaseOutcome<ProjectView>>;
	setAffectedGroupFrequency(input: SetAffectedGroupFrequencyInput): Promise<UseCaseOutcome<ProjectView>>;
	removeAffectedGroup(input: RemoveAffectedGroupInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmAffectedGroups(input: ConfirmAffectedGroupsInput): Promise<UseCaseOutcome<ProjectView>>;
	prepareExternalAction(input: PrepareExternalActionInput): Promise<UseCaseOutcome<ProjectView>>;
	completeExternalAction(input: CompleteExternalActionInput): Promise<UseCaseOutcome<ProjectView>>;
	exportProject(projectId: string): Promise<UseCaseOutcome<string>>;
	importProject(json: string): Promise<UseCaseOutcome<ProjectView>>;
}
