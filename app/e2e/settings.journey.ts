// Teste Playwright dedicado de Configurações do projeto (D030, subetapa 7.6
// do roadmap). Roda via playwright.journey.config.ts (servidor efêmero +
// banco temporário isolados) — ver e2e/helpers/ephemeral-server.ts. Não
// duplica a cobertura já existente em app/src/lib/domain/transitions.spec.ts
// para a invalidação do Resumo ao renomear o projeto — aqui só a jornada da
// própria tela de Configurações.

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
import { createProject } from './helpers/create-project';

let tmpRoot: string;
let server: EphemeralServer;

test.beforeAll(async () => {
	buildApp();

	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-settings-'));
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

test('Configurações do projeto: navegação, edição, salvar, cancelar e erro de validação', async ({ page }) => {
	let projectId = '';

	await test.step('criar projeto e navegar pelo shell desktop até Configurações', async () => {
		projectId = await createProject(page, server.baseUrl);

		await page.getByRole('link', { name: 'Configurações' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/settings`);
		await expect(page.getByRole('heading', { name: 'Configurações do projeto', level: 1 })).toBeVisible();
	});

	await test.step('estado inicial: nome carregado, Salvar e Cancelar desabilitados, sem mensagem', async () => {
		const nameField = page.getByLabel('Nome do projeto');
		await expect(nameField).toHaveValue('');
		await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
		await expect(page.getByText('Alterações não salvas.')).toHaveCount(0);
		await expect(page.getByText('Alterações salvas.')).toHaveCount(0);
	});

	await test.step('shell mobile: Configurações é o último destino do menu', async () => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);

		await page.getByRole('button', { name: 'Menu' }).click();
		const mobileNav = page.getByRole('navigation', { name: 'Navegação do projeto' });
		const items = mobileNav.getByRole('link');
		await expect(items.last()).toHaveText('Configurações');

		await items.last().click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/settings`);

		await page.setViewportSize({ width: 1280, height: 800 });
	});

	await test.step('editar o nome habilita Salvar e Cancelar e mostra alteração pendente', async () => {
		await page.getByLabel('Nome do projeto').fill('Produção diária unificada');
		await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
		await expect(page.getByText('Alterações não salvas.')).toBeVisible();
	});

	await test.step('Cancelar restaura o nome carregado sem chamar a action de salvar', async () => {
		const nameField = page.getByLabel('Nome do projeto');

		// Descarta a edição pendente deixada pelo passo anterior, voltando ao
		// nome realmente persistido (ainda vazio — nenhum salvamento ocorreu),
		// para então capturar essa referência e provar o ciclo editar → cancelar.
		await page.getByRole('button', { name: 'Cancelar' }).click();
		const persisted = await nameField.inputValue();

		let saveRequested = false;
		page.on('request', (req) => {
			if (req.url().includes('?/save')) saveRequested = true;
		});

		await nameField.fill('Nome que será descartado');
		await page.getByRole('button', { name: 'Cancelar' }).click();

		await expect(nameField).toHaveValue(persisted);
		await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
		expect(saveRequested).toBe(false);
	});

	await test.step('nome vazio: mensagem de validação, sem persistir', async () => {
		const nameField = page.getByLabel('Nome do projeto');
		const originalValue = await nameField.inputValue();

		await nameField.fill('   ');
		await page.getByRole('button', { name: 'Salvar alterações' }).click();

		await expect(page.getByRole('alert')).toHaveText('Informe um nome para o projeto.');
		await expect(nameField).toHaveAttribute('aria-invalid', 'true');

		await page.reload();
		await expect(page.getByLabel('Nome do projeto')).toHaveValue(originalValue);
	});

	await test.step('nome válido: salva, mostra confirmação e reflete no shell', async () => {
		const nameField = page.getByLabel('Nome do projeto');
		await nameField.fill('Produção diária unificada — v2');
		await page.getByRole('button', { name: 'Salvar alterações' }).click();

		await expect(page.getByText('Alterações salvas.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled();
		await expect(page.locator('.eyebrow').first()).toHaveText('Produção diária unificada — v2');
	});

	await test.step('nova edição some com a mensagem de sucesso; Cancelar volta ao nome recém-salvo', async () => {
		const nameField = page.getByLabel('Nome do projeto');

		await nameField.fill('Rascunho descartável');
		await expect(page.getByText('Alterações salvas.')).toHaveCount(0);
		await expect(page.getByText('Alterações não salvas.')).toBeVisible();

		await page.getByRole('button', { name: 'Cancelar' }).click();
		await expect(nameField).toHaveValue('Produção diária unificada — v2');
		await expect(page.getByText('Alterações não salvas.')).toHaveCount(0);
		await expect(page.getByText('Alterações salvas.')).toHaveCount(0);
	});

	await test.step('link para Exportar sempre visível e correto', async () => {
		const exportLink = page.getByRole('link', { name: 'Exportar projeto →' });
		await expect(exportLink).toBeVisible();
		await expect(exportLink).toHaveAttribute('href', `/projects/${projectId}/export`);

		await page.getByLabel('Nome do projeto').fill('Nome alterado, ainda sem salvar');
		await expect(exportLink).toBeVisible();
		await page.getByRole('button', { name: 'Cancelar' }).click();
	});

	await test.step('mobile ~390px sem overflow horizontal', async () => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.reload();

		const hasHorizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth
		);
		expect(hasHorizontalOverflow).toBe(false);
	});
});
