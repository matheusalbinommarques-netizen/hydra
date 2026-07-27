// Teste Playwright dedicado da listagem/reabertura de projetos na página
// inicial (C4-03A). Roda via playwright.journey.config.ts (servidor
// efêmero + banco temporário isolados) — ver e2e/helpers/ephemeral-server.ts.
// Usa dois servidores (A e B) só no passo de importação, pelo mesmo motivo
// de walking-skeleton-journey.journey.ts: importar exige um banco onde o id
// ainda não existe. Não modifica nenhum outro teste de jornada existente.

import { expect, test } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
let serverA: EphemeralServer;
let serverB: EphemeralServer;

test.beforeAll(async () => {
	buildApp();

	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-project-list-'));
	const [portA, portB] = await Promise.all([getFreePort(), getFreePort()]);
	serverA = startServer(portA, path.join(tmpRoot, 'a', 'hydra.sqlite'));
	serverB = startServer(portB, path.join(tmpRoot, 'b', 'hydra.sqlite'));
	await Promise.all([waitForServer(serverA), waitForServer(serverB)]);
});

test.afterAll(async () => {
	try {
		await Promise.all([stopServer(serverA), stopServer(serverB)]);
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
});

test('Página inicial: listar e reabrir projetos existentes', async ({ page }) => {
	let firstProjectId = '';
	let secondProjectId = '';

	await test.step('banco vazio mostra estado vazio', async () => {
		await page.goto(serverA.baseUrl + '/');
		await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
		await expect(page.getByText('Nenhum projeto ainda. Crie o primeiro acima.')).toBeVisible();
	});

	await test.step('criar projeto sem nome: aparece na página inicial como "Projeto sem nome"', async () => {
		await page.getByRole('button', { name: 'Criar novo projeto' }).click();
		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		expect(match).not.toBeNull();
		firstProjectId = match![1];

		await page.goto(serverA.baseUrl + '/');
		await expect(page.getByRole('link', { name: 'Projeto sem nome' })).toBeVisible();
	});

	await test.step('criar um segundo projeto com nome: os dois aparecem em ordem determinística', async () => {
		await page.getByRole('button', { name: 'Criar novo projeto' }).click();
		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		expect(match).not.toBeNull();
		secondProjectId = match![1];

		await page.getByLabel('O que deu origem a este projeto?').selectOption('Uma ideia de produto');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		// "Contexto inicial" é decomposta campo a campo nesta rodada — um
		// submit por campo.
		await page.getByLabel('Nome provisório do projeto').fill('Level Me Up');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		await page.getByLabel('Breve descrição').fill('Refatoração e evolução da baseline.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		await page.getByLabel('Trabalho individual ou em equipe?').selectOption('Individual');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		await page
			.getByLabel('Qual seu nível de experiência com gestão de projetos?')
			.selectOption('Experiente');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		await page.getByLabel('Qual o estágio atual?').selectOption('Já em execução');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page.goto(serverA.baseUrl + '/');
		const links = page.locator('.projects li a');
		await expect(links).toHaveCount(2);
		// mais recente primeiro: o segundo projeto (nomeado) vem antes do
		// primeiro (sem nome).
		await expect(links.nth(0)).toHaveText('Level Me Up');
		await expect(links.nth(1)).toHaveText('Projeto sem nome');
	});

	await test.step('clicar em um projeto da lista abre /projects/<id>/now', async () => {
		await page.getByRole('link', { name: 'Level Me Up' }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${secondProjectId}/now`);
		await expect(
			page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })
		).toBeVisible();
	});

	await test.step('link "Projetos" no workspace retorna para a página inicial', async () => {
		await page.getByRole('link', { name: 'Projetos' }).click();
		await page.waitForURL(serverA.baseUrl + '/');
		await expect(page.getByRole('heading', { name: 'Seus projetos' })).toBeVisible();
		await expect(page.locator('.projects li a')).toHaveCount(2);
	});

	await test.step('recarregar a página preserva a lista', async () => {
		await page.reload();
		await expect(page.locator('.projects li a')).toHaveCount(2);
	});

	await test.step('acesso direto pela URL continua funcionando', async () => {
		await page.goto(`${serverA.baseUrl}/projects/${firstProjectId}/now`);
		await expect(page.getByRole('heading', { name: 'Origem do projeto', exact: true })).toBeVisible();
	});

	await test.step('importar projeto em cenário válido continua funcionando e aparece na lista do destino', async () => {
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Exportar' }).click();
		const download = await downloadPromise;
		const downloadedFilePath = path.join(tmpRoot, 'export.json');
		await download.saveAs(downloadedFilePath);
		expect(readFileSync(downloadedFilePath, 'utf-8').length).toBeGreaterThan(0);

		await page.goto(serverB.baseUrl + '/');
		await expect(page.getByText('Nenhum projeto ainda. Crie o primeiro acima.')).toBeVisible();

		await page.getByLabel('Importar projeto (.json)').setInputFiles(downloadedFilePath);
		await page.getByRole('button', { name: 'Importar', exact: true }).click();
		await page.waitForURL(`${serverB.baseUrl}/projects/${firstProjectId}/now`);

		await page.goto(serverB.baseUrl + '/');
		await expect(page.getByRole('link', { name: 'Projeto sem nome' })).toBeVisible();
	});
});
