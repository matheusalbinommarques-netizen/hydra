import { catalog } from '$lib/catalog';
import { buildMapView } from './map-view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	return { phases: buildMapView(catalog, view) };
};
