import { fail } from '@sveltejs/kit';
import type { ImpedimentType } from '$lib/domain';
import { buildAttentionsView } from '$lib/attention-view';
import { buildDecisions } from '$lib/decision-view';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import type { Actions, PageServerLoad } from './$types';

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

function readTipo(formData: FormData, key: string): ImpedimentType | null {
	const value = readString(formData, key);
	return value && (IMPEDIMENT_TYPES as readonly string[]).includes(value) ? (value as ImpedimentType) : null;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();

	const attentions = buildAttentionsView({
		workItems: view.workItems,
		impediments: view.impediments,
		openPendingItems: view.openPendingItems
	});

	// Decisões disponíveis para relacionar a um Impediment `decisao_pendente`
	// (mesmo dado de apoio que já vivia em tracking/+page.server.ts, ETAPA 11
	// do rework, §41/§13.4) — a gestão do lifecycle de Decision continua em
	// `/decisions` (D065/D066); aqui é só lookup.
	const decisions = buildDecisions(view.decisions);

	return { attentions, decisions };
};

// Mesmo lifecycle real de Impediment já operado em Acompanhamento
// (`/tracking`, D065/D066) — nenhum estado, entidade ou regra nova; a gestão
// completa (criar, tipar, próxima ação, decisão relacionada, resolver,
// reabrir) migra inteiramente para cá (ETAPA 13, S13, terceiro microcorte):
// `/tracking` não mantém uma segunda superfície de gestão para o que já
// tem lar aqui.
export const actions: Actions = {
	addImpediment: async ({ request, params }) => {
		const formData = await request.formData();
		const text = readString(formData, 'text');
		const tipo = readTipo(formData, 'tipo');
		if (!text || !tipo) {
			return fail(400, { message: 'Descreva o impedimento e selecione um tipo.' });
		}

		const result = await getProjectUseCases().addImpediment({ projectId: params.projectId, text, tipo });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setType: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		const tipo = readTipo(formData, 'tipo');
		if (!impedimentId || !tipo) return fail(400, { message: 'Impedimento ou tipo inválido.' });

		const result = await getProjectUseCases().setImpedimentType({
			projectId: params.projectId,
			impedimentId,
			tipo
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setDecision: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		if (!impedimentId) return fail(400, { message: 'Impedimento inválido.' });
		const decisionId = readString(formData, 'decisionId');

		const result = await getProjectUseCases().setImpedimentDecision({
			projectId: params.projectId,
			impedimentId,
			decisionId
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	setNextAction: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		if (!impedimentId) return fail(400, { message: 'Impedimento inválido.' });
		const nextAction = readString(formData, 'nextAction');

		const result = await getProjectUseCases().setImpedimentNextAction({
			projectId: params.projectId,
			impedimentId,
			nextAction
		});
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	resolve: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		if (!impedimentId) return fail(400, { message: 'Impedimento inválido.' });

		const result = await getProjectUseCases().resolveImpediment({ projectId: params.projectId, impedimentId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	},

	reopen: async ({ request, params }) => {
		const formData = await request.formData();
		const impedimentId = readString(formData, 'impedimentId');
		if (!impedimentId) return fail(400, { message: 'Impedimento inválido.' });

		const result = await getProjectUseCases().reopenImpediment({ projectId: params.projectId, impedimentId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true };
	}
};
