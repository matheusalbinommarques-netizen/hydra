// Teste Playwright dedicado da seção expansível "Adicionar mais contexto" em
// "Problema ou oportunidade" (Corte 2 da macroentrega de reaproveitamento),
// adaptado à apresentação campo a campo da Bancada (Descoberta + Definição
// do produto): "problema" agora decompõe seus dois campos obrigatórios
// (situacao, sinais_situacao) em etapas separadas, e só depois libera uma
// etapa opcional agrupada com os campos restantes — nunca mais um único
// formulário com tudo junto. Roda via playwright.journey.config.ts (servidor
// efêmero + banco temporário isolados) — ver e2e/helpers/ephemeral-server.ts.

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

test('seção "Adicionar mais contexto": recolhida por padrão, teclado, revealWhen resolvido estaticamente na etapa opcional, e valores preservados', async ({
	page
}) => {
	let projectId = '';

	await test.step('criar projeto e chegar a "Problema ou oportunidade"', async () => {
		projectId = await createProjectAndReachProblema(page);
	});

	await test.step('responder "situacao" (primeiro campo obrigatório)', async () => {
		await page.getByLabel('Qual situação precisa mudar?').fill('As solicitações chegam sem padrão.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('responder "sinais_situacao" com "Outro" marcado (último obrigatório)', async () => {
		await expect(page.getByText('Quais sinais representam melhor a situação?')).toBeVisible();
		await page.getByLabel('Outro', { exact: true }).check();
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	const summary = page.getByText('Adicionar mais contexto', { exact: false });
	const details = page.locator('details.optional-group');

	await test.step('etapa opcional: "Descreva o sinal Outro" já revelado (resolvido estaticamente, fora do grupo); grupo recolhido, sem contagem', async () => {
		await expect(page.getByText('Mais contexto (opcional)')).toBeVisible();
		await expect(page.getByLabel('Descreva o sinal "Outro"')).toBeVisible();
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

	await test.step('preencher campos opcionais e salvar: etapa opcional sempre libera a próxima atividade', async () => {
		await page.getByLabel('Descreva o sinal "Outro"').fill('Chegou por um canal informal.');
		await page.getByLabel('Evidências').fill('Três reclamações registradas este mês.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Público afetado', exact: true })).toBeVisible();
	});

	await test.step('valores preservados exatamente como enviados, campo a campo', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now?activity=problema&from=summary`);
		await expect(page.getByLabel('Qual situação precisa mudar?')).toHaveValue(
			'As solicitações chegam sem padrão.'
		);
		await expect(page.getByLabel('Outro', { exact: true })).toBeChecked();
		await expect(page.getByLabel('Descreva o sinal "Outro"')).toHaveValue('Chegou por um canal informal.');
		await expect(page.getByLabel('Evidências')).toHaveValue('Três reclamações registradas este mês.');
	});
});

test('seção "Adicionar mais contexto": aberta automaticamente quando já existe conteúdo persistido, com contagem correta', async ({
	page
}) => {
	let projectId = '';
	await test.step('criar projeto e chegar a "Problema ou oportunidade"', async () => {
		projectId = await createProjectAndReachProblema(page);
	});

	await test.step('semear Answers direto no banco: os dois obrigatórios (fora de ordem) + duas do grupo opcional (atalho de fixture já usado nesta suíte)', async () => {
		const db = new Database(dbPath);
		try {
			const now = new Date().toISOString();
			const insert = db.prepare(
				`INSERT INTO answer (project_id, activity_definition_id, field_definition_id, value, created_at, updated_at)
				 VALUES (?, 'problema', ?, ?, ?, ?)`
			);
			insert.run(projectId, 'situacao', 'Situação semeada direto no banco.', now, now);
			insert.run(projectId, 'sinais_situacao', JSON.stringify(['rework']), now, now);
			insert.run(projectId, 'consequencias', 'O retrabalho aumenta a cada mês.', now, now);
			insert.run(projectId, 'observacoes', 'Levantado com o time de suporte.', now, now);
		} finally {
			db.close();
		}
	});

	await test.step('recarregar: obrigatórios já respondidos (fora da progressão normal) mostram o formulário inteiro, com a seção já aberta e a contagem correta', async () => {
		// Os dois obrigatórios já têm Answer (semeados direto no banco, sem
		// passar por activityProgress) — a progressão campo a campo não teria
		// mais nenhum campo obrigatório pendente, então now/+page.server.ts usa
		// o formulário inteiro como rede de segurança (ver comentário em
		// now/+page.server.ts), que é exatamente o que este teste quer
		// verificar: grupo aberto porque já existe conteúdo persistido.
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();

		const details = page.locator('details.optional-group');
		await expect(details).toHaveAttribute('open', '');
		await expect(page.getByText('2 informações adicionadas')).toBeVisible();
		await expect(page.getByLabel('Consequências de não agir')).toHaveValue('O retrabalho aumenta a cada mês.');
		await expect(page.getByLabel('Observações')).toHaveValue('Levantado com o time de suporte.');
	});
});
