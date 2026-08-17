// Teste Playwright dedicado da apresentação "um campo por vez" da Bancada
// (Descoberta + Definição do produto) — painel lateral "O que já sabemos"
// crescendo a cada resposta, etapa opcional agrupada ao final e conclusão da
// atividade idêntica à de um envio único. Roda via playwright.journey.config.ts
// (servidor efêmero + banco temporário isolados) — ver
// e2e/helpers/ephemeral-server.ts.
//
// Reescrito para o comportamento real e aprovado atual (Etapa 0,
// docs/core/HYDRA_PRODUCT_REWORK.md): "problema" ("Entender a situação") não
// usa mais a apresentação campo a campo genérica — tem componente bespoke
// próprio (EntenderSituacao.svelte, ver skip-activity.journey.ts e
// problema-optional-group.journey.ts para a cobertura dele). "visao_produto"
// ("Definir visão do produto") é hoje a única atividade que ainda passa pela
// apresentação campo a campo genérica com múltiplos campos obrigatórios de
// texto e um campo opcional ao final (now/+page.server.ts,
// DECOMPOSED_ACTIVITY_IDS) — é o melhor caso de prova real disponível hoje
// para esse mecanismo.

import { expect, test } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('bancada-field-by-field');

async function skipCurrentActivity(page: import('@playwright/test').Page): Promise<void> {
	await page.getByRole('button', { name: 'Pular etapa' }).click();
	await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();
}

test('Bancada: "Definir visão do produto" campo a campo, painel crescendo, etapa opcional e conclusão equivalente a envio único', async ({
	page
}) => {
	await test.step('criar projeto e pular toda a Descoberta para chegar a "Definir visão do produto"', async () => {
		await createProject(page, server.baseUrl);

		// Entender a situação (wizard bespoke) tem seu próprio "Pular etapa".
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await skipCurrentActivity(page);

		// "Quem é afetado" (Mapa de Impacto, ETAPA 2 do rework) tem componente
		// bespoke próprio (MapaDeImpacto.svelte) — heading próprio, fora do loop
		// genérico abaixo.
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
		await skipCurrentActivity(page);

		// "Como é tratado hoje" (Stage 4A do rework) também tem componente
		// bespoke próprio (ComoETratadoHoje.svelte) — heading próprio, fora do
		// loop genérico abaixo.
		await expect(page.getByRole('heading', { name: 'O que acontece quando isso aparece?' })).toBeVisible();
		await skipCurrentActivity(page);

		// "Entender as causas" (Stage 4B do rework) também tem componente
		// bespoke próprio (EntenderCausas.svelte) — heading próprio, fora do
		// loop genérico abaixo.
		await expect(page.getByRole('heading', { name: 'O que pode estar por trás dessa situação?' })).toBeVisible();
		await skipCurrentActivity(page);

		for (const heading of ['Resultado desejado']) {
			await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
			await skipCurrentActivity(page);
		}

		await expect(page.getByRole('heading', { name: 'Resumo da descoberta', exact: true })).toBeVisible();
		await page.getByRole('link', { name: /Ir para o Resumo da descoberta/ }).click();
		await page.getByRole('button', { name: 'Confirmar e avançar' }).click();
		await page.waitForURL(/\/now$/);
	});

	await test.step('"Definir usuário principal" respondida de uma vez (não decomposta) para chegar a "Definir visão do produto"', async () => {
		await expect(page.getByRole('heading', { name: 'Definir usuário principal', exact: true })).toBeVisible();
		await page
			.getByLabel('Quem é o usuário principal do produto?')
			.fill('Analista de atendimento que registra e acompanha solicitações.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Definir visão do produto', exact: true })).toBeVisible();
	});

	// A `<aside>` externa é o complementary real ("Progresso e contexto");
	// este painel específico é uma `<section>` aninhada com nome próprio, que
	// a ARIA mapeia para "region", não "complementary".
	const panel = page.getByRole('region', { name: 'O que já sabemos até aqui' });

	await test.step('painel já não está vazio (Origem + Usuário principal já respondidos), mas ainda sem bloco "Visão do produto"', async () => {
		await expect(panel).toBeVisible();
		await expect(panel.getByText('Ainda não há respostas suficientes para mostrar aqui.')).toHaveCount(0);
		await expect(panel.getByText('Origem do projeto')).toBeVisible();
		await expect(panel.getByText('Usuário principal')).toBeVisible();
		await expect(panel.getByText('Visão do produto')).toHaveCount(0);
	});

	await test.step('primeiro campo: só "tipo_produto" visível', async () => {
		await expect(page.getByLabel('Que tipo de produto será?')).toBeVisible();
		await expect(page.getByLabel('Qual necessidade principal esse produto atende?')).toHaveCount(0);
		await expect(page.getByLabel('Qual benefício principal o produto deve entregar?')).toHaveCount(0);
	});

	await test.step('responder "tipo_produto": painel ainda sem bloco "Visão do produto" (depende de "necessidade_central")', async () => {
		await page.getByLabel('Que tipo de produto será?').fill('Portal web de solicitações.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Definir visão do produto', exact: true })).toBeVisible();
		await expect(panel.getByText('Visão do produto')).toHaveCount(0);
	});

	await test.step('segundo campo: só "necessidade_central" visível, "tipo_produto" não é mais mostrado no formulário', async () => {
		await expect(page.getByLabel('Qual necessidade principal esse produto atende?')).toBeVisible();
		await expect(page.getByLabel('Que tipo de produto será?')).toHaveCount(0);
	});

	await test.step('responder "necessidade_central": painel ganha o bloco "Visão do produto"', async () => {
		await page
			.getByLabel('Qual necessidade principal esse produto atende?')
			.fill('Centralizar e priorizar solicitações internas.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(panel.getByText('Visão do produto')).toBeVisible();
		await expect(panel.getByText('Centralizar e priorizar solicitações internas.')).toBeVisible();
	});

	await test.step('terceiro campo (último obrigatório): só "beneficio_central" visível', async () => {
		await expect(page.getByLabel('Qual benefício principal o produto deve entregar?')).toBeVisible();
		await expect(page.getByLabel('Qual necessidade principal esse produto atende?')).toHaveCount(0);
	});

	await test.step('responder "beneficio_central" (último obrigatório): etapa opcional aparece com só "diferencial"', async () => {
		await page
			.getByLabel('Qual benefício principal o produto deve entregar?')
			.fill('Resposta mais rápida e menos retrabalho.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByText('Mais contexto (opcional)')).toBeVisible();
		await expect(page.getByLabel('O que diferencia essa proposta das alternativas atuais?')).toBeVisible();
		// A etapa opcional não repete os campos já respondidos.
		await expect(page.getByLabel('Que tipo de produto será?')).toHaveCount(0);
		await expect(page.getByLabel('Qual necessidade principal esse produto atende?')).toHaveCount(0);
		await expect(page.getByLabel('Qual benefício principal o produto deve entregar?')).toHaveCount(0);
	});

	await test.step('preencher o campo opcional e salvar (não pular) avança para a próxima atividade', async () => {
		await page
			.getByLabel('O que diferencia essa proposta das alternativas atuais?')
			.fill('Orientação contextual em vez de apenas ferramentas soltas.');
		await page.getByRole('button', { name: 'Salvar e continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Escolha o próximo foco', exact: true })).toBeVisible();
	});

	await test.step('conclusão equivalente a um envio único: os quatro valores persistidos em Registros, campo a campo', async () => {
		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(/\/records$/);

		const activity = page
			.locator('.phase-card')
			.filter({ hasText: 'Definição do produto' })
			.locator('.activity')
			.filter({ hasText: 'Definir visão do produto' });

		await expect(activity.getByText('Portal web de solicitações.')).toBeVisible();
		await expect(activity.getByText('Centralizar e priorizar solicitações internas.')).toBeVisible();
		await expect(activity.getByText('Resposta mais rápida e menos retrabalho.')).toBeVisible();
		await expect(activity.getByText('Orientação contextual em vez de apenas ferramentas soltas.')).toBeVisible();
	});
});
