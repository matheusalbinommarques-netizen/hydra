import { defineConfig } from '@playwright/test';

// Configuração exclusiva da jornada ponta a ponta (C2-12). Sem webServer
// global: os servidores da jornada são controlados pelo próprio teste, cada
// um com seu banco SQLite temporário e isolado — ver
// e2e/helpers/ephemeral-server.ts. testMatch usa a extensão .journey.ts, que
// playwright.config.ts (testMatch: **/*.e2e.{ts,js}) nunca casa, então as
// duas configurações nunca disputam a mesma execução nem sobem uma terceira
// instância usando o banco padrão.
//
// O build do app acontece uma única vez em globalSetup (./e2e/helpers/
// global-setup.ts), não mais por arquivo de journey — evita até 13 builds
// redundantes numa mesma execução da suíte.
export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.journey.ts',
	globalSetup: './e2e/helpers/global-setup.ts',
	timeout: 180_000,
	// Teto independente para a suíte inteira — nenhuma execução de journeys
	// deve ficar presa sem limite; se estourar, o Playwright encerra e
	// reporta, em vez de travar hydra-verify.mjs indefinidamente por dentro.
	globalTimeout: 600_000,
	reporter: 'line',
	fullyParallel: false,
	workers: 1,
	// Retry só em CI: localmente, um seletor obsoleto que trava em timeout
	// (180s) não deve virar 360s por retry automático durante desenvolvimento.
	// Em CI, uma tentativa extra absorve a instabilidade ambiental observada
	// ao rodar a suíte inteira em sequência (contenção de recursos ao final de
	// uma bateria longa) — confirmado, via debug direto no servidor, que não é
	// causada por erro de aplicação: toda submissão respondeu 200 OK.
	retries: process.env.CI ? 1 : 0
});
