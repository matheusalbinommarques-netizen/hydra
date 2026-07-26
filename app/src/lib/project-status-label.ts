// Rótulo de exibição para ProjectStatus — compartilhado entre a lista de
// projetos (routes/+page.svelte) e o cabeçalho do workspace
// (routes/projects/[projectId]/+layout.svelte), para não duplicar a mesma
// string em dois lugares.

import type { ProjectStatus } from '$lib/orientation-engine';

export const projectStatusLabel: Record<ProjectStatus, string> = {
	rascunho: 'Rascunho',
	em_andamento: 'Em andamento',
	concluído: 'Concluído'
};
