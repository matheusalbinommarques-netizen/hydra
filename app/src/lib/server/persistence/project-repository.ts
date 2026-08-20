// Porta do repositório — ver docs/06-architecture/contracts.md §9.

import type { Project, ProjectEvent, ProjectState } from '$lib/domain';

// Filtro de leitura do event log (ETAPA 7 do rework) — entityIds (quando
// presente e não vazio) restringe a projetos eventos cujo entityId esteja
// na lista; usado tanto para "histórico de um item" (um id) quanto para
// "mudanças relacionadas" (WorkItem + Impediment vinculado, dois ids).
// Ausente ou vazio = todos os eventos do projeto.
export interface ProjectEventFilter {
	entityIds?: string[];
}

export interface ProjectRepository {
	// events (ETAPA 7 do rework, "Event log incremental") — opcional e vazio
	// por padrão: toda operação que ainda não gera evento continua chamando
	// insert(state) exatamente como antes. Quando presente, estado e eventos
	// persistem na MESMA transação (ver createSqliteProjectRepository,
	// insertTransaction) — nunca duas escritas independentes.
	insert(state: ProjectState, events?: ProjectEvent[]): Promise<void>;
	findById(projectId: string): Promise<ProjectState | null>;
	// events (ETAPA 7 do rework) — mesmo contrato de insert acima: opcional,
	// vazio por padrão, persistido atomicamente com o estado quando presente
	// (ver saveTransaction). save grava atomicamente o estado resultante de
	// uma operação (o id já está em state.project.id). A estratégia interna
	// (reescrita completa, diffs, transação) não é parte deste contrato.
	save(state: ProjectState, events?: ProjectEvent[]): Promise<void>;
	listRecent(): Promise<Project[]>;
	// só os dados de Project (id/name/createdAt) — nunca ActivityProgress,
	// Answer ou PendingItem; ordenação é responsabilidade do adapter
	// concreto (mais recente primeiro, com desempate determinístico).
	// Event log (ETAPA 7 do rework) — histórico auxiliar append-only, nunca
	// usado para reconstruir ProjectState; ordenação mais recente primeiro,
	// com desempate determinístico (mesmo espírito de listRecent).
	listEvents(projectId: string, filter?: ProjectEventFilter): Promise<ProjectEvent[]>;
}
