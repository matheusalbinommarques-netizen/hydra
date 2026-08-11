import type { Page } from '@playwright/test';

// Cria um projeto via `/projects/new` (Claude Design, "Novo Projeto.dc.html")
// — tela única de nome + origem, sem diagnóstico de rota (o diagnóstico
// continua existindo em /map, D023/D024, fora desta tela). Preenche um nome
// fixo (agora obrigatório) e escolhe a primeira opção de origem — a origem
// exata não importa para journeys que só precisam de um projectId válido.
export async function createProject(page: Page, baseUrl: string): Promise<string> {
	await page.goto(`${baseUrl}/projects/new`);

	await page.getByPlaceholder('Ex.: Renovação do sistema de atendimento').fill('Projeto de teste');
	await page.getByRole('button', { name: 'Existe um problema' }).click();
	await page.getByRole('button', { name: 'Criar projeto e começar' }).click();

	await page.waitForURL(/\/projects\/[^/]+\/now$/);
	const match = page.url().match(/\/projects\/([^/]+)\/now$/);
	if (!match) throw new Error('projectId não encontrado na URL após criar o projeto.');
	return match[1];
}
