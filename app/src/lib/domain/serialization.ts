// Serialização JSON versionada — ver docs/06-architecture/contracts.md §6.
// Entrada tratada como não confiável (TECHNICAL_BRIEF.md §11): nunca lança
// exceção, sempre retorna Result; nenhum cast é usado para presumir validade.

import type { ActivityDefinition, Catalog } from './catalog-types';
import type {
	ActivityProgress,
	ActivityStatus,
	AffectedGroup,
	AffectedGroupFrequency,
	AffectedGroupImpact,
	Answer,
	CurrentTreatment,
	Evidence,
	EvidenceOutcome,
	ExternalAction,
	ExternalActionKind,
	ExternalActionStatus,
	Impediment,
	ImpedimentType,
	PendingItem,
	Project,
	ProjectState,
	ScopeBucket,
	ScopeEffort,
	ScopeExecutionStatus,
	ScopeItem,
	ScopeVersion,
	TreatmentFriction,
	TreatmentStep
} from './state-types';
import type { Result } from './result';
import { isDeprecatedAnswerField } from './legacy-answers';
import {
	getAffectedGroupConfirmationIssues,
	getScopeConfirmationIssues,
	getTreatmentConfirmationIssues
} from './transitions';

export interface ExportedProjectState {
	version: 1;
	state: ProjectState;
}

export type ProjectStateParseError =
	| { kind: 'invalid_json' }
	| { kind: 'unsupported_version'; found: number }
	| { kind: 'invalid_shape'; details: string }
	| { kind: 'invalid_reference'; details: string }
	| { kind: 'invariant_violation'; details: string };

export function serializeProjectState(state: ProjectState): string {
	const envelope: ExportedProjectState = { version: 1, state };
	return JSON.stringify(envelope);
}

// --- narrowing seguro de unknown ------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === 'string';
}

function isIsoDateString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

const ACTIVITY_STATUSES: readonly string[] = ['não_iniciada', 'em_andamento', 'concluída', 'pulada'];
function isActivityStatus(value: unknown): value is ActivityStatus {
	return typeof value === 'string' && ACTIVITY_STATUSES.includes(value);
}

const PENDING_ITEM_STATUSES: readonly string[] = ['aberta', 'resolvida'];
function isPendingItemStatus(value: unknown): value is 'aberta' | 'resolvida' {
	return typeof value === 'string' && PENDING_ITEM_STATUSES.includes(value);
}

const IMPEDIMENT_TYPES: readonly string[] = [
	'dependencia_externa',
	'decisao_pendente',
	'falta_de_recurso',
	'bloqueio_tecnico',
	'outro'
];
function isImpedimentType(value: unknown): value is ImpedimentType {
	return typeof value === 'string' && IMPEDIMENT_TYPES.includes(value);
}

const IMPEDIMENT_STATUSES: readonly string[] = ['aberto', 'resolvido'];
function isImpedimentStatus(value: unknown): value is 'aberto' | 'resolvido' {
	return typeof value === 'string' && IMPEDIMENT_STATUSES.includes(value);
}

function shapeError(details: string): Result<never, ProjectStateParseError> {
	return { ok: false, error: { kind: 'invalid_shape', details } };
}

function referenceError(details: string): Result<never, ProjectStateParseError> {
	return { ok: false, error: { kind: 'invalid_reference', details } };
}

function invariantError(details: string): Result<never, ProjectStateParseError> {
	return { ok: false, error: { kind: 'invariant_violation', details } };
}

// --- fase 3: parsing bruto de cada entidade -------------------------------

function parseProject(value: unknown): Result<Project, ProjectStateParseError> {
	if (!isRecord(value)) return shapeError('project deve ser um objeto');
	if (!isString(value.id)) return shapeError('project.id deve ser uma string');
	if (value.name !== null && !isString(value.name)) {
		return shapeError('project.name deve ser string ou null');
	}
	if (!isIsoDateString(value.createdAt)) {
		return shapeError('project.createdAt deve ser uma data ISO 8601 válida');
	}
	if (
		value.routeStartPhaseId !== undefined &&
		value.routeStartPhaseId !== null &&
		!isString(value.routeStartPhaseId)
	) {
		return shapeError('project.routeStartPhaseId deve ser string, null ou ausente');
	}
	return {
		ok: true,
		value: {
			id: value.id,
			name: value.name,
			createdAt: value.createdAt,
			// ausente (JSON exportado antes de D023) equivale a null — mesma
			// semântica de "percurso completo", sem exigir backfill.
			routeStartPhaseId: (value.routeStartPhaseId as string | null | undefined) ?? null
		}
	};
}

function parseActivityProgressList(value: unknown): Result<ActivityProgress[], ProjectStateParseError> {
	if (!Array.isArray(value)) return shapeError('activityProgress deve ser um array');
	const result: ActivityProgress[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada ActivityProgress deve ser um objeto');
		if (!isString(item.projectId)) return shapeError('ActivityProgress.projectId deve ser uma string');
		if (!isString(item.activityDefinitionId)) {
			return shapeError('ActivityProgress.activityDefinitionId deve ser uma string');
		}
		if (!isActivityStatus(item.status)) {
			return shapeError('ActivityProgress.status deve ser um dos literais aprovados');
		}
		result.push({ projectId: item.projectId, activityDefinitionId: item.activityDefinitionId, status: item.status });
	}
	return { ok: true, value: result };
}

function parseAnswerList(value: unknown): Result<Answer[], ProjectStateParseError> {
	if (!Array.isArray(value)) return shapeError('answers deve ser um array');
	const result: Answer[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada Answer deve ser um objeto');
		if (!isString(item.projectId)) return shapeError('Answer.projectId deve ser uma string');
		if (!isString(item.activityDefinitionId)) return shapeError('Answer.activityDefinitionId deve ser uma string');
		if (!isString(item.fieldDefinitionId)) return shapeError('Answer.fieldDefinitionId deve ser uma string');
		if (!isString(item.value)) return shapeError('Answer.value deve ser uma string');
		if (!isIsoDateString(item.createdAt)) return shapeError('Answer.createdAt deve ser uma data ISO 8601 válida');
		if (!isIsoDateString(item.updatedAt)) return shapeError('Answer.updatedAt deve ser uma data ISO 8601 válida');
		result.push({
			projectId: item.projectId,
			activityDefinitionId: item.activityDefinitionId,
			fieldDefinitionId: item.fieldDefinitionId,
			value: item.value,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt
		});
	}
	return { ok: true, value: result };
}

interface RawPendingItem {
	id: string;
	projectId: string;
	activityDefinitionId: string;
	createdAt: string;
	status: 'aberta' | 'resolvida';
	resolvedAt: string | undefined;
}

function parsePendingItemList(value: unknown): Result<RawPendingItem[], ProjectStateParseError> {
	if (!Array.isArray(value)) return shapeError('pendingItems deve ser um array');
	const result: RawPendingItem[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada PendingItem deve ser um objeto');
		if (!isString(item.id)) return shapeError('PendingItem.id deve ser uma string');
		if (!isString(item.projectId)) return shapeError('PendingItem.projectId deve ser uma string');
		if (!isString(item.activityDefinitionId)) {
			return shapeError('PendingItem.activityDefinitionId deve ser uma string');
		}
		if (!isIsoDateString(item.createdAt)) {
			return shapeError('PendingItem.createdAt deve ser uma data ISO 8601 válida');
		}
		if (!isPendingItemStatus(item.status)) {
			return shapeError('PendingItem.status deve ser "aberta" ou "resolvida"');
		}
		let resolvedAt: string | undefined;
		if (item.resolvedAt === undefined) {
			resolvedAt = undefined;
		} else if (isIsoDateString(item.resolvedAt)) {
			resolvedAt = item.resolvedAt;
		} else {
			return shapeError('PendingItem.resolvedAt, quando presente, deve ser uma data ISO 8601 válida');
		}
		result.push({
			id: item.id,
			projectId: item.projectId,
			activityDefinitionId: item.activityDefinitionId,
			createdAt: item.createdAt,
			status: item.status,
			resolvedAt
		});
	}
	return { ok: true, value: result };
}

const SCOPE_BUCKETS: readonly string[] = ['agora', 'depois', 'fora'];
function isScopeBucket(value: unknown): value is ScopeBucket {
	return typeof value === 'string' && SCOPE_BUCKETS.includes(value);
}

const SCOPE_EFFORTS: readonly string[] = ['pequeno', 'medio', 'grande'];
function isScopeEffortOrNull(value: unknown): value is ScopeEffort | null {
	return value === null || (typeof value === 'string' && SCOPE_EFFORTS.includes(value));
}

const SCOPE_EXECUTION_STATUSES: readonly string[] = ['a_fazer', 'em_andamento', 'concluido'];
function isScopeExecutionStatus(value: unknown): value is ScopeExecutionStatus {
	return typeof value === 'string' && SCOPE_EXECUTION_STATUSES.includes(value);
}

function parseScopeItemList(value: unknown): Result<ScopeItem[], ProjectStateParseError> {
	if (!Array.isArray(value)) return shapeError('scopeItems deve ser um array');
	const result: ScopeItem[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada ScopeItem deve ser um objeto');
		if (!isString(item.id)) return shapeError('ScopeItem.id deve ser uma string');
		if (!isString(item.projectId)) return shapeError('ScopeItem.projectId deve ser uma string');
		if (!isString(item.text)) return shapeError('ScopeItem.text deve ser uma string');
		if (!isScopeBucket(item.bucket)) return shapeError('ScopeItem.bucket deve ser um dos literais aprovados');
		if (!isScopeEffortOrNull(item.effort)) {
			return shapeError('ScopeItem.effort deve ser um dos literais aprovados ou null');
		}
		if (item.order !== null && (typeof item.order !== 'number' || !Number.isInteger(item.order) || item.order < 0)) {
			return shapeError('ScopeItem.order deve ser um inteiro não negativo ou null');
		}
		if (item.sourceSuggestionId !== null && !isString(item.sourceSuggestionId)) {
			return shapeError('ScopeItem.sourceSuggestionId deve ser uma string ou null');
		}
		// Ausente em estados/JSON anteriores a D025 — equivale a 'a_fazer'.
		if (item.executionStatus !== undefined && !isScopeExecutionStatus(item.executionStatus)) {
			return shapeError('ScopeItem.executionStatus, quando presente, deve ser um dos literais aprovados');
		}
		if (!isIsoDateString(item.createdAt)) return shapeError('ScopeItem.createdAt deve ser uma data ISO 8601 válida');
		if (!isIsoDateString(item.updatedAt)) return shapeError('ScopeItem.updatedAt deve ser uma data ISO 8601 válida');
		result.push({
			id: item.id,
			projectId: item.projectId,
			text: item.text,
			bucket: item.bucket,
			effort: item.effort,
			order: item.order as number | null,
			sourceSuggestionId: (item.sourceSuggestionId as string | null) ?? null,
			executionStatus: (item.executionStatus as ScopeExecutionStatus | undefined) ?? 'a_fazer',
			createdAt: item.createdAt,
			updatedAt: item.updatedAt
		});
	}
	return { ok: true, value: result };
}

function parseScopeVersion(value: unknown): Result<ScopeVersion, ProjectStateParseError> {
	if (!isRecord(value)) return shapeError('scopeVersion deve ser um objeto');
	if (!isString(value.projectId)) return shapeError('ScopeVersion.projectId deve ser uma string');
	if (!isString(value.hypothesis)) return shapeError('ScopeVersion.hypothesis deve ser uma string');
	if (value.confirmedAt !== null && !isIsoDateString(value.confirmedAt)) {
		return shapeError('ScopeVersion.confirmedAt deve ser uma data ISO 8601 válida ou null');
	}
	return {
		ok: true,
		value: {
			projectId: value.projectId,
			hypothesis: value.hypothesis,
			confirmedAt: (value.confirmedAt as string | null) ?? null
		}
	};
}

function parseImpedimentList(value: unknown): Result<Impediment[], ProjectStateParseError> {
	if (value === undefined) return { ok: true, value: [] };
	if (!Array.isArray(value)) return shapeError('impediments deve ser um array');
	const result: Impediment[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada Impediment deve ser um objeto');
		if (!isString(item.id)) return shapeError('Impediment.id deve ser uma string');
		if (!isString(item.projectId)) return shapeError('Impediment.projectId deve ser uma string');
		if (!isString(item.text)) return shapeError('Impediment.text deve ser uma string');
		if (!isImpedimentType(item.tipo)) return shapeError('Impediment.tipo deve ser um dos literais aprovados');
		if (item.nextAction !== null && !isString(item.nextAction)) {
			return shapeError('Impediment.nextAction deve ser string ou null');
		}
		if (!isImpedimentStatus(item.status)) {
			return shapeError('Impediment.status deve ser "aberto" ou "resolvido"');
		}
		if (!isIsoDateString(item.createdAt)) {
			return shapeError('Impediment.createdAt deve ser uma data ISO 8601 válida');
		}
		if (!isIsoDateString(item.updatedAt)) {
			return shapeError('Impediment.updatedAt deve ser uma data ISO 8601 válida');
		}
		if (item.resolvedAt !== null && !isIsoDateString(item.resolvedAt)) {
			return shapeError('Impediment.resolvedAt deve ser uma data ISO 8601 válida ou null');
		}
		result.push({
			id: item.id,
			projectId: item.projectId,
			text: item.text,
			tipo: item.tipo,
			nextAction: (item.nextAction as string | null) ?? null,
			status: item.status,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
			resolvedAt: (item.resolvedAt as string | null) ?? null
		});
	}
	return { ok: true, value: result };
}

const AFFECTED_GROUP_IMPACTS: readonly string[] = ['alto', 'medio', 'baixo', 'desconhecido'];
function isAffectedGroupImpactOrNull(value: unknown): value is AffectedGroupImpact | null {
	return value === null || (typeof value === 'string' && AFFECTED_GROUP_IMPACTS.includes(value));
}

const AFFECTED_GROUP_FREQUENCIES: readonly string[] = ['constante', 'frequente', 'as_vezes', 'raro', 'desconhecido'];
function isAffectedGroupFrequencyOrNull(value: unknown): value is AffectedGroupFrequency | null {
	return value === null || (typeof value === 'string' && AFFECTED_GROUP_FREQUENCIES.includes(value));
}

function parseAffectedGroupList(value: unknown): Result<AffectedGroup[], ProjectStateParseError> {
	if (value === undefined) return { ok: true, value: [] };
	if (!Array.isArray(value)) return shapeError('affectedGroups deve ser um array');
	const result: AffectedGroup[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada AffectedGroup deve ser um objeto');
		if (!isString(item.id)) return shapeError('AffectedGroup.id deve ser uma string');
		if (!isString(item.projectId)) return shapeError('AffectedGroup.projectId deve ser uma string');
		if (!isString(item.label) || item.label.trim().length === 0) {
			return shapeError('AffectedGroup.label deve ser uma string não vazia');
		}
		if (!isAffectedGroupImpactOrNull(item.impact)) {
			return shapeError('AffectedGroup.impact deve ser um dos literais aprovados ou null');
		}
		if (!isAffectedGroupFrequencyOrNull(item.frequency)) {
			return shapeError('AffectedGroup.frequency deve ser um dos literais aprovados ou null');
		}
		if (!isIsoDateString(item.createdAt)) {
			return shapeError('AffectedGroup.createdAt deve ser uma data ISO 8601 válida');
		}
		if (!isIsoDateString(item.updatedAt)) {
			return shapeError('AffectedGroup.updatedAt deve ser uma data ISO 8601 válida');
		}
		result.push({
			id: item.id,
			projectId: item.projectId,
			label: item.label,
			impact: item.impact as AffectedGroupImpact | null,
			frequency: item.frequency as AffectedGroupFrequency | null,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt
		});
	}
	return { ok: true, value: result };
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const EXTERNAL_ACTION_KINDS: readonly string[] = ['validate_affected_group'];
function isExternalActionKind(value: unknown): value is ExternalActionKind {
	return typeof value === 'string' && EXTERNAL_ACTION_KINDS.includes(value);
}

const EXTERNAL_ACTION_STATUSES: readonly string[] = ['aberta', 'concluida'];
function isExternalActionStatus(value: unknown): value is ExternalActionStatus {
	return typeof value === 'string' && EXTERNAL_ACTION_STATUSES.includes(value);
}

const EVIDENCE_OUTCOMES: readonly string[] = ['confirmed', 'partially_confirmed', 'contradicted', 'new_discovery'];
function isEvidenceOutcome(value: unknown): value is EvidenceOutcome {
	return typeof value === 'string' && EVIDENCE_OUTCOMES.includes(value);
}

function parseExternalActionList(value: unknown): Result<ExternalAction[], ProjectStateParseError> {
	if (value === undefined) return { ok: true, value: [] };
	if (!Array.isArray(value)) return shapeError('externalActions deve ser um array');
	const result: ExternalAction[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada ExternalAction deve ser um objeto');
		if (!isString(item.id)) return shapeError('ExternalAction.id deve ser uma string');
		if (!isString(item.projectId)) return shapeError('ExternalAction.projectId deve ser uma string');
		if (!isExternalActionKind(item.kind)) return shapeError('ExternalAction.kind deve ser um dos literais aprovados');
		if (!isString(item.affectedGroupId)) return shapeError('ExternalAction.affectedGroupId deve ser uma string');
		if (!isExternalActionStatus(item.status)) return shapeError('ExternalAction.status deve ser "aberta" ou "concluida"');
		if (!isString(item.objective) || item.objective.trim().length === 0) {
			return shapeError('ExternalAction.objective deve ser uma string não vazia');
		}
		if (!isStringArray(item.questions)) return shapeError('ExternalAction.questions deve ser um array de strings');
		if (!isStringArray(item.informationToTake)) {
			return shapeError('ExternalAction.informationToTake deve ser um array de strings');
		}
		if (!isString(item.expectedResult) || item.expectedResult.trim().length === 0) {
			return shapeError('ExternalAction.expectedResult deve ser uma string não vazia');
		}
		if (!isIsoDateString(item.createdAt)) return shapeError('ExternalAction.createdAt deve ser uma data ISO 8601 válida');
		if (!isIsoDateString(item.updatedAt)) return shapeError('ExternalAction.updatedAt deve ser uma data ISO 8601 válida');
		if (item.completedAt !== null && !isIsoDateString(item.completedAt)) {
			return shapeError('ExternalAction.completedAt deve ser uma data ISO 8601 válida ou null');
		}
		result.push({
			id: item.id,
			projectId: item.projectId,
			kind: item.kind,
			affectedGroupId: item.affectedGroupId,
			status: item.status,
			objective: item.objective,
			questions: item.questions,
			informationToTake: item.informationToTake,
			expectedResult: item.expectedResult,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
			completedAt: item.completedAt as string | null
		});
	}
	return { ok: true, value: result };
}

function parseEvidenceList(value: unknown): Result<Evidence[], ProjectStateParseError> {
	if (value === undefined) return { ok: true, value: [] };
	if (!Array.isArray(value)) return shapeError('evidences deve ser um array');
	const result: Evidence[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada Evidence deve ser um objeto');
		if (!isString(item.id)) return shapeError('Evidence.id deve ser uma string');
		if (!isString(item.projectId)) return shapeError('Evidence.projectId deve ser uma string');
		if (!isString(item.externalActionId)) return shapeError('Evidence.externalActionId deve ser uma string');
		if (!isString(item.affectedGroupId)) return shapeError('Evidence.affectedGroupId deve ser uma string');
		if (item.kind !== 'conversation') return shapeError('Evidence.kind deve ser "conversation"');
		if (!isEvidenceOutcome(item.outcome)) return shapeError('Evidence.outcome deve ser um dos literais aprovados');
		if (!isString(item.learning) || item.learning.trim().length === 0) {
			return shapeError('Evidence.learning deve ser uma string não vazia');
		}
		if (!isIsoDateString(item.createdAt)) return shapeError('Evidence.createdAt deve ser uma data ISO 8601 válida');
		result.push({
			id: item.id,
			projectId: item.projectId,
			externalActionId: item.externalActionId,
			affectedGroupId: item.affectedGroupId,
			kind: 'conversation',
			outcome: item.outcome,
			learning: item.learning,
			createdAt: item.createdAt
		});
	}
	return { ok: true, value: result };
}

function parseCurrentTreatment(value: unknown): Result<CurrentTreatment, ProjectStateParseError> {
	if (!isRecord(value)) return shapeError('currentTreatment deve ser um objeto');
	if (!isString(value.projectId)) return shapeError('CurrentTreatment.projectId deve ser uma string');
	if (typeof value.noTreatment !== 'boolean') return shapeError('CurrentTreatment.noTreatment deve ser um booleano');
	if (!isIsoDateString(value.updatedAt)) {
		return shapeError('CurrentTreatment.updatedAt deve ser uma data ISO 8601 válida');
	}
	return { ok: true, value: { projectId: value.projectId, noTreatment: value.noTreatment, updatedAt: value.updatedAt } };
}

const TREATMENT_FRICTIONS: readonly string[] = ['espera', 'retrabalho', 'improviso', 'trava'];
function isTreatmentFriction(value: unknown): value is TreatmentFriction {
	return typeof value === 'string' && TREATMENT_FRICTIONS.includes(value);
}
function isTreatmentFrictionArray(value: unknown): value is TreatmentFriction[] {
	return Array.isArray(value) && value.every(isTreatmentFriction);
}

function parseTreatmentStepList(value: unknown): Result<TreatmentStep[], ProjectStateParseError> {
	if (value === undefined) return { ok: true, value: [] };
	if (!Array.isArray(value)) return shapeError('treatmentSteps deve ser um array');
	const result: TreatmentStep[] = [];
	for (const item of value) {
		if (!isRecord(item)) return shapeError('cada TreatmentStep deve ser um objeto');
		if (!isString(item.id)) return shapeError('TreatmentStep.id deve ser uma string');
		if (!isString(item.projectId)) return shapeError('TreatmentStep.projectId deve ser uma string');
		if (typeof item.order !== 'number' || !Number.isInteger(item.order) || item.order < 0) {
			return shapeError('TreatmentStep.order deve ser um inteiro não negativo');
		}
		if (!isString(item.whatHappens) || item.whatHappens.trim().length === 0) {
			return shapeError('TreatmentStep.whatHappens deve ser uma string não vazia');
		}
		if (!isStringArray(item.actors)) return shapeError('TreatmentStep.actors deve ser um array de strings');
		if (item.medium !== null && !isString(item.medium)) {
			return shapeError('TreatmentStep.medium deve ser string ou null');
		}
		if (!isTreatmentFrictionArray(item.frictions)) {
			return shapeError('TreatmentStep.frictions deve ser um array dos literais aprovados');
		}
		if (!isIsoDateString(item.createdAt)) return shapeError('TreatmentStep.createdAt deve ser uma data ISO 8601 válida');
		if (!isIsoDateString(item.updatedAt)) return shapeError('TreatmentStep.updatedAt deve ser uma data ISO 8601 válida');
		result.push({
			id: item.id,
			projectId: item.projectId,
			order: item.order,
			whatHappens: item.whatHappens,
			actors: item.actors,
			medium: item.medium as string | null,
			frictions: item.frictions,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt
		});
	}
	return { ok: true, value: result };
}

// --- fase 4: referências contra o catálogo --------------------------------

function findActivityDefinition(catalog: Catalog, activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

// --- fase 5 + montagem final ------------------------------------------------

function assembleProjectState(
	catalog: Catalog,
	project: Project,
	activityProgress: ActivityProgress[],
	answers: Answer[],
	rawPendingItems: RawPendingItem[],
	scopeItems: ScopeItem[],
	scopeVersion: ScopeVersion,
	impediments: Impediment[],
	affectedGroups: AffectedGroup[],
	externalActions: ExternalAction[],
	evidences: Evidence[],
	currentTreatment: CurrentTreatment,
	treatmentSteps: TreatmentStep[]
): Result<ProjectState, ProjectStateParseError> {
	// referência: Project.routeStartPhaseId (D023)
	if (project.routeStartPhaseId !== null && project.routeStartPhaseId !== undefined) {
		if (!catalog.phases.some((phase) => phase.id === project.routeStartPhaseId)) {
			return referenceError(
				`Project.routeStartPhaseId referencia a fase "${project.routeStartPhaseId}", que não existe no catálogo`
			);
		}
	}

	// referências: ActivityProgress
	for (const progress of activityProgress) {
		if (progress.projectId !== project.id) {
			return invariantError(
				`ActivityProgress "${progress.activityDefinitionId}" usa projectId diferente do Project`
			);
		}
		if (!findActivityDefinition(catalog, progress.activityDefinitionId)) {
			return referenceError(
				`ActivityProgress referencia activityDefinitionId "${progress.activityDefinitionId}", que não existe no catálogo`
			);
		}
	}

	// invariante: exatamente um ActivityProgress por atividade do catálogo
	const catalogActivityIds = catalog.phases.flatMap((phase) => phase.activities.map((activity) => activity.id));
	const progressByActivity = new Map<string, number>();
	for (const progress of activityProgress) {
		progressByActivity.set(
			progress.activityDefinitionId,
			(progressByActivity.get(progress.activityDefinitionId) ?? 0) + 1
		);
	}
	for (const activityId of catalogActivityIds) {
		const count = progressByActivity.get(activityId) ?? 0;
		if (count === 0) return invariantError(`Falta ActivityProgress para a atividade "${activityId}"`);
		if (count > 1) return invariantError(`ActivityProgress duplicado para a atividade "${activityId}"`);
	}
	if (progressByActivity.size !== catalogActivityIds.length) {
		return invariantError('Existe ActivityProgress para atividade fora do catálogo');
	}

	// invariante: uma atividade explicit_confirmation não pulável (allowsSkip
	// false) nunca pode ter status pulada — skipActivity já impede isso em
	// tempo de execução; aqui a mesma regra é verificada contra o estado
	// desserializado.
	for (const progress of activityProgress) {
		const activity = findActivityDefinition(catalog, progress.activityDefinitionId);
		if (
			activity?.completionMode === 'explicit_confirmation' &&
			activity.allowsSkip === false &&
			progress.status === 'pulada'
		) {
			return invariantError(
				`Atividade "${activity.id}" é explicit_confirmation com allowsSkip false mas tem ActivityProgress.status "pulada"`
			);
		}
	}

	// referências + invariantes: Answer
	const seenAnswerKeys = new Set<string>();
	for (const answer of answers) {
		if (answer.projectId !== project.id) {
			return invariantError(`Answer do campo "${answer.fieldDefinitionId}" usa projectId diferente do Project`);
		}

		// READ-LEGACY (ver domain/legacy-answers.ts): um campo oficialmente
		// deprecado (ex.: publico_detail, ETAPA 2 do rework) não é mais
		// validado contra o catálogo atual — snapshots exportados antes da
		// mudança continuam importáveis, com o dado preservado tal como
		// estava. Ainda exige projectId correto (acima) e proíbe duplicata
		// (abaixo); nunca é lido por nenhuma projeção nem convertido em
		// nada automaticamente.
		if (isDeprecatedAnswerField(answer.activityDefinitionId, answer.fieldDefinitionId)) {
			const legacyKey = `${answer.activityDefinitionId}::${answer.fieldDefinitionId}`;
			if (seenAnswerKeys.has(legacyKey)) {
				return invariantError(`Answer duplicada para o campo "${answer.fieldDefinitionId}"`);
			}
			seenAnswerKeys.add(legacyKey);
			continue;
		}

		const activity = findActivityDefinition(catalog, answer.activityDefinitionId);
		if (!activity) {
			return referenceError(
				`Answer referencia activityDefinitionId "${answer.activityDefinitionId}", que não existe no catálogo`
			);
		}
		if (activity.completionMode !== 'required_fields') {
			return referenceError(
				`Answer referencia fieldDefinitionId "${answer.fieldDefinitionId}" numa atividade sem campos ("${activity.id}")`
			);
		}
		const field = activity.fields.find((f) => f.id === answer.fieldDefinitionId);
		if (!field) {
			return referenceError(
				`Answer referencia fieldDefinitionId "${answer.fieldDefinitionId}", que não pertence à atividade "${activity.id}"`
			);
		}
		if (field.dataTarget !== 'answer') {
			return invariantError(
				`Answer referencia o campo "${field.id}", que tem dataTarget "project_property" e não pode ter Answer`
			);
		}
		const key = `${answer.activityDefinitionId}::${answer.fieldDefinitionId}`;
		if (seenAnswerKeys.has(key)) {
			return invariantError(`Answer duplicada para o campo "${answer.fieldDefinitionId}"`);
		}
		seenAnswerKeys.add(key);
	}

	// referências + invariantes: PendingItem
	const seenPendingItemIds = new Set<string>();
	const seenPendingItemActivities = new Set<string>();
	const pendingItems: PendingItem[] = [];
	for (const raw of rawPendingItems) {
		if (raw.projectId !== project.id) {
			return invariantError(`PendingItem "${raw.id}" usa projectId diferente do Project`);
		}
		const activity = findActivityDefinition(catalog, raw.activityDefinitionId);
		if (!activity) {
			return referenceError(
				`PendingItem referencia activityDefinitionId "${raw.activityDefinitionId}", que não existe no catálogo`
			);
		}
		if (!activity.allowsSkip) {
			return invariantError(`PendingItem referencia atividade "${activity.id}", que não permite pular`);
		}
		if (seenPendingItemIds.has(raw.id)) {
			return invariantError(`PendingItem.id duplicado: "${raw.id}"`);
		}
		seenPendingItemIds.add(raw.id);
		if (seenPendingItemActivities.has(raw.activityDefinitionId)) {
			return invariantError(`Mais de um PendingItem para a atividade "${raw.activityDefinitionId}"`);
		}
		seenPendingItemActivities.add(raw.activityDefinitionId);

		if (raw.status === 'aberta') {
			if (raw.resolvedAt !== undefined) {
				return invariantError(`PendingItem "${raw.id}" está aberta mas possui resolvedAt`);
			}
			pendingItems.push({
				id: raw.id,
				projectId: raw.projectId,
				activityDefinitionId: raw.activityDefinitionId,
				createdAt: raw.createdAt,
				status: 'aberta'
			});
		} else {
			if (raw.resolvedAt === undefined) {
				return invariantError(`PendingItem "${raw.id}" está resolvida mas não possui resolvedAt`);
			}
			pendingItems.push({
				id: raw.id,
				projectId: raw.projectId,
				activityDefinitionId: raw.activityDefinitionId,
				createdAt: raw.createdAt,
				status: 'resolvida',
				resolvedAt: raw.resolvedAt
			});
		}
	}

	// referências + invariantes: ScopeItem
	const seenScopeItemIds = new Set<string>();
	for (const item of scopeItems) {
		if (item.projectId !== project.id) {
			return invariantError(`ScopeItem "${item.id}" usa projectId diferente do Project`);
		}
		if (seenScopeItemIds.has(item.id)) {
			return invariantError(`ScopeItem.id duplicado: "${item.id}"`);
		}
		seenScopeItemIds.add(item.id);
		if (item.bucket === 'agora' && item.order === null) {
			return invariantError(`ScopeItem "${item.id}" está em "agora" mas não tem order`);
		}
		if (item.bucket !== 'agora' && item.order !== null) {
			return invariantError(`ScopeItem "${item.id}" não está em "agora" mas tem order definido`);
		}
	}

	const agoraOrders = scopeItems
		.filter((item) => item.bucket === 'agora')
		.map((item) => item.order as number)
		.sort((a, b) => a - b);
	for (let i = 0; i < agoraOrders.length; i++) {
		if (agoraOrders[i] !== i) {
			return invariantError('Os itens de "agora" não têm order contíguo começando em 0');
		}
	}

	// referências + invariantes: ScopeVersion
	if (scopeVersion.projectId !== project.id) {
		return invariantError('ScopeVersion usa projectId diferente do Project');
	}
	if (scopeVersion.confirmedAt !== null) {
		const issues = getScopeConfirmationIssues(scopeItems, scopeVersion);
		if (issues.length > 0) {
			const issueKinds = issues.map((issue) => issue.kind).join(', ');
			return invariantError(
				`ScopeVersion está confirmada (confirmedAt definido) mas não atende aos critérios de confirmação: ${issueKinds}`
			);
		}
	}

	// referências + invariantes: Impediment — coleção independente do catálogo,
	// sem activityDefinitionId para validar contra ele (ver domain/state-types.ts).
	const seenImpedimentIds = new Set<string>();
	for (const impediment of impediments) {
		if (impediment.projectId !== project.id) {
			return invariantError(`Impediment "${impediment.id}" usa projectId diferente do Project`);
		}
		if (seenImpedimentIds.has(impediment.id)) {
			return invariantError(`Impediment.id duplicado: "${impediment.id}"`);
		}
		seenImpedimentIds.add(impediment.id);
		if (impediment.status === 'aberto' && impediment.resolvedAt !== null) {
			return invariantError(`Impediment "${impediment.id}" está aberto mas possui resolvedAt`);
		}
		if (impediment.status === 'resolvido' && impediment.resolvedAt === null) {
			return invariantError(`Impediment "${impediment.id}" está resolvido mas não possui resolvedAt`);
		}
	}

	// referências + invariantes: AffectedGroup — ligado à atividade `publico`
	// do catálogo (ao contrário de Impediment), mas sem activityDefinitionId
	// próprio: a ligação é fixa (AFFECTED_GROUPS_ACTIVITY_ID em transitions.ts),
	// não um dado armazenado por grupo.
	const seenAffectedGroupIds = new Set<string>();
	for (const group of affectedGroups) {
		if (group.projectId !== project.id) {
			return invariantError(`AffectedGroup "${group.id}" usa projectId diferente do Project`);
		}
		if (seenAffectedGroupIds.has(group.id)) {
			return invariantError(`AffectedGroup.id duplicado: "${group.id}"`);
		}
		seenAffectedGroupIds.add(group.id);
	}

	// invariante: se "publico" está concluída, o mapa precisa atender aos
	// critérios de confirmação (mesmo padrão de ScopeVersion.confirmedAt
	// acima) — EXCETO quando a conclusão vem de um snapshot legado (Answer
	// READ-LEGACY de publico_detail presente, ver domain/legacy-answers.ts):
	// nesse caso "publico" foi concluída pelo mecanismo antigo
	// (required_fields), antes de AffectedGroup existir, e não deve ser
	// invalidada por não ter grupos — isso é exatamente a compatibilidade de
	// import que esta exceção existe para preservar.
	const hasLegacyPublicoDetail = answers.some(
		(answer) => answer.activityDefinitionId === 'publico' && answer.fieldDefinitionId === 'publico_detail'
	);
	const publicoProgress = activityProgress.find((progress) => progress.activityDefinitionId === 'publico');
	if (publicoProgress?.status === 'concluída' && !hasLegacyPublicoDetail) {
		const issues = getAffectedGroupConfirmationIssues(affectedGroups);
		if (issues.length > 0) {
			const issueKinds = issues.map((issue) => issue.kind).join(', ');
			return invariantError(
				`Atividade "publico" está concluída mas o Mapa de Impacto não atende aos critérios de confirmação: ${issueKinds}`
			);
		}
	}

	// referências + invariantes: ExternalAction (ETAPA 3 do rework) —
	// affectedGroupId precisa referenciar um AffectedGroup existente; no
	// máximo uma ExternalAction aberta de `validate_affected_group` por
	// grupo (mesma regra de domain/transitions.ts, prepareExternalAction);
	// lifecycle coerente: 'aberta' nunca tem completedAt, 'concluida' sempre
	// tem.
	const affectedGroupIds = new Set(affectedGroups.map((group) => group.id));
	const seenExternalActionIds = new Set<string>();
	const openActionAffectedGroupIds = new Set<string>();
	for (const action of externalActions) {
		if (action.projectId !== project.id) {
			return invariantError(`ExternalAction "${action.id}" usa projectId diferente do Project`);
		}
		if (seenExternalActionIds.has(action.id)) {
			return invariantError(`ExternalAction.id duplicado: "${action.id}"`);
		}
		seenExternalActionIds.add(action.id);
		if (!affectedGroupIds.has(action.affectedGroupId)) {
			return referenceError(
				`ExternalAction "${action.id}" referencia affectedGroupId "${action.affectedGroupId}", que não existe`
			);
		}
		if (action.status === 'aberta') {
			if (action.completedAt !== null) {
				return invariantError(`ExternalAction "${action.id}" está aberta mas possui completedAt`);
			}
			const key = `${action.kind}::${action.affectedGroupId}`;
			if (openActionAffectedGroupIds.has(key)) {
				return invariantError(
					`Mais de uma ExternalAction aberta de "${action.kind}" para o grupo "${action.affectedGroupId}"`
				);
			}
			openActionAffectedGroupIds.add(key);
		} else if (action.completedAt === null) {
			return invariantError(`ExternalAction "${action.id}" está concluída mas não possui completedAt`);
		}
	}

	// referências + invariantes: Evidence — externalActionId precisa
	// referenciar uma ExternalAction concluída (nunca aberta: Evidence só
	// nasce junto da conclusão, ver completeExternalAction), affectedGroupId
	// precisa bater com o da própria ExternalAction (nunca divergir), e cada
	// ExternalAction concluída precisa ter exatamente uma Evidence — nunca
	// zero (ação concluída sem Evidence) nem duas (mesmo clique/retry).
	const seenEvidenceIds = new Set<string>();
	const evidenceByExternalActionId = new Map<string, Evidence>();
	for (const evidence of evidences) {
		if (evidence.projectId !== project.id) {
			return invariantError(`Evidence "${evidence.id}" usa projectId diferente do Project`);
		}
		if (seenEvidenceIds.has(evidence.id)) {
			return invariantError(`Evidence.id duplicado: "${evidence.id}"`);
		}
		seenEvidenceIds.add(evidence.id);
		const action = externalActions.find((item) => item.id === evidence.externalActionId);
		if (!action) {
			return referenceError(
				`Evidence "${evidence.id}" referencia externalActionId "${evidence.externalActionId}", que não existe`
			);
		}
		if (action.status !== 'concluida') {
			return invariantError(`Evidence "${evidence.id}" referencia uma ExternalAction que não está concluída`);
		}
		if (evidence.affectedGroupId !== action.affectedGroupId) {
			return invariantError(`Evidence "${evidence.id}" tem affectedGroupId diferente da sua ExternalAction`);
		}
		if (evidenceByExternalActionId.has(evidence.externalActionId)) {
			return invariantError(`Mais de uma Evidence para a mesma ExternalAction "${evidence.externalActionId}"`);
		}
		evidenceByExternalActionId.set(evidence.externalActionId, evidence);
	}
	for (const action of externalActions) {
		if (action.status === 'concluida' && !evidenceByExternalActionId.has(action.id)) {
			return invariantError(`ExternalAction "${action.id}" está concluída mas não possui Evidence correspondente`);
		}
	}

	// referência + invariante: CurrentTreatment — 1:1 com Project (mesmo
	// padrão de ScopeVersion).
	if (currentTreatment.projectId !== project.id) {
		return invariantError('CurrentTreatment usa projectId diferente do Project');
	}

	// referências + invariantes: TreatmentStep — order 0-based contíguo
	// (mesma regra dos itens de "agora" em ScopeItem acima).
	const seenTreatmentStepIds = new Set<string>();
	for (const step of treatmentSteps) {
		if (step.projectId !== project.id) {
			return invariantError(`TreatmentStep "${step.id}" usa projectId diferente do Project`);
		}
		if (seenTreatmentStepIds.has(step.id)) {
			return invariantError(`TreatmentStep.id duplicado: "${step.id}"`);
		}
		seenTreatmentStepIds.add(step.id);
	}
	const treatmentStepOrders = treatmentSteps.map((step) => step.order).sort((a, b) => a - b);
	for (let i = 0; i < treatmentStepOrders.length; i++) {
		if (treatmentStepOrders[i] !== i) {
			return invariantError('Os passos de treatmentSteps não têm order contíguo começando em 0');
		}
	}

	// invariante canônica crítica (HYDRA_PRODUCT_REWORK.md §34): o estado
	// persistido nunca tem noTreatment=true com passos ativos ao mesmo
	// tempo — nunca os dois.
	if (currentTreatment.noTreatment && treatmentSteps.length > 0) {
		return invariantError('CurrentTreatment.noTreatment é true mas existem treatmentSteps ativos — mutuamente exclusivos');
	}

	// invariante: se "estado_atual" está concluída, o tratamento precisa
	// atender aos critérios de confirmação (mesmo padrão de
	// ScopeVersion.confirmedAt/AffectedGroup acima) — EXCETO quando a
	// conclusão vem de um snapshot legado (Answer READ-LEGACY de
	// estado_atual_detail presente): nesse caso "estado_atual" foi
	// concluída pelo mecanismo antigo (required_fields), antes de
	// CurrentTreatment existir.
	const hasLegacyEstadoAtualDetail = answers.some(
		(answer) => answer.activityDefinitionId === 'estado_atual' && answer.fieldDefinitionId === 'estado_atual_detail'
	);
	const estadoAtualProgress = activityProgress.find((progress) => progress.activityDefinitionId === 'estado_atual');
	if (estadoAtualProgress?.status === 'concluída' && !hasLegacyEstadoAtualDetail) {
		const issues = getTreatmentConfirmationIssues(currentTreatment.noTreatment, treatmentSteps);
		if (issues.length > 0) {
			const issueKinds = issues.map((issue) => issue.kind).join(', ');
			return invariantError(
				`Atividade "estado_atual" está concluída mas "Como é tratado hoje" não atende aos critérios de confirmação: ${issueKinds}`
			);
		}
	}

	return {
		ok: true,
		value: {
			project,
			activityProgress,
			answers,
			pendingItems,
			scopeItems,
			scopeVersion,
			impediments,
			affectedGroups,
			externalActions,
			evidences,
			currentTreatment,
			treatmentSteps
		}
	};
}

export function deserializeProjectState(
	json: string,
	catalog: Catalog
): Result<ProjectState, ProjectStateParseError> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return { ok: false, error: { kind: 'invalid_json' } };
	}

	if (!isRecord(parsed)) {
		return shapeError('o JSON raiz precisa ser um objeto') as Result<ProjectState, ProjectStateParseError>;
	}
	if (typeof parsed.version !== 'number') {
		return shapeError('campo "version" ausente ou não numérico') as Result<
			ProjectState,
			ProjectStateParseError
		>;
	}
	if (parsed.version !== 1) {
		return { ok: false, error: { kind: 'unsupported_version', found: parsed.version } };
	}
	if (!isRecord(parsed.state)) {
		return shapeError('campo "state" ausente ou não é um objeto') as Result<
			ProjectState,
			ProjectStateParseError
		>;
	}

	const state = parsed.state;

	const projectResult = parseProject(state.project);
	if (!projectResult.ok) return projectResult;

	const activityProgressResult = parseActivityProgressList(state.activityProgress);
	if (!activityProgressResult.ok) return activityProgressResult;

	const answersResult = parseAnswerList(state.answers);
	if (!answersResult.ok) return answersResult;

	const pendingItemsResult = parsePendingItemList(state.pendingItems);
	if (!pendingItemsResult.ok) return pendingItemsResult;

	const scopeItemsResult = parseScopeItemList(state.scopeItems);
	if (!scopeItemsResult.ok) return scopeItemsResult;

	const scopeVersionResult = parseScopeVersion(state.scopeVersion);
	if (!scopeVersionResult.ok) return scopeVersionResult;

	const impedimentsResult = parseImpedimentList(state.impediments);
	if (!impedimentsResult.ok) return impedimentsResult;

	const affectedGroupsResult = parseAffectedGroupList(state.affectedGroups);
	if (!affectedGroupsResult.ok) return affectedGroupsResult;

	const externalActionsResult = parseExternalActionList(state.externalActions);
	if (!externalActionsResult.ok) return externalActionsResult;

	const evidencesResult = parseEvidenceList(state.evidences);
	if (!evidencesResult.ok) return evidencesResult;

	// currentTreatment é 1:1 com o projeto, mas não existia antes do Stage 4A
	// do rework — snapshots exportados antes dessa mudança não têm essa
	// chave. Mesmo espírito de READ-LEGACY: um snapshot antigo é
	// reconstruído com o mesmo estado inicial que createInitialProjectState
	// sempre produziu (noTreatment: false, sem passos), nunca inferido do
	// conteúdo do snapshot.
	const currentTreatmentResult =
		state.currentTreatment === undefined
			? ({
					ok: true,
					value: { projectId: projectResult.value.id, noTreatment: false, updatedAt: projectResult.value.createdAt }
				} as const)
			: parseCurrentTreatment(state.currentTreatment);
	if (!currentTreatmentResult.ok) return currentTreatmentResult;

	const treatmentStepsResult = parseTreatmentStepList(state.treatmentSteps);
	if (!treatmentStepsResult.ok) return treatmentStepsResult;

	return assembleProjectState(
		catalog,
		projectResult.value,
		activityProgressResult.value,
		answersResult.value,
		pendingItemsResult.value,
		scopeItemsResult.value,
		scopeVersionResult.value,
		impedimentsResult.value,
		affectedGroupsResult.value,
		externalActionsResult.value,
		evidencesResult.value,
		currentTreatmentResult.value,
		treatmentStepsResult.value
	);
}
