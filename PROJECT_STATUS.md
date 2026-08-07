# Status do Projeto Hydra

**Data de referência:** 04/08/2026

**Versão da baseline:** 0.4.0

## Estado geral

Descoberta, iniciação, planejamento e direção visual do Release 0 estão
concluídos. O protótipo de experiência foi aprovado como referência
oficial.

O Release 0 está funcional e validado de ponta a ponta: os Ciclos 2, 3 e
4 foram encerrados, e a vertical excepcional Cockpit/Impedimentos (D022,
`docs/07-management/decision-log.md`) foi concluída. O workflow Hydra v2
está publicado (`docs/08-delivery/workflow-v2-design.md`).

O Ciclo 5 está aberto. O item C5-01 ("Construir → Operar sobre partes do
trabalho") está concluído e publicado (commit `a070ed7`) — ver
`docs/08-delivery/cycle-05-backlog.md`. O gate do próprio Ciclo 5 ainda
não foi avaliado: depende de dogfooding real da hipótese "Construir →
Operar", não da entrega técnica de C5-01.

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
- **Convergência da experiência e das telas** (roadmap, etapa 7):
  concluída. Subetapa 7.0 (estruturar a convergência) concluída — o
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
  domínio foi alterada; aprovada em desktop e mobile. Documento do projeto
  (`/projects/[projectId]/document`) está `convergida` — passa a
  funcionar como artefato documental contínuo e crescente: fases
  apresentadas como seções, atividades como subseções, respostas em fluxo
  documental (parágrafos completos, sem truncamento) e tags reais
  preservadas como metadados secundários; ações "Editar" discretas, com
  os destinos já existentes preservados; um único CTA "Continuar em
  Agora"; estado vazio convergido; aprovada em desktop e mobile; nenhuma
  edição inline, nova rota, consulta, entidade ou regra de domínio criada
  — reaproveita integralmente `document-view.ts` já existente; a
  Bancada continua sendo o único ponto de preenchimento e execução, em
  `/now`. Fundação visual ganhou o token `--hydra-editorial-accent`
  (vermelho queimado decorativo/editorial), separado de `--hydra-warning`
  (que permanece exclusivo a conteúdo gerado/derivado pelo sistema), sem
  nenhuma mudança visual perceptível. Revisão e confirmação está
  `convergida` — `/projects/[projectId]/summary` permanece exclusiva da
  Descoberta no Release 0 (sem generalização por fase, sem novo
  `completionMode`), agora como checkpoint formal em uma única superfície,
  com contexto explícito "Fase 1 — Descoberta"; decisões reais (Problema,
  Público afetado, Estado atual, Resultado desejado) reunidas no "Resumo
  da fase", com alinhamento consistente entre marcador, título, resposta,
  tags e link de edição (grade explícita marcador/conteúdo/ação);
  respostas completas continuam preservadas em área recolhível; "Pontos de atenção" usa
  somente `criteriaScopeConflict` e `discoveryOpenPendingItems`, com
  estado vazio explícito quando nenhum sinal existe; "Conferência" usa
  somente o checklist real já existente; links individuais de edição
  preservados; "Voltar para edição" leva a `/now`; ação principal
  "Confirmar e avançar" preserva a action já existente; destino do shell
  continua chamado "Resumo"; nenhuma mudança de domínio, catálogo,
  transições ou persistência; aprovada em desktop e mobile. Com os cinco
  alvos da ordem 1–5 decididos (Agora, Atividade guiada, Jornada,
  Documento do projeto e Revisão e confirmação), a **subetapa 7.3 está
  concluída**. Quatro fatias preparatórias seguem publicadas (estado ativo
  de navegação; bloco "Onde estamos" em Agora; continuidade Mapa → Agora;
  orientação por projeto na Home), reclassificadas como parte do que
  sustentou a convergência das telas da subetapa. Subetapa 7.4 — Execução
  e controle. Entregas (`/deliveries`) está `convergida`: a
  referência `11-entregas.png` tinha conteúdo funcional incompatível com o
  domínio (sprints, tempo de ciclo, erros de produção) e foi tratada como
  não vinculante, usada só como linguagem visual; a convergência seguiu
  proposta própria aprovada no Claude Design (desktop e mobile), mantendo
  a estrutura de três grupos por estado de execução, card como elemento
  visual principal e coluna como superfície agrupadora discreta, com
  bordas suavizadas; nenhuma mudança de domínio, projeção
  (`deliveries-view.ts`) ou action. Acompanhamento (`/tracking`) está
  `convergida` — substitui definitivamente "Cockpit" (título
  "Acompanhamento do projeto", slug `tracking`), com a rota antiga
  `/cockpit` migrada sem redirect (D026, `docs/07-management/decision-log.md`);
  consolida, somente com dados já existentes, a situação atual do projeto
  (fase, atividade e progresso da fase), a síntese de Entregas (contagens
  por estado e itens realmente em andamento) e as atenções reais
  (impedimentos abertos e pendências abertas), preservando integralmente a
  gestão de impedimentos; aprovada em desktop e mobile. Decisão sobre
  Detalhe de item de atenção concluída — classificada como `combinada com
  outra superfície` (D027, `docs/07-management/decision-log.md`), decisão
  exclusivamente documental: sem rota dedicada; impedimentos permanecem
  geridos em Acompanhamento, pendências em Agora; campos do mockup sem
  sustentação no domínio (responsável, evidência, estado de validação)
  não viram requisitos. Registros (`/records`) está `convergida` — quarto
  e último alvo da ordem, classificado como superfície própria reduzida
  (D028, `docs/07-management/decision-log.md`): a redução ocorre nos
  tipos de conteúdo, não nas fases — índice determinístico das fases com
  resposta, respostas de todas as fases por fase/atividade/campo, e
  pendências resolvidas como histórico exclusivo; pendências abertas
  removidas desta superfície, já cobertas por Acompanhamento e por Agora;
  as seis categorias ilustrativas do mockup (Escopo confirmado, Em
  construção, Hipóteses, Lacunas, Ambiguidade, Entrega) não têm
  sustentação no domínio e não viraram requisitos; revisão de atividade
  concluída da Descoberta a partir de Registros usa origem própria
  (`from=records`), com retorno correto a Registros ao salvar, sem
  alterar a origem equivalente já existente a partir do Resumo
  (`from=summary`). Com os quatro alvos da ordem decididos (Entregas,
  Acompanhamento, decisão sobre Detalhe de item, Registros), **subetapa
  7.4 está concluída**. Subetapa 7.5 — Resultados e encerramento — está
  concluída: as três posições da ordem (Resultados e benefícios, Transição
  e adoção, Encerramento e aprendizado) convergem como uma única
  superfície própria, `/projects/[projectId]/closure` ("Resultados e
  encerramento", D029, `docs/07-management/decision-log.md`), acessível
  pela navegação do workspace ("Encerramento", entre Documento e
  Exportar); três seções mostram as seis atividades reais da fase de
  validação e encerramento com estado e respostas já registradas;
  continuidade contextual orienta para Agora (etapa atual ou etapas
  anteriores, conforme a próxima ação real); ao ficarem todas as
  atividades em estado terminal, uma mensagem de conclusão da etapa
  substitui a continuidade, sem novo status formal de projeto; link
  secundário para Registros; estado "Indisponível" do mockup de
  referência não foi implementado, por não haver hoje um ponto de falha
  isolado e real para esta rota. Subetapa 7.6 — Complementos (Configurações
  do projeto, Exportar, estados vazios, erros relevantes, projeto
  concluído, largura reduzida) — concluída. Configurações do projeto
  (`/projects/[projectId]/settings`), primeiro alvo da subetapa, está
  `convergida` (D030, `docs/07-management/decision-log.md`): superfície
  própria reduzida, sustentada só pelo domínio já existente — renomear o
  projeto (`renameProject`, já implementado e sem interface própria antes
  desta entrega) e exibir a data de criação, somente leitura; nenhuma
  configuração fictícia foi criada — descrição, responsável, estado
  editável, classificação e tipo, regras de orientação, duplicar, arquivar
  e excluir permanecem fora do Release 0. Exportar (`/projects/[projectId]/export`),
  segundo alvo da subetapa, está `convergida` (D031,
  `docs/07-management/decision-log.md`): página visual própria com ação
  explícita "Baixar exportação", download movido para um endpoint
  dedicado (`/export/download`) que preserva integralmente o contrato do
  handler legado (nome real do arquivo, headers, formato JSON), handler
  legado em `/export` preservado para requisições não HTML, sem nenhuma
  configuração fictícia (importação, escolha de formato, histórico,
  agendamento ou compartilhamento). O restante do gate da subetapa foi
  avaliado formalmente, sem alteração de código: estados vazios
  (Configurações suporta nome vazio como estado real; Exportar não tem
  estado vazio aplicável, nome do arquivo depende só do `projectId`);
  erros relevantes (nome vazio em Configurações gera mensagem acessível
  sem persistir; projeto inexistente em Exportar já cai no 404
  compartilhado do layout do workspace); projeto concluído (verificado
  com fixture controlada — Configurações e Exportar continuam acessíveis
  e funcionais, sem bloqueio ou aviso fictício); largura reduzida
  (~390px, verificada nas duas superfícies — sem rolagem horizontal,
  alvos de toque adequados, mensagens sem corte, nome de arquivo imune a
  nome de projeto longo). Nenhum defeito real foi encontrado e nenhum
  código adicional foi necessário. Com os dois itens do inventário
  convergidos e o restante do gate aprovado, **a subetapa 7.6 está
  concluída**. Subetapa 7.7 — Revisão final — está concluída: auditoria
  realizada em 06/08/2026 comparou as 18 superfícies do inventário contra
  sua decisão registrada (13 `convergida`, 4 `combinada com outra
  superfície` — Atividade guiada, Detalhe de item de atenção, Resultados
  e benefícios, Transição e adoção —, 1 `adiada` com justificativa —
  Modelos de jornada), sem encontrar divergência funcional ou visual
  relevante; as mudanças de código posteriores às convergências
  individuais (Home, Biblioteca, Agora, Acompanhamento) foram conferidas
  e correspondem integralmente às decisões D023–D031; navegação do
  workspace coerente entre desktop e mobile; nenhuma referência residual
  a `/cockpit`; evidência funcional reaproveitada sem nova execução —
  `hydra-verify full` PASS 5/5, 458/458 testes unitários, 18/18 jornadas,
  um build, ~84s, commit `0a7e529`. Único achado, trivial, corrigido
  nesta entrega: comentário desatualizado em
  `app/src/routes/projects/[projectId]/+layout.svelte` ("oito destinos"
  → "dez destinos"), sem alteração de `NAV_ITEMS`, rotas ou comportamento.
  Com as sete subetapas (7.0–7.7) concluídas, **a etapa 7 — Convergência
  da experiência e das telas — está concluída.**
- **Ciclo 5 — provar a mecânica Construir → Operar**
  (`docs/08-delivery/cycle-05-backlog.md`): aberto, C5-01 concluído e
  publicado, gate do ciclo ainda não avaliado. Meta: provar, por uma
  fatia pequena em produção, que uma atividade pode CONSTRUIR dados vivos
  do projeto e que atividades seguintes podem OPERAR sobre os mesmos
  dados sem redigitação, usando o Planejamento da entrega como laboratório
  inicial. C5-01 ("Construir → Operar sobre partes do trabalho") —
  `decompor_trabalho` passa a criar uma coleção estruturada de
  `PlanningItem` (id/texto, ordem = posição no array, valor estruturado
  dentro da própria `Answer`, sem entidade/tabela nova); `priorizar_entregas`
  (agora `explicit_confirmation`, `allowsSkip: true`) opera sobre essa
  mesma coleção — reordena só com ↑/↓, sem redigitação de nomes, e
  confirma por ação explícita dedicada (`confirmPlanningPriority`), com
  recusa quando a coleção está vazia. Editar "Decompor o trabalho" depois
  de "Priorizar entregas" confirmada não reabre a confirmação nem gera
  sinalização — comportamento deliberadamente silencioso nesta fatia.
  Implementação, revisão técnica, correções da review, `hydra-verify
  full` final (PASS 5/5, 18/18 jornadas, ~82s), QA manual e seal Nível 3
  concluídos; publicado em `main`/`origin` no commit `a070ed7` (32
  arquivos). Nível 3 (toca `domain/`, `catalog/`, `orientation-engine/`),
  autorizado explicitamente ao longo da sessão de implementação. Entrega
  técnica de C5-01 não equivale à hipótese do Ciclo 5 validada — falta
  dogfooding real (ver "Gate atual" abaixo).
- **Manutenção técnica — `hydra-verify full`** (harness de verificação,
  anterior ao fechamento da subetapa 7.7): infraestrutura de verificação
  estabilizada — `hydra-verify full` volta a ser confiável e
  determinístico. Execução de referência: PASS 5/5 (check, unitários,
  build, 18 jornadas ponta a ponta, `git diff --check`); 18/18 jornadas
  aprovadas; um único build por execução; aproximadamente 83,6 segundos
  no total. As jornadas ponta a ponta foram sincronizadas com as
  superfícies atuais — Biblioteca, Jornada, Acompanhamento, Registros,
  Exportar e o wizard de criação (`/projects/new`); nenhuma
  funcionalidade do produto foi alterada.

Histórico e conteúdo das entregas ficam no CHANGELOG e no Git; decisões
relevantes permanecem no decision-log e, quando houver ciclo formal, o
detalhamento de aceite fica no respectivo backlog.

## Gate atual

Gate do Release 0 atendido: baseline funcional validada de ponta a ponta
(Ciclos 2, 3 e 4 encerrados, D022 concluída). O Ciclo 5 está aberto: C5-01
está concluído e publicado, com todas as condições técnicas do gate do
ciclo atendidas; o gate do próprio Ciclo 5 continua não avaliado — falta
o dogfooding real da hipótese Construir → Operar (ver
`docs/08-delivery/cycle-05-backlog.md`, seção "Gate de conclusão do Ciclo
5"). O gate do Release 1 ainda não existe.

Detalhamento de cada gate de ciclo está nos respectivos backlogs
(`docs/08-delivery/cycle-02-backlog.md`, `cycle-03-backlog.md`,
`cycle-04-backlog.md`, `cycle-05-backlog.md`, seção "Gate de conclusão").

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

As etapas 1 a 7 do roadmap (`docs/03-product/product-roadmap.md`) estão
concluídas. A etapa 7, "Convergência da experiência e das telas",
encerrou-se com a subetapa 7.7 (Revisão final): auditoria realizada em
06/08/2026 confirmou que as 18 superfícies do inventário operacional têm
decisão explícita e coerente com o código atual — 13 `convergida`, 4
`combinada com outra superfície` (Atividade guiada, Detalhe de item de
atenção, Resultados e benefícios, Transição e adoção) e 1 `adiada` com
justificativa (Modelos de jornada, horizonte de Tailoring metodológico);
nenhuma divergência funcional, visual ou documental bloqueante foi
encontrada; a navegação do workspace está coerente entre desktop e
mobile, sem referência residual a `/cockpit`. A manutenção técnica do
harness (`hydra-verify full` PASS 5/5, 458/458 testes unitários, 18/18
jornadas, um build, ~84s, commit `0a7e529`) segue válida como selo
funcional confiável, sem necessidade de nova execução — nenhuma mudança
funcional decorreu desta auditoria. Detalhamento completo em
`docs/03-product/product-roadmap.md`, seção "7.7 — Revisão final".

Com a etapa 7 concluída, não há próxima etapa numerada já definida no
roadmap. "Tailoring metodológico e modelos" permanece registrado como
horizonte possível, dependente de sinais de contexto, aplicabilidade e
profundidade ainda não especificados — não é uma decisão automaticamente
aprovada nem a próxima etapa presumida.

O Ciclo 5 foi aberto separadamente do roadmap — não avança nem antecipa
nenhuma etapa numerada, é um experimento deliberadamente pequeno para
provar a mecânica Construir → Operar antes de qualquer decisão sobre
generalizá-la. C5-01 está concluído e publicado (commit `a070ed7`); a
próxima decisão real é o dogfooding em uso real da hipótese do Ciclo 5 —
"estou trabalhando sobre um projeto que o Hydra já conhece ou ainda estou
explicando o mesmo projeto repetidamente?" — antes de considerar o gate
do Ciclo 5 avaliado.

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
  `cycle-03-backlog.md`, `cycle-04-backlog.md`, `cycle-05-backlog.md`;
- `docs/07-management/decision-log.md`: histórico de decisões;
- `docs/07-management/risk-register.md`: riscos registrados;
- `docs/08-delivery/workflow-v2-design.md`: desenho do workflow de
  entrega;
- `CHANGELOG.md`: comportamento observável entregue.
