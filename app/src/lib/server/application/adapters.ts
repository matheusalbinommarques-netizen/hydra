// Implementações reais das portas de ports.ts — isoladas aqui para que
// nenhum caso de uso gere ID/timestamp diretamente no seu corpo.

import type { Clock, IdGenerator } from './ports';

export const SystemClock: Clock = {
	now: () => new Date().toISOString()
};

export const CryptoIdGenerator: IdGenerator = {
	generate: () => crypto.randomUUID()
};
