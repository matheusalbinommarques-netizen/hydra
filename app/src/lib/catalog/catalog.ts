// Catálogo metodológico agregado — ver docs/06-architecture/architecture-brief.md §5
// e docs/core/DOMAIN_MODEL.md §7. Dados estáticos, sem estado de projeto.

import type { Catalog } from '$lib/domain';
import { discoveryActivities } from './discovery';
import { productDefinitionActivities } from './product-definition';

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
			catalogStatus: 'partial',
			activities: productDefinitionActivities
		},
		{
			id: 'estruturacao',
			order: 3,
			label: 'Estruturação do projeto',
			catalogStatus: 'unavailable',
			activities: []
		},
		{
			id: 'planejamento',
			order: 4,
			label: 'Planejamento da entrega',
			catalogStatus: 'unavailable',
			activities: []
		},
		{
			id: 'execucao',
			order: 5,
			label: 'Execução e acompanhamento',
			catalogStatus: 'unavailable',
			activities: []
		},
		{
			id: 'validacao',
			order: 6,
			label: 'Validação e encerramento',
			catalogStatus: 'unavailable',
			activities: []
		}
	]
};
