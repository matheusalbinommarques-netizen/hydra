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
  Exportar/Importar) e teste de jornada ponta a ponta (Playwright).

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

## Próxima decisão relevante

Com o Walking Skeleton entregue, os itens Should do Ciclo 2 seguem
pendentes de priorização:

- C2-13 — Tela Mapa mínima;
- C2-14 — Tela Registros mínima;
- C2-15 (Could) — "Pular etapa" na interface.

Decisão em aberto: priorizar esses itens Should/Could dentro do próprio
Ciclo 2, ou encerrar o ciclo e planejar o Ciclo 3.
