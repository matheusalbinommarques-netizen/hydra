import { error, fail, redirect } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions, PageServerLoad } from './$types';

// Home (Ciclo 6, C6-01, convergência visual) — lista mínima de fases
// (id/label, ordem real do catálogo) para o indicador de progresso do
// projeto em destaque. catalog/ nunca é importado em código de rota
// client-side (.svelte); esta lista, já computada aqui, é o único dado
// necessário do catálogo estático para aquele indicador.
const catalogPhases = catalog.phases.map((phase) => ({ id: phase.id, label: phase.label }));

export const load: PageServerLoad = async () => {
	const result = await getProjectUseCases().listRecentProjects();
	if (!result.ok) {
		error(500, mapUseCaseError(result.error));
	}
	return { projects: result.value, catalogPhases };
};

export const actions: Actions = {
	import: async ({ request }) => {
		const formData = await request.formData();
		const file = formData.get('file');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'Selecione um arquivo JSON para importar.' });
		}

		const json = await file.text();
		const result = await getProjectUseCases().importProject(json);
		if (!result.ok) {
			return fail(400, { message: mapUseCaseError(result.error) });
		}
		redirect(303, `/projects/${result.value.projectId}/now`);
	}
};
