import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import type { BancadaOverviewBlock } from '../now/bancada-overview-view';
import { buildDocumentView } from './document-view';

describe('buildDocumentView', () => {
	it('zero blocos: nenhuma seção', () => {
		const view = buildDocumentView(catalog, []);
		expect(view.sections).toEqual([]);
	});

	it('blocos distribuídos entre as três fases geram só as seções correspondentes', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Um problema' },
			{ activityId: 'objetivo_entregaveis', heading: 'Objetivo do projeto', value: 'Lançar o portal.' }
		];
		const view = buildDocumentView(catalog, blocks);
		expect(view.sections.map((s) => s.phaseId)).toEqual(['descoberta', 'estruturacao']);
		expect(view.sections[0].phaseLabel).toBe('Descoberta');
		expect(view.sections[1].phaseLabel).toBe('Estruturação do projeto');
	});

	it('uma fase sem nenhum bloco correspondente não aparece como seção vazia', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Um problema' }
		];
		const view = buildDocumentView(catalog, blocks);
		expect(view.sections).toHaveLength(1);
		expect(view.sections.find((s) => s.phaseId === 'definicao')).toBeUndefined();
		expect(view.sections.find((s) => s.phaseId === 'estruturacao')).toBeUndefined();
	});

	it('com as três fases preenchidas, gera as três seções na ordem do catálogo', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'objetivo_entregaveis', heading: 'Objetivo do projeto', value: 'Objetivo.' },
			{ activityId: 'usuario_principal', heading: 'Usuário principal', value: 'Analista.' },
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Um problema' }
		];
		const view = buildDocumentView(catalog, blocks);
		expect(view.sections.map((s) => s.phaseId)).toEqual(['descoberta', 'definicao', 'estruturacao']);
	});

	it('preserva a ordem dos blocos dentro de cada seção, conforme recebida', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Origem' },
			{ activityId: 'contexto', heading: 'Contexto inicial', value: 'Contexto' },
			{ activityId: 'problema', heading: 'Problema', value: 'Problema' }
		];
		const view = buildDocumentView(catalog, blocks);
		expect(view.sections[0].blocks.map((b) => b.activityId)).toEqual(['origem', 'contexto', 'problema']);
	});

	it('preserva heading, value e chips tal como recebidos, sem recalcular nada', () => {
		const blocks: BancadaOverviewBlock[] = [
			{
				activityId: 'problema',
				heading: 'Problema',
				value: 'As solicitações chegam sem padrão.',
				chips: ['Excesso de etapas', 'Retrabalho']
			}
		];
		const view = buildDocumentView(catalog, blocks);
		const problema = view.sections[0].blocks[0];
		expect(problema.heading).toBe('Problema');
		expect(problema.value).toBe('As solicitações chegam sem padrão.');
		expect(problema.chips).toEqual(['Excesso de etapas', 'Retrabalho']);
	});

	it('bloco sem chips não ganha chips por conta própria', () => {
		const blocks: BancadaOverviewBlock[] = [{ activityId: 'publico', heading: 'Público afetado', value: 'X' }];
		const view = buildDocumentView(catalog, blocks);
		expect(view.sections[0].blocks[0].chips).toBeUndefined();
	});

	it('um activityId que não pertence a nenhuma das três fases é ignorado, sem gerar seção nem bloco', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Origem' },
			{ activityId: 'decompor_trabalho', heading: 'Fora de escopo', value: 'Não deveria aparecer' }
		];
		const view = buildDocumentView(catalog, blocks);
		expect(view.sections).toHaveLength(1);
		expect(view.sections[0].blocks.map((b) => b.activityId)).toEqual(['origem']);
	});

	it('blocos de Descoberta são marcados como editáveis (editable: true)', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Origem' }
		];
		const view = buildDocumentView(catalog, blocks);
		expect(view.sections[0].blocks[0].editable).toBe(true);
	});

	it('blocos de Definição e Estruturação nunca são marcados como editáveis', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'usuario_principal', heading: 'Usuário principal', value: 'Analista.' },
			{ activityId: 'objetivo_entregaveis', heading: 'Objetivo do projeto', value: 'Objetivo.' }
		];
		const view = buildDocumentView(catalog, blocks);
		const allBlocks = view.sections.flatMap((s) => s.blocks);
		expect(allBlocks.every((b) => b.editable === false)).toBe(true);
	});
});
