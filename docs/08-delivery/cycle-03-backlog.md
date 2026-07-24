# Backlog do Ciclo 3

**Meta:** expandir a experiência já funcional do Walking Skeleton com
visibilidade e controle adicionais sobre a jornada — Mapa da jornada,
Registros (respostas e histórico de pendências) e, havendo capacidade,
"Pular etapa" pela interface — sem alterar domínio, catálogo, Motor de
Orientação, ou iniciar redesign visual geral.

**Capacidade de referência:** ~20 horas (mesma referência dos ciclos
anteriores) — não é uma promessa de conclusão.

## Origem dos itens

Os três itens deste ciclo são transportados do backlog encerrado do Ciclo 2
(`docs/08-delivery/cycle-02-backlog.md`), que **não é alterado** por este
documento — permanece como registro histórico do que foi decidido e
entregue naquele ciclo. A prioridade é **reavaliada no contexto do Ciclo 3**,
não simplesmente copiada:

| Ciclo 2 | Ciclo 3 | Prioridade no Ciclo 2 | Prioridade no Ciclo 3 |
|---|---|---|---|
| C2-13 — Tela Mapa mínima | C3-01 | Should | **Must** |
| C2-14 — Tela Registros mínima | C3-02 | Should | **Must** |
| C2-15 — "Pular etapa" na interface | C3-03 | Could | Could |

Mapa e Registros eram Should no Ciclo 2 porque não eram necessários para
provar a cadeia mínima do Walking Skeleton (`TECHNICAL_BRIEF.md` §14). No
Ciclo 3, eles **são** a própria meta do ciclo — deixam de ser opcionais e
passam a Must. "Pular etapa" continua Could: a lógica de domínio já existe
(C2-06/C2-10), só falta a interface, e o ciclo pode ser considerado bem
sucedido mesmo sem ela.

## Dependências novas desta rodada

Nenhuma. Os três itens usam exclusivamente a stack já aprovada (`ADR-001`)
e os casos de uso/DTOs já existentes em `server/application/`.

## Must

### C3-01 — Tela Mapa mínima

**Tipo:** tarefa · **Esforço:** pequeno
**Origem:** C2-13 (Ciclo 2, Should → Must no Ciclo 3)
**Aceite:** lista as 8 atividades do catálogo com status (`não_iniciada`,
`em_andamento`, `concluída`, `pulada`), organizadas por fase, distinguindo a
atividade atual (recomendação da Trilha A). Consome somente `ProjectView`
(via `parent()`) e `catalog/` — nenhum caso de uso novo, nenhuma mudança em
`domain/`, `catalog/` ou `orientation-engine/`.

**Notas técnicas:**
- nova rota `routes/projects/[projectId]/map/` (`+page.server.ts` reaproveita
  `view` do `parent()`; `+page.svelte` cruza `catalog.phases` com
  `view.activityStatuses`/`view.phaseStatuses`, marcando a atividade atual
  via `view.nextActivity`);
- deve renderizar corretamente as três variações de `catalogStatus` já
  presentes no catálogo real: `complete` (Descoberta), `partial` (Definição
  do produto) e `unavailable` (Estruturação, Planejamento, Execução,
  Validação) — sem tratar `partial`/`unavailable` como "concluída";
- atualizar a navegação em `+layout.svelte` (link "Mapa").

### C3-02 — Tela Registros mínima

**Tipo:** tarefa · **Esforço:** pequeno
**Origem:** C2-14 (Ciclo 2, Should → Must no Ciclo 3)
**Aceite:** lista respostas (`view.answers` + `catalog`, mesmo padrão já
usado em `summary/+page.server.ts`) e histórico de pendências, **abertas e
resolvidas**.

**Notas técnicas — obrigatórias para a implementação:**

`ProjectState`/`PendingItem[]` bruto **nunca** deve ser exposto a
`routes/` — isso violaria a fronteira já estabelecida em `contracts.md` §10
("`routes/` nunca recebe `ProjectState` bruto — só o DTO `ProjectView`").
`computeOpenPendingItems` (`orientation-engine/`) continua existindo
exatamente como está, só para a Trilha B — não é alterado nem reaproveitado
para o histórico completo.

A implementação de C3-02 deve, nesta ordem:

1. criar um **DTO de aplicação discriminado por `status`**, análogo ao já
   usado em `domain/` para `PendingItem`, ex.:

   ```typescript
   export type PendingItemHistoryView =
     | {
         id: string;
         activityDefinitionId: string;
         label: string;
         detail: string;
         status: 'aberta';
         createdAt: string;
         resolvedAt?: never;
       }
     | {
         id: string;
         activityDefinitionId: string;
         label: string;
         detail: string;
         status: 'resolvida';
         createdAt: string;
         resolvedAt: string;
       };
   ```

   preservando `id`, `activityDefinitionId`, `status`, `createdAt` e
   `resolvedAt` (somente quando `status === 'resolvida'`), com `label` e
   `detail` derivados do catálogo (mesma fonte que `PendingItemView` já usa:
   `ActivityDefinition.pendingItemLabel`/`pendingItemDetail`);
2. adicionar `pendingItemHistory: PendingItemHistoryView[]` a `ProjectView`
   (`server/application/types.ts`), **mantendo `openPendingItems` como campo
   separado**, inalterado, só para a Trilha B;
3. popular `pendingItemHistory` em `buildProjectView`
   (`server/application/project-view.ts`) diretamente a partir de
   `state.pendingItems` (dado bruto já disponível nessa camada — mesmo
   padrão já usado para popular `answers`), sem chamar `orientation-engine/`;
4. atualizar `docs/06-architecture/contracts.md` §10 para documentar
   `PendingItemHistoryView` e o campo novo de `ProjectView`;
5. criar testes cobrindo **os dois status** (`aberta` e `resolvida`) da
   derivação de `pendingItemHistory`;
6. nova rota `routes/projects/[projectId]/records/`; atualizar
   `+layout.svelte` (link "Registros").

## Could

### C3-03 — "Pular etapa" na interface

**Tipo:** tarefa · **Esforço:** médio
**Origem:** C2-15 (Ciclo 2, Could — permanece Could no Ciclo 3)
**Aceite:** modal de confirmação + chamada a `skipActivity`, exibindo a
pendência criada. Entra somente se houver capacidade no ciclo depois de
C3-01/C3-02.

**Notas técnicas:**
- lógica de domínio (`skipActivity` em `domain/`) e caso de uso
  (`ProjectUseCases.skipActivity`) **já implementados e testados** desde
  C2-06/C2-10 — nenhuma mudança em `domain/` ou `server/application/` além
  de consumir o que já existe;
- nova action `skip` em `now/+page.server.ts`;
- novo componente de confirmação, ex. `lib/components/SkipConfirmationModal.svelte`;
- botão "Pular" em `now/+page.svelte`, visível somente quando
  `activity.allowsSkip === true`.

## Won't neste ciclo

- IA, autenticação, múltiplos usuários, organizações ou permissões,
  colaboração em tempo real, integrações externas, microsserviços;
- redesign geral ou refinamento estético fora do escopo dos três itens
  acima;
- novas fases do catálogo (Estruturação, Planejamento, Execução, Validação —
  seguem `catalogStatus: unavailable`);
- infraestrutura de deploy na VPS e framework de migrations (decisões em
  aberto, `architecture-brief.md` §9);
- qualquer alteração em `domain/`, `catalog/` ou `orientation-engine/`;
- expor `ProjectState`/`PendingItem[]` bruto a `routes/`.

## Dependências entre os itens

- C3-01 e C3-02 são independentes entre si;
- C3-02 depende da criação de `PendingItemHistoryView` e do campo
  `pendingItemHistory` em `ProjectView` — não depende de C3-01;
- C3-03 é tecnicamente independente de C3-01/C3-02 (a lógica de skip já
  existe), mas faz mais sentido vir depois deles, para que o usuário consiga
  conferir o efeito do skip no Mapa/Registros já existentes — dependência de
  sequenciamento de produto, não técnica;
- nenhum dos três exige mudança de schema SQLite (`server/persistence/`
  já cobre `PendingItem` com `status`/`resolvedAt`).

## Ordem de execução

1. C3-01 — Mapa;
2. C3-02 — Registros, incluindo `PendingItemHistoryView`/`pendingItemHistory`
   e a atualização de `contracts.md`;
3. C3-03 — Pular etapa, somente se houver capacidade restante.

## Testes planejados

### C3-01 — Mapa
- fase `complete` (Descoberta), `partial` (Definição do produto) e
  `unavailable` (demais fases) renderizadas corretamente, sem tratar
  `partial`/`unavailable` como concluídas;
- atividade recomendada pela Trilha A destacada corretamente;
- os quatro `ActivityStatus` (`não_iniciada`, `em_andamento`, `concluída`,
  `pulada`) exibidos de forma distinguível.

### C3-02 — Registros
- respostas exibidas corretamente (mesmos dados de `view.answers` +
  `catalog`);
- pendência com `status: 'aberta'` aparece em `pendingItemHistory` sem
  `resolvedAt`;
- pendência com `status: 'resolvida'` aparece em `pendingItemHistory` com
  `resolvedAt` presente;
- `openPendingItems` (Trilha B) continua funcionando sem alteração de
  comportamento.

### C3-03 — Pular etapa
- teste Playwright **dedicado**, com banco SQLite isolado (mesmo padrão de
  isolamento de `app/e2e/helpers/ephemeral-server.ts`) — **sem modificar**
  `app/e2e/walking-skeleton-journey.journey.ts` (jornada E2E canônica já
  concluída e aprovada na C2-12);
- deve confirmar, na mesma execução: pular uma atividade cria a pendência
  correspondente; a Trilha A avança para a próxima atividade elegível (nunca
  recomenda a que acabou de ser pulada); a atividade pulada continua
  acessível e respondível através da Trilha B/Registros (aparece em
  `openPendingItems` e em `pendingItemHistory`, e seu formulário permanece
  alcançável para completar depois).

## Riscos

- `pendingItemHistory` é uma decisão de DTO nova, não coberta hoje por
  `contracts.md` — por isso a implementação de C3-02 inclui atualizar esse
  documento como parte do próprio item, não como tarefa separada esquecível;
- risco de, por engano, popular `pendingItemHistory` repassando
  `PendingItem[]` bruto em vez de mapear para o DTO discriminado — mitigado
  exigindo testes para os dois status antes de considerar o item concluído;
- C3-03 pode não caber na capacidade do ciclo — sem risco técnico (lógica já
  pronta), risco é só de tempo/prioridade, e por isso permanece Could;
- risco de Mapa/Registros virarem pretexto para redesign — mitigado pela
  restrição explícita de escopo.

## Fora do escopo

Ver "Won't neste ciclo" acima.

## Gate de conclusão do Ciclo 3

Antes de considerar o Ciclo 3 entregue:

- Mapa funcional e navegável (C3-01);
- Registros exibindo respostas e histórico de pendências, abertas e
  resolvidas, via `pendingItemHistory` (C3-02);
- `tsc --noEmit` limpo (sem erro de tipo);
- toda a suíte Vitest passando, incluindo os testes novos de C3-01 e C3-02;
- teste(s) Playwright cobrindo Mapa e Registros passando;
- build de produção (`adapter-node`) completando sem erro;
- nenhum `ProjectState` bruto enviado ao cliente em nenhuma rota;
- nenhuma alteração em `domain/`, `catalog/` ou `orientation-engine/`;
- `docs/08-delivery/cycle-02-backlog.md` permanece inalterado;
- **C3-03 só entra no gate caso seja efetivamente iniciada** neste ciclo —
  se não for iniciada, sua ausência não bloqueia a conclusão do Ciclo 3; se
  for iniciada, seu teste Playwright dedicado (ver "Testes planejados")
  passa a ser exigido no gate.
