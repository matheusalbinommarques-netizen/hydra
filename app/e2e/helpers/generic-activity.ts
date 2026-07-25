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

import type { Page } from '@playwright/test';

export async function answerCurrentActivityGenerically(page: Page): Promise<void> {
	const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Salvar e continuar' }) });

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
