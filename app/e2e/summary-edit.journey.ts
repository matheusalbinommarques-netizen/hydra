// Teste Playwright dedicado da edição de atividades concluídas da Descoberta
// a partir do Resumo (Corte 3 da macroentrega de reaproveitamento). Amplia,
// de forma restrita, o gate de `?activity=` de now/+page.server.ts — só
// atividades required_fields da própria Descoberta, só quando já concluídas,
// só com o parâmetro explícito `from=summary`. Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados) — ver e2e/helpers/ephemeral-server.ts.

import { expect, test, type Page } from '@playwright/test';
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
	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-summary-edit-'));
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

async function completeDiscoveryAndConfirmSummary(page: Page): Promise<string> {
	const projectId = await createProject(page, server.baseUrl);

	await page.getByLabel('O que deu origem a este projeto?').selectOption('Um problema');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();

	// "Contexto inicial" e "Problema ou oportunidade" são decompostas campo a
	// campo nesta rodada — um submit por campo, com a etapa opcional de
	// "problema" dispensada via "Avançar sem preencher".
	await page.getByLabel('Nome provisório do projeto').fill('Projeto Edição no Resumo');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	await page.getByLabel('Breve descrição').fill('Descrição breve do projeto.');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	await page.getByLabel('Trabalho individual ou em equipe?').selectOption('Individual');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	await page.getByLabel('Qual seu nível de experiência com gestão de projetos?').selectOption('Intermediário');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	await page.getByLabel('Qual o estágio atual?').selectOption('Em planejamento');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();

	await page.getByLabel('Qual situação precisa mudar?').fill('Situação original do problema.');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	await page.getByLabel('Informação duplicada', { exact: true }).check();
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	await page.getByRole('link', { name: 'Avançar sem preencher' }).click();

	await page.getByLabel('Quem é afetado por esta situação, em detalhe?').fill('Público original.');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();

	await page.getByLabel('Como a situação é tratada hoje, em detalhe?').fill('Estado atual original.');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();

	await page.getByLabel('O que deverá estar diferente quando este projeto tiver sucesso?').fill('Resultado original.');
	await page.getByLabel('Quem é o principal beneficiário?').fill('Beneficiário original.');
	await page.getByLabel('Como você vai perceber a melhoria?').fill('Percepção original.');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();

	await expect(page.getByRole('heading', { name: 'Resumo da descoberta' })).toBeVisible();
	await page.getByRole('link', { name: /Ir para o Resumo da descoberta/ }).click();
	await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
	await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
	await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

	return projectId;
}

test('editar "problema" a partir do Resumo: reabre atividade concluída, carrega valores, salva, volta ao resumo e invalida a confirmação anterior', async ({
	page
}) => {
	let projectId = '';

	await test.step('completar a Descoberta e confirmar o Resumo', async () => {
		projectId = await completeDiscoveryAndConfirmSummary(page);
		await expect(page.getByRole('heading', { name: 'Definir usuário principal' })).toBeVisible();
	});

	await test.step('ir ao Resumo e clicar em "Editar problema"', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/summary`);
		await page.getByRole('link', { name: 'Editar problema' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now?activity=problema&from=summary`);
	});

	await test.step('reabre a atividade concluída, com os valores persistidos carregados', async () => {
		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();
		await expect(page.getByText('Editando a partir do Resumo da descoberta')).toBeVisible();
		await expect(page.getByLabel('Qual situação precisa mudar?')).toHaveValue('Situação original do problema.');
		await expect(page.getByLabel('Informação duplicada', { exact: true })).toBeChecked();
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toHaveCount(0);
	});

	await test.step('editar e salvar retorna ao Resumo (não avança a jornada)', async () => {
		await page.getByLabel('Qual situação precisa mudar?').fill('Situação revisada do problema.');
		await page.getByRole('button', { name: 'Salvar e voltar ao Resumo' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.locator('.overview').getByText('Situação revisada do problema.')).toBeVisible();
	});

	await test.step('a edição invalidou a confirmação anterior do Resumo', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Resumo da descoberta' })).toBeVisible();
	});
});

test('edição a partir do Resumo rejeita atividade de outra fase e ID inexistente, sem afetar o fluxo normal sem parâmetro', async ({
	page
}) => {
	let projectId = '';

	await test.step('completar a Descoberta e confirmar o Resumo', async () => {
		projectId = await completeDiscoveryAndConfirmSummary(page);
	});

	await test.step('activity de outra fase (usuario_principal, Definição) com from=summary é rejeitado', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now?activity=usuario_principal&from=summary`);
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
	});

	await test.step('activity inexistente com from=summary é rejeitado', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now?activity=nao_existe&from=summary`);
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
	});

	await test.step('fluxo normal sem o parâmetro continua inalterado', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Definir usuário principal' })).toBeVisible();
	});
});
