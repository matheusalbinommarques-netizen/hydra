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
//
// --item é usado somente para identificação no relatório — não muda a
// bateria de comandos executada.
//
// Exit codes:
//   0 — todas as etapas passaram;
//   1 — argumento inválido;
//   2 — uma etapa falhou (ver o log preservado indicado no relatório).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

class UsageError extends Error {}

const ITEM_ID_RE = /^C\d+-\d+[A-Z]?$/;

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
				throw new UsageError(`"${args.item}" não é um identificador de item válido. Formato esperado: Cx-y (ex.: C5-01, C4-03A).`);
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

function runStep(step, index, total, logDir) {
	const label = `[${index}/${total}] ${step.name}`;
	process.stdout.write(`${label} ... `);
	const start = Date.now();
	const result = spawnSync(step.cmd, step.args, { cwd: step.cwd, encoding: 'utf8', shell: step.shell ?? false });
	const duration = Date.now() - start;
	const output = (result.stdout || '') + (result.stderr || '') + (result.error ? `\n[spawn error] ${result.error.message}` : '');
	const logPath = path.join(logDir, `${String(index).padStart(2, '0')}-${slug(step.name)}.log`);
	fs.writeFileSync(logPath, output);
	const passed = !result.error && result.status === 0;
	process.stdout.write(`${passed ? 'PASS' : 'FAIL'} (${formatDuration(duration)})\n`);
	return { name: step.name, passed, duration, logPath, output };
}

function hasStagedContent(repoRoot) {
	return git(repoRoot, ['diff', '--cached', '--name-only']).trim().length > 0;
}

function buildSteps(mode, repoRoot) {
	const appDir = path.join(repoRoot, 'app');
	const isWin = process.platform === 'win32';
	const npmCmd = isWin ? 'npm.cmd' : 'npm';
	const npxCmd = isWin ? 'npx.cmd' : 'npx';

	// .cmd/.bat no Windows exigem passar pelo interpretador de comandos —
	// sem shell:true, spawnSync falha com EINVAL ao tentar rodar npm.cmd/
	// npx.cmd diretamente. git.exe é um executável real e nunca precisa
	// disso, então shell fica false (padrão) para as chamadas de git.
	const common = [
		{ name: 'npm run check', cmd: npmCmd, args: ['run', 'check'], cwd: appDir, shell: isWin },
		{
			name: 'npm run test:unit -- --run',
			cmd: npmCmd,
			args: ['run', 'test:unit', '--', '--run'],
			cwd: appDir,
			shell: isWin
		}
	];
	const staged = hasStagedContent(repoRoot);
	const gitCheck = staged
		? { name: 'git diff --cached --check', cmd: 'git', args: ['diff', '--cached', '--check'], cwd: repoRoot }
		: { name: 'git diff --check', cmd: 'git', args: ['diff', '--check'], cwd: repoRoot };

	if (mode === 'fast') {
		return [...common, gitCheck];
	}

	return [
		...common,
		{
			name: 'playwright journey',
			cmd: npxCmd,
			args: ['playwright', 'test', '--config=playwright.journey.config.ts'],
			cwd: appDir,
			shell: isWin
		},
		{ name: 'npm run test:e2e', cmd: npmCmd, args: ['run', 'test:e2e'], cwd: appDir, shell: isWin },
		{ name: 'npm run build', cmd: npmCmd, args: ['run', 'build'], cwd: appDir, shell: isWin },
		gitCheck
	];
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

function main() {
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
	process.stdout.write(`logs: ${logDir}\n\n`);

	const results = [];
	let totalDuration = 0;
	for (let i = 0; i < steps.length; i++) {
		const result = runStep(steps[i], i + 1, steps.length, logDir);
		results.push(result);
		totalDuration += result.duration;
		if (!result.passed) {
			process.stdout.write(
				`\nhydra-verify: FAIL na etapa "${result.name}" (modo ${args.mode}${itemLabel})\n` +
					`Log completo: ${result.logPath}\n` +
					`--- últimas linhas ---\n${tail(result.output, 40)}\n`
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

try {
	main();
} catch (err) {
	if (err instanceof UsageError) {
		process.stderr.write(`hydra-verify: uso inválido — ${err.message}\n`);
		process.exit(1);
	}
	process.stderr.write(`hydra-verify: erro inesperado — ${err.stack || err.message}\n`);
	process.exit(1);
}
