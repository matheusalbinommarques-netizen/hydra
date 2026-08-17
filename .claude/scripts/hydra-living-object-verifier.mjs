#!/usr/bin/env node
// hydra-living-object-verifier.mjs — verificador estrutural, somente-leitura,
// do plumbing MECÂNICO de uma living-object capability (ver R4 em
// docs/core/ENGINEERING_REMEDIATION.md e docs/core/LIVING_OBJECT_CHECKLIST.md).
//
// O QUE ESTE SCRIPT FAZ:
//   dado um objeto vivo já decidido pelo humano/Claude (nome, chave em
//   ProjectState, tabela, profile de cardinalidade), verifica se as
//   superfícies mecânicas recorrentes (comprovadas em precedentes reais —
//   AffectedGroup/CurrentTreatment, CauseHypothesis/CauseExploration) estão
//   presentes e registradas nos pontos certos.
//
// O QUE ESTE SCRIPT NÃO FAZ (não infere, não decide, não gera):
//   - não escolhe nem infere cardinalidade/profile — é sempre input explícito;
//   - não escaneia state-types.ts para "descobrir" living objects sozinho;
//   - não valida se a cardinalidade escolhida faz sentido para o conceito;
//   - não valida invariantes, completion/confirmation semantics, migration/
//     backfill semantics, UX ou nomeação conceitual;
//   - não edita nem gera nenhum arquivo de produção.
//
// Uso:
//   node .claude/scripts/hydra-living-object-verifier.mjs \
//     --object CauseHypothesis --state-key causeHypotheses \
//     --table cause_hypothesis --profile project-collection
//
//   node .claude/scripts/hydra-living-object-verifier.mjs \
//     --object CauseExploration --state-key causeExploration \
//     --table cause_exploration --profile project-header
//
//   --root <path>   raiz alternativa a app/src/lib (usada só para prova,
//                   contra fixture temporária descartável — nunca aponta
//                   para o domínio real do Hydra em uso normal).
//
// Profiles (cardinalidade é decisão humana, não inferida):
//   project-header     — 1:1 com project (ex.: CurrentTreatment,
//                         CauseExploration): tabela com PK = project_id,
//                         precisa de backfill idempotente (ensureXRows).
//   project-collection — 1:N com project (ex.: AffectedGroup,
//                         CauseHypothesis): tabela com PK própria + FK
//                         project_id, sem backfill (coleção vazia é válida).
//
// Exit codes:
//   0 — todas as superfícies mecânicas esperadas estão presentes (PASS);
//   1 — argumento inválido (flag ausente/desconhecida, profile inválido);
//   2 — uma ou mais superfícies mecânicas esperadas estão ausentes (FAIL).

import fs from 'node:fs';
import path from 'node:path';

class UsageError extends Error {}

const PROFILES = new Set(['project-header', 'project-collection']);

function parseArgs(argv) {
	const args = { root: null };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--object') args.object = argv[++i];
		else if (arg === '--state-key') args.stateKey = argv[++i];
		else if (arg === '--table') args.table = argv[++i];
		else if (arg === '--profile') args.profile = argv[++i];
		else if (arg === '--root') args.root = argv[++i];
		else throw new UsageError(`flag desconhecida: ${arg}`);
	}
	for (const required of ['object', 'stateKey', 'table', 'profile']) {
		if (!args[required]) throw new UsageError(`--${toKebab(required)} é obrigatório`);
	}
	if (!PROFILES.has(args.profile)) {
		throw new UsageError(`--profile deve ser um de: ${[...PROFILES].join(', ')}`);
	}
	return args;
}

function toKebab(camel) {
	return camel.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function readFile(root, relativePath) {
	const fullPath = path.join(root, relativePath);
	try {
		return fs.readFileSync(fullPath, 'utf8');
	} catch {
		return null;
	}
}

// Cada check é {surface, file, test(content) -> bool}. `content` é null se o
// arquivo não existe no root informado.
function buildChecks({ object, stateKey, table, profile }) {
	const mapperFn = `map${object}Row`;
	const rowType = `${object}Row`;
	const viewType = `${object}View`;
	const parseFn = new RegExp(`function parse${object}(List)?\\b`);

	const checks = [
		{
			surface: 'domain/state-types.ts — interface do objeto declarada',
			file: 'domain/state-types.ts',
			test: (c) => new RegExp(`interface ${object}\\b`).test(c)
		},
		{
			surface: 'domain/state-types.ts — campo registrado em ProjectState',
			file: 'domain/state-types.ts',
			test: (c) => new RegExp(`${stateKey}\\s*:`).test(c)
		},
		{
			surface: 'domain/factory.ts — inicializado em createInitialProjectState',
			file: 'domain/factory.ts',
			test: (c) => new RegExp(`\\b${stateKey}\\s*:`).test(c)
		},
		{
			surface: `persistence/migrations — tabela ${table} criada`,
			file: 'server/persistence/migrations',
			isDir: true,
			test: (files) => files.some((c) => new RegExp(`CREATE TABLE[^;]*\\b${table}\\b`, 'i').test(c))
		},
		{
			surface: `persistence/migrations — ${table}.project_id referencia project(id)`,
			file: 'server/persistence/migrations',
			isDir: true,
			test: (files) =>
				files.some((c) => {
					const tableMatch = new RegExp(`CREATE TABLE[^;]*\\b${table}\\b[\\s\\S]*?;`, 'i').exec(c);
					if (!tableMatch) return false;
					return /project_id[\s\S]*?REFERENCES\s+project\s*\(\s*id\s*\)/i.test(tableMatch[0]);
				})
		},
		{
			surface: `persistence/mappers.ts — ${rowType} + ${mapperFn}`,
			file: 'server/persistence/mappers.ts',
			test: (c) => new RegExp(`interface ${rowType}\\b`).test(c) && new RegExp(`function ${mapperFn}\\b`).test(c)
		},
		{
			surface: `persistence/sqlite-project-repository.ts — import de ${mapperFn}`,
			file: 'server/persistence/sqlite-project-repository.ts',
			test: (c) => new RegExp(`\\b${mapperFn}\\b`).test(c)
		},
		{
			surface: `persistence/sqlite-project-repository.ts — INSERT INTO ${table}`,
			file: 'server/persistence/sqlite-project-repository.ts',
			test: (c) => new RegExp(`INSERT INTO\\s+${table}\\b`, 'i').test(c)
		},
		{
			surface: `persistence/sqlite-project-repository.ts — DELETE FROM ${table} no replace`,
			file: 'server/persistence/sqlite-project-repository.ts',
			test: (c) => new RegExp(`DELETE FROM\\s+${table}\\b`, 'i').test(c)
		},
		{
			surface: `persistence/sqlite-project-repository.ts — SELECT ... FROM ${table} no load`,
			file: 'server/persistence/sqlite-project-repository.ts',
			test: (c) => new RegExp(`FROM\\s+${table}\\b[\\s\\S]{0,80}WHERE\\s+project_id`, 'i').test(c)
		},
		{
			surface: `application/types.ts — ${viewType} declarada`,
			file: 'server/application/types.ts',
			test: (c) => new RegExp(`interface ${viewType}\\b`).test(c)
		},
		{
			surface: `application/types.ts — campo em ProjectView`,
			file: 'server/application/types.ts',
			test: (c) => new RegExp(`\\b${stateKey}\\s*:`).test(c)
		},
		{
			surface: `application/project-view.ts — mapeamento de ${stateKey}`,
			file: 'server/application/project-view.ts',
			test: (c) => new RegExp(`\\b${stateKey}\\b`).test(c)
		},
		{
			surface: `domain/serialization.ts — parse${object}(List)? declarada`,
			file: 'domain/serialization.ts',
			test: (c) => parseFn.test(c)
		},
		{
			surface: `domain/serialization.ts — parse${object} invocada em deserializeProjectState`,
			file: 'domain/serialization.ts',
			test: (c) => {
				const deserializeMatch = /function deserializeProjectState\b[\s\S]*$/.exec(c);
				if (!deserializeMatch) return false;
				return new RegExp(`parse${object}(List)?\\(`).test(deserializeMatch[0]);
			}
		}
	];

	if (profile === 'project-header') {
		checks.push({
			surface: `persistence/sqlite-project-repository.ts — backfill idempotente (ensure${object}Rows)`,
			file: 'server/persistence/sqlite-project-repository.ts',
			test: (c) => new RegExp(`ensure${object}Rows\\b`).test(c)
		});
	}

	return checks;
}

function listMigrationFiles(root, dirRelative) {
	const dirPath = path.join(root, dirRelative);
	let entries;
	try {
		entries = fs.readdirSync(dirPath);
	} catch {
		return [];
	}
	return entries
		.filter((name) => name.endsWith('.sql'))
		.map((name) => fs.readFileSync(path.join(dirPath, name), 'utf8'));
}

function runChecks(root, checks) {
	const results = [];
	for (const check of checks) {
		if (check.isDir) {
			const files = listMigrationFiles(root, check.file);
			const pass = files.length > 0 && check.test(files);
			results.push({ ...check, pass });
			continue;
		}
		const content = readFile(root, check.file);
		const pass = content !== null && check.test(content);
		results.push({ ...check, pass, missingFile: content === null });
	}
	return results;
}

function main() {
	let args;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (error) {
		if (error instanceof UsageError) {
			process.stderr.write(`Erro de uso: ${error.message}\n`);
			process.exit(1);
		}
		throw error;
	}

	const root = args.root ?? path.join(process.cwd(), 'app', 'src', 'lib');
	const checks = buildChecks(args);
	const results = runChecks(root, checks);

	const failures = results.filter((r) => !r.pass);

	if (failures.length === 0) {
		process.stdout.write(
			`PASS — ${args.object} (${args.profile}): ${results.length} superfícies mecânicas presentes.\n`
		);
		process.exit(0);
	}

	process.stdout.write(`FAIL — ${args.object} (${args.profile}): ${failures.length}/${results.length} ausentes.\n`);
	for (const failure of failures) {
		const location = failure.missingFile ? `${failure.file} (arquivo não encontrado)` : failure.file;
		process.stdout.write(`  - ${failure.surface}\n    em: ${location}\n`);
	}
	process.exit(2);
}

main();
