import { describe, expect, it } from 'vitest';
import { DocumentSnapshotParseError, parseDocumentSnapshotContent } from './document-snapshot';

const valid = {
	sections: [
		{
			phaseId: 'descoberta',
			phaseLabel: 'Descoberta',
			blocks: [{ activityId: 'origem', heading: 'Origem', value: 'v', chips: ['a'] }]
		}
	]
};

describe('parseDocumentSnapshotContent', () => {
	it('aceita schema v1 e devolve forma canônica (chaves desconhecidas, como editable, descartadas)', () => {
		const noisy = structuredClone(valid) as unknown as { sections: { blocks: Record<string, unknown>[] }[] };
		noisy.sections[0].blocks[0].editable = true;
		const parsed = parseDocumentSnapshotContent(1, noisy);
		expect(parsed).toEqual(valid);
		expect(JSON.stringify(parsed)).toBe(JSON.stringify(valid));
	});

	it('rejeita schema_version desconhecida explicitamente', () => {
		expect(() => parseDocumentSnapshotContent(2, valid)).toThrow(DocumentSnapshotParseError);
		expect(() => parseDocumentSnapshotContent(0, valid)).toThrow(/não é suportada/);
	});

	it('rejeita forma inválida', () => {
		expect(() => parseDocumentSnapshotContent(1, { sections: [{ phaseId: 1 }] })).toThrow(DocumentSnapshotParseError);
		expect(() => parseDocumentSnapshotContent(1, null)).toThrow(DocumentSnapshotParseError);
	});
});
