// Teste Playwright dedicado de Acompanhamento — vertical 2, fatia "Gestão
// de impedimentos". Impediment não é gated por nenhuma
// atividade do catálogo, então este journey não precisa percorrer a
// Descoberta: cria o projeto e vai direto a /tracking. Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados) — ver e2e/helpers/ephemeral-server.ts.

import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
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

test.beforeAll(async () => {
	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-tracking-'));
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

test('Acompanhamento: adicionar, classificar tipo, definir próxima ação, resolver e reabrir um impedimento', async ({
	page
}) => {
	let projectId = '';

	await test.step('criar projeto e ir para /tracking', async () => {
		projectId = await createProject(page, server.baseUrl);

		await page.getByRole('link', { name: 'Acompanhamento' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/tracking`);
		await expect(page.getByRole('heading', { name: 'Acompanhamento do projeto' })).toBeVisible();
		await expect(page.getByText('Nenhum impedimento aberto.')).toBeVisible();
		await expect(page.getByText('Nenhum impedimento ou pendência em aberto.')).toBeVisible();
	});

	await test.step('adicionar um impedimento com tipo', async () => {
		await page.getByLabel('Descrição').fill('Falta acesso ao ambiente de testes');
		await page.getByLabel('Tipo').selectOption('falta_de_recurso');
		await page.getByRole('button', { name: 'Adicionar' }).click();

		await expect(
			page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' })
		).toBeVisible();
		await expect(page.getByLabel('Atenções').getByText('Falta acesso ao ambiente de testes')).toBeVisible();
	});

	await test.step('editar tipo e próxima ação a partir do estado de leitura', async () => {
		const row = page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' });
		await row.getByRole('button', { name: 'Editar' }).click();

		await row.getByLabel('Tipo').selectOption('bloqueio_tecnico');
		await page.waitForLoadState('networkidle');
		await expect(row.getByLabel('Tipo')).toHaveValue('bloqueio_tecnico');

		const nextActionInput = row.getByLabel('Próxima ação');
		await nextActionInput.fill('Solicitar acesso à TI');
		await nextActionInput.blur();
		await page.waitForLoadState('networkidle');
		await expect(row.getByLabel('Próxima ação')).toHaveValue('Solicitar acesso à TI');

		await row.getByRole('button', { name: 'Concluir edição' }).click();
		await expect(row.getByText('Próxima ação: Solicitar acesso à TI')).toBeVisible();
	});

	await test.step('resolver o impedimento: some da lista aberta, aparece em Resolvidos', async () => {
		const row = page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' });
		await row.getByRole('button', { name: 'Resolver' }).click();

		await expect(page.getByText('Nenhum impedimento aberto.')).toBeVisible();

		await page.getByRole('button', { name: 'Resolvidos (1)' }).click();
		const resolvedRow = page.locator('.impediment-row.resolved', { hasText: 'Falta acesso ao ambiente de testes' });
		await expect(resolvedRow).toBeVisible();
		await expect(resolvedRow.getByText('Próxima ação registrada: Solicitar acesso à TI')).toBeVisible();
	});

	await test.step('reabrir o impedimento: volta para a lista aberta', async () => {
		const resolvedRow = page.locator('.impediment-row.resolved', { hasText: 'Falta acesso ao ambiente de testes' });
		await resolvedRow.getByRole('button', { name: 'Reabrir' }).click();

		await expect(page.getByRole('button', { name: 'Resolvidos (0)' })).toBeVisible();
		await expect(page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' })).toBeVisible();
	});

	await test.step('/now mostra a contagem neutra de impedimentos abertos, com link para Acompanhamento', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByText('1 impedimento aberto')).toBeVisible();
		await page.getByRole('link', { name: 'ver em Acompanhamento' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/tracking`);
	});

	await test.step('sem impedimentos abertos, /now não mostra a contagem', async () => {
		const row = page.locator('.impediment-row', { hasText: 'Falta acesso ao ambiente de testes' });
		await row.getByRole('button', { name: 'Resolver' }).click();
		await expect(page.getByText('Nenhum impedimento aberto.')).toBeVisible();

		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByText(/impedimento[s]? abert[oa]/)).toHaveCount(0);
	});
});
