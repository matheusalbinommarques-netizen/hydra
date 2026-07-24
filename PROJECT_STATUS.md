# Status do Projeto Hydra

**Data de referência:** 24/07/2026

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

O Ciclo 3 foi iniciado (`docs/08-delivery/cycle-03-backlog.md`). C3-01 —
Tela Mapa mínima está concluída (commit `b98c840`), disponível em
`/projects/[projectId]/map`: mostra as seis fases do catálogo em ordem,
status de fase e de atividade, e a atividade recomendada pela Trilha A.
C3-02 (Registros) e C3-03 (Pular etapa) ainda não foram iniciadas.

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
  dedicados.

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

**Progresso do Ciclo 3** (`docs/08-delivery/cycle-03-backlog.md`):

- C3-01 — Tela Mapa mínima (Must): concluída (commit `b98c840`);
- C3-02 — Tela Registros mínima (Must): não iniciada;
- C3-03 — "Pular etapa" na interface (Could): não iniciada.

Gate do Ciclo 3 ainda não avaliado — depende de C3-02 (Must).

## Próxima decisão relevante

Prosseguir com C3-02 — Tela Registros mínima, item Must restante do
Ciclo 3. C3-03 (Could) permanece em aberto, sujeita à capacidade do ciclo.
