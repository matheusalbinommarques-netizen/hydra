// Teste Playwright dedicado do Cockpit — vertical 2, fatia "Impedimentos".
// Impediment não é gated por nenhuma atividade do catálogo, então este
// journey não precisa percorrer a Descoberta: cria o projeto e vai direto a
// /cockpit. Roda via playwright.journey.config.ts (servidor efêmero + banco
// temporário isolados) — ver e2e/helpers/ephemeral-server.ts.

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

test.beforeAll(async () => {
	buildApp();

	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-cockpit-'));
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

test('Cockpit: adicionar, classificar tipo, definir próxima ação, resolver e reabrir um impedimento', async ({
	page
}) => {
	let projectId = '';

	await test.step('criar projeto e ir para /cockpit', async () => {
		await page.goto(server.baseUrl + '/');
		await page.getByRole('button', { name: 'Criar novo projeto' }).click();
		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		if (!match) throw new Error('projectId não encontrado na URL.');
		projectId = match[1];

		await page.getByRole('link', { name: 'Cockpit' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/cockpit`);
		await expect(page.getByRole('heading', { name: 'Impedimentos', exact: true })).toBeVisible();
		await expect(page.getByText('Nenhum impedimento aberto.')).toBeVisible();
	});

	await test.step('adicionar um impedimento com tipo', async () => {
		await page.getByLabel('Descrição').fill('Falta acesso ao ambiente de testes');
		await page.getByLabel('Tipo').selectOption('falta_de_recurso');
		await page.getByRole('button', { name: 'Adicionar' }).click();

		await expect(page.getByText('Abertos (1)')).toBeVisible();
		await expect(page.getByText('Falta acesso ao ambiente de testes')).toBeVisible();
	});

	await test.step('reclassificar o tipo direto na linha do item', async () => {
		const row = page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' });
		await row.getByLabel('Tipo').selectOption('bloqueio_tecnico');
		await page.waitForLoadState('networkidle');
		await expect(row.getByLabel('Tipo')).toHaveValue('bloqueio_tecnico');
	});

	await test.step('definir a próxima ação', async () => {
		const row = page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' });
		const nextActionInput = row.getByLabel('Próxima ação');
		await nextActionInput.fill('Solicitar acesso à TI');
		await nextActionInput.blur();
		await page.waitForLoadState('networkidle');
		await expect(row.getByLabel('Próxima ação')).toHaveValue('Solicitar acesso à TI');
	});

	await test.step('resolver o impedimento: sai de Abertos, aparece em Resolvidos', async () => {
		const row = page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' });
		await row.getByRole('button', { name: 'Resolver' }).click();

		await expect(page.getByText('Abertos (0)')).toBeVisible();
		await expect(page.getByText('Nenhum impedimento aberto.')).toBeVisible();

		await page.getByText('Resolvidos (1)').click();
		const resolvedRow = page.locator('.impediment-row.resolved', { hasText: 'Falta acesso ao ambiente de testes' });
		await expect(resolvedRow).toBeVisible();
		await expect(resolvedRow.getByText('Próxima ação registrada: Solicitar acesso à TI')).toBeVisible();
	});

	await test.step('reabrir o impedimento: volta para Abertos', async () => {
		const resolvedRow = page.locator('.impediment-row.resolved', { hasText: 'Falta acesso ao ambiente de testes' });
		await resolvedRow.getByRole('button', { name: 'Reabrir' }).click();

		await expect(page.getByText('Abertos (1)')).toBeVisible();
		await expect(page.getByText('Resolvidos (0)')).toBeVisible();
	});

	await test.step('/now mostra a contagem neutra de impedimentos abertos, com link para /cockpit', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByText('1 impedimento aberto')).toBeVisible();
		await page.getByRole('link', { name: 'ver no Cockpit' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/cockpit`);
	});

	await test.step('sem impedimentos abertos, /now não mostra a contagem', async () => {
		const row = page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' });
		await row.getByRole('button', { name: 'Resolver' }).click();
		await expect(page.getByText('Abertos (0)')).toBeVisible();

		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByText(/impedimento[s]? abert[oa]/)).toHaveCount(0);
	});
});
