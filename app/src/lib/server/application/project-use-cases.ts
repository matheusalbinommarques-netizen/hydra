// Casos de uso — ver docs/06-architecture/contracts.md §10. Coordena
// ProjectRepository, domain/, catalog/ (via dependência) e orientation-engine/.
// Nenhum SQL, nenhuma rota, nenhum HTML — só orquestração.

import type { ActivityDefinition, ActivityProgress, Catalog, ProjectEvent, ProjectState } from '$lib/domain';
import { computeNextActivity, computeProjectStatus, computeSnapshot } from '$lib/orientation-engine';
import type { NextActivityResult } from '$lib/orientation-engine';
import {
	addAffectedGroup as addAffectedGroupInDomain,
	addCauseHypothesis as addCauseHypothesisInDomain,
	addDesiredOutcome as addDesiredOutcomeInDomain,
	addImpediment as addImpedimentInDomain,
	addScopeItem as addScopeItemInDomain,
	addTreatmentStep as addTreatmentStepInDomain,
	addDependency as addDependencyInDomain,
	addWorkItem as addWorkItemInDomain,
	answerActivity as answerActivityInDomain,
	completeExternalAction as completeExternalActionInDomain,
	confirmAffectedGroups as confirmAffectedGroupsInDomain,
	confirmCauseHypotheses as confirmCauseHypothesesInDomain,
	confirmDesiredOutcomes as confirmDesiredOutcomesInDomain,
	confirmPlanningPriority as confirmPlanningPriorityInDomain,
	confirmScopeVersion as confirmScopeVersionInDomain,
	confirmSummary as confirmSummaryInDomain,
	confirmTreatment as confirmTreatmentInDomain,
	createInitialProjectState,
	deserializeProjectEvents,
	deserializeProjectState,
	markCauseExplorationUnknown as markCauseExplorationUnknownInDomain,
	moveDesiredOutcome as moveDesiredOutcomeInDomain,
	moveScopeItem as moveScopeItemInDomain,
	moveTreatmentStep as moveTreatmentStepInDomain,
	moveWorkItem as moveWorkItemInDomain,
	prepareExternalAction as prepareExternalActionInDomain,
	removeAffectedGroup as removeAffectedGroupInDomain,
	removeCauseHypothesis as removeCauseHypothesisInDomain,
	removeDependency as removeDependencyInDomain,
	removeDesiredOutcome as removeDesiredOutcomeInDomain,
	removeScopeItem as removeScopeItemInDomain,
	removeTreatmentStep as removeTreatmentStepInDomain,
	renameProject as renameProjectInDomain,
	reopenImpediment as reopenImpedimentInDomain,
	reorderAgoraItems as reorderAgoraItemsInDomain,
	resolveImpediment as resolveImpedimentInDomain,
	serializeProjectState,
	setAffectedGroupFrequency as setAffectedGroupFrequencyInDomain,
	setAffectedGroupImpact as setAffectedGroupImpactInDomain,
	setCauseHypothesisExpectedIfTrue as setCauseHypothesisExpectedIfTrueInDomain,
	setCauseHypothesisTitle as setCauseHypothesisTitleInDomain,
	setCauseHypothesisWhatWeakensIt as setCauseHypothesisWhatWeakensItInDomain,
	setDesiredOutcomeChange as setDesiredOutcomeChangeInDomain,
	setDesiredOutcomeTarget as setDesiredOutcomeTargetInDomain,
	setHypothesis as setHypothesisInDomain,
	setImpedimentNextAction as setImpedimentNextActionInDomain,
	setImpedimentType as setImpedimentTypeInDomain,
	setRouteStartPhase as setRouteStartPhaseInDomain,
	setScopeItemEffort as setScopeItemEffortInDomain,
	setScopeItemExecutionStatus as setScopeItemExecutionStatusInDomain,
	setScopeItemText as setScopeItemTextInDomain,
	setTreatmentNoTreatment as setTreatmentNoTreatmentInDomain,
	setTreatmentStepActors as setTreatmentStepActorsInDomain,
	setTreatmentStepMedium as setTreatmentStepMediumInDomain,
	skipActivity as skipActivityInDomain,
	toggleCauseHypothesisEvidence as toggleCauseHypothesisEvidenceInDomain,
	toggleTreatmentStepFriction as toggleTreatmentStepFrictionInDomain,
	undoCauseExplorationUnknown as undoCauseExplorationUnknownInDomain
} from '$lib/domain';
import { buildExternalActionPreparation } from '$lib/catalog/external-action';
import type { ProjectEventFilter, ProjectRepository } from '../persistence';
import type { Clock, IdGenerator } from './ports';
import { buildProjectView } from './project-view';
import type {
	AddAffectedGroupInput,
	AddCauseHypothesisInput,
	AddDesiredOutcomeInput,
	AddImpedimentInput,
	AddScopeItemInput,
	AddTreatmentStepInput,
	AddDependencyInput,
	AddWorkItemInput,
	AnswerActivityInput,
	CompleteExternalActionInput,
	ConfirmAffectedGroupsInput,
	ConfirmCauseHypothesesInput,
	ConfirmDesiredOutcomesInput,
	ConfirmPlanningPriorityInput,
	ConfirmScopeVersionInput,
	ConfirmSummaryInput,
	ConfirmTreatmentInput,
	CreateConfiguredProjectInput,
	MarkCauseExplorationUnknownInput,
	MoveDesiredOutcomeInput,
	MoveScopeItemInput,
	MoveTreatmentStepInput,
	MoveWorkItemInput,
	RemoveDependencyInput,
	PrepareExternalActionInput,
	ProjectListItem,
	ProjectUseCases,
	RemoveAffectedGroupInput,
	RemoveCauseHypothesisInput,
	RemoveDesiredOutcomeInput,
	RemoveScopeItemInput,
	RemoveTreatmentStepInput,
	RenameProjectInput,
	ReopenImpedimentInput,
	ReorderAgoraItemsInput,
	ResolveImpedimentInput,
	SetAffectedGroupFrequencyInput,
	SetAffectedGroupImpactInput,
	SetCauseHypothesisExpectedIfTrueInput,
	SetCauseHypothesisTitleInput,
	SetCauseHypothesisWhatWeakensItInput,
	SetDesiredOutcomeChangeInput,
	SetDesiredOutcomeTargetInput,
	SetHypothesisInput,
	SetImpedimentNextActionInput,
	SetImpedimentTypeInput,
	SetRouteStartPhaseInput,
	SetScopeItemEffortInput,
	SetScopeItemExecutionStatusInput,
	SetScopeItemTextInput,
	SetTreatmentNoTreatmentInput,
	SetTreatmentStepActorsInput,
	SetTreatmentStepMediumInput,
	SkipActivityInput,
	ToggleCauseHypothesisEvidenceInput,
	ToggleTreatmentStepFrictionInput,
	UndoCauseExplorationUnknownInput,
	UseCaseOutcome
} from './types';
import type { ProjectView } from './types';

export interface ProjectUseCasesDependencies {
	repository: ProjectRepository;
	catalog: Catalog;
	clock: Clock;
	idGenerator: IdGenerator;
}

// Mesmo padrão já usado em domain/transitions.ts, server/application/project-view.ts,
// domain/serialization.ts, records/records-view.ts e now/+page.server.ts — o
// helper de orientation-engine/catalog-lookup.ts é interno àquele módulo.
function findActivityDefinition(catalog: Catalog, activityId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityId);
		if (found) return found;
	}
	return undefined;
}

// nextActivityResult.activityDefinitionId sempre vem do próprio catalog (via
// computeNextActivity/computeSnapshot) — não encontrar a definição é catálogo
// inconsistente, não um caso de UI a tratar com texto de reserva.
function requireActivityDefinition(catalog: Catalog, activityId: string): ActivityDefinition {
	const found = findActivityDefinition(catalog, activityId);
	if (!found) {
		throw new Error(`Catálogo inconsistente: atividade "${activityId}" recomendada mas não encontrada.`);
	}
	return found;
}

// Home (Ciclo 6, C6-01) — resumo mínimo de fase, calculado localmente em vez
// de reaproveitar phase-progress.ts/phase-activities.ts (projeção de
// apresentação, ver comentário de ProjectListItem.currentPhase em types.ts).
// Mesma regra de fase-alvo do painel "Progresso da fase": a fase da
// atividade recomendada, ou a última fase aplicável quando o catálogo já
// foi esgotado.
function currentPhaseSummary(
	catalog: Catalog,
	activityProgress: ActivityProgress[],
	nextActivityResult: NextActivityResult
): ProjectListItem['currentPhase'] {
	const phase =
		nextActivityResult.kind === 'recommendation'
			? catalog.phases.find((p) => p.activities.some((activity) => activity.id === nextActivityResult.activityDefinitionId))
			: [...catalog.phases].reverse().find((p) => p.catalogStatus !== 'unavailable');
	if (!phase) return undefined;

	const activityIds = new Set(phase.activities.map((activity) => activity.id));
	const completedActivities = activityProgress.filter(
		(progress) => activityIds.has(progress.activityDefinitionId) && progress.status === 'concluída'
	).length;

	return {
		phaseId: phase.id,
		phaseLabel: phase.label,
		completedActivities,
		totalActivities: phase.activities.length
	};
}

// Home (Ciclo 6, C6-01) — "última movimentação significativa": máximo entre
// todos os timestamps já existentes em ProjectState que representam uma
// mutação real do usuário. ActivityProgress e ScopeVersion (fora de
// confirmedAt) não têm timestamp próprio, por isso não entram aqui.
// Project.createdAt nunca entra nesta lista — a criação do projeto sozinha
// não é evidência de movimento (ver computeMovementSignal), só serve de
// referência para "há quanto tempo" quando não há nenhum movimento real.
function computeLastMovementAt(state: ProjectState): string | null {
	const timestamps: string[] = [];
	for (const answer of state.answers) timestamps.push(answer.updatedAt);
	for (const item of state.scopeItems) timestamps.push(item.updatedAt);
	for (const impediment of state.impediments) timestamps.push(impediment.updatedAt);
	for (const group of state.affectedGroups) timestamps.push(group.updatedAt);
	// Validação Externa (ETAPA 3 do rework) — preparar, concluir uma
	// ExternalAction e criar Evidence também representam movimento real do
	// projeto (ver HYDRA_PRODUCT_REWORK.md §33, "Movimento do projeto").
	// Extensão pequena e coerente do mecanismo existente, não um Signal
	// Engine novo.
	for (const action of state.externalActions) timestamps.push(action.updatedAt);
	for (const evidence of state.evidences) timestamps.push(evidence.createdAt);
	// "Como é tratado hoje" (Stage 4A do rework) — mesma extensão pequena e
	// coerente já aplicada à Validação Externa acima: mutações reais do
	// tratamento atual também são movimento do projeto. currentTreatment é
	// 1:1 com o projeto e updatedAt já vem preenchido desde a criação (mesmo
	// molde de ScopeVersion) — só entra aqui quando noTreatment é `true`
	// (ação explícita do usuário); com passos, o timestamp de cada
	// TreatmentStep abaixo já cobre o movimento, sem duplicar o mesmo
	// instante.
	if (state.currentTreatment.noTreatment) timestamps.push(state.currentTreatment.updatedAt);
	for (const step of state.treatmentSteps) timestamps.push(step.updatedAt);
	// "Entender as causas" (Stage 4B do rework) — mesma extensão pequena e
	// coerente já aplicada a CurrentTreatment acima: causeExploration.updatedAt
	// só entra quando stillUnknown é `true` (ação explícita do usuário); com
	// hipóteses, o timestamp de cada CauseHypothesis abaixo já cobre o
	// movimento, sem duplicar o mesmo instante.
	if (state.causeExploration.stillUnknown) timestamps.push(state.causeExploration.updatedAt);
	for (const hypothesis of state.causeHypotheses) timestamps.push(hypothesis.updatedAt);
	// "Resultado desejado" (Stage 4C do rework) — mesma extensão pequena e
	// coerente já aplicada a CauseHypothesis acima: mutações reais da coleção
	// também são movimento real do projeto.
	for (const outcome of state.desiredOutcomes) timestamps.push(outcome.updatedAt);
	for (const pending of state.pendingItems) {
		timestamps.push(pending.createdAt);
		if (pending.status === 'resolvida') timestamps.push(pending.resolvedAt);
	}
	if (state.scopeVersion.confirmedAt) timestamps.push(state.scopeVersion.confirmedAt);

	if (timestamps.length === 0) return null;
	return timestamps.reduce((latest, timestamp) => (Date.parse(timestamp) > Date.parse(latest) ? timestamp : latest));
}

// Home (Ciclo 6, C6-01) — sinal real por projeto: 'bloqueado' > 'parado' >
// 'avancando', nesta ordem de prioridade. Sete dias é uma constante simples
// desta primeira versão (sem configuração, sem campo persistido). Com
// movimentação real registrada, o sinal deriva só dela (lastMovementAt).
// Sem nenhuma movimentação real, Project.createdAt entra apenas como
// fallback para medir inatividade — nunca gera 'avancando' (um projeto só
// criado não é evidência de avanço): projeto criado há menos de 7 dias e
// nunca trabalhado fica sem nenhum sinal (undefined — "Rascunho" já
// comunica a situação); criado há 7 dias ou mais vira 'parado'.
const STALL_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function computeMovementSignal(state: ProjectState, nowIso: string): ProjectListItem['movementSignal'] {
	const hasOpenImpediment = state.impediments.some((impediment) => impediment.status === 'aberto');
	if (hasOpenImpediment) return 'bloqueado';

	const lastMovementAt = computeLastMovementAt(state);
	if (lastMovementAt) {
		const elapsedMs = Date.parse(nowIso) - Date.parse(lastMovementAt);
		return elapsedMs >= STALL_THRESHOLD_MS ? 'parado' : 'avancando';
	}

	const elapsedSinceCreation = Date.parse(nowIso) - Date.parse(state.project.createdAt);
	return elapsedSinceCreation >= STALL_THRESHOLD_MS ? 'parado' : undefined;
}

export function createProjectUseCases(deps: ProjectUseCasesDependencies): ProjectUseCases {
	const { repository, catalog, clock, idGenerator } = deps;

	async function viewOf(state: ProjectState): Promise<UseCaseOutcome<ProjectView>> {
		return { ok: true, value: buildProjectView(catalog, state) };
	}

	return {
		async createProject() {
			const state = createInitialProjectState(catalog, idGenerator.generate(), clock.now());
			await repository.insert(state);
			return viewOf(state);
		},

		// Nova iniciativa (`/projects/new`) — nome, fase inicial e origem são
		// aplicados ao estado em memória, antes de qualquer persistência: um
		// único `repository.insert()` no final, nunca createProject +
		// renameProject + setRouteStartPhase + answerActivity como gravações
		// separadas. Reaproveita as mesmas transições de domínio usadas por
		// renameProject/setRouteStartPhase/answerActivity — nenhuma regra nova.
		async createConfiguredProject(input: CreateConfiguredProjectInput) {
			let state = createInitialProjectState(catalog, idGenerator.generate(), clock.now());

			const name = input.name?.trim();
			if (name) {
				const renamed = renameProjectInDomain(catalog, state, name);
				if (!renamed.ok) return { ok: false, error: renamed.error };
				state = renamed.value;
			}

			const routed = setRouteStartPhaseInDomain(catalog, state, input.routeStartPhaseId);
			if (!routed.ok) return { ok: false, error: routed.error };
			state = routed.value;

			// Origem (Claude Design, "Novo Projeto.dc.html") — grava a própria
			// Answer da atividade "Origem do projeto" (ver catalog/discovery.ts),
			// não um campo próprio de projeto. Ao chegar na Descoberta, a
			// atividade já aparece concluída, sem repetir a pergunta.
			if (input.originAnswer) {
				const answered = answerActivityInDomain(catalog, state, 'origem', { origem: input.originAnswer }, clock.now());
				if (!answered.ok) return { ok: false, error: answered.error };
				state = answered.value;
			}

			await repository.insert(state);
			return viewOf(state);
		},

		async listRecentProjects(): Promise<UseCaseOutcome<ProjectListItem[]>> {
			const projects = await repository.listRecent();
			const nowIso = clock.now();
			const items: ProjectListItem[] = [];
			for (const project of projects) {
				// listRecent() só traz id/name/createdAt (ver ports.ts) — o status
				// exige activityProgress, então cada item busca seu próprio estado
				// completo aqui. Reaproveita computeProjectStatus (mesma função pura
				// usada por buildProjectView), sem nenhum cálculo novo.
				const state = await repository.findById(project.id);
				const activityProgress = state?.activityProgress ?? [];
				const projectStatus = state ? computeProjectStatus(state.project, catalog, activityProgress) : 'rascunho';
				// nextActivity precisa respeitar routeStartPhaseId (D023) como em
				// /now e /map — computeSnapshot já aplica computeRecommendedRoute
				// antes de computeNextActivity (ver orientation-engine/snapshot.ts).
				// Sem state (projeto órfão em listRecent sem linha em findById), cai
				// no catálogo completo: não há rota persistida para aplicar.
				const nextActivityResult = state
					? computeSnapshot(catalog, state).nextActivity
					: computeNextActivity(catalog, activityProgress);
				const nextAction: ProjectListItem['nextAction'] =
					nextActivityResult.kind === 'recommendation'
						? {
								kind: 'activity',
								activityDefinitionId: nextActivityResult.activityDefinitionId,
								label: requireActivityDefinition(catalog, nextActivityResult.activityDefinitionId).title,
								why: requireActivityDefinition(catalog, nextActivityResult.activityDefinitionId).why
							}
						: { kind: 'completed' };
				const currentPhase = currentPhaseSummary(catalog, activityProgress, nextActivityResult);
				// Sem state (projeto órfão, ver comentário acima), não há nenhum
				// evento real para avaliar — sinal e última movimentação ficam
				// ausentes, mesmo tratamento de "nunca trabalhado".
				const movementSignal = state ? computeMovementSignal(state, nowIso) : undefined;
				const lastMovementAt = state ? computeLastMovementAt(state) : null;
				items.push({
					projectId: project.id,
					projectName: project.name,
					createdAt: project.createdAt,
					projectStatus,
					nextAction,
					currentPhase,
					movementSignal,
					lastMovementAt
				});
			}
			return { ok: true, value: items };
		},

		async loadProjectView(projectId) {
			const state = await repository.findById(projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };
			return viewOf(state);
		},

		async renameProject(input: RenameProjectInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = renameProjectInDomain(catalog, state, input.name);
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) {
				await repository.save(result.value);
			}
			return viewOf(result.value);
		},

		async setRouteStartPhase(input: SetRouteStartPhaseInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setRouteStartPhaseInDomain(catalog, state, input.phaseId);
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) {
				await repository.save(result.value);
			}
			return viewOf(result.value);
		},

		async answerActivity(input: AnswerActivityInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const values = input.values ?? {};
			const result = answerActivityInDomain(
				catalog,
				state,
				input.activityDefinitionId,
				values,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async skipActivity(input: SkipActivityInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = skipActivityInDomain(
				catalog,
				state,
				input.activityDefinitionId,
				idGenerator.generate(),
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async confirmSummary(input: ConfirmSummaryInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = confirmSummaryInDomain(catalog, state);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async confirmPlanningPriority(input: ConfirmPlanningPriorityInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = confirmPlanningPriorityInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async addScopeItem(input: AddScopeItemInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addScopeItemInDomain(
				catalog,
				state,
				idGenerator.generate(),
				input.text,
				input.bucket,
				clock.now(),
				input.sourceSuggestionId ?? null
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setScopeItemText(input: SetScopeItemTextInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setScopeItemTextInDomain(catalog, state, input.itemId, input.text, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async moveScopeItem(input: MoveScopeItemInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = moveScopeItemInDomain(catalog, state, input.itemId, input.bucket, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async setScopeItemEffort(input: SetScopeItemEffortInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setScopeItemEffortInDomain(catalog, state, input.itemId, input.effort, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async setScopeItemExecutionStatus(input: SetScopeItemExecutionStatusInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setScopeItemExecutionStatusInDomain(catalog, state, input.itemId, input.status, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async reorderAgoraItems(input: ReorderAgoraItemsInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = reorderAgoraItemsInDomain(catalog, state, input.orderedItemIds, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async removeScopeItem(input: RemoveScopeItemInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = removeScopeItemInDomain(catalog, state, input.itemId);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setHypothesis(input: SetHypothesisInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setHypothesisInDomain(catalog, state, input.hypothesis);
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async confirmScopeVersion(input: ConfirmScopeVersionInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = confirmScopeVersionInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		// events (ETAPA 7 do rework, "Event log incremental") — addImpediment
		// nunca é no-op (sempre cria um Impediment novo), então sempre emite
		// impediment.registered, mesmo espírito de addWorkItem abaixo. occurredAt
		// é lido do mesmo clock.now() já injetado, uma única vez, e reaproveitado
		// tanto na transição de domínio quanto no evento — nunca duas chamadas
		// separadas que poderiam divergir por um instante.
		async addImpediment(input: AddImpedimentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const impedimentId = idGenerator.generate();
			const occurredAt = clock.now();
			const result = addImpedimentInDomain(
				catalog,
				state,
				impedimentId,
				input.text,
				input.tipo,
				occurredAt,
				input.workItemId ?? null
			);
			if (!result.ok) return { ok: false, error: result.error };

			const event: ProjectEvent = {
				id: idGenerator.generate(),
				projectId: input.projectId,
				type: 'impediment.registered',
				entityType: 'impediment',
				entityId: impedimentId,
				payload: { text: input.text, tipo: input.tipo },
				createdAt: occurredAt
			};
			await repository.save(result.value, [event]);
			return viewOf(result.value);
		},

		async setImpedimentType(input: SetImpedimentTypeInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setImpedimentTypeInDomain(catalog, state, input.impedimentId, input.tipo, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async setImpedimentNextAction(input: SetImpedimentNextActionInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setImpedimentNextActionInDomain(
				catalog,
				state,
				input.impedimentId,
				input.nextAction,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		// events — resolveImpediment/reopenImpediment já são idempotentes no
		// domínio (result.value === state quando o status já é o desejado); o
		// mesmo `result.value !== state` que decide se salva decide se emite
		// impediment.status_changed, então uma chamada repetida (ex.: duplo
		// clique) nunca gera evento duplicado.
		async resolveImpediment(input: ResolveImpedimentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const occurredAt = clock.now();
			const result = resolveImpedimentInDomain(catalog, state, input.impedimentId, occurredAt);
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) {
				const event: ProjectEvent = {
					id: idGenerator.generate(),
					projectId: input.projectId,
					type: 'impediment.status_changed',
					entityType: 'impediment',
					entityId: input.impedimentId,
					payload: { fromStatus: 'aberto', toStatus: 'resolvido' },
					createdAt: occurredAt
				};
				await repository.save(result.value, [event]);
			}
			return viewOf(result.value);
		},

		async reopenImpediment(input: ReopenImpedimentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const occurredAt = clock.now();
			const result = reopenImpedimentInDomain(catalog, state, input.impedimentId, occurredAt);
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) {
				const event: ProjectEvent = {
					id: idGenerator.generate(),
					projectId: input.projectId,
					type: 'impediment.status_changed',
					entityType: 'impediment',
					entityId: input.impedimentId,
					payload: { fromStatus: 'resolvido', toStatus: 'aberto' },
					createdAt: occurredAt
				};
				await repository.save(result.value, [event]);
			}
			return viewOf(result.value);
		},

		// events — addWorkItem nunca é no-op (sempre cria um item novo), então
		// sempre emite work_item.created (mesmo espírito de addImpediment acima).
		async addWorkItem(input: AddWorkItemInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const workItemId = idGenerator.generate();
			const occurredAt = clock.now();
			const result = addWorkItemInDomain(catalog, state, workItemId, input.title, occurredAt);
			if (!result.ok) return { ok: false, error: result.error };

			const event: ProjectEvent = {
				id: idGenerator.generate(),
				projectId: input.projectId,
				type: 'work_item.created',
				entityType: 'work_item',
				entityId: workItemId,
				payload: { title: input.title },
				createdAt: occurredAt
			};
			await repository.save(result.value, [event]);
			return viewOf(result.value);
		},

		// events — moveWorkItem é idempotente no domínio (mover para o status
		// atual é no-op, result.value === state); fromStatus vem do estado ANTES
		// da transição (o próprio item já carregado), não pode ser recomputado
		// depois — mesmo motivo de status_changed de Impediment acima.
		async moveWorkItem(input: MoveWorkItemInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const beforeStatus = state.workItems.find((item) => item.id === input.workItemId)?.status;
			const occurredAt = clock.now();
			const result = moveWorkItemInDomain(catalog, state, input.workItemId, input.status, occurredAt);
			if (!result.ok) return { ok: false, error: result.error };

			// moveWorkItemInDomain já retornou work_item_not_found acima quando o
			// item não existe — result.ok true garante beforeStatus definido.
			if (result.value !== state && beforeStatus) {
				const event: ProjectEvent = {
					id: idGenerator.generate(),
					projectId: input.projectId,
					type: 'work_item.status_changed',
					entityType: 'work_item',
					entityId: input.workItemId,
					payload: { fromStatus: beforeStatus, toStatus: input.status },
					createdAt: occurredAt
				};
				await repository.save(result.value, [event]);
			}
			return viewOf(result.value);
		},

		// Dependency (ETAPA 8 do rework) — sem evento de histórico nesta rodada:
		// a taxonomia de ProjectEvent é fechada e só cobre o loop
		// WorkItem/Impediment (D037); tipo novo exige decisão explícita de corte.
		async addDependency(input: AddDependencyInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addDependencyInDomain(
				catalog,
				state,
				idGenerator.generate(),
				input.workItemId,
				input.dependsOnWorkItemId,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async removeDependency(input: RemoveDependencyInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = removeDependencyInDomain(catalog, state, input.dependencyId);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async addAffectedGroup(input: AddAffectedGroupInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addAffectedGroupInDomain(catalog, state, idGenerator.generate(), input.label, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setAffectedGroupImpact(input: SetAffectedGroupImpactInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setAffectedGroupImpactInDomain(catalog, state, input.groupId, input.impact, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async setAffectedGroupFrequency(input: SetAffectedGroupFrequencyInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setAffectedGroupFrequencyInDomain(catalog, state, input.groupId, input.frequency, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async removeAffectedGroup(input: RemoveAffectedGroupInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = removeAffectedGroupInDomain(catalog, state, input.groupId);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async confirmAffectedGroups(input: ConfirmAffectedGroupsInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = confirmAffectedGroupsInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		// Validação Externa (ETAPA 3 do rework) — a preparação é derivada aqui,
		// a partir do AffectedGroup atual, e passada já pronta para o domínio
		// (que só valida + persiste, sem depender de catalog/, ver
		// domain/transitions.ts). Isso garante que o texto persistido seja
		// exatamente o que a interface pré-visualizou (mesma função pura dos
		// dois lados), nunca recalculado depois se o grupo mudar.
		async prepareExternalAction(input: PrepareExternalActionInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const group = state.affectedGroups.find((g) => g.id === input.affectedGroupId);
			if (!group) return { ok: false, error: { kind: 'affected_group_not_found' } };

			const preparation = buildExternalActionPreparation({
				groupLabel: group.label,
				impact: group.impact,
				frequency: group.frequency
			});

			const result = prepareExternalActionInDomain(
				catalog,
				state,
				idGenerator.generate(),
				input.affectedGroupId,
				preparation,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async completeExternalAction(input: CompleteExternalActionInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = completeExternalActionInDomain(
				catalog,
				state,
				input.actionId,
				idGenerator.generate(),
				input.outcome,
				input.learning,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		// "Como é tratado hoje" (Stage 4A do rework) — mesmo padrão dos casos de
		// uso do Mapa de Impacto: cada interação persiste imediatamente.
		async addTreatmentStep(input: AddTreatmentStepInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addTreatmentStepInDomain(catalog, state, idGenerator.generate(), input.whatHappens, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async removeTreatmentStep(input: RemoveTreatmentStepInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = removeTreatmentStepInDomain(catalog, state, input.stepId, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async moveTreatmentStep(input: MoveTreatmentStepInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = moveTreatmentStepInDomain(catalog, state, input.stepId, input.direction, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async setTreatmentStepActors(input: SetTreatmentStepActorsInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setTreatmentStepActorsInDomain(catalog, state, input.stepId, input.actors, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setTreatmentStepMedium(input: SetTreatmentStepMediumInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setTreatmentStepMediumInDomain(catalog, state, input.stepId, input.medium, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async toggleTreatmentStepFriction(input: ToggleTreatmentStepFrictionInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = toggleTreatmentStepFrictionInDomain(catalog, state, input.stepId, input.friction, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setTreatmentNoTreatment(input: SetTreatmentNoTreatmentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setTreatmentNoTreatmentInDomain(catalog, state, input.noTreatment, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		// "Entender as causas" (Stage 4B do rework) — mesmo padrão dos casos de
		// uso do Mapa de Impacto/Como é tratado hoje: cada interação persiste
		// imediatamente.
		async addCauseHypothesis(input: AddCauseHypothesisInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addCauseHypothesisInDomain(
				catalog,
				state,
				idGenerator.generate(),
				input.title,
				input.origin ?? null,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setCauseHypothesisTitle(input: SetCauseHypothesisTitleInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setCauseHypothesisTitleInDomain(catalog, state, input.hypothesisId, input.title, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setCauseHypothesisExpectedIfTrue(input: SetCauseHypothesisExpectedIfTrueInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setCauseHypothesisExpectedIfTrueInDomain(
				catalog,
				state,
				input.hypothesisId,
				input.value,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setCauseHypothesisWhatWeakensIt(input: SetCauseHypothesisWhatWeakensItInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setCauseHypothesisWhatWeakensItInDomain(
				catalog,
				state,
				input.hypothesisId,
				input.value,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async toggleCauseHypothesisEvidence(input: ToggleCauseHypothesisEvidenceInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = toggleCauseHypothesisEvidenceInDomain(
				catalog,
				state,
				input.hypothesisId,
				input.evidenceId,
				clock.now()
			);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async removeCauseHypothesis(input: RemoveCauseHypothesisInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = removeCauseHypothesisInDomain(catalog, state, input.hypothesisId);
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async markCauseExplorationUnknown(input: MarkCauseExplorationUnknownInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = markCauseExplorationUnknownInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async undoCauseExplorationUnknown(input: UndoCauseExplorationUnknownInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = undoCauseExplorationUnknownInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async confirmCauseHypotheses(input: ConfirmCauseHypothesesInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = confirmCauseHypothesesInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async confirmTreatment(input: ConfirmTreatmentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = confirmTreatmentInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		// "Resultado desejado" (Stage 4C do rework) — mesmo padrão dos casos de
		// uso do Mapa de Impacto/Como é tratado hoje/Entender as causas: cada
		// interação persiste imediatamente.
		async addDesiredOutcome(input: AddDesiredOutcomeInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addDesiredOutcomeInDomain(catalog, state, idGenerator.generate(), input.change, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setDesiredOutcomeChange(input: SetDesiredOutcomeChangeInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setDesiredOutcomeChangeInDomain(catalog, state, input.outcomeId, input.change, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async setDesiredOutcomeTarget(input: SetDesiredOutcomeTargetInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = setDesiredOutcomeTargetInDomain(catalog, state, input.outcomeId, input.target, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async removeDesiredOutcome(input: RemoveDesiredOutcomeInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = removeDesiredOutcomeInDomain(catalog, state, input.outcomeId, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		async moveDesiredOutcome(input: MoveDesiredOutcomeInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = moveDesiredOutcomeInDomain(catalog, state, input.outcomeId, input.direction, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async confirmDesiredOutcomes(input: ConfirmDesiredOutcomesInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = confirmDesiredOutcomesInDomain(catalog, state, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
			return viewOf(result.value);
		},

		// events (ETAPA 7 do rework) — export precisa carregar o histórico
		// registrado (mesma promessa que já vale para todo o resto do estado);
		// buscado à parte de findById() porque não é um objeto vivo de
		// ProjectState (ver domain/serialization.ts).
		async exportProject(projectId: string) {
			const state = await repository.findById(projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };
			const events = await repository.listEvents(projectId);
			return { ok: true, value: serializeProjectState(state, events) };
		},

		// events — parseado à parte de deserializeProjectState (ver
		// domain/serialization.ts, deserializeProjectEvents): um export anterior
		// à S7 não tem a chave "events" e produz [] normalmente, nunca erro de
		// import. insert(state, events) grava os dois atomicamente, mesmo
		// contrato de save() usado pelo loop S6.
		async importProject(json: string) {
			const parsed = deserializeProjectState(json, catalog);
			if (!parsed.ok) {
				return { ok: false, error: { kind: 'invalid_import', reason: parsed.error } };
			}
			const eventsParsed = deserializeProjectEvents(json);
			if (!eventsParsed.ok) {
				return { ok: false, error: { kind: 'invalid_import', reason: eventsParsed.error } };
			}

			const state = parsed.value;
			const existing = await repository.findById(state.project.id);
			if (existing) {
				return { ok: false, error: { kind: 'import_id_collision', projectId: state.project.id } };
			}

			await repository.insert(state, eventsParsed.value);
			return viewOf(state);
		},

		// Event log incremental (ETAPA 7 do rework) — leitura auxiliar, nunca
		// parte de ProjectView (ver types.ts).
		async listProjectEvents(projectId: string, filter?: ProjectEventFilter) {
			const state = await repository.findById(projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };
			const events = await repository.listEvents(projectId, filter);
			return { ok: true, value: events };
		}
	};
}
