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
	type EphemeralServer,
	getFreePort,
	startServer,
	stopServer,
	waitForServer
} from './helpers/ephemeral-server';
import { createProject } from './helpers/create-project';
import { answerActivitiesGenerically } from './helpers/generic-activity';

let tmpRoot: string;
let server: EphemeralServer;

test.beforeAll(async () => {
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
	fields: Record<string, { label: string; value: string; kind?: 'select' | 'check' }>
) {
	for (const { label, value, kind } of Object.values(fields)) {
		if (kind === 'select') {
			await page.getByLabel(label).selectOption(value);
		} else if (kind === 'check') {
			await page.getByLabel(label).check();
		} else {
			await page.getByLabel(label).fill(value);
		}
	}
	await page.getByRole('button', { name: 'Salvar e continuar' }).click();
}

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

	await test.step('avançar as 35 atividades reais até catalog_limit_reached', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);

		// "Origem do projeto" já foi respondida atomicamente em `/projects/new`
		// (D034); "Contexto inicial" foi incorporada/removida do catálogo.
		// "Entender a situação" (id `problema`) usa o wizard bespoke
		// EntenderSituacao.svelte — ver skip-activity.journey.ts para a
		// cobertura dedicada.
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Existe muito retrabalho' }).click();
		await page.getByRole('button', { name: 'Continuar' }).click();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
		await page.getByRole('button', { name: 'Sim, continuar' }).click();
		await page.getByRole('button', { name: 'Continuar para próxima atividade' }).click();

		// "Quem é afetado" (Mapa de Impacto, ETAPA 2 do rework) não é mais
		// required_fields — não passa por answerAndContinue.
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
		await page.getByRole('button', { name: '+ Adicionar grupo' }).click();
		await page.getByRole('button', { name: 'Equipe interna', exact: true }).click();
		await page.getByRole('button', { name: 'Alto', exact: true }).click();
		await page.getByRole('button', { name: 'Frequentemente', exact: true }).click();
		await page.getByRole('button', { name: 'Concluir mapa' }).click();

		// "Como é tratado hoje" (Stage 4A do rework) também não é mais
		// required_fields — não passa por answerAndContinue.
		await expect(page.getByRole('heading', { name: 'O que acontece quando isso aparece?' })).toBeVisible();
		await page.getByPlaceholder('Descrever em poucas palavras…').fill('Estado atual de teste do Mapa.');
		await page.getByRole('button', { name: 'Adicionar' }).click();
		await page.getByRole('button', { name: 'Continuar', exact: true }).click();

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
		await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

		await answerAndContinue(page, {
			usuarioPrincipal: {
				label: 'Quem é o usuário principal do produto?',
				value: 'Usuário principal de teste do Mapa.'
			}
		});

		// "Definir visão do produto" idem — três campos obrigatórios campo a
		// campo, depois etapa opcional ("diferencial"), sem preencher nada.
		await answerAndContinue(page, {
			tipoProduto: { label: 'Que tipo de produto será?', value: 'Aplicativo web de teste do Mapa.' }
		});
		await answerAndContinue(page, {
			necessidadeCentral: {
				label: 'Qual necessidade principal esse produto atende?',
				value: 'Necessidade central de teste do Mapa.'
			}
		});
		await answerAndContinue(page, {
			beneficioCentral: {
				label: 'Qual benefício principal o produto deve entregar?',
				value: 'Benefício central de teste do Mapa.'
			}
		});
		await page.getByRole('link', { name: 'Avançar sem preencher' }).click();

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

		// demais atividades (1 restante da fase 2 + fases 3 a 6 = 26) —
		// conteúdo específico já coberto por catalog.spec.ts e
		// full-catalog-journey.spec.ts; aqui só prova que a rota real
		// atravessa até o fim sem erro.
		await answerActivitiesGenerically(page, 26);

		await expect(
			page.getByRole('heading', { name: 'Você concluiu todas as atividades disponíveis' })
		).toBeVisible();
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
