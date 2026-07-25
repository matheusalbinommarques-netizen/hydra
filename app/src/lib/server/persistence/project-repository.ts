// Porta do repositório — ver docs/06-architecture/contracts.md §9.

import type { Project, ProjectState } from '$lib/domain';

export interface ProjectRepository {
	insert(state: ProjectState): Promise<void>;
	findById(projectId: string): Promise<ProjectState | null>;
	save(state: ProjectState): Promise<void>;
	// save grava atomicamente o estado resultante de uma operação (o id já
	// está em state.project.id). A estratégia interna (reescrita completa,
	// diffs, transação) não é parte deste contrato.
	listRecent(): Promise<Project[]>;
	// só os dados de Project (id/name/createdAt) — nunca ActivityProgress,
	// Answer ou PendingItem; ordenação é responsabilidade do adapter
	// concreto (mais recente primeiro, com desempate determinístico).
}
