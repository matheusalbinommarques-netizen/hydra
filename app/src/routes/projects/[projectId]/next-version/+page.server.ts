import { fail } from '@sveltejs/kit';
import type { ScopeBucket, ScopeEffort, ScopeValue } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions } from './$types';

const SCOPE_BUCKETS: readonly ScopeBucket[] = ['agora', 'depois', 'fora'];
const SCOPE_VALUES: readonly ScopeValue[] = ['baixo', 'medio', 'alto'];
const SCOPE_EFFORTS: readonly ScopeEffort[] = ['pequeno', 'medio', 'grande'];

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function readBucket(formData: FormData, key: string): ScopeBucket | null {
	const value = readString(formData, key);
	return value && (SCOPE_BUCKETS as readonly string[]).includes(value) ? (value as ScopeBucket) : null;
}

function readValue(formData: FormData, key: string): ScopeValue | null {
	const value = readString(formData, key);
	return value && (SCOPE_VALUES as readonly string[]).includes(value) ? (value as ScopeValue) : null;
}

function readEffort(formData: FormData, key: string): ScopeEffort | null {
	const value = readString(formData, key);
	return value && (SCOPE_EFFORTS as readonly string[]).includes(value) ? (value as ScopeEffort) : null;
}

/** item.order desloca 1 posição na direção pedida, dentro de "agora" — usado por moveUp/moveDown. */
async function shiftAgoraOrder(projectId: string, itemId: string, direction: -1 | 1) {
	const useCases = getProjectUseCases();
	const current = await useCases.loadProjectView(projectId);
	if (!current.ok) return { ok: false as const, error: current.error };

	const agoraIds = current.value.scopeItems
		.filter((item) => item.bucket === 'agora')
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map((item) => item.id);

	const index = agoraIds.indexOf(itemId);
	const targetIndex = index + direction;
	if (index < 0 || targetIndex < 0 || targetIndex >= agoraIds.length) {
		// fora dos limites (já é o primeiro/último) — no-op silencioso, nunca erro visível.
		return { ok: true as const };
	}

	const reordered = [...agoraIds];
	[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

	return useCases.reorderAgoraItems({ projectId, orderedItemIds: reordered });
}

export const actions: Actions = {
	addItem: async ({ request, params }) => {
		const formData = await request.formData();
		const text = readString(formData, 'text');
		const bucket = readBucket(formData, 'bucket');
		if (!text || !bucket) {
			return fail(400, { message: 'Informe o texto e escolha Agora, Depois ou Fora.' });
		}

		const result = await getProjectUseCases().addScopeItem({ projectId: params.projectId, text, bucket });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setText: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		const text = readString(formData, 'text');
		if (!itemId || !text) return fail(400, { message: 'Texto do item não pode ficar vazio.' });

		const result = await getProjectUseCases().setScopeItemText({ projectId: params.projectId, itemId, text });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	move: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		const bucket = readBucket(formData, 'bucket');
		if (!itemId || !bucket) return fail(400, { message: 'Item ou bucket inválido.' });

		const result = await getProjectUseCases().moveScopeItem({ projectId: params.projectId, itemId, bucket });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setValue: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		const value = readValue(formData, 'value');
		if (!itemId || !value) return fail(400, { message: 'Item ou valor inválido.' });

		const result = await getProjectUseCases().setScopeItemValue({ projectId: params.projectId, itemId, value });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setEffort: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		const effort = readEffort(formData, 'effort');
		if (!itemId || !effort) return fail(400, { message: 'Item ou esforço inválido.' });

		const result = await getProjectUseCases().setScopeItemEffort({ projectId: params.projectId, itemId, effort });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	moveUp: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		if (!itemId) return fail(400, { message: 'Item inválido.' });

		const result = await shiftAgoraOrder(params.projectId, itemId, -1);
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	moveDown: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		if (!itemId) return fail(400, { message: 'Item inválido.' });

		const result = await shiftAgoraOrder(params.projectId, itemId, 1);
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	remove: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		if (!itemId) return fail(400, { message: 'Item inválido.' });

		const result = await getProjectUseCases().removeScopeItem({ projectId: params.projectId, itemId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setHypothesis: async ({ request, params }) => {
		const formData = await request.formData();
		const hypothesis = readString(formData, 'hypothesis') ?? '';

		const result = await getProjectUseCases().setHypothesis({ projectId: params.projectId, hypothesis });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	confirm: async ({ params }) => {
		const result = await getProjectUseCases().confirmScopeVersion({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
