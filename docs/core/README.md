# Mapa de autoridade — docs/core

`docs/core/` não é um único nível de autoridade. Cada arquivo tem um papel
diferente; use o mais específico para a pergunta em questão.

## Semântica de produto e rework

- `HYDRA_PRODUCT_REWORK.md`: semântica e decisões canônicas do rework de
  produto em andamento — fonte principal para "o que o produto deve fazer
  e por quê" enquanto o rework estiver ativo.
- `PRODUCT_SPEC.md`, `DOMAIN_MODEL.md`, `STATE_MACHINE.md`,
  `ORIENTATION_ENGINE.md`: baseline conceitual duradoura do produto,
  mantida em sincronia com o código atual. Em conflito direto com
  `HYDRA_PRODUCT_REWORK.md` ou com o código atual, não presuma qual
  prevalece — pare e registre o conflito.
- `RELEASE_0_SPEC.md`, `UX_DESIGN_SPEC.md`, `TECHNICAL_BRIEF.md`: marcados
  com banner `HISTÓRICO / NÃO AUTORIDADE CORRENTE` — descrevem uma
  baseline/planejamento anterior ao rework e ao domínio atual, superados
  em pontos concretos e verificáveis contra o código.

## Decisões duráveis

Decisões de arquitetura, schema ou dependência ficam registradas em
`docs/07-management/decision-log.md`, não neste diretório.

## Contrato executável

Para o comportamento real de código, schema e testes, o próprio código é
autoridade — não um documento conceitual. Documentos de arquitetura (ex.:
`docs/06-architecture/contracts.md`) podem estar desatualizados em relação
ao código; em divergência sobre o que existe hoje, o código vigente
prevalece.

Isso vale só para essa pergunta. Sobre a direção de produto, o código não
é autoridade: uma capacidade ainda não implementada não deixa de ser
decisão vigente por estar ausente do repo. Ver a precedência por tipo de
pergunta em `CLAUDE.md`.

## Estado operacional

- `CURRENT_WORK.json`: ponteiro operacional transitório — qual é o
  Cycle/Stage/corte de remediação atual (consumido por
  `hydra-state.mjs`/`hydra-delivery-guard.mjs`). Sempre atual; não é
  histórico nem especificação.
- `PROJECT_STATUS.md` (raiz do repo): snapshot narrativo do progresso,
  desatualizado por natureza — não é contrato nem ponteiro.
- `ENGINEERING_REMEDIATION.md`: marcado com banner
  `HISTÓRICO / NÃO AUTORIDADE CORRENTE` — registro do programa de
  remediação técnica R1–R6, concluído (`Status: COMPLETE`); partes do
  texto (ex.: roadmap "pausado") descrevem estado operacional que já não
  é verdadeiro.
- `LIVING_OBJECT_CHECKLIST.md`: referência operacional para implementar
  uma nova living-object capability sem redescobrir o plumbing mecânico
  do vertical slice.

## Documentação histórica

A documentação completa em `docs/01-*` a `docs/09-*` preserva baseline
formal, justificativas, riscos, decisões e histórico. Documentos ali
marcados como histórico/não vigente não concedem autoridade normativa
atual, mesmo quando referenciados por código ou por outros documentos.

Em caso de conflito entre fontes, não alterar silenciosamente. Registrar e
decidir.
