import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { buildJourneyContext } from './journey-context';

describe('buildJourneyContext', () => {
	it('fase correta para a próxima atividade recomendada', () => {
		const result = buildJourneyContext(catalog, { kind: 'recommendation', activityDefinitionId: 'objetivo_entregaveis' });
		expect(result).toEqual({ kind: 'in_progress', phaseLabel: 'Estruturação do projeto', position: 3, total: 6 });
	});

	it('posição conforme a ordem oficial do catálogo (primeira fase)', () => {
		const result = buildJourneyContext(catalog, { kind: 'recommendation', activityDefinitionId: 'origem' });
		expect(result).toEqual({ kind: 'in_progress', phaseLabel: 'Descoberta', position: 1, total: 6 });
	});

	it('total de fases reflete o tamanho do catálogo', () => {
		const result = buildJourneyContext(catalog, { kind: 'recommendation', activityDefinitionId: 'origem' });
		expect(result?.total).toBe(catalog.phases.length);
	});

	it('jornada concluída', () => {
		const result = buildJourneyContext(catalog, { kind: 'catalog_limit_reached' });
		expect(result).toEqual({ kind: 'completed', total: 6 });
	});

	it('ausência segura de contexto quando a atividade não existe no catálogo', () => {
		const result = buildJourneyContext(catalog, { kind: 'recommendation', activityDefinitionId: 'inexistente' });
		expect(result).toBeUndefined();
	});
});
