// Teste Playwright dedicado da interface de "Pular etapa" (C4-02). Roda via
// playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados) — ver e2e/helpers/ephemeral-server.ts. Não modifica
// walking-skeleton-journey.journey.ts, map-view.journey.ts nem
// records-view.journey.ts.
//
// Reescrito para o comportamento real e aprovado atual (Etapa 0,
// docs/core/HYDRA_PRODUCT_REWORK.md): "Origem do projeto" é respondida
// atomicamente na criação do projeto (`/projects/new`, D034) e "Contexto
// inicial" foi incorporada/removida do catálogo — a primeira atividade
// pulável alcançada logo após criar o projeto é "Entender a situação"
// (id interno `problema`), cuja interface é o wizard bespoke
// EntenderSituacao.svelte, não o formulário genérico. O botão "Pular etapa"
// (SkipActivityConfirm.svelte) é o mesmo componente reaproveitado ali.
//
// A verificação de "atividade não pulável não exibe o botão" usa o mesmo
// atalho de fixture já estabelecido em records-view.journey.ts: escrever
// direto no SQLite do servidor efêmero para chegar ao Resumo (única
// atividade com allowsSkip=false) sem percorrer manualmente todo o
// catálogo pela UI — a validação de que allowsSkip governa a visibilidade
// do botão já é responsabilidade da interface, não do domínio.

import { expect, test } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { completeDiscoveryViaFixture, openDb } from './helpers/db-fixtures';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('skip');

test('Pular etapa: modal, retomada e pendências', async ({ page }) => {
	let projectId = '';

	await test.step('criar projeto: Origem já respondida na criação, chega direto a "Entender a situação" (pulável)', async () => {
		projectId = await createProject(page, server.baseUrl);

		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toBeVisible();
	});

	await test.step('modal apresenta a consequência correta', async () => {
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		const dialog = page.locator('dialog[open]');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('heading', { name: 'Pular "Entender a situação"?' })).toBeVisible();
		await expect(dialog.getByText('Esta etapa não será concluída agora.')).toBeVisible();
		await expect(
			dialog.getByText('As recomendações seguintes podem ser menos precisas sem essa informação.')
		).toBeVisible();
		await expect(dialog.getByText(/Uma pendência será criada/)).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible();
		await expect(dialog.getByRole('button', { name: 'Confirmar' })).toBeVisible();
	});

	await test.step('Escape fecha o modal sem confirmar o skip', async () => {
		const urlBeforeEscape = page.url();

		await page.keyboard.press('Escape');
		await expect(page.locator('dialog[open]')).toHaveCount(0);

		expect(page.url()).toBe(urlBeforeEscape);
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await expect(page.locator('.pendencias')).toHaveCount(0);
	});

	await test.step('cancelar fecha o modal sem alterar nada', async () => {
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await expect(page.locator('dialog[open]')).toBeVisible();

		await page.locator('dialog[open]').getByRole('button', { name: 'Cancelar' }).click();
		await expect(page.locator('dialog[open]')).toHaveCount(0);

		await page.reload();
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await expect(page.locator('.pendencias')).toHaveCount(0);
	});

	await test.step('confirmar pula a etapa: cria pendência e avança a recomendação', async () => {
		await page.getByRole('button', { name: 'Pular etapa' }).click();
		await page.locator('dialog[open]').getByRole('button', { name: 'Confirmar' }).click();

		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();

		await expect(page.getByText('Situação não foi detalhada')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Retomar etapa' })).toBeVisible();
	});

	// Pendências abertas não aparecem mais em Registros (D028,
	// docs/07-management/decision-log.md) — já cobertas por Agora (verificado
	// no passo anterior) e por Acompanhamento, que é onde esta checagem
	// cruzada de superfície passa a viver.
	await test.step('Acompanhamento reflete a pendência aberta', async () => {
		await page.getByRole('link', { name: 'Acompanhamento' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/tracking`);

		const attentions = page.getByRole('region', { name: 'Atenções' });
		const pendingItem = attentions.getByRole('listitem').filter({ hasText: 'Situação não foi detalhada' });
		await expect(pendingItem).toHaveCount(1);
		await expect(pendingItem.getByText('Pendência', { exact: true })).toBeVisible();
	});

	await test.step('Retomar etapa reabre a atividade pulada (wizard "Entender a situação", do início)', async () => {
		// A página de Acompanhamento tem dois links contendo "Agora": o de
		// navegação do shell ("Agora", nome exato) e o de continuidade
		// ("Continuar em Agora →"). Escopar à navegação + nome exato evita a
		// ambiguidade sem usar .first() nem posição.
		await page.getByRole('navigation').getByRole('link', { name: 'Agora', exact: true }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now`);

		await page.getByRole('link', { name: 'Retomar etapa' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/now?activity=problema`);
		// EntenderSituacao.svelte não recebe sinal de "retomando pulada" (só
		// generic ActivityForm mostra "Retomando etapa pulada") — retomar uma
		// atividade pulada reabre o wizard normalmente, do passo 1, com o botão
		// "Pular etapa" ainda disponível (comportamento real atual).
		await expect(page.getByRole('heading', { name: 'O que está acontecendo?', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toBeVisible();
	});

	await test.step('responder a atividade retomada resolve a pendência e volta ao fluxo canônico', async () => {
		await page.getByRole('button', { name: 'Existe muito retrabalho' }).click();
		await page.getByRole('button', { name: 'Continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Onde isso aparece principalmente?' })).toBeVisible();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();

		await expect(page.getByRole('heading', { name: 'Qual é o peso disso hoje?' })).toBeVisible();
		await page.getByRole('button', { name: 'Pular esta pergunta' }).click();

		await expect(page.getByRole('heading', { name: 'É mais ou menos isso?' })).toBeVisible();
		await page.getByRole('button', { name: 'Sim, continuar' }).click();

		await expect(page.getByRole('heading', { name: 'Etapa concluída' })).toBeVisible();
		await page.getByRole('button', { name: 'Continuar para próxima atividade' }).click();

		await expect(page.getByRole('heading', { name: 'Quem sente mais essa situação?' })).toBeVisible();
		await expect(page.locator('.pendencias')).toHaveCount(0);

		await page.getByRole('link', { name: 'Registros' }).click();
		await page.waitForURL(`${server.baseUrl}/projects/${projectId}/records`);
		const resolvedSection = page.getByRole('region', { name: 'Pendências resolvidas' });
		await expect(resolvedSection.getByText('Atividade: Entender a situação · Resolvida')).toBeVisible();
	});

	await test.step('atividade não pulável (Resumo) não exibe o botão', async () => {
		const db = openDb(server.dbPath);
		try {
			completeDiscoveryViaFixture(db, projectId);
		} finally {
			db.close();
		}

		await page.goto(`${server.baseUrl}/projects/${projectId}/now`);
		await expect(page.getByRole('heading', { name: 'Resumo da descoberta', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pular etapa' })).toHaveCount(0);
	});
});
