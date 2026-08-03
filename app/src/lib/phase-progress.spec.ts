import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import { fabricatedUnavailablePhase } from '$lib/domain/test-support';
import { buildPhaseActivities } from './phase-activities';
import { buildPhaseProgress } from './phase-progress';

const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta')!;
const descobertaActivityIds = descoberta.activities.map((activity) => activity.id);

describe('buildPhaseProgress', () => {
	it('conta corretamente as atividades concluídas', () => {
		const [first, second] = descobertaActivityIds;
		const result = buildPhaseProgress(catalog, {
			activityStatuses: { [first]: 'concluída', [second]: 'concluída' },
			phaseStatuses: { descoberta: 'em_andamento' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: descobertaActivityIds[2] }
		})!;

		const concluidas = result.groups.find((group) => group.key === 'concluidas')!;
		expect(concluidas.activities.map((a) => a.id)).toEqual([first, second]);
	});

	it('atividade pulada conta como resolvida, mas permanece no grupo Puladas', () => {
		const [first, second, third] = descobertaActivityIds;
		const result = buildPhaseProgress(catalog, {
			activityStatuses: { [first]: 'concluída', [second]: 'pulada' },
			phaseStatuses: { descoberta: 'em_andamento' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: third }
		})!;

		expect(result.resolvedActivities).toBe(2);
		const puladas = result.groups.find((group) => group.key === 'puladas')!;
		expect(puladas.activities.map((a) => a.id)).toEqual([second]);
	});

	it('atividade pulada não aparece em Concluídas', () => {
		const [first, second] = descobertaActivityIds;
		const result = buildPhaseProgress(catalog, {
			activityStatuses: { [first]: 'pulada' },
			phaseStatuses: { descoberta: 'em_andamento' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: second }
		})!;

		const concluidas = result.groups.find((group) => group.key === 'concluidas')!;
		expect(concluidas.activities.some((a) => a.id === first)).toBe(false);
	});

	it('a atividade recomendada pela Trilha A aparece no grupo Atual', () => {
		const [, second] = descobertaActivityIds;
		const result = buildPhaseProgress(catalog, {
			activityStatuses: {},
			phaseStatuses: { descoberta: 'em_andamento' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: second }
		})!;

		const atual = result.groups.find((group) => group.key === 'atual')!;
		expect(atual.activities.map((a) => a.id)).toEqual([second]);
	});

	it('atividades não iniciadas aparecem em Pendentes', () => {
		const [first, second, third] = descobertaActivityIds;
		const result = buildPhaseProgress(catalog, {
			activityStatuses: {},
			phaseStatuses: { descoberta: 'não_iniciada' },
			nextActivity: { kind: 'recommendation', activityDefinitionId: first }
		})!;

		const pendentes = result.groups.find((group) => group.key === 'pendentes')!;
		expect(pendentes.activities.some((a) => a.id === second)).toBe(true);
		expect(pendentes.activities.some((a) => a.id === third)).toBe(true);
		// A atual (first) não aparece duplicada em Pendentes.
		expect(pendentes.activities.some((a) => a.id === first)).toBe(false);
	});

	it('atividades de uma fase unavailable (não aplicável) não entram no total', () => {
		const fabricatedCatalog = { phases: [fabricatedUnavailablePhase] };
		const result = buildPhaseProgress(fabricatedCatalog, {
			activityStatuses: {},
			phaseStatuses: {},
			nextActivity: { kind: 'catalog_limit_reached' }
		});

		expect(result).toBeUndefined();
	});

	it('fase totalmente resolvida produz a fração correta (resolvidas === total)', () => {
		// Catálogo inteiro esgotado (catalog_limit_reached): a fase alvo passa a
		// ser a última fase com atividades aplicáveis (Validação), não Descoberta.
		const validacao = catalog.phases[catalog.phases.length - 1];
		const validacaoActivityIds = validacao.activities.map((a) => a.id);
		const activityStatuses: Record<string, 'concluída'> = {};
		for (const id of catalog.phases.flatMap((p) => p.activities.map((a) => a.id))) {
			activityStatuses[id] = 'concluída';
		}
		const phaseStatuses = Object.fromEntries(catalog.phases.map((p) => [p.id, 'concluída' as const]));

		const result = buildPhaseProgress(catalog, {
			activityStatuses,
			phaseStatuses,
			nextActivity: { kind: 'catalog_limit_reached' }
		})!;

		expect(result.phaseId).toBe(validacao.id);
		expect(result.resolvedActivities).toBe(result.totalActivities);
		expect(result.totalActivities).toBe(validacaoActivityIds.length);
	});

	it('permanece coerente com a projeção usada pelo Mapa (buildPhaseActivities)', () => {
		const input = {
			activityStatuses: { [descobertaActivityIds[0]]: 'concluída' as const },
			phaseStatuses: { descoberta: 'em_andamento' as const },
			nextActivity: { kind: 'recommendation' as const, activityDefinitionId: descobertaActivityIds[1] }
		};

		const progress = buildPhaseProgress(catalog, input)!;
		const mapPhases = buildPhaseActivities(catalog, input);
		const mapDescoberta = mapPhases.find((phase) => phase.id === 'descoberta')!;

		expect(progress.phaseId).toBe(mapDescoberta.id);
		expect(progress.totalActivities).toBe(mapDescoberta.activities.length);

		const allGroupedIds = progress.groups.flatMap((group) => group.activities.map((a) => a.id)).sort();
		const allMapIds = mapDescoberta.activities.map((a) => a.id).sort();
		expect(allGroupedIds).toEqual(allMapIds);
	});
});
