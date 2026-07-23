// Resultado compartilhado — ver docs/06-architecture/contracts.md §3.

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
