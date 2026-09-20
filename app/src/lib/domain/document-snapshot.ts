// Snapshot formal do Documento do projeto (ETAPA 15 do rework, D076/D077) —
// histórico congelado de UM artefato vivo específico (/document), nunca
// estado atual. Vive FORA de ProjectState: não participa de save(), de
// serialization.ts nem de validateInvariants, e é imutável depois de criado
// (D076). Deliberadamente NÃO é uma entidade Artifact/Snapshot genérica —
// outros artefatos continuam abertos e só entram com decisão própria.
//
// O conteúdo é uma representação semântica tipada do Documento (nunca
// HTML/Markdown, nunca ProjectState): só texto já resolvido, sem ids que
// apontem para dado vivo, para que uma mudança futura do projeto (grupo
// removido, label do catálogo) nunca altere o que o snapshot mostra.

export const DOCUMENT_SNAPSHOT_SCHEMA_VERSION = 1;

export interface DocumentSnapshotEvidenceItem {
	groupLabel: string;
	outcomeLabel: string;
	learning: string;
}

export interface DocumentSnapshotBlock {
	activityId: string;
	heading: string;
	value: string;
	chips?: string[];
	evidenceItems?: DocumentSnapshotEvidenceItem[];
}

export interface DocumentSnapshotSection {
	phaseId: string;
	phaseLabel: string;
	blocks: DocumentSnapshotBlock[];
}

// Corpo do schema v1. A versão do schema mora na coluna
// document_snapshot.schema_version, nunca dentro do JSON.
export interface DocumentSnapshotContentV1 {
	sections: DocumentSnapshotSection[];
}

export interface DocumentSnapshot {
	id: string;
	projectId: string;
	// Monotônica por projeto (alocada atomicamente pelo repositório).
	version: number;
	capturedAt: string;
	content: DocumentSnapshotContentV1;
}

export class DocumentSnapshotParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DocumentSnapshotParseError';
	}
}

function fail(path: string, expected: string): never {
	throw new DocumentSnapshotParseError(`Conteúdo de snapshot inválido em ${path}: esperado ${expected}.`);
}

function asObject(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'objeto');
	return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
	if (typeof value !== 'string') fail(path, 'texto');
	return value as string;
}

function asArray(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value)) fail(path, 'lista');
	return value as unknown[];
}

// Valida e reconstrói o corpo do schema v1 numa forma canônica (só as chaves
// conhecidas, sempre na mesma ordem) — a serialização de dois conteúdos
// semanticamente iguais é sempre byte-idêntica. Recebe a schema_version da
// linha: aceita v1 e rejeita explicitamente qualquer outra.
export function parseDocumentSnapshotContent(schemaVersion: number, raw: unknown): DocumentSnapshotContentV1 {
	if (schemaVersion !== DOCUMENT_SNAPSHOT_SCHEMA_VERSION) {
		throw new DocumentSnapshotParseError(
			`schema_version ${String(schemaVersion)} de snapshot do Documento não é suportada.`
		);
	}

	const root = asObject(raw, 'content');
	const sections = asArray(root.sections, 'content.sections').map((rawSection, s) => {
		const sectionPath = `content.sections[${s}]`;
		const section = asObject(rawSection, sectionPath);
		const blocks = asArray(section.blocks, `${sectionPath}.blocks`).map((rawBlock, b) => {
			const blockPath = `${sectionPath}.blocks[${b}]`;
			const block = asObject(rawBlock, blockPath);
			const parsed: DocumentSnapshotBlock = {
				activityId: asString(block.activityId, `${blockPath}.activityId`),
				heading: asString(block.heading, `${blockPath}.heading`),
				value: asString(block.value, `${blockPath}.value`)
			};
			if (block.chips !== undefined) {
				parsed.chips = asArray(block.chips, `${blockPath}.chips`).map((chip, c) =>
					asString(chip, `${blockPath}.chips[${c}]`)
				);
			}
			if (block.evidenceItems !== undefined) {
				parsed.evidenceItems = asArray(block.evidenceItems, `${blockPath}.evidenceItems`).map((rawItem, e) => {
					const itemPath = `${blockPath}.evidenceItems[${e}]`;
					const item = asObject(rawItem, itemPath);
					return {
						groupLabel: asString(item.groupLabel, `${itemPath}.groupLabel`),
						outcomeLabel: asString(item.outcomeLabel, `${itemPath}.outcomeLabel`),
						learning: asString(item.learning, `${itemPath}.learning`)
					};
				});
			}
			return parsed;
		});
		return {
			phaseId: asString(section.phaseId, `${sectionPath}.phaseId`),
			phaseLabel: asString(section.phaseLabel, `${sectionPath}.phaseLabel`),
			blocks
		};
	});

	return { sections };
}

// Metadados sem o conteúdo — o que a listagem de versões precisa.
export type DocumentSnapshotSummary = Pick<DocumentSnapshot, 'id' | 'projectId' | 'version' | 'capturedAt'>;
