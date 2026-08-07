import { describe, expect, it } from 'vitest';
import {
	addPlanningItem,
	commitPlanningItemText,
	decodePlanningItems,
	encodePlanningItems,
	generatePlanningItemId,
	movePlanningItem,
	removePlanningItem,
	renamePlanningItem
} from './planning-items';

describe('planning-items — codec', () => {
	it('codifica e decodifica ida e volta', () => {
		const items = [
			{ id: 'a', text: 'Tela de abertura' },
			{ id: 'b', text: 'Fluxo de aprovação' }
		];
		expect(decodePlanningItems(encodePlanningItems(items))).toEqual(items);
	});

	it('decodifica undefined/null/vazio como lista vazia', () => {
		expect(decodePlanningItems(undefined)).toEqual([]);
		expect(decodePlanningItems(null)).toEqual([]);
		expect(decodePlanningItems('')).toEqual([]);
	});

	it('decodifica JSON malformado como lista vazia, sem lançar', () => {
		expect(decodePlanningItems('{não é json')).toEqual([]);
	});

	it('decodifica um valor que não é array como lista vazia', () => {
		expect(decodePlanningItems(JSON.stringify({ id: 'a', text: 'x' }))).toEqual([]);
	});

	it('ignora entradas sem id/text de tipo string, mantendo as válidas', () => {
		const raw = JSON.stringify([{ id: 'a', text: 'ok' }, { id: 'b' }, { text: 'sem id' }, 42, null]);
		expect(decodePlanningItems(raw)).toEqual([{ id: 'a', text: 'ok' }]);
	});
});

describe('planning-items — geração de id', () => {
	it('gera ids não vazios e distintos', () => {
		const id1 = generatePlanningItemId();
		const id2 = generatePlanningItemId();
		expect(id1.length).toBeGreaterThan(0);
		expect(id1).not.toBe(id2);
	});
});

describe('planning-items — add/rename/remove (identidade estável)', () => {
	it('adiciona sempre no final', () => {
		const items = [{ id: 'a', text: 'A' }];
		expect(addPlanningItem(items, 'b', 'B')).toEqual([
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B' }
		]);
	});

	it('renomeia preservando a posição e o id', () => {
		const items = [
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B' },
			{ id: 'c', text: 'C' }
		];
		expect(renamePlanningItem(items, 'b', 'B renomeado')).toEqual([
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B renomeado' },
			{ id: 'c', text: 'C' }
		]);
	});

	it('remove e preserva a ordem relativa dos itens restantes', () => {
		const items = [
			{ id: 'a', text: 'A' },
			{ id: 'b', text: 'B' },
			{ id: 'c', text: 'C' }
		];
		expect(removePlanningItem(items, 'b')).toEqual([
			{ id: 'a', text: 'A' },
			{ id: 'c', text: 'C' }
		]);
	});

	it('remover um item elimina o id de vez — um novo item nunca reaproveita', () => {
		const items = removePlanningItem([{ id: 'a', text: 'A' }], 'a');
		const next = addPlanningItem(items, 'b', 'A de novo');
		expect(next.map((item) => item.id)).toEqual(['b']);
	});
});

describe('planning-items — commitPlanningItemText (trim / vazio não persiste)', () => {
	it('aplica trim antes de persistir', () => {
		const items = [{ id: 'a', text: '' }];
		expect(commitPlanningItemText(items, 'a', '  Tela de abertura  ')).toEqual([
			{ id: 'a', text: 'Tela de abertura' }
		]);
	});

	it('remove o item quando o texto commitado fica vazio', () => {
		const items = [{ id: 'a', text: '' }];
		expect(commitPlanningItemText(items, 'a', '   ')).toEqual([]);
	});

	it('remove o item quando o texto commitado é string vazia', () => {
		const items = [{ id: 'a', text: 'já tinha texto' }];
		expect(commitPlanningItemText(items, 'a', '')).toEqual([]);
	});

	it('não cria mínimo arbitrário de caracteres — um único caractere não vazio persiste', () => {
		const items = [{ id: 'a', text: '' }];
		expect(commitPlanningItemText(items, 'a', 'x')).toEqual([{ id: 'a', text: 'x' }]);
	});
});

describe('planning-items — movePlanningItem (↑ / ↓)', () => {
	const items = [
		{ id: 'a', text: 'A' },
		{ id: 'b', text: 'B' },
		{ id: 'c', text: 'C' }
	];

	it('sobe o item trocando com o vizinho anterior', () => {
		expect(movePlanningItem(items, 'b', 'up').map((i) => i.id)).toEqual(['b', 'a', 'c']);
	});

	it('desce o item trocando com o vizinho seguinte', () => {
		expect(movePlanningItem(items, 'b', 'down').map((i) => i.id)).toEqual(['a', 'c', 'b']);
	});

	it('primeiro item não sobe — operação sem efeito', () => {
		expect(movePlanningItem(items, 'a', 'up')).toEqual(items);
	});

	it('último item não desce — operação sem efeito', () => {
		expect(movePlanningItem(items, 'c', 'down')).toEqual(items);
	});

	it('id inexistente é uma operação sem efeito, nunca lança', () => {
		expect(movePlanningItem(items, 'inexistente', 'up')).toEqual(items);
	});
});
