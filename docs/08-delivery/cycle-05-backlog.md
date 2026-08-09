# Backlog do Ciclo 5

**Meta:** provar, por meio de uma fatia pequena em produção, que o Hydra
pode deixar de operar apenas como "pergunta → texto → próxima atividade" e
passar a permitir que uma atividade CONSTRUA dados vivos do projeto e que
atividades seguintes OPEREM sobre os mesmos dados sem redigitação.

## Origem

Ciclo 5 formalizado no repositório com C5-01 publicado. O Ciclo 4 encerrou
a baseline funcional do Release 0 (gate aprovado em 25/07/2026); este
ciclo abre uma frente nova, deliberadamente pequena: o Planejamento da
entrega serve como laboratório inicial da mecânica Construir → Operar,
não como escopo de uma reestruturação geral do produto.

## Must

### C5-01 — Construir → Operar sobre partes do trabalho

**Status:** ✅ CONCLUÍDO / PUBLICADO (commit `a070ed7` — `feat: implementar
mecânica Construir → Operar no planejamento`).

**Hipótese:** `decompor_trabalho` cria uma coleção estruturada de partes
do trabalho e `priorizar_entregas` opera exatamente sobre essa mesma
coleção, sem pedir que o usuário reescreva o que já definiu.

**Estado verdadeiro atual:**
- implementação realizada e revisada tecnicamente, correções da review
  aplicadas;
- todos os critérios de aceite técnicos atendidos;
- `hydra-verify full` final: PASS 5/5, 18/18 jornadas Playwright,
  aproximadamente 82s;
- QA manual final aprovado;
- seal Nível 3 aprovado;
- stage e commit únicos, 32 arquivos publicados;
- publicado em `main`/`origin` — commit `a070ed7`, branch e remoto
  sincronizados;
- nenhum problema pendente da implementação.

C5-01 entregue tecnicamente ≠ hipótese do Ciclo 5 validada — ver "Gate de
conclusão do Ciclo 5" abaixo.

**Evidências:**
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
  --mode fast` passou durante a implementação; execução formal final via
  `hydra-verify --mode full` aprovada — PASS 5/5, 18/18 jornadas
  Playwright, ~82s.

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
- C5-01 concluído, com todos os critérios de aceite atendidos; ✅ atendido
  (commit `a070ed7`);
- `hydra-verify full` PASS; ✅ atendido (PASS 5/5, 18/18 jornadas, ~82s);
- nenhuma mudança nas áreas protegidas (`domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`) sem justificativa técnica
  e autorização explícita registradas antes da alteração; ✅ atendido
  (Nível 3, autorização registrada ao longo da sessão de implementação);
- nenhuma regressão nas demais atividades `explicit_confirmation`. ✅
  atendido (verificado em revisão e QA manual).

Com C5-01 publicado, as condições técnicas do gate estavam atendidas. A
entrega técnica de C5-01, isoladamente, não equivalia à hipótese do
Ciclo 5 validada; a avaliação do gate dependia do dogfooding real da
hipótese — "estou trabalhando sobre um projeto que o Hydra já conhece ou
ainda estou explicando o mesmo projeto repetidamente?".

**Resultado do Gate de conclusão do Ciclo 5 — avaliado em 09/08/2026:
✅ APROVADO.**

- C5-01 concluído, com todos os critérios de aceite atendidos — ✅
  (commit `a070ed7`);
- `hydra-verify full` PASS — ✅ (PASS 5/5, 18/18 jornadas, ~82s);
- nenhuma mudança nas áreas protegidas (`domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`) sem justificativa técnica
  e autorização explícita — ✅;
- nenhuma regressão nas demais atividades `explicit_confirmation` — ✅;
- dogfooding real da hipótese Construir → Operar — ✅ realizado em uso
  real: o fluxo `decompor_trabalho` → `priorizar_entregas` ficou
  perceptivelmente melhor porque a segunda atividade opera sobre as
  partes construídas na primeira, sem redigitação. O ganho percebido não
  veio apenas de reduzir digitação — o valor principal foi manipular
  objetos do projeto que permanecem vivos entre atividades. Isso
  confirma a hipótese central do ciclo: uma atividade pode CONSTRUIR
  dados estruturados do projeto e atividades seguintes podem OPERAR
  sobre esses mesmos dados.

**Ciclo 5 concluído.**

Achado adicional do dogfooding, fora do escopo desta entrega e sem
ampliar C5-01: atividades bem desenhadas têm custo autoral relevante, e
a jornada atual tem granularidade excessiva. Fica registrado como
aprendizado, não como item de backlog deste ciclo — insumo para a
próxima direção de produto (ver `PROJECT_STATUS.md`, seção "Próxima
decisão relevante").
