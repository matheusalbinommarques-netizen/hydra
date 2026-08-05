// Teste Playwright dedicado de Exportar projeto (D031, subetapa 7.6 do
// roadmap). Roda via playwright.journey.config.ts (servidor efêmero + banco
// temporário isolados) — ver e2e/helpers/ephemeral-server.ts. Cobre a nova
// superfície `/export` (página) e `/export/download` (endpoint de download),
// além da preservação do handler legado em `/export` para requisições não
// HTML (negociação de conteúdo do SvelteKit: Accept: text/html renderiza a
// página, qualquer outro Accept cai no +server.ts).

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
import { createProject } from './helpers/create-project';

let tmpRoot: string;
let server: EphemeralServer;

test.beforeAll(async () => {
	buildApp();

	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-export-'));
	const port = await getFreePort();
	server = startServer(port, path.join(tmpRoot, 'hydra.sqlite'));
	await waitForServer(server);
});

test.afterAll(async () => {
	try {
		await stopServer(server);
	} finally {
		rmSync(tmpRoot, { recursive: true, force: true });
	}
});

test('Exportar projeto: navegação, conteúdo, download e compatibilidade do handler legado', async ({
	page
}) => {
	let projectId = '';
	const expectedFilename = () => `hydra-${projectId}.json`;

	await test.step('criar projeto e navegar pelo shell desktop até Exportar', async () => {
		projectId = await createProject(page, server.baseUrl);

		await page.getByRole('link', { name: 'Exportar' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/export`);
	});

	await test.step('título, descrição e ação principal', async () => {
		await expect(page.getByRole('heading', { name: 'Exportar projeto', level: 1 })).toBeVisible();
		await expect(
			page.getByText(
				'Os dados deste projeto serão baixados como um arquivo JSON, com tudo o que foi registrado até agora.'
			)
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Baixar exportação' })).toBeVisible();
		await expect(page.getByText(expectedFilename())).toBeVisible();
	});

	await test.step('Exportar recebe aria-current="page" no shell', async () => {
		await expect(page.getByRole('link', { name: 'Exportar' })).toHaveAttribute(
			'aria-current',
			'page'
		);
	});

	await test.step('link "Exportar projeto →" em Configurações chega à mesma página', async () => {
		await page.getByRole('link', { name: 'Configurações' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/settings`);

		await page.getByRole('link', { name: 'Exportar projeto →' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/export`);
		await expect(page.getByRole('heading', { name: 'Exportar projeto', level: 1 })).toBeVisible();
	});

	let downloadedJson: unknown;

	await test.step('clicar em "Baixar exportação" baixa o arquivo com o nome real', async () => {
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Baixar exportação' }).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe(expectedFilename());

		const downloadedPath = path.join(tmpRoot, 'export-via-download-endpoint.json');
		await download.saveAs(downloadedPath);
		downloadedJson = JSON.parse(readFileSync(downloadedPath, 'utf-8'));
	});

	await test.step('handler antigo em /export continua funcionando para requisição não HTML', async () => {
		const response = await page.request.get(`${server.baseUrl}/projects/${projectId}/export`);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/json');
		expect(response.headers()['content-disposition']).toBe(
			`attachment; filename="${expectedFilename()}"`
		);

		const legacyJson = await response.json();
		expect(legacyJson).toEqual(downloadedJson);
	});

	await test.step('mobile ~390px sem overflow horizontal', async () => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();

		await expect(page.getByRole('heading', { name: 'Exportar projeto', level: 1 })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Baixar exportação' })).toBeVisible();

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(hasHorizontalOverflow).toBe(false);

		await page.setViewportSize({ width: 1280, height: 800 });
	});
});
