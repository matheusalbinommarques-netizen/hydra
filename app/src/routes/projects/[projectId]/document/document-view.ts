// Projeção pura de leitura para a tela "Documento do projeto" (/document) —
// reagrupa os mesmos blocos curados da Bancada (ver
// now/bancada-overview-view.ts) em seções por fase, na ordem do catálogo.
// Não recalcula nem duplica BLOCK_SPECS: recebe os blocos já prontos e só
// decide a que seção cada um pertence e se ganha ação de edição. Não lê nem
// grava persistência, não gera prosa nova.

import type { Catalog } from '$lib/domain';
import type { BancadaOverviewBlock } from '../now/bancada-overview-view';

export interface DocumentSectionBlock extends BancadaOverviewBlock {
	// A URL final (com o projectId) é montada pela camada de apresentação —
	// esta projeção não conhece rota nem projectId, só decide quais blocos
	// ganham ação de edição.
	editable: boolean;
}

export interface DocumentSection {
	phaseId: string;
	phaseLabel: string;
	blocks: DocumentSectionBlock[];
}

export interface DocumentView {
	sections: DocumentSection[];
}

const DOCUMENT_PHASE_IDS = ['descoberta', 'definicao', 'estruturacao'];

// Único mecanismo de edição pós-conclusão que existe hoje é
// now/+page.server.ts (findDescobertaConcluidaActivity), restrito à
// Descoberta. Definição e Estruturação não ganham editHref nesta versão —
// decisão explícita do escopo, não limitação a contornar aqui.
const EDITABLE_PHASE_ID = 'descoberta';

export function buildDocumentView(catalog: Catalog, blocks: BancadaOverviewBlock[]): DocumentView {
	const phasesInOrder = [...catalog.phases]
		.filter((phase) => DOCUMENT_PHASE_IDS.includes(phase.id))
		.sort((a, b) => a.order - b.order);

	const sections: DocumentSection[] = [];

	for (const phase of phasesInOrder) {
		const activityIds = new Set(phase.activities.map((activity) => activity.id));
		const phaseBlocks = blocks
			.filter((block) => activityIds.has(block.activityId))
			.map((block): DocumentSectionBlock => ({ ...block, editable: phase.id === EDITABLE_PHASE_ID }));

		if (phaseBlocks.length > 0) {
			sections.push({ phaseId: phase.id, phaseLabel: phase.label, blocks: phaseBlocks });
		}
	}

	return { sections };
}
