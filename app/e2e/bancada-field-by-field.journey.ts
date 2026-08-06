// Teste Playwright dedicado da apresentação "um campo por vez" da Bancada
// (Descoberta + Definição do produto) em "Problema ou oportunidade" — a
// única das três atividades decompostas nesta rodada com mistura de campo
// obrigatório de texto, campo obrigatório de seleção múltipla e campos
// opcionais agrupados, o que a torna o melhor caso de prova ponta a ponta.
// Cobre: avanço campo a campo, painel lateral "O que já sabemos" crescendo a
// cada resposta, etapa opcional agrupada (preenchida, não pulada) e
// conclusão da atividade idêntica à de um envio único (mesmos valores
// persistidos, mesma recomendação seguinte). Roda via
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
	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-bancada-field-by-field-'));
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

test('Bancada: "Problema ou oportunidade" campo a campo, painel crescendo, etapa opcional e conclusão equivalente a envio único', async ({
	page
}) => {
	let projectId = '';

	await test.step('criar projeto e pular Origem e Contexto para chegar a "Problema ou oportunidade"', async () => {
		projectId = await createProject(page, server.baseUrl);

		for (let i = 0; i < 2; i++) {
			await page.getByRole('button', { name: 'Pular etapa' }).click();
			await page.getByRole('button', { name: 'Confirmar' }).click();
		}
		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();
	});

	// A `<aside>` externa é o complementary real ("Progresso e contexto");
	// este painel específico é uma `<section>` aninhada com nome próprio, que
	// a ARIA mapeia para "region", não "complementary".
	const panel = page.getByRole('region', { name: 'O que já sabemos até aqui' });

	await test.step('layout de duas colunas ativo e painel vazio (Origem/Contexto foram pulados, sem Answer)', async () => {
		await expect(panel).toBeVisible();
		await expect(panel.getByText('Ainda não há respostas suficientes para mostrar aqui.')).toBeVisible();
	});

	await test.step('primeiro campo: só "situacao" visível, não o restante da atividade', async () => {
		await expect(page.getByLabel('Qual situação precisa mudar?')).toBeVisible();
		await expect(page.getByText('Quais sinais representam melhor a situação?')).toHaveCount(0);
		await expect(page.getByLabel('Evidências')).toHaveCount(0);
	});

	await test.step('responder "situacao": painel já mostra o bloco "Problema", ainda sem chips', async () => {
		await page.getByLabel('Qual situação precisa mudar?').fill('As solicitações chegam sem padrão.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();
		await expect(panel.getByText('Problema')).toBeVisible();
		await expect(panel.getByText('As solicitações chegam sem padrão.')).toBeVisible();
		await expect(panel.locator('.chip')).toHaveCount(0);
	});

	await test.step('segundo campo: só "sinais_situacao" visível, "situacao" não é mais mostrado no formulário', async () => {
		await expect(page.getByText('Quais sinais representam melhor a situação?')).toBeVisible();
		await expect(page.getByLabel('Qual situação precisa mudar?')).toHaveCount(0);
	});

	await test.step('responder "sinais_situacao" (último obrigatório): etapa opcional agrupada aparece, painel ganha chips', async () => {
		await page.getByLabel('Retrabalho', { exact: true }).check();
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByText('Mais contexto (opcional)')).toBeVisible();
		// Grupo opcional recolhido por padrão (mesmo comportamento de
		// problema-optional-group.journey.ts) — abre para responder.
		await page.getByText('Adicionar mais contexto', { exact: false }).click();
		await expect(page.getByLabel('Evidências')).toBeVisible();
		// A etapa opcional não repete os campos já respondidos.
		await expect(page.getByLabel('Qual situação precisa mudar?')).toHaveCount(0);
		await expect(page.getByText('Quais sinais representam melhor a situação?')).toHaveCount(0);

		await expect(panel.locator('.chip')).toHaveText(['Retrabalho']);
	});

	await test.step('preencher um campo opcional e salvar (não pular) avança para a próxima atividade', async () => {
		await page.getByLabel('Evidências').fill('Três reclamações registradas este mês.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Público afetado', exact: true })).toBeVisible();
	});

	await test.step('conclusão equivalente a um envio único: valores persistidos, atividade concluída, recomendação avançou', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now?activity=problema&from=summary`);
		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade', exact: true })).toBeVisible();
		await expect(page.getByText('Editando a partir do Resumo da descoberta')).toBeVisible();

		// Edição a partir do Resumo mostra o formulário inteiro (não campo a
		// campo) — os mesmos valores da progressão campo a campo, todos juntos,
		// exatamente como se tivessem sido enviados de uma vez.
		await expect(page.getByLabel('Qual situação precisa mudar?')).toHaveValue(
			'As solicitações chegam sem padrão.'
		);
		await expect(page.getByLabel('Retrabalho', { exact: true })).toBeChecked();
		await expect(page.getByLabel('Evidências')).toHaveValue('Três reclamações registradas este mês.');
	});
});
