// Status de fase — ver docs/06-architecture/contracts.md §8 e docs/core/STATE_MACHINE.md §2.

import type { ActivityProgress, PendingItem, PhaseDefinition } from '$lib/domain';

export type PhaseStatus = 'não_iniciada' | 'em_andamento' | 'concluída_com_pendências' | 'concluída';

export function computePhaseStatus(
	phase: PhaseDefinition,
	activityProgress: ActivityProgress[],
	pendingItems: PendingItem[]
): PhaseStatus {
	if (phase.catalogStatus === 'unavailable') return 'não_iniciada';

	const activityIds = new Set(phase.activities.map((activity) => activity.id));
	const statuses = phase.activities.map((activity) => {
		const progress = activityProgress.find((p) => p.activityDefinitionId === activity.id);
		return progress?.status ?? 'não_iniciada';
	});

	const allUntouched = statuses.every((status) => status === 'não_iniciada');
	if (allUntouched) return 'não_iniciada';

	if (phase.catalogStatus === 'partial') return 'em_andamento';

	// catalogStatus === 'complete'
	const anyPendingOrInProgress = statuses.some(
		(status) => status === 'não_iniciada' || status === 'em_andamento'
	);
	if (anyPendingOrInProgress) return 'em_andamento';

	const anySkipped = statuses.some((status) => status === 'pulada');
	const hasOpenPendency = pendingItems.some(
		(item) => item.status === 'aberta' && activityIds.has(item.activityDefinitionId)
	);
	if (anySkipped || hasOpenPendency) return 'concluída_com_pendências';

	return 'concluída';
}
