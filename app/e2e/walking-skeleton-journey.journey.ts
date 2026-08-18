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
	type EphemeralServer,
	getFreePort,
	startServer,
	stopServer,
	waitForServer
} from './helpers/ephemeral-server';
import { answerActivitiesGenericallyUntil } from './helpers/generic-activity';
import { catalog } from '../src/lib/catalog/catalog';

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

	await test.step('criar projeto: nome e origem já respondidos em /projects/new (D034) — chega direto a "Entender a situação"', async () => {
		await page.goto(`${serverA.baseUrl}/projects/new`);
		await page
			.getByPlaceholder('Ex.: Renovação do sistema de atendimento')
			.fill('Portal de Solicitações E2E');
		await page.getByRole('button', { name: 'Existe um problema' }).click();
		await page.getByRole('button', { name: 'Criar projeto e começar' }).click();

		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		if (!match) throw new Error('projectId não encontrado na URL após criar o projeto.');
		projectId = match[1];
	});

	await test.step('Entender a situação (wizard "problema": o quê / onde / peso / síntese / confirmação)', async () => {
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Existe muito retrabalho' }).click();
		await page.getByRole('button', { name: 'Continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Onde isso aparece principalmente?' })).toBeVisible();
		await page.getByRole('button', { name: 'Processo' }).click();
		await page.getByRole('button', { name: 'Continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Qual é o peso disso hoje?' })).toBeVisible();
		await page.getByRole('button', { name: 'É crítico' }).click();
		await page.getByRole('button', { name: 'Ver síntese' }).click();

		await expect(page.getByRole('heading', { name: 'É mais ou menos isso?' })).toBeVisible();
		await expect(page.locator('.es-synthesis-box')).toContainText(
			'Há um problema relacionado a retrabalho, percebido principalmente no processo, e é crítico hoje.'
		);
		await page.getByRole('button', { name: 'Sim, continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Etapa concluída' })).toBeVisible();
		await page.getByRole('button', { name: 'Continuar para próxima atividade' }).click();
	});

	await test.step('Quem é afetado (Mapa de Impacto)', async () => {
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
		await page.getByRole('button', { name: '+ Adicionar grupo' }).click();
		await page.getByRole('button', { name: 'Equipe interna', exact: true }).click();

		// O grupo nasce aberto para classificação imediata.
		await page.getByRole('button', { name: 'Alto', exact: true }).click();
		await page.getByRole('button', { name: 'Frequentemente', exact: true }).click();

		await page.getByRole('button', { name: 'Concluir mapa' }).click();
	});

	await test.step('Como é tratado hoje', async () => {
		await expect(page.getByRole('heading', { name: 'O que acontece quando isso aparece?' })).toBeVisible();
		await page.getByPlaceholder('Descrever em poucas palavras…').fill('Cada time usa sua própria planilha, sem padrão.');
		await page.getByRole('button', { name: 'Adicionar' }).click();
		await page.getByRole('button', { name: 'Continuar', exact: true }).click();
	});

	await test.step('Entender as causas', async () => {
		await expect(page.getByRole('heading', { name: 'O que pode estar por trás dessa situação?' })).toBeVisible();
		await page.getByRole('button', { name: 'Continuar', exact: true }).click();
	});

	await test.step('Resultado desejado', async () => {
		await expect(
			page.getByRole('heading', { name: 'O que deverá estar diferente quando este projeto tiver sucesso?' })
		).toBeVisible();
		await page
			.getByPlaceholder('O que deverá estar diferente?')
			.fill('Solicitações centralizadas, priorizadas e acompanháveis.');
		await page.getByRole('button', { name: 'Adicionar resultado' }).click();
		await page.getByRole('button', { name: 'Confirmar resultado' }).click();
	});

	await test.step('acessar o Checkpoint da Descoberta a partir de Agora', async () => {
		// "resumo" concluída → fluxo normal de Agora entra direto no Checkpoint
		// (S4D), sem card intermediário nem link de saída.
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/summary`);
	});

	await test.step('verificar respostas no Checkpoint', async () => {
		await expect(page.getByRole('heading', { name: 'Confira o que foi entendido antes de avançar' })).toBeVisible();

		// nome do projeto (cabeçalho persistente do layout do projeto) — o shell
		// mantém cabeçalho desktop e mobile simultaneamente no DOM (navegação
		// mobile do shell, subetapa 7.3), cada um com seu próprio "eyebrow" de
		// nome; esta jornada roda em viewport desktop, então escopa ao
		// cabeçalho desktop especificamente, sem depender de .first().
		const desktopHeader = page.locator('header.header-desktop');
		await expect(desktopHeader.getByText('Portal de Solicitações E2E')).toBeVisible();

		// Cada seção do Checkpoint (S4D) deriva dos mesmos objetos vivos, sem
		// redigitação — síntese de "Entender a situação" gerada
		// deterministicamente (catalog/situation-synthesis.ts).
		await expect(
			page
				.locator('#sec-situacao')
				.getByText('Há um problema relacionado a retrabalho, percebido principalmente no processo, e é crítico hoje.')
		).toBeVisible();
		// Síntese determinística do Mapa de Impacto (catalog/affected-group.ts),
		// não texto livre — reflete o grupo adicionado e classificado no passo
		// "Quem é afetado" acima.
		await expect(page.locator('#sec-afetados').getByText('Equipe interna')).toBeVisible();
		await expect(page.locator('#sec-afetados').getByText('Alto')).toBeVisible();
		await expect(page.locator('#sec-estado').getByText('Cada time usa sua própria planilha, sem padrão.')).toBeVisible();
		await expect(
			page.locator('#sec-resultado').getByText('Solicitações centralizadas, priorizadas e acompanháveis.')
		).toBeVisible();

		// Rail de status — as quatro seções obrigatórias completas.
		await expect(page.getByText('4 de 4')).toBeVisible();
	});

	await test.step('confirmar o Checkpoint', async () => {
		await page.getByRole('button', { name: 'Concluir Descoberta e avançar →' }).click();
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

	await test.step('demais atividades da fase 2 e da Estruturação respondidas genericamente', async () => {
		// Conteúdo específico de cada campo já é coberto por catalog.spec.ts e
		// por full-catalog-journey.spec.ts — aqui só precisa provar que a rota
		// real atravessa essas fases sem erro, até alcançar "Decompor o
		// trabalho" (primeira atividade de Planejamento, tratada à parte
		// abaixo). Sem contagem fixa: a quantidade de atividades genéricas até
		// lá é o que o catálogo definir, não um número mantido à mão aqui.
		await answerActivitiesGenericallyUntil(page, () =>
			page.getByRole('heading', { name: 'Decompor o trabalho' }).isVisible()
		);
	});

	const planningParts = [
		'Tela de abertura de solicitação',
		'Fluxo de aprovação',
		'Notificação por e-mail'
	];

	async function clickAndWaitForAnswer(locator: ReturnType<Page['getByRole']>): Promise<void> {
		await Promise.all([
			page.waitForResponse((response) => response.url().includes('?/answer') && response.request().method() === 'POST'),
			locator.click()
		]);
	}

	await test.step('Decompor o trabalho — Construir (3 partes, uma única vez)', async () => {
		await expect(page.getByRole('heading', { name: 'Decompor o trabalho' })).toBeVisible();

		for (let i = 0; i < planningParts.length; i++) {
			await page.getByRole('button', { name: 'Adicionar parte' }).click();
			await page
				.getByRole('textbox', { name: /Nome da parte/ })
				.nth(i)
				.fill(planningParts[i]);
		}

		await page.getByRole('button', { name: 'Salvar e continuar' }).click();
	});

	await test.step('Priorizar entregas — Operar (mesmos itens, sem redigitação, reordenar e confirmar)', async () => {
		await expect(page.getByRole('heading', { name: 'Priorizar entregas' })).toBeVisible();

		// Recebe exatamente os mesmos itens de "Decompor o trabalho" — nomes
		// somente leitura, nenhum campo de texto na tela.
		for (const part of planningParts) {
			await expect(page.getByText(part, { exact: true })).toBeVisible();
		}
		await expect(page.getByRole('textbox', { name: /Nome da parte/ })).toHaveCount(0);

		// Reordena só com ↑/↓: sobe "Notificação por e-mail" (3ª posição) até o
		// topo, duas vezes — a ordem final vira Notificação, Tela, Fluxo.
		const moveNotificacaoUp = page.getByRole('button', { name: 'Mover "Notificação por e-mail" para cima' });
		await clickAndWaitForAnswer(moveNotificacaoUp);
		await clickAndWaitForAnswer(moveNotificacaoUp);

		await page.getByRole('button', { name: 'Confirmar prioridade' }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/now`);
		// A confirmação usa redirect (303), diferente do round-trip AJAX que os
		// demais passos genéricos já esperam via waitForResponse — waitForURL só
		// garante a troca de URL, não que o Svelte já hidratou/renderizou o
		// formulário de "Mapear dependências". Sem esperar o heading, o próximo
		// passo genérico corre risco de preencher/submeter um formulário ainda
		// não pronto (falha real observada: "Please fill out this field.").
		await expect(page.getByRole('heading', { name: 'Mapear dependências' })).toBeVisible();
	});

	await test.step('demais atividades do catálogo (Planejamento restante, Execução, Validação) respondidas genericamente até o encerramento', async () => {
		// Sem contagem fixa: avança até o catálogo sinalizar
		// catalog_limit_reached (heading abaixo), qualquer que seja a
		// quantidade real de atividades restantes hoje.
		await answerActivitiesGenericallyUntil(page, () =>
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' }).isVisible()
		);
	});

	let downloadedFilePath = '';
	let exportedJson: ExportedEnvelope;

	await test.step('catalog_limit_reached e exportação', async () => {
		await expect(
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' })
		).toBeVisible();

		// Exportar (D031) virou página própria com ação explícita — o clique no
		// nav só abre a página; o download real exige clicar em "Baixar
		// exportação" nela.
		await page.getByRole('link', { name: 'Exportar' }).click();
		await page.waitForURL(`${serverA.baseUrl}/projects/${projectId}/export`);
		await expect(page.getByRole('heading', { name: 'Exportar projeto', level: 1 })).toBeVisible();

		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('link', { name: 'Baixar exportação' }).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe(`hydra-${projectId}.json`);

		downloadedFilePath = path.join(tmpRoot, 'export.json');
		await download.saveAs(downloadedFilePath);

		exportedJson = JSON.parse(readFileSync(downloadedFilePath, 'utf-8')) as ExportedEnvelope;
		expect(exportedJson.version).toBe(1);
		expect(exportedJson.state.project.id).toBe(projectId);

		// Toda atividade do catálogo real deve ter sido exportada — contagem
		// derivada do próprio catálogo (não um número mantido à mão), para não
		// exigir edição aqui sempre que uma atividade for adicionada/removida.
		const totalCatalogActivities = catalog.phases.reduce((sum, phase) => sum + phase.activities.length, 0);
		expect(exportedJson.state.activityProgress).toHaveLength(totalCatalogActivities);
		for (const progress of exportedJson.state.activityProgress) {
			expect(progress.status).toBe('concluída');
		}

		// Síntese determinística de "Entender a situação"
		// (catalog/situation-synthesis.ts) — não é mais texto digitado pelo
		// usuário, é composta a partir das seleções estruturadas.
		const situacaoAnswer = exportedJson.state.answers.find(
			(answer) => answer.fieldDefinitionId === 'situacao'
		);
		expect(situacaoAnswer?.value).toBe(
			'Há um problema relacionado a retrabalho, percebido principalmente no processo, e é crítico hoje.'
		);

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

		// C5-01 — prova que a ordem reorganizada em "Priorizar entregas"
		// persistiu na MESMA Answer de "Decompor o trabalho" (partes_trabalho),
		// nunca uma representação textual própria de prioridade.
		const partesTrabalhoAnswer = exportedJson.state.answers.find(
			(answer) => answer.fieldDefinitionId === 'partes_trabalho'
		);
		const planningItems = JSON.parse(partesTrabalhoAnswer?.value ?? '[]') as Array<{ text: string }>;
		expect(planningItems.map((item) => item.text)).toEqual([
			'Notificação por e-mail',
			'Tela de abertura de solicitação',
			'Fluxo de aprovação'
		]);

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
		// Home (identidade convergida, C6-01): "Importar" aciona um input de
		// arquivo escondido (sem <details> visível) — selecionar o arquivo já
		// submete o formulário real. O rótulo do input continua "Arquivo do
		// projeto (.json)".
		await page.getByLabel('Arquivo do projeto (.json)').setInputFiles(downloadedFilePath);

		await page.waitForURL(`${serverB.baseUrl}/projects/${projectId}/now`);
		await expect(
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' })
		).toBeVisible();
	});

	await test.step('reimportar deve colidir e não sobrescrever', async () => {
		await page.goto(serverB.baseUrl + '/');
		// Home (identidade convergida, C6-01): "Importar" aciona um input de
		// arquivo escondido (sem <details> visível) — selecionar o arquivo já
		// submete o formulário real. O rótulo do input continua "Arquivo do
		// projeto (.json)".
		await page.getByLabel('Arquivo do projeto (.json)').setInputFiles(downloadedFilePath);

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
