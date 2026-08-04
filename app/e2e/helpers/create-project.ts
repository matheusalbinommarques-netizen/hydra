import type { Page } from '@playwright/test';

// Cria um projeto via wizard `/projects/new` (Nova iniciativa, etapa 7.2 do
// roadmap) — a Home não cria mais um projeto direto de um clique desde essa
// entrega; o antigo botão "Criar novo projeto" foi substituído por este
// wizard de 4 passos. Responde "Não" às cinco perguntas do diagnóstico (a
// fase inicial recomendada não importa para journeys que só precisam de um
// projectId válido), aceita a recomendação e confirma sem nome provisório.
export async function createProject(page: Page, baseUrl: string): Promise<string> {
	await page.goto(`${baseUrl}/projects/new`);

	for (const questionRow of await page.locator('.question-row').all()) {
		await questionRow.getByRole('button', { name: 'Não' }).click();
	}
	await page.getByRole('button', { name: 'Continuar →' }).click(); // 1 → 2 (ponto de partida)
	await page.getByRole('button', { name: 'Continuar →' }).click(); // 2 → 3 (rota recomendada aceita)
	await page.getByRole('button', { name: 'Continuar →' }).click(); // 3 → 4 (nome provisório em branco)
	await page.getByRole('button', { name: 'Confirmar e criar →' }).click();

	await page.waitForURL(/\/projects\/[^/]+\/now$/);
	const match = page.url().match(/\/projects\/([^/]+)\/now$/);
	if (!match) throw new Error('projectId não encontrado na URL após criar o projeto.');
	return match[1];
}
