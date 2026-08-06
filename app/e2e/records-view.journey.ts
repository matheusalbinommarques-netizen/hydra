// Teste Playwright dedicado da Tela Registros (C3-02). Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados). Não modifica walking-skeleton-journey.journey.ts nem
// map-view.journey.ts.
//
// A interface de "Pular etapa" existe (C4-02, ver skip-activity.journey.ts,
// que a exercita ponta a ponta). Este teste, porém, isola deliberadamente a
// Tela Registros: prepara pendências abertas e resolvidas escrevendo direto
// no arquivo SQLite do servidor efêmero, contra o schema já documentado em
// server/persistence/migrations/0001_init.sql, em vez de reconstruir esse
// estado pulando/respondendo atividades pela UI. Não importa módulos de
// app/src diretamente: eles dependem de transformações do Vite (ex.: import
// ?raw de .sql) que o runtime do Playwright não entende.

import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	type EphemeralServer,
	getFreePort,
	startServer,
	stopServer,
	waitForServer
} from './helpers/ephemeral-server';
import { createProject } from './helpers/create-project';

let tmpRoot: string;
let server: EphemeralServer;
let dbPath: string;

test.beforeAll(async () => {
	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-records-'));
	dbPath = path.join(tmpRoot, 'hydra.sqlite');
	const port = await getFreePort();
	server = startServer(port, dbPath);
	await waitForServer(server);
});

test.afterAll(async () => {
	try {
		await stopServer(server);
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
});

test('Registros: respostas e histórico de pendências', async ({ page }) => {
	let projectId = '';

	await test.step('criar projeto e navegar a Registros pela navegação', async () => {
		projectId = await createProject(page, server.baseUrl);

		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);
		await expect(page.getByRole('heading', { name: 'Registros' })).toBeVisible();
	});

	await test.step('estado vazio inicial: sem respostas e sem pendências resolvidas', async () => {
		await expect(page.getByText('Nenhuma resposta registrada ainda')).toBeVisible();
		await expect(page.getByText('Nenhuma pendência resolvida ainda.')).toBeVisible();
	});

	await test.step('responder Origem pela UI e conferir em Registros, com link de revisão (atividade concluída da Descoberta)', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await page.getByLabel('O que deu origem a este projeto?').selectOption('Um problema');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);

		await expect(page.getByRole('heading', { name: 'Descoberta' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Origem do projeto' })).toBeVisible();
		await expect(page.getByText('O que deu origem a este projeto?')).toBeVisible();
		await expect(page.getByText('Um problema')).toBeVisible();
		await expect(page.getByRole('link', { name: /Revisar Origem do projeto na atividade/ })).toBeVisible();

		// Índice mostra a fase com a contagem real de respostas.
		await expect(page.getByRole('link', { name: 'Descoberta 1' })).toBeVisible();
	});

	await test.step('"Revisar na atividade" abre com origem própria de Registros — não a do Resumo', async () => {
		await page.getByRole('link', { name: /Revisar Origem do projeto na atividade/ }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now?activity=origem&from=records`);

		await expect(page.getByText('Revisando a partir de Registros')).toBeVisible();
		await expect(page.getByText('Editando a partir do Resumo da descoberta')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Salvar e voltar a Registros' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Salvar e voltar ao Resumo' })).toHaveCount(0);

		// "Pular etapa" não aparece em nenhum modo de revisão.
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Salvar e voltar a Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);

		// a resposta continua visível — o salvamento não alterou o valor
		await expect(page.getByRole('heading', { name: 'Origem do projeto' })).toBeVisible();
		await expect(page.getByText('Um problema')).toBeVisible();
	});

	await test.step('preparar uma pendência aberta e uma resolvida diretamente no banco (sem UI de pular)', async () => {
		const db = new Database(dbPath);
		try {
			const now = new Date().toISOString();
			const earlier = new Date(Date.now() - 60_000).toISOString();

			// "Público afetado" fica pulada — pendência aberta.
			db.prepare(
				`UPDATE activity_progress SET status = 'pulada'
				 WHERE project_id = ? AND activity_definition_id = 'publico'`
			).run(projectId);
			db.prepare(
				`INSERT INTO pending_item (id, project_id, activity_definition_id, status, created_at, resolved_at)
				 VALUES (?, ?, 'publico', 'aberta', ?, NULL)`
			).run(randomUUID(), projectId, now);

			// "Estado atual" foi pulada e depois respondida — pendência resolvida.
			db.prepare(
				`UPDATE activity_progress SET status = 'concluída'
				 WHERE project_id = ? AND activity_definition_id = 'estado_atual'`
			).run(projectId);
			db.prepare(
				`INSERT INTO answer
				   (project_id, activity_definition_id, field_definition_id, value, created_at, updated_at)
				 VALUES (?, 'estado_atual', 'estado_atual_detail', ?, ?, ?)`
			).run(projectId, 'Estado atual respondido depois de pulado.', earlier, now);
			db.prepare(
				`INSERT INTO pending_item (id, project_id, activity_definition_id, status, created_at, resolved_at)
				 VALUES (?, ?, 'estado_atual', 'resolvida', ?, ?)`
			).run(randomUUID(), projectId, earlier, now);
		} finally {
			db.close();
		}
	});

	await test.step('Registros não mostra a pendência aberta — ela pertence a Acompanhamento e a Agora', async () => {
		await page.reload();

		await expect(page.getByText('Público afetado não foi detalhado')).toHaveCount(0);
	});

	await test.step('Registros reflete a pendência resolvida, sem data (dado não exibido nesta projeção)', async () => {
		await expect(page.getByText('Estado atual não foi detalhado')).toBeVisible();
		await expect(page.getByText('Atividade: Estado atual · Resolvida')).toBeVisible();

		// a resposta que resolveu a pendência também aparece em Respostas
		await expect(page.getByRole('heading', { name: 'Estado atual', exact: true })).toBeVisible();
		await expect(page.getByText('Estado atual respondido depois de pulado.')).toBeVisible();
	});

	await test.step('navegação entre Agora, Mapa, Registros e Resumo', async () => {
		// exact:true — Registros tem seu próprio link "Continuar em Agora →"
		// (bloco Continuidade), que também casaria com um match por substring.
		await page.getByRole('link', { name: 'Agora', exact: true }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/map`);

		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);
		await expect(page.getByRole('heading', { name: 'Registros' })).toBeVisible();

		await page.getByRole('link', { name: 'Resumo' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
	});

	await test.step('a Tela Registros não tem nenhum controle de edição', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/records`);
		// Escopo em <main>: o cabeçalho/navegação compartilhados do workspace têm
		// seu próprio botão (menu mobile), alheio ao conteúdo de Registros.
		const editableControls = page
			.locator('main')
			.locator('button, input, textarea, select, [contenteditable="true"], form');
		await expect(editableControls).toHaveCount(0);
	});
});

test('Registros: quarta combinação de estados — sem respostas, com pendência resolvida', async ({ page }) => {
	// No domínio real, resolver uma pendência sempre implica responder a
	// atividade correspondente (answerActivity → resolvePendingItem, ver
	// domain/transitions.ts) — essa combinação não é alcançável pela jornada
	// normal. Reaproveita a mesma técnica de fixture direta no SQLite já usada
	// acima, num projeto novo e sem nenhuma resposta, só para validar que a
	// tela se comporta corretamente mesmo nesse estado (contrato defensivo,
	// não um caminho real de uso).
	const projectId = await createProject(page, server.baseUrl);

	const db = new Database(dbPath);
	try {
		db.prepare(
			`INSERT INTO pending_item (id, project_id, activity_definition_id, status, created_at, resolved_at)
			 VALUES (?, ?, 'publico', 'resolvida', ?, ?)`
		).run(randomUUID(), projectId, new Date(Date.now() - 60_000).toISOString(), new Date().toISOString());
	} finally {
		db.close();
	}

	await page.goto(`${server.baseUrl}/projects/${projectId}/records`);

	// índice ausente e estado vazio de respostas presente
	await expect(page.getByRole('navigation', { name: 'Índice de fases' })).toHaveCount(0);
	await expect(page.getByText('Nenhuma resposta registrada ainda')).toBeVisible();
	await expect(
		page.getByText('Conforme as fases forem respondidas em Agora, seus registros passarão a aparecer aqui.')
	).toBeVisible();

	// pendência resolvida listada
	await expect(page.getByText('Público afetado não foi detalhado')).toBeVisible();
	await expect(page.getByText('Atividade: Público afetado · Resolvida')).toBeVisible();

	// Continuidade presente
	await expect(page.getByRole('heading', { name: 'Registros' })).toBeVisible();
	await expect(page.getByText('Continuidade')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Continuar em Agora →' })).toBeVisible();
});
