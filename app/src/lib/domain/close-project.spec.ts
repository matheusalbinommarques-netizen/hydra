import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog';
import { computeProjectStatus, computeSnapshot } from '../orientation-engine';
import { addDesiredOutcome, closeProject, isReadyToClose, renameProject, setDesiredOutcomeAssessment } from './transitions';
import { createInitialProjectState } from './factory';
import { deserializeProjectState, serializeProjectState } from './serialization';
import { completeEntireCatalog, unwrapResult as unwrap } from './test-support';
import type { DesiredOutcomeAssessmentState } from './state-types';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';
const T3 = '2026-01-03T00:00:00.000Z';

const fresh = () => unwrap(renameProject(catalog, createInitialProjectState(catalog, 'p1', T1), 'Portal'));
const withOutcomes = (n: number) => {
	let state = fresh();
	for (let i = 1; i <= n; i++) state = unwrap(addDesiredOutcome(catalog, state, `do-${i}`, `Mudança ${i}`, T1));
	return state;
};
const assess = (state: ReturnType<typeof fresh>, id: string, st: DesiredOutcomeAssessmentState) =>
	unwrap(setDesiredOutcomeAssessment(catalog, state, id, st, 'porque sim', T2));

describe('closeProject (ETAPA 16, D083)', () => {
	it('fresh: closedAt e closureNote são null', () => {
		const state = createInitialProjectState(catalog, 'p1', T1);
		expect(state.project.closedAt).toBeNull();
		expect(state.project.closureNote).toBeNull();
	});

	it('zero outcomes fecha; nota com trim; closedAt = occurredAt', () => {
		const closed = unwrap(closeProject(fresh(), '  fim  ', T2));
		expect(closed.project.closedAt).toBe(T2);
		expect(closed.project.closureNote).toBe('fim');
	});

	it('nota vazia, só espaços ou ausente vira null', () => {
		expect(unwrap(closeProject(fresh(), '   ', T2)).project.closureNote).toBeNull();
		expect(unwrap(closeProject(fresh(), null, T2)).project.closureNote).toBeNull();
	});

	it('um outcome sem avaliação bloqueia com erro tipado', () => {
		const state = assess(withOutcomes(2), 'do-1', 'alcancado');
		expect(isReadyToClose(state)).toBe(false);
		expect(closeProject(state, null, T2)).toEqual({ ok: false, error: { kind: 'project_close_outcomes_unassessed' } });
	});

	it.each(['alcancado', 'parcialmente_alcancado', 'nao_alcancado', 'ainda_nao_verificavel'] as const)(
		'todos avaliados como %s fecha',
		(st) => {
			const state = assess(assess(withOutcomes(2), 'do-1', st), 'do-2', st);
			expect(isReadyToClose(state)).toBe(true);
			expect(unwrap(closeProject(state, null, T3)).project.closedAt).toBe(T3);
		}
	);

	it('fechar duas vezes é no-op: preserva primeiro closedAt e primeira nota (mesma referência)', () => {
		const closed = unwrap(closeProject(fresh(), 'primeira', T2));
		const again = unwrap(closeProject(closed, 'segunda', T3));
		expect(again).toBe(closed);
		expect(again.project.closedAt).toBe(T2);
		expect(again.project.closureNote).toBe('primeira');
	});

	it('atividades não concluídas não bloqueiam o fechamento (só as avaliações contam)', () => {
		expect(unwrap(closeProject(fresh(), null, T2)).project.closedAt).toBe(T2);
	});

	it('reavaliar ainda_nao_verificavel depois de fechar funciona e não altera closedAt nem a nota', () => {
		const state = assess(withOutcomes(1), 'do-1', 'ainda_nao_verificavel');
		const closed = unwrap(closeProject(state, 'nota', T2));
		const reassessed = unwrap(setDesiredOutcomeAssessment(catalog, closed, 'do-1', 'alcancado', 'agora sim', T3));
		expect(reassessed.desiredOutcomes[0].assessment?.state).toBe('alcancado');
		expect(reassessed.project.closedAt).toBe(T2);
		expect(reassessed.project.closureNote).toBe('nota');
	});
});

describe('status e orientação após closedAt', () => {
	it('catálogo completo sem closedAt: em_andamento e catalog_limit_reached (projeto aberto)', () => {
		const state = completeEntireCatalog(catalog, fresh(), T1);
		const snapshot = computeSnapshot(catalog, state);
		expect(snapshot.projectStatus).toBe('em_andamento');
		expect(snapshot.nextActivity).toEqual({ kind: 'catalog_limit_reached' });
	});

	it('closedAt implica concluído e nenhuma recomendação normal, mesmo com atividades pendentes', () => {
		const closed = unwrap(closeProject(fresh(), null, T2));
		expect(computeProjectStatus(closed.project)).toBe('concluído');
		expect(computeSnapshot(catalog, closed).nextActivity).toEqual({ kind: 'project_closed' });
	});

	it('resumo_encerramento legado + confirmar_encerramento concluída NÃO fecham o projeto', () => {
		const state = completeEntireCatalog(catalog, fresh(), T1);
		const legacy = {
			...state,
			activityProgress: [
				...state.activityProgress,
				{ projectId: 'p1', activityDefinitionId: 'confirmar_encerramento', status: 'concluída' as const }
			],
			answers: [
				...state.answers,
				{
					projectId: 'p1',
					activityDefinitionId: 'confirmar_encerramento',
					fieldDefinitionId: 'resumo_encerramento',
					value: 'Projeto encerrado.',
					createdAt: T1,
					updatedAt: T1
				}
			]
		};
		expect(legacy.project.closedAt).toBeNull();
		expect(computeSnapshot(catalog, legacy).projectStatus).toBe('em_andamento');
	});
});

describe('serialização e compatibilidade legada', () => {
	it('round-trip preserva closedAt/closureNote', () => {
		const closed = unwrap(closeProject(fresh(), 'nota', T2));
		const parsed = unwrap(deserializeProjectState(serializeProjectState(closed), catalog));
		expect(parsed.project.closedAt).toBe(T2);
		expect(parsed.project.closureNote).toBe('nota');
	});

	it('export antigo sem os campos importa como null', () => {
		const json = JSON.parse(serializeProjectState(fresh()));
		delete json.state.project.closedAt;
		delete json.state.project.closureNote;
		const parsed = unwrap(deserializeProjectState(JSON.stringify(json), catalog));
		expect(parsed.project.closedAt).toBeNull();
		expect(parsed.project.closureNote).toBeNull();
	});

	it('nota sem closedAt é inválida; closedAt não-ISO é inválido', () => {
		const base = JSON.parse(serializeProjectState(fresh()));
		const withNote = structuredClone(base);
		withNote.state.project.closureNote = 'x';
		expect(deserializeProjectState(JSON.stringify(withNote), catalog).ok).toBe(false);
		const badDate = structuredClone(base);
		badDate.state.project.closedAt = 'ontem';
		expect(deserializeProjectState(JSON.stringify(badDate), catalog).ok).toBe(false);
	});

	it('export antigo com ActivityProgress/Answer de confirmar_encerramento importa e preserva os dados', () => {
		const base = JSON.parse(serializeProjectState(fresh()));
		base.state.activityProgress.push({ projectId: 'p1', activityDefinitionId: 'confirmar_encerramento', status: 'concluída' });
		base.state.answers.push({
			projectId: 'p1',
			activityDefinitionId: 'confirmar_encerramento',
			fieldDefinitionId: 'resumo_encerramento',
			value: 'Texto legado',
			createdAt: T1,
			updatedAt: T1
		});
		const parsed = unwrap(deserializeProjectState(JSON.stringify(base), catalog));
		expect(parsed.project.closedAt).toBeNull();
		expect(parsed.activityProgress.some((p) => p.activityDefinitionId === 'confirmar_encerramento')).toBe(true);
		expect(parsed.answers.find((a) => a.fieldDefinitionId === 'resumo_encerramento')?.value).toBe('Texto legado');
	});
});
