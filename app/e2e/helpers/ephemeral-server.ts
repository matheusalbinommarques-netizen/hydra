// Helper exclusivo de e2e (C2-12) — builda o app e sobe/derruba instâncias
// isoladas do servidor standalone (adapter-node), cada uma com seu próprio
// DATABASE_PATH temporário. Nunca usado fora de app/e2e/.

import { type ChildProcess, execSync, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function buildApp(): void {
	execSync('npm run build', { cwd: APP_ROOT, stdio: 'inherit' });
}

export async function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (address && typeof address === 'object') {
				const port = address.port;
				server.close(() => resolve(port));
			} else {
				server.close(() => reject(new Error('Não foi possível obter uma porta livre.')));
			}
		});
	});
}

export interface EphemeralServer {
	baseUrl: string;
	process: ChildProcess;
}

export function startServer(port: number, databasePath: string): EphemeralServer {
	const entry = path.join(APP_ROOT, 'build', 'index.js');
	const baseUrl = `http://127.0.0.1:${port}`;
	// Sem ORIGIN explícito, o adapter-node deduz uma origem que não bate com a
	// proteção CSRF nativa do SvelteKit para POSTs de form actions, e todo
	// submit é rejeitado com 403. Não é comportamento de produção alterado —
	// é a mesma variável que qualquer deploy real precisaria configurar.
	const child = spawn(process.execPath, [entry], {
		cwd: APP_ROOT,
		env: {
			...process.env,
			PORT: String(port),
			HOST: '127.0.0.1',
			ORIGIN: baseUrl,
			DATABASE_PATH: databasePath
		},
		stdio: 'pipe'
	});
	return { baseUrl, process: child };
}

export async function waitForServer(server: EphemeralServer, timeoutMs = 30_000): Promise<void> {
	const { baseUrl, process: child } = server;
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		if (child.exitCode !== null || child.signalCode !== null) {
			throw new Error(`Servidor em ${baseUrl} encerrou antes de ficar pronto (código ${child.exitCode}).`);
		}
		try {
			const response = await fetch(baseUrl + '/');
			if (response.status < 500) return;
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	throw new Error(`Servidor em ${baseUrl} não respondeu a tempo. Último erro: ${String(lastError)}`);
}

export async function stopServer(server: EphemeralServer): Promise<void> {
	const child = server.process;
	if (child.exitCode !== null || child.signalCode !== null) return;
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(resolve, 5_000);
		child.once('exit', () => {
			clearTimeout(timeout);
			resolve();
		});
		child.kill();
	});
}
