// Teste Playwright dedicado do banner de conflito critério × escopo na
// tela "Revisão e confirmação" (/summary).
// Cobre: tela sem conflito (nenhum critério respondido ainda; critério
// respondido mas ainda sustentado por um item em "Agora") e tela com
// conflito (critério respondido, item de escopo movido para fora de
// "Agora"). Roda via playwright.journey.config.ts (servidor efêmero +
// banco temporário isolados) — ver e2e/helpers/ephemeral-server.ts.

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
import { answerActivitiesGenerically, answerCurrentActivityGenerically } from './helpers/generic-activity';

let tmpRoot: string;
let server: EphemeralServer;

const CONFLICT_MESSAGE = 'Você definiu critérios de sucesso, mas nenhum item de escopo em "Agora" os sustenta ainda.';

test.beforeAll(async () => {
	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-criteria-scope-conflict-'));
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

// Nome e origem já são respondidos atomicamente em `/projects/new` (D034) —
// createProject() já cobre isso. "Contexto inicial" foi incorporada/removida
// do catálogo; "Entender a situação" (id `problema`) usa o wizard bespoke
// EntenderSituacao.svelte, não o formulário genérico — ver
// skip-activity.journey.ts para a cobertura dedicada desse wizard.
async function completeDiscovery(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Existe muito retrabalho' }).click();
	await page.getByRole('button', { name: 'Continuar' }).click();
	await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
	await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
	await page.getByRole('button', { name: 'Sim, continuar' }).click();
	await page.getByRole('button', { name: 'Continuar para próxima atividade' }).click();

	await page.getByRole('button', { name: '+ Adicionar grupo' }).click();
	await page.getByRole('button', { name: 'Equipe interna', exact: true }).click();
	await page.getByRole('button', { name: 'Alto', exact: true }).click();
	await page.getByRole('button', { name: 'Frequentemente', exact: true }).click();
	await page.getByRole('button', { name: 'Concluir mapa' }).click();

	await page.getByPlaceholder('Descrever em poucas palavras…').fill('Estado atual de teste.');
	await page.getByRole('button', { name: 'Adicionar' }).click();
	await page.getByRole('button', { name: 'Continuar', exact: true }).click();

	await page.getByLabel('O que deverá estar diferente quando este projeto tiver sucesso?').fill('Resultado de teste.');
	await page.getByLabel('Quem é o principal beneficiário?').fill('Beneficiário de teste.');
	await page.getByLabel('Como você vai perceber a melhoria?').fill('Percepção de teste.');
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

test('banner de conflito critério × escopo: ausente sem conflito, visível quando critério fica sem item em "Agora"', async ({
	page
}) => {
	let projectId = '';

	await test.step('criar projeto e completar a Descoberta', async () => {
		projectId = await createProject(page, server.baseUrl);

		await completeDiscovery(page);
	});

	await test.step('sem nenhum critério respondido: Resumo não mostra o banner', async () => {
		await page.getByRole('link', { name: /Ir para o Resumo da descoberta/ }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
		await expect(page.getByText(CONFLICT_MESSAGE)).toHaveCount(0);

		await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);
	});

	await test.step('completar usuário principal, visão do produto e confirmar escopo com um item em "Agora"', async () => {
		// usuario_principal (1 campo) + visao_produto campo a campo (3
		// obrigatórios: tipo_produto, necessidade_central, beneficio_central) +
		// etapa opcional de visao_produto (diferencial, sem obrigatórios — o
		// helper genérico só clica "Salvar e continuar" sem preencher nada,
		// suficiente para avançar a etapa opcional) = 5 passos.
		await answerActivitiesGenerically(page, 5);

		await page.getByRole('link', { name: /Ir para Escolha o próximo foco/ }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/next-version`);

		await page.getByLabel('Descrição do item').fill('Item de teste do conflito critério × escopo.');
		await page.getByLabel('Onde esse item entra?').selectOption('agora');
		await page.getByRole('button', { name: 'Adicionar' }).click();
		await page.getByRole('button', { name: 'Pequeno', exact: true }).click();
		await page.getByRole('textbox', { name: 'Hipótese' }).fill('Hipótese de teste.');
		await page.getByRole('textbox', { name: 'Hipótese' }).press('Tab');
		await page.getByRole('button', { name: 'Confirmar foco' }).click();

		await page.getByRole('link', { name: 'Agora' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);
	});

	await test.step('critério de sucesso respondido, mas ainda sustentado por um item em "Agora": banner ausente', async () => {
		await answerCurrentActivityGenerically(page); // criterios_sucesso_produto

		await page.goto(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
		await expect(page.getByText(CONFLICT_MESSAGE)).toHaveCount(0);
	});

	await test.step('item movido para fora de "Agora": banner de conflito aparece no Resumo', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/next-version`);
		await Promise.all([
			page.waitForResponse((response) => response.url().includes('?/move') && response.request().method() === 'POST'),
			page.getByLabel('Mover para', { exact: true }).selectOption('fora')
		]);

		await page.goto(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
		await expect(page.getByText(CONFLICT_MESSAGE)).toBeVisible();
	});
});
