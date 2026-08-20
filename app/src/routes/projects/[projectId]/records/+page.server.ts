import { error } from '@sveltejs/kit';
import { catalog } from '$lib/catalog';
import { getProjectUseCases } from '$lib/server/composition';
import { buildRecordsView } from './records-view';
import type { PageServerLoad } from './$types';

// entityId (ETAPA 7 do rework, "Event log incremental") — filtro de
// entidade via query string, repetível (?entityId=a&entityId=b): Trabalho
// ("Ver histórico") passa um único id; Acompanhamento ("Ver mudanças
// relacionadas") passa dois (o WorkItem e o Impediment vinculado a ele),
// para mostrar as duas trilhas de evento juntas sem inventar um novo
// conceito de "relacionado" no schema. Ausente = todos os eventos do
// projeto (comportamento default de /records).
export const load: PageServerLoad = async ({ parent, params, url }) => {
	const { view } = await parent();
	const entityIds = url.searchParams.getAll('entityId').filter((id) => id.length > 0);
	const eventsResult = await getProjectUseCases().listProjectEvents(
		params.projectId,
		entityIds.length > 0 ? { entityIds } : undefined
	);
	if (!eventsResult.ok) {
		error(404, 'Projeto não encontrado.');
	}

	return buildRecordsView(catalog, {
		projectId: view.projectId,
		answers: view.answers,
		pendingItemHistory: view.pendingItemHistory,
		activityStatuses: view.activityStatuses,
		events: eventsResult.value,
		workItems: view.workItems.map((item) => ({ id: item.id, title: item.title })),
		impediments: view.impediments.map((item) => ({ id: item.id, text: item.text })),
		filterEntityIds: entityIds
	});
};
