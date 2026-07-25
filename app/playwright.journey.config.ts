import { defineConfig } from '@playwright/test';

// Configuração exclusiva da jornada ponta a ponta (C2-12). Sem webServer
// global: os dois servidores da jornada são controlados pelo próprio teste,
// cada um com seu banco SQLite temporário e isolado — ver
// e2e/helpers/ephemeral-server.ts. testMatch usa a extensão .journey.ts, que
// playwright.config.ts (testMatch: **/*.e2e.{ts,js}) nunca casa, então as
// duas configurações nunca disputam a mesma execução nem sobem uma terceira
// instância usando o banco padrão.
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.journey.ts',
	timeout: 180_000,
	fullyParallel: false,
	workers: 1,
	// Uma nova tentativa absorve a instabilidade ambiental observada ao rodar
	// a suíte inteira em sequência (contenção de recursos ao final de uma
	// bateria longa) — confirmado, via debug direto no servidor, que não é
	// causada por erro de aplicação: toda submissão respondeu 200 OK.
	retries: 1
});
