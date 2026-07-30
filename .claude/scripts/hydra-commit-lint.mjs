#!/usr/bin/env node
// hydra-commit-lint.mjs — valida uma mensagem de commit contra as regras de
// .claude/skills/hydra-ship/SKILL.md, sem corrigir nem completar a mensagem
// recebida. Node.js puro, sem dependências externas.
//
// Uso:
//   node .claude/scripts/hydra-commit-lint.mjs --message "feat(scope): add scope version confirmation"
//   node .claude/scripts/hydra-commit-lint.mjs --self-test
//
// Exit codes:
//   0 — mensagem válida (ou self-test totalmente aprovado);
//   1 — mensagem inválida, uso incorreto, ou self-test com falha.

class UsageError extends Error {}
class LintError extends Error {}

const GENERIC_WORDS = new Set(['wip', 'fix', 'update', 'changes', 'test', 'temp', 'todo', 'misc', 'stuff', 'asdf']);

function parseArgs(argv) {
	const args = { message: null, selfTest: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--message') {
			args.message = argv[++i];
			if (args.message === undefined) throw new UsageError('--message exige um valor.');
		} else if (arg === '--self-test') {
			args.selfTest = true;
		} else {
			throw new UsageError(`argumento desconhecido: ${arg}`);
		}
	}
	if (!args.selfTest && args.message === null) {
		throw new UsageError('informe --message "<mensagem>" ou --self-test.');
	}
	return args;
}

function lint(message) {
	const subject = message.split(/\r?\n/)[0].trim();

	const structural = subject.match(/^([^\s:()]+)(?:\(([^:()\n]+)\))?:(.*)$/);
	if (!structural) {
		throw new LintError(
			'assunto não segue a forma "tipo: descrição" ou "tipo(escopo): descrição".'
		);
	}
	const [, tipo, escopo, rest] = structural;
	if (!tipo) {
		throw new LintError('tipo não pode ser vazio.');
	}
	if (escopo !== undefined && escopo.trim() === '') {
		throw new LintError('escopo, quando presente, não pode ser vazio.');
	}

	const descricao = rest.trim();
	if (descricao === '') {
		throw new LintError('descrição não pode ser vazia.');
	}

	const words = descricao.split(/\s+/).filter((w) => /[a-zA-Z0-9À-ÖØ-öø-ÿ]/.test(w));
	if (words.length < 3) {
		throw new LintError('descrição precisa ter ao menos 3 palavras.');
	}

	const nonSpaceChars = descricao.replace(/\s+/g, '').length;
	if (nonSpaceChars < 15) {
		throw new LintError('descrição precisa ter ao menos 15 caracteres não-espaço.');
	}

	const allGeneric = words.every((w) => GENERIC_WORDS.has(w.toLowerCase()));
	if (allGeneric) {
		throw new LintError('descrição usa apenas palavras genéricas (wip, fix, update, changes, test, temp, todo, misc, stuff, asdf).');
	}

	const normalized = descricao.toLowerCase().replace(/[^a-z0-9À-ÖØ-öø-ÿ]/g, '');
	if (normalized.length >= 1 && new Set(normalized.split('')).size === 1) {
		throw new LintError('descrição é repetição de um único caractere.');
	}

	return { tipo, escopo, descricao };
}

function runSelfTest() {
	const cases = [
		{ message: 'feat(scope): add scope version confirmation', valid: true },
		{ message: 'fix: correct pending item status handling', valid: true },
		{ message: 'fix(api): update scheduled time from 10:00 to 10:30', valid: true },
		{ message: 'refactor: extract shared validation helper module', valid: true },
		{ message: 'chore: update pending item status', valid: true },
		{ message: 'feat(two words): allow spaces inside scope text', valid: true },
		{ message: '', valid: false },
		{ message: 'no colon here at all', valid: false },
		{ message: ': missing type entirely here', valid: false },
		{ message: 'feat(): empty scope not allowed here', valid: false },
		{ message: 'feat(a:b): scope containing a colon is invalid', valid: false },
		{ message: 'fix: two words', valid: false },
		{ message: 'fix: ab cd ef', valid: false },
		{ message: 'chore: update misc changes', valid: false },
		{ message: 'wip: update stuff changes test', valid: false },
		{ message: 'fix: aaaaaaaaaaaaaaaaaaaa', valid: false },
		{ message: 'fix: a a a a a a a a a a a a a a a', valid: false },
		{ message: 'fix: a-a-a-a-a-a-a-a-a-a-a-a-a-a-a', valid: false },
		{ message: 'feat scope missing colon separator', valid: false },
		{ message: 'feat(scope: broken parens', valid: false }
	];

	let pass = 0;
	let fail = 0;
	for (const c of cases) {
		let ok;
		let errMsg = null;
		try {
			lint(c.message);
			ok = true;
		} catch (err) {
			if (err instanceof LintError) {
				ok = false;
				errMsg = err.message;
			} else {
				throw err;
			}
		}
		const passed = ok === c.valid;
		if (passed) {
			pass++;
		} else {
			fail++;
			process.stderr.write(
				`self-test FALHOU: "${c.message}" — esperado ${c.valid ? 'válido' : 'inválido'}, obtido ${ok ? 'válido' : 'inválido'}${errMsg ? ` (${errMsg})` : ''}\n`
			);
		}
	}

	process.stdout.write(`hydra-commit-lint --self-test: ${pass}/${cases.length} casos OK\n`);
	return fail === 0;
}

function main() {
	const args = parseArgs(process.argv.slice(2));

	if (args.selfTest) {
		const ok = runSelfTest();
		process.exit(ok ? 0 : 1);
	}

	const result = lint(args.message);
	process.stdout.write(`hydra-commit-lint: PASS — tipo="${result.tipo}"${result.escopo ? ` escopo="${result.escopo}"` : ''}\n`);
	process.exit(0);
}

try {
	main();
} catch (err) {
	if (err instanceof UsageError) {
		process.stderr.write(`hydra-commit-lint: uso inválido — ${err.message}\n`);
		process.exit(1);
	}
	if (err instanceof LintError) {
		process.stderr.write(`hydra-commit-lint: mensagem inválida — ${err.message}\n`);
		process.exit(1);
	}
	process.stderr.write(`hydra-commit-lint: erro inesperado — ${err.stack || err.message}\n`);
	process.exit(1);
}
