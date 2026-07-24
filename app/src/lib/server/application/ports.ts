// Portas injetáveis para geração de ID e acesso ao relógio — necessárias
// porque contracts.md §10 define createProject() sem argumentos e
// skipActivity do domínio exige newPendingItemId/occurredAt que nenhum
// *Input carrega. A geração nunca acontece dentro dos casos de uso.

export interface Clock {
	now(): string; // ISO 8601
}

export interface IdGenerator {
	generate(): string;
}
