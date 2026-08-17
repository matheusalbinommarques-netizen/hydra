#!/usr/bin/env node
// hydra-state.mjs — leitura somente-leitura do estado do Hydra: branch,
// HEAD/origin, árvore, trabalho atual e (opcionalmente) um item específico.
// Node.js puro, sem dependências externas. Nunca altera nenhum arquivo.
//
// O trabalho atual é descoberto assim:
//   1. se docs/core/CURRENT_WORK.json existe, ele é a autoridade — deve ser
//      um JSON válido com {id, kind, source, status}; se existir mas for
//      inválido, falha explicitamente (nunca cai para o Ciclo por engano);
//   2. se docs/core/CURRENT_WORK.json não existe, usa o comportamento legado
//      de descoberta pelo backlog de Ciclo mais recente
//      (docs/08-delivery/cycle-*-backlog.md).
//
// Uso:
//   node .claude/scripts/hydra-state.mjs
//   node .claude/scripts/hydra-state.mjs --item C3-03
//   node .claude/scripts/hydra-state.mjs --item S4B
//   node .claude/scripts/hydra-state.mjs --format json
//   node .claude/scripts/hydra-state.mjs --item C3-03 --format json
//
// Exit codes:
//   0 — sucesso (árvore suja NÃO é erro — é só reportada);
//   1 — argumento inválido (ex.: --format desconhecido, flag não reconhecida);
//   2 — --item informado mas não encontrado no trabalho atual/backlog vigente;
//   3 — erro real de Git ou de leitura de arquivo (ex.: não é um repo Git,
//       docs/08-delivery/ ausente, PROJECT_STATUS.md ausente,
//       CURRENT_WORK.json presente mas inválido).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

class UsageError extends Error {}
class NotFoundError extends Error {}
class StateReadError extends Error {}

// Formato de item de backlog histórico (usado só para reconhecer cabeçalhos
// "### Cx-y — Título" dentro de docs/08-delivery/cycle-*-backlog.md).
const ITEM_ID_RE = /^C\d+-\d+[A-Z]?$/;

// Formatos aceitos para --item e para o "id" de CURRENT_WORK.json: item de
// Ciclo histórico (Cx-y) ou Stage do rework (Sx[Letra]).
const SUPPORTED_ITEM_ID_RE = /^(C\d+-\d+[A-Z]?|S\d+[A-Z]?)$/;

const CURRENT_WORK_RELATIVE = ['docs', 'core', 'CURRENT_WORK.json'].join('/');

function validateItemId(id) {
	if (SUPPORTED_ITEM_ID_RE.test(id)) return;
	if (/^D\d+/.test(id)) {
		throw new UsageError(
			`"${id}" parece um identificador de decisão (Dxxx), não um item de trabalho. ` +
				'Formatos aceitos: Cx-y (ex.: C5-01, C4-03A) ou Sx (ex.: S4B).'
		);
	}
	throw new UsageError(`"${id}" não é um identificador de item válido. Formatos aceitos: Cx-y (ex.: C5-01, C4-03A) ou Sx (ex.: S4B).`);
}

function findCurrentWorkPointer(repoRoot) {
	const pointerPath = path.join(repoRoot, ...CURRENT_WORK_RELATIVE.split('/'));
	if (!fs.existsSync(pointerPath)) return null;

	let raw;
	try {
		raw = fs.readFileSync(pointerPath, 'utf8');
	} catch (err) {
		throw new StateReadError(`não foi possível ler ${CURRENT_WORK_RELATIVE}: ${err.message}`);
	}

	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		throw new StateReadError(`${CURRENT_WORK_RELATIVE} existe mas não é JSON válido: ${err.message}`);
	}

	validateCurrentWorkShape(parsed);
	return parsed;
}

function validateCurrentWorkShape(pointer) {
	if (pointer === null || typeof pointer !== 'object' || Array.isArray(pointer)) {
		throw new StateReadError(`${CURRENT_WORK_RELATIVE} existe mas não é um objeto JSON válido.`);
	}
	if (typeof pointer.id !== 'string' || !SUPPORTED_ITEM_ID_RE.test(pointer.id)) {
		throw new StateReadError(
			`${CURRENT_WORK_RELATIVE}: "id" ausente ou em formato inválido ("${pointer.id}"). Formatos aceitos: Cx-y ou Sx (ex.: S4B).`
		);
	}
	if (typeof pointer.kind !== 'string' || pointer.kind.trim() === '') {
		throw new StateReadError(`${CURRENT_WORK_RELATIVE}: "kind" ausente ou vazio.`);
	}
	if (typeof pointer.source !== 'string' || pointer.source.trim() === '') {
		throw new StateReadError(`${CURRENT_WORK_RELATIVE}: "source" ausente ou vazio.`);
	}
	if (typeof pointer.status !== 'string' || pointer.status.trim() === '') {
		throw new StateReadError(`${CURRENT_WORK_RELATIVE}: "status" ausente ou vazio.`);
	}
}

function parseArgs(argv) {
	const args = { item: null, format: 'markdown' };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--item') {
			args.item = argv[++i];
			if (!args.item) throw new UsageError('--item exige um valor (ex.: --item C3-03).');
			validateItemId(args.item);
		} else if (arg === '--format') {
			args.format = argv[++i];
		} else {
			throw new UsageError(`argumento desconhecido: ${arg}`);
		}
	}
	if (args.format !== 'markdown' && args.format !== 'json') {
		throw new UsageError(`--format deve ser "markdown" ou "json", recebido "${args.format}".`);
	}
	return args;
}

function git(repoRoot, gitArgs) {
	const result = spawnSync('git', gitArgs, { cwd: repoRoot, encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new StateReadError(`git ${gitArgs.join(' ')} falhou: ${result.stderr || result.error?.message || 'erro desconhecido'}`);
	}
	return result.stdout.trim();
}

function findRepoRoot() {
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
	if (result.error || result.status !== 0) {
		throw new StateReadError('não foi possível localizar a raiz do repositório Git (git rev-parse --show-toplevel falhou).');
	}
	// git sempre retorna caminho com "/", normalizamos para o SO atual.
	return path.normalize(result.stdout.trim());
}

function readFileSafe(filePath) {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch (err) {
		throw new StateReadError(`não foi possível ler ${filePath}: ${err.message}`);
	}
}

function extractSection(content, headingRegex) {
	const lines = content.split(/\r?\n/);
	let start = -1;
	for (let i = 0; i < lines.length; i++) {
		if (headingRegex.test(lines[i])) {
			start = i;
			break;
		}
	}
	if (start === -1) return null;
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (/^## /.test(lines[i])) {
			end = i;
			break;
		}
	}
	return lines
		.slice(start + 1, end)
		.join('\n')
		.trim();
}

function findLatestCycleBacklog(repoRoot) {
	const deliveryDir = path.join(repoRoot, 'docs', '08-delivery');
	let entries;
	try {
		entries = fs.readdirSync(deliveryDir);
	} catch (err) {
		throw new StateReadError(`não foi possível ler ${deliveryDir}: ${err.message}`);
	}
	let best = null;
	for (const entry of entries) {
		const match = entry.match(/^cycle-(\d+)-backlog\.md$/);
		if (match) {
			const number = Number(match[1]);
			if (!best || number > best.number) {
				best = { number, file: entry };
			}
		}
	}
	if (!best) {
		throw new StateReadError(`nenhum arquivo cycle-*-backlog.md encontrado em ${deliveryDir}.`);
	}
	return {
		number: best.number,
		absolutePath: path.join(deliveryDir, best.file),
		relativePath: `docs/08-delivery/${best.file}` // sempre "/", independente do SO
	};
}

function parseBacklog(content) {
	const lines = content.split(/\r?\n/);
	const metaMatch = content.match(/\*\*Meta:\*\*\s*([\s\S]*?)\n\s*\n/);
	const meta = metaMatch ? metaMatch[1].replace(/\s+/g, ' ').trim() : null;

	const items = [];
	let currentPriority = null;
	let current = null;

	function closeCurrent() {
		if (current) items.push(current);
		current = null;
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		const priorityHeading = line.match(/^## (Must|Should|Could)\b/);
		if (priorityHeading) {
			closeCurrent();
			currentPriority = priorityHeading[1];
			continue;
		}

		const otherH2 = line.match(/^## (.+)$/);
		if (otherH2 && !priorityHeading) {
			closeCurrent();
			currentPriority = null;
			continue;
		}

		const itemHeading = line.match(/^### (C\d+-\d+[A-Z]?) — (.+)$/);
		if (itemHeading && currentPriority !== null) {
			// Só conta como definição de item dentro de uma seção Must/Should/
			// Could — o mesmo padrão "### C3-01 — Título" também aparece em
			// "## Testes planejados" só para agrupar os testes por item, e não
			// deve gerar uma entrada de item duplicada.
			closeCurrent();
			current = {
				id: itemHeading[1],
				title: itemHeading[2].trim(),
				priority: currentPriority,
				status: 'não iniciado',
				commit: null,
				acceite: null,
				notasTecnicas: null
			};
			continue;
		}

		if (!current) continue;

		const statusMatch = line.match(/^\*\*Status:\*\*\s*(.*)$/);
		if (statusMatch) {
			let text = statusMatch[1];
			let j = i + 1;
			while (j < lines.length && lines[j].trim() !== '' && !/^\*\*[^*]+:\*\*/.test(lines[j]) && !/^#/.test(lines[j])) {
				text += ' ' + lines[j].trim();
				j++;
			}
			text = text.replace(/\s+/g, ' ').trim();
			current.status = /concluíd/i.test(text) ? 'concluído' : text;
			const commitMatch = text.match(/`([0-9a-f]{7,40})`/);
			if (commitMatch) current.commit = commitMatch[1];
			continue;
		}

		const acceiteMatch = line.match(/^\*\*Aceite:\*\*\s*(.*)$/) || line.match(/^\*\*Resultado esperado(?: \(mínimo funcional\))?:\*\*\s*(.*)$/);
		if (acceiteMatch && current.acceite === null) {
			let text = acceiteMatch[1];
			let j = i + 1;
			while (j < lines.length && lines[j].trim() !== '' && !/^\*\*[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ]/.test(lines[j]) && !/^#/.test(lines[j])) {
				text += ' ' + lines[j].trim();
				j++;
			}
			current.acceite = text.trim();
			continue;
		}

		const notasHeading = line.match(/^\*\*Notas técnicas[^*]*:\*\*\s*$/);
		if (notasHeading && current.notasTecnicas === null) {
			// Captura o bloco inteiro (bullets + linhas de continuação
			// indentadas) até a primeira linha em branco — não tenta separar
			// bullet por bullet, porque vários bullets deste documento
			// quebram em múltiplas linhas.
			const blockLines = [];
			let j = i + 1;
			while (j < lines.length && lines[j].trim() !== '') {
				blockLines.push(lines[j]);
				j++;
			}
			current.notasTecnicas = blockLines;
			continue;
		}
	}
	closeCurrent();

	const gate = extractSection(content, /^## Gate de conclusão/);
	const dependencies = extractSection(content, /^## Dependências entre os itens/);

	return { meta, items, gate, dependencies };
}

function detectCycleMentionsInStatus(projectStatusContent) {
	const matches = [...projectStatusContent.matchAll(/Ciclo\s+(\d+)/g)].map((m) => Number(m[1]));
	return [...new Set(matches)];
}

function truncateLines(text, maxLines) {
	if (!text) return text;
	const lines = text.split(/\r?\n/);
	if (lines.length <= maxLines) return text;
	return lines.slice(0, maxLines).join('\n') + `\n… (${lines.length - maxLines} linha(s) omitida(s))`;
}

function buildState(repoRoot) {
	const branch = git(repoRoot, ['branch', '--show-current']);
	const head = git(repoRoot, ['rev-parse', '--short', 'HEAD']);
	let originMain;
	try {
		originMain = git(repoRoot, ['rev-parse', '--short', 'origin/main']);
	} catch {
		originMain = null; // remoto pode não estar configurado — não é erro fatal
	}
	const statusPorcelain = git(repoRoot, ['status', '--short'])
		.split(/\r?\n/)
		.filter((l) => l.length > 0);

	// Autoridade sobre "trabalho atual": se o pointer existe, ele decide —
	// nenhuma descoberta por Ciclo é feita quando ele está presente, e um
	// pointer inválido falha explicitamente em vez de cair para o Ciclo.
	const currentWork = findCurrentWorkPointer(repoRoot);

	const projectStatusPath = path.join(repoRoot, 'PROJECT_STATUS.md');
	const projectStatusContent = readFileSafe(projectStatusPath);
	const nextDecision = extractSection(projectStatusContent, /^## Próxima decisão relevante/);

	const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
	let unreleased = null;
	try {
		const changelogContent = readFileSafe(changelogPath);
		unreleased = extractSection(changelogContent, /^## \[Unreleased\]/);
	} catch {
		unreleased = null; // CHANGELOG sem Unreleased não é erro fatal
	}

	let cycle = null;
	if (!currentWork) {
		const cycleFile = findLatestCycleBacklog(repoRoot);
		const backlogContent = readFileSafe(cycleFile.absolutePath);
		const parsed = parseBacklog(backlogContent);
		const cycleMentions = detectCycleMentionsInStatus(projectStatusContent);
		const consistentWithProjectStatus = cycleMentions.length === 0 || cycleMentions.includes(cycleFile.number);
		cycle = {
			number: cycleFile.number,
			file: cycleFile.relativePath,
			meta: parsed.meta,
			items: parsed.items,
			gate: parsed.gate,
			dependencies: parsed.dependencies,
			consistentWithProjectStatus
		};
	}

	return {
		branch,
		head,
		originMain,
		clean: statusPorcelain.length === 0,
		statusPorcelain,
		currentWork,
		cycle,
		nextDecision,
		changelogUnreleased: unreleased
	};
}

function findItem(state, itemId) {
	if (state.currentWork) {
		return state.currentWork.id.toLowerCase() === itemId.toLowerCase() ? state.currentWork : null;
	}
	return state.cycle.items.find((item) => item.id.toLowerCase() === itemId.toLowerCase()) || null;
}

function toMarkdown(state, item, itemId) {
	const out = [];
	out.push('# Estado do Hydra');
	out.push('');
	out.push(`**Branch:** ${state.branch}`);
	out.push(`**HEAD:** ${state.head}`);
	out.push(`**origin/main:** ${state.originMain ?? '(sem remoto configurado)'}`);
	out.push(`**Árvore:** ${state.clean ? 'limpa' : `${state.statusPorcelain.length} entrada(s) — ver git status`}`);
	out.push('');

	if (state.currentWork) {
		out.push(`## Trabalho atual: ${state.currentWork.id} (${state.currentWork.kind})`);
		out.push('');
		out.push(`**Source:** ${state.currentWork.source}`);
		out.push(`**Status:** ${state.currentWork.status}`);
	} else {
		if (!state.cycle.consistentWithProjectStatus) {
			out.push('⚠️ PROJECT_STATUS.md menciona um número de ciclo diferente do backlog mais recente encontrado — possível divergência.');
			out.push('');
		}
		out.push(`## Ciclo ativo: Ciclo ${state.cycle.number} (${state.cycle.file})`);
		out.push('');
		if (state.cycle.meta) out.push(`**Meta:** ${state.cycle.meta}`);
		out.push('');
		out.push('### Itens');
		for (const it of state.cycle.items) {
			const commitPart = it.commit ? ` — commit ${it.commit}` : '';
			out.push(`- ${it.id} (${it.priority ?? '?'}): ${it.status}${commitPart} — ${it.title}`);
		}
		out.push('');
		out.push('### Gate');
		out.push(truncateLines(state.cycle.gate ?? '(não encontrado)', 12));
	}

	out.push('');
	out.push('## Próxima decisão relevante (PROJECT_STATUS.md)');
	out.push(truncateLines(state.nextDecision ?? '(não encontrado)', 6));
	if (state.changelogUnreleased) {
		out.push('');
		out.push('## CHANGELOG — Unreleased');
		out.push(truncateLines(state.changelogUnreleased, 10));
	}
	if (item && state.currentWork) {
		out.push('');
		out.push(`## Item ${item.id}`);
		out.push(`**Kind:** ${item.kind}`);
		out.push(`**Source:** ${item.source}`);
		out.push(`**Status:** ${item.status}`);
	} else if (item) {
		out.push('');
		out.push(`## Item ${item.id}`);
		out.push(`**Título:** ${item.title}`);
		out.push(`**Prioridade:** ${item.priority ?? '?'}`);
		out.push(`**Status:** ${item.status}${item.commit ? ` (commit ${item.commit})` : ''}`);
		if (item.acceite) out.push(`**Aceite:** ${item.acceite}`);
		if (item.notasTecnicas && item.notasTecnicas.length > 0) {
			out.push('**Notas técnicas:**');
			for (const b of item.notasTecnicas) out.push(b);
		}
		if (state.cycle.dependencies) {
			out.push('**Dependências (seção do ciclo, pode não ser específica deste item):**');
			out.push(truncateLines(state.cycle.dependencies, 8));
		}
	} else if (itemId) {
		out.push('');
		const where = state.currentWork ? `trabalho atual (${state.currentWork.id})` : 'backlog vigente';
		out.push(`⚠️ Item "${itemId}" não encontrado no ${where}.`);
	}
	return truncateLines(out.join('\n'), 60);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const repoRoot = findRepoRoot();
	const state = buildState(repoRoot);

	let item = null;
	if (args.item) {
		item = findItem(state, args.item);
		if (!item) {
			const where = state.currentWork ? `trabalho atual (${state.currentWork.id})` : `backlog vigente (${state.cycle.file})`;
			throw new NotFoundError(`item "${args.item}" não encontrado no ${where}.`);
		}
	}

	if (args.format === 'json') {
		process.stdout.write(JSON.stringify({ ...state, item }, null, 2) + '\n');
	} else {
		process.stdout.write(toMarkdown(state, item, args.item) + '\n');
	}
}

try {
	main();
	process.exit(0);
} catch (err) {
	if (err instanceof UsageError) {
		process.stderr.write(`hydra-state: uso inválido — ${err.message}\n`);
		process.exit(1);
	}
	if (err instanceof NotFoundError) {
		process.stderr.write(`hydra-state: ${err.message}\n`);
		process.exit(2);
	}
	if (err instanceof StateReadError) {
		process.stderr.write(`hydra-state: erro ao ler estado — ${err.message}\n`);
		process.exit(3);
	}
	process.stderr.write(`hydra-state: erro inesperado — ${err.stack || err.message}\n`);
	process.exit(3);
}
