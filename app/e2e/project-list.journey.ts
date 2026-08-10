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
	type EphemeralServer,
	getFreePort,
	startServer,
	stopServer,
	waitForServer
} from './helpers/ephemeral-server';
import { createProject } from './helpers/create-project';

let tmpRoot: string;
let serverA: EphemeralServer;
let serverB: EphemeralServer;

test.beforeAll(async () => {
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
		await expect(page.getByRole('heading', { name: 'Você ainda não tem projetos' })).toBeVisible();
	});

	await test.step('criar projeto sem nome: aparece na página inicial como "Projeto sem nome"', async () => {
		firstProjectId = await createProject(page, serverA.baseUrl);

		await page.goto(serverA.baseUrl + '/');
		const featured = page.getByRole('region', { name: 'Projeto em destaque' });
		await expect(featured.getByRole('heading', { name: 'Projeto sem nome', level: 2 })).toBeVisible();

		// C6-01: com um único projeto (o próprio destaque), a seção "Meus
		// projetos" abaixo não é renderizada vazia — o card de destaque já é
		// suficiente nesse cenário.
		await expect(page.locator('.hp-list-section')).toHaveCount(0);
	});

	await test.step('criar um segundo projeto com nome: o destaque é escolhido por movimentação real e nunca se duplica na lista (C6-01)', async () => {
		secondProjectId = await createProject(page, serverA.baseUrl);

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

		// C6-01: o destaque ("Continue de onde parou") é escolhido por
		// movimentação real, não pela ordem de criação — "Level Me Up" tem
		// respostas reais (Answer.updatedAt), "Projeto sem nome" nunca foi
		// trabalhado, então "Level Me Up" vira o destaque.
		const featured = page.getByRole('region', { name: 'Projeto em destaque' });
		await expect(featured.getByRole('heading', { name: 'Level Me Up', level: 2 })).toBeVisible();

		// Regra de não duplicação (C6-01): o projeto em destaque nunca
		// reaparece na lista abaixo — com só dois projetos e um deles em
		// destaque, a lista mostra exatamente o outro. Cada linha da lista é
		// o próprio link (`.hp-row`), não um botão separado.
		const projectRows = page.locator('.hp-row .col-name');
		await expect(projectRows).toHaveCount(1);
		await expect(projectRows.nth(0)).toHaveText('Projeto sem nome');
		await expect(page.locator('.hp-row', { hasText: 'Level Me Up' })).toHaveCount(0);

		// Os dois projetos continuam acessíveis a partir da Home: o destaque
		// pelo próprio card, o outro pela linha da lista.
		await expect(
			featured.getByRole('link', { name: /Começar projeto|Continuar projeto/ })
		).toHaveAttribute('href', `/projects/${secondProjectId}/now`);
		const otherRow = page.locator('.hp-row', { hasText: 'Projeto sem nome' });
		await expect(otherRow).toHaveAttribute('href', `/projects/${firstProjectId}/now`);
	});

	await test.step('clicar em um projeto da lista abre /projects/<id>/now', async () => {
		const featured = page.getByRole('region', { name: 'Projeto em destaque' });
		await featured.getByRole('link', { name: /Começar projeto|Continuar projeto/ }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${secondProjectId}/now`);
		await expect(
			page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })
		).toBeVisible();
	});

	await test.step('link "Projetos" no workspace leva à Biblioteca (não mais à Home)', async () => {
		await page.getByRole('link', { name: 'Projetos' }).click();
		// Convergência 7.2: "← Projetos" do workspace passa a levar à
		// Biblioteca (/projects), não mais à Home (/) — waitForURL exige a
		// rota exata, provando que a Home deixou de ser o destino.
		await page.waitForURL(serverA.baseUrl + '/projects');
		await expect(page.getByRole('heading', { name: 'Biblioteca de projetos' })).toBeVisible();

		const rows = page.locator('.project-row .col-name');
		await expect(rows).toHaveCount(2);

		// possibilidade real de abrir/continuar o segundo projeto a partir da
		// Biblioteca, com navegação para o mesmo projectId.
		const levelMeUpRow = page.locator('.project-row', { hasText: 'Level Me Up' });
		await expect(levelMeUpRow.getByRole('link', { name: /Começar projeto|Continuar projeto/ })).toHaveAttribute(
			'href',
			`/projects/${secondProjectId}/now`
		);
	});

	await test.step('recarregar a página preserva a lista', async () => {
		await page.reload();
		await expect(page.locator('.project-row .col-name')).toHaveCount(2);
	});

	await test.step('acesso direto pela URL continua funcionando', async () => {
		await page.goto(`${serverA.baseUrl}/projects/${firstProjectId}/now`);
		await expect(page.getByRole('heading', { name: 'Origem do projeto', exact: true })).toBeVisible();
	});

	await test.step('importar projeto em cenário válido continua funcionando e aparece na lista do destino', async () => {
		// Mesmo drift do walking-skeleton-journey (D031): Exportar virou página
		// própria, o download real é a ação "Baixar exportação" dentro dela.
		await page.getByRole('link', { name: 'Exportar' }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${firstProjectId}/export`);
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Baixar exportação' }).click();
		const download = await downloadPromise;
		const downloadedFilePath = path.join(tmpRoot, 'export.json');
		await download.saveAs(downloadedFilePath);
		expect(readFileSync(downloadedFilePath, 'utf-8').length).toBeGreaterThan(0);

		await page.goto(serverB.baseUrl + '/');
		await expect(page.getByRole('heading', { name: 'Você ainda não tem projetos' })).toBeVisible();

		// Home (identidade convergida, C6-01): "Importar" aciona um input de
		// arquivo escondido (sem <details> visível) — selecionar o arquivo já
		// submete o formulário real. O rótulo do input continua "Arquivo do
		// projeto (.json)".
		await page.getByLabel('Arquivo do projeto (.json)').setInputFiles(downloadedFilePath);
		await page.waitForURL(`${serverB.baseUrl}/projects/${firstProjectId}/now`);

		await page.goto(serverB.baseUrl + '/');
		const featured = page.getByRole('region', { name: 'Projeto em destaque' });
		await expect(featured.getByRole('heading', { name: 'Projeto sem nome', level: 2 })).toBeVisible();
	});
});
