// Casos de uso — ver docs/06-architecture/contracts.md §10. Coordena
// ProjectRepository, domain/, catalog/ (via dependência) e orientation-engine/.
// Nenhum SQL, nenhuma rota, nenhum HTML — só orquestração.

import type { ActivityDefinition, ActivityProgress, Catalog, ProjectState } from '$lib/domain';
import { computeNextActivity, computeProjectStatus, computeSnapshot } from '$lib/orientation-engine';
import type { NextActivityResult } from '$lib/orientation-engine';
import {
	addImpediment as addImpedimentInDomain,
	addScopeItem as addScopeItemInDomain,
	answerActivity as answerActivityInDomain,
	confirmPlanningPriority as confirmPlanningPriorityInDomain,
	confirmScopeVersion as confirmScopeVersionInDomain,
	confirmSummary as confirmSummaryInDomain,
	createInitialProjectState,
	deserializeProjectState,
	moveScopeItem as moveScopeItemInDomain,
	removeScopeItem as removeScopeItemInDomain,
	renameProject as renameProjectInDomain,
	reopenImpediment as reopenImpedimentInDomain,
	reorderAgoraItems as reorderAgoraItemsInDomain,
	resolveImpediment as resolveImpedimentInDomain,
	serializeProjectState,
	setHypothesis as setHypothesisInDomain,
	setImpedimentNextAction as setImpedimentNextActionInDomain,
	setImpedimentType as setImpedimentTypeInDomain,
	setRouteStartPhase as setRouteStartPhaseInDomain,
	setScopeItemEffort as setScopeItemEffortInDomain,
	setScopeItemExecutionStatus as setScopeItemExecutionStatusInDomain,
	setScopeItemText as setScopeItemTextInDomain,
	skipActivity as skipActivityInDomain
} from '$lib/domain';
import type { ProjectRepository } from '../persistence';
import type { Clock, IdGenerator } from './ports';
import { buildProjectView } from './project-view';
import type {
	AddImpedimentInput,
	AddScopeItemInput,
	AnswerActivityInput,
	ConfirmPlanningPriorityInput,
	ConfirmScopeVersionInput,
	ConfirmSummaryInput,
	CreateConfiguredProjectInput,
	MoveScopeItemInput,
	ProjectListItem,
	ProjectUseCases,
	RemoveScopeItemInput,
	RenameProjectInput,
	ReopenImpedimentInput,
	ReorderAgoraItemsInput,
	ResolveImpedimentInput,
	SetHypothesisInput,
	SetImpedimentNextActionInput,
	SetImpedimentTypeInput,
	SetRouteStartPhaseInput,
	SetScopeItemEffortInput,
	SetScopeItemExecutionStatusInput,
	SetScopeItemTextInput,
	SkipActivityInput,
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

		// Nova iniciativa (`/projects/new`) — nome e fase inicial são aplicados
		// ao estado em memória, antes de qualquer persistência: um único
		// `repository.insert()` no final, nunca createProject + renameProject +
		// setRouteStartPhase como gravações separadas. Reaproveita as mesmas
		// transições de domínio usadas por renameProject/setRouteStartPhase.
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

		async addImpediment(input: AddImpedimentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addImpedimentInDomain(catalog, state, idGenerator.generate(), input.text, input.tipo, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			await repository.save(result.value);
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

		async resolveImpediment(input: ResolveImpedimentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = resolveImpedimentInDomain(catalog, state, input.impedimentId, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async reopenImpediment(input: ReopenImpedimentInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = reopenImpedimentInDomain(catalog, state, input.impedimentId, clock.now());
			if (!result.ok) return { ok: false, error: result.error };

			if (result.value !== state) await repository.save(result.value);
			return viewOf(result.value);
		},

		async exportProject(projectId: string) {
			const state = await repository.findById(projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };
			return { ok: true, value: serializeProjectState(state) };
		},

		async importProject(json: string) {
			const parsed = deserializeProjectState(json, catalog);
			if (!parsed.ok) {
				return { ok: false, error: { kind: 'invalid_import', reason: parsed.error } };
			}

			const state = parsed.value;
			const existing = await repository.findById(state.project.id);
			if (existing) {
				return { ok: false, error: { kind: 'import_id_collision', projectId: state.project.id } };
			}

			await repository.insert(state);
			return viewOf(state);
		}
	};
}
