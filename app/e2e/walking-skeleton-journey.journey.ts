// Jornada ponta a ponta do Walking Skeleton (C2-12) — ver
// docs/08-delivery/cycle-02-backlog.md. Roda via playwright.journey.config.ts
// (não via playwright.config.ts), para controlar dois servidores isolados
// com bancos SQLite temporários próprios (export/import exigem bancos
// diferentes). Isolamento e cleanup: e2e/helpers/ephemeral-server.ts.

import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
import { answerActivitiesGenerically } from './helpers/generic-activity';

interface ExportedEnvelope {
	version: number;
	state: {
		project: { id: string; name: string | null };
		activityProgress: Array<{ activityDefinitionId: string; status: string }>;
		answers: Array<{ fieldDefinitionId: string; value: string }>;
	};
}

let tmpRoot: string;
let serverA: EphemeralServer;
let serverB: EphemeralServer;

test.beforeAll(async () => {
	buildApp();

	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-'));
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

function trackForbiddenSummaryRequests(page: Page, sink: string[]): void {
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/projects/summary') {
			sink.push(request.url());
		}
	});
}

test('jornada completa: criar, responder, resumo, exportar, importar', async ({ page }) => {
	const forbiddenSummaryRequests: string[] = [];
	trackForbiddenSummaryRequests(page, forbiddenSummaryRequests);

	let projectId = '';

	await test.step('criar projeto', async () => {
		await page.goto(serverA.baseUrl + '/');
		await page.getByRole('button', { name: 'Criar novo projeto' }).click();
		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		expect(match).not.toBeNull();
		projectId = match![1];
	});

	await test.step('Origem do projeto', async () => {
		await expect(page.getByRole('heading', { name: 'Origem do projeto' })).toBeVisible();
		await page.getByLabel('O que deu origem a este projeto?').selectOption('Um problema');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('Contexto inicial (campo a campo)', async () => {
		await expect(page.getByRole('heading', { name: 'Contexto inicial' })).toBeVisible();
		await page.getByLabel('Nome provisório do projeto').fill('Portal de Solicitações E2E');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page.getByLabel('Breve descrição').fill('Descrição breve do projeto para o teste E2E.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page.getByLabel('Trabalho individual ou em equipe?').selectOption('Individual');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page
			.getByLabel('Qual seu nível de experiência com gestão de projetos?')
			.selectOption('Intermediário');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page.getByLabel('Qual o estágio atual?').selectOption('Em planejamento');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('Problema ou oportunidade (campo a campo, com etapa opcional)', async () => {
		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade' })).toBeVisible();
		await page
			.getByLabel('Qual situação precisa mudar?')
			.fill('As solicitações internas chegam sem padrão.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Problema ou oportunidade' })).toBeVisible();
		await page.getByLabel('Informação duplicada').check();
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		// Todos os obrigatórios respondidos — etapa opcional agrupada, avança
		// sem preencher nada.
		await expect(page.getByText('Mais contexto (opcional)')).toBeVisible();
		await page.getByRole('link', { name: 'Avançar sem preencher' }).click();
	});

	await test.step('Público afetado', async () => {
		await expect(page.getByRole('heading', { name: 'Público afetado' })).toBeVisible();
		await page
			.getByLabel('Quem é afetado por esta situação, em detalhe?')
			.fill('Agentes de atendimento e clientes internos.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('Estado atual', async () => {
		await expect(page.getByRole('heading', { name: 'Estado atual' })).toBeVisible();
		await page
			.getByLabel('Como a situação é tratada hoje, em detalhe?')
			.fill('Cada time usa sua própria planilha, sem padrão.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('Resultado desejado', async () => {
		await expect(page.getByRole('heading', { name: 'Resultado desejado' })).toBeVisible();
		await page
			.getByLabel('O que deverá estar diferente quando este projeto tiver sucesso?')
			.fill('Solicitações centralizadas, priorizadas e acompanháveis.');
		await page.getByLabel('Quem é o principal beneficiário?').fill('Equipe de atendimento e clientes.');
		await page
			.getByLabel('Como você vai perceber a melhoria?')
			.fill('Menos retrabalho e resposta mais rápida.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('acessar o Resumo da descoberta a partir de Agora', async () => {
		await expect(page.getByRole('heading', { name: 'Resumo da descoberta' })).toBeVisible();
		await page.getByRole('link', { name: /Ir para o Resumo da descoberta/ }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/summary`);
	});

	await test.step('verificar respostas no Resumo', async () => {
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação', level: 1 })).toBeVisible();

		// nome do projeto (cabeçalho persistente do layout do projeto)
		await expect(page.getByText('Portal de Solicitações E2E')).toBeVisible();

		// Visão geral (Corte 3) — só as Answers canônicas de problema/sinais/
		// público/estado atual/resultado, sempre visíveis, escopadas a
		// .overview para não colidir com a cópia integral em "detalhes".
		const overview = page.locator('.overview');
		await expect(overview.getByText('As solicitações internas chegam sem padrão.')).toBeVisible();
		await expect(overview.getByText('Informação duplicada')).toBeVisible();
		await expect(overview.getByText('Agentes de atendimento e clientes internos.')).toBeVisible();
		await expect(overview.getByText('Cada time usa sua própria planilha, sem padrão.')).toBeVisible();
		await expect(overview.getByText('Solicitações centralizadas, priorizadas e acompanháveis.')).toBeVisible();

		// Conferência compacta — as seis atividades da Descoberta já concluídas
		// nesta jornada, então os quatro itens aparecem marcados.
		await expect(page.getByText('Problema definido')).toBeVisible();
		await expect(page.getByText('Público definido')).toBeVisible();
		await expect(page.getByText('Estado atual definido')).toBeVisible();
		await expect(page.getByText('Resultado definido')).toBeVisible();

		// "Ver todas as respostas da descoberta" recolhida por padrão (todas as
		// seis atividades já concluídas) — abre para checar os campos que só
		// aparecem nos detalhes completos (fora da visão geral).
		await page.getByText('Ver todas as respostas da descoberta').click();
		const details = page.locator('.full-details');

		// Origem do projeto
		await expect(details.getByText('Um problema')).toBeVisible();

		// Contexto inicial
		await expect(details.getByText('Descrição breve do projeto para o teste E2E.')).toBeVisible();
		await expect(details.getByText('Individual', { exact: true })).toBeVisible();
		await expect(details.getByText('Intermediário')).toBeVisible();
		await expect(details.getByText('Em planejamento')).toBeVisible();

		// Resultado desejado — beneficiário e percepção não fazem parte da
		// visão geral (só a mudança esperada), continuam nos detalhes.
		await expect(details.getByText('Equipe de atendimento e clientes.')).toBeVisible();
		await expect(details.getByText('Menos retrabalho e resposta mais rápida.')).toBeVisible();
	});

	await test.step('confirmar o Resumo', async () => {
		await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/now`);
	});

	await test.step('Definir usuário principal recomendado e respondido', async () => {
		await expect(page.getByRole('heading', { name: 'Definir usuário principal' })).toBeVisible();
		await page
			.getByLabel('Quem é o usuário principal do produto?')
			.fill('Analista de atendimento que registra e acompanha solicitações.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('Definir visão do produto recomendada e respondida (campo a campo)', async () => {
		await expect(page.getByRole('heading', { name: 'Definir visão do produto' })).toBeVisible();
		await page.getByLabel('Que tipo de produto será?').fill('Portal web de solicitações.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page
			.getByLabel('Qual necessidade principal esse produto atende?')
			.fill('Centralizar e priorizar solicitações internas.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await page
			.getByLabel('Qual benefício principal o produto deve entregar?')
			.fill('Resposta mais rápida e menos retrabalho.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		// "diferencial" (opcional, único campo restante) — etapa opcional,
		// avança sem preencher.
		await expect(page.getByText('Mais contexto (opcional)')).toBeVisible();
		await page.getByRole('link', { name: 'Avançar sem preencher' }).click();
	});

	await test.step('Escolha o próximo foco recomendada, montada e confirmada', async () => {
		await expect(page.getByRole('heading', { name: 'Escolha o próximo foco' })).toBeVisible();
		await page.getByRole('link', { name: /Ir para Escolha o próximo foco/ }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/next-version`);

		await page.getByLabel('Descrição do item').fill('Registrar, priorizar e acompanhar solicitações.');
		await page.getByLabel('Onde esse item entra?').selectOption('agora');
		await page.getByRole('button', { name: 'Adicionar' }).click();

		await expect(page.locator('.item-row input[type="text"]')).toHaveValue(
			'Registrar, priorizar e acompanhar solicitações.'
		);
		await page.getByRole('button', { name: 'Pequeno', exact: true }).click();
		await page
			.getByRole('textbox', { name: 'Hipótese' })
			.fill('Usuários conseguem concluir a jornada guiada sem ajuda externa.');
		await page.getByRole('textbox', { name: 'Hipótese' }).press('Tab'); // autosave dispara ao sair do campo

		await expect(page.getByText('Tudo pronto para confirmar.')).toBeVisible();
		await page.getByRole('button', { name: 'Confirmar foco' }).click();
		await expect(page.getByText('Foco confirmado.')).toBeVisible();

		await page.getByRole('link', { name: 'Ver o artefato' }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/next-version/confirmed`);
		await page.getByRole('link', { name: 'Continuar jornada' }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/now`);
	});

	await test.step('demais atividades do catálogo (fase 2 restante a 6) respondidas genericamente até o encerramento', async () => {
		// criterios_sucesso_produto (1, fase 2) + estruturação (6) +
		// planejamento (7) + execução (6) + validação (6, incluindo
		// "Confirmar encerramento do projeto") = 26. Conteúdo específico de
		// cada campo já é coberto por catalog.spec.ts e por
		// full-catalog-journey.spec.ts — aqui só precisa provar que a rota
		// real atravessa essas fases sem erro.
		await answerActivitiesGenerically(page, 26);
	});

	let downloadedFilePath = '';
	let exportedJson: ExportedEnvelope;

	await test.step('catalog_limit_reached e exportação', async () => {
		await expect(
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' })
		).toBeVisible();

		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Exportar' }).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe(`hydra-${projectId}.json`);

		downloadedFilePath = path.join(tmpRoot, 'export.json');
		await download.saveAs(downloadedFilePath);

		exportedJson = JSON.parse(readFileSync(downloadedFilePath, 'utf-8')) as ExportedEnvelope;
		expect(exportedJson.version).toBe(1);
		expect(exportedJson.state.project.id).toBe(projectId);

		expect(exportedJson.state.activityProgress).toHaveLength(36);
		for (const progress of exportedJson.state.activityProgress) {
			expect(progress.status).toBe('concluída');
		}

		const situacaoAnswer = exportedJson.state.answers.find(
			(answer) => answer.fieldDefinitionId === 'situacao'
		);
		expect(situacaoAnswer?.value).toBe('As solicitações internas chegam sem padrão.');

		const usuarioPrincipalAnswer = exportedJson.state.answers.find(
			(answer) => answer.fieldDefinitionId === 'usuario_principal'
		);
		expect(usuarioPrincipalAnswer?.value).toBe(
			'Analista de atendimento que registra e acompanha solicitações.'
		);

		const necessidadeCentralAnswer = exportedJson.state.answers.find(
			(answer) => answer.fieldDefinitionId === 'necessidade_central'
		);
		expect(necessidadeCentralAnswer?.value).toBe('Centralizar e priorizar solicitações internas.');

		// prova que a última atividade da última fase (Validação e
		// encerramento) foi de fato alcançada e respondida — o encerramento
		// exige decisão explícita (allowsSkip: false).
		const resumoEncerramentoAnswer = exportedJson.state.answers.find(
			(answer) => answer.fieldDefinitionId === 'resumo_encerramento'
		);
		expect(resumoEncerramentoAnswer?.value).toBeTruthy();
	});

	await test.step('importar em banco limpo', async () => {
		await page.goto(serverB.baseUrl + '/');
		await page.getByLabel('Importar projeto (.json)').setInputFiles(downloadedFilePath);
		await page.getByRole('button', { name: 'Importar', exact: true }).click();

		await page.waitForURL(`${serverB.baseUrl}/projects/${projectId}/now`);
		await expect(
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' })
		).toBeVisible();
	});

	await test.step('reimportar deve colidir e não sobrescrever', async () => {
		await page.goto(serverB.baseUrl + '/');
		await page.getByLabel('Importar projeto (.json)').setInputFiles(downloadedFilePath);
		await page.getByRole('button', { name: 'Importar', exact: true }).click();

		await expect(page.getByRole('alert')).toContainText(
			`Já existe um projeto com o identificador "${projectId}"`
		);
		expect(page.url()).toBe(serverB.baseUrl + '/');

		await page.goto(`${serverB.baseUrl}/projects/${projectId}/now`);
		await expect(
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' })
		).toBeVisible();
	});

	expect(forbiddenSummaryRequests).toEqual([]);
});
