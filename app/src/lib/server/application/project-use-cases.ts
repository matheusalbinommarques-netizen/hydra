// Casos de uso — ver docs/06-architecture/contracts.md §10. Coordena
// ProjectRepository, domain/, catalog/ (via dependência) e orientation-engine/.
// Nenhum SQL, nenhuma rota, nenhum HTML — só orquestração.

import type { Catalog, ProjectState } from '$lib/domain';
import {
	addScopeItem as addScopeItemInDomain,
	answerActivity as answerActivityInDomain,
	confirmScopeVersion as confirmScopeVersionInDomain,
	confirmSummary as confirmSummaryInDomain,
	createInitialProjectState,
	deserializeProjectState,
	moveScopeItem as moveScopeItemInDomain,
	removeScopeItem as removeScopeItemInDomain,
	renameProject as renameProjectInDomain,
	reorderAgoraItems as reorderAgoraItemsInDomain,
	serializeProjectState,
	setHypothesis as setHypothesisInDomain,
	setScopeItemEffort as setScopeItemEffortInDomain,
	setScopeItemText as setScopeItemTextInDomain,
	skipActivity as skipActivityInDomain
} from '$lib/domain';
import type { ProjectRepository } from '../persistence';
import type { Clock, IdGenerator } from './ports';
import { buildProjectView } from './project-view';
import type {
	AddScopeItemInput,
	AnswerActivityInput,
	ConfirmScopeVersionInput,
	ConfirmSummaryInput,
	MoveScopeItemInput,
	ProjectListItem,
	ProjectUseCases,
	RemoveScopeItemInput,
	RenameProjectInput,
	ReorderAgoraItemsInput,
	SetHypothesisInput,
	SetScopeItemEffortInput,
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

		async listRecentProjects(): Promise<UseCaseOutcome<ProjectListItem[]>> {
			const projects = await repository.listRecent();
			return {
				ok: true,
				value: projects.map((project) => ({
					projectId: project.id,
					projectName: project.name,
					createdAt: project.createdAt
				}))
			};
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

		async addScopeItem(input: AddScopeItemInput) {
			const state = await repository.findById(input.projectId);
			if (!state) return { ok: false, error: { kind: 'project_not_found' } };

			const result = addScopeItemInDomain(
				catalog,
				state,
				idGenerator.generate(),
				input.text,
				input.bucket,
				clock.now()
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
