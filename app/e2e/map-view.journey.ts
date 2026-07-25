// Teste Playwright dedicado da Tela Mapa (C3-01). Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados, sem webServer global) — ver e2e/helpers/ephemeral-server.ts.
// Não modifica app/e2e/walking-skeleton-journey.journey.ts (jornada E2E
// canônica já concluída e aprovada na C2-12).

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
import { answerActivitiesGenerically } from './helpers/generic-activity';

let tmpRoot: string;
let server: EphemeralServer;

test.beforeAll(async () => {
	buildApp();

	tmpRoot = mkdtempSync(path.join(tmpdir(), 'hydra-e2e-map-'));
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

async function answerAndContinue(
	page: import('@playwright/test').Page,
	fields: Record<string, { label: string; value: string; kind?: 'select' }>
) {
	for (const { label, value, kind } of Object.values(fields)) {
		if (kind === 'select') {
			await page.getByLabel(label).selectOption(value);
		} else {
			await page.getByLabel(label).fill(value);
		}
	}
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

test('Mapa da jornada: navegação e estados do catálogo', async ({ page }) => {
	let projectId = '';

	await test.step('criar projeto e navegar ao Mapa (projeto no início)', async () => {
		await page.goto(server.baseUrl + '/');
		await page.getByRole('button', { name: 'Criar novo projeto' }).click();
		await page.waitForURL(/\/projects\/[^/]+\/now$/);
		const match = page.url().match(/\/projects\/([^/]+)\/now$/);
		expect(match).not.toBeNull();
		projectId = match![1];

		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/map`);
		await expect(page.getByRole('heading', { name: 'Mapa da jornada' })).toBeVisible();
	});

	await test.step('projeto no início: fase Descoberta visível, atividade atual destacada', async () => {
		await expect(page.getByRole('heading', { name: 'Descoberta' })).toBeVisible();
		await expect(page.getByText('Origem do projeto')).toBeVisible();
		await expect(page.getByText('Próxima atividade recomendada')).toBeVisible();
	});

	await test.step('todas as seis fases exibidas, cada uma com catálogo completo (jornada linear completa)', async () => {
		await expect(page.getByRole('heading', { name: 'Definição do produto' })).toBeVisible();
		await expect(page.getByText('Definir usuário principal')).toBeVisible();

		await expect(page.getByRole('heading', { name: 'Estruturação do projeto' })).toBeVisible();
		await expect(page.getByText('Definir objetivo e entregáveis')).toBeVisible();

		await expect(page.getByRole('heading', { name: 'Planejamento da entrega' })).toBeVisible();
		await expect(page.getByText('Decompor o trabalho')).toBeVisible();

		await expect(page.getByRole('heading', { name: 'Execução e acompanhamento' })).toBeVisible();
		await expect(page.getByText('Definir foco atual da execução')).toBeVisible();

		await expect(page.getByRole('heading', { name: 'Validação e encerramento' })).toBeVisible();
		await expect(page.getByText('Validar entregas e critérios de aceitação')).toBeVisible();

		await expect(page.getByText('Ainda não disponível nesta versão.')).toHaveCount(0);
	});

	await test.step('navegação Mapa → Agora → Resumo → Mapa', async () => {
		await page.getByRole('link', { name: 'Agora' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Agora' })).toBeVisible();

		await page.getByRole('link', { name: 'Resumo' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Resumo da descoberta' })).toBeVisible();

		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/map`);
		await expect(page.getByRole('heading', { name: 'Mapa da jornada' })).toBeVisible();
	});

	await test.step('avançar as 37 atividades reais até catalog_limit_reached', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);

		await answerAndContinue(page, {
			origem: { label: 'O que deu origem a este projeto?', value: 'Um problema', kind: 'select' }
		});

		await answerAndContinue(page, {
			nome: { label: 'Nome provisório do projeto', value: 'Projeto Mapa E2E' },
			descricao: { label: 'Breve descrição', value: 'Descrição breve para o teste do Mapa.' },
			modo: { label: 'Trabalho individual ou em equipe?', value: 'Individual', kind: 'select' },
			nivel: {
				label: 'Qual seu nível de experiência com gestão de projetos?',
				value: 'Intermediário',
				kind: 'select'
			},
			estagio: { label: 'Qual o estágio atual?', value: 'Em planejamento', kind: 'select' }
		});

		await answerAndContinue(page, {
			situacao: { label: 'Qual situação precisa mudar?', value: 'Situação de teste do Mapa.' },
			dificuldade: { label: 'Qual é a principal dificuldade?', value: 'Dificuldade de teste do Mapa.' }
		});

		await answerAndContinue(page, {
			publico: { label: 'Quem é afetado por esta situação, em detalhe?', value: 'Público de teste do Mapa.' }
		});

		await answerAndContinue(page, {
			estado: { label: 'Como a situação é tratada hoje, em detalhe?', value: 'Estado atual de teste do Mapa.' }
		});

		await answerAndContinue(page, {
			mudanca: {
				label: 'O que deverá estar diferente quando este projeto tiver sucesso?',
				value: 'Mudança de teste do Mapa.'
			},
			beneficiario: { label: 'Quem é o principal beneficiário?', value: 'Beneficiário de teste do Mapa.' },
			percepcao: { label: 'Como você vai perceber a melhoria?', value: 'Percepção de teste do Mapa.' }
		});

		await page.getByRole('link', { name: /Ir para o Resumo da descoberta/ }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await page.getByRole('button', { name: 'Confirmar resumo' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

		await answerAndContinue(page, {
			usuarioPrincipal: {
				label: 'Quem é o usuário principal do produto?',
				value: 'Usuário principal de teste do Mapa.'
			}
		});

		await answerAndContinue(page, {
			tipoProduto: { label: 'Que tipo de produto será?', value: 'Aplicativo web de teste do Mapa.' },
			necessidadeCentral: {
				label: 'Qual necessidade principal esse produto atende?',
				value: 'Necessidade central de teste do Mapa.'
			},
			beneficioCentral: {
				label: 'Qual benefício principal o produto deve entregar?',
				value: 'Benefício central de teste do Mapa.'
			}
		});

		await answerAndContinue(page, {
			funcionalidadesEssenciais: {
				label: 'Quais funcionalidades são essenciais?',
				value: 'Funcionalidades essenciais de teste do Mapa.'
			},
			valorEntregue: {
				label: 'Que valor essas funcionalidades entregam ao usuário?',
				value: 'Valor entregue de teste do Mapa.'
			}
		});

		// demais atividades (2 restantes da fase 2 + fases 3 a 6 = 27) —
		// conteúdo específico já coberto por catalog.spec.ts e
		// full-catalog-journey.spec.ts; aqui só prova que a rota real
		// atravessa até o fim sem erro.
		await answerActivitiesGenerically(page, 27);

		await expect(
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' })
		).toBeVisible();
	});

	await test.step('Mapa em catalog_limit_reached: todas as atividades concluídas, nenhuma marcada como atual', async () => {
		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/map`);

		await expect(page.getByText('Próxima atividade recomendada')).toHaveCount(0);

		const descobertaSection = page.locator('section', { has: page.getByRole('heading', { name: 'Descoberta' }) });
		const activityItems = descobertaSection.locator('li');
		const completedItems = activityItems.filter({ hasText: 'Concluída' });
		await expect(completedItems).toHaveCount(await activityItems.count());
	});
});
