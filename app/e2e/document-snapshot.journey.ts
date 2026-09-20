// Jornada ponta a ponta de S15 ("Artefatos e snapshots", D076/D077) —
// /document vivo → captura explícita (modal) → Snapshot v1 persistido →
// projeto vivo muda → snapshot permanece igual → abrir Snapshot vN
// (leitura read-only, não modal) → voltar ao Atual. Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário).

import { expect, test, type Page } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('document-snapshot');

async function noHorizontalOverflow(page: Page) {
	const overflowsX = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(overflowsX).toBe(false);
}

async function captureSnapshot(page: Page) {
	await page.getByRole('button', { name: 'Capturar snapshot' }).click();
	const dialog = page.locator('dialog[open]');
	await expect(dialog.getByRole('heading', { name: 'Capturar snapshot do Documento?' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Confirmar' }).click();
	await expect(page.locator('dialog[open]')).toHaveCount(0);
}

test('Documento: capturar, projeto muda, snapshot permanece, abrir e voltar ao Atual (desktop e mobile)', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));

	let projectId = '';
	const documentUrl = () => `${server.baseUrl}/projects/${projectId}/document`;

	await test.step('sem snapshots: Atual, empty state e nenhum controle fora do A', async () => {
		projectId = await createProject(page, server.baseUrl);
		await page.goto(documentUrl());
		const region = page.getByRole('complementary', { name: 'Versões' });
		await expect(region).toBeVisible();
		await expect(region.getByText('Capture uma versão deste Documento')).toBeVisible();
		await expect(page.getByText('Documento vivo — muda com o projeto')).toBeVisible();
		// Escopo: toolbar + área do Documento (a navegação global do projeto
		// tem "Exportar" próprio, fora deste artefato).
		const artifactArea = page.locator('.toolbar, .layout');
		for (const forbidden of ['Restaurar', 'Reverter', 'Aprovar', 'Comparar', 'Exportar', 'Compartilhar']) {
			await expect(artifactArea.getByRole('button', { name: forbidden })).toHaveCount(0);
			await expect(artifactArea.getByRole('link', { name: forbidden })).toHaveCount(0);
		}
	});

	await test.step('cancelar o modal não cria versão; confirmar cria Snapshot v1', async () => {
		await page.getByRole('button', { name: 'Capturar snapshot' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Cancelar' }).click();
		await expect(page.locator('dialog[open]')).toHaveCount(0);
		await expect(page.getByRole('link', { name: /Snapshot v1/ })).toHaveCount(0);

		await captureSnapshot(page);
		await expect(page.getByText('Snapshot v1 capturado.')).toBeVisible();
		await expect(page.getByRole('complementary', { name: 'Versões' }).getByRole('link', { name: /Snapshot v1/ })).toBeVisible();
	});

	await test.step('o projeto vivo muda (Entender a situação)', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await page.getByRole('button', { name: 'Existe muito retrabalho' }).click();
		await page.getByRole('button', { name: 'Continuar' }).click();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
		await page.getByRole('button', { name: 'Sim, continuar' }).click();
		await page.getByRole('button', { name: 'Continuar para próxima atividade' }).click();
	});

	let liveBlockCount = 0;
	await test.step('Atual reflete a mudança; abrir v1 mostra o Documento congelado, read-only, sem modal', async () => {
		await page.goto(documentUrl());
		liveBlockCount = await page.locator('.document .block').count();

		await page.getByRole('complementary', { name: 'Versões' }).getByRole('link', { name: /Snapshot v1/ }).click();
		await page.waitForURL(/\/document\?v=1$/);
		const banner = page.getByRole('region', { name: 'Snapshot em leitura' });
		await expect(banner.getByText('Snapshot v1')).toBeVisible();
		await expect(banner.getByText('somente leitura')).toBeVisible();
		await expect(banner.getByText('O Atual já avançou desde esta versão.')).toBeVisible();
		await expect(banner.getByRole('link', { name: 'Voltar para o Atual' })).toBeVisible();
		await expect(page.locator('dialog[open]')).toHaveCount(0);

		// read-only: nenhuma affordance de edição nem de captura.
		await expect(page.getByRole('link', { name: /^Editar/ })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Capturar snapshot' })).toHaveCount(0);
		expect(await page.locator('.document .block').count()).toBeLessThan(liveBlockCount);
	});

	await test.step('reload mantém o snapshot; voltar ao Atual restaura a projeção viva', async () => {
		await page.reload();
		await expect(page.getByRole('region', { name: 'Snapshot em leitura' })).toBeVisible();

		await page.getByRole('link', { name: 'Voltar para o Atual' }).click();
		await page.waitForURL(/\/document$/);
		await expect(page.getByText('Documento vivo — muda com o projeto')).toBeVisible();
		await expect(page.getByRole('region', { name: 'Snapshot em leitura' })).toHaveCount(0);
		await expect(page.locator('.document .block')).toHaveCount(liveBlockCount);
		await expect(page.getByRole('button', { name: 'Capturar snapshot' })).toBeVisible();
	});

	await test.step('segunda captura cria v2 e o Atual coincide com ela (sem aviso de avanço)', async () => {
		await captureSnapshot(page);
		const region = page.getByRole('complementary', { name: 'Versões' });
		await expect(region.getByRole('link', { name: /Snapshot v2/ })).toBeVisible();
		await region.getByRole('link', { name: /Snapshot v2/ }).click();
		await page.waitForURL(/\/document\?v=2$/);
		await expect(page.getByText('O Atual já avançou desde esta versão.')).toHaveCount(0);
		await expect(page.locator('.document .block')).toHaveCount(liveBlockCount);
	});

	await test.step('desktop ~1280: região Versões ao lado, sem overflow', async () => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto(documentUrl());
		const region = page.getByRole('complementary', { name: 'Versões' });
		await expect(region).toBeVisible();
		await expect(page.getByRole('button', { name: /^Versões \(/ })).toBeHidden();
		const doc = await page.locator('.document').boundingBox();
		const side = await region.boundingBox();
		expect(doc && side && side.x >= doc.x + doc.width).toBe(true);
		await noHorizontalOverflow(page);
	});

	await test.step('mobile ~390: Versões (N) abre sheet; abrir versão fecha a sheet; sem overflow', async () => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(documentUrl());
		await expect(page.getByRole('complementary', { name: 'Versões' })).toBeHidden();
		await page.getByRole('button', { name: 'Versões (2)' }).click();
		const sheet = page.locator('dialog[open]');
		await expect(sheet.getByRole('heading', { name: 'Versões (2)' })).toBeVisible();
		await sheet.getByRole('link', { name: /Snapshot v1/ }).click();
		await page.waitForURL(/\/document\?v=1$/);
		await expect(page.locator('dialog[open]')).toHaveCount(0);
		await expect(page.getByRole('region', { name: 'Snapshot em leitura' })).toBeVisible();
		await noHorizontalOverflow(page);
	});

	expect(errors).toEqual([]);
});
