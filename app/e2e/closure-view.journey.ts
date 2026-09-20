// Teste Playwright dedicado de "Resultados e encerramento" (/closure,
// subetapa 7.5 do roadmap, D029, docs/07-management/decision-log.md). Roda
// via playwright.journey.config.ts (servidor efêmero + banco temporário
// isolados). Percorrer a jornada guiada inteira até a fase `validacao` levaria
// dezenas de passos de UI — mesma técnica de fixture direta no SQLite já
// usada em records-view.journey.ts, contra o schema documentado em
// server/persistence/migrations/0001_init.sql, em vez de reconstruir esse
// estado respondendo/pulando todas as atividades anteriores pela UI. Não
// modifica nenhum outro journey existente.

import { expect, test } from '@playwright/test';
import { createProject } from './helpers/create-project';
import { insertAnswer, openDb, setActivityStatus, setAllActivityStatuses } from './helpers/db-fixtures';
import { useEphemeralServer } from './helpers/journey-server';

const server = useEphemeralServer('closure');

test('Encerramento: projeto antes da validação — continuidade aponta para as etapas anteriores', async ({ page }) => {
	const projectId = await createProject(page, server.baseUrl);

	await page.getByRole('link', { name: 'Encerramento' }).click();
	await page.waitForURL(`${server.baseUrl}/projects/${projectId}/closure`);

	await expect(page.getByRole('heading', { name: 'Resultados e encerramento' })).toBeVisible();
	await expect(
		page.getByText('O que foi alcançado, o que precisa continuar e o que foi aprendido')
	).toBeVisible();

	await expect(page.getByText('Conclua as etapas anteriores para avançar ao encerramento.')).toBeVisible();
	const cta = page.getByRole('link', { name: 'Continuar projeto em Agora →' });
	await expect(cta).toBeVisible();
	await expect(cta).toHaveAttribute('href', `/projects/${projectId}/now`);

	// as seis atividades aparecem como "Ainda não iniciada", sem campos
	await expect(page.getByText('Validar entregas e critérios de aceitação')).toBeVisible();
	await expect(page.getByText('Confirmar encerramento do projeto')).toBeVisible();
	await expect(page.getByText('Ainda não iniciada').first()).toBeVisible();
});

test('Encerramento: validação parcial — concluída, em andamento com campo vazio, pulada e não iniciada', async ({
	page
}) => {
	const projectId = await createProject(page, server.baseUrl);

	const db = openDb(server.dbPath);
	try {
		// Todas as atividades das fases anteriores viram terminais (puladas) —
		// só assim a próxima atividade real alcança a fase `validacao`
		// (computeNextActivity varre o catálogo inteiro em ordem).
		setAllActivityStatuses(db, projectId, 'pulada');

		setActivityStatus(db, projectId, 'validar_entregas_criterios', 'concluída');
		insertAnswer(
			db,
			projectId,
			'validar_entregas_criterios',
			'resultado_validacao',
			'O fluxo completo funciona sem erros, como definido no planejamento.'
		);

		setActivityStatus(db, projectId, 'coletar_feedback', 'em_andamento');
		// feedback_coletado propositalmente sem resposta — testa "Ainda não registrado".

		setActivityStatus(db, projectId, 'transicao_proximos_passos', 'não_iniciada');
		setActivityStatus(db, projectId, 'resolver_pendencias_finais', 'pulada');
		setActivityStatus(db, projectId, 'licoes_aprendidas', 'não_iniciada');
		setActivityStatus(db, projectId, 'confirmar_encerramento', 'não_iniciada');
	} finally {
		db.close();
	}

	await page.goto(`${server.baseUrl}/projects/${projectId}/closure`);

	const cta = page.getByRole('link', { name: 'Continuar encerramento em Agora →' });
	await expect(cta).toBeVisible();
	await expect(cta).toHaveAttribute('href', `/projects/${projectId}/now`);
	await expect(page.getByText('Ainda há atividades desta etapa para concluir.')).toBeVisible();

	// concluída: resposta completa visível
	await expect(page.getByText('O fluxo completo funciona sem erros, como definido no planejamento.')).toBeVisible();

	// em andamento: campo vazio mostra "Ainda não registrado"
	const feedbackHeading = page.getByRole('heading', { name: 'Coletar feedback' });
	await expect(feedbackHeading).toBeVisible();
	const feedbackActivity = page.locator('.activity', { has: feedbackHeading });
	await expect(feedbackActivity.getByText('Ainda não registrado')).toBeVisible();

	// pulada: sem nenhum campo de "Resolver pendências finais"
	const pendenciasHeading = page.getByRole('heading', { name: 'Resolver pendências finais' });
	await expect(pendenciasHeading).toBeVisible();
	const pendenciasActivity = page.locator('.activity', { has: pendenciasHeading });
	await expect(pendenciasActivity.getByText('Quais pendências finais existem')).toHaveCount(0);

	// não iniciada: sem campos
	const transicaoHeading = page.getByRole('heading', { name: 'Definir transição e próximos passos' });
	await expect(transicaoHeading).toBeVisible();
	const transicaoActivity = page.locator('.activity', { has: transicaoHeading });
	await expect(transicaoActivity.getByText('Como os resultados serão transferidos')).toHaveCount(0);

	await expect(page.getByRole('link', { name: 'Ver registros completos em Registros →' })).toBeVisible();
});

test('Encerramento: estado terminal — sem CTA, mensagem de conclusão, link para Registros; mobile sem overflow', async ({
	page
}) => {
	const projectId = await createProject(page, server.baseUrl);

	const db = openDb(server.dbPath);
	try {
		setAllActivityStatuses(db, projectId, 'pulada');
		setActivityStatus(db, projectId, 'validar_entregas_criterios', 'concluída');
		setActivityStatus(db, projectId, 'coletar_feedback', 'concluída');
		setActivityStatus(db, projectId, 'transicao_proximos_passos', 'concluída');
		setActivityStatus(db, projectId, 'resolver_pendencias_finais', 'pulada');
		setActivityStatus(db, projectId, 'licoes_aprendidas', 'pulada');
		setActivityStatus(db, projectId, 'confirmar_encerramento', 'concluída');
		insertAnswer(db, projectId, 'confirmar_encerramento', 'resumo_encerramento', 'Projeto encerrado.');
	} finally {
		db.close();
	}

	await page.goto(`${server.baseUrl}/projects/${projectId}/closure`);

	await expect(page.getByText('Etapa de encerramento concluída.')).toBeVisible();
	await expect(page.getByRole('link', { name: /Continuar (encerramento|projeto) em Agora/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Ver registros completos em Registros →' })).toBeVisible();

	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.getByRole('heading', { name: 'Resultados e encerramento' })).toBeVisible();
	const hasHorizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(hasHorizontalOverflow).toBe(false);
});

test('Encerramento: avaliação explícita dos resultados desejados (S16) — avaliar, reavaliar, null ≠ ainda não verificável, sem CTA de encerramento', async ({
	page
}) => {
	const projectId = await createProject(page, server.baseUrl);
	const db = openDb(server.dbPath);
	try {
		setAllActivityStatuses(db, projectId, 'pulada');
		setActivityStatus(db, projectId, 'validar_entregas_criterios', 'concluída');
		insertAnswer(db, projectId, 'validar_entregas_criterios', 'resultado_validacao', 'Texto legado livre da atividade.');
		const now = new Date().toISOString();
		const insert = db.prepare(
			`INSERT INTO desired_outcome (id, project_id, change, target, outcome_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		insert.run('do-a', projectId, 'Solicitações centralizadas', '-30% de retrabalho', 0, now, now);
		insert.run('do-b', projectId, 'Acompanhamento do início ao fim', null, 1, now, now);
	} finally {
		db.close();
	}

	await page.goto(`${server.baseUrl}/projects/${projectId}/closure`);
	const outcomes = page.getByTestId('closure-outcome');
	await expect(outcomes).toHaveCount(2);
	await expect(outcomes.first()).toContainText('Solicitações centralizadas');
	await expect(outcomes.first()).toContainText('Alvo: -30% de retrabalho');
	await expect(outcomes.first().locator('[data-state="unassessed"]')).toHaveText('Sem avaliação');
	// texto legado não vira avaliação
	await expect(page.getByText('Texto legado livre da atividade.')).toBeVisible();
	await expect(outcomes.first().locator('.state-badge')).not.toHaveText('Alcançado');

	// racional obrigatório
	await outcomes.first().getByLabel('Estado').selectOption('alcancado');
	await outcomes.first().getByRole('button', { name: 'Registrar avaliação' }).click();
	await expect(outcomes.first().locator('[data-state="unassessed"]')).toBeVisible();

	// primeira avaliação: ainda não verificável
	await outcomes.first().getByLabel('Estado').selectOption('ainda_nao_verificavel');
	await outcomes.first().getByLabel('Racional').fill('Ainda é cedo para medir.');
	await outcomes.first().getByRole('button', { name: 'Registrar avaliação' }).click();
	await expect(outcomes.first().locator('[data-state="ainda_nao_verificavel"]')).toHaveText('Ainda não verificável');
	await expect(outcomes.first()).toContainText('Ainda é cedo para medir.');
	// o outro segue "Sem avaliação" — distinto de "Ainda não verificável"
	await expect(outcomes.nth(1).locator('[data-state="unassessed"]')).toHaveText('Sem avaliação');

	// reavaliação
	await outcomes.first().getByLabel('Estado').selectOption('parcialmente_alcancado');
	await outcomes.first().getByLabel('Racional').fill('Metade do fluxo já centralizado.');
	await outcomes.first().getByRole('button', { name: 'Atualizar avaliação' }).click();
	await expect(outcomes.first().locator('[data-state="parcialmente_alcancado"]')).toHaveText('Parcialmente alcançado');
	await expect(outcomes.first()).toContainText('Metade do fluxo já centralizado.');

	// nenhum CTA/readiness de encerramento neste corte
	await expect(page.getByRole('button', { name: /Encerrar projeto/i })).toHaveCount(0);
	await expect(page.getByText(/pronto para encerrar|readiness/i)).toHaveCount(0);

	await page.setViewportSize({ width: 390, height: 844 });
	const hasHorizontalOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth > document.documentElement.clientWidth
	);
	expect(hasHorizontalOverflow).toBe(false);
});
