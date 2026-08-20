// Fronteira pública de server/persistence/ — ver docs/06-architecture/contracts.md §9.

export type { ProjectEventFilter, ProjectRepository } from './project-repository';
export { createSqliteProjectRepository, type SqliteProjectRepository } from './sqlite-project-repository';
