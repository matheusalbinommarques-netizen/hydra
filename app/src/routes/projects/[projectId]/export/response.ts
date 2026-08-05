import { error } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';

// Compartilhado entre o handler legado (`+server.ts`) e o novo endpoint de
// download (`download/+server.ts`) — nome de arquivo e resposta JSON
// precisam ser idênticos nos dois, e a página (`+page.server.ts`) precisa da
// mesma regra de nome para exibir o valor real.
function safeFilenameSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '') || 'projeto';
}

export function exportFilename(projectId: string): string {
	return `hydra-${safeFilenameSegment(projectId)}.json`;
}

export async function buildExportResponse(projectId: string): Promise<Response> {
	const result = await getProjectUseCases().exportProject(projectId);
	if (!result.ok) {
		error(404, 'Projeto não encontrado.');
	}

	return new Response(result.value, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${exportFilename(projectId)}"`
		}
	});
}
