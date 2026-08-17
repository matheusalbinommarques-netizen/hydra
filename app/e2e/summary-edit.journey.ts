// Teste Playwright dedicado da edição de atividades concluídas da Descoberta
// a partir do Resumo (Corte 3 da macroentrega de reaproveitamento). Amplia,
// de forma restrita, o gate de `?activity=` de now/+page.server.ts — só
// atividades required_fields da própria Descoberta, só quando já concluídas,
// só com o parâmetro explícito `from=summary`. Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados) — ver e2e/helpers/ephemeral-server.ts.

import { expect, test, type Page } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('summary-edit');

async function completeDiscoveryAndConfirmSummary(page: Page): Promise<string> {
	// Nome e origem já são respondidos atomicamente em `/projects/new` (D034)
	// — createProject() cobre isso. "Contexto inicial" foi incorporada/
	// removida do catálogo. "Entender a situação" (id `problema`) usa o
	// wizard bespoke EntenderSituacao.svelte — aqui os passos 2/3 (onde/peso)
	// são pulados, para que o passo de edição abaixo tenha algo real para
	// mudar.
	const projectId = await createProject(page, server.baseUrl);

	await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
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

	await page.getByPlaceholder('Descrever em poucas palavras…').fill('Estado atual original.');
	await page.getByRole('button', { name: 'Adicionar' }).click();
	await page.getByRole('button', { name: 'Continuar', exact: true }).click();

	// "Entender as causas" (Stage 4B do rework) — fora do escopo deste teste;
	// concluir sem nenhuma hipótese (nunca bloqueada) para chegar a "Resultado
	// desejado", sem depender do modal de "Pular etapa".
	await expect(page.getByRole('heading', { name: 'O que pode estar por trás dessa situação?' })).toBeVisible();
	await page.getByRole('button', { name: 'Continuar', exact: true }).click();

	await page.getByPlaceholder('O que deverá estar diferente?').fill('Resultado original.');
	await page.getByRole('button', { name: 'Adicionar resultado' }).click();
	await page.getByRole('button', { name: 'Confirmar resultado' }).click();

	await expect(page.getByRole('heading', { name: 'Resumo da descoberta' })).toBeVisible();
	await page.getByRole('link', { name: /Ir para o Resumo da descoberta/ }).click();
	await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
	await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
	await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

	return projectId;
}

test('editar "problema" a partir do Resumo: reabre atividade concluída, carrega valores, salva, volta ao resumo e invalida a confirmação anterior', async ({
	page
}) => {
	let projectId = '';

	await test.step('completar a Descoberta e confirmar o Resumo', async () => {
		projectId = await completeDiscoveryAndConfirmSummary(page);
		await expect(page.getByRole('heading', { name: 'Definir usuário principal' })).toBeVisible();
	});

	await test.step('ir ao Resumo e clicar em "Editar" no bloco Situação', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/summary`);
		await page.getByRole('link', { name: 'Editar situação' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now?activity=problema&from=summary`);
	});

	await test.step('reabre a atividade concluída (wizard "Entender a situação"), com o valor persistido pré-selecionado', async () => {
		// EntenderSituacao.svelte não mostra "Editando a partir do Resumo" (esse
		// texto só existe no ramo genérico de now/+page.svelte, que "problema"
		// nunca usa) — a chip previamente escolhida vem pré-selecionada.
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Existe muito retrabalho' })).toHaveClass(/selected/);
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toHaveCount(0);
	});

	await test.step('editar (adicionar outro sinal) e salvar retorna ao Resumo via "Etapa concluída" (não avança a jornada)', async () => {
		await page.getByRole('button', { name: 'Está demorando demais' }).click();
		await page.getByRole('button', { name: 'Continuar' }).click();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();

		await expect(page.locator('.es-synthesis-box')).toContainText('retrabalho');
		await expect(page.locator('.es-synthesis-box')).toContainText('demora');
		await page.getByRole('button', { name: 'Sim, continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Etapa concluída' })).toBeVisible();
		await page.getByRole('button', { name: 'Continuar para próxima atividade' }).click();

		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(
			page.locator('.overview .decision-value').getByText('Há um problema relacionado a retrabalho e demora.')
		).toBeVisible();
	});

	await test.step('a edição invalidou a confirmação anterior do Resumo', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Resumo da descoberta' })).toBeVisible();
	});
});

test('edição a partir do Resumo rejeita atividade de outra fase e ID inexistente, sem afetar o fluxo normal sem parâmetro', async ({
	page
}) => {
	let projectId = '';

	await test.step('completar a Descoberta e confirmar o Resumo', async () => {
		projectId = await completeDiscoveryAndConfirmSummary(page);
	});

	await test.step('activity de outra fase (usuario_principal, Definição) com from=summary é rejeitado', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now?activity=usuario_principal&from=summary`);
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
	});

	await test.step('activity inexistente com from=summary é rejeitado', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now?activity=nao_existe&from=summary`);
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/summary`);
		await expect(page.getByRole('heading', { name: 'Revisão e confirmação' })).toBeVisible();
	});

	await test.step('fluxo normal sem o parâmetro continua inalterado', async () => {
		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Definir usuário principal' })).toBeVisible();
	});
});
