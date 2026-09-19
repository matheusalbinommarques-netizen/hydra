// Conversão linha SQLite ↔ objeto de domínio — uso interno deste módulo.
// Nenhum detalhe SQL (nomes de coluna, tipos SQL) atravessa a interface
// ProjectRepository.

import type {
	ActivityProgress,
	ActivityStatus,
	AffectedGroup,
	AffectedGroupFrequency,
	AffectedGroupImpact,
	Answer,
	CauseExploration,
	CauseHypothesis,
	Change,
	CurrentTreatment,
	Decision,
	DecisionAffectedWorkItem,
	DecisionStatus,
	Dependency,
	Milestone,
	Deliverable,
	DeliverableBucket,
	DeliverableEffort,
	MilestoneStatus,
	MilestoneWorkItem,
	ProjectScheduleBaseline,
	ProjectScheduleBaselineEntry,
	DesiredOutcome,
	Evidence,
	EvidenceOutcome,
	ExternalAction,
	ExternalActionKind,
	ExternalActionStatus,
	Impediment,
	ImpedimentType,
	PendingItem,
	Project,
	ProjectEvent,
	Risk,
	RiskImpact,
	RiskLikelihood,
	RiskStatus,
	ScopeBucket,
	ScopeEffort,
	ScopeExecutionStatus,
	ScopeItem,
	ScopeVersion,
	TreatmentFriction,
	TreatmentStep,
	WorkItem,
	WorkItemStatus
} from '$lib/domain';

export interface ProjectRow {
	id: string;
	name: string | null;
	created_at: string;
	route_start_phase_id: string | null;
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
	return { id: row.id, name: row.name, createdAt: row.created_at, routeStartPhaseId: row.route_start_phase_id };
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
	execution_status: ScopeExecutionStatus;
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
		executionStatus: row.execution_status,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function mapScopeVersionRow(row: ScopeVersionRow): ScopeVersion {
	return { projectId: row.project_id, hypothesis: row.hypothesis, confirmedAt: row.confirmed_at };
}

export interface ImpedimentRow {
	id: string;
	project_id: string;
	text: string;
	tipo: ImpedimentType;
	next_action: string | null;
	status: 'aberto' | 'resolvido';
	work_item_id: string | null;
	decision_id: string | null;
	created_at: string;
	updated_at: string;
	resolved_at: string | null;
}

export function mapImpedimentRow(row: ImpedimentRow): Impediment {
	return {
		id: row.id,
		projectId: row.project_id,
		text: row.text,
		tipo: row.tipo,
		nextAction: row.next_action,
		status: row.status,
		workItemId: row.work_item_id,
		decisionId: row.decision_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		resolvedAt: row.resolved_at
	};
}

export interface WorkItemRow {
	id: string;
	project_id: string;
	title: string;
	status: WorkItemStatus;
	deliverable_id: string | null;
	planned_start: string | null;
	duration_days: number | null;
	created_at: string;
	updated_at: string;
}

export function mapWorkItemRow(row: WorkItemRow): WorkItem {
	return {
		id: row.id,
		projectId: row.project_id,
		title: row.title,
		status: row.status,
		deliverableId: row.deliverable_id,
		plannedStart: row.planned_start,
		durationDays: row.duration_days,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface DependencyRow {
	id: string;
	project_id: string;
	work_item_id: string;
	depends_on_work_item_id: string;
	created_at: string;
}

export function mapDependencyRow(row: DependencyRow): Dependency {
	return {
		id: row.id,
		projectId: row.project_id,
		workItemId: row.work_item_id,
		dependsOnWorkItemId: row.depends_on_work_item_id,
		createdAt: row.created_at
	};
}

export interface ScheduleBaselineRow {
	id: string;
	project_id: string;
	created_at: string;
	version: number;
}

export function mapScheduleBaselineRow(row: ScheduleBaselineRow): ProjectScheduleBaseline {
	return { id: row.id, projectId: row.project_id, createdAt: row.created_at, version: row.version };
}

// Sem `id` (ver ProjectScheduleBaselineEntry, domain/state-types.ts) — a
// linha SQLite também não tem: a PK é composta (baseline_id, work_item_id).
// planned_start/duration_days são nullable (hardening pós-dogfood): toda
// captura registra uma linha por WorkItem existente, com ou sem schedule.
export interface ScheduleBaselineEntryRow {
	baseline_id: string;
	work_item_id: string;
	planned_start: string | null;
	duration_days: number | null;
}

export function mapScheduleBaselineEntryRow(row: ScheduleBaselineEntryRow): ProjectScheduleBaselineEntry {
	return {
		baselineId: row.baseline_id,
		workItemId: row.work_item_id,
		plannedStart: row.planned_start,
		durationDays: row.duration_days
	};
}

export interface DeliverableRow {
	id: string;
	project_id: string;
	title: string;
	bucket: DeliverableBucket;
	effort: DeliverableEffort | null;
	item_order: number | null;
	source_scope_item_id: string | null;
	created_at: string;
	updated_at: string;
}

export function mapDeliverableRow(row: DeliverableRow): Deliverable {
	return {
		id: row.id,
		projectId: row.project_id,
		title: row.title,
		bucket: row.bucket,
		effort: row.effort,
		order: row.item_order,
		sourceScopeItemId: row.source_scope_item_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface MilestoneRow {
	id: string;
	project_id: string;
	title: string;
	status: MilestoneStatus;
	reached_at: string | null;
	planned_date: string | null;
	created_at: string;
	updated_at: string;
}

export function mapMilestoneRow(row: MilestoneRow): Milestone {
	return {
		id: row.id,
		projectId: row.project_id,
		title: row.title,
		status: row.status,
		reachedAt: row.reached_at,
		plannedDate: row.planned_date,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface MilestoneWorkItemRow {
	id: string;
	project_id: string;
	milestone_id: string;
	work_item_id: string;
	created_at: string;
}

export function mapMilestoneWorkItemRow(row: MilestoneWorkItemRow): MilestoneWorkItem {
	return {
		id: row.id,
		projectId: row.project_id,
		milestoneId: row.milestone_id,
		workItemId: row.work_item_id,
		createdAt: row.created_at
	};
}

export interface RiskRow {
	id: string;
	project_id: string;
	statement: string;
	status: RiskStatus;
	closed_at: string | null;
	reviewed_at: string | null;
	likelihood: RiskLikelihood | null;
	impact: RiskImpact | null;
	response: string | null;
	created_at: string;
	updated_at: string;
}

export function mapRiskRow(row: RiskRow): Risk {
	return {
		id: row.id,
		projectId: row.project_id,
		statement: row.statement,
		status: row.status,
		closedAt: row.closed_at,
		reviewedAt: row.reviewed_at,
		likelihood: row.likelihood,
		impact: row.impact,
		response: row.response,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface DecisionRow {
	id: string;
	project_id: string;
	subject: string;
	options: string | null;
	due_date: string | null;
	responsible: string | null;
	status: DecisionStatus;
	outcome: string | null;
	decided_at: string | null;
	created_at: string;
	updated_at: string;
}

export function mapDecisionRow(row: DecisionRow): Decision {
	return {
		id: row.id,
		projectId: row.project_id,
		subject: row.subject,
		options: row.options,
		dueDate: row.due_date,
		responsible: row.responsible,
		status: row.status,
		outcome: row.outcome,
		decidedAt: row.decided_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface DecisionAffectedWorkItemRow {
	id: string;
	project_id: string;
	decision_id: string;
	work_item_id: string;
	created_at: string;
}

export function mapDecisionAffectedWorkItemRow(row: DecisionAffectedWorkItemRow): DecisionAffectedWorkItem {
	return {
		id: row.id,
		projectId: row.project_id,
		decisionId: row.decision_id,
		workItemId: row.work_item_id,
		createdAt: row.created_at
	};
}

export interface ChangeRow {
	id: string;
	project_id: string;
	statement: string;
	impact: string | null;
	created_at: string;
	updated_at: string;
}

export function mapChangeRow(row: ChangeRow): Change {
	return {
		id: row.id,
		projectId: row.project_id,
		statement: row.statement,
		impact: row.impact,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface AffectedGroupRow {
	id: string;
	project_id: string;
	label: string;
	impact: AffectedGroupImpact | null;
	frequency: AffectedGroupFrequency | null;
	created_at: string;
	updated_at: string;
}

export function mapAffectedGroupRow(row: AffectedGroupRow): AffectedGroup {
	return {
		id: row.id,
		projectId: row.project_id,
		label: row.label,
		impact: row.impact,
		frequency: row.frequency,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

// ETAPA 14 (§44, D072/D073): affected_group_id e os quatro campos de
// preparação só existem para `validate_affected_group`; decision_id só
// existe para `approval`. Todos NULL-áveis na tabela (ver
// ensureExternalActionApprovalSupport, sqlite-project-repository.ts) — o
// mapper reconstrói a variante certa da união a partir de `kind`, nunca lê
// um campo fora da variante correspondente.
export interface ExternalActionRow {
	id: string;
	project_id: string;
	kind: ExternalActionKind;
	affected_group_id: string | null;
	decision_id: string | null;
	status: ExternalActionStatus;
	objective: string | null;
	// questions/information_to_take: JSON array em TEXT — mesmo padrão de
	// codificação de PlanningItem (domain/planning-items.ts), aqui aplicado
	// diretamente no mapper por não haver formulário que precise conhecer o
	// encoding (a UI recebe/envia arrays já decodificados via ProjectView).
	questions: string | null;
	information_to_take: string | null;
	expected_result: string | null;
	created_at: string;
	updated_at: string;
	completed_at: string | null;
}

export function mapExternalActionRow(row: ExternalActionRow): ExternalAction {
	if (row.kind === 'approval') {
		return {
			id: row.id,
			projectId: row.project_id,
			kind: 'approval',
			decisionId: row.decision_id as string,
			status: row.status,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			completedAt: row.completed_at
		};
	}

	return {
		id: row.id,
		projectId: row.project_id,
		kind: 'validate_affected_group',
		affectedGroupId: row.affected_group_id as string,
		status: row.status,
		objective: row.objective as string,
		questions: JSON.parse(row.questions as string) as string[],
		informationToTake: JSON.parse(row.information_to_take as string) as string[],
		expectedResult: row.expected_result as string,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		completedAt: row.completed_at
	};
}

export interface EvidenceRow {
	id: string;
	project_id: string;
	external_action_id: string;
	affected_group_id: string;
	kind: 'conversation';
	outcome: EvidenceOutcome;
	learning: string;
	created_at: string;
}

export function mapEvidenceRow(row: EvidenceRow): Evidence {
	return {
		id: row.id,
		projectId: row.project_id,
		externalActionId: row.external_action_id,
		affectedGroupId: row.affected_group_id,
		kind: row.kind,
		outcome: row.outcome,
		learning: row.learning,
		createdAt: row.created_at
	};
}

export interface CurrentTreatmentRow {
	project_id: string;
	no_treatment: 0 | 1;
	updated_at: string;
}

export function mapCurrentTreatmentRow(row: CurrentTreatmentRow): CurrentTreatment {
	return { projectId: row.project_id, noTreatment: row.no_treatment === 1, updatedAt: row.updated_at };
}

export interface TreatmentStepRow {
	id: string;
	project_id: string;
	step_order: number;
	what_happens: string;
	// actors/frictions: JSON array em TEXT — mesmo padrão de
	// ExternalActionRow.questions/information_to_take acima.
	actors: string;
	medium: string | null;
	frictions: string;
	created_at: string;
	updated_at: string;
}

export function mapTreatmentStepRow(row: TreatmentStepRow): TreatmentStep {
	return {
		id: row.id,
		projectId: row.project_id,
		order: row.step_order,
		whatHappens: row.what_happens,
		actors: JSON.parse(row.actors) as string[],
		medium: row.medium,
		frictions: JSON.parse(row.frictions) as TreatmentFriction[],
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface CauseExplorationRow {
	project_id: string;
	still_unknown: 0 | 1;
	updated_at: string;
}

export function mapCauseExplorationRow(row: CauseExplorationRow): CauseExploration {
	return { projectId: row.project_id, stillUnknown: row.still_unknown === 1, updatedAt: row.updated_at };
}

export interface CauseHypothesisRow {
	id: string;
	project_id: string;
	title: string;
	origin: string | null;
	expected_if_true: string | null;
	what_weakens_it: string | null;
	// evidence_ids: JSON array em TEXT — mesmo padrão de
	// TreatmentStepRow.actors/frictions acima.
	evidence_ids: string;
	created_at: string;
	updated_at: string;
}

export function mapCauseHypothesisRow(row: CauseHypothesisRow): CauseHypothesis {
	return {
		id: row.id,
		projectId: row.project_id,
		title: row.title,
		origin: row.origin,
		expectedIfTrue: row.expected_if_true,
		whatWeakensIt: row.what_weakens_it,
		evidenceIds: JSON.parse(row.evidence_ids) as string[],
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface DesiredOutcomeRow {
	id: string;
	project_id: string;
	change: string;
	target: string | null;
	outcome_order: number;
	created_at: string;
	updated_at: string;
}

export function mapDesiredOutcomeRow(row: DesiredOutcomeRow): DesiredOutcome {
	return {
		id: row.id,
		projectId: row.project_id,
		change: row.change,
		target: row.target,
		order: row.outcome_order,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

// Event log incremental (ETAPA 7 do rework) — payload é JSON em TEXT (mesmo
// padrão de encoding já usado por ExternalActionRow.questions/TreatmentStepRow.actors
// acima). type/entity_type confiam nas CHECK constraints do schema (mesmo
// nível de confiança já aplicado a ImpedimentRow.status/WorkItemRow.status —
// nenhuma outra linha deste arquivo revalida o CHECK do banco em runtime).
export interface ProjectEventRow {
	id: string;
	project_id: string;
	type: string;
	entity_type: string;
	entity_id: string;
	payload: string;
	created_at: string;
}

export function mapProjectEventRow(row: ProjectEventRow): ProjectEvent {
	return {
		id: row.id,
		projectId: row.project_id,
		type: row.type,
		entityType: row.entity_type,
		entityId: row.entity_id,
		payload: JSON.parse(row.payload),
		createdAt: row.created_at
	} as ProjectEvent;
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
