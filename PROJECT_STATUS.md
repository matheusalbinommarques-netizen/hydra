# Status do Projeto Hydra

**Data de referência:** 31/07/2026

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
- **Documento do Projeto e extensão da Bancada até Estruturação**
  (roadmap `docs/03-product/product-roadmap.md`, etapa 1): concluída —
  commits `5de3445`, `345239c`.
- **Revisão e confirmação** (roadmap, etapa 2): concluída — `/summary`
  reúne checklist de completude, pendências abertas de Descoberta,
  `criteriaScopeConflict` e confirmação explícita persistida por
  `ActivityProgress`; validada (`full` PASS).
- **Diagnóstico e rota recomendada** (roadmap, etapa 3): concluída — ponto
  de partida explícito da rota em `/map` (D023,
  `docs/07-management/decision-log.md`) e diagnóstico de rota assistido
  por cinco respostas estruturadas, recomendando deterministicamente a
  primeira estrutura ainda ausente (D024,
  `docs/07-management/decision-log.md`); ausência de escolha preserva o
  comportamento anterior; percurso completo continua disponível; validada
  (`full` PASS).
- **Entregas e backlog estruturados** (roadmap, etapa 4): concluída —
  itens de escopo em "Agora" formam o primeiro backlog executável, com
  status de execução em três estados (`ScopeItem.executionStatus`),
  editável em `/next-version/confirmed` sem afetar a confirmação do
  escopo (D025, `docs/07-management/decision-log.md`); validada (`full`
  PASS).
- **Execução e acompanhamento** (roadmap, etapa 5): concluída — superfície
  "Entregas" (`/deliveries`), acessível pela navegação do workspace,
  agrupando os itens confirmados em "Agora" pelos três estados de
  execução já existentes, com contagem por grupo, reaproveitando
  integralmente `ScopeItem.executionStatus` e `setScopeItemExecutionStatus`
  (D025); `/next-version/confirmed` mantida sem alteração; validada
  (`full` PASS).
- **Resultados, adaptação e encerramento** (roadmap, etapa 6): concluída
  por reconciliação com a capacidade funcional já existente no código —
  seis atividades de validação e encerramento (validar entregas e
  critérios de aceitação, coletar feedback, resolver pendências finais,
  registrar lições aprendidas, definir transição e próximos passos,
  confirmar encerramento do projeto) acessíveis pela jornada normal, com
  respostas persistidas; confirmação final obrigatória, não pulável;
  estado final do projeto computado como `concluído`; evidências
  consultáveis em `/records`; status das seis atividades consultável em
  `/map`; mensagem final de conclusão em `/now`; nenhuma mudança de
  código foi necessária.
- **Convergência da experiência e das telas** (roadmap, etapa 7): em
  andamento — quatro fatias entregues: (1) estado ativo visual e semântico
  (`aria-current="page"`) unificado nos oito links de navegação do
  workspace (Agora, Cockpit, Mapa, Registros, Entregas, Resumo,
  Documento, Exportar), `app/src/routes/projects/[projectId]/+layout.svelte`;
  (2) bloco "Onde estamos" em Agora (`/now`), acima do card de próxima
  ação, mostrando fase atual e posição na jornada ("Fase X de Y") ou
  jornada concluída ("Y de Y fases percorridas"),
  `app/src/routes/projects/[projectId]/now/`; (3) continuidade do Mapa
  para a próxima ação — na atividade recomendada (`activity.isCurrent`)
  em `/map`, link "Continuar em Agora" para `/now`,
  `app/src/routes/projects/[projectId]/map/+page.svelte`; (4) orientação
  de retomada por projeto na Home (`/`) — cada projeto listado mostra sua
  próxima ação real (respeitando `routeStartPhaseId` quando definido) e um
  CTA para `/now` ("Começar projeto"/"Continuar projeto"/"Ver projeto"),
  sem linguagem de recência, `app/src/routes/+page.svelte`,
  `app/src/lib/server/application/project-use-cases.ts`; etapa segue em
  andamento, sem resultado completo ainda.

Histórico e conteúdo das entregas ficam no CHANGELOG e no Git; decisões
relevantes permanecem no decision-log e, quando houver ciclo formal, o
detalhamento de aceite fica no respectivo backlog.

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

As etapas 1 a 6 do roadmap (`docs/03-product/product-roadmap.md`) —
espinha mecânica do produto — estão concluídas. A etapa 7,
"Convergência da experiência e das telas", está em andamento: três
fatias (estado ativo de navegação; bloco "Onde estamos" em Agora;
continuidade do Mapa para a próxima ação) foram entregues; integrar as
demais superfícies mecânicas e aproximar
progressivamente as telas das referências aprovadas em
`design/approved/` segue pendente, sem reabrir desnecessariamente o
domínio nem substituir mecânicas funcionais. A próxima fatia dessa etapa
ainda não está definida.

"Tailoring metodológico e modelos" deixa de ser tratado como próxima
etapa imediata e passa a constar no roadmap como horizonte posterior,
dependente de sinais de contexto, aplicabilidade e profundidade ainda não
especificados.

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
