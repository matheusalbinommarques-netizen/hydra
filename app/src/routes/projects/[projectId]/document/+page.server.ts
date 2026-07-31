import { catalog } from '$lib/catalog';
import { buildBancadaOverviewView } from '../now/bancada-overview-view';
import { buildDocumentView } from './document-view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	const { blocks } = buildBancadaOverviewView(catalog, view.answers);
	return buildDocumentView(catalog, blocks);
};
