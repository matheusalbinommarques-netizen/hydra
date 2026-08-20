# S6T — Reconciliar o tooling de delivery

**Status:** ✅ concluído — revisão humana PASS. Evidência:
[hydra-delivery-guard.mjs](../../.claude/scripts/hydra-delivery-guard.mjs)
(`self-test`, 4/4 OK), [hydra-ship/SKILL.md](../../.claude/skills/hydra-ship/SKILL.md),
`hydra-verify --mode fast --item S6T` PASS (check + 701 testes unitários +
`git diff --check`).

Corte interno de tooling, não de produto. S7 (Event Log) continua
`not_started` e não está autorizado por este corte.

## Objetivo

Eliminar duas inconsistências comprovadas entre a política de entrega
vigente e o comportamento real dos scripts de delivery.

## Evidências que motivaram o corte

- commit `9bdd1a4` (2026-08-11) reduziu Nível 2 para verificação final
  `fast` (`CLAUDE.md`, `.claude/skills/hydra-work/SKILL.md` §4), mas
  `.claude/scripts/hydra-delivery-guard.mjs` (`cmdSeal`) ainda exige
  recibo `mode: "full"` para todo `--level` diferente de 1.
- `hydra-delivery-guard.mjs` (`ITEM_ID_RE`) e `hydra-work/SKILL.md` já
  aceitam itens `Cx-y`, `Sx[Letra]` e `Rx` — confirmado pelos commits de
  S5, S6 e S6V, nenhum dos quais possui ciclo numérico. Mas
  `.claude/skills/hydra-ship/SKILL.md` §3 ainda deriva `Hydra-Cycle`
  incondicionalmente do prefixo antes do hífen, o que não existe para
  `Sx`/`Rx`.

## Escopo

- `.claude/scripts/hydra-delivery-guard.mjs`: política de seal por nível
  (fast aceitável em nível 1 e 2; full obrigatório só em nível 3).
- `.claude/skills/hydra-ship/SKILL.md`: trailers `Hydra-Item`/
  `Hydra-Cycle` determinísticos por formato de item (`Cx-y` leva
  `Hydra-Cycle`; `Sx`/`Rx` não levam), incluindo a recuperação de push.
- `docs/08-delivery/workflow-v2-design.md`: reconciliar somente os
  trechos que ainda descrevem a política antiga (seal exige full para
  nível 2/3; trailers sempre em par).
- Testes/provas determinísticos isolados para as duas mudanças.

## Fora de escopo

- `ENGINEERING_REMEDIATION.md` e itens R1–R6.
- S7 (Event Log) e qualquer arquivo de produto (`app/`).
- Qualquer outra reforma de processo além das duas inconsistências acima.

## Critérios de aceite

- `hydra-delivery-guard.mjs seal`: nível 1 e nível 2 aceitam recibo
  `fast` ou `full`; nível 3 exige `full` e rejeita `fast`.
- `/hydra-ship` deriva `Hydra-Cycle` somente quando o item é `Cx-y`; para
  `Sx`/`Sx-Letra`/`Rx`, o commit leva apenas `Hydra-Item`.
- Recuperação de push (§6 de `hydra-ship/SKILL.md`) reconhece commits
  válidos de itens `Sx`/`Rx` sem exigir `Hydra-Cycle`.
- Nenhuma verificação de segurança existente (item correto, HEAD correto,
  árvore staged exata, forma do recibo/seal) foi enfraquecida.
- Prova determinística cobrindo os casos de seal por nível e de trailers
  por formato de item.

## Próximo Stage de produto

S7 (Event Log) continua sendo o próximo Stage de produto, ainda
`not_started`. Este corte não o inicia nem o autoriza.
