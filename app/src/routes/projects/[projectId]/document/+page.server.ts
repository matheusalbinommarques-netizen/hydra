import { catalog } from '$lib/catalog';
import { evidenceOutcomeLabel } from '$lib/catalog/external-action';
import { buildBancadaOverviewView } from '../now/bancada-overview-view';
import { buildDocumentView, type DocumentEvidenceItem } from './document-view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { view } = await parent();
	const { blocks } = buildBancadaOverviewView(
		catalog,
		view.answers,
		view.affectedGroups,
		view.evidences,
		view.currentTreatment,
		view.treatmentSteps,
		view.causeExploration,
		view.causeHypotheses
	);

	// Evidence no Documento (ETAPA 3 do rework) — projeção determinística
	// direta de Evidence: outcome em linguagem de UI + learning, na ordem em
	// que foram registradas (mesma ordem de view.evidences, que reflete a
	// ordem de inserção real). Nenhuma fonte de verdade nova.
	const evidenceItems: DocumentEvidenceItem[] = view.evidences.map((evidence) => {
		const group = view.affectedGroups.find((candidate) => candidate.id === evidence.affectedGroupId);
		return {
			groupLabel: group?.label ?? 'Grupo removido',
			outcomeLabel: evidenceOutcomeLabel(evidence.outcome),
			learning: evidence.learning
		};
	});

	return buildDocumentView(catalog, blocks, evidenceItems);
};
