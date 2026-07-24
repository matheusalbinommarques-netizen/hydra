import { error } from '@sveltejs/kit';
import { getProjectUseCases } from '$lib/server/composition';
import type { RequestHandler } from './$types';

function safeFilenameSegment(value: string): string {
	return value.replace(/[^a-zA-Z0-9_-]/g, '') || 'projeto';
}

export const GET: RequestHandler = async ({ params }) => {
	const result = await getProjectUseCases().exportProject(params.projectId);
	if (!result.ok) {
		error(404, 'Projeto não encontrado.');
	}

	const filename = `hydra-${safeFilenameSegment(params.projectId)}.json`;
	return new Response(result.value, {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};
