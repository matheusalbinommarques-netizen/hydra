import { redirect } from '@sveltejs/kit';
import { isCronogramaReady } from '$lib/schedule-readiness';
import { buildCronogramaView } from './cronograma-view';
import type { PageServerLoad } from './$types';

// Readiness (ETAPA 12 do rework, §42, sexto microcorte) — a rota só existe
// no runtime com ≥1 WorkItem de schedule completo (mesmo critério do shell
// e de Acompanhamento, ver $lib/schedule-readiness). Navegar direto para
// esta URL antes da readiness nunca renderiza uma surface vazia — volta
// para Acompanhamento, o corredor aprovado.
export const load: PageServerLoad = async ({ parent, params }) => {
	const { view } = await parent();
	if (!isCronogramaReady(view.workItems)) {
		redirect(303, `/projects/${params.projectId}/tracking`);
	}

	return {
		projectId: view.projectId,
		cronograma: buildCronogramaView({
			workItems: view.workItems,
			deliverables: view.deliverables,
			milestones: view.milestones
		})
	};
};
