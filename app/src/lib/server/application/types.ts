// DTO, erros e casos de uso — ver docs/06-architecture/contracts.md §10.

import type {
	ActivityStatus,
	AffectedGroupConfirmationIssue,
	AffectedGroupFrequency,
	AffectedGroupImpact,
	CauseHypothesisConfirmationIssue,
	DecisionStatus,
	DesiredOutcomeConfirmationIssue,
	DomainTransitionError,
	EvidenceOutcome,
	ExternalActionStatus,
	ImpedimentType,
	DeliverableBucket,
	DeliverableEffort,
	MilestoneStatus,
	ProjectEvent,
	ProjectStateParseError,
	Result,
	RiskImpact,
	RiskLikelihood,
	RiskStatus,
	ScopeBucket,
	ScopeConfirmationIssue,
	ScopeEffort,
	ScopeExecutionStatus,
	TreatmentConfirmationIssue,
	TreatmentFriction,
	WorkItemStatus
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
import type { ProjectEventFilter } from '../persistence';

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
	// WorkItem que este impedimento bloqueia (ETAPA 6 do rework) — null é o
	// caso normal e continua totalmente válido: Impediment sempre pôde
	// existir no nível do projeto, sem relação com nenhum item de trabalho.
	workItemId: string | null;
	// Decision relacionada (ETAPA 11 do rework, segundo microcorte, §41/§13.4)
	// — null é o caso normal, mesmo espírito de workItemId acima. Só é
	// preenchido quando tipo === 'decisao_pendente'.
	decisionId: string | null;
	// subject da Decision relacionada, denormalizado para a interface exibir
	// sem round-trip adicional (mesmo espírito de blocking em WorkItemView) —
	// null quando decisionId é null.
	decisionSubject: string | null;
	createdAt: string;
	resolvedAt: string | null;
}

// Acompanhamento ("Riscos", ETAPA 10 do rework, primeiro microcorte, D049;
// reviewedAt no segundo microcorte; likelihood/impact/response no terceiro)
// — view leve de Risk, sem projectId/updatedAt, que a interface não
// precisa. `status` é o estado DECLARADO e a única autoridade sobre
// aberto/encerrado.
export interface RiskView {
	id: string;
	statement: string;
	status: RiskStatus;
	createdAt: string;
	closedAt: string | null;
	reviewedAt: string | null;
	likelihood: RiskLikelihood | null;
	impact: RiskImpact | null;
	response: string | null;
}

// Acompanhamento ("Decisões", ETAPA 11 do rework, §41) — view leve de
// Decision, sem projectId/updatedAt, que a interface não precisa. `status` é
// o estado DECLARADO e a única autoridade sobre pendente/tomada.
export interface DecisionView {
	id: string;
	subject: string;
	options: string | null;
	dueDate: string | null;
	// Responsável por conduzir esta Decision (ETAPA 11 do rework, quarto
	// microcorte, §41) — texto livre, não identidade. Ver domain/state-types.ts.
	responsible: string | null;
	status: DecisionStatus;
	outcome: string | null;
	decidedAt: string | null;
	createdAt: string;
	// WorkItems afetados (ETAPA 11 do rework, terceiro microcorte, §41) —
	// título vem do WorkItem relacionado, mesmo espírito de
	// MilestoneWorkItemView: a interface não precisa cruzar workItems para
	// exibir a linha.
	affectedWorkItems: DecisionAffectedWorkItemView[];
}

// Título é do WorkItem relacionado — mesmo padrão de MilestoneWorkItemView.
export interface DecisionAffectedWorkItemView {
	decisionAffectedWorkItemId: string;
	workItemId: string;
	title: string;
}

// Acompanhamento ("Mudanças", ETAPA 11 do rework, §41) — view leve de
// Change, sem projectId/updatedAt.
export interface ChangeView {
	id: string;
	statement: string;
	impact: string | null;
	createdAt: string;
}

// Trabalho (ETAPA 6 do rework, "Primeiro loop operacional") — view leve de
// WorkItem, sem projectId (a interface não precisa). "Bloqueado" nunca é
// persistido: blockedBy é sempre derivado na montagem da view (ver
// project-view.ts, buildWorkItemView), a partir do Impediment aberto (se
// houver) cujo workItemId aponte para este item — mesmo padrão de
// movementSignal (computado, nunca gravado).
export interface WorkItemView {
	id: string;
	title: string;
	status: WorkItemStatus;
	createdAt: string;
	blockedBy: { impedimentId: string; text: string; tipo: ImpedimentType } | null;
	// Dependências declaradas deste item (ETAPA 8 do rework) — precedência
	// planejada, nunca bloqueio: `satisfied` é derivado do status do
	// predecessor na montagem da view, exatamente como blockedBy acima, e
	// nenhuma transição do domínio consulta este campo.
	dependsOn: WorkItemDependencyView[];
	// deliverable (ETAPA 9 do rework, segundo microcorte, D043/D044) — a
	// Deliverable de origem, quando existir; null é estado normal e
	// permanece legítimo (WorkItem pode existir sem entrega). `title` é
	// denormalizado aqui só para leitura (Trabalho tornar perceptível a
	// origem sem cruzar listas na interface) — nunca sincronizado de volta.
	deliverable: { deliverableId: string; title: string } | null;
	// plannedStart/durationDays (ETAPA 12 do rework, §42, primeiro microcorte
	// fundacional) — schedule MANUAL declarado, sem precedência/propagação.
	// null/null é o caso normal (a maioria dos WorkItems não tem schedule
	// ainda). Par sempre coerente: ver WorkItem em domain/state-types.ts.
	plannedStart: string | null;
	durationDays: number | null;
	// precedenceConflict (ETAPA 12 do rework, §42, segundo microcorte) —
	// regra de precedência temporal DERIVADA (nunca persistida, nunca
	// bloqueante): existe uma Dependency com predecessor agendado cujo fim
	// exige um início posterior ao plannedStart atual deste item? `null` é
	// o caso normal — sem schedule, sem predecessor agendado, ou schedule
	// já compatível com o maior início exigido CONHECIDO (predecessor sem
	// schedule nunca aparece aqui, nem esconde conflito provado por outro).
	precedenceConflict: WorkItemPrecedenceConflictView | null;
	// knownFreeSlack (ETAPA 12 do rework, §42, quarto microcorte) — folga
	// LIVRE LOCAL derivada (nunca persistida, nunca folga de rede): quantos
	// dias este item ainda pode deslizar antes de pressionar o sucessor
	// direto agendado mais próximo. `null` é o caso normal — sem schedule
	// completo, ou precedenceConflict próprio ainda não resolvido (ver
	// domain/transitions.ts, findWorkItemKnownFreeSlack).
	knownFreeSlack: WorkItemKnownFreeSlackView | null;
}

// Uma aresta de precedência vista a partir do item que depende. `title`/
// `satisfied` são do predecessor — a interface não precisa cruzar a lista
// de WorkItems para desenhar "Aguarda X".
export interface WorkItemDependencyView {
	dependencyId: string;
	dependsOnWorkItemId: string;
	title: string;
	satisfied: boolean;
}

// knownRequiredStart (ETAPA 12 do rework, §42, segundo microcorte) — data
// civil YYYY-MM-DD: o maior início exigido entre os predecessores DESTA
// Dependency que possuem schedule completo, nunca o "início mínimo
// compatível" absoluto — um predecessor sem schedule pode existir e não
// entrar nesta conta (ver findWorkItemPrecedenceConflict).
//
// União discriminada (ETAPA 12 do rework, §42, reparo pós-dogfood do
// terceiro microcorte) — 'conflict' é o caso já existente (data conhecida,
// oferece replanejamento); 'unrepresentable' é o caso em que a aritmética
// de precedência exigiria uma data fora da faixa civil 0000-9999
// (domain/transitions.ts, WorkItemPrecedenceUnrepresentable): não existe
// knownRequiredStart para mostrar, e nenhuma ação de replanejamento é
// oferecida (não há para onde propagar). `null` no campo
// `WorkItemView.precedenceConflict` continua significando "sem conflito
// nenhum" — esta união só cobre os dois estados em que EXISTE um problema
// de precedência a comunicar.
export type WorkItemPrecedenceConflictView =
	| { kind: 'conflict'; dependsOnWorkItemId: string; dependsOnWorkItemTitle: string; knownRequiredStart: string }
	| { kind: 'unrepresentable'; dependsOnWorkItemId: string; dependsOnWorkItemTitle: string };

// Folga conhecida do cronograma (ETAPA 12 do rework, §42, quarto
// microcorte) — projeção de domain/transitions.ts, findWorkItemKnownFreeSlack.
// `limitingWorkItemTitle` é denormalizado aqui, mesmo espírito de
// dependsOnWorkItemTitle acima: nomeia o sucessor que prova o limite sem a
// interface cruzar a lista de WorkItems.
//
// Cinco estados, nunca um número fictício: `known` (valor calculado,
// `partial` true quando existe sucessor sem cronograma que não entrou na
// conta), `conflict` (uma aresta de saída já viola precedência — nunca
// gap negativo), `unknown` (existem sucessores, mas nenhum tem cronograma
// suficiente para calcular nada), `no_known_limit` (nenhuma Dependency
// sucessora — ausência de limite, não folga zero nem infinita) e
// `unrepresentable` (a aritmética de precedência deste item excede a
// faixa civil 0000-9999). `null` em `WorkItemView.knownFreeSlack` continua
// significando "nada a mostrar" (sem schedule, ou precedenceConflict
// próprio ainda não resolvido).
export type WorkItemKnownFreeSlackView =
	| { kind: 'known'; slackDays: number; limitingWorkItemId: string; limitingWorkItemTitle: string; partial: boolean }
	| { kind: 'conflict'; limitingWorkItemId: string; limitingWorkItemTitle: string }
	| { kind: 'unknown' }
	| { kind: 'no_known_limit' }
	| { kind: 'unrepresentable' };

// Propagação de cronograma (ETAPA 12 do rework, §42, terceiro microcorte) —
// resultado de previewSchedulePropagation/applySchedulePropagation.
// `viaWorkItemTitle` é denormalizado aqui, mesmo espírito de
// dependsOnWorkItemTitle acima: a interface nomeia o predecessor que prova
// cada movimento sem cruzar a lista de WorkItems.
export interface SchedulePropagationChangeView {
	workItemId: string;
	workItemTitle: string;
	fromPlannedStart: string;
	toPlannedStart: string;
	viaWorkItemId: string;
	viaWorkItemTitle: string;
}

// `partial` (ver domain/transitions.ts, SchedulePropagationPlan) — true
// quando a cascata encontrou dependência sem cronograma (predecessor ou
// sucessor) que impede afirmar o resultado como completo. `changes` só
// lista WorkItems que realmente mudariam — plano vazio é caso normal
// (conflito do item raiz já foi resolvido por outro caminho).
export interface SchedulePropagationPlanView {
	rootWorkItemId: string;
	changes: SchedulePropagationChangeView[];
	partial: boolean;
}

// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte,
// hardening pós-dogfood) — candidato canônico de domain/transitions.ts,
// ScheduleBaselineCandidateEntry: um por WorkItem existente no momento do
// preview, com ou sem schedule. Passthrough direto (sem denormalização de
// título — nunca exibido individualmente, só serializado de volta como
// `expected` na confirmação; ver PreviewScheduleBaselineCaptureInput).
export interface ScheduleBaselineCandidateEntryView {
	workItemId: string;
	plannedStart: string | null;
	durationDays: number | null;
}

// Resultado de previewScheduleBaselineCapture. `entries` é o candidato
// INTEIRO (todo WorkItem existente) — a interface devolve exatamente isso
// como `expected` na confirmação (ver CaptureScheduleBaselineInput), nunca
// reconstrói o candidato do zero no cliente. `scheduledCount`/
// `uncoveredCount`/`partial` são só para texto de apresentação
// ("N trabalhos serão capturados").
export interface ScheduleBaselineCapturePreviewView {
	entries: ScheduleBaselineCandidateEntryView[];
	scheduledCount: number;
	uncoveredCount: number;
	partial: boolean;
}

// Comparação contra a baseline ativa (a de maior `version` — hardening
// pós-dogfood, nunca `createdAt`/`id`) — projeção de
// domain/transitions.ts, computeScheduleBaselineComparison.
// `workItemTitle` é denormalizado aqui, mesmo espírito de
// dependsOnWorkItemTitle (WorkItemPrecedenceConflictView) acima: a
// interface não cruza a lista de WorkItems. `compared_unrepresentable` é
// defesa (ver domain): a própria aritmética de variância estourou a faixa
// civil — caso extremo, nunca esperado num projeto real.
export type ScheduleBaselineComparisonEntryView =
	| {
			kind: 'compared';
			workItemId: string;
			workItemTitle: string;
			startVarianceDays: number;
			finishVarianceDays: number;
			durationVarianceDays: number;
			baselinePlannedStart: string;
			baselineDurationDays: number;
	  }
	| { kind: 'compared_unrepresentable'; workItemId: string; workItemTitle: string }
	| { kind: 'removed'; workItemId: string; workItemTitle: string; baselinePlannedStart: string; baselineDurationDays: number }
	| { kind: 'scheduled_after'; workItemId: string; workItemTitle: string }
	| { kind: 'added_after'; workItemId: string; workItemTitle: string };

// `null` é o caso normal e permanentemente válido — nenhuma baseline foi
// capturada ainda (ver ProjectView.scheduleBaseline). `partial` é sempre
// DERIVADO na montagem desta view a partir das entries da baseline ativa
// (existe alguma null/null?) — nunca persistido (hardening pós-dogfood).
export interface ScheduleBaselineView {
	createdAt: string;
	partial: boolean;
	entries: ScheduleBaselineComparisonEntryView[];
}

// Deliverable (ETAPA 9 do rework, primeiro microcorte) — view leve, sem
// projectId/createdAt/updatedAt, que a interface não precisa (mesmo padrão de
// ScopeItemView/WorkItemView).
//
// `sourceScopeItemId` chega à interface só como FATO de proveniência — é o
// que permite a tela de escopo dizer "já promovido" e recusar uma segunda
// promoção. Nunca é usado para sincronizar texto, bucket ou effort com o
// ScopeItem de origem, e a origem pode não existir mais (proveniência órfã é
// estado válido).
//
// Sem status, progresso, percentual, contagem de trabalho ou responsável:
// esses campos não existem no contrato desta etapa e não devem ser derivados
// aqui "só para a tela".
export interface DeliverableView {
	id: string;
	title: string;
	bucket: DeliverableBucket;
	effort: DeliverableEffort | null;
	order: number | null;
	sourceScopeItemId: string | null;
}

// Mapa de Impacto ("Quem é afetado", ETAPA 2 do rework) — view leve de
// Milestone (ETAPA 8 do rework, segundo microcorte) — view leve, sem
// projectId/createdAt/updatedAt, que a interface não precisa (mesmo padrão de
// WorkItemView/ImpedimentView).
//
// `status` é o estado DECLARADO e a única autoridade sobre aberto/alcancado.
// `relatedWorkItems` são os trabalhos que o usuário associou como
// relacionados/contribuintes — nunca o conjunto exaustivo de condições do
// marco. `relatedConcluded` é CONTEXTO derivado ("3 de 5 trabalhos
// relacionados concluídos"), jamais percentual, progresso ou completion: um
// marco alcançado com trabalho relacionado aberto é estado legítimo, e um
// marco sem nenhum trabalho relacionado simplesmente não tem contexto a
// mostrar (nunca "0 de 0 = pronto").
export interface MilestoneView {
	id: string;
	title: string;
	status: MilestoneStatus;
	reachedAt: string | null;
	// Data civil YYYY-MM-DD declarada pelo usuário, ou null. Vai crua para a
	// interface (é o valor que <input type="date"> consome) e é formatada como
	// dia, sem nunca virar Date — ver domain/civil-date.ts.
	plannedDate: string | null;
	// Exceção deliberada ao "view leve": createdAt existe aqui só como fato de
	// DESEMPATE determinístico da Linha do tempo (dois marcos com a mesma data
	// planejada mantêm a ordem de criação). Não é exibido em lugar nenhum, e
	// não é ordenação de produto — `order` continua pertencendo a Roadmap (§38).
	createdAt: string;
	relatedWorkItems: MilestoneWorkItemView[];
	relatedConcluded: number;
}

// Título e status são do WorkItem relacionado — a interface não precisa
// cruzar a lista de workItems para exibir a linha (mesmo espírito de
// WorkItemDependencyView).
export interface MilestoneWorkItemView {
	milestoneWorkItemId: string;
	workItemId: string;
	title: string;
	status: WorkItemStatus;
}

// AffectedGroup, sem projectId/createdAt/updatedAt, que a interface não
// precisa (mesmo padrão de ScopeItemView/ImpedimentView).
export interface AffectedGroupView {
	id: string;
	label: string;
	impact: AffectedGroupImpact | null;
	frequency: AffectedGroupFrequency | null;
}

// Validação Externa (ETAPA 3 do rework) + Ações externas maduras (ETAPA 14,
// §44, D070/D072/D073) — view leve de ExternalAction, sem projectId. União
// discriminada por `kind`, mesmo shape do domínio (domain/state-types.ts):
// a interface precisa distinguir os dois kinds para saber o que renderizar
// na faixa/drawer transversal. questions/informationToTake chegam já
// decodificados (a interface nunca precisa conhecer o encoding JSON usado
// na persistência). `approval` não tem preparação própria — o texto de
// orientação é derivado de `Decision.subject` na UI, a partir de
// `decisionId`.
export interface ExternalActionValidateAffectedGroupView {
	id: string;
	kind: 'validate_affected_group';
	affectedGroupId: string;
	status: ExternalActionStatus;
	objective: string;
	questions: string[];
	informationToTake: string[];
	expectedResult: string;
}

export interface ExternalActionApprovalView {
	id: string;
	kind: 'approval';
	decisionId: string;
	status: ExternalActionStatus;
}

export type ExternalActionView = ExternalActionValidateAffectedGroupView | ExternalActionApprovalView;

// View leve de Evidence, sem projectId (a interface não precisa).
export interface EvidenceView {
	id: string;
	externalActionId: string;
	affectedGroupId: string;
	outcome: EvidenceOutcome;
	learning: string;
	createdAt: string;
}

// "Como é tratado hoje" (Stage 4A do rework) — view leve de TreatmentStep,
// sem projectId/createdAt/updatedAt, que a interface não precisa (mesmo
// padrão de AffectedGroupView).
export interface TreatmentStepView {
	id: string;
	order: number;
	whatHappens: string;
	actors: string[];
	medium: string | null;
	frictions: TreatmentFriction[];
}

export interface CurrentTreatmentView {
	noTreatment: boolean;
}

// "Entender as causas" (Stage 4B do rework) — view leve de CauseHypothesis,
// sem projectId/createdAt/updatedAt, que a interface não precisa (mesmo
// padrão de AffectedGroupView/TreatmentStepView).
export interface CauseHypothesisView {
	id: string;
	title: string;
	origin: string | null;
	expectedIfTrue: string | null;
	whatWeakensIt: string | null;
	evidenceIds: string[];
}

export interface CauseExplorationView {
	stillUnknown: boolean;
}

// "Resultado desejado" (Stage 4C do rework) — view leve de DesiredOutcome,
// sem projectId/createdAt/updatedAt, que a interface não precisa (mesmo
// padrão de AffectedGroupView/TreatmentStepView/CauseHypothesisView).
export interface DesiredOutcomeView {
	id: string;
	change: string;
	target: string | null;
	order: number;
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
	// Fase canônica atual (S13, §43, corredor do shell) — mesma regra de
	// findCurrentPhase (phase-activities.ts) já usada por Agora/Mapa; nunca
	// redefine ProjectStatus/PhaseStatus, só projeta qual fase do catálogo
	// está ativa agora, para o shell mostrar "Fase: {currentPhase.phaseLabel}"
	// em toda rota. `undefined` só pode ocorrer se o catálogo não tiver
	// nenhuma fase aplicável (caso hoje inexistente).
	currentPhase: { phaseId: string; phaseLabel: string } | undefined;
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
	// (abertos e resolvidos); a tela /attentions e a contagem em /now filtram por status
	// diretamente, sem campo derivado extra aqui (mesmo padrão de
	// openPendingItems.length usado direto no template).
	impediments: ImpedimentView[];
	// Trabalho (ETAPA 6 do rework) — todos os WorkItems do projeto; a
	// interface (/work) agrupa por status, Acompanhamento resume por
	// blockedBy. Sempre computado (mesmo padrão de impediments acima).
	workItems: WorkItemView[];

	// Marcos do projeto (ETAPA 8 do rework, segundo microcorte). Ao contrário
	// de Dependency — que D039 deliberadamente NÃO projetou como coleção do
	// ProjectView por não haver consumidor —, aqui existe consumidor real: a
	// seção "Marcos" de /work lista marcos, não itens de trabalho, e não há
	// projeção existente onde eles caibam.
	deliverables: DeliverableView[];
	milestones: MilestoneView[];
	// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte) —
	// `null` enquanto nenhuma baseline foi capturada (caso normal e
	// permanentemente válido). Quando existe, é sempre a baseline ATIVA (a
	// mais recente por createdAt) — baselines anteriores continuam
	// persistidas como histórico, mas não têm projeção própria nesta rodada
	// (sem seletor/diff entre baselines, DEFER, sem consumidor).
	scheduleBaseline: ScheduleBaselineView | null;
	// Riscos do projeto (ETAPA 10 do rework, primeiro microcorte, D049) —
	// todos os Risks (abertos e encerrados); Acompanhamento filtra por status
	// diretamente, mesmo padrão de impediments acima. Deliberadamente NÃO
	// entra em "Precisa de você" nem em "Atenções" nesta fatia — sem
	// avaliação/urgência estruturada, isso fingiria acionabilidade que o
	// modelo ainda não conhece.
	risks: RiskView[];
	// Decisões/mudanças do projeto (ETAPA 11 do rework, primeiro microcorte,
	// §41) — todas as Decisions/Changes; Acompanhamento filtra por status
	// diretamente, mesmo padrão de risks acima. Deliberadamente NÃO entram em
	// "Precisa de você" nem em "Atenções" nesta fatia — ter prazo não implica
	// nenhuma regra de urgência automática.
	decisions: DecisionView[];
	changes: ChangeView[];
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
	// "Como é tratado hoje" (Stage 4A do rework) — cadeia ordenada de passos
	// e o cabeçalho noTreatment; a interface (ComoETratadoHoje.svelte)
	// desabilita "Continuar" sem round-trip extra, mesma função pura usada
	// pelo domínio na confirmação (getTreatmentConfirmationIssues).
	currentTreatment: CurrentTreatmentView;
	treatmentSteps: TreatmentStepView[];
	treatmentConfirmationIssues: TreatmentConfirmationIssue[];
	// "Entender as causas" (Stage 4B do rework) — cabeçalho stillUnknown e as
	// hipóteses de causa; causeHypothesisConfirmationIssues é sempre [] (ver
	// domain/transitions.ts, getCauseHypothesesConfirmationIssues), mantido
	// aqui só por simetria com affectedGroupConfirmationIssues/
	// treatmentConfirmationIssues, não porque algo bloqueia a conclusão.
	causeExploration: CauseExplorationView;
	causeHypotheses: CauseHypothesisView[];
	causeHypothesisConfirmationIssues: CauseHypothesisConfirmationIssue[];
	// "Resultado desejado" (Stage 4C do rework) — coleção ordenada de
	// DesiredOutcome; a interface (ResultadoDesejado.svelte) desabilita
	// "Confirmar resultado" sem round-trip extra, mesma função pura usada pelo
	// domínio na confirmação (getDesiredOutcomeConfirmationIssues) — mesmo
	// padrão de affectedGroupConfirmationIssues/treatmentConfirmationIssues
	// (bloqueia conclusão, ao contrário de causeHypothesisConfirmationIssues).
	desiredOutcomes: DesiredOutcomeView[];
	desiredOutcomeConfirmationIssues: DesiredOutcomeConfirmationIssue[];
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

// S9 — confirmação de "Decompor o trabalho" (explicit_confirmation contra
// WorkItem real). Localiza a atividade por id fixo no domínio; não recebe
// nenhum dado de WorkItem/PlanningItem — só marca a Activity concluída.
export interface ConfirmDecompositionInput {
	projectId: string;
}

// S9 — confirmação de "Priorizar entregas" (explicit_confirmation contra
// Deliverable real). Localiza a atividade por id fixo no domínio; não
// recebe nenhum dado de Deliverable/PlanningItem — só marca a Activity
// concluída.
export interface ConfirmPlanningPriorityInput {
	projectId: string;
}

// S9 (reconciliação de dependências legadas) — confirmação de "Mapear
// dependências" (explicit_confirmation contra Dependency real, D039). Não
// recebe nenhum dado de Dependency: ZERO é resultado válido, então nenhum
// campo de contagem/estado é necessário aqui — só marca a Activity concluída.
export interface ConfirmDependencyMappingInput {
	projectId: string;
}

// S9 (reconciliação de marcos legados) — confirmação de "Definir marcos"
// (explicit_confirmation contra Milestone real, D040/D041). Não recebe
// nenhum dado de Milestone: ZERO é resultado válido, então nenhum campo de
// contagem/estado é necessário aqui — só marca a Activity concluída.
export interface ConfirmMilestoneReviewInput {
	projectId: string;
}

// S10 (D049, reconciliação de risco legado) — confirmação de "Identificar
// riscos do projeto"/"Atualizar riscos" (explicit_confirmation contra Risk
// real). Não recebe nenhum dado de Risk: ZERO é resultado válido, então
// nenhum campo de contagem/estado é necessário aqui — só marca a Activity
// concluída. Duas atividades distintas, mesmo contrato de input.
export interface ConfirmRiskIdentificationInput {
	projectId: string;
}

export interface ConfirmRiskUpdateInput {
	projectId: string;
}

// S11 (ETAPA 11 do rework, "Decision e Change", §41) — confirmação de
// "Registrar decisões e mudanças" (explicit_confirmation contra
// Decision/Change reais). Não recebe nenhum dado de Decision/Change: ZERO de
// ambas é resultado válido, então nenhum campo de contagem/estado é
// necessário aqui — só marca a Activity concluída.
export interface ConfirmDecisionsAndChangesReviewInput {
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
	// WorkItem que este impedimento bloqueia (ETAPA 6 do rework) — omitido/null
	// para o caso normal de impedimento no nível do projeto, sem vínculo.
	workItemId?: string | null;
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

// Associa, troca ou desassocia (decisionId: null) a Decision relacionada a um
// Impediment `decisao_pendente` (ETAPA 11 do rework, segundo microcorte,
// §41/§13.4) — mesmo padrão de SetWorkItemDeliverableInput.
export interface SetImpedimentDecisionInput {
	projectId: string;
	impedimentId: string;
	decisionId: string | null;
}

// Trabalho (ETAPA 6 do rework) — mesmo padrão dos inputs de ScopeItem/
// Impediment: id gerado pelo caso de uso (idGenerator), nunca recebido do
// cliente.
// deliverableId (ETAPA 9 do rework, segundo microcorte, D043/D044) — opcional,
// permite criar o WorkItem já dentro de uma Deliverable ("criar trabalho
// diretamente dentro dela"). Ausente/null preserva o comportamento anterior.
export interface AddWorkItemInput {
	projectId: string;
	title: string;
	deliverableId?: string | null;
}

export interface MoveWorkItemInput {
	projectId: string;
	workItemId: string;
	status: WorkItemStatus;
}

// Associa, reassocia ou desassocia (deliverableId: null) um WorkItem já
// existente a uma Deliverable — ação explícita e mutável (ETAPA 9, segundo
// microcorte, D043/D044).
export interface SetWorkItemDeliverableInput {
	projectId: string;
	workItemId: string;
	deliverableId: string | null;
}

// Fato temporal MANUAL e atômico — ETAPA 12 do rework ("Scheduling e
// Gantt", §42), primeiro microcorte fundacional. Uma única entrada cobre
// definir, alterar e limpar (os dois null) — mesmo molde de
// SetMilestonePlannedDateInput/SetRiskAssessmentInput.
export interface SetWorkItemScheduleInput {
	projectId: string;
	workItemId: string;
	plannedStart: string | null;
	durationDays: number | null;
}

// Dependency (ETAPA 8 do rework) — mesmo padrão: id gerado pelo caso de uso
// (idGenerator), nunca recebido do cliente.
export interface AddDependencyInput {
	projectId: string;
	workItemId: string;
	dependsOnWorkItemId: string;
}

export interface RemoveDependencyInput {
	projectId: string;
	dependencyId: string;
}

// Propagação de cronograma (ETAPA 12 do rework, §42, terceiro microcorte) —
// preview e confirmação usam a mesma entrada base: qual WorkItem, com
// conflito de precedência já provado, inicia a cascata. Nenhum plano
// PRONTO é recebido do cliente em nenhuma das duas — previewSchedulePropagation
// só lê, applySchedulePropagation sempre recalcula contra o estado atual
// antes de gravar.
export interface PreviewSchedulePropagationInput {
	projectId: string;
	workItemId: string;
}

// Subconjunto canônico do plano que a interface mostrou e o usuário
// confirmou (hardening pós-dogfood, §42 terceiro microcorte) — só o que foi
// efetivamente exibido: WorkItem afetado, data de origem esperada, nova
// data e o predecessor que a prova. Nunca inclui título (denormalização de
// apresentação, irrelevante para o significado do consentimento) nem o id
// da Dependency (nunca mostrado na interface). Servido de volta pelo
// próprio cliente só como EXPECTATIVA para comparação — o navegador nunca é
// fonte de verdade; ver applySchedulePropagation.
export interface SchedulePropagationExpectedChange {
	workItemId: string;
	fromPlannedStart: string;
	toPlannedStart: string;
	viaWorkItemId: string;
}

export interface ApplySchedulePropagationInput {
	projectId: string;
	workItemId: string;
	expected: { changes: SchedulePropagationExpectedChange[]; partial: boolean };
}

// Entregas (ETAPA 9 do rework) — mesmo padrão dos demais inputs: o id é
// gerado pelo caso de uso (idGenerator), nunca recebido do cliente.
export interface AddDeliverableInput {
	projectId: string;
	title: string;
	bucket: DeliverableBucket;
}

export interface SetDeliverableTitleInput {
	projectId: string;
	deliverableId: string;
	title: string;
}

// effort: null é "ainda não estimado" — limpar é a mesma escrita de definir.
export interface SetDeliverableEffortInput {
	projectId: string;
	deliverableId: string;
	effort: DeliverableEffort | null;
}

export interface MoveDeliverableInput {
	projectId: string;
	deliverableId: string;
	bucket: DeliverableBucket;
}

export interface ReorderDeliverablesInput {
	projectId: string;
	orderedIds: string[];
}

export interface RemoveDeliverableInput {
	projectId: string;
	deliverableId: string;
}

// CONFIRM-TO-CONVERT: a única entrada que cria Deliverable a partir de
// ScopeItem, e só existe atrás de uma ação explícita do usuário.
export interface PromoteScopeItemToDeliverableInput {
	projectId: string;
	scopeItemId: string;
}

export interface AddMilestoneInput {
	projectId: string;
	title: string;
}

export interface ReachMilestoneInput {
	projectId: string;
	milestoneId: string;
}

export interface ReopenMilestoneInput {
	projectId: string;
	milestoneId: string;
}

// Uma única entrada cobre definir, reagendar e limpar (plannedDate: null) —
// mesmo molde de SetImpedimentNextActionInput.
export interface SetMilestonePlannedDateInput {
	projectId: string;
	milestoneId: string;
	plannedDate: string | null;
}

// Baseline do cronograma (ETAPA 12 do rework, §42, quinto microcorte,
// hardening pós-dogfood) — mesmo par preview/confirmação de
// PreviewSchedulePropagationInput/ApplySchedulePropagationInput:
// previewScheduleBaselineCapture só lê; captureScheduleBaseline sempre
// recalcula a prontidão contra o estado atual antes de gravar (nunca
// confia no candidato vindo do cliente) e só grava se o recálculo
// corresponder exatamente a `expected` — o candidato que a interface
// efetivamente mostrou (ScheduleBaselineCapturePreviewView.entries,
// devolvido sem alteração). Divergência (WorkItem criado, schedule
// mudado, cobertura mudada) é recusada por inteiro como preview obsoleto,
// nunca aplicada parcialmente — mesmo espírito de
// work_item_precedence_stale_preview.
export interface PreviewScheduleBaselineCaptureInput {
	projectId: string;
}

export interface CaptureScheduleBaselineInput {
	projectId: string;
	expected: { entries: ScheduleBaselineCandidateEntryView[] };
}

export interface LinkWorkItemToMilestoneInput {
	projectId: string;
	milestoneId: string;
	workItemId: string;
}

export interface UnlinkWorkItemFromMilestoneInput {
	projectId: string;
	milestoneWorkItemId: string;
}

// Risk (ETAPA 10 do rework, primeiro microcorte, D049) — mesmo padrão dos
// inputs de Milestone acima: id gerado pelo caso de uso (idGenerator), nunca
// recebido do cliente.
export interface AddRiskInput {
	projectId: string;
	statement: string;
}

export interface EditRiskStatementInput {
	projectId: string;
	riskId: string;
	statement: string;
}

export interface CloseRiskInput {
	projectId: string;
	riskId: string;
}

export interface ReopenRiskInput {
	projectId: string;
	riskId: string;
}

// reviewRisk (ETAPA 10 do rework, segundo microcorte) — confirma revisão sem
// mudar mais nada, mesmo padrão dos demais inputs de Risk acima.
export interface ReviewRiskInput {
	projectId: string;
	riskId: string;
}

// setRiskAssessment/setRiskResponse (ETAPA 10 do rework, terceiro
// microcorte) — mesmo padrão dos demais inputs de Risk acima.
export interface SetRiskAssessmentInput {
	projectId: string;
	riskId: string;
	likelihood: RiskLikelihood | null;
	impact: RiskImpact | null;
}

export interface SetRiskResponseInput {
	projectId: string;
	riskId: string;
	response: string | null;
}

// Decision (ETAPA 11 do rework, primeiro microcorte, §41) — mesmo padrão dos
// inputs de Risk acima: id gerado pelo caso de uso (idGenerator), nunca
// recebido do cliente.
export interface AddDecisionInput {
	projectId: string;
	subject: string;
}

// subject/options/dueDate/responsible editados juntos (mesmo formulário) —
// nunca uma transição de lifecycle.
export interface EditDecisionInput {
	projectId: string;
	decisionId: string;
	subject: string;
	options: string | null;
	dueDate: string | null;
	responsible: string | null;
}

export interface DecideDecisionInput {
	projectId: string;
	decisionId: string;
	outcome: string;
}

// Corrige o outcome de uma decisão já tomada, sem mexer em status/decidedAt.
export interface EditDecisionOutcomeInput {
	projectId: string;
	decisionId: string;
	outcome: string;
}

// linkWorkItemToDecision/unlinkWorkItemFromDecision (ETAPA 11 do rework,
// terceiro microcorte, §41) — mesmo padrão de LinkWorkItemToMilestoneInput/
// UnlinkWorkItemFromMilestoneInput: id da relação gerado pelo caso de uso,
// nunca recebido do cliente.
export interface LinkWorkItemToDecisionInput {
	projectId: string;
	decisionId: string;
	workItemId: string;
}

export interface UnlinkWorkItemFromDecisionInput {
	projectId: string;
	decisionAffectedWorkItemId: string;
}

// Change (ETAPA 11 do rework, primeiro microcorte, §41) — mesmo padrão dos
// inputs de Decision acima.
export interface AddChangeInput {
	projectId: string;
	statement: string;
}

export interface EditChangeStatementInput {
	projectId: string;
	changeId: string;
	statement: string;
}

export interface SetChangeImpactInput {
	projectId: string;
	changeId: string;
	impact: string | null;
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

// Ações externas maduras (ETAPA 14 do rework, §44, D070/D072/D073) — mesmo
// padrão acima: id gerado pelo caso de uso. `approval` não tem preparação
// própria (sem objective/questions/informationToTake/expectedResult, ver
// domain/state-types.ts), então PrepareApprovalExternalActionInput só
// recebe o subject.
export interface PrepareApprovalExternalActionInput {
	projectId: string;
	decisionId: string;
}

// `outcome` aqui é o MESMO texto livre de Decision.outcome (decideDecision)
// — nunca um approvalOutcome/enum approved-rejected (D072). Só válido
// quando a Decision referenciada ainda está 'pendente'; caso já 'tomada',
// o caller usa ReconcileApprovalExternalActionInput abaixo.
export interface CompleteApprovalExternalActionInput {
	projectId: string;
	actionId: string;
	outcome: string;
}

// Reconciliação: a Decision já foi decidida por outro caminho enquanto a
// approval estava aberta — só conclui a ExternalAction, nunca escreve em
// Decision (D072: "a ExternalAction nunca pode sobrescrever a Decision").
export interface ReconcileApprovalExternalActionInput {
	projectId: string;
	actionId: string;
}

// "Como é tratado hoje" (Stage 4A do rework) — mesmo padrão dos inputs de
// AffectedGroup: id gerado pelo caso de uso (idGenerator), nunca recebido do
// cliente.
export interface AddTreatmentStepInput {
	projectId: string;
	whatHappens: string;
}

export interface RemoveTreatmentStepInput {
	projectId: string;
	stepId: string;
}

export interface MoveTreatmentStepInput {
	projectId: string;
	stepId: string;
	direction: -1 | 1;
}

export interface SetTreatmentStepActorsInput {
	projectId: string;
	stepId: string;
	actors: string[];
}

export interface SetTreatmentStepMediumInput {
	projectId: string;
	stepId: string;
	medium: string | null;
}

export interface ToggleTreatmentStepFrictionInput {
	projectId: string;
	stepId: string;
	friction: TreatmentFriction;
}

export interface SetTreatmentNoTreatmentInput {
	projectId: string;
	noTreatment: boolean;
}

export interface ConfirmTreatmentInput {
	projectId: string;
}

// "Entender as causas" (Stage 4B do rework) — mesmo padrão dos inputs de
// AffectedGroup/TreatmentStep: id gerado pelo caso de uso (idGenerator),
// nunca recebido do cliente. `origin`, quando presente, é o rótulo do
// cartão de contexto usado como ponto de partida (ou "Sugestão do Hydra") —
// nunca um vínculo a Evidence.
export interface AddCauseHypothesisInput {
	projectId: string;
	title: string;
	origin?: string | null;
}

export interface SetCauseHypothesisTitleInput {
	projectId: string;
	hypothesisId: string;
	title: string;
}

export interface SetCauseHypothesisExpectedIfTrueInput {
	projectId: string;
	hypothesisId: string;
	value: string | null;
}

export interface SetCauseHypothesisWhatWeakensItInput {
	projectId: string;
	hypothesisId: string;
	value: string | null;
}

export interface ToggleCauseHypothesisEvidenceInput {
	projectId: string;
	hypothesisId: string;
	evidenceId: string;
}

export interface RemoveCauseHypothesisInput {
	projectId: string;
	hypothesisId: string;
}

export interface MarkCauseExplorationUnknownInput {
	projectId: string;
}

export interface UndoCauseExplorationUnknownInput {
	projectId: string;
}

export interface ConfirmCauseHypothesesInput {
	projectId: string;
}

// "Resultado desejado" (Stage 4C do rework) — mesmo padrão dos inputs de
// AffectedGroup/TreatmentStep: id gerado pelo caso de uso (idGenerator),
// nunca recebido do cliente.
export interface AddDesiredOutcomeInput {
	projectId: string;
	change: string;
}

export interface SetDesiredOutcomeChangeInput {
	projectId: string;
	outcomeId: string;
	change: string;
}

export interface SetDesiredOutcomeTargetInput {
	projectId: string;
	outcomeId: string;
	target: string | null;
}

export interface RemoveDesiredOutcomeInput {
	projectId: string;
	outcomeId: string;
}

export interface MoveDesiredOutcomeInput {
	projectId: string;
	outcomeId: string;
	direction: -1 | 1;
}

export interface ConfirmDesiredOutcomesInput {
	projectId: string;
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
	confirmDecomposition(input: ConfirmDecompositionInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmPlanningPriority(input: ConfirmPlanningPriorityInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmDependencyMapping(input: ConfirmDependencyMappingInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmMilestoneReview(input: ConfirmMilestoneReviewInput): Promise<UseCaseOutcome<ProjectView>>;
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
	setImpedimentDecision(input: SetImpedimentDecisionInput): Promise<UseCaseOutcome<ProjectView>>;
	addWorkItem(input: AddWorkItemInput): Promise<UseCaseOutcome<ProjectView>>;
	moveWorkItem(input: MoveWorkItemInput): Promise<UseCaseOutcome<ProjectView>>;
	setWorkItemDeliverable(input: SetWorkItemDeliverableInput): Promise<UseCaseOutcome<ProjectView>>;
	setWorkItemSchedule(input: SetWorkItemScheduleInput): Promise<UseCaseOutcome<ProjectView>>;
	addDependency(input: AddDependencyInput): Promise<UseCaseOutcome<ProjectView>>;
	removeDependency(input: RemoveDependencyInput): Promise<UseCaseOutcome<ProjectView>>;
	previewSchedulePropagation(
		input: PreviewSchedulePropagationInput
	): Promise<UseCaseOutcome<SchedulePropagationPlanView>>;
	applySchedulePropagation(input: ApplySchedulePropagationInput): Promise<UseCaseOutcome<ProjectView>>;
	previewScheduleBaselineCapture(
		input: PreviewScheduleBaselineCaptureInput
	): Promise<UseCaseOutcome<ScheduleBaselineCapturePreviewView>>;
	captureScheduleBaseline(input: CaptureScheduleBaselineInput): Promise<UseCaseOutcome<ProjectView>>;
	addDeliverable(input: AddDeliverableInput): Promise<UseCaseOutcome<ProjectView>>;
	setDeliverableTitle(input: SetDeliverableTitleInput): Promise<UseCaseOutcome<ProjectView>>;
	setDeliverableEffort(input: SetDeliverableEffortInput): Promise<UseCaseOutcome<ProjectView>>;
	moveDeliverable(input: MoveDeliverableInput): Promise<UseCaseOutcome<ProjectView>>;
	reorderDeliverables(input: ReorderDeliverablesInput): Promise<UseCaseOutcome<ProjectView>>;
	removeDeliverable(input: RemoveDeliverableInput): Promise<UseCaseOutcome<ProjectView>>;
	promoteScopeItemToDeliverable(
		input: PromoteScopeItemToDeliverableInput
	): Promise<UseCaseOutcome<ProjectView>>;
	addMilestone(input: AddMilestoneInput): Promise<UseCaseOutcome<ProjectView>>;
	reachMilestone(input: ReachMilestoneInput): Promise<UseCaseOutcome<ProjectView>>;
	reopenMilestone(input: ReopenMilestoneInput): Promise<UseCaseOutcome<ProjectView>>;
	setMilestonePlannedDate(input: SetMilestonePlannedDateInput): Promise<UseCaseOutcome<ProjectView>>;
	linkWorkItemToMilestone(input: LinkWorkItemToMilestoneInput): Promise<UseCaseOutcome<ProjectView>>;
	unlinkWorkItemFromMilestone(input: UnlinkWorkItemFromMilestoneInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmRiskIdentification(input: ConfirmRiskIdentificationInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmRiskUpdate(input: ConfirmRiskUpdateInput): Promise<UseCaseOutcome<ProjectView>>;
	addRisk(input: AddRiskInput): Promise<UseCaseOutcome<ProjectView>>;
	editRiskStatement(input: EditRiskStatementInput): Promise<UseCaseOutcome<ProjectView>>;
	closeRisk(input: CloseRiskInput): Promise<UseCaseOutcome<ProjectView>>;
	reopenRisk(input: ReopenRiskInput): Promise<UseCaseOutcome<ProjectView>>;
	reviewRisk(input: ReviewRiskInput): Promise<UseCaseOutcome<ProjectView>>;
	setRiskAssessment(input: SetRiskAssessmentInput): Promise<UseCaseOutcome<ProjectView>>;
	setRiskResponse(input: SetRiskResponseInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmDecisionsAndChangesReview(
		input: ConfirmDecisionsAndChangesReviewInput
	): Promise<UseCaseOutcome<ProjectView>>;
	addDecision(input: AddDecisionInput): Promise<UseCaseOutcome<ProjectView>>;
	editDecision(input: EditDecisionInput): Promise<UseCaseOutcome<ProjectView>>;
	decideDecision(input: DecideDecisionInput): Promise<UseCaseOutcome<ProjectView>>;
	editDecisionOutcome(input: EditDecisionOutcomeInput): Promise<UseCaseOutcome<ProjectView>>;
	linkWorkItemToDecision(input: LinkWorkItemToDecisionInput): Promise<UseCaseOutcome<ProjectView>>;
	unlinkWorkItemFromDecision(input: UnlinkWorkItemFromDecisionInput): Promise<UseCaseOutcome<ProjectView>>;
	addChange(input: AddChangeInput): Promise<UseCaseOutcome<ProjectView>>;
	editChangeStatement(input: EditChangeStatementInput): Promise<UseCaseOutcome<ProjectView>>;
	setChangeImpact(input: SetChangeImpactInput): Promise<UseCaseOutcome<ProjectView>>;
	addAffectedGroup(input: AddAffectedGroupInput): Promise<UseCaseOutcome<ProjectView>>;
	setAffectedGroupImpact(input: SetAffectedGroupImpactInput): Promise<UseCaseOutcome<ProjectView>>;
	setAffectedGroupFrequency(input: SetAffectedGroupFrequencyInput): Promise<UseCaseOutcome<ProjectView>>;
	removeAffectedGroup(input: RemoveAffectedGroupInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmAffectedGroups(input: ConfirmAffectedGroupsInput): Promise<UseCaseOutcome<ProjectView>>;
	prepareExternalAction(input: PrepareExternalActionInput): Promise<UseCaseOutcome<ProjectView>>;
	completeExternalAction(input: CompleteExternalActionInput): Promise<UseCaseOutcome<ProjectView>>;
	prepareApprovalExternalAction(input: PrepareApprovalExternalActionInput): Promise<UseCaseOutcome<ProjectView>>;
	completeApprovalExternalAction(input: CompleteApprovalExternalActionInput): Promise<UseCaseOutcome<ProjectView>>;
	reconcileApprovalExternalAction(input: ReconcileApprovalExternalActionInput): Promise<UseCaseOutcome<ProjectView>>;
	addTreatmentStep(input: AddTreatmentStepInput): Promise<UseCaseOutcome<ProjectView>>;
	removeTreatmentStep(input: RemoveTreatmentStepInput): Promise<UseCaseOutcome<ProjectView>>;
	moveTreatmentStep(input: MoveTreatmentStepInput): Promise<UseCaseOutcome<ProjectView>>;
	setTreatmentStepActors(input: SetTreatmentStepActorsInput): Promise<UseCaseOutcome<ProjectView>>;
	setTreatmentStepMedium(input: SetTreatmentStepMediumInput): Promise<UseCaseOutcome<ProjectView>>;
	toggleTreatmentStepFriction(input: ToggleTreatmentStepFrictionInput): Promise<UseCaseOutcome<ProjectView>>;
	setTreatmentNoTreatment(input: SetTreatmentNoTreatmentInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmTreatment(input: ConfirmTreatmentInput): Promise<UseCaseOutcome<ProjectView>>;
	addCauseHypothesis(input: AddCauseHypothesisInput): Promise<UseCaseOutcome<ProjectView>>;
	setCauseHypothesisTitle(input: SetCauseHypothesisTitleInput): Promise<UseCaseOutcome<ProjectView>>;
	setCauseHypothesisExpectedIfTrue(input: SetCauseHypothesisExpectedIfTrueInput): Promise<UseCaseOutcome<ProjectView>>;
	setCauseHypothesisWhatWeakensIt(input: SetCauseHypothesisWhatWeakensItInput): Promise<UseCaseOutcome<ProjectView>>;
	toggleCauseHypothesisEvidence(input: ToggleCauseHypothesisEvidenceInput): Promise<UseCaseOutcome<ProjectView>>;
	removeCauseHypothesis(input: RemoveCauseHypothesisInput): Promise<UseCaseOutcome<ProjectView>>;
	markCauseExplorationUnknown(input: MarkCauseExplorationUnknownInput): Promise<UseCaseOutcome<ProjectView>>;
	undoCauseExplorationUnknown(input: UndoCauseExplorationUnknownInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmCauseHypotheses(input: ConfirmCauseHypothesesInput): Promise<UseCaseOutcome<ProjectView>>;
	addDesiredOutcome(input: AddDesiredOutcomeInput): Promise<UseCaseOutcome<ProjectView>>;
	setDesiredOutcomeChange(input: SetDesiredOutcomeChangeInput): Promise<UseCaseOutcome<ProjectView>>;
	setDesiredOutcomeTarget(input: SetDesiredOutcomeTargetInput): Promise<UseCaseOutcome<ProjectView>>;
	removeDesiredOutcome(input: RemoveDesiredOutcomeInput): Promise<UseCaseOutcome<ProjectView>>;
	moveDesiredOutcome(input: MoveDesiredOutcomeInput): Promise<UseCaseOutcome<ProjectView>>;
	confirmDesiredOutcomes(input: ConfirmDesiredOutcomesInput): Promise<UseCaseOutcome<ProjectView>>;
	exportProject(projectId: string): Promise<UseCaseOutcome<string>>;
	importProject(json: string): Promise<UseCaseOutcome<ProjectView>>;
	// Event log incremental (ETAPA 7 do rework) — leitura auxiliar, nunca
	// parte de ProjectView (ver project-view.ts): /records busca separado,
	// mesmo padrão de exportProject/importProject retornando algo que não é
	// ProjectView. filter.entityIds vazio/ausente = todos os eventos do
	// projeto.
	listProjectEvents(projectId: string, filter?: ProjectEventFilter): Promise<UseCaseOutcome<ProjectEvent[]>>;
}
