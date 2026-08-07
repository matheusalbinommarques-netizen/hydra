// Trilha B — pendências a resolver — ver docs/06-architecture/contracts.md §8
// e docs/core/ORIENTATION_ENGINE.md §4. Nunca compete com a Trilha A.

import type { Catalog, PendingItem } from '$lib/domain';
import { findActivityDefinition } from './catalog-lookup';

export interface PendingItemView {
	id: string;
	activityDefinitionId: string;
	label: string;
	detail: string;
}

export function computeOpenPendingItems(catalog: Catalog, pendingItems: PendingItem[]): PendingItemView[] {
	const views: PendingItemView[] = [];
	for (const item of pendingItems) {
		if (item.status !== 'aberta') continue;
		const activity = findActivityDefinition(catalog, item.activityDefinitionId);
		// A capacidade declarada de gerar pendência é allowsSkip — só uma
		// atividade pulável pode ter um PendingItem aberto. pendingItemLabel/
		// pendingItemDetail são exigidos apenas como defesa de apresentação
		// (o texto precisa existir para ser exibido), não como proxy da
		// capacidade em si.
		if (!activity || !activity.allowsSkip || activity.pendingItemLabel === undefined || activity.pendingItemDetail === undefined) {
			continue;
		}
		views.push({
			id: item.id,
			activityDefinitionId: item.activityDefinitionId,
			label: activity.pendingItemLabel,
			detail: activity.pendingItemDetail
		});
	}
	return views;
}
