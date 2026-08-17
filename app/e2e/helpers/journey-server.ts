// Fiação de setup/teardown repetida, comprovada idêntica em treze journeys
// de servidor único (R2 — remediação E2E, docs/core/ENGINEERING_REMEDIATION.md):
// tmpdir próprio, porta livre, subir o servidor efêmero, esperar prontidão,
// e no afterAll derrubar o servidor e limpar o tmpdir. Registra
// beforeAll/afterAll no arquivo de teste que chamar useEphemeralServer() —
// uma mudança nesse lifecycle passa a exigir editar só este helper.
//
// Não cobre os journeys de dois servidores (walking-skeleton-journey,
// project-list) — esses têm uma orquestração genuinamente diferente
// (dois bancos isolados sob o mesmo tmpRoot, para exercitar export/import
// entre instâncias) e continuam com seu próprio beforeAll/afterAll.

import { test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type EphemeralServer, getFreePort, startServer, stopServer, waitForServer } from './ephemeral-server';

export interface JourneyServer {
	readonly baseUrl: string;
	readonly dbPath: string;
}

export function useEphemeralServer(prefix: string): JourneyServer {
	let tmpRoot: string;
	let server: EphemeralServer;
	let dbPath: string;

	test.beforeAll(async () => {
		tmpRoot = mkdtempSync(path.join(tmpdir(), `hydra-e2e-${prefix}-`));
		dbPath = path.join(tmpRoot, 'hydra.sqlite');
		const port = await getFreePort();
		server = startServer(port, dbPath);
		await waitForServer(server);
	});

	test.afterAll(async () => {
		try {
			await stopServer(server);
		} finally {
			rmSync(tmpRoot, { recursive: true, force: true });
		}
	});

	return {
		get baseUrl() {
			return server.baseUrl;
		},
		get dbPath() {
			return dbPath;
		}
	};
}
