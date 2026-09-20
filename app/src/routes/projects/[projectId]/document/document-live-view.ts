// Apresentação do Documento VIVO: decora o conteúdo canônico (sem
// affordance de UI) com a ação de edição. O snapshot nunca passa por aqui —
// é sempre read-only.

import type { DocumentSnapshotContentV1 } from '$lib/domain';

// Único mecanismo de edição pós-conclusão que existe hoje é
// now/+page.server.ts (findDescobertaConcluidaActivity), restrito à
// Descoberta. Definição e Estruturação não ganham edição nesta versão —
// decisão explícita do escopo, não limitação a contornar aqui.
const EDITABLE_PHASE_ID = 'descoberta';

export function withEditAffordance(content: DocumentSnapshotContentV1) {
	return {
		sections: content.sections.map((section) => ({
			...section,
			blocks: section.blocks.map((block) => ({ ...block, editable: section.phaseId === EDITABLE_PHASE_ID }))
		}))
	};
}
