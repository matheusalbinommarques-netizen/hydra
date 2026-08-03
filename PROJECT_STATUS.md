# Status do Projeto Hydra

**Data de referência:** 03/08/2026

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
  andamento. Subetapa 7.0 (estruturar a convergência) concluída — o
  roadmap passou a ser também o backlog operacional desta etapa, com
  inventário de 18 telas-alvo, 16 imagens individuais aprovadas em
  `design/approved/screens/`, situação por tela e sequência 7.0–7.7 com
  gates. Subetapa 7.1 (fundação visual e shell) concluída — tokens de
  espaçamento, tipografia, raio e elevação definidos em `app.css` e
  aplicados ao shell compartilhado do workspace (cabeçalho/navegação) e ao
  cabeçalho da Home; `UX_DESIGN_SPEC.md` reconciliado com a paleta papel/
  tinta/grafite (removida a direção anterior navy/ciano/tema escuro).
  Padrão de campo de formulário e de card ficam para as telas que os
  usarem, em 7.2+. Subetapa 7.2 — Entrada e organização global —
  concluída. Home (`/`) está `convergida` — aprovada visualmente por
  Matheus (desktop e mobile) contra o artefato individual do Claude
  Design ("Home Seus Projetos"); a seção antes "Todos os projetos" agora
  lista só os cinco mais recentes, com link "Ver todos os projetos" para
  a Biblioteca. Biblioteca de projetos (`/projects`) está `convergida` —
  busca, filtro por estado com contagem, lista completa reaproveitando
  `listRecentProjects()`, com navegação global explícita entre as três
  superfícies: símbolo/wordmark Hydra → Home, item "Projetos" → Biblioteca,
  `← Projetos` do workspace → Biblioteca. Nova iniciativa (`/projects/new`)
  está `convergida` — virou superfície própria: wizard de 4 passos (ponto
  de partida, rota recomendada, nome provisório, revisão) reaproveitando o
  diagnóstico assistido e `routeStartPhaseId` já existentes (D023/D024);
  criação passa a ser atômica via `createConfiguredProject` (nome e fase
  inicial aplicados ao estado em memória antes de um único insert); Home e
  Biblioteca passam a abrir `/projects/new` em vez de criar o projeto
  imediatamente; tipos de iniciativa do mockup ficam fora do Release 0;
  aprovada visualmente por Matheus (desktop e ~390px). Modelos de jornada
  segue `adiada` (horizonte posterior de Tailoring metodológico) — com as
  quatro telas do bloco 7.2 decididas, a subetapa está concluída. Subetapa
  7.3 — Jornada guiada (ordem: Agora; Atividade guiada; Jornada; Documento;
  Revisão e confirmação) — em andamento. Agora (`/now`) está `convergida`:
  painel "Progresso da fase" (fração de atividades resolvidas — concluídas
  + puladas — e agrupamento Concluídas/Atual/Pendentes/Puladas) na coluna
  lateral em toda fase, reaproveitando a mesma classificação de status/
  atividade atual do Mapa (`buildPhaseActivities`, compartilhado entre as
  duas telas, sem duplicação); Bancada preservada, só nas fases já
  suportadas; mecânica da próxima ação inalterada; navegação mobile do
  shell (menu com os oito destinos do workspace) resolvida junto, por
  afetar todas as rotas do projeto, não só Agora; aprovada funcional e
  visualmente por Matheus. Atividade guiada está `combinada com Agora` — a
  atividade atual continua apresentada e respondida dentro de
  `/projects/[projectId]/now` (pergunta, explicação, exemplo, campos,
  salvamento e opção de pular), sem rota própria de execução; a
  combinação preserva integralmente a mecânica funcional já existente.
  Jornada está `convergida` — a rota `/projects/[projectId]/map` (o
  destino "Mapa" no shell continua com esse nome) passa a apresentar a
  Jornada do artefato aprovado no Claude Design como conteúdo principal:
  fases numeradas pela posição real do catálogo, fase e atividade atuais
  com destaque visual, atividades restritas aos quatro estados reais
  (Concluída/Atual/Pendente/Pulada) com legenda coerente, um único CTA
  "Continuar em Agora", e Diagnóstico da rota/seleção de ponto de partida
  preservados sem alteração de mecânica dentro do bloco recolhível
  "Diagnóstico e ponto de partida" (inicia fechado); execução das
  atividades continua em Agora; nenhuma mecânica, estado ou regra de
  domínio foi alterada; aprovada em desktop e mobile. Próximo alvo da
  subetapa: Documento do projeto. Quatro fatias preparatórias seguem
  publicadas (estado ativo de navegação; bloco "Onde estamos" em Agora;
  continuidade Mapa → Agora; orientação por projeto na Home), mas nenhuma
  tela além de Agora e Jornada é declarada `convergida` apenas por elas —
  a ordem operacional continua conduzida pelo roadmap.

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
"Convergência da experiência e das telas", está em andamento, agora com
backlog operacional próprio no roadmap (inventário de telas, situação,
sequência 7.0–7.7 e gates). As subetapas 7.0, 7.1 e 7.2 estão concluídas;
a subetapa 7.3 — Jornada guiada (ordem: Agora; Atividade guiada; Jornada;
Documento; Revisão e confirmação) está em andamento, com Agora e Jornada
já `convergidas` e Atividade guiada `combinada com Agora` (sem rota
própria de execução); o próximo alvo da subetapa é Documento do projeto,
sem reabrir desnecessariamente o domínio nem substituir mecânicas
funcionais.

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
