import { fail } from '@sveltejs/kit';
import type { ImpedimentType, WorkItemStatus } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { buildWorkView } from './work-view';
import type { Actions, PageServerLoad } from './$types';

const WORK_ITEM_STATUSES: readonly WorkItemStatus[] = ['a_fazer', 'em_andamento', 'concluido'];
const IMPEDIMENT_TYPES: readonly ImpedimentType[] = [
	'dependencia_externa',
	'decisao_pendente',
	'falta_de_recurso',
	'bloqueio_tecnico',
	'outro'
];

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function readWorkItemStatus(formData: FormData, key: string): WorkItemStatus | null {
	const value = readString(formData, key);
	return value && (WORK_ITEM_STATUSES as readonly string[]).includes(value) ? (value as WorkItemStatus) : null;
}

function readTipo(formData: FormData, key: string): ImpedimentType | null {
	const value = readString(formData, key);
	return value && (IMPEDIMENT_TYPES as readonly string[]).includes(value) ? (value as ImpedimentType) : null;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return { board: buildWorkView(view.workItems) };
};

export const actions: Actions = {
	create: async ({ request, params }) => {
		const formData = await request.formData();
		const title = readString(formData, 'title');
		if (!title) return fail(400, { message: 'Descreva o item de trabalho.' });

		const result = await getProjectUseCases().addWorkItem({ projectId: params.projectId, title });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	move: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		const status = readWorkItemStatus(formData, 'status');
		if (!workItemId || !status) return fail(400, { message: 'Item ou status inválido.' });

		const result = await getProjectUseCases().moveWorkItem({ projectId: params.projectId, workItemId, status });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	registerImpediment: async ({ request, params }) => {
		const formData = await request.formData();
		const workItemId = readString(formData, 'workItemId');
		const text = readString(formData, 'text');
		const tipo = readTipo(formData, 'tipo');
		if (!workItemId || !text || !tipo) {
			return fail(400, { message: 'Descreva o impedimento e selecione um tipo.' });
		}

		const result = await getProjectUseCases().addImpediment({ projectId: params.projectId, text, tipo, workItemId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
