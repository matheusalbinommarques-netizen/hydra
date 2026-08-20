#!/usr/bin/env node
// hydra-delivery-guard.mjs — sela e verifica que um item do backlog foi
// verificado (hydra-verify) exatamente no estado staged que está prestes a
// ser entregue, sem permitir divergência entre o momento da verificação e o
// momento do commit. Node.js puro, sem dependências externas.
//
// Uso:
//   node .claude/scripts/hydra-delivery-guard.mjs seal --item C5-01 --level 2
//   node .claude/scripts/hydra-delivery-guard.mjs seal --item S4B --level 3
//   node .claude/scripts/hydra-delivery-guard.mjs seal --item R2 --level 1
//   node .claude/scripts/hydra-delivery-guard.mjs check
//   node .claude/scripts/hydra-delivery-guard.mjs clear
//   node .claude/scripts/hydra-delivery-guard.mjs status
//   node .claude/scripts/hydra-delivery-guard.mjs self-test
//
// Exit codes:
//   0 — sucesso;
//   1 — argumento inválido, pré-condição não satisfeita, ou verificação
//       de seal falhou.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

class UsageError extends Error {}
class GuardError extends Error {}

// Formatos aceitos para --item / receipt.item / seal.item: item de Ciclo
// histórico (Cx-y), Stage do rework de produto (Sx[Letra]) ou corte do
// programa de remediação de engenharia (Rx) — ver hydra-state.mjs.
const ITEM_ID_RE = /^(C\d+-\d+[A-Z]?|S\d+[A-Z]?|R\d+)$/;

function parseArgs(argv) {
	const command = argv[0];
	if (!['seal', 'check', 'clear', 'status', 'self-test'].includes(command)) {
		throw new UsageError(`comando desconhecido: "${command ?? '(ausente)'}". Use seal, check, clear, status ou self-test.`);
	}
	if (command === 'self-test') {
		if (argv.length > 1) {
			throw new UsageError('self-test não aceita argumentos adicionais.');
		}
		return { command, item: null, level: null };
	}
	const args = { command, item: null, level: null };

	if (command !== 'seal') {
		if (argv.length > 1) {
			throw new UsageError(`comando "${command}" não aceita argumentos adicionais (recebido: ${argv.slice(1).join(' ')}).`);
		}
		return args;
	}

	for (let i = 1; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--item') {
			args.item = argv[++i];
			if (!args.item) throw new UsageError('--item exige um valor.');
		} else if (arg === '--level') {
			args.level = argv[++i];
			if (!args.level) throw new UsageError('--level exige um valor.');
		} else {
			throw new UsageError(`argumento desconhecido: ${arg}. seal aceita somente --item e --level.`);
		}
	}
	if (!args.item) throw new UsageError('seal exige --item.');
	if (!ITEM_ID_RE.test(args.item)) {
		throw new UsageError(
			`"${args.item}" não é um identificador de item válido. Formatos aceitos: Cx-y (ex.: C5-01, C4-03A), Sx (ex.: S4B) ou Rx (ex.: R2).`
		);
	}
	if (!args.level) throw new UsageError('seal exige --level.');
	if (!['1', '2', '3'].includes(args.level)) {
		throw new UsageError(`--level deve ser exatamente 1, 2 ou 3, recebido "${args.level}".`);
	}
	args.level = Number(args.level);
	return args;
}

function findRepoRoot() {
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new GuardError('não foi possível localizar a raiz do repositório Git.');
	}
	return path.normalize(result.stdout.trim());
}

function gitPath(repoRoot, relPath) {
	const result = spawnSync('git', ['rev-parse', '--git-path', relPath], { cwd: repoRoot, encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new GuardError(`git rev-parse --git-path ${relPath} falhou: ${result.stderr || result.error?.message}`);
	}
	return path.resolve(repoRoot, result.stdout.trim());
}

function git(repoRoot, gitArgs) {
	const result = spawnSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new GuardError(`git ${gitArgs.join(' ')} falhou: ${result.stderr || result.error?.message || 'erro desconhecido'}`);
	}
	return result.stdout;
}

function readJsonSafe(filePath) {
	try {
		const content = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(content);
	} catch {
		return null;
	}
}

const SHA40_RE = /^[0-9a-f]{40}$/;

function isValidSha40(value) {
	return typeof value === 'string' && SHA40_RE.test(value);
}

function isValidDateString(value) {
	return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function validateReceiptShape(receipt) {
	if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) {
		throw new GuardError('recibo de verificação não é um objeto JSON válido.');
	}
	if (receipt.version !== 1) {
		throw new GuardError(`recibo com version inválida: esperado 1, recebido "${receipt.version}".`);
	}
	if (typeof receipt.item !== 'string' || !ITEM_ID_RE.test(receipt.item)) {
		throw new GuardError(`recibo com item inválido: "${receipt.item}".`);
	}
	if (receipt.mode !== 'fast' && receipt.mode !== 'full') {
		throw new GuardError(`recibo com mode inválido: esperado "fast" ou "full", recebido "${receipt.mode}".`);
	}
	if (!isValidSha40(receipt.head)) {
		throw new GuardError(`recibo com head inválido: esperado SHA de 40 caracteres hexadecimais, recebido "${receipt.head}".`);
	}
	if (!isValidSha40(receipt.tree)) {
		throw new GuardError(`recibo com tree inválido: esperado SHA de 40 caracteres hexadecimais, recebido "${receipt.tree}".`);
	}
	if (!isValidDateString(receipt.verifiedAt)) {
		throw new GuardError(`recibo com verifiedAt inválido: "${receipt.verifiedAt}".`);
	}
}

function validateSealShape(seal) {
	if (seal === null || typeof seal !== 'object' || Array.isArray(seal)) {
		throw new GuardError('seal não é um objeto JSON válido.');
	}
	if (seal.version !== 1) {
		throw new GuardError(`seal com version inválida: esperado 1, recebido "${seal.version}".`);
	}
	if (typeof seal.item !== 'string' || !ITEM_ID_RE.test(seal.item)) {
		throw new GuardError(`seal com item inválido: "${seal.item}".`);
	}
	if (seal.level !== 1 && seal.level !== 2 && seal.level !== 3) {
		throw new GuardError(`seal com level inválido: esperado 1, 2 ou 3, recebido "${seal.level}".`);
	}
	if (seal.verificationMode !== 'fast' && seal.verificationMode !== 'full') {
		throw new GuardError(`seal com verificationMode inválido: esperado "fast" ou "full", recebido "${seal.verificationMode}".`);
	}
	if (seal.level === 3 && seal.verificationMode !== 'full') {
		throw new GuardError(`seal de level ${seal.level} exige verificationMode "full", encontrado "${seal.verificationMode}".`);
	}
	if (!isValidSha40(seal.head)) {
		throw new GuardError(`seal com head inválido: esperado SHA de 40 caracteres hexadecimais, recebido "${seal.head}".`);
	}
	if (!isValidSha40(seal.tree)) {
		throw new GuardError(`seal com tree inválido: esperado SHA de 40 caracteres hexadecimais, recebido "${seal.tree}".`);
	}
	if (!isValidDateString(seal.sealedAt)) {
		throw new GuardError(`seal com sealedAt inválido: "${seal.sealedAt}".`);
	}
}

function checkCommonPreconditions(repoRoot) {
	const branch = git(repoRoot, ['branch', '--show-current']).trim();
	if (branch !== 'main') {
		throw new GuardError(`branch atual é "${branch}", esperado "main".`);
	}

	const statusLines = git(repoRoot, ['status', '--short'])
		.split(/\r?\n/)
		.filter((l) => l.length > 0);

	const staged = statusLines.filter((l) => l[0] !== ' ' && l[0] !== '?');
	const unstaged = statusLines.filter((l) => l[1] !== ' ' && l[1] !== undefined && l.slice(0, 2) !== '??');
	const untracked = statusLines.filter((l) => l.startsWith('??'));

	if (staged.length === 0) {
		throw new GuardError('não há conteúdo staged.');
	}
	if (unstaged.length > 0) {
		throw new GuardError('há alterações não staged — stage precisa estar exatamente como será entregue.');
	}
	if (untracked.length > 0) {
		throw new GuardError('há arquivo(s) não rastreado(s) — stage precisa estar limpo de sobras.');
	}

	const diffCheck = spawnSync('git', ['diff', '--cached', '--check'], { cwd: repoRoot, encoding: 'utf8' });
	if (diffCheck.status !== 0) {
		throw new GuardError('git diff --cached --check encontrou problemas de whitespace.');
	}

	return { branch };
}

function currentHeadAndTree(repoRoot) {
	const head = git(repoRoot, ['rev-parse', 'HEAD']).trim();
	const tree = git(repoRoot, ['write-tree']).trim();
	return { head, tree };
}

function cmdSeal(repoRoot, args) {
	const sealPath = gitPath(repoRoot, 'hydra-delivery-seal.json');
	fs.rmSync(sealPath, { force: true });

	checkCommonPreconditions(repoRoot);

	const verificationPath = gitPath(repoRoot, 'hydra-verification.json');
	const receipt = readJsonSafe(verificationPath);
	if (!receipt) {
		throw new GuardError(`recibo de verificação não encontrado ou inválido em ${verificationPath}. Rode hydra-verify antes de seal.`);
	}
	validateReceiptShape(receipt);
	if (receipt.item !== args.item) {
		throw new GuardError(`item do recibo ("${receipt.item}") difere do item informado ("${args.item}").`);
	}

	const { head, tree } = currentHeadAndTree(repoRoot);
	if (receipt.head !== head) {
		throw new GuardError(`HEAD atual (${head}) difere do HEAD do recibo (${receipt.head}) — recibo obsoleto.`);
	}
	if (receipt.tree !== tree) {
		throw new GuardError('a árvore staged atual difere da árvore do recibo — stage mudou desde a verificação.');
	}

	if (args.level === 3) {
		if (receipt.mode !== 'full') {
			throw new GuardError(`level ${args.level} exige recibo de verificação "full", recibo é "${receipt.mode}".`);
		}
	} else {
		if (receipt.mode !== 'fast' && receipt.mode !== 'full') {
			throw new GuardError(`recibo com modo inválido: "${receipt.mode}".`);
		}
	}

	const seal = {
		version: 1,
		item: args.item,
		level: args.level,
		head,
		tree,
		verificationMode: receipt.mode,
		sealedAt: new Date().toISOString()
	};

	fs.writeFileSync(sealPath, JSON.stringify(seal, null, 2) + '\n');

	process.stdout.write(`hydra-delivery-guard: PASS — seal gravado (item ${args.item}, level ${args.level}, head ${head.slice(0, 7)})\n`);
}

function cmdCheck(repoRoot) {
	const sealPath = gitPath(repoRoot, 'hydra-delivery-seal.json');
	const seal = readJsonSafe(sealPath);
	if (!seal) {
		throw new GuardError(`seal não encontrado ou inválido (JSON ausente ou malformado) em ${sealPath}.`);
	}
	validateSealShape(seal);

	checkCommonPreconditions(repoRoot);

	const { head, tree } = currentHeadAndTree(repoRoot);
	if (seal.head !== head) {
		throw new GuardError(`HEAD atual (${head}) difere do HEAD do seal (${seal.head}).`);
	}
	if (seal.tree !== tree) {
		throw new GuardError('a árvore staged atual difere da árvore do seal.');
	}

	process.stdout.write(`hydra-delivery-guard: PASS — seal válido (item ${seal.item}, level ${seal.level}, head ${head.slice(0, 7)})\n`);
}

function cmdClear(repoRoot) {
	const sealPath = gitPath(repoRoot, 'hydra-delivery-seal.json');
	const verificationPath = gitPath(repoRoot, 'hydra-verification.json');
	let removed = [];
	for (const p of [sealPath, verificationPath]) {
		if (fs.existsSync(p)) {
			fs.rmSync(p);
			removed.push(p);
		}
	}
	process.stdout.write(
		removed.length > 0
			? `hydra-delivery-guard: clear — removido(s): ${removed.join(', ')}\n`
			: 'hydra-delivery-guard: clear — nada para remover.\n'
	);
}

function describeReceiptState(filePath) {
	if (!fs.existsSync(filePath)) return '  recibo de verificação: ausente\n';
	const receipt = readJsonSafe(filePath);
	if (!receipt) return '  recibo de verificação: inválido (JSON malformado)\n';
	try {
		validateReceiptShape(receipt);
	} catch (err) {
		return `  recibo de verificação: inválido (${err.message})\n`;
	}
	return `  recibo de verificação: presente (item ${receipt.item}, modo ${receipt.mode})\n`;
}

function describeSealState(filePath) {
	if (!fs.existsSync(filePath)) return '  seal: ausente\n';
	const seal = readJsonSafe(filePath);
	if (!seal) return '  seal: inválido (JSON malformado)\n';
	try {
		validateSealShape(seal);
	} catch (err) {
		return `  seal: inválido (${err.message})\n`;
	}
	return `  seal: presente (item ${seal.item}, level ${seal.level})\n`;
}

function cmdStatus(repoRoot) {
	const sealPath = gitPath(repoRoot, 'hydra-delivery-seal.json');
	const verificationPath = gitPath(repoRoot, 'hydra-verification.json');

	process.stdout.write(`hydra-delivery-guard: status\n`);
	process.stdout.write(describeReceiptState(verificationPath));
	process.stdout.write(describeSealState(sealPath));
}

// Cria um repositório Git isolado em diretório temporário (branch "main",
// um commit inicial, e um arquivo staged adicional representando o que
// seria entregue) para exercitar cmdSeal sem tocar o repositório real.
function setupSelfTestRepo() {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hydra-guard-selftest-'));
	const run = (gitArgs) => {
		const result = spawnSync('git', gitArgs, { cwd: dir, encoding: 'utf8' });
		if (result.error || result.status !== 0) {
			throw new Error(`self-test setup: git ${gitArgs.join(' ')} falhou: ${result.stderr || result.error?.message}`);
		}
		return result.stdout;
	};
	run(['init', '--quiet', '-b', 'main']);
	run(['config', 'user.email', 'selftest@hydra.local']);
	run(['config', 'user.name', 'hydra-selftest']);
	fs.writeFileSync(path.join(dir, 'base.txt'), 'base\n');
	run(['add', 'base.txt']);
	run(['commit', '--quiet', '-m', 'base commit']);
	fs.writeFileSync(path.join(dir, 'delivery.txt'), 'delivery\n');
	run(['add', 'delivery.txt']);
	return dir;
}

function writeSelfTestReceipt(repoRoot, item, mode) {
	const { head, tree } = currentHeadAndTree(repoRoot);
	const verificationPath = gitPath(repoRoot, 'hydra-verification.json');
	const receipt = { version: 1, item, mode, head, tree, verifiedAt: new Date().toISOString() };
	fs.writeFileSync(verificationPath, JSON.stringify(receipt, null, 2) + '\n');
}

function cmdSelfTest() {
	const cases = [
		{ level: 1, mode: 'fast', expect: 'accept' },
		{ level: 2, mode: 'fast', expect: 'accept' },
		{ level: 3, mode: 'fast', expect: 'reject' },
		{ level: 3, mode: 'full', expect: 'accept' }
	];

	let pass = 0;
	let fail = 0;
	for (const c of cases) {
		const dir = setupSelfTestRepo();
		try {
			writeSelfTestReceipt(dir, 'S6T', c.mode);
			let outcome = 'accept';
			try {
				cmdSeal(dir, { item: 'S6T', level: c.level });
			} catch (err) {
				if (!(err instanceof GuardError)) throw err;
				outcome = 'reject';
			}
			if (outcome === c.expect) {
				pass++;
			} else {
				fail++;
				process.stderr.write(
					`self-test FALHOU: level=${c.level} mode=${c.mode} — esperado ${c.expect}, obtido ${outcome}\n`
				);
			}
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}

	process.stdout.write(`hydra-delivery-guard --self-test: ${pass}/${cases.length} casos OK\n`);
	if (fail > 0) process.exit(1);
}

function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.command === 'self-test') {
		cmdSelfTest();
		return;
	}

	const repoRoot = findRepoRoot();

	if (args.command === 'seal') cmdSeal(repoRoot, args);
	else if (args.command === 'check') cmdCheck(repoRoot);
	else if (args.command === 'clear') cmdClear(repoRoot);
	else if (args.command === 'status') cmdStatus(repoRoot);
}

try {
	main();
	process.exit(0);
} catch (err) {
	if (err instanceof UsageError) {
		process.stderr.write(`hydra-delivery-guard: uso inválido — ${err.message}\n`);
		process.exit(1);
	}
	if (err instanceof GuardError) {
		process.stderr.write(`hydra-delivery-guard: ${err.message}\n`);
		process.exit(1);
	}
	process.stderr.write(`hydra-delivery-guard: erro inesperado — ${err.stack || err.message}\n`);
	process.exit(1);
}
