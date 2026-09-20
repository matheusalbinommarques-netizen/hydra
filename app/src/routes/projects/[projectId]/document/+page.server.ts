import { fail, redirect } from '@sveltejs/kit';
import type { DocumentSnapshotContentV1 } from '$lib/domain';
import { catalog } from '$lib/catalog';
import { projectDocumentContent } from '$lib/projections/document-content';
import { getProjectUseCases } from '$lib/server/composition';
import { mapUseCaseError } from '$lib/server/error-messages';
import { withEditAffordance } from './document-live-view';
import type { Actions, PageServerLoad } from './$types';

// Igualdade estrutural do conteúdo congelado × conteúdo vivo — ambos vêm do
// mesmo projetor canônico e da mesma forma canônica, então a serialização é
// estável. Só alimenta o aviso textual "Atual já avançou" (sem diff).
function sameContent(a: DocumentSnapshotContentV1, b: DocumentSnapshotContentV1): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export const load: PageServerLoad = async ({ parent, params, url }) => {
	const { view } = await parent();
	const useCases = getProjectUseCases();

	const listed = await useCases.listDocumentSnapshots(params.projectId);
	if (!listed.ok) throw redirect(303, '/projects');
	const snapshots = listed.value;

	const liveContent = projectDocumentContent(catalog, view);

	const requested = url.searchParams.get('v');
	if (requested !== null) {
		const version = Number(requested);
		const opened = Number.isInteger(version) && version >= 1
			? await useCases.getDocumentSnapshot(params.projectId, version)
			: null;
		// Versão inválida ou inexistente volta ao Atual, nunca a uma página quebrada.
		if (!opened || !opened.ok) throw redirect(303, `/projects/${params.projectId}/document`);

		return {
			mode: 'snapshot' as const,
			snapshots,
			sections: opened.value.content.sections.map((section) => ({
				...section,
				blocks: section.blocks.map((block) => ({ ...block, editable: false }))
			})),
			snapshot: { version: opened.value.version, capturedAt: opened.value.capturedAt },
			currentAdvanced: !sameContent(opened.value.content, liveContent)
		};
	}

	return {
		mode: 'current' as const,
		snapshots,
		sections: withEditAffordance(liveContent).sections,
		snapshot: null,
		currentAdvanced: false
	};
};

export const actions: Actions = {
	// A rota só solicita a captura: o conteúdo nunca vem do formulário — o
	// caso de uso relê o estado no servidor e deriva o conteúdo canônico.
	captureSnapshot: async ({ params }) => {
		const result = await getProjectUseCases().captureDocumentSnapshot({ projectId: params.projectId });
		if (!result.ok) return fail(400, { message: mapUseCaseError(result.error) });
		return { success: true, capturedVersion: result.value.version };
	}
};
