// Serialização JSON versionada — ver docs/06-architecture/contracts.md §6.
// Entrada tratada como não confiável (TECHNICAL_BRIEF.md §11): nunca lança
// exceção, sempre retorna Result; nenhum cast é usado para presumir validade.

import type { ActivityDefinition, Catalog } from './catalog-types';
import type {
	ActivityProgress,
	ActivityStatus,
	Answer,
	Impediment,
	ImpedimentType,
	PendingItem,
	Project,
	ProjectState,
	ScopeBucket,
	ScopeEffort,
	ScopeItem,
	ScopeVersion
} from './state-types';
import type { Result } from './result';
import { getScopeConfirmationIssues } from './transitions';

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
	impediments: Impediment[]
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

	// invariante: nenhuma atividade explicit_confirmation com status pulada
	for (const progress of activityProgress) {
		const activity = findActivityDefinition(catalog, progress.activityDefinitionId);
		if (activity?.completionMode === 'explicit_confirmation' && progress.status === 'pulada') {
			return invariantError(
				`Atividade "${activity.id}" é explicit_confirmation mas tem ActivityProgress.status "pulada"`
			);
		}
	}

	// referências + invariantes: Answer
	const seenAnswerKeys = new Set<string>();
	for (const answer of answers) {
		if (answer.projectId !== project.id) {
			return invariantError(`Answer do campo "${answer.fieldDefinitionId}" usa projectId diferente do Project`);
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

	return {
		ok: true,
		value: { project, activityProgress, answers, pendingItems, scopeItems, scopeVersion, impediments }
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

	return assembleProjectState(
		catalog,
		projectResult.value,
		activityProgressResult.value,
		answersResult.value,
		pendingItemsResult.value,
		scopeItemsResult.value,
		scopeVersionResult.value,
		impedimentsResult.value
	);
}
