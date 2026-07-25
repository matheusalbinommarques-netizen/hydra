# Status do Projeto Hydra

**Data de referência:** 25/07/2026

**Versão da baseline:** 0.1

## Estado geral

A descoberta, iniciação, planejamento e definição visual do Release 0
foram concluídos.

O protótipo de experiência foi aprovado como referência oficial.

O Ciclo 2 (Walking Skeleton) foi concluído: todos os itens Must
(C2-01 a C2-12, ver `docs/08-delivery/cycle-02-backlog.md`) foram entregues.
O Hydra agora roda de ponta a ponta no navegador — criar projeto, responder
as oito atividades do catálogo (Descoberta + Definir usuário principal),
revisar e confirmar o Resumo, receber a recomendação de próxima atividade,
persistir em SQLite, e exportar/importar o projeto em JSON versionado —,
coberto por um teste de jornada Playwright automatizado.

O Ciclo 3 foi concluído (`docs/08-delivery/cycle-03-backlog.md`), com gate
formalmente aprovado em 25/07/2026. Os dois itens Must foram entregues:
C3-01 — Tela Mapa mínima (commit `b98c840`), disponível em
`/projects/[projectId]/map`, mostrando as seis fases do catálogo em ordem,
status de fase e de atividade, e a atividade recomendada pela Trilha A; e
C3-02 — Tela Registros mínima (commit `784dd34`), disponível em
`/projects/[projectId]/records`, mostrando respostas agrupadas por fase e
atividade e o histórico de pendências (abertas e resolvidas), somente
leitura. C3-03 (Pular etapa, Could) não foi iniciada e foi adiada para
eventual reavaliação em ciclo futuro — sua ausência não bloqueou o
encerramento do ciclo, conforme previsto no gate.

## Entregas consolidadas

- Opportunity & Project Brief;
- Business Case preliminar;
- Termo de Abertura;
- visão do produto;
- escopo do MVP;
- Product Story Map;
- roadmap de releases;
- plano de gestão da entrega;
- plano de requisitos;
- plano de qualidade;
- Definition of Done;
- especificação preliminar do Release 0;
- registro inicial de riscos;
- registro de decisões;
- backlog do Ciclo 1;
- backlog do Ciclo 2 (Walking Skeleton), com todos os itens Must entregues:
  domínio (`domain/`), catálogo completo (`catalog/`), motor de orientação
  (`orientation-engine/`), persistência SQLite (`server/persistence/`),
  casos de uso (`server/application/`), rotas mínimas (Home, Agora, Resumo,
  Exportar/Importar) e teste de jornada ponta a ponta (Playwright);
- Tela Mapa mínima do Ciclo 3 (C3-01), com testes Vitest e Playwright
  dedicados;
- Tela Registros mínima do Ciclo 3 (C3-02), com histórico de pendências
  (`pendingItemHistory`) e testes Vitest e Playwright dedicados;
- Interface de "Pular etapa" do Ciclo 4 (C4-02), com modal de confirmação
  acessível (`<dialog>` nativo), retomada segura da atividade pulada a
  partir da pendência aberta e teste Playwright dedicado.

## Decisões de maior impacto

- foco inicial em projetos de software;
- público inicial formado por profissionais de tecnologia;
- aplicação individual no MVP;
- orientação incorporada à arquitetura da interface;
- execução primeiro, aprendizado no momento necessário;
- orientação sem bloqueio rígido;
- núcleo baseado em regras;
- IA fora do MVP;
- repositório privado até a organização do Release 0;
- GitHub como fonte oficial de código, documentação e backlog;
- Claude Code como ambiente de implementação;
- ciclos de duas semanas;
- SvelteKit com vantagem preliminar, sujeito a comparação formal.

## Gate atual

**Gate anterior (Release 0 — protótipo):** aprovado.

**Gate do Ciclo 2 — Walking Skeleton:** atendido. Critérios de
`docs/08-delivery/cycle-02-backlog.md` ("Gate de conclusão do Ciclo 2"):

1. `tsc --noEmit` limpo — atendido (0 erros, 0 avisos);
2. suíte Vitest (unitária + integração) passando — atendido (137/137);
3. teste de jornada Playwright (C2-12) passando — atendido;
4. build de produção (`adapter-node`) sem erro — atendido;
5. persistência sobrevive a reinício do processo — atendido (validado
   manualmente: salvar um projeto, reiniciar o servidor, confirmar que os
   dados carregam do arquivo SQLite).

**Gate do Ciclo 3 — Mapa e Registros:** aprovado em 25/07/2026, 6/6
verificações (`hydra-verify full`, escopo global do projeto). Detalhamento
completo em `docs/08-delivery/cycle-03-backlog.md` ("Resultado do Gate de
conclusão do Ciclo 3").

**Progresso do Ciclo 3** (`docs/08-delivery/cycle-03-backlog.md`):

- C3-01 — Tela Mapa mínima (Must): concluída (commit `b98c840`);
- C3-02 — Tela Registros mínima (Must): concluída (commit `784dd34`);
- C3-03 — "Pular etapa" na interface (Could): não iniciada — era opcional e
  sua ausência não bloqueou o encerramento do ciclo, conforme previsto no
  gate.

## Ciclo 4

O Ciclo 4 foi formalmente aberto (`docs/08-delivery/cycle-04-backlog.md`).
Meta: concluir a baseline funcional do Release 0, implementando a
experiência de "Pular etapa", reconciliando a especificação com o produto
funcional atual e validando internamente a jornada completa com um
projeto real de Matheus.

Itens Must:

- C4-01 — Reconciliar a especificação do Release 0
  (`docs/core/RELEASE_0_SPEC.md`): concluída (commit `a399191`);
- C4-02 — Implementar a interface mínima de "Pular etapa": concluída
  (commit `39fdc06`), com modal de confirmação acessível, retomada segura
  da atividade pulada e teste Playwright dedicado (`hydra-verify full`
  PASS, QA manual aprovada);
- C4-03 — Executar checkpoint de dogfooding do Release 0: concluída
  (checkpoint de uso real, sem commit de código) — Matheus percorreu a
  jornada completa com um projeto real ("Level Me Up — Refatoração e
  evolução da baseline"), incluindo Descoberta, Resumo, Mapa, Registros,
  "Pular etapa" (pendência + retomada + resolução), exportação e a
  proteção esperada contra colisão de ID na reimportação. O checkpoint
  encontrou um defeito bloqueador (ausência de listagem/reabertura de
  projetos existentes, `docs/core/RELEASE_0_SPEC.md` §4.1), tratado como
  item corretivo C4-03A;
- C4-03A — Permitir localizar e reabrir projetos existentes (corretivo,
  bloqueador de C4-04): não iniciada — inclusão no ciclo autorizada,
  planejamento e implementação ainda pendentes;
- C4-04 — Validar a baseline completa do Release 0: não iniciada.

Testes com usuários externos ficam fora deste ciclo, por decisão
registrada (`docs/07-management/decision-log.md`, D021): o momento é
definido exclusivamente pelo Matheus. O Workflow v2 está registrado como
desenho técnico (`docs/08-delivery/workflow-v2-design.md`), sem
implementação e fora do escopo deste ciclo.

## Próxima decisão relevante

C4-01, C4-02 e C4-03 concluídas. Próxima ação: planejar C4-03A (Permitir
localizar e reabrir projetos existentes — item corretivo, bloqueador de
C4-04). Gate do Ciclo 4 ainda não avaliado — o Release 0 não está
concluído enquanto C4-03A e C4-04 permanecerem pendentes.
