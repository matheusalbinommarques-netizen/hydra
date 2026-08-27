import { fail } from '@sveltejs/kit';
import type { DeliverableBucket, DeliverableEffort } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions } from './$types';

const BUCKETS: readonly DeliverableBucket[] = ['agora', 'depois', 'fora'];
const EFFORTS: readonly DeliverableEffort[] = ['pequeno', 'medio', 'grande'];

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function readBucket(formData: FormData, key: string): DeliverableBucket | null {
	const value = readString(formData, key);
	return value && (BUCKETS as readonly string[]).includes(value) ? (value as DeliverableBucket) : null;
}

/** Diferente das demais leituras: ausência/'' significa "ainda não estimado" (null), valor legítimo. */
function readEffort(formData: FormData, key: string): DeliverableEffort | null {
	const value = readString(formData, key);
	return value && (EFFORTS as readonly string[]).includes(value) ? (value as DeliverableEffort) : null;
}

/** Desloca a entrega 1 posição dentro de "agora" — usado por moveUp/moveDown (mesmo padrão de /next-version). */
async function shiftAgoraOrder(projectId: string, deliverableId: string, direction: -1 | 1) {
	const useCases = getProjectUseCases();
	const current = await useCases.loadProjectView(projectId);
	if (!current.ok) return { ok: false as const, error: current.error };

	const agoraIds = current.value.deliverables
		.filter((deliverable) => deliverable.bucket === 'agora')
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map((deliverable) => deliverable.id);

	const index = agoraIds.indexOf(deliverableId);
	const targetIndex = index + direction;
	if (index < 0 || targetIndex < 0 || targetIndex >= agoraIds.length) {
		// já é a primeira/última — no-op silencioso, nunca erro visível.
		return { ok: true as const };
	}

	const reordered = [...agoraIds];
	[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

	return useCases.reorderDeliverables({ projectId, orderedIds: reordered });
}

export const actions: Actions = {
	add: async ({ request, params }) => {
		const formData = await request.formData();
		const title = readString(formData, 'title');
		const bucket = readBucket(formData, 'bucket');
		if (!title || !bucket) {
			return fail(400, { message: 'Escreva a entrega e escolha o recorte.' });
		}

		const result = await getProjectUseCases().addDeliverable({ projectId: params.projectId, title, bucket });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setTitle: async ({ request, params }) => {
		const formData = await request.formData();
		const deliverableId = readString(formData, 'deliverableId');
		const title = readString(formData, 'title');
		if (!deliverableId || !title) return fail(400, { message: 'O título da entrega não pode ficar vazio.' });

		const result = await getProjectUseCases().setDeliverableTitle({
			projectId: params.projectId,
			deliverableId,
			title
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setEffort: async ({ request, params }) => {
		const formData = await request.formData();
		const deliverableId = readString(formData, 'deliverableId');
		if (!deliverableId) return fail(400, { message: 'Entrega inválida.' });

		const result = await getProjectUseCases().setDeliverableEffort({
			projectId: params.projectId,
			deliverableId,
			effort: readEffort(formData, 'effort')
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	move: async ({ request, params }) => {
		const formData = await request.formData();
		const deliverableId = readString(formData, 'deliverableId');
		const bucket = readBucket(formData, 'bucket');
		if (!deliverableId || !bucket) return fail(400, { message: 'Entrega ou recorte inválido.' });

		const result = await getProjectUseCases().moveDeliverable({
			projectId: params.projectId,
			deliverableId,
			bucket
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	moveUp: async ({ request, params }) => {
		const formData = await request.formData();
		const deliverableId = readString(formData, 'deliverableId');
		if (!deliverableId) return fail(400, { message: 'Entrega inválida.' });

		const result = await shiftAgoraOrder(params.projectId, deliverableId, -1);
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	moveDown: async ({ request, params }) => {
		const formData = await request.formData();
		const deliverableId = readString(formData, 'deliverableId');
		if (!deliverableId) return fail(400, { message: 'Entrega inválida.' });

		const result = await shiftAgoraOrder(params.projectId, deliverableId, 1);
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	remove: async ({ request, params }) => {
		const formData = await request.formData();
		const deliverableId = readString(formData, 'deliverableId');
		if (!deliverableId) return fail(400, { message: 'Entrega inválida.' });

		const result = await getProjectUseCases().removeDeliverable({
			projectId: params.projectId,
			deliverableId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
