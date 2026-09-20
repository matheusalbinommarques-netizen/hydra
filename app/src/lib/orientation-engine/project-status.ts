// Status de projeto — ver docs/06-architecture/contracts.md §8 e docs/core/STATE_MACHINE.md §4.

import type { Project } from '$lib/domain';

export type ProjectStatus = 'rascunho' | 'em_andamento' | 'concluído';

// `closedAt` é a única autoridade de "concluído" (ETAPA 16, D083): catálogo
// completo sem encerramento formal continua em_andamento. Encerrado ≠ sucesso.
export function computeProjectStatus(project: Project): ProjectStatus {
	if (!project.name || project.name.trim().length === 0) return 'rascunho';
	return (project.closedAt ?? null) !== null ? 'concluído' : 'em_andamento';
}
