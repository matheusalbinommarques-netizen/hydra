# Status do Projeto Hydra

**Data de referência:** 29/07/2026

**Versão da baseline:** 0.4.0

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
  concluído — itens Must C2-01 a C2-12.
- **Ciclo 3 — Mapa e Registros** (`docs/08-delivery/cycle-03-backlog.md`):
  concluído, gate aprovado em 25/07/2026 (C3-03, Could, adiada sem
  bloquear o encerramento).
- **Ciclo 4 — baseline funcional do Release 0**
  (`docs/08-delivery/cycle-04-backlog.md`): concluído, gate aprovado em
  25/07/2026 — C4-01 a C4-04, incluindo C4-03A.
- **D022 — vertical Cockpit/Impedimentos**
  (`docs/07-management/decision-log.md`): concluída.

Detalhamento de cada entrega (aceite, notas técnicas, evidências) fica no
respectivo backlog de ciclo ou no decision-log.

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

## Não fazer agora

- Não implementar IA.
- Não implementar autenticação.
- Não implementar múltiplos usuários, organizações ou permissões.
- Não criar integrações externas.
- Não criar microsserviços.
- Não ampliar o Release 0 de forma indiscriminada.

## Pendências de documentação

- `docs/core/RELEASE_0_SPEC.md` §9 desatualizado frente a
  ScopeItem/ScopeVersion/Impediment — requer reconciliação de `docs/core/`
  inteiro, não fix pontual; pendente.

## Fontes de detalhamento

- `docs/core/`: visão de produto, escopo do Release 0, UX e stack;
- backlogs de ciclo: `docs/08-delivery/cycle-02-backlog.md`,
  `cycle-03-backlog.md`, `cycle-04-backlog.md`;
- `docs/07-management/decision-log.md`: histórico de decisões;
- `docs/07-management/risk-register.md`: riscos registrados;
- `docs/08-delivery/workflow-v2-design.md`: desenho do workflow de
  entrega;
- `CHANGELOG.md`: comportamento observável entregue.
