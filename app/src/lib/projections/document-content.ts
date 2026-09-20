// Projetor canônico e puro do conteúdo do Documento do projeto (/document) —
// ÚNICO caminho que deriva DocumentSnapshotContentV1: a leitura viva de
// /document e a captura de snapshot (ETAPA 15, D076/D077) usam esta mesma
// função, então "o que o Documento mostra" e "o que o snapshot congela" não
// podem divergir. Reagrupa os blocos curados da Bancada (ver
// bancada-overview-view.ts) em seções por fase, na ordem do catálogo. Não
// recalcula nem duplica BLOCK_SPECS, não lê nem grava persistência, não gera
// prosa nova, e não conhece rota, projectId nem affordance de UI (edição é
// decidida por quem apresenta o Documento vivo).
//
// Evidence no Documento (ETAPA 3 do rework) — projeção determinística direta
// de Evidence: outcome em linguagem de UI + learning, nunca a
// preparação/roteiro da ExternalAction. Mapa de Impacto e Resumo continuam
// com a contagem compacta ("N evidências"); só o Documento mostra o
// conteúdo, por ser a superfície de leitura consolidada do projeto.

import type { Catalog, DocumentSnapshotContentV1, DocumentSnapshotEvidenceItem } from '$lib/domain';
import { evidenceOutcomeLabel } from '$lib/catalog/external-action';
import type { ProjectView } from '$lib/server/application/types';
import { buildBancadaOverviewView, type BancadaOverviewBlock } from './bancada-overview-view';

const DOCUMENT_PHASE_IDS = ['descoberta', 'definicao', 'estruturacao'];

export function buildDocumentContent(
	catalog: Catalog,
	blocks: BancadaOverviewBlock[],
	evidenceItems: DocumentSnapshotEvidenceItem[] = []
): DocumentSnapshotContentV1 {
	const phasesInOrder = [...catalog.phases]
		.filter((phase) => DOCUMENT_PHASE_IDS.includes(phase.id))
		.sort((a, b) => a.order - b.order);

	const sections: DocumentSnapshotContentV1['sections'] = [];

	for (const phase of phasesInOrder) {
		const activityIds = new Set(phase.activities.map((activity) => activity.id));
		const phaseBlocks = blocks
			.filter((block) => activityIds.has(block.activityId))
			.map((block) => ({
				activityId: block.activityId,
				heading: block.heading,
				value: block.value,
				...(block.chips !== undefined ? { chips: [...block.chips] } : {}),
				...(block.activityId === 'publico' && evidenceItems.length > 0
					? { evidenceItems: evidenceItems.map((item) => ({ ...item })) }
					: {})
			}));

		if (phaseBlocks.length > 0) {
			sections.push({ phaseId: phase.id, phaseLabel: phase.label, blocks: phaseBlocks });
		}
	}

	return { sections };
}

// Conteúdo do Documento a partir do ProjectView — evidências na ordem em que
// foram registradas (mesma ordem de view.evidences).
export function projectDocumentContent(catalog: Catalog, view: ProjectView): DocumentSnapshotContentV1 {
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

	const evidenceItems: DocumentSnapshotEvidenceItem[] = view.evidences.map((evidence) => {
		const group = view.affectedGroups.find((candidate) => candidate.id === evidence.affectedGroupId);
		return {
			groupLabel: group?.label ?? 'Grupo removido',
			outcomeLabel: evidenceOutcomeLabel(evidence.outcome),
			learning: evidence.learning
		};
	});

	return buildDocumentContent(catalog, blocks, evidenceItems);
}
