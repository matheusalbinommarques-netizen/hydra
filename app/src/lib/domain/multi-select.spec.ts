import { describe, expect, it } from 'vitest';
import { decodeMultiSelectValue, encodeMultiSelectValue, isValidMultiSelectValue } from './multi-select';

describe('encodeMultiSelectValue / decodeMultiSelectValue', () => {
	it('round-trip preserva a lista de ids', () => {
		const ids = ['duplicated_information', 'too_many_steps'];
		expect(decodeMultiSelectValue(encodeMultiSelectValue(ids))).toEqual(ids);
	});

	it('round-trip de lista vazia', () => {
		expect(decodeMultiSelectValue(encodeMultiSelectValue([]))).toEqual([]);
	});

	it('decodeMultiSelectValue rejeita JSON inválido', () => {
		expect(decodeMultiSelectValue('isto não é JSON {{{')).toBeNull();
	});

	it('decodeMultiSelectValue rejeita algo que não seja array', () => {
		expect(decodeMultiSelectValue('{"a":1}')).toBeNull();
		expect(decodeMultiSelectValue('"uma string"')).toBeNull();
		expect(decodeMultiSelectValue('42')).toBeNull();
	});

	it('decodeMultiSelectValue rejeita array com item que não é string', () => {
		expect(decodeMultiSelectValue('["a", 1, "b"]')).toBeNull();
		expect(decodeMultiSelectValue('["a", null]')).toBeNull();
	});
});

describe('isValidMultiSelectValue', () => {
	const validIds = ['too_many_steps', 'duplicated_information', 'other'];

	it('aceita ids válidos, sem duplicados', () => {
		expect(isValidMultiSelectValue(encodeMultiSelectValue(['too_many_steps', 'other']), validIds)).toBe(true);
	});

	it('aceita lista vazia', () => {
		expect(isValidMultiSelectValue(encodeMultiSelectValue([]), validIds)).toBe(true);
	});

	it('rejeita JSON inválido', () => {
		expect(isValidMultiSelectValue('{{{', validIds)).toBe(false);
	});

	it('rejeita valor que não é array de strings', () => {
		expect(isValidMultiSelectValue('{"a":1}', validIds)).toBe(false);
	});

	it('rejeita ids duplicados', () => {
		expect(isValidMultiSelectValue(encodeMultiSelectValue(['other', 'other']), validIds)).toBe(false);
	});

	it('rejeita id que não existe nas opções', () => {
		expect(isValidMultiSelectValue(encodeMultiSelectValue(['inexistente']), validIds)).toBe(false);
	});
});
