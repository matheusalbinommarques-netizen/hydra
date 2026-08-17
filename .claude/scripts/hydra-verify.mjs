#!/usr/bin/env node
// hydra-verify.mjs — roda a bateria determinística de verificação do Hydra
// (fast ou full) e reporta PASS/FAIL por etapa. Node.js puro, sem
// dependências externas. Não modifica Git nem arquivos do projeto; a única
// escrita em disco é o próprio diretório de log temporário, criado sob
// os.tmpdir() e removido no sucesso.
//
// Uso:
//   node .claude/scripts/hydra-verify.mjs --mode fast
//   node .claude/scripts/hydra-verify.mjs --mode full
//   node .claude/scripts/hydra-verify.mjs --mode fast --item C3-03
//   node .claude/scripts/hydra-verify.mjs --mode full --item C3-03
//   node .claude/scripts/hydra-verify.mjs --mode full --item S4B
//   node .claude/scripts/hydra-verify.mjs --mode fast --item R2
//
// --item é usado somente para identificação no relatório — não muda a
// bateria de comandos executada.
//
// Cada etapa roda de forma assíncrona (spawn), com stdout/stderr
// transmitidos ao terminal e gravados incrementalmente no log da etapa em
// tempo real, e timeout próprio: se estourar, a árvore de processos inteira
// é encerrada (taskkill /T /F no Windows; grupo de processos em POSIX) e a
// etapa é reportada como FAIL explícito — nunca desaparece silenciosamente.
//
// O modo full builda o app uma única vez (etapa própria) e a suíte de
// journeys reaproveita esse bundle (HYDRA_SKIP_BUILD=1), em vez de cada
// arquivo de journey buildar por conta própria.
//
// Exit codes:
//   0 — todas as etapas passaram;
//   1 — argumento inválido;
//   2 — uma etapa falhou (ver o log preservado indicado no relatório).

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

class UsageError extends Error {}

// Formatos aceitos: item de Ciclo histórico (Cx-y), Stage do rework de
// produto (Sx[Letra]) ou corte do programa de remediação de engenharia
// (Rx) — ver hydra-state.mjs.
const ITEM_ID_RE = /^(C\d+-\d+[A-Z]?|S\d+[A-Z]?|R\d+)$/;
const IS_WIN = process.platform === 'win32';

function parseArgs(argv) {
	const args = { mode: null, item: null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--mode') {
			args.mode = argv[++i];
		} else if (arg === '--item') {
			args.item = argv[++i];
			if (!args.item) throw new UsageError('--item exige um valor (ex.: --item C3-03).');
			if (!ITEM_ID_RE.test(args.item)) {
				throw new UsageError(
					`"${args.item}" não é um identificador de item válido. Formatos aceitos: Cx-y (ex.: C5-01, C4-03A), Sx (ex.: S4B) ou Rx (ex.: R2).`
				);
			}
		} else {
			throw new UsageError(`argumento desconhecido: ${arg}`);
		}
	}
	if (args.mode !== 'fast' && args.mode !== 'full') {
		throw new UsageError(`--mode deve ser "fast" ou "full", recebido "${args.mode ?? '(ausente)'}".`);
	}
	return args;
}

function findRepoRoot() {
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new UsageError('não foi possível localizar a raiz do repositório Git.');
	}
	return path.normalize(result.stdout.trim());
}

function git(repoRoot, gitArgs) {
	const result = spawnSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new UsageError(`git ${gitArgs.join(' ')} falhou: ${result.stderr || result.error?.message || 'erro desconhecido'}`);
	}
	return result.stdout;
}

function slug(name) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

function tail(text, n) {
	const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
	return lines.slice(-n).join('\n');
}

function formatDuration(ms) {
	return `${(ms / 1000).toFixed(1)}s`;
}

// Encerra a árvore de processos inteira a partir do PID — matar só o
// processo imediato não basta no Windows (netos sobrevivem ao pai).
// taskkill /T /F cobre a árvore; em POSIX, os steps sobem com detached:true
// (grupo próprio) e o sinal vai para o grupo inteiro via PID negativo. Nunca
// mata por nome, nunca toca em processos fora desta árvore.
function killTree(child) {
	if (child.pid == null) return;
	if (IS_WIN) {
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

function runStep(step, index, total, logDir) {
	return new Promise((resolve) => {
		const label = `[${index}/${total}] ${step.name}`;
		const logPath = path.join(logDir, `${String(index).padStart(2, '0')}-${slug(step.name)}.log`);
		const logStream = fs.createWriteStream(logPath, { flags: 'a' });
		const start = Date.now();

		process.stdout.write(`\n${label} (timeout ${formatDuration(step.timeoutMs)}) ...\n`);
		logStream.write(`${label}\ncmd: ${step.cmd} ${step.args.join(' ')}\ncwd: ${step.cwd}\ninício: ${new Date(start).toISOString()}\n\n`);

		const child = spawn(step.cmd, step.args, {
			cwd: step.cwd,
			shell: step.shell ?? false,
			env: step.env ?? process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: !IS_WIN
		});

		let settled = false;
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			killTree(child);
			// Segunda rede de segurança: se mesmo depois do kill forçado o
			// processo não confirmar encerramento (ex.: taskkill falhou
			// silenciosamente, ou um descendente segurou a árvore), força a
			// etapa a terminar como FAIL em vez de esperar para sempre — é
			// exatamente essa espera indefinida que motivou trocar spawnSync
			// por spawn.
			setTimeout(() => {
				finish({
					name: step.name,
					passed: false,
					duration: Date.now() - start,
					logPath,
					reason: `timeout após ${formatDuration(step.timeoutMs)} — processo não confirmou encerramento mesmo após kill forçado`
				});
			}, 10_000).unref();
		}, step.timeoutMs);

		function pipe(stream, target) {
			stream.on('data', (chunk) => {
				target.write(chunk);
				logStream.write(chunk);
			});
		}
		pipe(child.stdout, process.stdout);
		pipe(child.stderr, process.stderr);

		function finish(result) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			logStream.end();
			resolve(result);
		}

		child.on('error', (err) => {
			const duration = Date.now() - start;
			process.stdout.write(`${label} ... FAIL (${formatDuration(duration)}) — erro ao iniciar: ${err.message}\n`);
			finish({ name: step.name, passed: false, duration, logPath, reason: `erro ao iniciar: ${err.message}` });
		});

		// 'close' (não 'exit') — 'exit' pode disparar antes dos streams de
		// stdout/stderr terminarem de drenar, truncando exatamente as últimas
		// linhas que o relatório de FAIL mostra. 'close' só dispara depois que
		// os streams encerraram de verdade.
		child.on('close', (code, signal) => {
			const duration = Date.now() - start;
			const passed = !timedOut && !signal && code === 0;
			const reason = timedOut
				? `timeout após ${formatDuration(step.timeoutMs)} — árvore de processos encerrada`
				: signal
					? `terminado por sinal ${signal}`
					: code !== 0
						? `código de saída ${code}`
						: null;
			process.stdout.write(`${label} ... ${passed ? 'PASS' : 'FAIL'} (${formatDuration(duration)})${reason ? ' — ' + reason : ''}\n`);
			finish({ name: step.name, passed, duration, logPath, reason });
		});
	});
}

function hasStagedContent(repoRoot) {
	return git(repoRoot, ['diff', '--cached', '--name-only']).trim().length > 0;
}

function buildSteps(mode, repoRoot) {
	const appDir = path.join(repoRoot, 'app');
	const npmCmd = IS_WIN ? 'npm.cmd' : 'npm';
	const npxCmd = IS_WIN ? 'npx.cmd' : 'npx';

	// .cmd/.bat no Windows exigem passar pelo interpretador de comandos —
	// sem shell:true, spawn falha com EINVAL ao tentar rodar npm.cmd/npx.cmd
	// diretamente. git.exe é um executável real e nunca precisa disso, então
	// shell fica false (padrão) para a chamada de git.
	const steps = [
		{ name: 'npm run check', cmd: npmCmd, args: ['run', 'check'], cwd: appDir, shell: IS_WIN, timeoutMs: 120_000 },
		{
			name: 'npm run test:unit -- --run',
			cmd: npmCmd,
			args: ['run', 'test:unit', '--', '--run'],
			cwd: appDir,
			shell: IS_WIN,
			timeoutMs: 120_000
		}
	];

	if (mode === 'full') {
		// Build único do app. A suíte de journeys (etapa seguinte) reaproveita
		// esse bundle via HYDRA_SKIP_BUILD=1 — nenhuma etapa builda de novo.
		steps.push({ name: 'npm run build', cmd: npmCmd, args: ['run', 'build'], cwd: appDir, shell: IS_WIN, timeoutMs: 180_000 });
		steps.push({
			name: 'playwright journeys',
			cmd: npxCmd,
			args: ['playwright', 'test', '--config=playwright.journey.config.ts'],
			cwd: appDir,
			shell: IS_WIN,
			timeoutMs: 600_000,
			env: { ...process.env, HYDRA_SKIP_BUILD: '1' }
		});
		// O e2e do scaffold (`npm run test:e2e`) fica fora do selo full: hoje
		// só cobre o demo padrão do SvelteKit, não o produto — os journeys já
		// são a cobertura real do Hydra. Pode voltar quando/se passar a testar
		// algo do produto.
	}

	const staged = hasStagedContent(repoRoot);
	const gitCheck = staged
		? { name: 'git diff --cached --check', cmd: 'git', args: ['diff', '--cached', '--check'], cwd: repoRoot, timeoutMs: 30_000 }
		: { name: 'git diff --check', cmd: 'git', args: ['diff', '--check'], cwd: repoRoot, timeoutMs: 30_000 };
	steps.push(gitCheck);

	return steps;
}

function gitPath(repoRoot, relPath) {
	const result = spawnSync('git', ['rev-parse', '--git-path', relPath], { cwd: repoRoot, encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new UsageError(`git rev-parse --git-path ${relPath} falhou: ${result.stderr || result.error?.message}`);
	}
	return path.resolve(repoRoot, result.stdout.trim());
}

function gitStatusParts(repoRoot) {
	const lines = git(repoRoot, ['status', '--short'])
		.split(/\r?\n/)
		.filter((l) => l.length > 0);
	const staged = lines.filter((l) => l[0] !== ' ' && l[0] !== '?');
	const unstaged = lines.filter((l) => l.slice(0, 2) !== '??' && l[1] !== ' ' && l[1] !== undefined);
	const untracked = lines.filter((l) => l.startsWith('??'));
	return { staged, unstaged, untracked };
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const repoRoot = findRepoRoot();

	const receiptPath = gitPath(repoRoot, 'hydra-verification.json');
	const sealPath = gitPath(repoRoot, 'hydra-delivery-seal.json');
	fs.rmSync(receiptPath, { force: true });
	fs.rmSync(sealPath, { force: true });

	const steps = buildSteps(args.mode, repoRoot);

	const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-verify-'));

	const itemLabel = args.item ? ` item ${args.item}` : '';
	process.stdout.write(`hydra-verify — modo ${args.mode}${itemLabel}\n`);
	process.stdout.write(`logs: ${logDir}\n`);

	const results = [];
	let totalDuration = 0;
	for (let i = 0; i < steps.length; i++) {
		const result = await runStep(steps[i], i + 1, steps.length, logDir);
		results.push(result);
		totalDuration += result.duration;
		if (!result.passed) {
			const output = fs.readFileSync(result.logPath, 'utf8');
			process.stdout.write(
				`\nhydra-verify: FAIL na etapa "${result.name}" (modo ${args.mode}${itemLabel})\n` +
					`Motivo: ${result.reason ?? 'desconhecido'}\n` +
					`Log completo: ${result.logPath}\n` +
					`--- últimas linhas ---\n${tail(output, 40)}\n`
			);
			process.exit(2);
		}
	}

	process.stdout.write(
		`\nhydra-verify: PASS (modo ${args.mode}${itemLabel}) — ${results.length}/${results.length} etapas, ${formatDuration(totalDuration)} total\n`
	);
	fs.rmSync(logDir, { recursive: true, force: true });

	const { staged, unstaged, untracked } = gitStatusParts(repoRoot);
	if (args.item && staged.length > 0 && unstaged.length === 0 && untracked.length === 0) {
		const head = git(repoRoot, ['rev-parse', 'HEAD']).trim();
		const tree = git(repoRoot, ['write-tree']).trim();
		const receipt = {
			version: 1,
			item: args.item,
			mode: args.mode,
			head,
			tree,
			verifiedAt: new Date().toISOString()
		};
		fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
		process.stdout.write(`hydra-verify: recibo gravado em ${receiptPath}\n`);
	} else {
		process.stdout.write('hydra-verify: recibo não gravado (stage final não está limpo e completo para selar) — isso não é falha.\n');
	}

	process.exit(0);
}

main().catch((err) => {
	if (err instanceof UsageError) {
		process.stderr.write(`hydra-verify: uso inválido — ${err.message}\n`);
		process.exit(1);
	}
	process.stderr.write(`hydra-verify: erro inesperado — ${err.stack || err.message}\n`);
	process.exit(1);
});
