# Status do Projeto Hydra

**Data de referência:** 29/07/2026

**Versão da baseline:** 0.1

## Estado geral

Descoberta, iniciação, planejamento e direção visual do Release 0 estão
concluídos. O protótipo de experiência foi aprovado como referência
oficial.

O Release 0 está funcional e validado de ponta a ponta: os Ciclos 2, 3 e
4 foram encerrados, e a vertical excepcional Cockpit/Impedimentos (D022,
`docs/07-management/decision-log.md`) foi concluída. O workflow Hydra v2
está publicado (`docs/08-delivery/workflow-v2-design.md`).

Testes com usuários externos continuam dependendo de autorização
explícita de Matheus (D021, `docs/07-management/decision-log.md`).

## Resumo de ciclos e entregas

- **Ciclo 2 — Walking Skeleton** (`docs/08-delivery/cycle-02-backlog.md`):
  concluído. Todos os itens Must (C2-01 a C2-12) entregues — domínio,
  catálogo, motor de orientação, persistência SQLite, casos de uso, rotas
  mínimas e teste de jornada Playwright ponta a ponta.
- **Ciclo 3 — Mapa e Registros** (`docs/08-delivery/cycle-03-backlog.md`):
  concluído, gate aprovado em 25/07/2026. C3-01 (Tela Mapa) e C3-02 (Tela
  Registros) entregues; C3-03 (Pular etapa, Could) não iniciada, adiada
  sem bloquear o encerramento.
- **Ciclo 4 — baseline funcional do Release 0**
  (`docs/08-delivery/cycle-04-backlog.md`): concluído, gate aprovado em
  25/07/2026. C4-01 (especificação reconciliada), C4-02 (interface de
  "Pular etapa"), C4-03 (checkpoint de dogfooding) e C4-03A (correção de
  listagem/reabertura de projetos, bloqueador encontrado em C4-03) e C4-04
  (validação da baseline completa) entregues.
- **D022 — vertical Cockpit/Impedimentos**
  (`docs/07-management/decision-log.md`): concluída. Entidade
  `Impediment`, persistência, tela `/cockpit`, integração neutra ao
  `/now`, testes unitários e jornada Playwright validados.

## Gate atual

Gate do Release 0 atendido: baseline funcional validada de ponta a ponta
(Ciclos 2, 3 e 4 encerrados, D022 concluída). Nenhum ciclo novo está
aberto. O gate do Release 1 ainda não existe — depende da decisão
pendente abaixo.

Detalhamento de cada gate de ciclo está nos respectivos backlogs
(`docs/08-delivery/cycle-02-backlog.md`, `cycle-03-backlog.md`,
`cycle-04-backlog.md`, seção "Gate de conclusão").

## Decisões de maior impacto

- foco inicial em projetos de software, público de profissionais de
  tecnologia, aplicação individual no MVP;
- orientação incorporada à arquitetura da interface, sem bloqueio rígido;
- execução primeiro, aprendizado no momento necessário;
- núcleo baseado em regras; IA fora do MVP;
- repositório privado até a organização do Release 0; GitHub como fonte
  oficial de código, documentação e backlog; Claude Code como ambiente de
  implementação;
- ciclos de duas semanas; SvelteKit adotado.

Histórico completo em `docs/07-management/decision-log.md`.

## Próxima decisão relevante

Ciclo 4 concluído e baseline funcional do Release 0 validada de ponta a
ponta, incluindo a interface de "Pular etapa" e a listagem/reabertura de
projetos. Próxima decisão (não iniciada automaticamente): revisar riscos
e roadmap, e decidir a continuidade para o Release 1. Somente após essa
aprovação um novo ciclo é aberto, com meta, gate e backlog próprios.

## Fontes de detalhamento

- `docs/core/`: visão de produto, escopo do Release 0, UX e stack;
- backlogs de ciclo: `docs/08-delivery/cycle-02-backlog.md`,
  `cycle-03-backlog.md`, `cycle-04-backlog.md`;
- `docs/07-management/decision-log.md`: histórico de decisões;
- `docs/07-management/risk-register.md`: riscos registrados;
- `docs/08-delivery/workflow-v2-design.md`: desenho do workflow de
  entrega;
- `CHANGELOG.md`: comportamento observável entregue.
