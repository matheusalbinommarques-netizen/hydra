// Teste Playwright dedicado da interface de "Pular etapa" (C4-02). Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados) — ver e2e/helpers/ephemeral-server.ts. Não modifica
// walking-skeleton-journey.journey.ts, map-view.journey.ts nem
// records-view.journey.ts.
//
// A verificação de "atividade não pulável não exibe o botão" usa o mesmo
// atalho de fixture já estabelecido em records-view.journey.ts: escrever
// direto no SQLite do servidor efêmero para chegar ao Resumo (única
// atividade com allowsSkip=false) sem percorrer manualmente todo o
// catálogo pela UI — a validação de que allowsSkip governa a visibilidade
// do botão já é responsabilidade da interface, não do domínio.

import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
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

	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-skip-'));
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

test('Pular etapa: modal, retomada e pendências', async ({ page }) => {
	let projectId = '';

	await test.step('criar projeto e chegar a Origem (pulável)', async () => {
		await page.goto(server.baseUrl + '/');
		await page.getByRole('button', { name: 'Criar novo projeto' }).click();
		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		expect(match).not.toBeNull();
		projectId = match![1];

		await expect(page.getByRole('heading', { name: 'Origem do projeto', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toBeVisible();
	});

	await test.step('modal apresenta a consequência correta', async () => {
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		const dialog = page.locator('dialog[open]');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Esta etapa não será concluída agora.')).toBeVisible();
		await expect(
			dialog.getByText('Ajuda o Hydra a calibrar o tom e a profundidade das próximas perguntas.')
		).toBeVisible();
		await expect(dialog.getByText(/Uma pendência será criada/)).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Confirmar' })).toBeVisible();
	});

	await test.step('Escape fecha o modal sem confirmar o skip', async () => {
		const urlBeforeEscape = page.url();

		await page.keyboard.press('Escape');
		await expect(page.locator('dialog[open]')).toHaveCount(0);

		expect(page.url()).toBe(urlBeforeEscape);
		await expect(page.getByRole('heading', { name: 'Origem do projeto', exact: true })).toBeVisible();
		await expect(page.locator('.pendencias')).toHaveCount(0);
	});

	await test.step('cancelar fecha o modal sem alterar nada', async () => {
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await expect(page.locator('dialog[open]')).toBeVisible();

		await page.locator('dialog[open]').getByRole('button', { name: 'Cancelar' }).click();
		await expect(page.locator('dialog[open]')).toHaveCount(0);

		await page.reload();
		await expect(page.getByRole('heading', { name: 'Origem do projeto', exact: true })).toBeVisible();
		await expect(page.locator('.pendencias')).toHaveCount(0);
	});

	await test.step('confirmar pula a etapa: cria pendência e avança a recomendação', async () => {
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();

		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Contexto inicial', exact: true })).toBeVisible();

		await expect(page.getByText('Origem do projeto não foi definida')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Retomar etapa' })).toBeVisible();
	});

	await test.step('Registros reflete a pendência aberta', async () => {
		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);
		await expect(page.getByText(/Atividade: Origem do projeto · Status: Aberta/)).toBeVisible();
	});

	await test.step('Retomar etapa abre a atividade pulada', async () => {
		await page.getByRole('link', { name: 'Agora' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

		await page.getByRole('link', { name: 'Retomar etapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now?activity=origem`);
		await expect(page.getByRole('heading', { name: 'Origem do projeto', exact: true })).toBeVisible();
		await expect(page.getByText('Retomando etapa pulada')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toHaveCount(0);
	});

	await test.step('responder a atividade retomada resolve a pendência e volta ao fluxo canônico', async () => {
		await page.getByLabel('O que deu origem a este projeto?').selectOption('Uma oportunidade');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);
		expect(new URL(page.url()).searchParams.has('activity')).toBe(false);
		await expect(page.getByRole('heading', { name: 'Contexto inicial', exact: true })).toBeVisible();
		await expect(page.locator('.pendencias')).toHaveCount(0);

		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);
		await expect(
			page.getByText(/Atividade: Origem do projeto · Status: Resolvida · Criada em .+ · Resolvida em/)
		).toBeVisible();
	});

	await test.step('atividade não pulável (Resumo) não exibe o botão', async () => {
		const db = new Database(dbPath);
		try {
			for (const activityId of ['contexto', 'problema', 'publico', 'estado_atual', 'resultado']) {
				db.prepare(
					`UPDATE activity_progress SET status = 'concluída'
					 WHERE project_id = ? AND activity_definition_id = ?`
				).run(projectId, activityId);
			}
		} finally {
			db.close();
		}

		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Resumo da descoberta', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toHaveCount(0);
	});
});
