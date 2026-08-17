// Helper genérico para avançar atividades `required_fields` em jornadas
// Playwright sem precisar conhecer o rótulo de cada campo — usado para
// atravessar trechos do catálogo cujo conteúdo específico já é coberto por
// testes de catálogo (catalog.spec.ts) e pela jornada de integração em
// Vitest (full-catalog-journey.spec.ts), evitando duplicar dezenas de
// passos "preencher campo X, clicar Salvar e continuar" por atividade nova.
//
// Preenche todo campo obrigatório visível no formulário da atividade atual
// com um valor trivial e envia. Não serve para "Resumo da descoberta"
// (explicit_confirmation, sem formulário) — essa atividade continua exigindo
// o passo específico de "Confirmar resumo" em cada jornada.
//
// Duas interações adicionais reconhecidas por affordance observável, não por
// id de atividade (C5-01):
// - um campo `lista_partes` (ex.: "Decompor o trabalho") se revela pelo
//   botão "Adicionar parte" dentro do próprio formulário — adiciona uma
//   parte, preenche um texto não vazio e segue o fluxo normal de "Salvar e
//   continuar";
// - uma confirmação de prioridade sobre coleção já existente (ex.:
//   "Priorizar entregas") não tem formulário com "Salvar e continuar": se
//   revela pelo botão "Confirmar prioridade", que já opera sobre os itens
//   herdados da atividade anterior, sem necessidade de reordenar nada aqui
//   (a reordenação por ↑/↓ já é coberta pela walking-skeleton).

import type { Page } from '@playwright/test';

export async function answerCurrentActivityGenerically(page: Page): Promise<void> {
	const confirmPriorityButton = page.getByRole('button', { name: 'Confirmar prioridade' });
	if (await confirmPriorityButton.count()) {
		await Promise.all([
			page.waitForResponse(
				(response) =>
					response.url().includes('?/confirmPlanningPriority') && response.request().method() === 'POST'
			),
			confirmPriorityButton.click()
		]);
		await page.waitForTimeout(200);
		return;
	}

	const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Salvar e continuar' }) });

	const addPartButton = form.getByRole('button', { name: 'Adicionar parte' });
	if (await addPartButton.count()) {
		await addPartButton.click();
		await form.getByRole('textbox', { name: /Nome da parte/ }).last().fill('Resposta de teste automatizada.');
	}

	const textInputs = form.locator('input[type="text"][required]');
	for (let i = 0; i < (await textInputs.count()); i++) {
		await textInputs.nth(i).fill('Resposta de teste automatizada.');
	}

	const textareas = form.locator('textarea[required]');
	for (let i = 0; i < (await textareas.count()); i++) {
		await textareas.nth(i).fill('Resposta de teste automatizada.');
	}

	const selects = form.locator('select[required]');
	for (let i = 0; i < (await selects.count()); i++) {
		const select = selects.nth(i);
		const value = await select.locator('option:not([value=""])').first().getAttribute('value');
		if (value) await select.selectOption(value);
	}

	// A submissão usa `use:enhance` (AJAX, sem navegação completa) — o clique
	// dispara o POST, mas o Svelte só troca o formulário pelo da próxima
	// atividade depois que a resposta chega e o DOM é repatchado. Esperar
	// explicitamente a resposta do POST (em vez de só o clique, ou de
	// `networkidle`, que pode não estabilizar de forma confiável aqui)
	// evita consultar o próximo formulário em pleno DOM de transição —
	// sintoma observado como "element was detached from the DOM".
	await Promise.all([
		page.waitForResponse((response) => response.url().includes('?/answer') && response.request().method() === 'POST'),
		form.getByRole('button', { name: 'Salvar e continuar' }).click()
	]);

	// Pequena folga para o Svelte terminar de repatchar o DOM depois que a
	// resposta chega — o round-trip do servidor já está confirmado acima;
	// isto só cobre a reconciliação client-side subsequente.
	await page.waitForTimeout(200);
}

export async function answerActivitiesGenerically(page: Page, count: number): Promise<void> {
	for (let i = 0; i < count; i++) {
		await answerCurrentActivityGenerically(page);
	}
}

// Variante sem contagem fixa (R2 — remediação E2E,
// docs/core/ENGINEERING_REMEDIATION.md): avança atividades genéricas até que
// `stopCondition` resolva true (checada ANTES de responder a atividade
// corrente, então a atividade que satisfaz a condição nunca é respondida por
// engano). Evita duplicar, no teste, uma contagem que só existe porque o
// catálogo tem N atividades hoje — se o catálogo ganhar/perder uma atividade
// genérica nesse trecho, a jornada continua funcionando sem edição.
// maxSteps é só uma rede de segurança contra loop infinito por bug real
// (condição nunca satisfeita), não uma expectativa de comportamento.
export async function answerActivitiesGenericallyUntil(
	page: Page,
	stopCondition: () => Promise<boolean>,
	maxSteps = 100
): Promise<void> {
	for (let i = 0; i < maxSteps; i++) {
		if (await stopCondition()) return;
		await answerCurrentActivityGenerically(page);
	}
	throw new Error(`answerActivitiesGenericallyUntil: condição de parada não alcançada após ${maxSteps} passos.`);
}
