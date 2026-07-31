import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodeMultiSelectValue } from '$lib/domain';
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

function setup(clockValue = '2026-01-01T00:00:00.000Z') {
	const repo = memoryRepo();
	const clock = fakeClock(clockValue);
	const idGenerator = fakeIdGenerator('id');
	const useCases = createProjectUseCases({ repository: repo, catalog, clock, idGenerator });
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
		const { useCases, repo } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		const result = await useCases.answerActivity({
			projectId: created.value.projectId,
			activityDefinitionId: 'contexto',
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
			activityDefinitionId: 'contexto',
			values: {
				nome_provisorio: 'Portal',
				breve_descricao: 'x',
				modo_trabalho: 'Individual',
				nivel_experiencia: 'Iniciante',
				estagio_atual: 'Ideia inicial'
			}
		});
		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'problema',
			values: { situacao: 'x', sinais_situacao: encodeMultiSelectValue(['too_many_steps']) }
		});
		await useCases.answerActivity({ projectId, activityDefinitionId: 'publico', values: { publico_detail: 'x' } });
		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'estado_atual',
			values: { estado_atual_detail: 'x' }
		});
		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'resultado',
			values: { mudanca: 'x', beneficiario: 'y', percepcao: 'z' }
		});
		const confirmed = await useCases.confirmSummary({ projectId });
		if (!confirmed.ok) throw new Error('esperado ok');
		expect(confirmed.value.activityStatuses.resumo).toBe('concluída');

		clock.set('2026-01-02T00:00:00.000Z');
		const edited = await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'publico',
			values: { publico_detail: 'y' }
		});
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

		const result = await useCases.listRecentProjects();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual([
			{
				projectId: created.value.projectId,
				projectName: null,
				createdAt: expect.any(String),
				projectStatus: 'rascunho'
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

	it('sinal → sugestão → aceite → ScopeItem: usar a sugestão a remove da lista; excluir o item a traz de volta', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');
		const projectId = created.value.projectId;

		await useCases.answerActivity({
			projectId,
			activityDefinitionId: 'problema',
			values: { situacao: 'x', sinais_situacao: encodeMultiSelectValue(['duplicated_information']) }
		});

		const withSuggestion = await useCases.loadProjectView(projectId);
		if (!withSuggestion.ok) throw new Error('esperado ok');
		expect(withSuggestion.value.scopeSuggestions).toEqual([
			{
				id: 'reuse_existing_information',
				title: 'Reaproveitar informações já registradas',
				reason: 'Sugerido porque você indicou informação duplicada.'
			}
		]);

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
		expect(afterRemoval.value.scopeSuggestions).toEqual([
			{
				id: 'reuse_existing_information',
				title: 'Reaproveitar informações já registradas',
				reason: 'Sugerido porque você indicou informação duplicada.'
			}
		]);
	});
});

describe('createProjectUseCases — nenhuma projeção do motor é persistida; ProjectView não expõe ProjectState bruto', () => {
	it('o registro persistido contém só os 7 tipos de domínio', async () => {
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
			['project', 'activityProgress', 'answers', 'pendingItems', 'scopeItems', 'scopeVersion', 'impediments'].sort()
		);
	});

	it('ProjectView contém só os 19 campos do contrato, nunca ProjectState bruto', async () => {
		const { useCases } = setup();
		const created = await useCases.createProject();
		if (!created.ok) throw new Error('esperado ok');

		expect(Object.keys(created.value).sort()).toEqual(
			[
				'projectId',
				'projectName',
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
				'impediments'
			].sort()
		);
		expect(created.value).not.toHaveProperty('project');
		expect(created.value).not.toHaveProperty('activityProgress');
		expect(created.value).not.toHaveProperty('pendingItems');
	});
});

describe('createProjectUseCases — impedimentos (Cockpit)', () => {
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
