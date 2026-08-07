# Backlog do Ciclo 5

**Meta:** provar, por meio de uma fatia pequena em produção, que o Hydra
pode deixar de operar apenas como "pergunta → texto → próxima atividade" e
passar a permitir que uma atividade CONSTRUA dados vivos do projeto e que
atividades seguintes OPEREM sobre os mesmos dados sem redigitação.

## Origem

Ciclo 5 formalizado no repositório com C5-01 atualmente em andamento. O
Ciclo 4 encerrou a baseline funcional do Release 0 (gate aprovado em
25/07/2026); este ciclo abre uma frente nova, deliberadamente pequena: o
Planejamento da entrega serve como laboratório inicial da mecânica
Construir → Operar, não como escopo de uma reestruturação geral do
produto.

## Must

### C5-01 — Construir → Operar sobre partes do trabalho

**Status:** EM ANDAMENTO.

**Hipótese:** `decompor_trabalho` cria uma coleção estruturada de partes
do trabalho e `priorizar_entregas` opera exatamente sobre essa mesma
coleção, sem pedir que o usuário reescreva o que já definiu.

**Estado verdadeiro atual:**
- implementação realizada localmente;
- revisão técnica de código realizada;
- correções técnicas resultantes da review aplicadas;
- documentação de entrega preparada (este backlog, `PROJECT_STATUS.md`,
  `CHANGELOG.md`);
- stage ainda vazio;
- nenhum commit/push da entrega;
- `hydra-verify full` final ainda não executado;
- QA final/seal ainda não realizado.

**Evidências (parciais — C5-01 em andamento, nada abaixo é conclusão):**
- domínio: `PlanningItem` (`domain/planning-items.ts`, novo) — codec e
  operações puras (adicionar, renomear, remover, mover, commit de texto
  com trim); `confirmPlanningPriority` (`domain/transitions.ts`), que
  localiza "Priorizar entregas" por id explícito e recusa a confirmação
  com coleção vazia (`planning_no_items`); `ExplicitConfirmationActivity`
  passa a ser discriminada por `allowsSkip` (`domain/catalog-types.ts`);
- catálogo: `decompor_trabalho.partes_trabalho` muda para o tipo de campo
  `lista_partes`; `priorizar_entregas` passa a `explicit_confirmation`,
  `allowsSkip: true`, sem campos (`catalog/planning.ts`,
  `catalog/validate.ts`);
- aplicação/orientação: `pending-items.ts` e `project-view.ts` passam a
  exigir `allowsSkip === true` (além dos textos de pendência) para expor
  um `PendingItem`, em vez de inferir por `completionMode`;
  `serialization.ts` permite `pulada` para `explicit_confirmation` com
  `allowsSkip: true`, mantendo a restrição para `allowsSkip: false`;
- interface: `PlanningItemsEditor.svelte` (novo, modos construir/operar);
  `ActivityForm.svelte` e `now/+page.svelte`/`+page.server.ts` com as duas
  telas (Decompor, Priorizar) e a edição nominal pós-conclusão de
  "Decompor o trabalho" a partir de Registros; `records-view.ts` apresenta
  a coleção como lista humana numerada, nunca a serialização interna;
- testes: cobertura unitária nova em todas as camadas acima
  (`planning-items.spec.ts` novo; specs de `transitions`, `catalog`,
  `serialization`, `pending-items`, `project-view`, `project-use-cases`,
  `records-view` estendidos); jornada Playwright
  `walking-skeleton-journey.journey.ts` estendida com os passos explícitos
  de Decompor/Priorizar (criar 3 partes, reutilizar sem redigitar,
  reordenar, confirmar, ordem persistindo na exportação);
- `npm run check` e a suíte de unitários passam a cada rodada de
  verificação feita durante a implementação e a review; `hydra-verify
  --mode fast` passou; a jornada Playwright completa foi executada
  isoladamente com sucesso (~27,6s) durante a implementação — a execução
  formal via `hydra-verify --mode full` ainda está pendente.

**Critérios de aceite:**
- criar pelo menos 3 partes uma única vez;
- atividade seguinte reutiliza exatamente as mesmas partes;
- nenhuma redigitação dos nomes;
- prioridade alterável via ↑ / ↓;
- ordem persiste;
- item novo entra no final;
- remover preserva ordem relativa;
- renomear preserva posição;
- item vazio/espaços não persiste;
- prioridade já confirmada não reabre após editar Decompor;
- nenhuma sinalização automática pós-confirmação;
- Registros apresenta conteúdo humano, não JSON;
- progressão e PendingItems permanecem coerentes;
- demais `explicit_confirmation` não sofrem regressão;
- verificações do workflow passam.

**Fora de escopo desta entrega:**
- esforço;
- capacidade;
- dependências;
- critérios;
- marcos;
- datas;
- riscos;
- status de execução;
- generalização de WorkItem;
- promoção de PlanningItem para entidade/tabela própria;
- tailoring;
- redesign das demais atividades;
- Home;
- branding;
- drag-and-drop;
- versionamento da confirmação;
- redesign geral do domínio.

**Tipo:** código e testes.

## Gate de conclusão do Ciclo 5

O Ciclo 5 não significa redesenhar todo o Hydra.

A fatia Construir → Operar deve demonstrar em uso real que o usuário está
trabalhando sobre informação que o Hydra já conhece, em vez de
reconstruí-la em atividades consecutivas.

A aprovação técnica de C5-01 não valida automaticamente a jornada
inteira — depois da publicação haverá dogfooding real.

Antes de considerar o Ciclo 5 entregue:
- C5-01 concluído, com todos os critérios de aceite atendidos;
- `hydra-verify full` PASS;
- nenhuma mudança nas áreas protegidas (`domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`) sem justificativa técnica
  e autorização explícita registradas antes da alteração;
- nenhuma regressão nas demais atividades `explicit_confirmation`.

Gate ainda não avaliado — C5-01 em andamento.
