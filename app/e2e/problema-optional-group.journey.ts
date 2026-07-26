// Teste Playwright dedicado da seção expansível "Adicionar mais contexto" em
// "Problema ou oportunidade" (Corte 2 da macroentrega de reaproveitamento).
// Roda via playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados) — ver e2e/helpers/ephemeral-server.ts.

import Database from 'better-sqlite3';
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
let dbPath: string;

test.beforeAll(async () => {
	buildApp();

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

async function createProjectAndReachProblema(page: import('@playwright/test').Page): Promise<string> {
	await page.goto(server.baseUrl + '/');
	await page.getByRole('button', { name: 'Criar novo projeto' }).click();
	await page.waitForURL(/\/projects\/[^/]+\/now$/);
	const match = page.url().match(/\/projects\/([^/]+)\/now$/);
	if (!match) throw new Error('projectId não encontrado na URL.');
	const projectId = match[1];

	// Pula Origem e Contexto — não fazem parte deste teste.
	for (let i = 0; i < 2; i++) {
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.getByRole('button', { name: 'Confirmar' }).click();
	}

	await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();
	return projectId;
}

test('seção "Adicionar mais contexto": recolhida por padrão, teclado, revealWhen e valor preservado ao salvar incompleto', async ({
	page
}) => {
	await test.step('criar projeto e chegar a "Problema ou oportunidade"', async () => {
		await createProjectAndReachProblema(page);
	});

	const summary = page.getByText('Adicionar mais contexto', { exact: false });
	const details = page.locator('details.optional-group');

	await test.step('recolhida inicialmente quando todos os campos estão vazios, sem contagem', async () => {
		await expect(details).toBeVisible();
		await expect(details).not.toHaveAttribute('open', '');
		await expect(page.getByText(/informaç(ão|ões) adicionada/)).toHaveCount(0);
		await expect(page.getByLabel('Evidências')).not.toBeVisible();
	});

	await test.step('teclado abre a seção (Enter no summary)', async () => {
		await summary.focus();
		await summary.press('Enter');
		await expect(details).toHaveAttribute('open', '');
		await expect(page.getByLabel('Evidências')).toBeVisible();
	});

	await test.step('"Outro" continua revelando o campo de descrição (revealWhen fora do grupo)', async () => {
		await expect(page.getByLabel('Descreva o sinal "Outro"')).not.toBeVisible();
		await page.getByLabel('Outro', { exact: true }).check();
		await expect(page.getByLabel('Descreva o sinal "Outro"')).toBeVisible();
		await page.getByLabel('Outro', { exact: true }).uncheck();
	});

	await test.step('digitar em "Evidências" e salvar com "sinais_situacao" ainda vazio', async () => {
		// answerActivity nunca falha (fail()/alerta) por campo obrigatório
		// incompleto — ele salva o que foi enviado e mantém a atividade
		// em_andamento (Trilha A continua recomendando "problema"); a página
		// recarrega mostrando a mesma atividade, agora com os valores já
		// persistidos (não mais os "temporários" do POST anterior).
		await page.getByLabel('Qual situação precisa mudar?').fill('As solicitações chegam sem padrão.');
		await page.getByLabel('Evidências').fill('Três reclamações registradas este mês.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();
	});

	await test.step('valor salvo e seção aberta preservados mesmo sem a atividade avançar', async () => {
		await expect(details).toHaveAttribute('open', '');
		await expect(page.getByLabel('Evidências')).toHaveValue('Três reclamações registradas este mês.');
		await expect(page.getByLabel('Qual situação precisa mudar?')).toHaveValue(
			'As solicitações chegam sem padrão.'
		);
	});

	await test.step('completar sinais e salvar com sucesso', async () => {
		await page.getByLabel('Retrabalho', { exact: true }).check();
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
		await expect(page.getByRole('heading', { name: 'Público afetado', exact: true })).toBeVisible();
	});
});

test('seção "Adicionar mais contexto": aberta automaticamente quando já existe conteúdo persistido, com contagem correta', async ({
	page
}) => {
	let projectId = '';
	await test.step('criar projeto e chegar a "Problema ou oportunidade"', async () => {
		projectId = await createProjectAndReachProblema(page);
	});

	await test.step('semear duas Answers do grupo direto no banco (atalho de fixture já usado nesta suíte)', async () => {
		const db = new Database(dbPath);
		try {
			const now = new Date().toISOString();
			const insert = db.prepare(
				`INSERT INTO answer (project_id, activity_definition_id, field_definition_id, value, created_at, updated_at)
				 VALUES (?, 'problema', ?, ?, ?, ?)`
			);
			insert.run(projectId, 'consequencias', 'O retrabalho aumenta a cada mês.', now, now);
			insert.run(projectId, 'observacoes', 'Levantado com o time de suporte.', now, now);
		} finally {
			db.close();
		}
	});

	await test.step('recarregar e confirmar seção já aberta com a contagem correta', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();

		const details = page.locator('details.optional-group');
		await expect(details).toHaveAttribute('open', '');
		await expect(page.getByText('2 informações adicionadas')).toBeVisible();
		await expect(page.getByLabel('Consequências de não agir')).toHaveValue('O retrabalho aumenta a cada mês.');
		await expect(page.getByLabel('Observações')).toHaveValue('Levantado com o time de suporte.');
	});
});
