// Teste Playwright dedicado da Tela Mapa (C3-01). Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados, sem webServer global) — ver e2e/helpers/ephemeral-server.ts.
// Não modifica app/e2e/walking-skeleton-journey.journey.ts (jornada E2E
// canônica já concluída e aprovada na C2-12).

import { expect, test } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { completeDiscoveryViaFixture, openDb } from './helpers/db-fixtures';
import { answerActivitiesGenericallyUntil } from './helpers/generic-activity';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('map');

test('Mapa da jornada: navegação e estados do catálogo', async ({ page }) => {
	let projectId = '';

	await test.step('criar projeto e navegar ao Mapa (projeto no início)', async () => {
		projectId = await createProject(page, server.baseUrl);

		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/map`);
		// Rota/destino do shell continuam "Mapa"; o conteúdo principal virou a
		// Jornada (convergência da subetapa 7.3) — heading renomeado junto.
		await expect(page.getByRole('heading', { name: 'Jornada', level: 1 })).toBeVisible();
	});

	await test.step('projeto no início: fase Descoberta visível, atividade atual destacada', async () => {
		await expect(page.getByRole('heading', { name: 'Descoberta' })).toBeVisible();

		// Marcador de atividade atual é o rótulo "Atual" dentro do próprio item
		// da lista (displayStatusLabel em map/+page.svelte) — não há
		// aria-current nesta tela, o texto real é o marcador estrutural.
		// "Origem do projeto" já é respondida atomicamente em `/projects/new`
		// (D034) — a atividade atual logo após criar o projeto é "Entender a
		// situação" (id `problema`).
		const originItem = page.locator('li', { hasText: 'Origem do projeto' });
		await expect(originItem).toBeVisible();
		await expect(originItem.getByText('Concluída', { exact: true })).toBeVisible();

		const situationItem = page.locator('li', { hasText: 'Entender a situação' });
		await expect(situationItem).toBeVisible();
		await expect(situationItem.getByText('Atual', { exact: true })).toBeVisible();
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
		// A Jornada (/map) tem um CTA próprio "Continuar em Agora" além do link
		// de navegação do shell — escopar à navegação + nome exato evita a
		// ambiguidade (mesmo padrão de skip-activity.journey.ts).
		await page.getByRole('navigation').getByRole('link', { name: 'Agora', exact: true }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Agora' })).toBeVisible();

		await page.getByRole('link', { name: 'Resumo' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();

		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/map`);
		// Rota/destino do shell continuam "Mapa"; o conteúdo principal virou a
		// Jornada (convergência da subetapa 7.3) — heading renomeado junto.
		await expect(page.getByRole('heading', { name: 'Jornada', level: 1 })).toBeVisible();
	});

	await test.step('Descoberta concluída via fixture semântica (irrelevante à Jornada em si)', async () => {
		// A Descoberta usa o wizard bespoke "Entender a situação" e telas
		// próprias (Mapa de Impacto, Como é tratado hoje) já cobertas por
		// skip-activity.journey.ts, problema-optional-group.journey.ts e
		// como-e-tratado-hoje.journey.ts. Este teste só precisa chegar ao
		// estado "Descoberta concluída" — a fixture recria o lastro mínimo que
		// cada atividade exige para ser validamente 'concluída' pelo próprio
		// domínio (ver helpers/db-fixtures.ts), não só o rótulo de status.
		const db = openDb(server.dbPath);
		try {
			completeDiscoveryViaFixture(db, projectId);
		} finally {
			db.close();
		}

		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await page.getByRole('link', { name: /Ir para o Resumo da descoberta/ }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
	});

	await test.step('demais fases respondidas por operações reais (formulário genérico + Escolha o próximo foco), até catalog_limit_reached', async () => {
		await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

		// usuario_principal + visao_produto (campo a campo + etapa opcional) —
		// sem contagem fixa, avança até o link de "Escolha o próximo foco".
		await answerActivitiesGenericallyUntil(page, () =>
			page.getByRole('link', { name: /Ir para Escolha o próximo foco/ }).isVisible()
		);

		await page.getByRole('link', { name: /Ir para Escolha o próximo foco/ }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/next-version`);
		await page.getByLabel('Descrição do item').fill('Item de teste do Mapa.');
		await page.getByLabel('Onde esse item entra?').selectOption('agora');
		await page.getByRole('button', { name: 'Adicionar' }).click();
		await page.getByRole('button', { name: 'Pequeno', exact: true }).click();
		await page.getByRole('textbox', { name: 'Hipótese' }).fill('Hipótese de teste do Mapa.');
		await page.getByRole('textbox', { name: 'Hipótese' }).press('Tab'); // autosave dispara ao sair do campo
		await page.getByRole('button', { name: 'Confirmar foco' }).click();
		await page.getByRole('link', { name: 'Agora' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

		// Estruturação, Planejamento, Execução e Validação — conteúdo
		// específico já coberto por catalog.spec.ts e
		// full-catalog-journey.spec.ts; sem contagem fixa, avança até o
		// catálogo sinalizar catalog_limit_reached.
		await answerActivitiesGenericallyUntil(page, () =>
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' }).isVisible()
		);
	});

	await test.step('Mapa em catalog_limit_reached: todas as atividades concluídas, nenhuma marcada como atual', async () => {
		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/map`);
		await expect(page.getByRole('heading', { name: 'Jornada', level: 1 })).toBeVisible();

		// "Atual" também aparece fixo na legenda — escopar às fases reais
		// (.phases-column), excluindo a legenda, para confirmar que nenhuma
		// atividade de nenhuma fase está marcada como atual.
		await expect(page.locator('.phases-column').getByText('Atual', { exact: true })).toHaveCount(0);

		const descobertaSection = page.locator('section', { has: page.getByRole('heading', { name: 'Descoberta' }) });
		const activityItems = descobertaSection.locator('li');
		const completedItems = activityItems.filter({ hasText: 'Concluída' });
		await expect(completedItems).toHaveCount(await activityItems.count());
	});
});
