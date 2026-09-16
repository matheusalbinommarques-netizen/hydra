// Riscos (ETAPA 10 do rework, primeiro microcorte, D049; surface própria em
// `/risks` na ETAPA 13, S13, D065/D066) — projeção pura aberto/encerrado
// sobre Risk, sem promoção automática a "Precisa de você" nem a "Atenções",
// sem avaliação/urgência estruturada (isso fingiria acionabilidade que o
// modelo ainda não conhece). Vive em `$lib/` (mesmo espírito de
// phase-progress.ts) por ser consumida por mais de uma rota (`/tracking` e
// `/risks`) sobre o mesmo lifecycle real de Risk — nenhuma das duas rotas
// pertence estruturalmente à outra.
import type { RiskView } from '$lib/server/application/types';

export interface RisksView {
	open: RiskView[];
	closed: RiskView[];
}

export function buildRisks(risks: RiskView[]): RisksView {
	return {
		open: risks.filter((risk) => risk.status === 'aberto'),
		closed: risks.filter((risk) => risk.status === 'encerrado')
	};
}
