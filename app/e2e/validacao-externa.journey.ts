// Jornada ponta a ponta da ETAPA 3 do rework ("Evidence + primeira External
// Action", docs/core/HYDRA_PRODUCT_REWORK.md §33) — prova o loop completo:
//
//   AffectedGroup → ExternalAction → navegação → retorno → Evidence → projeção
//
// Reescrita após a correção de UX pós-dogfooding: os pills isolados no topo
// e o box flutuante de captura foram reprovados por baixa discoverability.
// Esta versão prova a UX corrigida — affordance perceptível no próprio
// AffectedGroup, estado "Em campo" com "Registrar retorno" no card, faixa
// contextual no shell (1 e 2+ ações) e drawer de retorno identificando
// grupo + objetivo — além da prova mínima de duas ExternalActions abertas
// simultaneamente. Não repete a cobertura já existente de AffectedGroup/
// Mapa de Impacto (ETAPA 2) além do mínimo necessário para chegar a grupos
// classificados. Roda via playwright.journey.config.ts (servidor efêmero +
// banco temporário isolados) — ver e2e/helpers/ephemeral-server.ts.

import { expect, test } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('validacao-externa');

test('Validação Externa: AffectedGroup → ExternalAction → navegação → retorno → Evidence → projeção', async ({
	page
}) => {
	await test.step('criar projeto e pular "Entender a situação" para chegar ao Mapa de Impacto', async () => {
		await createProject(page, server.baseUrl);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
	});

	await test.step('elegibilidade de "Validar com essas pessoas" exige Impacto E Frequência (unknown conta como resposta)', async () => {
		await page.getByRole('button', { name: '+ Adicionar grupo' }).click();
		await page.getByRole('button', { name: 'Operação', exact: true }).click();
		const tile = page.locator('.mi-tile', { hasText: 'Operação' });

		// só grupo adicionado, nada classificado ainda — sem affordance.
		await expect(tile.getByRole('button', { name: 'Validar com essas pessoas' })).toHaveCount(0);

		// Impacto respondido, Frequência ainda pendente — continua sem affordance.
		await tile.getByRole('button', { name: 'Alto' }).click();
		await expect(tile.getByRole('button', { name: 'Validar com essas pessoas' })).toHaveCount(0);

		// Frequência respondida — affordance perceptível aparece (pergunta de
		// contexto + botão), Impacto E Frequência preenchidos.
		await tile.getByRole('button', { name: 'Constantemente' }).click();
		await expect(tile.getByText('Quer confirmar isso no mundo real?')).toBeVisible();
		await expect(tile.getByRole('button', { name: 'Validar com essas pessoas' })).toBeVisible();
	});

	await test.step('"Ainda não sabemos" (unknown) explícito em ambos os campos também torna o grupo elegível', async () => {
		await page.getByRole('button', { name: '+ Adicionar grupo' }).click();
		await page.getByRole('button', { name: 'Clientes ou usuários', exact: true }).click();
		const tile = page.locator('.mi-tile', { hasText: 'Clientes ou usuários' });

		await expect(tile.getByRole('button', { name: 'Validar com essas pessoas' })).toHaveCount(0);
		await tile.getByRole('button', { name: 'Ainda não sabemos' }).first().click();
		await expect(tile.getByRole('button', { name: 'Validar com essas pessoas' })).toHaveCount(0);
		await tile.getByRole('button', { name: 'Ainda não sabemos' }).last().click();
		await expect(tile.getByRole('button', { name: 'Validar com essas pessoas' })).toBeVisible();
	});

	await test.step('abrir a preparação de "Operação": mostra objetivo/perguntas/leve com você, sem criar ExternalAction nem faixa ainda', async () => {
		// Adicionar "Clientes ou usuários" no passo anterior expandiu aquele
		// tile e recolheu o de "Operação" (expandedGroupId é único) — reabre.
		const tile = page.locator('.mi-tile', { hasText: 'Operação' });
		await tile.locator('.mi-tile-head').click();
		await tile.getByRole('button', { name: 'Validar com essas pessoas' }).click();

		await expect(tile.getByText('Objetivo')).toBeVisible();
		await expect(tile.getByText('Confirmar como essa situação aparece para Operação.')).toBeVisible();
		await expect(tile.getByText('Perguntas')).toBeVisible();
		await expect(tile.getByText('Leve com você')).toBeVisible();
		await expect(tile.getByText('Tente voltar sabendo', { exact: true })).toBeVisible();

		await expect(page.locator('.external-actions-strip')).toHaveCount(0);
	});

	await test.step('"Pronto para conversar": o próprio AffectedGroup mostra "Em campo" + "Registrar retorno", e a faixa contextual (1 ação) aparece no shell', async () => {
		const tile = page.locator('.mi-tile', { hasText: 'Operação' });
		await tile.getByRole('button', { name: 'Pronto para conversar' }).click();

		await expect(tile.getByText('Em campo — validação em andamento')).toBeVisible();
		await expect(tile.getByRole('button', { name: 'Registrar retorno' })).toBeVisible();

		const strip = page.locator('.external-actions-strip');
		await expect(strip).toBeVisible();
		await expect(strip.getByText('Ação em campo — Operação')).toBeVisible();
		await expect(strip.getByRole('button', { name: 'Registrar retorno' })).toBeVisible();
	});

	await test.step('a faixa contextual continua claramente visível ao navegar para outra página do projeto', async () => {
		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(/\/records$/);
		const strip = page.locator('.external-actions-strip');
		await expect(strip).toBeVisible();
		await expect(strip.getByText('Ação em campo — Operação')).toBeVisible();
	});

	await test.step('retorno pela faixa: o drawer identifica grupo + objetivo, exige resultado + aprendizado, salva a Evidence', async () => {
		await page.locator('.external-actions-strip').getByRole('button', { name: 'Registrar retorno' }).click();

		const drawer = page.locator('.capture-drawer');
		await expect(drawer.getByText('Retorno da validação')).toBeVisible();
		await expect(drawer.getByText('Operação', { exact: true })).toBeVisible();
		await expect(drawer.getByText('Confirmar como essa situação aparece para Operação.')).toBeVisible();

		const saveButton = drawer.getByRole('button', { name: 'Salvar evidência' });
		await expect(saveButton).toBeDisabled();

		await drawer.getByRole('button', { name: 'Confirmou parcialmente' }).click();
		await expect(saveButton).toBeDisabled();

		await drawer.getByPlaceholder('Uma frase curta já basta.').fill('O retrabalho é real, mas só em picos de demanda.');
		await expect(saveButton).toBeEnabled();
		await saveButton.click();

		await expect(page.locator('.capture-drawer')).toHaveCount(0);
		await expect(page.locator('.external-actions-strip')).toHaveCount(0);
	});

	await test.step('Mapa de Impacto reflete a Evidence sem redigitação', async () => {
		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.getByRole('link', { name: /Continuar em Agora/ }).click();
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();

		const tile = page.locator('.mi-tile', { hasText: 'Operação' });
		await tile.locator('.mi-tile-head').click();
		await expect(tile.getByText('1 evidência')).toBeVisible();
		// Grupo volta a oferecer nova validação — evidência concluída não
		// bloqueia nem esconde a affordance.
		await expect(tile.getByRole('button', { name: 'Validar com essas pessoas' })).toBeVisible();
	});

	await test.step('Resumo e Documento refletem a Evidence sem redigitação', async () => {
		await page.getByRole('link', { name: 'Resumo' }).click();
		await page.waitForURL(/\/summary$/);
		await expect(page.getByText('Evidências: Operação (1 evidência).')).toBeVisible();

		await page.getByRole('link', { name: 'Documento' }).click();
		await page.waitForURL(/\/document$/);
		await expect(page.getByText('Evidências: Operação (1 evidência).')).toBeVisible();
		const evidenceBlock = page.locator('.evidence-block');
		await expect(evidenceBlock.getByText('Confirmou parcialmente', { exact: true })).toBeVisible();
		await expect(evidenceBlock.getByText('"O retrabalho é real, mas só em picos de demanda."')).toBeVisible();
		// Nada de roteiro/perguntas/preparation técnica no Documento.
		await expect(page.getByText('Quando isso costuma acontecer?')).toHaveCount(0);
	});

	await test.step('reload preserva Evidence e ExternalAction concluída (persistência real, não staging local)', async () => {
		await page.reload();
		await expect(page.getByText('Evidências: Operação (1 evidência).')).toBeVisible();
	});

	await test.step('duas ExternalActions abertas simultâneas: faixa compacta com "N ações em campo", "Ver ações" distingue cada grupo', async () => {
		await page.getByRole('link', { name: 'Mapa' }).click();
		await page.getByRole('link', { name: /Continuar em Agora/ }).click();
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();

		// Segunda validação de "Operação" (permitida — a anterior já concluiu).
		const operacaoTile = page.locator('.mi-tile', { hasText: 'Operação' });
		await operacaoTile.locator('.mi-tile-head').click();
		await operacaoTile.getByRole('button', { name: 'Validar com essas pessoas' }).click();
		await operacaoTile.getByRole('button', { name: 'Pronto para conversar' }).click();

		// Primeira validação de "Clientes ou usuários".
		const clientesTile = page.locator('.mi-tile', { hasText: 'Clientes ou usuários' });
		await clientesTile.locator('.mi-tile-head').click();
		await clientesTile.getByRole('button', { name: 'Validar com essas pessoas' }).click();
		await clientesTile.getByRole('button', { name: 'Pronto para conversar' }).click();

		const strip = page.locator('.external-actions-strip');
		await expect(strip.getByText('2 ações em campo · Operação · Clientes ou usuários')).toBeVisible();
		// Faixa compacta: sem lista de itens antes de expandir.
		await expect(strip.locator('.strip-list-item')).toHaveCount(0);

		await strip.getByRole('button', { name: 'Ver ações' }).click();
		const items = strip.locator('.strip-list-item');
		await expect(items).toHaveCount(2);
		await expect(items.filter({ hasText: 'Operação' })).toBeVisible();
		await expect(items.filter({ hasText: 'Clientes ou usuários' })).toBeVisible();
	});

	await test.step('concluir a ação de "Clientes ou usuários" pela faixa preserva a de "Operação" — faixa se adapta ao layout de 1 ação', async () => {
		const strip = page.locator('.external-actions-strip');
		await strip
			.locator('.strip-list-item')
			.filter({ hasText: 'Clientes ou usuários' })
			.getByRole('button', { name: 'Registrar retorno' })
			.click();

		const drawer = page.locator('.capture-drawer');
		await expect(drawer.getByText('Clientes ou usuários', { exact: true })).toBeVisible();
		await drawer.getByRole('button', { name: 'Descobri algo novo' }).click();
		await drawer.getByPlaceholder('Uma frase curta já basta.').fill('Eles nem sabiam que podiam pedir suporte direto.');
		await drawer.getByRole('button', { name: 'Salvar evidência' }).click();
		await expect(page.locator('.capture-drawer')).toHaveCount(0);

		// Só "Operação" continua aberta — faixa volta ao layout de uma ação só.
		await expect(strip.getByText('Ação em campo — Operação')).toBeVisible();
		await expect(strip.locator('.strip-list-item')).toHaveCount(0);
	});

	await test.step('concluir a última ação pelo próprio AffectedGroup faz a faixa desaparecer — as duas Evidences do grupo coexistem no Documento', async () => {
		const tile = page.locator('.mi-tile', { hasText: 'Operação' });
		await tile.locator('.mi-tile-head').click();
		await tile.getByRole('button', { name: 'Registrar retorno' }).click();

		const drawer = page.locator('.capture-drawer');
		await expect(drawer.getByText('Confirmar como essa situação aparece para Operação.')).toBeVisible();
		await drawer.getByRole('button', { name: 'Confirmou', exact: true }).click();
		await drawer.getByPlaceholder('Uma frase curta já basta.').fill('Segunda conversa: o padrão se repete em todas as equipes.');
		await drawer.getByRole('button', { name: 'Salvar evidência' }).click();

		await expect(page.locator('.external-actions-strip')).toHaveCount(0);

		await page.getByRole('link', { name: 'Documento' }).click();
		await page.waitForURL(/\/document$/);
		// Duas evidências de "Operação" + uma de "Clientes ou usuários" —
		// contagem por grupo, sem quebrar a apresentação combinada.
		await expect(page.getByText('Operação (2 evidências)')).toBeVisible();
		await expect(page.getByText('Clientes ou usuários (1 evidência)')).toBeVisible();
		const evidenceBlock = page.locator('.evidence-block');
		await expect(evidenceBlock.getByText('"O retrabalho é real, mas só em picos de demanda."')).toBeVisible();
		await expect(evidenceBlock.getByText('"Segunda conversa: o padrão se repete em todas as equipes."')).toBeVisible();
		await expect(evidenceBlock.getByText('"Eles nem sabiam que podiam pedir suporte direto."')).toBeVisible();
		await expect(evidenceBlock.locator('.evidence-item')).toHaveCount(3);
	});
});

test('Validação Externa — viewport 375px: sem overflow horizontal na faixa, no drawer e nos botões', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 800 });

	await test.step('criar grupo elegível e abrir a validação', async () => {
		await createProject(page, server.baseUrl);
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();

		await page.getByRole('button', { name: '+ Adicionar grupo' }).click();
		await page.getByRole('button', { name: 'Operação', exact: true }).click();
		const tile = page.locator('.mi-tile', { hasText: 'Operação' });
		await tile.getByRole('button', { name: 'Alto' }).click();
		await tile.getByRole('button', { name: 'Constantemente' }).click();
		await tile.getByRole('button', { name: 'Validar com essas pessoas' }).click();
		await tile.getByRole('button', { name: 'Pronto para conversar' }).click();
	});

	await test.step('faixa contextual não causa overflow horizontal', async () => {
		const strip = page.locator('.external-actions-strip');
		await expect(strip).toBeVisible();
		const overflowsX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
		expect(overflowsX).toBe(false);
	});

	await test.step('drawer de retorno não causa overflow horizontal e cabe no viewport', async () => {
		await page.locator('.external-actions-strip').getByRole('button', { name: 'Registrar retorno' }).click();
		const drawer = page.locator('.capture-drawer');
		await expect(drawer).toBeVisible();
		const box = await drawer.boundingBox();
		expect(box).not.toBeNull();
		if (box) expect(box.width).toBeLessThanOrEqual(375);

		const overflowsX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
		expect(overflowsX).toBe(false);
	});
});
