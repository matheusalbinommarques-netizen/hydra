import { describe, expect, it } from 'vitest';
import { catalog } from '$lib/catalog';
import type { BancadaOverviewBlock } from './bancada-overview-view';
import { buildDocumentContent } from './document-content';

describe('buildDocumentContent', () => {
	it('zero blocos: nenhuma seção', () => {
		const view = buildDocumentContent(catalog, []);
		expect(view.sections).toEqual([]);
	});

	it('blocos distribuídos entre as três fases geram só as seções correspondentes', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Um problema' },
			{ activityId: 'objetivo_entregaveis', heading: 'Objetivo do projeto', value: 'Lançar o portal.' }
		];
		const view = buildDocumentContent(catalog, blocks);
		expect(view.sections.map((s) => s.phaseId)).toEqual(['descoberta', 'estruturacao']);
		expect(view.sections[0].phaseLabel).toBe('Descoberta');
		expect(view.sections[1].phaseLabel).toBe('Estruturação do projeto');
	});

	it('uma fase sem nenhum bloco correspondente não aparece como seção vazia', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Um problema' }
		];
		const view = buildDocumentContent(catalog, blocks);
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
		const view = buildDocumentContent(catalog, blocks);
		expect(view.sections.map((s) => s.phaseId)).toEqual(['descoberta', 'definicao', 'estruturacao']);
	});

	it('preserva a ordem dos blocos dentro de cada seção, conforme recebida', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Origem' },
			{ activityId: 'problema', heading: 'Situação', value: 'Situação' },
			{ activityId: 'publico', heading: 'Público afetado', value: 'Público' }
		];
		const view = buildDocumentContent(catalog, blocks);
		expect(view.sections[0].blocks.map((b) => b.activityId)).toEqual(['origem', 'problema', 'publico']);
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
		const view = buildDocumentContent(catalog, blocks);
		const problema = view.sections[0].blocks[0];
		expect(problema.heading).toBe('Problema');
		expect(problema.value).toBe('As solicitações chegam sem padrão.');
		expect(problema.chips).toEqual(['Excesso de etapas', 'Retrabalho']);
	});

	it('bloco sem chips não ganha chips por conta própria', () => {
		const blocks: BancadaOverviewBlock[] = [{ activityId: 'publico', heading: 'Público afetado', value: 'X' }];
		const view = buildDocumentContent(catalog, blocks);
		expect(view.sections[0].blocks[0].chips).toBeUndefined();
	});

	it('um activityId que não pertence a nenhuma das três fases é ignorado, sem gerar seção nem bloco', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Origem' },
			{ activityId: 'decompor_trabalho', heading: 'Fora de escopo', value: 'Não deveria aparecer' }
		];
		const view = buildDocumentContent(catalog, blocks);
		expect(view.sections).toHaveLength(1);
		expect(view.sections[0].blocks.map((b) => b.activityId)).toEqual(['origem']);
	});

	it('blocos nunca carregam affordance de UI (editable)', () => {
		const blocks: BancadaOverviewBlock[] = [
			{ activityId: 'origem', heading: 'Origem do projeto', value: 'Origem' }
		];
		const view = buildDocumentContent(catalog, blocks);
		expect(view.sections[0].blocks[0]).toEqual({
			activityId: 'origem',
			heading: 'Origem do projeto',
			value: 'Origem'
		});
	});
});

describe('buildDocumentContent — Evidence (ETAPA 3 do rework, "Validação Externa")', () => {
	const blocks: BancadaOverviewBlock[] = [
		{ activityId: 'origem', heading: 'Origem do projeto', value: 'Origem' },
		{ activityId: 'publico', heading: 'Quem é afetado', value: 'Grupo afetado: Operação (Alto).', chips: ['Operação'] }
	];

	it('sem evidenceItems, o bloco "publico" não ganha a propriedade', () => {
		const view = buildDocumentContent(catalog, blocks, []);
		const publico = view.sections[0].blocks.find((b) => b.activityId === 'publico')!;
		expect(publico.evidenceItems).toBeUndefined();
	});

	it('evidenceItems é anexado só ao bloco "publico" — outros blocos da mesma seção não são afetados', () => {
		const view = buildDocumentContent(catalog, blocks, [
			{ groupLabel: 'Operação', outcomeLabel: 'Confirmou parcialmente', learning: 'O retrabalho ocorre em picos.' }
		]);
		const origem = view.sections[0].blocks.find((b) => b.activityId === 'origem')!;
		const publico = view.sections[0].blocks.find((b) => b.activityId === 'publico')!;
		expect(origem.evidenceItems).toBeUndefined();
		expect(publico.evidenceItems).toEqual([
			{ groupLabel: 'Operação', outcomeLabel: 'Confirmou parcialmente', learning: 'O retrabalho ocorre em picos.' }
		]);
	});

	it('preserva múltiplas Evidence do mesmo ou de grupos diferentes, na ordem recebida — sem roteiro/perguntas/preparation', () => {
		const view = buildDocumentContent(catalog, blocks, [
			{ groupLabel: 'Operação', outcomeLabel: 'Confirmou parcialmente', learning: 'Aprendizado 1.' },
			{ groupLabel: 'Clientes finais', outcomeLabel: 'Contradisse', learning: 'Aprendizado 2.' }
		]);
		const publico = view.sections[0].blocks.find((b) => b.activityId === 'publico')!;
		expect(publico.evidenceItems).toEqual([
			{ groupLabel: 'Operação', outcomeLabel: 'Confirmou parcialmente', learning: 'Aprendizado 1.' },
			{ groupLabel: 'Clientes finais', outcomeLabel: 'Contradisse', learning: 'Aprendizado 2.' }
		]);
	});
});
