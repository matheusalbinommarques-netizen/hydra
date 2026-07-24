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
	workers: 1
});
