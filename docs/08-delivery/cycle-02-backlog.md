# Backlog do Ciclo 2 — Walking Skeleton

**Meta:** provar a cadeia completa definida em `TECHNICAL_BRIEF.md` §14 (criar
projeto → responder atividades → visualizar resumo → receber próxima ação →
salvar → exportar → importar) usando a arquitetura já registrada em
`ADR-001`, `architecture-brief.md` e `contracts.md`.

**Capacidade de referência:** ~20 horas (mesma referência do Ciclo 1) — não é
uma promessa de conclusão. O Walking Skeleton pode não caber inteiramente
neste ciclo; se isso acontecer, os itens Must que faltarem migram para um
Ciclo 3 sem redução do critério de aceite. A meta é entregar o Walking
Skeleton completo, não fechar uma data fixa.

## Dependências novas desta rodada (`TECHNICAL_BRIEF.md` §10)

**Versão do Node fixada:** Node.js 22 LTS (ou a LTS ativa mais recente
disponível no momento da implementação) — necessário para compatibilidade
previsível do binário nativo do `better-sqlite3` entre o ambiente de
desenvolvimento e a futura VPS de destino.

| Dependência | Problema resolvido | Alternativa sem dependência | Maturidade | Manutenção | Licença | Impacto no bundle | Impacto de aprendizado | Custo | Risco de lock-in |
|---|---|---|---|---|---|---|---|---|---|
| `better-sqlite3` | Acesso síncrono ao SQLite embutido | `node:sqlite` nativo — nesta versão do Node está em estágio de release candidate, ainda não estável | Alta — muito usada em produção | Ativa | MIT | Nenhum (só servidor) | Baixo — API direta, sem ORM | Gratuito | Baixo — API simples, isolada atrás de `ProjectRepository` |
| `vitest` | Testes unitários e de integração | Jest (mais pesado, menos integrado ao Vite) | Alta | Ativa (time do Vite) | MIT | Só dev | Baixo — API parecida com Jest | Gratuito | Baixo |
| `@playwright/test` | Teste de jornada ponta a ponta | Cypress | Alta | Ativa (Microsoft) | Apache-2.0 | Só dev | Médio — novo para quem nunca usou | Gratuito | Baixo |

`SvelteKit`/`TypeScript`/`Node.js` já justificados em `ADR-001` — não repetidos aqui.

## Must

### C2-01 — Criar o projeto da aplicação

**Tipo:** tarefa · **Esforço:** pequeno
**Aceite:** `app/` criado via scaffolding oficial do SvelteKit, escolhendo
TypeScript, Vitest e Playwright nas perguntas do próprio assistente de
criação; aplicação em branco sobe localmente com o adapter padrão do
scaffold.

### C2-02 — Configurar `adapter-node` e instalar `better-sqlite3`

**Tipo:** tarefa · **Esforço:** pequeno
**Aceite:** troca para `@sveltejs/adapter-node`; `better-sqlite3` (+ tipos)
instalado; um build de produção gera um servidor Node standalone, e
`better-sqlite3` consegue abrir/fechar um arquivo de banco de teste. Não
reinstala Vitest/Playwright — isso já veio do scaffold em C2-01.

### C2-03 — Registrar as dependências novas e a versão do Node

**Tipo:** tarefa · **Esforço:** pequeno
**Aceite:** tabela de justificativa deste documento refletida em
`architecture-brief.md` §9 (marcando ORM/driver como resolvido), e a versão
LTS do Node fixada registrada onde o projeto guardar essa informação (ex.:
`.node-version` ou `engines` do `package.json`).

### C2-04 — Tipos de `domain/`

**Tipo:** tarefa · **Esforço:** pequeno
**Aceite:** tipos de `contracts.md` §1–§3 (catálogo, estado, `Result`)
transcritos para `app/src/lib/domain/`, projeto compila sem erro de tipo.

### C2-05 — Catálogo completo em `catalog/`

**Tipo:** história · **Esforço:** médio
**Aceite:** as 8 `ActivityDefinition` (7 da Descoberta + "Definir usuário
principal") transcritas de `DOMAIN_MODEL.md` §7 para `app/src/lib/catalog/`,
exportando a constante `catalog: Catalog`.

### C2-06 — Fábrica e transições puras de `domain/`

**Tipo:** história · **Esforço:** grande
**Aceite:** `createInitialProjectState`, `isActivityFieldsValid`,
`shouldInvalidateSummary`, `answerActivity`, `confirmSummary`,
`skipActivity`, `renameProject` implementadas (`contracts.md` §4–§5). Testes
unitários (Vitest) cobrindo pelo menos:

- `createInitialProjectState(catalog, ...)` produz exatamente uma
  `ActivityProgress` em `não_iniciada` para cada `ActivityDefinition` do
  catálogo completo (8 atividades) — nem faltando, nem duplicada;
- as transições de `STATE_MACHINE.md` (`não_iniciada`→`em_andamento`→
  `concluída`, `pulada`→`concluída`, `concluída`→`em_andamento` mas nunca
  `concluída`→`pulada`);
- `transition_not_allowed` nos casos indevidos (skip fora de
  `não_iniciada`/`em_andamento`, confirmar Resumo já concluída);
- no máximo uma pendência por atividade mesmo já resolvida;
- invalidação do Resumo somente quando um valor realmente muda.

### C2-07 — Serialização JSON

**Tipo:** tarefa · **Esforço:** médio
**Aceite:** `serializeProjectState`/`deserializeProjectState`
(`contracts.md` §6) implementadas com o envelope versionado e a validação
completa de invariantes na importação. Testes unitários cobrindo cada
`ProjectStateParseError` (JSON inválido, versão não suportada, forma
inválida, referência inexistente, violação de invariante).

### C2-08 — `orientation-engine/`

**Tipo:** história · **Esforço:** médio
**Aceite:** `computePhaseStatus`, `computeProjectStatus`,
`computeNextActivity`, `computeOpenPendingItems`, `computeHypotheses`,
`computeSnapshot` implementadas (`contracts.md` §8). Testes unitários
cobrindo os 4 status de fase, a Trilha A nunca retornando `pulada`/
`concluída`, `catalog_limit_reached` ao esgotar o catálogo completo, e a
Trilha B expondo pendências vinculadas a atividades puladas.

### C2-09 — `server/persistence/` com `better-sqlite3`

**Tipo:** história · **Esforço:** médio
**Aceite:** `ProjectRepository` (`insert`/`findById`/`save`) implementado
contra um schema SQL inicial, versionado como um único arquivo (ex.:
`schema/0001_init.sql`) espelhando `Project`, `ActivityProgress`, `Answer`,
`PendingItem` — aplicado de forma simples e idempotente na inicialização
(`CREATE TABLE IF NOT EXISTS`), **sem** adotar ainda um framework de
migrations (permanece decisão em aberto, `architecture-brief.md` §9— este
schema é só a versão 1, não a estratégia de evolução). Testes de integração
rodando contra um arquivo SQLite descartável de teste.

### C2-10 — `server/application/` (casos de uso)

**Tipo:** história · **Esforço:** grande
**Aceite:** os 8 casos de uso de `contracts.md` §10 implementados e testados
de ponta a ponta contra a persistência real (`createProject`,
`loadProjectView`, `renameProject`, `answerActivity`, `skipActivity`,
`confirmSummary`, `exportProject`, `importProject`), incluindo a validação
de entrada própria (sem biblioteca) e a colisão de ID na importação via
`findById`.

### C2-11 — `routes/` mínimas

**Tipo:** história · **Esforço:** grande
**Aceite:** Home (criar projeto), Agora (próxima ação + responder atividade
via formulário genérico dirigido pelo catálogo — um único componente serve
qualquer `ActivityDefinition`), Resumo (confirmar), e uma ação de
exportar/importar (download/upload do JSON). `routes/` só consome
`ProjectView` e `catalog/` — nunca `ProjectState` bruto.

### C2-12 — Teste de jornada ponta a ponta

**Tipo:** tarefa · **Esforço:** médio
**Aceite:** teste Playwright percorrendo as **oito atividades reais** do
catálogo completo (não uma fatia de 2) — criar projeto, responder cada uma
das 7 atividades da Descoberta, confirmar o Resumo, responder "Definir
usuário principal", e verificar que a próxima recomendação passa a
`catalog_limit_reached`. Cobre exportar e importar o projeto ao final.

## Should

### C2-13 — Tela Mapa mínima

**Tipo:** tarefa · **Esforço:** pequeno
**Aceite:** lista as 8 atividades com status, aproveitando que o catálogo
completo já foi escolhido para este ciclo.

### C2-14 — Tela Registros mínima

**Tipo:** tarefa · **Esforço:** pequeno
**Aceite:** lista respostas e pendências (abertas e resolvidas).

## Could

### C2-15 — "Pular etapa" na interface

**Tipo:** tarefa · **Esforço:** médio
**Aceite:** modal de confirmação + chamada a `skipActivity`, exibindo a
pendência criada. Não faz parte da cadeia mínima de `TECHNICAL_BRIEF.md`
§14, mas a lógica de domínio já está coberta por C2-06.

## Gate de conclusão do Ciclo 2

Antes de considerar o Walking Skeleton entregue:

- `tsc --noEmit` limpo (sem erro de tipo);
- toda a suíte Vitest (unitária + integração) passando;
- teste de jornada Playwright (C2-12) passando;
- build de produção (`adapter-node`) completando sem erro;
- **persistência sobrevive a reinício:** salvar um projeto, reiniciar o
  processo do servidor, e confirmar que os dados carregam corretamente do
  arquivo SQLite — não só que os testes passam durante uma única execução.

## Won't neste ciclo

- autenticação;
- múltiplos usuários, organizações ou permissões;
- IA;
- integrações externas;
- infraestrutura de deploy na VPS (provisionamento, backups, TLS — ainda em
  aberto em `architecture-brief.md` §9);
- framework de migrations (só o schema versão 1, sem estratégia de evolução);
- troca de driver/ORM ou biblioteca de validação (decisões já fechadas nesta
  sessão).
