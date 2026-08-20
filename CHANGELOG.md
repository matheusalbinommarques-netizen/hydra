# Changelog

## [Unreleased]

### Adicionado

- S6V ("Convergência visual da fundação") — Biblioteca de projetos e
  shell do workspace passam para a identidade dark aprovada (Design
  Gate); o shell permanece dark em toda rota/activity, e conteúdo interno
  ainda não migrado (ex.: Trabalho) aparece contido visualmente dentro
  dele, sem nenhum rótulo de legado/migração exposto ao usuário; nenhuma
  capacidade, rota ou comportamento mudou.
- Rework, ETAPA 6 ("Primeiro loop operacional") — `WorkItem` real (`/work`,
  substitui "Entregas") com três estados (A fazer/Em andamento/Concluído);
  registrar um impedimento vinculado ao item o marca como bloqueado (selo
  visível, sempre derivado, nunca um status) e impede concluir o item até o
  impedimento ser resolvido; Acompanhamento reage em "Precisa de você" com o
  motivo do bloqueio e a ação para tratar, sem duplicar o mesmo impedimento
  em "Atenções" ou "Gestão de impedimentos"; resolver segue dois passos
  explícitos ("Atualizar situação" → "Confirmar que foi resolvido") com
  feedback claro do que mudou e link para continuar em Trabalho (D036,
  `docs/07-management/decision-log.md`).
- Rework, ETAPA 5 ("Decidir o modelo canônico de trabalho") — decisão
  exclusivamente documental: `Deliverable` (priorização/escopo, alimenta
  o Roadmap) e `WorkItem` (execução, alimenta o Kanban) são
  semanticamente distintos; `ScopeItem` histórico é o precursor de
  `Deliverable` (preserva integralmente a semântica de `bucket`
  agora/depois/fora); `PlanningItem` histórico é o precursor semântico de
  `WorkItem`, mas não auto-converte (exige confirmação/associação
  explícita); `ScopeItem.executionStatus` passa a ser tratado como
  compatibilidade histórica, não como definição do novo modelo (D035,
  `docs/07-management/decision-log.md`). Nenhuma entidade nova, schema ou
  dado alterado.
- Rework, Stage 4D ("Checkpoint") — nova tela `/summary` (Checkpoint da
  Descoberta) substitui a antiga "Revisão e confirmação": deriva as
  cinco seções da Descoberta dos objetos vivos existentes, com status
  por seção, "Revisar" com retorno ao checkpoint, e CTA de conclusão
  condicionado às seções obrigatórias; `resumo` deixa de ter superfície
  própria em `/now` e entra direto em `/summary`.
- Rework, Stage 4C ("Resultado desejado") — `mudanca`/`beneficiario`/
  `percepcao` (texto livre) dão lugar a uma coleção ordenada de
  `DesiredOutcome` real: adicionar/editar/remover/reordenar, alvo
  quantitativo opcional (sempre texto, nunca number+unit), conclusão
  bloqueada até haver ao menos um resultado com mudança preenchida;
  campos antigos seguem READ-LEGACY, sem equivalente para
  beneficiário/percepção (`AffectedGroup` já representa quem é afetado).
- R4 (remediação de engenharia) — checklist de living object
  (`docs/core/LIVING_OBJECT_CHECKLIST.md`) e verifier estrutural
  (`hydra-living-object-verifier.mjs`): assistência mecânica explícita
  (target/profile informados por quem implementa, nunca inferidos) para
  não redescobrir o plumbing previsível de uma nova living-object
  capability, sem gerar código nem decidir semântica.
- Rework, Stage 4B ("Entender as causas") — nova atividade da Descoberta
  onde o usuário registra hipóteses de causa reais (`CauseHypothesis`),
  nunca causas confirmadas: múltiplas hipóteses coexistem, com
  proveniência opcional (cartões de contexto reais do projeto),
  aprofundamento opcional (sinal esperado / sinal que enfraquece) e
  relação opcional com `Evidence` já existente; estado explícito "ainda
  não sabemos o que está por trás disso" é legítimo e nunca bloqueia a
  conclusão da atividade. Sem "Sugestão do Hydra" nesta rodada — o
  repositório não tem hoje nenhuma capacidade real de gerar hipóteses.
- Rework, Etapa 4A ("Como é tratado hoje") — `estado_atual_detail`
  (texto livre) dá lugar a uma cadeia ordenada de passos de tratamento
  reais, com meio/ferramenta, fricção e observação; síntese derivada
  determinística e estado "sem tratamento definido" reaproveitados nas
  mesmas superfícies de leitura. Corrige também um bug de migração
  SQLite que deixava bancos existentes sem a linha de tratamento atual.
  Fechada com um corte de refinamento (aprovado por dogfooding visual):
  a cadeia passa a ser uma corrente vertical contínua de nós numerados
  ligados por um trilho, com a síntese pendurada do mesmo trilho, sem
  card próprio; a síntese deixa de serializar ator/meio/fricção por
  passo e passa a contar o fluxo reduzido ("Primeiro"/"Depois"/"Por
  fim"), com as fricções de todos os passos consolidadas ao final, sem
  duplicatas.
- Rework, ETAPA 3 ("Evidence + primeira External Action") — a partir de
  um grupo afetado já classificado, "Validar com este grupo" prepara
  objetivo, perguntas, informação a levar e resultado esperado sem
  digitação nova; o retorno da conversa real (confirmou, confirmou
  parcialmente, contradisse, descobriu algo novo) cria uma evidência
  ligada ao grupo, visível no Mapa de Impacto e no Resumo.
- Ciclo 5, C5-01 — "Decompor o trabalho" (Planejamento da entrega) deixa
  de ser um campo de texto livre e passa a criar uma coleção de partes do
  trabalho: adicionar uma parte por vez, renomear e remover, sempre com
  identidade estável; item novo entra sempre no final; remover preserva a
  ordem relativa dos demais; nome vazio ou só espaços nunca é persistido.
  "Priorizar entregas" passa a operar sobre exatamente essa mesma
  coleção — os nomes aparecem somente leitura, sem nenhuma redigitação, e
  a ordem só pode mudar por ↑/↓ (sem arrastar); a prioridade é confirmada
  por uma ação explícita própria, recusada quando nenhuma parte foi
  definida (nesse caso a tela oferece voltar a "Decompor o trabalho" ou
  pular a etapa); editar "Decompor o trabalho" depois da prioridade já
  confirmada nunca reabre a confirmação nem gera aviso — comportamento
  silencioso, deliberado nesta primeira fatia. "Registros" continua
  apresentando as partes como texto legível e numerado, nunca a
  serialização interna. C5-01 é um experimento controlado (Ciclo 5) da
  mecânica "uma atividade constrói dados vivos do projeto, a atividade
  seguinte opera sobre os mesmos dados" — o Planejamento da entrega é só
  o laboratório inicial, não uma reestruturação geral do produto.
- Catálogo completo das seis fases do Release 0 (Estruturação, Planejamento,
  Execução e Validação, além de Descoberta e Definição do produto já
  existentes) — o estado `concluído` do projeto passa a ser alcançável de
  ponta a ponta;
- duas atividades de Definição do produto: "Definir visão do produto" (tipo
  de produto, necessidade central, benefício central, diferencial) e
  "Definir critérios de sucesso do produto" (sinais de sucesso,
  evidências/indicadores, condição mínima de validação);
- "Escolha o próximo foco" (antes "Monte a próxima versão"): tela
  estruturada de montagem de escopo — adicionar/editar itens, classificar
  bucket e esforço, reordenar, definir hipótese, projeção de sobrecarga
  (mais de 5 itens em "Agora" com esforço médio/grande) e artefato
  confirmado somente leitura com atalho para retomar a jornada;
- tipo de campo de seleção múltipla (`selecao_multipla`) e prova de
  sinal→sugestão: respostas de "Problema ou oportunidade" (sinais da
  situação) geram sugestões explicadas de item de escopo, aceitas
  explicitamente pelo usuário, nunca automáticas;
- reaproveitamento explícito de resposta anterior (`suggestedSource`) como
  ponto de partida editável, sem preenchimento nem vínculo silencioso:
  Público afetado → beneficiário/usuário principal; situação/mudança/
  percepção → visão do produto e critérios de sucesso;
- agrupamento de campos opcionais menos usados em seção recolhível (ex.:
  "Adicionar mais contexto" em "Problema ou oportunidade");
- Resumo da descoberta: visão compacta no topo (problema, sinais, público,
  estado atual, resultado desejado) com link "Editar X" por bloco; detalhe
  completo por atividade recolhido por padrão;
- sinal de conflito critério × escopo: banner no Resumo quando critérios de
  sucesso do produto foram definidos mas nenhum item de escopo em "Agora"
  os sustenta;
- identidade visual papel/tinta/grafite/vermelho-de-lápis substituindo a
  paleta navy/prata/ciano; rótulos amigáveis de status do projeto
  (Rascunho/Em andamento/Concluído) na lista de projetos e no cabeçalho do
  workspace;
- Bancada (Descoberta + Definição do produto, `/now`): layout em duas
  colunas com painel lateral somente leitura que cresce conforme respostas
  canônicas são registradas; atividades decompostas campo a campo, com
  etapa opcional final agrupada e pulável;
- Bancada estendida à Estruturação do projeto: painel "O que já sabemos"
  (`/now`) passa a exibir também as seis atividades de Estruturação
  (objetivo e entregáveis, partes interessadas, papéis e
  responsabilidades, restrições e premissas, riscos do projeto,
  comunicação e governança), com a mesma curadoria de campo canônico por
  atividade já usada em Descoberta e Definição do produto;
- tela dedicada "Documento do projeto" (`/document`): visão consolidada
  somente leitura dos mesmos blocos curados da Bancada, agrupados por fase
  (Descoberta, Definição do produto, Estruturação do projeto); blocos de
  Descoberta têm ação de edição de volta à atividade correspondente,
  Definição e Estruturação ainda não têm edição pós-conclusão; link
  "Documento" adicionado à navegação secundária do workspace;
- Cockpit/Impedimentos (D022, antecipada de Release 3): registrar,
  classificar, definir próxima ação, resolver e reabrir um impedimento;
  tela `/cockpit`; integração neutra ao `/now`;
- `/summary` passa a apresentar as pendências abertas de Descoberta antes
  da confirmação já existente, filtradas pelas atividades da própria fase
  — pendências de outras fases não aparecem; a confirmação continua não
  bloqueante; nenhuma persistência, domínio ou motor de orientação novo
  foi criado;
- em `/map`, o usuário pode definir explicitamente em qual fase o projeto
  realmente começa; a partir dessa escolha, `/now` passa a calcular a
  próxima ação dentro dessa rota recomendada; selecionar "Percurso
  completo" restaura o comportamento padrão; fases anteriores à escolhida
  continuam visíveis no Mapa e não recebem nenhuma alteração automática
  de progresso; a escolha persiste em SQLite e é preservada na
  exportação/importação do projeto (D023,
  `docs/07-management/decision-log.md`);
- em `/map`, diagnóstico de rota assistido por cinco perguntas fixas (uma
  por fase, Descoberta a Execução): a recomendação aponta a primeira
  estrutura ainda não confirmada ou, se todas confirmadas, "Validação e
  encerramento", com justificativa objetiva; as respostas não são salvas,
  só a fase que o usuário decidir aplicar; aplicar a recomendação usa o
  mesmo mecanismo já existente de definir o ponto de partida da rota; o
  seletor manual de fase continua disponível e a recomendação pode ser
  ignorada ou substituída (D024, `docs/07-management/decision-log.md`);
- acompanhamento de execução do primeiro backlog executável: itens de
  escopo em "Agora" (`/next-version/confirmed`, artefato confirmado) ganham
  um controle de status — "A fazer", "Em andamento" ou "Concluído" —,
  editável a qualquer momento após a confirmação do foco, sem afetar essa
  confirmação; itens de "Depois" e "Fora" não exibem nem permitem alterar
  o status de execução (D025, `docs/07-management/decision-log.md`);
- "Entregas" (`/deliveries`, etapa 5 do roadmap "Execução e acompanhamento"):
  superfície operacional dedicada, acessível pela navegação do workspace,
  que agrupa os itens confirmados em "Agora" pelos três estados de
  execução já existentes (A fazer/Em andamento/Concluído), com contagem
  por grupo e a mesma ação de mudança de status já usada em
  `/next-version/confirmed`; sem estado, entidade ou campo novo — reaproveita
  integralmente `ScopeItem.executionStatus` e `setScopeItemExecutionStatus`
  (D025); quando não há versão de escopo confirmada ou não há itens em
  "Agora", mostra estado vazio orientando o usuário sem criar item
  automaticamente; `/next-version/confirmed` continua funcionando sem
  alteração;
- "Biblioteca de projetos" (`/projects`, segunda tela da subetapa 7.2 do
  roadmap "Entrada e organização global"): tela dedicada com busca por
  nome, abas de filtro por estado (Todos/Rascunho/Em andamento/Concluído)
  com contagem por aba, e lista completa de projetos (tabela no desktop,
  cartões no mobile) com estado, data de criação, próxima ação real e
  ação de retomada — mesmos dados e mesma ação `create` já usados na
  Home; nenhum campo, entidade ou consulta nova; busca e filtro são
  puramente client-side sobre `listRecentProjects()`; navegação global
  integrada entre as três superfícies — símbolo/wordmark Hydra vira link
  para a Home em toda tela, o item "Projetos" do cabeçalho leva à
  Biblioteca (marcado `aria-current="page"` quando já está nela), e
  `← Projetos` no cabeçalho do workspace passa a levar à Biblioteca em
  vez da Home;
- "Nova iniciativa" (`/projects/new`, terceira tela da subetapa 7.2 do
  roadmap "Entrada e organização global"): superfície própria com wizard
  de 4 passos — ponto de partida (as mesmas cinco perguntas reais do
  diagnóstico de rota do Mapa), rota recomendada (aceitar a recomendação
  ou escolher outra fase do catálogo manualmente), nome provisório
  (opcional) e revisão; estado do wizard fica somente no cliente até a
  confirmação final — atualizar ou abandonar a página descarta o
  preenchimento, e nenhum projeto é criado antes de "Confirmar e criar";
  em caso de falha na confirmação, nome, fase e progresso do wizard são
  preservados para nova tentativa; tipos de iniciativa ilustrados no
  mockup ficam fora do Release 0, por não terem efeito ou persistência
  real hoje;
- Agora (`/now`, primeira tela da subetapa 7.3 do roadmap "Convergência da
  experiência e das telas") ganha o painel "Progresso da fase": fração de
  atividades resolvidas da fase atual (concluídas + puladas) e as
  atividades agrupadas em Concluídas/Atual/Pendentes/Puladas — reaproveita
  integralmente `activityStatuses`/`nextActivity` já existentes, sem novo
  percentual persistido nem estado de domínio; a mesma classificação passa
  a ser compartilhada com o Mapa (`buildPhaseActivities`), evitando
  duplicar a lógica de status/atividade atual entre as duas telas;
- navegação mobile do workspace (~390px): o cabeçalho comprimido passa a
  mostrar a área atual e um botão "Menu" que expõe os oito destinos reais
  do projeto (Agora, Cockpit, Mapa, Registros, Entregas, Resumo,
  Documento, Exportar), com a rota atual destacada; vale para todas as
  rotas do workspace, não só Agora — parte do shell compartilhado
  (`+layout.svelte`);
- "Resultados e encerramento" (`/projects/[projectId]/closure`, subetapa 7.5
  do roadmap "Resultados e encerramento"): nova superfície própria,
  acessível pela navegação do workspace ("Encerramento", entre Documento e
  Exportar), que combina Resultados e benefícios, Transição e adoção e
  Encerramento e aprendizado em uma única página com três seções, em vez
  de três telas separadas; cada seção mostra as atividades reais da fase
  de validação e encerramento com seu estado (Ainda não iniciada/Em
  andamento/Concluída/Atividade pulada) e as respostas já registradas,
  incluindo "Ainda não registrado" para campos ainda vazios; um bloco de
  continuidade orienta para Agora de forma contextual — apontando para a
  própria etapa de encerramento quando ela é a próxima ação real, ou para
  as etapas anteriores quando ainda não foram concluídas; quando todas as
  atividades da etapa estão em estado terminal, o bloco de continuidade dá
  lugar a uma mensagem de conclusão da etapa, sem criar nenhum status
  formal novo de projeto; um link secundário leva à consulta completa em
  Registros;
- "Configurações" (`/projects/[projectId]/settings`, primeiro alvo da
  subetapa 7.6 do roadmap "Complementos"): nova superfície própria,
  acessível pela navegação do workspace como último destino, depois de
  Exportar, permitindo renomear o projeto diretamente pela interface; exibe
  também a data de criação do projeto, somente leitura; o formulário
  distingue estado inicial (ações desabilitadas), alteração pendente
  ("Alterações não salvas.", ações habilitadas), salvamento bem-sucedido
  ("Alterações salvas.") e nome vazio (mensagem de validação, sem
  persistir); a ação Cancelar descarta a edição em andamento sem gerar
  nenhuma chamada ao servidor; um link secundário leva a Exportar; ao
  salvar, o novo nome do projeto passa a aparecer imediatamente no
  cabeçalho do workspace, na Home e na Biblioteca de projetos;
- "Exportar projeto" (`/projects/[projectId]/export`, segundo alvo da
  subetapa 7.6 do roadmap "Complementos"): nova superfície visual própria,
  acessível pela mesma posição já usada na navegação do workspace e pelo
  link existente em Configurações, explicando em uma frase que os dados
  do projeto serão baixados como um arquivo JSON e apresentando uma única
  ação principal, "Baixar exportação", com o nome real do arquivo exibido
  na página; o download passa a ter um endpoint explícito,
  `/projects/[projectId]/export/download`, que preserva integralmente o
  conteúdo, a serialização, o nome de arquivo e os cabeçalhos já em uso; o
  endpoint legado em `/projects/[projectId]/export` continua funcionando
  sem alteração de contrato para requisições que não navegam para a
  página; experiência convergida em desktop e em mobile (~390px).
- "Entender a situação" (era "Problema ou oportunidade"): seleção
  estruturada em 3 passos (o quê/onde/peso) com síntese automática, no
  lugar de texto livre; taxonomia de opções varia conforme a origem do
  projeto (D034, `docs/07-management/decision-log.md`).
- Rework (ETAPA 2, `docs/core/HYDRA_PRODUCT_REWORK.md`) — "Quem é afetado"
  (era "Público afetado") deixa de ser texto livre e passa a construir um
  Mapa de Impacto: adicionar um grupo cria um `AffectedGroup` real,
  persistido a cada interação; classificar impacto/frequência move o grupo
  entre faixas em tempo real; a mesma síntese aparece sem redigitação em
  Agora, Resumo da descoberta e Documento do projeto. `publico_detail` não
  é mais escrito para projetos novos; snapshots exportados antes desta
  mudança continuam importáveis (dado legado preservado, nunca convertido
  automaticamente em `AffectedGroup`).

### Alterado

- remoção do eixo `ScopeItem.value` (mantém apenas esforço, agora
  obrigatório só para itens em "Agora");
- navegação do workspace reagrupada em abas primárias (Agora/Cockpit) e
  links utilitários discretos (Mapa/Registros/Resumo/Exportar); "Projetos"
  move para o cabeçalho de identidade;
- todos os links de navegação do workspace (Agora, Cockpit, Mapa,
  Registros, Entregas, Resumo, Documento, Exportar) passam a indicar a
  rota atual de forma visual e semântica (`aria-current="page"`); antes,
  só Agora/Cockpit tinham indicação de rota ativa — primeira fatia da
  etapa 7 do roadmap ("Convergência da experiência e das telas");
- Agora (`/now`) passa a exibir um bloco "Onde estamos" acima do card de
  próxima ação, com o nome da fase atual e sua posição na jornada ("Fase X
  de Y"); ao concluir a jornada completa, o bloco mostra "Jornada
  concluída" e "Y de Y fases percorridas" — segunda fatia da etapa 7 do
  roadmap ("Convergência da experiência e das telas"); reaproveita
  integralmente `nextActivity` e a ordem oficial das fases do catálogo,
  sem nova regra de progresso;
- em `/map`, a atividade marcada como recomendada (`activity.isCurrent`)
  passa a exibir o link "Continuar em Agora", levando a `/now` — terceira
  fatia da etapa 7 do roadmap ("Convergência da experiência e das
  telas"); reaproveita integralmente o cálculo de atividade recomendada
  já existente, sem nova regra de progresso;
- Home (`/`) passa a mostrar, para cada projeto listado, sua próxima ação
  real (rótulo da atividade recomendada, respeitando a rota do projeto
  quando definida) e um CTA para retomar o trabalho em `/now` — "Começar
  projeto" (rascunho), "Continuar projeto" (em andamento) ou "Ver
  projeto"/"Jornada concluída" (concluído); sem linguagem de recência
  ("mais recente"/"de onde parou"), pois o produto não tem sinal
  persistido que sustente essa afirmação — quarta fatia da etapa 7 do
  roadmap ("Convergência da experiência e das telas"); reaproveita
  integralmente o estado já carregado por `listRecentProjects()` para
  `projectStatus` e a mesma fonte route-aware de próxima atividade usada
  em `/now` e `/map` (`computeSnapshot(...).nextActivity`, D023); nenhuma
  consulta nova, nenhuma regra de progresso nova;
- fundação visual compartilhada do shell (subetapa 7.1 do roadmap,
  "Convergência da experiência e das telas"): tokens de espaçamento,
  tipografia, raio e elevação definidos em `app.css` e aplicados ao
  cabeçalho/navegação do workspace (presente em toda tela de projeto) e ao
  cabeçalho da Home; o cabeçalho do workspace passa a ter elevação real
  (superfície clara com sombra sutil), antes idêntico visualmente ao fundo
  da página; nenhuma tela teve conteúdo, estrutura ou mecânica alterada —
  só valores de espaçamento/tipografia/cor normalizados;
- Home (`/`) reestruturada visualmente a partir do artefato aprovado no
  Claude Design ("Home Seus Projetos") — primeira tela da subetapa 7.2 do
  roadmap ("Entrada e organização global"): cabeçalho compacto com ação
  principal "Criar nova iniciativa" em destaque; projeto em destaque (o
  primeiro projeto não concluído) com status, próxima ação real e link
  "Ver visão geral" para o Cockpit; painel lateral com as duas capacidades
  reais do produto — criar e importar projeto, a importação revelada sob
  demanda (`<details>`) em vez do campo de arquivo permanentemente
  exposto; lista "Todos os projetos" mais compacta, com badges por status;
  paleta, tipografia, densidade e comportamento responsivo (desktop e
  ~390px) aproximados do artefato; nenhum dado, rota, consulta ou
  comportamento novo — reaproveita integralmente `listRecentProjects()` e
  as ações `create`/`import` já existentes. Aprovada visualmente por
  Matheus (desktop e mobile) contra o artefato individual do Claude
  Design — tela marcada `convergida` no inventário da etapa 7;
- Home (`/`) passa a listar só os cinco projetos mais recentes na seção
  "Projetos" (antes "Todos os projetos"), com link "Ver todos os
  projetos" para a nova Biblioteca (`/projects`); nenhuma outra parte da
  Home foi alterada;
- os botões "Criar nova iniciativa" da Home e da Biblioteca (cabeçalho e
  estado vazio) passam a levar a `/projects/new` em vez de criar o
  projeto imediatamente; a criação passa a ser atômica — nome e fase
  inicial (quando informados no wizard) são aplicados ao estado do
  projeto antes de uma única gravação, nunca em criação seguida de
  gravações separadas de nome e rota;
- Agora (`/now`) passa a usar layout de duas colunas em toda fase, não só
  nas de Bancada — a coluna lateral sempre mostra "Progresso da fase"; a
  Bancada ("O que já sabemos") continua abaixo dela, só nas fases já
  suportadas (Descoberta, Definição do produto, Estruturação); mecânica da
  próxima ação (pergunta, campos, Salvar e continuar, Pular etapa, revisão
  recomendada) preservada sem alteração de rota — a atividade guiada
  continua integrada à própria tela Agora, sem rota separada de execução;
  aprovada funcional e visualmente por Matheus contra o artefato
  individual do Claude Design — tela marcada `convergida` no inventário
  da etapa 7;
- Mapa (`/projects/[projectId]/map`) passa a apresentar a Jornada do
  projeto como conteúdo principal, a partir do artefato aprovado no
  Claude Design ("Jornada — Hydra"): fases numeradas pela posição real do
  catálogo, com a fase e a atividade atuais destacadas visualmente;
  atividades apresentadas só pelos quatro estados reais — Concluída,
  Atual, Pendente e Pulada — com legenda própria; um único acesso
  "Continuar em Agora" para retomar o trabalho; Diagnóstico da rota e
  "Onde este projeto realmente começa?" continuam disponíveis, agora
  agrupados em "Diagnóstico e ponto de partida", uma área recolhível que
  inicia fechada, sem qualquer alteração nos formulários, submissões ou
  mensagens existentes; composição responsiva em desktop (colunas para
  jornada e legenda) e mobile (uma coluna, sem rolagem horizontal);
  nenhuma rota nova foi criada, nenhum status novo foi introduzido, e
  nenhuma regra de domínio ou persistência foi alterada — a execução das
  atividades continua acontecendo em Agora; tela marcada `convergida` no
  inventário da etapa 7;
- Documento do projeto (`/projects/[projectId]/document`) deixa de ser uma
  sequência de cartões independentes e passa a se apresentar como uma
  única superfície documental contínua, a partir do componente final
  aprovado no Claude Design: fases como seções numeradas ("1 —
  Descoberta"), atividades como subseções separadas por divisores
  discretos, respostas apresentadas como conteúdo documental (parágrafos
  completos, sem truncamento) e tags reais preservadas como metadado
  secundário, sem aparência de botão; ações "Editar" tornam-se links
  discretos com rótulo acessível descritivo, preservando integralmente os
  destinos já existentes; um único CTA "Continuar em Agora" no cabeçalho
  da página; estado vazio convergido ("Ainda não há conteúdo consolidado")
  mantendo o mesmo comportamento funcional; layout responsivo aprovado em
  desktop (superfície com largura máxima de 800px, alinhada ao contêiner
  já usado pelas demais telas convergidas) e mobile (~390px, sem coluna
  lateral, sem rolagem horizontal); nenhuma rota, consulta, entidade,
  campo ou regra de domínio nova — reaproveita integralmente
  `document-view.ts` e os dados já existentes; o Documento permanece
  somente leitura, com preenchimento e execução continuando em `/now`;
  tela marcada `convergida` no inventário da etapa 7;
- token semântico `--hydra-editorial-accent` adicionado à fundação visual
  (`app.css`), para o vermelho queimado usado como destaque puramente
  decorativo/editorial (títulos, números de fase); `--hydra-warning`
  permanece reservado ao seu significado semântico original (conteúdo
  gerado/derivado pelo sistema — sugestões, alertas, conflitos), agora sem
  nenhum uso decorativo no Documento do projeto; nenhuma mudança visual
  perceptível foi introduzida por essa separação;
- Resumo da descoberta (`/projects/[projectId]/summary`) converge para
  "Revisão e confirmação": passa a se apresentar como um checkpoint formal
  em uma única superfície, com contexto explícito "Fase 1 — Descoberta" —
  permanece exclusiva da Descoberta no Release 0, sem generalizar o
  mecanismo de confirmação para outras fases; as decisões principais
  (Problema, Público afetado, Estado atual, Resultado desejado) passam a
  aparecer no "Resumo da fase" com alinhamento consistente entre
  marcador, título, resposta, tags e o link "Editar" (grade explícita
  marcador/conteúdo/ação); as respostas detalhadas continuam preservadas
  em área recolhível; "Pontos de atenção" consolida os sinais reais já existentes
  (`criteriaScopeConflict` e `discoveryOpenPendingItems`, com estado vazio
  explícito quando nenhum se aplica); o checklist existente passa a ser
  apresentado como "Conferência"; os links "Editar" tornam-se discretos e
  acessíveis, com rótulo descritivo e destino preservado, e podem quebrar
  para uma segunda linha no mobile sem deslocar o marcador; a ação
  "Voltar para edição" leva a `/now`; a ação principal, renomeada para
  "Confirmar e avançar", preserva integralmente o comportamento de
  confirmação já existente; destino do shell continua chamado "Resumo";
  composição responsiva aprovada em desktop e mobile; nenhuma revisão
  genérica por fase, novo `completionMode`, impacto ou hipótese fictícia,
  nova rota, consulta, entidade, persistência ou regra de domínio foi
  introduzida — tela marcada `convergida` no inventário da etapa 7, que
  conclui a subetapa 7.3 (etapa 7 permanece em andamento);
- Entregas (`/projects/[projectId]/deliveries`), primeira tela da subetapa
  7.4 do roadmap ("Execução e controle"), converge visualmente a partir das
  propostas desktop e mobile aprovadas no Claude Design: título e descrição
  da superfície; três grupos (A fazer/Em andamento/Concluído) com cabeçalho
  por símbolo monocromático (mesmo vocabulário de Mapa e Agora), nome e
  contagem; card como principal elemento delimitado (borda leve + sombra),
  coluna como superfície agrupadora discreta; bordas em geral suavizadas
  (cinza translúcido, não preto) mantendo contraste acessível; estado vazio
  "Nenhum item neste estado." por grupo; rótulo do campo de esforço
  renomeado de "Tamanho" para "Esforço"; estado de execução atual do item
  passa a usar `--hydra-editorial-accent` (vermelho queimado) para se
  destacar dos demais, com `aria-pressed` preservando a distinção para
  leitores de tela; empilhamento vertical no mobile reaproveitando
  integralmente a navegação mobile já compartilhada do shell, sem menu
  próprio; nenhuma mudança de domínio, projeção (`deliveries-view.ts`),
  action ou mecânica — `executionStatus`, agrupamento, contagem e a action
  `?/setExecutionStatus` preservados integralmente; tela marcada
  `convergida` no inventário da etapa 7; subetapa 7.4 permanece em
  andamento, com Acompanhamento como próximo alvo — nome que substitui
  "Cockpit" na linguagem do produto (decisão já tomada), renomeação ainda
  não implementada nesta entrega;
- Acompanhamento (`/projects/[projectId]/tracking`, segunda tela da
  subetapa 7.4 do roadmap "Execução e controle") substitui definitivamente
  o nome "Cockpit"; rota migrada de `/projects/[projectId]/cockpit`, sem
  redirect (D026, `docs/07-management/decision-log.md`); passa a
  consolidar, somente com dados já existentes, a situação atual do
  projeto (fase, atividade e progresso da fase), a síntese de Entregas
  (contagens por estado e itens realmente em andamento, sem promover
  automaticamente o primeiro item de "A fazer" a "próxima entrega") e as
  atenções reais (impedimentos abertos e pendências abertas); a gestão de
  impedimentos (registrar, tipar, definir próxima ação, resolver, reabrir)
  é preservada integralmente como parte desta superfície; um único acesso
  "Continuar em Agora" fecha a página; tela marcada `convergida` no
  inventário da etapa 7;
- Registros (`/projects/[projectId]/records`, quarto e último alvo da
  ordem da subetapa 7.4 do roadmap "Execução e controle") converge como a
  memória consultável do projeto: um índice lista somente as fases com
  respostas registradas, com contagem determinística por fase; respostas
  de todas as fases do catálogo continuam apresentadas por fase,
  atividade e campo; pendências abertas deixam de aparecer nesta
  superfície — já cobertas por Acompanhamento e pelo próprio ponto de
  resolução em Agora —, e pendências resolvidas permanecem como
  histórico; revisar uma atividade concluída da Descoberta a partir de
  Registros passa a ter texto, ação e retorno próprios — ao salvar, volta
  a Registros, não mais ao Resumo; o fluxo equivalente de revisão
  iniciado a partir do Resumo continua preservado, com seu próprio
  retorno; as seis categorias ilustrativas do mockup de referência
  (Escopo confirmado, Em construção, Hipóteses, Lacunas, Ambiguidade,
  Entrega) não têm sustentação no domínio atual e não se tornaram
  requisitos (D028, `docs/07-management/decision-log.md`); tela marcada
  `convergida` no inventário da etapa 7 — com os quatro alvos da ordem
  decididos, subetapa 7.4 concluída.
- Ciclo 6, C6-01 — Home (`/`) passa a mostrar sinais reais por projeto,
  substituindo a leitura de próxima ação sozinha: bloco "Continue de onde
  parou" agora seleciona, entre os projetos não concluídos, o de
  movimentação real mais recente (nunca pela data de criação), e deixa de
  aparecer duplicado na lista de projetos abaixo; cada projeto passa a
  mostrar a fase atual e quantas atividades já foram concluídas nela
  (ex.: "Descoberta · 3 de 5 concluídas"), nunca porcentagem ou barra de
  progresso; um sinal real por projeto — bloqueado (impedimento aberto),
  parado (sem nenhuma movimentação há 7 dias ou mais) ou avançando —
  calculado a partir de dados já existentes do projeto, nunca persistido;
  "aguardando alguém" não entra nesta fatia, por depender de dados de
  participantes/aprovação que ainda não existem; nenhuma Configuração
  global foi criada. Primeiro item do Ciclo 6 (provar a experiência
  estruturada a partir da Home), sem mudança em domínio, catálogo, motor
  de orientação ou persistência. Convergência visual (D033,
  `docs/07-management/decision-log.md`): a Home passa a usar a nova
  identidade global aprovada — tema escuro, acento ciano/teal, fonte
  Inter, sidebar de navegação fixa (Home/Projetos/Configurações, esta
  última sem link real por não existir configuração global ainda);
  bloco "Continue de onde parou" ganha um indicador de progresso nas seis
  fases do catálogo e um texto de apoio da próxima ação (reaproveitando
  `ActivityDefinition.why`, dado já existente); lista de projetos passa a
  priorizar quem precisa de atenção (bloqueado, depois parado, depois
  avançando); busca, notificações e perfil de usuário no topo são
  decoração estática, sem nenhuma capacidade real por trás. Migração
  tela a tela — as demais telas do produto continuam na identidade
  papel/tinta/grafite até serem convergidas individualmente.
- Marca: logo/favicon/App Icon substituídos pelos assets oficiais da
  identidade escura (símbolo prata/ciano); topo esquerdo da Home passa a
  usar o Horizontal Lockup compacto em vez de ícone+texto separados.
- `/projects/new`: tela única de nome + origem (Claude Design), sem
  diagnóstico de rota (que continua existindo em `/map`, D023/D024); leva
  direto para "Entender a situação" — "Contexto inicial" foi removida da
  jornada (D034).
- Shell do workspace (`[projectId]/+layout.svelte`) ganha tema escuro
  escopado, ativo somente quando a atividade atual é "Entender a
  situação" — as demais atividades continuam na identidade
  papel/tinta/grafite.
- "Entender a situação" passa a usar a mecânica completa do mockup
  (Claude Design, "Entender a Situacao.dc.html"): topbar de progresso com
  as atividades da fase (pílulas), painel lateral "Documento do projeto"
  que reflete ao vivo as seleções em curso (com destaque temporário ao
  adicionar), e um passo final "Etapa concluída" antes de avançar para a
  próxima atividade. Substitui, só para esta atividade, o painel genérico
  "Progresso da fase"/Bancada de `/now`; implementado local ao componente
  (`EntenderSituacao.svelte`), sem abstração compartilhada — extraída
  quando uma segunda atividade adotar a mesma mecânica, não antes.
- Rework (ETAPA 1, `docs/core/HYDRA_PRODUCT_REWORK.md`) — fundação visual
  mínima consolidada: tokens de cor/raio comprovadamente idênticos entre
  Home, `/projects/new` e "Entender a situação" passam a ler de
  `.hydra-dark-tokens` (`app.css`), eliminando três sistemas de tokens dark
  paralelos; Inter Variable carregada de verdade (self-hosted,
  `@fontsource-variable/inter`) como fonte real dessas três telas, em vez
  de declarada sem efeito. Sem mudança visual perceptível nem de
  comportamento — só consolidação de CSS.
- "Quem é afetado" (Mapa de Impacto, ETAPA 2) reaproveita a mesma
  identidade escura — tema escuro do shell (`[projectId]/+layout.svelte`)
  estendido a essa atividade, junto com "Entender a situação".

### Reconciliado

- confrontada a etapa 6 do roadmap ("Resultados, adaptação e
  encerramento") com o código existente: a fase "Validação e encerramento"
  já possui seis atividades completas no catálogo (validar entregas e
  critérios de aceitação, coletar feedback, resolver pendências finais,
  registrar lições aprendidas, definir transição e próximos passos,
  confirmar encerramento do projeto), acessíveis pela jornada guiada
  normal, com persistência e motor de orientação genéricos — sem código
  dedicado de fase; a confirmação final exige campo obrigatório e não pode
  ser pulada; ao concluí-la, `computeProjectStatus` resulta em `concluído`
  e `/now` comunica explicitamente o fim da jornada; evidências
  permanecem acessíveis em `/records` e o estado das seis atividades é
  consultável em `/map`; essa capacidade já estava presente no código,
  incluindo o suporte introduzido em `41617f3`; nenhuma mudança funcional
  foi necessária nesta entrega — só reconciliação documental de
  roadmap/`PROJECT_STATUS.md`;
- removida a contradição do roadmap que apresentava "Tailoring
  metodológico e modelos" como próxima etapa apesar de classificá-lo, no
  próprio texto, como horizonte de longo prazo; a sequência imediata
  passa para "Convergência da experiência e das telas" (etapa 7); o
  antigo conteúdo de Tailoring foi movido para uma seção de horizonte
  posterior, fora da sequência numerada; nenhuma mudança funcional foi
  realizada;
- a etapa 7 do roadmap ("Convergência da experiência e das telas") passa
  a funcionar também como backlog operacional: as 16 telas da montagem
  `hydra-target-screens.png` foram separadas em imagens individuais
  aprovadas (`design/approved/screens/`), deixando de ser referência
  genérica para se tornarem alvo verificável por tela; o roadmap ganhou
  inventário de 18 telas-alvo com referência visual, superfície atual,
  situação e decisão, além da sequência 7.0–7.7 com gates; as quatro
  microfatias já publicadas nesta etapa foram reclassificadas como
  preparatórias, sem que nenhuma tela seja considerada convergida por
  causa delas; nenhuma mudança funcional foi realizada nesta entrega;
- `docs/core/UX_DESIGN_SPEC.md` reconciliado com a identidade papel/tinta/
  grafite já em produção: removidas as referências à direção visual
  anterior (fundo navy, acento ciano, tema escuro, JetBrains Mono),
  substituídas pela paleta e tipografia (Manrope operacional, serifada
  reservada a identidade/título) já implementadas em `app.css`; navegação,
  hierarquia funcional e demais seções do documento não foram alteradas.

### Verificado

- `hydra-verify full` (harness de verificação determinística) reconstruído:
  execução assíncrona com logs progressivos por etapa, timeout próprio por
  etapa e encerramento controlado de toda a árvore de processos ao atingir
  o timeout, sem deixar processos órfãos;
- eliminados os múltiplos builds redundantes por execução — o app passa a
  ser construído uma única vez, reaproveitado pela suíte de jornadas ponta
  a ponta;
- o teste E2E demo do scaffold (sem relação com o produto) saiu do selo
  `full`, que passa a cobrir só a cobertura real do Hydra;
- as jornadas ponta a ponta foram sincronizadas com os fluxos atuais do
  produto (wizard de criação, Biblioteca, Jornada, Acompanhamento,
  Registros, Exportar);
- resultado da execução de referência: `npm run check` aprovado, 458
  testes unitários aprovados, build aprovado, 18 jornadas ponta a ponta
  aprovadas — aproximadamente 84 segundos ao todo, sem processos órfãos;
- subetapa 7.7 (Revisão final) e, com ela, a etapa 7 (Convergência da
  experiência e das telas) foram concluídas: auditoria integral das 18
  superfícies do inventário operacional contra suas decisões registradas
  (13 `convergida`, 4 `combinada com outra superfície`, 1 `adiada`),
  confirmando coerência entre referências visuais, roadmap, decisões
  (D023–D031), navegação do workspace e produto, sem nenhuma mudança
  funcional necessária; corrigido comentário interno desatualizado sobre
  a quantidade de destinos da navegação do workspace (`app/src/routes/projects/[projectId]/+layout.svelte`).

## [0.4.0] — 25/07/2026

### Adicionado

- Tela Mapa da jornada (`/projects/[projectId]/map`): mostra as seis fases
  do catálogo em ordem, com status de cada fase e atividade, e destaque da
  atividade recomendada como próximo passo;
- Tela Registros (`/projects/[projectId]/records`): mostra as respostas
  registradas, agrupadas por fase e atividade, e o histórico de pendências
  (abertas e resolvidas, com datas), somente leitura;
- Interface de "Pular etapa" em Agora (`/projects/[projectId]/now`): botão
  condicionado a atividades que permitem pular, modal de confirmação
  acessível (`<dialog>` nativo) informando a consequência e a criação de
  pendência, e retomada segura da atividade pulada a partir da pendência
  aberta (`?activity=<id>`, validada contra o próprio projeto), com
  resolução automática da pendência ao responder e retorno à recomendação
  canônica;
- Listagem de projetos na página inicial (`/`): mostra os projetos
  persistidos, mais recentes primeiro, cada um com link para reabrir em
  `/projects/[projectId]/now`; estado vazio quando não há projetos; link
  "Projetos" no cabeçalho do workspace para retornar à página inicial.

## [0.3.0] — 24/07/2026

### Adicionado

- Walking Skeleton funcional do Release 0, executável de ponta a ponta no
  navegador (Ciclo 2, itens Must C2-01 a C2-12);
- domínio (`domain/`): tipos, fábrica e transições puras, serialização JSON
  versionada;
- catálogo completo do Release 0 (`catalog/`): oito atividades (sete da
  Descoberta + "Definir usuário principal");
- motor de orientação (`orientation-engine/`): status de fase, próxima
  atividade recomendada, pendências e hipóteses;
- persistência em SQLite (`server/persistence/`, via `better-sqlite3`);
- camada de aplicação (`server/application/`) com os oito casos de uso do
  Walking Skeleton;
- rotas mínimas (Home, Agora, Resumo, Exportar/Importar);
- exportação e importação de projeto em JSON versionado, com validação de
  invariantes e rejeição de colisão de identificador;
- teste de jornada ponta a ponta (Playwright) cobrindo as oito atividades
  reais, o Resumo, `catalog_limit_reached`, exportação e importação em
  bancos SQLite isolados.

### Verificado

- typecheck (`tsc --noEmit` via `svelte-check`): 0 erros, 0 avisos;
- Vitest (unitário + integração): 137/137;
- teste de jornada Playwright: aprovado, em execuções consecutivas sem
  resíduo de processos ou arquivos temporários;
- suíte Playwright padrão: aprovada;
- build de produção (`adapter-node`): aprovado;
- persistência validada manualmente após reinício do processo do servidor.

### Pendente

- Tela Mapa mínima (C2-13);
- Tela Registros mínima (C2-14);
- "Pular etapa" na interface (C2-15).

## [0.1.0] — 22/07/2026

### Adicionado

- baseline de descoberta, iniciação, produto e planejamento;
- definição do público e da proposta de valor;
- escopo do MVP;
- Story Map e roadmap;
- estratégia de entrega em ciclos de duas semanas;
- plano de requisitos e rastreabilidade;
- plano de qualidade e Definition of Done;
- especificação preliminar do Release 0;
- riscos, premissas e decisões iniciais;
- templates de issues, review e retrospectiva.

### Pendente

- protótipo navegável;
- teste de usabilidade;
- modelo conceitual de dados;
- comparação formal de stacks;
- ADR de escolha da stack;
- Walking Skeleton funcional.

## [0.2.0] — 22/07/2026

### Adicionado

- protótipo navegável do Release 0;
- Home com estados vazio, único projeto e múltiplos projetos;
- atividades guiadas;
- modal de confirmação ao pular;
- criação e resolução de pendências;
- Resumo da descoberta;
- Workspace com Agora, Mapa e Registros;
- documentação das decisões visuais finais.

### Alterado

- unificação da jornada macro em seis fases;
- separação entre fases e atividades;
- sincronização conceitual dos estados entre as telas;
- simplificação da navegação e terminologia.

### Aprovado

- identidade visual navy, prata e ciano;
- experiência do Release 0 como referência para implementação.