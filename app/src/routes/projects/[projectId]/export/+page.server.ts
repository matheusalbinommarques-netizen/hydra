import { exportFilename } from './response';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return {
		projectId: view.projectId,
		filename: exportFilename(view.projectId)
	};
};
