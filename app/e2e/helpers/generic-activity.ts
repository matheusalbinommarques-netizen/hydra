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
// id de atividade (S9 — reconciliação da decomposição legada, D045):
// - "Decompor o trabalho" (explicit_confirmation contra WorkItem) se revela
//   pela mensagem "Ainda não há nenhum WorkItem neste projeto" quando ainda
//   não há nenhum — navega para Trabalho, cria um WorkItem real pela UI
//   (mesma action canônica que um usuário usaria) e volta, para então clicar
//   "Confirmar decomposição"; nunca escreve PlanningItem/partes_trabalho.
//   Precisa ser a UI real, não uma chamada direta à action: o form action de
//   SvelteKit recusa POST sem o header Origin correto (proteção CSRF nativa),
//   que só uma navegação/submissão real do browser envia;
// - "Priorizar entregas" (explicit_confirmation contra Deliverable) segue o
//   mesmo padrão: revela-se pela mensagem "Ainda não há nenhuma entrega
//   (Deliverable) neste projeto", cria uma Deliverable real em Entregas pela
//   UI e volta, para então clicar "Confirmar prioridade".
//
// "Mapear dependências" (D046) e "Definir marcos" (D047) — ao contrário das
// duas acima, ZERO Dependency/Milestone é resultado válido: não há
// affordance de "ainda não há nenhum X" a esperar, o botão de confirmação já
// está sempre disponível, então basta reconhecê-lo pelo texto e clicar.

import type { Page } from '@playwright/test';

function projectIdFromUrl(page: Page): string {
	const match = new URL(page.url()).pathname.match(/^\/projects\/([^/]+)\//);
	if (!match) throw new Error(`answerCurrentActivityGenerically: não foi possível extrair projectId de ${page.url()}`);
	return match[1];
}

function originFromUrl(page: Page): string {
	return new URL(page.url()).origin;
}

export async function answerCurrentActivityGenerically(page: Page): Promise<void> {
	const noWorkItemMessage = page.getByText('Ainda não há nenhum WorkItem neste projeto');
	if (await noWorkItemMessage.count()) {
		const origin = originFromUrl(page);
		const projectId = projectIdFromUrl(page);
		await page.goto(`${origin}/projects/${projectId}/work`);
		await page.getByRole('button', { name: '+ Criar item de trabalho' }).click();
		await page.getByPlaceholder('O que precisa ser feito?').fill('Item de trabalho automático');
		await Promise.all([
			page.waitForResponse((response) => response.url().includes('?/create') && response.request().method() === 'POST'),
			page.getByRole('button', { name: 'Criar', exact: true }).click()
		]);
		await page.goto(`${origin}/projects/${projectId}/now`);
	}

	const confirmDecompositionButton = page.getByRole('button', { name: 'Confirmar decomposição' });
	if (await confirmDecompositionButton.count()) {
		await Promise.all([
			page.waitForResponse(
				(response) => response.url().includes('?/confirmDecomposition') && response.request().method() === 'POST'
			),
			confirmDecompositionButton.click()
		]);
		await page.waitForTimeout(200);
		return;
	}

	const noDeliverableMessage = page.getByText('Ainda não há nenhuma entrega (Deliverable) neste projeto');
	if (await noDeliverableMessage.count()) {
		const origin = originFromUrl(page);
		const projectId = projectIdFromUrl(page);
		await page.goto(`${origin}/projects/${projectId}/deliverables`);
		await page.getByRole('button', { name: 'Declarar primeira entrega' }).click();
		await page.getByLabel('O que será entregue').fill('Entrega automática');
		await page.getByLabel('Recorte').selectOption('agora');
		await Promise.all([
			page.waitForResponse((response) => response.url().includes('?/add') && response.request().method() === 'POST'),
			page.getByRole('button', { name: 'Adicionar entrega' }).click()
		]);
		await page.goto(`${origin}/projects/${projectId}/now`);
	}

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

	// "Mapear dependências" (S9 — explicit_confirmation contra Dependency, mas
	// ZERO Dependency é resultado válido, D046): ao contrário de
	// confirmDecomposition/confirmPlanningPriority acima, não há affordance de
	// "ainda não há nenhum X" a esperar — o botão de confirmação já está
	// sempre disponível, então basta reconhecê-lo e clicar.
	const confirmDependencyMappingButton = page.getByRole('button', { name: 'Confirmar revisão das dependências' });
	if (await confirmDependencyMappingButton.count()) {
		await Promise.all([
			page.waitForResponse(
				(response) =>
					response.url().includes('?/confirmDependencyMapping') && response.request().method() === 'POST'
			),
			confirmDependencyMappingButton.click()
		]);
		await page.waitForTimeout(200);
		return;
	}

	// "Definir marcos" (S9 — explicit_confirmation contra Milestone, mas ZERO
	// Milestone é resultado válido, D047): mesmo padrão de "Mapear
	// dependências" acima — o botão de confirmação já está sempre disponível.
	const confirmMilestoneReviewButton = page.getByRole('button', { name: 'Confirmar revisão dos marcos' });
	if (await confirmMilestoneReviewButton.count()) {
		await Promise.all([
			page.waitForResponse(
				(response) =>
					response.url().includes('?/confirmMilestoneReview') && response.request().method() === 'POST'
			),
			confirmMilestoneReviewButton.click()
		]);
		await page.waitForTimeout(200);
		return;
	}

	// "Identificar riscos do projeto"/"Atualizar riscos" (S10 — explicit_
	// confirmation contra Risk, mas ZERO Risk é resultado válido, D049): mesmo
	// padrão de "Mapear dependências"/"Definir marcos" acima.
	const confirmRiskIdentificationButton = page.getByRole('button', { name: 'Confirmar revisão dos riscos' });
	if (await confirmRiskIdentificationButton.count()) {
		const action = (await page.getByRole('heading', { level: 2 }).textContent()) === 'Atualizar riscos'
			? '?/confirmRiskUpdate'
			: '?/confirmRiskIdentification';
		await Promise.all([
			page.waitForResponse((response) => response.url().includes(action) && response.request().method() === 'POST'),
			confirmRiskIdentificationButton.click()
		]);
		await page.waitForTimeout(200);
		return;
	}

	// "Registrar decisões e mudanças" (S11 — explicit_confirmation contra
	// Decision/Change, mas ZERO de ambas é resultado válido, ETAPA 11 do
	// rework §41): mesmo padrão de "Mapear dependências"/"Definir marcos"/
	// "Identificar riscos" acima.
	const confirmDecisionsAndChangesButton = page.getByRole('button', {
		name: 'Confirmar revisão de decisões e mudanças'
	});
	if (await confirmDecisionsAndChangesButton.count()) {
		await Promise.all([
			page.waitForResponse(
				(response) =>
					response.url().includes('?/confirmDecisionsAndChangesReview') && response.request().method() === 'POST'
			),
			confirmDecisionsAndChangesButton.click()
		]);
		await page.waitForTimeout(200);
		return;
	}

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
