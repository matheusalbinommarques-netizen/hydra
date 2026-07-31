import { fail } from '@sveltejs/kit';
import type { ScopeExecutionStatus } from '$lib/domain';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions } from './$types';

const SCOPE_EXECUTION_STATUSES: readonly ScopeExecutionStatus[] = ['a_fazer', 'em_andamento', 'concluido'];

function readString(formData: FormData, key: string): string | null {
	const value = formData.get(key);
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function readExecutionStatus(formData: FormData, key: string): ScopeExecutionStatus | null {
	const value = readString(formData, key);
	return value && (SCOPE_EXECUTION_STATUSES as readonly string[]).includes(value)
		? (value as ScopeExecutionStatus)
		: null;
}

export const actions: Actions = {
	setExecutionStatus: async ({ request, params }) => {
		const formData = await request.formData();
		const itemId = readString(formData, 'itemId');
		const status = readExecutionStatus(formData, 'status');
		if (!itemId || !status) return fail(400, { message: 'Item ou status inválido.' });

		const result = await getProjectUseCases().setScopeItemExecutionStatus({
			projectId: params.projectId,
			itemId,
			status
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
