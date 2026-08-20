# S7 — Event log incremental

**Status:** ✅ concluído — dogfood funcional PASS, Design Gate aprovado e
congelado via Claude Design MCP, dogfood visual PASS. Log de eventos
append-only (`project_event`) cobrindo o loop WorkItem/Impediment
(ETAPA 6, D036) — quatro tipos fechados (`work_item.created`,
`work_item.status_changed`, `impediment.registered`,
`impediment.status_changed`), sem event sourcing/replay/CQRS. Estado e
evento persistem atomicamente (`ProjectRepository.save`/`insert` com
`events?` opcional). Projeto pré-S7 abre com histórico vazio, sem
backfill. Export/import preserva eventos e mantém compatibilidade com
export anterior à S7. `/records` é a única projeção cronológica
("Atividade recente", filtro por entidade); Trabalho ("Ver histórico") e
Acompanhamento ("Ver mudanças relacionadas") só navegam até lá.
`hydra-verify full` PASS (5/5 etapas, 730 testes unitários, 22/22
jornadas). Ver D037 (`docs/07-management/decision-log.md`) para o
detalhamento técnico completo, inclusive a divergência de cor resolvida
entre o Design Gate e a paleta papel/tinta/grafite.

**Origem:** `docs/core/HYDRA_PRODUCT_REWORK.md` §37, sequência canônica
do rework — segue S6V (interlúdio de convergência visual).

## Objetivo

Registrar eventos relevantes de mudanças em objetos vivos, para sustentar
"atividade recente", "o que mudou?", explicação de sinais e histórico de
item — sem virar event sourcing, sem substituir `ProjectState` como fonte
de verdade.

## Escopo

1. Tabela `project_event` (append-only, fora do ciclo DELETE+reinsert de
   `saveTransaction`) — `domain/events.ts`, `0001_init.sql`,
   `sqlite-project-repository.ts`.
2. Emissão de evento nos 5 use-cases do loop S6: `addWorkItem`,
   `moveWorkItem`, `addImpediment`, `resolveImpediment`,
   `reopenImpediment` — nunca em operação no-op.
3. Atomicidade estado + evento: `ProjectRepository.save`/`insert` ganham
   `events?: ProjectEvent[]` opcional (default `[]`), mesma transação
   SQLite, sem quebrar nenhuma chamada existente sem evento.
4. Export/import preservando eventos (`serializeProjectState`/
   `deserializeProjectEvents`, campo `events` aditivo no envelope
   `version: 1` — sem bump de versão, sem migração de formato).
5. Projeção em `/records` ("Atividade recente", filtro por entidade via
   `?entityId=` repetível) e affordances de navegação em `/work` ("Ver
   histórico") e `/tracking` ("Ver mudanças relacionadas").
6. Refinamento visual/interacional das três superfícies a partir do
   Design Gate "Design Gate - S7 Event Log" (Claude Design MCP): anatomia
   da linha de evento, chip do estado filtrado, posição de "Ver
   histórico" no painel de Trabalho, copy do empty state.

## Fora de escopo

- Event sourcing, replay, reducer de evento, CQRS, event store genérico,
  snapshot para reconstrução.
- Instrumentar ScopeItem, AffectedGroup, Answers, Evidence,
  ExternalAction ou qualquer objeto vivo fora do loop WorkItem/Impediment.
- Backfill de eventos para projetos pré-S7.
- Segunda projeção cronológica além de `/records`, busca, filtros
  avançados, categorias configuráveis, comentários, undo/revert,
  comparação de versões, analytics.
- `Signal` genérico ou acoplamento formal entre `movementSignal` e o
  event log — o sinal continua derivado só do estado atual.
- Qualquer capacidade da ETAPA 8 (`Dependency`/`Milestone`/Roadmap/
  Timeline).

## Critérios de aceite

- Evento persiste na mesma transação do estado; nenhum evento órfão de
  projeto, nenhum estado sem o evento correspondente em caso de falha
  parcial.
- Operação idempotente (mover para o mesmo status, resolver já resolvido)
  não emite evento duplicado.
- Banco pré-S7 abre normalmente e `listEvents` retorna `[]` sem exigir
  backfill.
- Export de projeto com eventos os inclui; import os restaura; export
  gerado antes da S7 (sem a chave `events`) continua importável, produz
  histórico vazio.
- `/records`, `/work` e `/tracking` seguem a hierarquia/copy/anatomia do
  Design Gate aprovado: sem termo técnico do event model exposto
  ("Impediment", `type`, `entityId`, `payload`), texto do evento nunca
  trunca, sem overflow horizontal em desktop/mobile.

## Próximo Stage

S8 ("Dependency + Milestone + Roadmap/Timeline",
`docs/core/HYDRA_PRODUCT_REWORK.md` §38) — não iniciado, não autorizado
neste corte.
