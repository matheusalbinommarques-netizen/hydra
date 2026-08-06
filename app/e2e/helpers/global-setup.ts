// globalSetup da suíte de journeys (playwright.journey.config.ts) — builda o
// app exatamente uma vez por execução da suíte, antes de qualquer arquivo
// *.journey.ts rodar. Os 13 arquivos deixaram de buildar individualmente.
//
// Quando `hydra-verify.mjs` já buildou o app como etapa própria do modo
// `full`, ele passa HYDRA_SKIP_BUILD=1 ao invocar esta suíte — o build aqui
// é pulado para não duplicá-lo. Rodando a suíte isolada (sem essa variável),
// o build acontece aqui, uma única vez.

import { buildApp } from './ephemeral-server';

export default async function globalSetup(): Promise<void> {
	if (process.env.HYDRA_SKIP_BUILD === '1') return;
	await buildApp();
}
