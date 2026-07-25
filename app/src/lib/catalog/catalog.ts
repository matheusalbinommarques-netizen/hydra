// Catálogo metodológico agregado — ver docs/06-architecture/architecture-brief.md §5
// e docs/core/DOMAIN_MODEL.md §7. Dados estáticos, sem estado de projeto.

import type { Catalog } from '$lib/domain';
import { discoveryActivities } from './discovery';
import { productDefinitionActivities } from './product-definition';
import { structuringActivities } from './structuring';
import { planningActivities } from './planning';
import { executionActivities } from './execution';
import { closureActivities } from './closure';

export const catalog: Catalog = {
	phases: [
		{
			id: 'descoberta',
			order: 1,
			label: 'Descoberta',
			catalogStatus: 'complete',
			activities: discoveryActivities
		},
		{
			id: 'definicao',
			order: 2,
			label: 'Definição do produto',
			catalogStatus: 'complete',
			activities: productDefinitionActivities
		},
		{
			id: 'estruturacao',
			order: 3,
			label: 'Estruturação do projeto',
			catalogStatus: 'complete',
			activities: structuringActivities
		},
		{
			id: 'planejamento',
			order: 4,
			label: 'Planejamento da entrega',
			catalogStatus: 'complete',
			activities: planningActivities
		},
		{
			id: 'execucao',
			order: 5,
			label: 'Execução e acompanhamento',
			catalogStatus: 'complete',
			activities: executionActivities
		},
		{
			id: 'validacao',
			order: 6,
			label: 'Validação e encerramento',
			catalogStatus: 'complete',
			activities: closureActivities
		}
	]
};
