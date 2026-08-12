// Teste Playwright dedicado ao caráter opcional dos passos 2 e 3 ("Onde
// isso aparece principalmente?" e "Qual é o peso disso hoje?") do wizard
// "Entender a situação" (EntenderSituacao.svelte) e à preservação de valores
// já respondidos ao reabrir a atividade. Roda via playwright.journey.config.ts
// (servidor efêmero + banco temporário isolados) — ver
// e2e/helpers/ephemeral-server.ts.
//
// Reescrito para o comportamento real e aprovado atual (Etapa 0,
// docs/core/HYDRA_PRODUCT_REWORK.md): a seção expansível "Adicionar mais
// contexto" (`details.optional-group`, catalog `optionalGroup`/`revealWhen`)
// não é mais exercida por nenhuma atividade do catálogo atual — "problema"
// deixou de usar o formulário genérico (ActivityForm.svelte) desde o
// redesenho "Entender a situação" (D034, docs/07-management/decision-log.md),
// e nenhum outro campo do catálogo declara `optionalGroup`/`revealWhen` hoje
// (dívida conhecida, registrada — ver relatório da Etapa 0). O equivalente
// real de "contexto opcional" para esta mesma atividade hoje é o par de
// passos 2/3 do wizard, cada um com seu próprio "Pular esta pergunta".

import Database from 'better-sqlite3';
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
let dbPath: string;

test.beforeAll(async () => {
	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-optional-group-'));
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

test('"Pular esta pergunta" nos passos 2 e 3: síntese sem eles, valor do passo 1 preservado ao reabrir', async ({
	page
}) => {
	let projectId = '';

	await test.step('criar projeto: chega direto a "Entender a situação"', async () => {
		projectId = await createProject(page, server.baseUrl);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
	});

	await test.step('passo 1: responder e continuar', async () => {
		await page.getByRole('button', { name: 'Está demorando demais' }).click();
		await page.getByRole('button', { name: 'Continuar' }).click();
	});

	await test.step('passo 2: pular sem selecionar nada', async () => {
		await expect(page.getByRole('heading', { name: 'Onde isso aparece principalmente?' })).toBeVisible();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
	});

	await test.step('passo 3: pular sem selecionar nada', async () => {
		await expect(page.getByRole('heading', { name: 'Qual é o peso disso hoje?' })).toBeVisible();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
	});

	await test.step('síntese reflete só o passo 1 respondido, confirmar avança', async () => {
		await expect(page.getByRole('heading', { name: 'É mais ou menos isso?' })).toBeVisible();
		await expect(page.locator('.es-synthesis-box')).toContainText('demora');
		await page.getByRole('button', { name: 'Sim, continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Etapa concluída' })).toBeVisible();
		await page.getByRole('button', { name: 'Continuar para próxima atividade' }).click();
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
	});

	await test.step('reabrir a partir de Registros: passo 1 preservado, passos 2 e 3 continuam vazios', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now?activity=problema&from=records`);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Está demorando demais' })).toHaveClass(/selected/);

		await page.getByRole('button', { name: 'Continuar' }).click();
		await expect(page.getByRole('heading', { name: 'Onde isso aparece principalmente?' })).toBeVisible();
		await expect(page.locator('.es-chip.selected')).toHaveCount(0);

		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
		await expect(page.getByRole('heading', { name: 'Qual é o peso disso hoje?' })).toBeVisible();
		await expect(page.locator('.es-row.selected')).toHaveCount(0);
	});
});

test('Answers já persistidas fora da progressão normal pré-selecionam os chips ao abrir o wizard', async ({
	page
}) => {
	let projectId = '';
	await test.step('criar projeto', async () => {
		projectId = await createProject(page, server.baseUrl);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
	});

	await test.step('semear Answers direto no banco (atalho de fixture já usado nesta suíte), sem alterar activity_progress', async () => {
		const db = new Database(dbPath);
		try {
			const now = new Date().toISOString();
			const insert = db.prepare(
				`INSERT INTO answer (project_id, activity_definition_id, field_definition_id, value, created_at, updated_at)
				 VALUES (?, 'problema', ?, ?, ?, ?)`
			);
			insert.run(projectId, 'situacao_o_que', JSON.stringify(['prob_retrabalho']), now, now);
			insert.run(projectId, 'situacao_onde', JSON.stringify(['area_processo']), now, now);
			insert.run(projectId, 'situacao_peso', 'É crítico', now, now);
		} finally {
			db.close();
		}
	});

	await test.step('recarregar: os três passos já mostram a seleção persistida', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Existe muito retrabalho' })).toHaveClass(/selected/);

		await page.getByRole('button', { name: 'Continuar' }).click();
		await expect(page.getByRole('heading', { name: 'Onde isso aparece principalmente?' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Processo' })).toHaveClass(/selected/);

		await page.getByRole('button', { name: 'Continuar' }).click();
		await expect(page.getByRole('heading', { name: 'Qual é o peso disso hoje?' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'É crítico' })).toHaveClass(/selected/);

		await page.getByRole('button', { name: 'Ver síntese' }).click();
		await expect(page.locator('.es-synthesis-box')).toContainText('retrabalho');
	});
});
