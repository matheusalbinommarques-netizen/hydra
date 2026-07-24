// Teste Playwright dedicado da Tela Registros (C3-02). Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados). Não modifica walking-skeleton-journey.journey.ts nem
// map-view.journey.ts.
//
// C3-03 (Pular etapa) não está implementada na interface. Para exercitar
// pendências abertas e resolvidas, este teste prepara o estado diretamente
// no arquivo SQLite do servidor efêmero, contra o schema já documentado em
// server/persistence/migrations/0001_init.sql (fixture de estado, não a
// interface de pular) — nunca via UI, que não existe ainda. Não importa
// módulos de app/src diretamente: eles dependem de transformações do Vite
// (ex.: import ?raw de .sql) que o runtime do Playwright não entende.

import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	buildApp,
	type EphemeralServer,
	getFreePort,
	startServer,
	stopServer,
	waitForServer
} from './helpers/ephemeral-server';

let tmpRoot: string;
let server: EphemeralServer;
let dbPath: string;

test.beforeAll(async () => {
	buildApp();

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
		await page.goto(server.baseUrl + '/');
		await page.getByRole('button', { name: 'Criar novo projeto' }).click();
		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		expect(match).not.toBeNull();
		projectId = match![1];

		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);
		await expect(page.getByRole('heading', { name: 'Registros' })).toBeVisible();
	});

	await test.step('estado vazio inicial: sem respostas e sem pendências', async () => {
		await expect(page.getByText('Nenhuma resposta registrada ainda.')).toBeVisible();
		await expect(page.getByText('Nenhuma pendência aberta.')).toBeVisible();
		await expect(page.getByText('Nenhuma pendência resolvida.')).toBeVisible();
	});

	await test.step('responder Origem pela UI e conferir em Registros', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await page.getByLabel('O que deu origem a este projeto?').selectOption('Um problema');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);

		await expect(page.getByRole('heading', { name: 'Descoberta' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Origem do projeto' })).toBeVisible();
		await expect(page.getByText('O que deu origem a este projeto?')).toBeVisible();
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

	await test.step('Registros reflete a pendência aberta', async () => {
		await page.reload();

		await expect(page.getByText('Público afetado não foi detalhado')).toBeVisible();
		await expect(page.getByText(/Atividade: Público afetado · Status: Aberta/)).toBeVisible();
	});

	await test.step('Registros reflete a pendência resolvida, com data de resolução', async () => {
		await expect(page.getByText('Estado atual não foi detalhado')).toBeVisible();
		await expect(page.getByText(/Atividade: Estado atual · Status: Resolvida · Criada em .+ · Resolvida em/)).toBeVisible();

		// a resposta que resolveu a pendência também aparece em Respostas
		await expect(page.getByRole('heading', { name: 'Estado atual', exact: true })).toBeVisible();
		await expect(page.getByText('Estado atual respondido depois de pulado.')).toBeVisible();
	});

	await test.step('navegação entre Agora, Mapa, Registros e Resumo', async () => {
		await page.getByRole('link', { name: 'Agora' }).click();
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
		const editableControls = page.locator('button, input, textarea, select, [contenteditable="true"], form');
		await expect(editableControls).toHaveCount(0);
	});
});
