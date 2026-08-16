import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInitialProjectState, encodeMultiSelectValue, encodePlanningItems } from '$lib/domain';
import { completePhase } from '$lib/domain/test-support';
import { catalog } from '../../catalog';
import { createSqliteProjectRepository, type ProjectRepository, type SqliteProjectRepository } from '../persistence';
import { createProjectUseCases } from './project-use-cases';
import type { Clock, IdGenerator } from './ports';

function fakeClock(initial: string): Clock & { set(iso: string): void } {
	let current = initial;
	return {
		now: () => current,
		set: (iso: string) => {
			current = iso;
		}
	};
}

function fakeIdGenerator(prefix: string): IdGenerator {
	let counter = 0;
	return { generate: () => `${prefix}-${++counter}` };
}

function countingRepository(inner: ProjectRepository): { repository: ProjectRepository; counts: { insert: number; save: number } } {
	const counts = { insert: 0, save: 0 };
	return {
		repository: {
			insert: async (state) => {
				counts.insert++;
				return inner.insert(state);
			},
			findById: (projectId) => inner.findById(projectId),
			save: async (state) => {
				counts.save++;
				return inner.save(state);
			},
			listRecent: () => inner.listRecent()
		},
		counts
	};
}

const openRepos: SqliteProjectRepository[] = [];
const tempFiles: string[] = [];

function memoryRepo(): SqliteProjectRepository {
	const repo = createSqliteProjectRepository(':memory:');
	openRepos.push(repo);
	return repo;
}

function tempFilePath(): string {
	const filePath = path.join(os.tmpdir(), `hydra-app-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
	tempFiles.push(filePath);
	return filePath;
}

afterEach(() => {
	for (const repo of openRepos.splice(0)) repo.close();
	for (const filePath of tempFiles.splice(0)) fs.rmSync(filePath, { force: true });
});

function setup(clockValue = '2026-01-01T00:00:00.000Z', catalogOverride: typeof catalog = catalog) {
	const repo = memoryRepo();
	const clock = fakeClock(clockValue);
	const idGenerator = fakeIdGenerator('id');
	const useCases = createProjectUseCases({ repository: repo, catalog: catalogOverride, clock, idGenerator });
	return { repo, clock, idGenerator, useCases };
}

describe('createProjectUseCases — createProject', () => {
	it('cria, persiste e retorna ProjectView', async () => {
		const { useCases, repo } = setup();
		const result = await useCases.createProject();
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.projectName).toBeNull();
		expect(result.value.projectStatus).toBe('rascunho');
		expect(result.value.nextActivity).toEqual({ kind: 'recommendation', activityDefinitionId: 'origem' });

		const stored = await repo.findById(result.value.projectId);
		expect(stored).not.toBeNull();
		expect(stored?.project.id).toBe(result.value.projectId);
	});
});

describe('createProjectUseCases — createConfiguredProject', () => {
	it('executa um único insert, sem save (criação atômica)', async () => {
		const inner = memoryRepo();
		const { repository, counts } = countingRepository(inner);
		const useCases = createProjectUseCases({
			repository,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});

		const result = await useCases.createConfiguredProject({ name: 'Portal', routeStartPhaseId: 'planejamento' });
		expect(result.ok).toBe(true);
		expect(counts.insert).toBe(1);
		expect(counts.save).toBe(0);
	});

	it('aplica o nome informado antes do insert', async () => {
		const { useCases, repo } = setup();
		const result = await useCases.createConfiguredProject({
			name: 'Consolidação diária',
			routeStartPhaseId: 'descoberta'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.projectName).toBe('Consolidação diária');
		const stored = await repo.findById(result.value.projectId);
		expect(stored?.project.name).toBe('Consolidação diária');
	});

	it('nome vazio mantém o comportamento atual (projeto sem nome, null)', async () => {
		const { useCases, repo } = setup();
		const result = await useCases.createConfiguredProject({ name: '', routeStartPhaseId: 'descoberta' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.projectName).toBeNull();
		const stored = await repo.findById(result.value.projectId);
		expect(stored?.project.name).toBeNull();
	});

	it('aplica uma fase inicial válida antes do insert', async () => {
		const { useCases, repo } = setup();
		const result = await useCases.createConfiguredProject({ name: null, routeStartPhaseId: 'planejamento' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.routeStartPhaseId).toBe('planejamento');
		const stored = await repo.findById(result.value.projectId);
		expect(stored?.project.routeStartPhaseId).toBe('planejamento');
	});

	// routeStartPhaseId é obrigatório no tipo (CreateConfiguredProjectInput);
	// este teste simula um chamador que viola o contrato em runtime (ex.: um
	// formulário sem fase selecionada chegando direto ao caso de uso, sem
	// passar pela validação de +page.server.ts) — confirma que o domínio
	// continua sendo a última linha de defesa, sem insert nem save.
	it('fase ausente é rejeitada antes de qualquer insert ou save', async () => {
		const inner = memoryRepo();
		const { repository, counts } = countingRepository(inner);
		const useCases = createProjectUseCases({
			repository,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});

		const result = await useCases.createConfiguredProject({
			name: 'Portal',
			routeStartPhaseId: '' as unknown as string
		});
		expect(result).toEqual({ ok: false, error: { kind: 'phase_not_found' } });
		expect(counts.insert).toBe(0);
		expect(counts.save).toBe(0);
	});

	it('fase inválida é rejeitada antes de qualquer insert ou save', async () => {
		const inner = memoryRepo();
		const { repository, counts } = countingRepository(inner);
		const useCases = createProjectUseCases({
			repository,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});

		const result = await useCases.createConfiguredProject({ name: 'Portal', routeStartPhaseId: 'fase-inexistente' });
		expect(result).toEqual({ ok: false, error: { kind: 'phase_not_found' } });
		expect(counts.insert).toBe(0);
		expect(counts.save).toBe(0);
	});
});

describe('createProjectUseCases — loadProjectView', () => {
	it('retorna o mesmo projeto após fechar e reabrir o banco', async () => {
		const filePath = tempFilePath();
		const repo1 = createSqliteProjectRepository(filePath);
		const useCases1 = createProjectUseCases({
			repository: repo1,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});
		const created = await useCases1.createProject();
		if (!created.ok) throw new Error('esperado ok');
		repo1.close();

		const repo2 = createSqliteProjectRepository(filePath);
		openRepos.push(repo2);
		const useCases2 = createProjectUseCases({
			repository: repo2,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});
		const loaded = await useCases2.loadProjectView(created.value.projectId);
		expect(loaded).toEqual({ ok: true, value: created.value });
	});

	it('retorna project_not_found para um projeto inexistente', async () => {
		const { useCases } = setup();
		await expect(useCases.loadProjectView('nao-existe')).resolves.toEqual({
			ok: false,
			error: { kind: 'project_not_found' }
		});
	});
});

describe('createProjectUseCases — renameProject', () => {
	it('persiste uma mudança real de nome', async () => {
		const { useCases, repo } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const renamed = await useCases.renameProject({ projectId: created.value.projectId, name: 'Portal' });
		// definir o nome também tira o projeto de "rascunho" (STATE_MACHINE.md §4)
		expect(renamed).toEqual({
			ok: true,
			value: { ...created.value, projectName: 'Portal', projectStatus: 'em_andamento' }
		});

		const stored = await repo.findById(created.value.projectId);
		expect(stored?.project.name).toBe('Portal');
	});

	it('nome idêntico preserva o comportamento do domínio (não persiste de novo)', async () => {
		const inner = memoryRepo();
		const { repository, counts } = countingRepository(inner);
		const useCases = createProjectUseCases({
			repository,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});

		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		await useCases.renameProject({ projectId: created.value.projectId, name: 'Portal' });
		expect(counts.save).toBe(1);

		await useCases.renameProject({ projectId: created.value.projectId, name: 'Portal' });
		expect(counts.save).toBe(1); // não incrementou — domínio retornou a mesma referência
	});
});

describe('createProjectUseCases — setRouteStartPhase', () => {
	it('persiste a fase escolhida e reflete em ProjectView.routeStartPhaseId', async () => {
		const { useCases, repo } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.setRouteStartPhase({
			projectId: created.value.projectId,
			phaseId: 'estruturacao'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.routeStartPhaseId).toBe('estruturacao');
		// próxima ação passa a respeitar a rota — primeira atividade de Estruturação
		expect(result.value.nextActivity).toEqual({
			kind: 'recommendation',
			activityDefinitionId: 'objetivo_entregaveis'
		});

		const stored = await repo.findById(created.value.projectId);
		expect(stored?.project.routeStartPhaseId).toBe('estruturacao');
	});

	it('phaseId null remove a escolha e restaura o comportamento padrão', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		await useCases.setRouteStartPhase({ projectId: created.value.projectId, phaseId: 'estruturacao' });
		const restored = await useCases.setRouteStartPhase({ projectId: created.value.projectId, phaseId: null });
		expect(restored).toEqual({ ok: true, value: { ...created.value, routeStartPhaseId: null } });
	});

	it('rejeita um id de fase inexistente', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		await expect(
			useCases.setRouteStartPhase({ projectId: created.value.projectId, phaseId: 'fase-inexistente' })
		).resolves.toEqual({ ok: false, error: { kind: 'phase_not_found' } });
	});

	it('retorna project_not_found para um projeto inexistente', async () => {
		const { useCases } = setup();
		await expect(useCases.setRouteStartPhase({ projectId: 'nao-existe', phaseId: 'estruturacao' })).resolves.toEqual({
			ok: false,
			error: { kind: 'project_not_found' }
		});
	});

	it('mesmo valor já definido preserva o comportamento do domínio (não persiste de novo)', async () => {
		const inner = memoryRepo();
		const { repository, counts } = countingRepository(inner);
		const useCases = createProjectUseCases({
			repository,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});

		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		await useCases.setRouteStartPhase({ projectId: created.value.projectId, phaseId: 'estruturacao' });
		expect(counts.save).toBe(1);

		await useCases.setRouteStartPhase({ projectId: created.value.projectId, phaseId: 'estruturacao' });
		expect(counts.save).toBe(1); // não incrementou — domínio retornou a mesma referência
	});
});

describe('createProjectUseCases — answerActivity', () => {
	it('grava um campo answer', async () => {
		const { useCases, repo } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.answerActivity({
			projectId: created.value.projectId,
			activityDefinitionId: 'origem',
			values: { origem: 'Um problema' }
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.answers.origem).toBe('Um problema');
		expect(result.value.activityStatuses.origem).toBe('concluída');

		const stored = await repo.findById(created.value.projectId);
		expect(stored?.answers.some((a) => a.fieldDefinitionId === 'origem' && a.value === 'Um problema')).toBe(true);
	});

	it('grava o campo project_property (nome do projeto)', async () => {
		// Nenhuma atividade do catálogo real usa mais dataTarget: 'project_property'
		// desde a remoção de "Contexto inicial" (nome agora vem de /projects/new
		// na criação real, via createConfiguredProject/renameProject, não via
		// answerActivity) — fixture local só para cobrir o mecanismo genérico
		// ponta a ponta (use case → domínio → SQLite).
		const projectPropertyActivity = {
			id: 'fixture_project_property',
			phaseId: 'descoberta',
			order: 1,
			title: 'Fixture de teste',
			mainQuestion: 'Pergunta fabricada de teste?',
			why: 'Fixture de teste.',
			example: 'Fixture de teste.',
			completionCriteria: 'Nome preenchido.',
			completionMode: 'required_fields' as const,
			allowsSkip: true,
			pendingItemLabel: 'Pendência fabricada de teste',
			pendingItemDetail: 'Fixture de teste.',
			fields: [
				{
					id: 'nome_provisorio',
					activityId: 'fixture_project_property',
					label: 'Nome provisório do projeto',
					required: true,
					dataTarget: 'project_property' as const,
					projectProperty: 'name' as const,
					type: 'texto_curto' as const
				}
			]
		};
		const fixtureCatalog = {
			phases: [
				{
					id: 'descoberta',
					order: 1,
					label: 'Descoberta',
					catalogStatus: 'complete' as const,
					activities: [projectPropertyActivity]
				}
			]
		};
		const { useCases, repo } = setup('2026-01-01T00:00:00.000Z', fixtureCatalog);
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.answerActivity({
			projectId: created.value.projectId,
			activityDefinitionId: 'fixture_project_property',
			values: { nome_provisorio: 'Portal de Solicitações' }
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.projectName).toBe('Portal de Solicitações');
		expect(result.value.answers.nome_provisorio).toBeUndefined();

		const stored = await repo.findById(created.value.projectId);
		expect(stored?.project.name).toBe('Portal de Solicitações');
		expect(stored?.answers.some((a) => a.fieldDefinitionId === 'nome_provisorio')).toBe(false);
	});

	it('invalida o Resumo quando necessário', async () => {
		const { useCases, clock } = setup('2026-01-01T00:00:00.000Z');
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		// completa as demais atividades da Descoberta para que, após a
		// invalidação, "resumo" seja de fato a única recomendação elegível
		// antes dela na ordem do catálogo.
		await useCases.answerActivity({ projectId, activityDefinitionId: 'origem', values: { origem: 'x' } });
		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'problema',
			values: { situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']) }
		});
		const addedGroup = await useCases.addAffectedGroup({ projectId, label: 'Clientes' });
		if (!addedGroup.ok) throw new Error('esperado ok');
		const groupId = addedGroup.value.affectedGroups[0].id;
		await useCases.setAffectedGroupImpact({ projectId, groupId, impact: 'alto' });
		await useCases.setAffectedGroupFrequency({ projectId, groupId, frequency: 'constante' });
		await useCases.confirmAffectedGroups({ projectId });
		await useCases.addTreatmentStep({ projectId, whatHappens: 'x' });
		await useCases.confirmTreatment({ projectId });
		await useCases.confirmCauseHypotheses({ projectId });
		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'resultado',
			values: { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }
		});
		const confirmed = await useCases.confirmSummary({ projectId });
		if (!confirmed.ok) throw new Error('esperado ok');
		expect(confirmed.value.activityStatuses.resumo).toBe('concluída');

		clock.set('2026-01-02T00:00:00.000Z');
		// Reclassifica a frequência do grupo já existente — valor genuinamente
		// diferente, sem tornar "Quem é afetado" incompleta de novo (senão
		// reabriria "publico" e o teste estaria provando outra coisa).
		const edited = await useCases.setAffectedGroupFrequency({ projectId, groupId, frequency: 'raro' });
		if (!edited.ok) throw new Error('esperado ok');
		expect(edited.value.activityStatuses.resumo).toBe('em_andamento');
		expect(edited.value.nextActivity).toEqual({ kind: 'recommendation', activityDefinitionId: 'resumo' });
	});
});

describe('createProjectUseCases — skipActivity', () => {
	it('cria uma pendência', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.skipActivity({ projectId: created.value.projectId, activityDefinitionId: 'origem' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.activityStatuses.origem).toBe('pulada');
		expect(result.value.openPendingItems).toHaveLength(1);
		expect(result.value.openPendingItems[0].activityDefinitionId).toBe('origem');

		expect(result.value.pendingItemHistory).toHaveLength(1);
		expect(result.value.pendingItemHistory[0]).toMatchObject({
			activityDefinitionId: 'origem',
			status: 'aberta'
		});
		expect(result.value.pendingItemHistory[0]).not.toHaveProperty('resolvedAt');
	});

	it('atividade pulada, posteriormente concluída, resolve a pendência', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		await useCases.skipActivity({ projectId, activityDefinitionId: 'origem' });
		const completed = await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'origem',
			values: { origem: 'Um problema' }
		});
		if (!completed.ok) throw new Error('esperado ok');
		expect(completed.value.activityStatuses.origem).toBe('concluída');
		expect(completed.value.openPendingItems).toHaveLength(0);

		expect(completed.value.pendingItemHistory).toHaveLength(1);
		expect(completed.value.pendingItemHistory[0]).toMatchObject({
			activityDefinitionId: 'origem',
			status: 'resolvida'
		});
		expect(completed.value.pendingItemHistory[0].resolvedAt).toEqual(expect.any(String));
	});

	it('erro activity_not_skippable ao tentar pular o Resumo', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.skipActivity({ projectId: created.value.projectId, activityDefinitionId: 'resumo' });
		expect(result).toEqual({ ok: false, error: { kind: 'activity_not_skippable' } });
	});
});

describe('createProjectUseCases — confirmSummary', () => {
	it('atualiza o snapshot', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const before = created.value.activityStatuses.resumo;
		expect(before).toBe('não_iniciada');

		const result = await useCases.confirmSummary({ projectId: created.value.projectId });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.activityStatuses.resumo).toBe('concluída');
	});

	it('erro transition_not_allowed ao confirmar duas vezes', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		await useCases.confirmSummary({ projectId: created.value.projectId });

		const result = await useCases.confirmSummary({ projectId: created.value.projectId });
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});
});

describe('createProjectUseCases — confirmPlanningPriority (C5-01)', () => {
	it('erro planning_no_items quando "Decompor o trabalho" está vazia', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.confirmPlanningPriority({ projectId: created.value.projectId });
		expect(result).toEqual({ ok: false, error: { kind: 'planning_no_items' } });
	});

	it('conclui "Priorizar entregas" quando há ao menos um PlanningItem', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'decompor_trabalho',
			values: { partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Parte 1' }]) }
		});

		const result = await useCases.confirmPlanningPriority({ projectId });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.activityStatuses.priorizar_entregas).toBe('concluída');
	});

	it('erro transition_not_allowed ao confirmar duas vezes', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'decompor_trabalho',
			values: { partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Parte 1' }]) }
		});
		await useCases.confirmPlanningPriority({ projectId });

		const result = await useCases.confirmPlanningPriority({ projectId });
		expect(result).toEqual({ ok: false, error: { kind: 'transition_not_allowed', from: 'concluída' } });
	});

	it('editar "Decompor o trabalho" depois de "Priorizar entregas" confirmada NÃO reabre nem sinaliza (comportamento silencioso, C5-01)', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'decompor_trabalho',
			values: { partes_trabalho: encodePlanningItems([{ id: 'p1', text: 'Parte 1' }]) }
		});
		await useCases.confirmPlanningPriority({ projectId });

		const edited = await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'decompor_trabalho',
			values: {
				partes_trabalho: encodePlanningItems([
					{ id: 'p1', text: 'Parte 1' },
					{ id: 'p2', text: 'Parte 2 adicionada depois' }
				])
			}
		});
		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.value.activityStatuses.priorizar_entregas).toBe('concluída');
		expect(edited.value.openPendingItems).toHaveLength(0);
		expect(edited.value.pendingItemHistory).toHaveLength(0);
	});
});

describe('createProjectUseCases — exportProject / importProject', () => {
	it('exportProject produz um JSON versionado', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.exportProject(created.value.projectId);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const parsed = JSON.parse(result.value);
		expect(parsed.version).toBe(1);
		expect(parsed.state.project.id).toBe(created.value.projectId);
	});

	it('importProject restaura o projeto e o snapshot num repositório novo', async () => {
		const source = setup();
		const created = await source.useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		await source.useCases.answerActivity({
			projectId: created.value.projectId,
			activityDefinitionId: 'origem',
			values: { origem: 'Um problema' }
		});
		const exported = await source.useCases.exportProject(created.value.projectId);
		if (!exported.ok) throw new Error('esperado ok');

		const target = setup();
		const imported = await target.useCases.importProject(exported.value);
		expect(imported.ok).toBe(true);
		if (!imported.ok) return;
		expect(imported.value.projectId).toBe(created.value.projectId);
		expect(imported.value.answers.origem).toBe('Um problema');
		expect(imported.value.activityStatuses.origem).toBe('concluída');

		const stored = await target.repo.findById(created.value.projectId);
		expect(stored).not.toBeNull();
	});

	it('rejeita JSON inválido', async () => {
		const { useCases } = setup();
		const result = await useCases.importProject('isto não é JSON {{{');
		expect(result).toEqual({
			ok: false,
			error: { kind: 'invalid_import', reason: { kind: 'invalid_json' } }
		});
	});

	it('rejeita violação de invariantes do agregado', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const exported = await useCases.exportProject(created.value.projectId);
		if (!exported.ok) throw new Error('esperado ok');

		const envelope = JSON.parse(exported.value) as { state: { activityProgress: unknown[] } };
		envelope.state.activityProgress = envelope.state.activityProgress.slice(1); // remove uma — viola cardinalidade

		const target = setup();
		const result = await target.useCases.importProject(JSON.stringify(envelope));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toEqual({
			kind: 'invalid_import',
			reason: { kind: 'invariant_violation', details: expect.any(String) }
		});
	});

	it('rejeita colisão de ID contra um projeto já existente', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const exported = await useCases.exportProject(created.value.projectId);
		if (!exported.ok) throw new Error('esperado ok');

		// importa no MESMO repositório, onde o id já existe
		const result = await useCases.importProject(exported.value);
		expect(result).toEqual({
			ok: false,
			error: { kind: 'import_id_collision', projectId: created.value.projectId }
		});
	});
});

describe('createProjectUseCases — propagação de erros e falhas', () => {
	it('project_not_found é retornado sem tocar o domínio quando o projeto não existe', async () => {
		const { useCases } = setup();
		const result = await useCases.answerActivity({
			projectId: 'nao-existe',
			activityDefinitionId: 'origem',
			values: {}
		});
		expect(result).toEqual({ ok: false, error: { kind: 'project_not_found' } });
	});

	it('falha de persistência nunca retorna sucesso', async () => {
		const brokenRepository: ProjectRepository = {
			insert: async () => {
				throw new Error('falha simulada de persistência');
			},
			findById: async () => null,
			save: async () => {
				throw new Error('falha simulada de persistência');
			},
			listRecent: async () => []
		};
		const useCases = createProjectUseCases({
			repository: brokenRepository,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});

		await expect(useCases.createProject()).rejects.toThrow('falha simulada de persistência');
	});
});

describe('createProjectUseCases — listRecentProjects', () => {
	it('retorna [] quando não há projetos', async () => {
		const { useCases } = setup();
		await expect(useCases.listRecentProjects()).resolves.toEqual({ ok: true, value: [] });
	});

	it('mapeia id/name/createdAt para o DTO, projeto sem nome mantém projectName: null', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const firstActivity = catalog.phases[0].activities[0];

		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual([
			{
				projectId: created.value.projectId,
				projectName: null,
				createdAt: expect.any(String),
				projectStatus: 'rascunho',
				nextAction: {
					kind: 'activity',
					activityDefinitionId: firstActivity.id,
					label: firstActivity.title,
					why: firstActivity.why
				},
				currentPhase: {
					phaseId: catalog.phases[0].id,
					phaseLabel: catalog.phases[0].label,
					completedActivities: 0,
					totalActivities: catalog.phases[0].activities.length
				},
				movementSignal: undefined,
				lastMovementAt: null
			}
		]);
	});

	it('projectStatus reflete o estado real de cada projeto (rascunho vs. em_andamento)', async () => {
		const { useCases } = setup();
		const draft = await useCases.createProject();
		if (!draft.ok) throw new Error('esperado ok');

		const started = await useCases.createProject();
		if (!started.ok) throw new Error('esperado ok');
		const renamed = await useCases.renameProject({ projectId: started.value.projectId, name: 'Em andamento' });
		if (!renamed.ok) throw new Error('esperado ok');

		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const byId = new Map(result.value.map((item) => [item.projectId, item.projectStatus]));
		expect(byId.get(draft.value.projectId)).toBe('rascunho');
		expect(byId.get(started.value.projectId)).toBe('em_andamento');
	});

	it('nextAction é completed quando o catálogo inteiro já foi percorrido', async () => {
		const { repo } = setup();
		let state = createInitialProjectState(catalog, 'proj-concluido', '2026-01-01T00:00:00.000Z');
		// Nome definido diretamente — desde a remoção de "Contexto inicial",
		// nenhuma atividade do catálogo define Project.name (agora vem de
		// /projects/new na criação real); sem nome, computeProjectStatus nunca
		// sai de 'rascunho', mesmo com o catálogo inteiro percorrido.
		state = { ...state, project: { ...state.project, name: 'Projeto concluído' } };
		await repo.insert(state);
		for (const phase of catalog.phases) {
			state = completePhase(catalog, state, phase.id, '2026-01-01T00:00:00.000Z');
		}
		await repo.save(state);

		const useCases = createProjectUseCases({
			repository: repo,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});
		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual([
			expect.objectContaining({
				projectId: 'proj-concluido',
				projectStatus: 'concluído',
				nextAction: { kind: 'completed' }
			})
		]);
	});

	it('nextAction respeita routeStartPhaseId, igual a /now e /map (D023)', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const estruturacaoPhase = catalog.phases.find((phase) => phase.id === 'estruturacao');
		if (!estruturacaoPhase) throw new Error('fase "estruturacao" não encontrada no catálogo');

		const routed = await useCases.setRouteStartPhase({
			projectId: created.value.projectId,
			phaseId: 'estruturacao'
		});
		if (!routed.ok) throw new Error('esperado ok');
		// a própria fonte canônica (ProjectView.nextActivity) já reflete a rota
		expect(routed.value.nextActivity).toEqual({
			kind: 'recommendation',
			activityDefinitionId: estruturacaoPhase.activities[0].id
		});

		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual([
			expect.objectContaining({
				projectId: created.value.projectId,
				nextAction: {
					kind: 'activity',
					activityDefinitionId: estruturacaoPhase.activities[0].id,
					label: estruturacaoPhase.activities[0].title,
					why: estruturacaoPhase.activities[0].why
				}
			})
		]);
	});

	it('currentPhase.completedActivities conta só "concluída", nunca "pulada"', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const discoveryPhase = catalog.phases[0];
		const [origem, contexto] = discoveryPhase.activities;

		const answered = await useCases.answerActivity({
			projectId,
			activityDefinitionId: origem.id,
			values: { origem: 'Um problema' }
		});
		if (!answered.ok) throw new Error('esperado ok');
		expect(answered.value.activityStatuses[origem.id]).toBe('concluída');

		const skipped = await useCases.skipActivity({ projectId, activityDefinitionId: contexto.id });
		if (!skipped.ok) throw new Error('esperado ok');
		expect(skipped.value.activityStatuses[contexto.id]).toBe('pulada');

		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0].currentPhase).toEqual({
			phaseId: discoveryPhase.id,
			phaseLabel: discoveryPhase.label,
			completedActivities: 1,
			totalActivities: discoveryPhase.activities.length
		});
	});

	it('movementSignal é "avancando" logo após uma movimentação real', async () => {
		const { useCases } = setup('2026-01-01T00:00:00.000Z');
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const origem = catalog.phases[0].activities[0];
		await useCases.answerActivity({ projectId, activityDefinitionId: origem.id, values: { origem: 'Um problema' } });

		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0].movementSignal).toBe('avancando');
		expect(result.value[0].lastMovementAt).toBe('2026-01-01T00:00:00.000Z');
	});

	it('movementSignal vira "parado" depois de 7 dias sem nenhuma movimentação', async () => {
		const { useCases, clock } = setup('2026-01-01T00:00:00.000Z');
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const origem = catalog.phases[0].activities[0];
		await useCases.answerActivity({ projectId, activityDefinitionId: origem.id, values: { origem: 'Um problema' } });

		clock.set('2026-01-08T00:00:00.000Z'); // exatamente 7 dias depois
		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0].movementSignal).toBe('parado');
	});

	it('movementSignal é "bloqueado" e tem prioridade sobre "parado", mesmo com impedimento antigo', async () => {
		const { useCases, clock } = setup('2026-01-01T00:00:00.000Z');
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		await useCases.addImpediment({ projectId, text: 'Fornecedor não respondeu', tipo: 'dependencia_externa' });

		clock.set('2026-01-10T00:00:00.000Z'); // 9 dias depois, impedimento continua aberto
		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0].movementSignal).toBe('bloqueado');
	});

	it('rascunho nunca trabalhado não recebe nenhum dos três sinais', async () => {
		const { useCases } = setup();
		await useCases.createProject();

		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0].movementSignal).toBeUndefined();
		expect(result.value[0].lastMovementAt).toBeNull();
	});

	it('rascunho nunca trabalhado, criado há 7 dias ou mais, vira "parado" (createdAt como fallback, não gera "avancando")', async () => {
		const { useCases, clock } = setup('2026-01-01T00:00:00.000Z');
		await useCases.createProject();

		clock.set('2026-01-08T00:00:00.000Z'); // exatamente 7 dias depois, sem nenhuma movimentação
		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0].movementSignal).toBe('parado');
		// createdAt só mede inatividade — nunca entra em lastMovementAt.
		expect(result.value[0].lastMovementAt).toBeNull();
	});

	it('não executa insert nem save ao listar', async () => {
		const inner = memoryRepo();
		const { repository, counts } = countingRepository(inner);
		const useCases = createProjectUseCases({
			repository,
			catalog,
			clock: fakeClock('2026-01-01T00:00:00.000Z'),
			idGenerator: fakeIdGenerator('id')
		});

		await useCases.createProject();
		expect(counts.insert).toBe(1);

		await useCases.listRecentProjects();
		expect(counts.insert).toBe(1);
		expect(counts.save).toBe(0);
	});
});

describe('createProjectUseCases — escopo (Escolha o próximo foco)', () => {
	it('addScopeItem cria o item e reflete em ProjectView.scopeItems', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.addScopeItem({
			projectId: created.value.projectId,
			text: 'Criar projeto',
			bucket: 'agora'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.scopeItems).toEqual([
			{
				id: 'id-2',
				text: 'Criar projeto',
				bucket: 'agora',
				effort: null,
				order: 0,
				sourceSuggestionId: null,
				executionStatus: 'a_fazer'
			}
		]);
	});

	it('checklist e confirmação: falha com issues pendentes, sucede após completar os critérios', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const withItem = await useCases.addScopeItem({ projectId, text: 'Item', bucket: 'agora' });
		if (!withItem.ok) throw new Error('esperado ok');
		const itemId = withItem.value.scopeItems[0].id;
		expect(withItem.value.scopeConfirmationIssues).toEqual([
			{ kind: 'missing_effort', itemIds: [itemId] },
			{ kind: 'missing_hypothesis' }
		]);

		const failedConfirm = await useCases.confirmScopeVersion({ projectId });
		expect(failedConfirm).toEqual({
			ok: false,
			error: {
				kind: 'scope_confirmation_invalid',
				issues: [{ kind: 'missing_effort', itemIds: [itemId] }, { kind: 'missing_hypothesis' }]
			}
		});

		await useCases.setScopeItemEffort({ projectId, itemId, effort: 'pequeno' });
		await useCases.setHypothesis({ projectId, hypothesis: 'Hipótese' });

		const confirmed = await useCases.confirmScopeVersion({ projectId });
		expect(confirmed.ok).toBe(true);
		if (!confirmed.ok) return;
		expect(confirmed.value.scopeVersion).toEqual({ hypothesis: 'Hipótese', confirmedAt: expect.any(String) });
		expect(confirmed.value.scopeConfirmationIssues).toEqual([]);
		expect(confirmed.value.activityStatuses['montar_proxima_versao']).toBe('concluída');
	});

	it('editar um item depois de confirmado reabre montar_proxima_versao', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const withItem = await useCases.addScopeItem({ projectId, text: 'Item', bucket: 'agora' });
		if (!withItem.ok) throw new Error('esperado ok');
		const itemId = withItem.value.scopeItems[0].id;
		await useCases.setScopeItemEffort({ projectId, itemId, effort: 'pequeno' });
		await useCases.setHypothesis({ projectId, hypothesis: 'Hipótese' });
		await useCases.confirmScopeVersion({ projectId });

		const edited = await useCases.setScopeItemText({ projectId, itemId, text: 'Item revisado' });
		expect(edited.ok).toBe(true);
		if (!edited.ok) return;
		expect(edited.value.scopeVersion.confirmedAt).toBeNull();
		expect(edited.value.activityStatuses['montar_proxima_versao']).toBe('em_andamento');
	});

	it('reorderAgoraItems reflete a nova ordem em ProjectView', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const first = await useCases.addScopeItem({ projectId, text: 'Um', bucket: 'agora' });
		if (!first.ok) throw new Error('esperado ok');
		const second = await useCases.addScopeItem({ projectId, text: 'Dois', bucket: 'agora' });
		if (!second.ok) throw new Error('esperado ok');
		const [idOne, idTwo] = [first.value.scopeItems[0].id, second.value.scopeItems[1].id];

		const reordered = await useCases.reorderAgoraItems({ projectId, orderedItemIds: [idTwo, idOne] });
		expect(reordered.ok).toBe(true);
		if (!reordered.ok) return;
		expect(reordered.value.scopeItems.map((i) => [i.id, i.order])).toEqual([
			[idOne, 1],
			[idTwo, 0]
		]);
	});

	it('removeScopeItem remove o item de ProjectView', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const added = await useCases.addScopeItem({ projectId, text: 'Item', bucket: 'agora' });
		if (!added.ok) throw new Error('esperado ok');
		const itemId = added.value.scopeItems[0].id;

		const removed = await useCases.removeScopeItem({ projectId, itemId });
		expect(removed.ok).toBe(true);
		if (!removed.ok) return;
		expect(removed.value.scopeItems).toEqual([]);
	});

	it('moveScopeItem para "agora" acrescenta order no fim', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const added = await useCases.addScopeItem({ projectId, text: 'Item', bucket: 'depois' });
		if (!added.ok) throw new Error('esperado ok');
		const itemId = added.value.scopeItems[0].id;

		const moved = await useCases.moveScopeItem({ projectId, itemId, bucket: 'agora' });
		expect(moved.ok).toBe(true);
		if (!moved.ok) return;
		expect(moved.value.scopeItems[0]).toEqual({
			id: itemId,
			text: 'Item',
			bucket: 'agora',
			effort: null,
			order: 0,
			sourceSuggestionId: null,
			executionStatus: 'a_fazer'
		});
	});

	it('setScopeItemExecutionStatus altera o status de um item "agora" confirmado, sem afetar confirmedAt', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const withItem = await useCases.addScopeItem({ projectId, text: 'Item', bucket: 'agora' });
		if (!withItem.ok) throw new Error('esperado ok');
		const itemId = withItem.value.scopeItems[0].id;
		await useCases.setScopeItemEffort({ projectId, itemId, effort: 'pequeno' });
		await useCases.setHypothesis({ projectId, hypothesis: 'Hipótese' });
		const confirmed = await useCases.confirmScopeVersion({ projectId });
		if (!confirmed.ok) throw new Error('esperado ok');

		const updated = await useCases.setScopeItemExecutionStatus({ projectId, itemId, status: 'em_andamento' });
		expect(updated.ok).toBe(true);
		if (!updated.ok) return;
		expect(updated.value.scopeItems[0].executionStatus).toBe('em_andamento');
		expect(updated.value.scopeVersion.confirmedAt).toBe(confirmed.value.scopeVersion.confirmedAt);
	});

	it('setScopeItemExecutionStatus falha quando a versão de escopo ainda não foi confirmada', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const withItem = await useCases.addScopeItem({ projectId, text: 'Item', bucket: 'agora' });
		if (!withItem.ok) throw new Error('esperado ok');
		const itemId = withItem.value.scopeItems[0].id;

		const result = await useCases.setScopeItemExecutionStatus({ projectId, itemId, status: 'em_andamento' });
		expect(result).toEqual({ ok: false, error: { kind: 'scope_version_not_confirmed' } });
	});

	it('erros de domínio (scope_item_not_found) são repassados sem persistir', async () => {
		const { useCases, repo } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.setScopeItemEffort({
			projectId: created.value.projectId,
			itemId: 'inexistente',
			effort: 'pequeno'
		});
		expect(result).toEqual({ ok: false, error: { kind: 'scope_item_not_found' } });

		const stored = await repo.findById(created.value.projectId);
		expect(stored?.scopeItems).toEqual([]);
	});

	// "Entender a situação" (Claude Design) substituiu o campo
	// `sinais_situacao` (catalog/discovery.ts) por `situacao_o_que`, com ids
	// namespaced (prob_/opor_) diferentes dos ids que
	// orientation-engine/scope-suggestions.ts ainda verifica
	// (too_many_steps/duplicated_information/rework) — por decisão explícita,
	// essas três regras ficam dormentes nesta entrega (não removidas, não
	// remapeadas): `answerActivity` já rejeita `sinais_situacao` por não
	// existir mais no catálogo, então nenhum fluxo real do produto consegue
	// mais produzir essas sugestões. `answerActivity` genérico e
	// `scope-suggestions.spec.ts` continuam cobrindo, respectivamente, a
	// validação de campo e a lógica pura de sinal→sugestão isoladamente.
	it('responder "Entender a situação" com os novos campos não produz as sugestões antigas (regra dormente)', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'problema',
			values: { situacao: 'x', situacao_o_que: encodeMultiSelectValue(['prob_retrabalho']) }
		});

		const view = await useCases.loadProjectView(projectId);
		if (!view.ok) throw new Error('esperado ok');
		expect(view.value.scopeSuggestions).toEqual([]);
	});

	it('aceite → ScopeItem: usar a sugestão a remove da lista; excluir o item a traz de volta', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		// sourceSuggestionId atribuído diretamente (não computado por
		// scope-suggestions.ts, dormente — ver teste acima) só para exercitar
		// a mecânica real de proveniência de ScopeItem: aceitar remove da
		// lista de sugestões calculada, excluir o item traz de volta.
		const accepted = await useCases.addScopeItem({
			projectId,
			text: 'Reaproveitar informações já registradas',
			bucket: 'agora',
			sourceSuggestionId: 'reuse_existing_information'
		});
		if (!accepted.ok) throw new Error('esperado ok');
		expect(accepted.value.scopeSuggestions).toEqual([]);
		expect(accepted.value.scopeItems[0].sourceSuggestionId).toBe('reuse_existing_information');

		const itemId = accepted.value.scopeItems[0].id;
		const afterRemoval = await useCases.removeScopeItem({ projectId, itemId });
		if (!afterRemoval.ok) throw new Error('esperado ok');
		expect(afterRemoval.value.scopeItems).toEqual([]);
	});
});

describe('createProjectUseCases — nenhuma projeção do motor é persistida; ProjectView não expõe ProjectState bruto', () => {
	it('o registro persistido contém só os 12 tipos de domínio', async () => {
		const { useCases, repo } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		await useCases.answerActivity({
			projectId: created.value.projectId,
			activityDefinitionId: 'origem',
			values: { origem: 'x' }
		});

		const stored = await repo.findById(created.value.projectId);
		expect(stored && Object.keys(stored).sort()).toEqual(
			[
				'project',
				'activityProgress',
				'answers',
				'pendingItems',
				'scopeItems',
				'scopeVersion',
				'impediments',
				'affectedGroups',
				'externalActions',
				'evidences',
				'currentTreatment',
				'treatmentSteps',
				'causeExploration',
				'causeHypotheses'
			].sort()
		);
	});

	it('ProjectView contém só os 30 campos do contrato, nunca ProjectState bruto', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		expect(Object.keys(created.value).sort()).toEqual(
			[
				'projectId',
				'projectName',
				'createdAt',
				'routeStartPhaseId',
				'projectStatus',
				'phaseStatuses',
				'activityStatuses',
				'answers',
				'nextActivity',
				'openPendingItems',
				'pendingItemHistory',
				'hypotheses',
				'scopeItems',
				'scopeVersion',
				'scopeConfirmationIssues',
				'scopeProjection',
				'scopeSuggestions',
				'fieldSuggestions',
				'criteriaScopeConflict',
				'impediments',
				'affectedGroups',
				'affectedGroupConfirmationIssues',
				'externalActions',
				'evidences',
				'currentTreatment',
				'treatmentSteps',
				'treatmentConfirmationIssues',
				'causeExploration',
				'causeHypotheses',
				'causeHypothesisConfirmationIssues'
			].sort()
		);
		expect(created.value).not.toHaveProperty('project');
		expect(created.value).not.toHaveProperty('activityProgress');
		expect(created.value).not.toHaveProperty('pendingItems');
	});
});

describe('createProjectUseCases — impedimentos (Acompanhamento)', () => {
	it('addImpediment cria o item e reflete em ProjectView.impediments', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.addImpediment({
			projectId: created.value.projectId,
			text: 'Falta acesso ao ambiente',
			tipo: 'falta_de_recurso'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.impediments).toEqual([
			{
				id: 'id-2',
				text: 'Falta acesso ao ambiente',
				tipo: 'falta_de_recurso',
				nextAction: null,
				status: 'aberto',
				createdAt: '2026-01-01T00:00:00.000Z',
				resolvedAt: null
			}
		]);
	});

	it('setImpedimentType atualiza o tipo refletido em ProjectView', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const added = await useCases.addImpediment({ projectId, text: 'Item', tipo: 'outro' });
		if (!added.ok) throw new Error('esperado ok');
		const impedimentId = added.value.impediments[0].id;

		const updated = await useCases.setImpedimentType({ projectId, impedimentId, tipo: 'bloqueio_tecnico' });
		expect(updated.ok).toBe(true);
		if (!updated.ok) return;
		expect(updated.value.impediments[0].tipo).toBe('bloqueio_tecnico');
	});

	it('setImpedimentNextAction define e depois limpa (null) a próxima ação', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const added = await useCases.addImpediment({ projectId, text: 'Item', tipo: 'outro' });
		if (!added.ok) throw new Error('esperado ok');
		const impedimentId = added.value.impediments[0].id;

		const withAction = await useCases.setImpedimentNextAction({
			projectId,
			impedimentId,
			nextAction: 'Solicitar acesso à TI'
		});
		expect(withAction.ok).toBe(true);
		if (!withAction.ok) return;
		expect(withAction.value.impediments[0].nextAction).toBe('Solicitar acesso à TI');

		const cleared = await useCases.setImpedimentNextAction({ projectId, impedimentId, nextAction: null });
		expect(cleared.ok).toBe(true);
		if (!cleared.ok) return;
		expect(cleared.value.impediments[0].nextAction).toBeNull();
	});

	it('resolveImpediment marca resolvido com resolvedAt; reopenImpediment volta a aberto', async () => {
		const { useCases, clock } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		const added = await useCases.addImpediment({ projectId, text: 'Item', tipo: 'outro' });
		if (!added.ok) throw new Error('esperado ok');
		const impedimentId = added.value.impediments[0].id;

		clock.set('2026-01-02T00:00:00.000Z');
		const resolved = await useCases.resolveImpediment({ projectId, impedimentId });
		expect(resolved.ok).toBe(true);
		if (!resolved.ok) return;
		expect(resolved.value.impediments[0]).toEqual({
			id: impedimentId,
			text: 'Item',
			tipo: 'outro',
			nextAction: null,
			status: 'resolvido',
			createdAt: '2026-01-01T00:00:00.000Z',
			resolvedAt: '2026-01-02T00:00:00.000Z'
		});

		clock.set('2026-01-03T00:00:00.000Z');
		const reopened = await useCases.reopenImpediment({ projectId, impedimentId });
		expect(reopened.ok).toBe(true);
		if (!reopened.ok) return;
		expect(reopened.value.impediments[0]).toMatchObject({ status: 'aberto', resolvedAt: null });
	});

	it('impediment_not_found para id inexistente em cada operação', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		expect(await useCases.setImpedimentType({ projectId, impedimentId: 'nao-existe', tipo: 'outro' })).toEqual({
			ok: false,
			error: { kind: 'impediment_not_found' }
		});
		expect(
			await useCases.setImpedimentNextAction({ projectId, impedimentId: 'nao-existe', nextAction: 'x' })
		).toEqual({ ok: false, error: { kind: 'impediment_not_found' } });
		expect(await useCases.resolveImpediment({ projectId, impedimentId: 'nao-existe' })).toEqual({
			ok: false,
			error: { kind: 'impediment_not_found' }
		});
		expect(await useCases.reopenImpediment({ projectId, impedimentId: 'nao-existe' })).toEqual({
			ok: false,
			error: { kind: 'impediment_not_found' }
		});
	});

	it('project_not_found quando o projeto não existe', async () => {
		const { useCases } = setup();
		expect(
			await useCases.addImpediment({ projectId: 'nao-existe', text: 'x', tipo: 'outro' })
		).toEqual({ ok: false, error: { kind: 'project_not_found' } });
	});
});

describe('createProjectUseCases — Validação Externa (ETAPA 3, ExternalAction/Evidence)', () => {
	async function projectWithGroup(clock = '2026-01-01T00:00:00.000Z') {
		const ctx = setup(clock);
		const created = await ctx.useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;
		const withGroup = await ctx.useCases.addAffectedGroup({ projectId, label: 'Operação' });
		if (!withGroup.ok) throw new Error('esperado ok');
		const withImpact = await ctx.useCases.setAffectedGroupImpact({
			projectId,
			groupId: withGroup.value.affectedGroups[0].id,
			impact: 'alto'
		});
		if (!withImpact.ok) throw new Error('esperado ok');
		return { ...ctx, projectId, groupId: withImpact.value.affectedGroups[0].id };
	}

	it('prepareExternalAction cria a ExternalAction, com a preparação derivada do AffectedGroup atual (label e impacto)', async () => {
		const { useCases, projectId, groupId } = await projectWithGroup();

		const result = await useCases.prepareExternalAction({ projectId, affectedGroupId: groupId });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.externalActions).toHaveLength(1);
		const action = result.value.externalActions[0];
		expect(action.affectedGroupId).toBe(groupId);
		expect(action.status).toBe('aberta');
		expect(action.objective).toContain('Operação');
		expect(action.informationToTake).toContain('Operação');
		expect(action.informationToTake).toContain('Impacto: Alto');
		expect(action.questions.length).toBeGreaterThan(0);
	});

	it('prepareExternalAction: affected_group_not_found para grupo inexistente', async () => {
		const { useCases, projectId } = await projectWithGroup();
		expect(await useCases.prepareExternalAction({ projectId, affectedGroupId: 'nao-existe' })).toEqual({
			ok: false,
			error: { kind: 'affected_group_not_found' }
		});
	});

	it('prepareExternalAction: external_action_duplicate_open ao tentar preparar duas vezes para o mesmo grupo', async () => {
		const { useCases, projectId, groupId } = await projectWithGroup();
		const first = await useCases.prepareExternalAction({ projectId, affectedGroupId: groupId });
		expect(first.ok).toBe(true);

		expect(await useCases.prepareExternalAction({ projectId, affectedGroupId: groupId })).toEqual({
			ok: false,
			error: { kind: 'external_action_duplicate_open' }
		});
	});

	it('project_not_found quando o projeto não existe (prepareExternalAction)', async () => {
		const { useCases } = setup();
		expect(await useCases.prepareExternalAction({ projectId: 'nao-existe', affectedGroupId: 'ag-1' })).toEqual({
			ok: false,
			error: { kind: 'project_not_found' }
		});
	});

	it('completeExternalAction cria a Evidence, conclui a ação e o grupo passa a mostrar a evidência', async () => {
		const { useCases, clock, projectId, groupId } = await projectWithGroup();
		const prepared = await useCases.prepareExternalAction({ projectId, affectedGroupId: groupId });
		if (!prepared.ok) throw new Error('esperado ok');
		const actionId = prepared.value.externalActions[0].id;

		clock.set('2026-01-02T00:00:00.000Z');
		const completed = await useCases.completeExternalAction({
			projectId,
			actionId,
			outcome: 'confirmed',
			learning: 'A operação confirma o retrabalho.'
		});
		expect(completed.ok).toBe(true);
		if (!completed.ok) return;

		expect(completed.value.externalActions[0]).toMatchObject({
			id: actionId,
			status: 'concluida'
		});
		expect(completed.value.evidences).toEqual([
			{
				id: expect.any(String),
				externalActionId: actionId,
				affectedGroupId: groupId,
				outcome: 'confirmed',
				learning: 'A operação confirma o retrabalho.',
				createdAt: '2026-01-02T00:00:00.000Z'
			}
		]);
	});

	it('completeExternalAction: evidence_learning_required quando learning é vazio/só espaços', async () => {
		const { useCases, projectId, groupId } = await projectWithGroup();
		const prepared = await useCases.prepareExternalAction({ projectId, affectedGroupId: groupId });
		if (!prepared.ok) throw new Error('esperado ok');
		const actionId = prepared.value.externalActions[0].id;

		expect(
			await useCases.completeExternalAction({ projectId, actionId, outcome: 'confirmed', learning: '   ' })
		).toEqual({ ok: false, error: { kind: 'evidence_learning_required' } });
	});

	it('completeExternalAction: external_action_not_found para id inexistente', async () => {
		const { useCases, projectId } = await projectWithGroup();
		expect(
			await useCases.completeExternalAction({
				projectId,
				actionId: 'nao-existe',
				outcome: 'confirmed',
				learning: 'x'
			})
		).toEqual({ ok: false, error: { kind: 'external_action_not_found' } });
	});

	it('completeExternalAction: external_action_not_open ao concluir duas vezes', async () => {
		const { useCases, projectId, groupId } = await projectWithGroup();
		const prepared = await useCases.prepareExternalAction({ projectId, affectedGroupId: groupId });
		if (!prepared.ok) throw new Error('esperado ok');
		const actionId = prepared.value.externalActions[0].id;

		const first = await useCases.completeExternalAction({ projectId, actionId, outcome: 'confirmed', learning: 'x' });
		expect(first.ok).toBe(true);

		expect(
			await useCases.completeExternalAction({ projectId, actionId, outcome: 'contradicted', learning: 'y' })
		).toEqual({ ok: false, error: { kind: 'external_action_not_open' } });
	});

	it('removeAffectedGroup: affected_group_has_references quando o grupo tem ExternalAction/Evidence relacionada', async () => {
		const { useCases, projectId, groupId } = await projectWithGroup();
		const prepared = await useCases.prepareExternalAction({ projectId, affectedGroupId: groupId });
		if (!prepared.ok) throw new Error('esperado ok');

		expect(await useCases.removeAffectedGroup({ projectId, groupId })).toEqual({
			ok: false,
			error: { kind: 'affected_group_has_references' }
		});
	});
});

describe('createProjectUseCases — "Como é tratado hoje" (Stage 4A do rework)', () => {
	async function newProject(clock = '2026-01-01T00:00:00.000Z') {
		const ctx = setup(clock);
		const created = await ctx.useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		return { ...ctx, projectId: created.value.projectId };
	}

	it('addTreatmentStep cria um passo e reflete em ProjectView.treatmentSteps/treatmentConfirmationIssues', async () => {
		const { useCases, projectId } = await newProject();
		const result = await useCases.addTreatmentStep({ projectId, whatHappens: 'Financeiro confere manualmente' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.treatmentSteps).toEqual([
			{
				id: expect.any(String),
				order: 0,
				whatHappens: 'Financeiro confere manualmente',
				actors: [],
				medium: null,
				frictions: []
			}
		]);
		expect(result.value.currentTreatment).toEqual({ noTreatment: false });
		expect(result.value.treatmentConfirmationIssues).toEqual([]);
	});

	it('setTreatmentStepActors/Medium/toggleTreatmentStepFriction refletem em ProjectView', async () => {
		const { useCases, projectId } = await newProject();
		const added = await useCases.addTreatmentStep({ projectId, whatHappens: 'Passo' });
		if (!added.ok) throw new Error('esperado ok');
		const stepId = added.value.treatmentSteps[0].id;

		const withActors = await useCases.setTreatmentStepActors({ projectId, stepId, actors: ['Financeiro', 'Gestor'] });
		if (!withActors.ok) throw new Error('esperado ok');
		expect(withActors.value.treatmentSteps[0].actors).toEqual(['Financeiro', 'Gestor']);

		const withMedium = await useCases.setTreatmentStepMedium({ projectId, stepId, medium: 'Planilha' });
		if (!withMedium.ok) throw new Error('esperado ok');
		expect(withMedium.value.treatmentSteps[0].medium).toBe('Planilha');

		const withFriction = await useCases.toggleTreatmentStepFriction({ projectId, stepId, friction: 'espera' });
		if (!withFriction.ok) throw new Error('esperado ok');
		expect(withFriction.value.treatmentSteps[0].frictions).toEqual(['espera']);
	});

	it('moveTreatmentStep/removeTreatmentStep reordenam e removem a cadeia', async () => {
		const { useCases, projectId } = await newProject();
		const first = await useCases.addTreatmentStep({ projectId, whatHappens: 'Primeiro' });
		if (!first.ok) throw new Error('esperado ok');
		const second = await useCases.addTreatmentStep({ projectId, whatHappens: 'Segundo' });
		if (!second.ok) throw new Error('esperado ok');
		const [firstId, secondId] = second.value.treatmentSteps.map((s) => s.id);

		const moved = await useCases.moveTreatmentStep({ projectId, stepId: secondId, direction: -1 });
		if (!moved.ok) throw new Error('esperado ok');
		expect(moved.value.treatmentSteps.map((s) => s.id)).toEqual([secondId, firstId]);

		const removed = await useCases.removeTreatmentStep({ projectId, stepId: firstId });
		if (!removed.ok) throw new Error('esperado ok');
		expect(removed.value.treatmentSteps.map((s) => s.id)).toEqual([secondId]);
	});

	it('setTreatmentNoTreatment(true) limpa os passos existentes; confirmTreatment conclui "estado_atual"', async () => {
		const { useCases, projectId } = await newProject();
		const added = await useCases.addTreatmentStep({ projectId, whatHappens: 'Passo' });
		if (!added.ok) throw new Error('esperado ok');

		const none = await useCases.setTreatmentNoTreatment({ projectId, noTreatment: true });
		if (!none.ok) throw new Error('esperado ok');
		expect(none.value.currentTreatment).toEqual({ noTreatment: true });
		expect(none.value.treatmentSteps).toEqual([]);

		const confirmed = await useCases.confirmTreatment({ projectId });
		expect(confirmed.ok).toBe(true);
		if (!confirmed.ok) return;
		expect(confirmed.value.activityStatuses.estado_atual).toBe('concluída');
	});

	it('confirmTreatment: treatment_confirmation_invalid quando vazio e não noTreatment', async () => {
		const { useCases, projectId } = await newProject();
		expect(await useCases.confirmTreatment({ projectId })).toEqual({
			ok: false,
			error: { kind: 'treatment_confirmation_invalid', issues: [{ kind: 'no_steps' }] }
		});
	});

	it('removeTreatmentStep: treatment_step_not_found para id inexistente', async () => {
		const { useCases, projectId } = await newProject();
		expect(await useCases.removeTreatmentStep({ projectId, stepId: 'nao-existe' })).toEqual({
			ok: false,
			error: { kind: 'treatment_step_not_found' }
		});
	});

	it('project_not_found quando o projeto não existe (addTreatmentStep)', async () => {
		const { useCases } = setup();
		expect(await useCases.addTreatmentStep({ projectId: 'nao-existe', whatHappens: 'x' })).toEqual({
			ok: false,
			error: { kind: 'project_not_found' }
		});
	});
});

describe('createProjectUseCases — "Entender as causas" (Stage 4B do rework)', () => {
	async function newProject(clock = '2026-01-01T00:00:00.000Z') {
		const ctx = setup(clock);
		const created = await ctx.useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		return { ...ctx, projectId: created.value.projectId };
	}

	it('addCauseHypothesis cria uma hipótese e reflete em ProjectView.causeHypotheses; nunca bloqueia confirmCauseHypotheses', async () => {
		const { useCases, projectId } = await newProject();
		const result = await useCases.addCauseHypothesis({
			projectId,
			title: 'O aprovador só revisa a planilha uma vez por semana',
			origin: 'Fricção observada'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.causeHypotheses).toEqual([
			{
				id: expect.any(String),
				title: 'O aprovador só revisa a planilha uma vez por semana',
				origin: 'Fricção observada',
				expectedIfTrue: null,
				whatWeakensIt: null,
				evidenceIds: []
			}
		]);
		expect(result.value.causeExploration).toEqual({ stillUnknown: false });
		expect(result.value.causeHypothesisConfirmationIssues).toEqual([]);

		const confirmed = await useCases.confirmCauseHypotheses({ projectId });
		expect(confirmed.ok).toBe(true);
		if (!confirmed.ok) return;
		expect(confirmed.value.activityStatuses.entender_causas).toBe('concluída');
	});

	it('confirmCauseHypotheses conclui mesmo sem nenhuma hipótese registrada (nunca bloqueada)', async () => {
		const { useCases, projectId } = await newProject();
		const confirmed = await useCases.confirmCauseHypotheses({ projectId });
		expect(confirmed.ok).toBe(true);
		if (!confirmed.ok) return;
		expect(confirmed.value.activityStatuses.entender_causas).toBe('concluída');
	});

	it('setCauseHypothesisExpectedIfTrue/WhatWeakensIt refletem em ProjectView', async () => {
		const { useCases, projectId } = await newProject();
		const added = await useCases.addCauseHypothesis({ projectId, title: 'Hipótese' });
		if (!added.ok) throw new Error('esperado ok');
		const hypothesisId = added.value.causeHypotheses[0].id;

		const withExpected = await useCases.setCauseHypothesisExpectedIfTrue({
			projectId,
			hypothesisId,
			value: 'Atrasos concentrados numa janela'
		});
		if (!withExpected.ok) throw new Error('esperado ok');
		expect(withExpected.value.causeHypotheses[0].expectedIfTrue).toBe('Atrasos concentrados numa janela');

		const withWeakens = await useCases.setCauseHypothesisWhatWeakensIt({
			projectId,
			hypothesisId,
			value: 'Atrasos distribuídos ao longo da semana'
		});
		if (!withWeakens.ok) throw new Error('esperado ok');
		expect(withWeakens.value.causeHypotheses[0].whatWeakensIt).toBe('Atrasos distribuídos ao longo da semana');
	});

	it('removeCauseHypothesis remove a hipótese', async () => {
		const { useCases, projectId } = await newProject();
		const added = await useCases.addCauseHypothesis({ projectId, title: 'Hipótese' });
		if (!added.ok) throw new Error('esperado ok');
		const hypothesisId = added.value.causeHypotheses[0].id;

		const removed = await useCases.removeCauseHypothesis({ projectId, hypothesisId });
		if (!removed.ok) throw new Error('esperado ok');
		expect(removed.value.causeHypotheses).toEqual([]);
	});

	it('markCauseExplorationUnknown define stillUnknown; rejeita com hipóteses existentes; undo desliga', async () => {
		const { useCases, projectId } = await newProject();
		const marked = await useCases.markCauseExplorationUnknown({ projectId });
		if (!marked.ok) throw new Error('esperado ok');
		expect(marked.value.causeExploration).toEqual({ stillUnknown: true });

		const undone = await useCases.undoCauseExplorationUnknown({ projectId });
		if (!undone.ok) throw new Error('esperado ok');
		expect(undone.value.causeExploration).toEqual({ stillUnknown: false });

		const added = await useCases.addCauseHypothesis({ projectId, title: 'Hipótese' });
		if (!added.ok) throw new Error('esperado ok');
		expect(await useCases.markCauseExplorationUnknown({ projectId })).toEqual({
			ok: false,
			error: { kind: 'cause_exploration_has_hypotheses' }
		});
	});

	it('addCauseHypothesis: invalid_field_value para título vazio', async () => {
		const { useCases, projectId } = await newProject();
		expect(await useCases.addCauseHypothesis({ projectId, title: '   ' })).toEqual({
			ok: false,
			error: { kind: 'invalid_field_value', fieldDefinitionId: 'title' }
		});
	});

	it('removeCauseHypothesis: cause_hypothesis_not_found para id inexistente', async () => {
		const { useCases, projectId } = await newProject();
		expect(await useCases.removeCauseHypothesis({ projectId, hypothesisId: 'nao-existe' })).toEqual({
			ok: false,
			error: { kind: 'cause_hypothesis_not_found' }
		});
	});

	it('project_not_found quando o projeto não existe (addCauseHypothesis)', async () => {
		const { useCases } = setup();
		expect(await useCases.addCauseHypothesis({ projectId: 'nao-existe', title: 'x' })).toEqual({
			ok: false,
			error: { kind: 'project_not_found' }
		});
	});
});
