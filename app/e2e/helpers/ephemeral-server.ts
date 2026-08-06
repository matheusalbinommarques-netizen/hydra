// Helper exclusivo de e2e (C2-12) — sobe/derruba instâncias isoladas do
// servidor standalone (adapter-node) a partir do bundle já construído em
// build/, cada uma com seu próprio DATABASE_PATH temporário. Nunca usado
// fora de app/e2e/.
//
// O build do app NÃO acontece aqui por instância de servidor — é feito uma
// única vez, fora deste helper: pelo globalSetup da suíte de journeys
// (./global-setup.ts) quando ela roda sozinha, ou por `hydra-verify.mjs`
// quando ela roda dentro do modo `full` (que sinaliza isso via
// HYDRA_SKIP_BUILD=1, lido pelo globalSetup). `buildApp` continua exportado
// daqui só porque é o único lugar que já sabia como rodar `npm run build` de
// forma assíncrona com timeout — chamar mais de uma vez por execução é erro
// de uso, não o comportamento esperado.

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const isWin = process.platform === 'win32';

// Encerra a árvore de processos inteira a partir do PID informado — matar só
// o processo imediato (child.kill()) não é suficiente no Windows, onde
// netos de processo sobrevivem ao pai. taskkill /T /F cobre a árvore; em
// POSIX, o processo é criado com detached:true (grupo próprio) e killTree
// manda o sinal para o grupo inteiro via PID negativo.
function killTree(child: ChildProcess): void {
	if (child.pid == null) return;
	if (isWin) {
		spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
	} else {
		try {
			process.kill(-child.pid, 'SIGKILL');
		} catch {
			try {
				child.kill('SIGKILL');
			} catch {
				// já morto — nada a fazer.
			}
		}
	}
}

function runToCompletion(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, shell: isWin, stdio: 'inherit', detached: !isWin });
		let settled = false;

		const timer = setTimeout(() => {
			if (settled) return;
			killTree(child);
		}, timeoutMs);

		child.on('error', (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			reject(err);
		});

		child.on('exit', (code, signal) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (signal) {
				reject(
					new Error(`\`${cmd} ${args.join(' ')}\` encerrado por sinal ${signal} (possível timeout de ${timeoutMs}ms).`)
				);
			} else if (code !== 0) {
				reject(new Error(`\`${cmd} ${args.join(' ')}\` saiu com código ${code}.`));
			} else {
				resolve();
			}
		});
	});
}

export async function buildApp(timeoutMs = 180_000): Promise<void> {
	const npmCmd = isWin ? 'npm.cmd' : 'npm';
	await runToCompletion(npmCmd, ['run', 'build'], APP_ROOT, timeoutMs);
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
	// detached:false no Windows (default) evita abrir console próprio;
	// detached:true em POSIX dá ao processo seu próprio grupo, permitindo que
	// killTree encerre servidor + eventuais descendentes de uma vez.
	const child = spawn(process.execPath, [entry], {
		cwd: APP_ROOT,
		env: {
			...process.env,
			PORT: String(port),
			HOST: '127.0.0.1',
			ORIGIN: baseUrl,
			DATABASE_PATH: databasePath
		},
		stdio: 'pipe',
		detached: !isWin
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

// Encerramento gracioso primeiro (child.kill(), aguardando o evento real de
// saída); se o processo continuar vivo depois do prazo, força a árvore
// inteira pelo PID. Nunca resolve silenciosamente enquanto o processo pode
// estar vivo — se nem o kill forçado for confirmado, lança erro em vez de
// fingir sucesso.
export async function stopServer(server: EphemeralServer): Promise<void> {
	const child = server.process;
	if (child.exitCode !== null || child.signalCode !== null) return;

	let exited = false;
	const exitedPromise = new Promise<void>((resolve) => {
		child.once('exit', () => {
			exited = true;
			resolve();
		});
	});

	child.kill();

	const gracePeriodMs = 5_000;
	await Promise.race([exitedPromise, new Promise((resolve) => setTimeout(resolve, gracePeriodMs))]);
	if (exited) return;

	killTree(child);

	const confirmationMs = 5_000;
	await Promise.race([exitedPromise, new Promise((resolve) => setTimeout(resolve, confirmationMs))]);
	if (!exited) {
		throw new Error(
			`Não foi possível confirmar o encerramento do servidor efêmero em ${server.baseUrl} (PID ${child.pid}).`
		);
	}
}
