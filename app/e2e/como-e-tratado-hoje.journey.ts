// Jornada ponta a ponta de Stage 4A do rework ("Como é tratado hoje",
// docs/core/HYDRA_PRODUCT_REWORK.md §34) — prova a construção visual da
// cadeia de tratamento atual (adicionar/reordenar/remover passo, contexto e
// fricções, estado "sem tratamento definido" e volta), a síntese derivada, a
// conclusão da atividade e a persistência real (reload). Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados) — ver e2e/helpers/ephemeral-server.ts.

import { expect, test, type Page } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('como-e-tratado-hoje');

// Passos da cadeia de tratamento atual, por role/accessible name
// (ComoETratadoHoje.svelte: role="list" + aria-label na cadeia, role="listitem"
// em cada passo real — a affordance "+ adicionar passo" fica fora do role
// listitem, então não precisa de exclusão por classe). Contrato estável a
// rename de classe CSS ornamental (ver incidente histórico com
// .cet-step-card → .cet-node-row).
function chainSteps(page: Page) {
	return page.getByRole('list', { name: 'Cadeia de tratamento atual' }).getByRole('listitem');
}

test('Como é tratado hoje: cadeia, reordenação, contexto/fricções, noTreatment, conclusão e persistência', async ({
	page
}) => {
	await test.step('criar projeto, pular "Entender a situação", mapear um grupo e chegar a "Como é tratado hoje"', async () => {
		await createProject(page, server.baseUrl);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();

		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
		await page.getByRole('button', { name: '+ Adicionar grupo' }).click();
		await page.getByRole('button', { name: 'Ver mais sugestões' }).click();
		await page.getByRole('button', { name: 'Financeiro', exact: true }).click();
		const tile = page.locator('.mi-tile', { hasText: 'Financeiro' });
		await tile.getByRole('button', { name: 'Alto', exact: true }).click();
		await tile.getByRole('button', { name: 'Constantemente', exact: true }).click();
		await page.getByRole('button', { name: 'Concluir mapa' }).click();

		await expect(page.getByRole('heading', { name: 'O que acontece quando isso aparece?' })).toBeVisible();
	});

	await test.step('sem passos: "Continuar" não aparece; "Hoje não existe um tratamento definido" está visível e descobrível', async () => {
		await expect(page.getByRole('button', { name: 'Continuar', exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Hoje não existe um tratamento definido' })).toBeVisible();
	});

	await test.step('primeiro passo: pergunta inicial, cadeia começa vazia com "O que costuma acontecer primeiro?"', async () => {
		await expect(page.getByText('O que costuma acontecer primeiro?')).toBeVisible();
		await page.getByPlaceholder('Descrever em poucas palavras…').fill('Financeiro percebe o atraso');
		await page.getByRole('button', { name: 'Adicionar', exact: true }).click();

		await expect(chainSteps(page)).toHaveCount(1);
		await expect(chainSteps(page).getByText('Financeiro percebe o atraso')).toBeVisible();
	});

	await test.step('segundo passo: prompt vira "E depois?"', async () => {
		await expect(page.getByText('E depois?')).toBeVisible();
		await page.getByPlaceholder('Descrever em poucas palavras…').fill('Gestor aprova manualmente');
		await page.getByRole('button', { name: 'Adicionar', exact: true }).click();

		await expect(chainSteps(page)).toHaveCount(2);
		const cards = chainSteps(page);
		await expect(cards.nth(0)).toContainText('Financeiro percebe o atraso');
		await expect(cards.nth(1)).toContainText('Gestor aprova manualmente');
	});

	await test.step('reordenar: mover o segundo passo para cima troca a ordem exibida', async () => {
		const cards = chainSteps(page);
		await cards.nth(1).getByRole('button', { name: 'Mover para cima' }).click();

		await expect(cards.nth(0)).toContainText('Gestor aprova manualmente');
		await expect(cards.nth(1)).toContainText('Financeiro percebe o atraso');

		// desfaz para manter a ordem esperada pelos passos seguintes
		await cards.nth(0).getByRole('button', { name: 'Mover para baixo' }).click();
		await expect(cards.nth(0)).toContainText('Financeiro percebe o atraso');
	});

	await test.step('contexto e fricções ficam atrás de uma affordance secundária, fechada por padrão', async () => {
		const firstCard = chainSteps(page).nth(0);
		await expect(firstCard.getByText('Quem atua aqui?')).toHaveCount(0);

		await firstCard.getByRole('button', { name: '+ Adicionar contexto e fricções' }).click();
		await expect(firstCard.getByText('Quem atua aqui? (opcional)')).toBeVisible();
	});

	await test.step('quem atua: sugestão vem do AffectedGroup real do projeto (Financeiro)', async () => {
		const firstCard = chainSteps(page).nth(0);
		await firstCard.getByRole('button', { name: 'Financeiro', exact: true }).click();
		await expect(firstCard.locator('.cet-tag-actor', { hasText: 'Financeiro' })).toBeVisible();
	});

	await test.step('meio/ferramenta: seleciona uma sugestão genérica', async () => {
		const firstCard = chainSteps(page).nth(0);
		await firstCard.getByRole('button', { name: 'Planilha', exact: true }).click();
		await expect(firstCard.locator('.cet-tag-medium', { hasText: 'Planilha' })).toBeVisible();
	});

	await test.step('fricção: pode marcar mais de uma', async () => {
		const firstCard = chainSteps(page).nth(0);
		await firstCard.getByRole('button', { name: 'Espera', exact: true }).click();
		await firstCard.getByRole('button', { name: 'Retrabalho', exact: true }).click();
		await expect(firstCard.locator('.cet-tag-friction')).toHaveCount(2);
	});

	await test.step('síntese derivada ("Como funciona hoje") lê a sequência reduzida (Primeiro/Depois), sem ator/meio, com fricções consolidadas', async () => {
		const synthesis = page.locator('.cet-synthesis');
		await expect(synthesis.getByText('Como funciona hoje')).toBeVisible();
		await expect(synthesis.locator('.cet-synthesis-text')).toHaveText(
			'Primeiro: Financeiro percebe o atraso. Depois: Gestor aprova manualmente. Fricções observadas: espera e retrabalho.'
		);
		// ator e meio ficam só na cadeia — não são reinjetados na síntese.
		await expect(synthesis).not.toContainText('Planilha');
	});

	await test.step('remover um passo: cadeia volta a ter 1 passo', async () => {
		const cards = chainSteps(page);
		await cards.nth(1).getByRole('button', { name: 'Remover passo' }).click();
		await expect(chainSteps(page)).toHaveCount(1);
	});

	await test.step('"Hoje não existe um tratamento definido": alterna o estado e permite voltar', async () => {
		await page.getByRole('button', { name: 'Hoje não existe um tratamento definido' }).click();
		await expect(page.getByText('Hoje não existe um tratamento definido. Quando isso aparece')).toBeVisible();
		await expect(chainSteps(page)).toHaveCount(0);

		// voltar a descrever
		await page.getByRole('button', { name: 'Na verdade, existe algo — quero descrever' }).click();
		await expect(page.getByText('O que costuma acontecer primeiro?')).toBeVisible();
	});

	await test.step('adicionar um passo de novo e concluir a atividade', async () => {
		await page.getByPlaceholder('Descrever em poucas palavras…').fill('Financeiro percebe o atraso');
		await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
		await expect(chainSteps(page)).toHaveCount(1);

		await page.getByRole('button', { name: 'Continuar', exact: true }).click();

		// "Entender as causas" (Stage 4B do rework) — heading próprio, fora do
		// escopo deste teste; concluir sem nenhuma hipótese (nunca bloqueada)
		// para chegar a "Resultado desejado".
		await expect(page.getByRole('heading', { name: 'O que pode estar por trás dessa situação?' })).toBeVisible();
		await page.getByRole('button', { name: 'Continuar', exact: true }).click();

		// "Resultado desejado" (Stage 4C do rework) — heading próprio.
		await expect(
			page.getByRole('heading', { name: 'O que deverá estar diferente quando este projeto tiver sucesso?' })
		).toBeVisible();
	});

	await test.step('Resumo e Documento refletem "Como é tratado hoje" sem redigitação', async () => {
		await page.getByRole('link', { name: 'Resumo' }).click();
		await page.waitForURL(/\/summary$/);
		const overview = page.locator('.overview');
		await expect(overview.getByRole('heading', { name: 'Como é tratado hoje' })).toBeVisible();
		await expect(overview.getByText('1 etapa descrita.')).toBeVisible();

		await page.getByRole('link', { name: 'Documento' }).click();
		await page.waitForURL(/\/document$/);
		const document = page.locator('.document');
		await expect(document.getByRole('heading', { name: 'Como é tratado hoje' })).toBeVisible();
		await expect(document.getByText('1 etapa descrita.')).toBeVisible();
	});

	await test.step('reload preserva a cadeia (persistência real, não staging local)', async () => {
		await page.goto(`${page.url()}`);
		await page.getByRole('link', { name: 'Agora', exact: true }).click();
		await page.waitForURL(/\/now$/);
		// A jornada já avançou para "Resultado desejado" — "Como é tratado hoje"
		// não é required_fields (sem seção "Respostas" em Registros); revisitar
		// via Resumo confirma a persistência real do reload.
		await page.getByRole('link', { name: 'Resumo' }).click();
		await page.waitForURL(/\/summary$/);
		await expect(page.locator('.overview').getByText('Financeiro percebe o atraso')).toBeVisible();
	});
});

test('Como é tratado hoje — viewport 375px: sem overflow horizontal na cadeia e no contexto expandido', async ({
	page
}) => {
	await page.setViewportSize({ width: 375, height: 800 });

	await test.step('chegar a "Como é tratado hoje" e adicionar um passo com contexto', async () => {
		await createProject(page, server.baseUrl);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();

		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();

		await expect(page.getByRole('heading', { name: 'O que acontece quando isso aparece?' })).toBeVisible();
		await page.getByPlaceholder('Descrever em poucas palavras…').fill('Financeiro percebe o atraso');
		await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
		await chainSteps(page).getByRole('button', { name: '+ Adicionar contexto e fricções' }).click();
	});

	await test.step('sem overflow horizontal', async () => {
		const overflowsX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
		expect(overflowsX).toBe(false);
	});
});
