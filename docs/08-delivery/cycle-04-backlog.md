# Backlog do Ciclo 4

**Meta:** concluir a baseline funcional do Release 0, implementando a
experiência de "Pular etapa", reconciliando a especificação com o produto
funcional atual e validando internamente a jornada completa com um
projeto real de Matheus.

## Origem

O Ciclo 3 encerrou com C3-01 e C3-02 concluídos e C3-03 ("Pular etapa" na
interface) adiada como Could não iniciada. A auditoria formal do Release 0
feita na abertura deste ciclo identificou C3-03 como a única lacuna
funcional real da baseline, e `docs/core/RELEASE_0_SPEC.md` como
desatualizado — ainda descreve o protótipo clicável pré-desenvolvimento,
não o produto funcional atual. Este ciclo fecha as duas coisas e valida o
resultado com uso real, sem depender de teste com usuários externos
(`docs/07-management/decision-log.md`, D021).

## Must

### C4-01 — Reconciliar a especificação do Release 0

**Status:** ✅ concluído (commit `a399191` — `docs(release-0): reconcile specification with functional baseline`).

**Resultado esperado:**
- `docs/core/RELEASE_0_SPEC.md` passa a representar o produto funcional
  atual;
- premissas exclusivas do protótipo pré-desenvolvimento deixam de ser
  tratadas como escopo vigente;
- comportamentos válidos permanecem preservados;
- a divergência do Resumo (estrutura atual vs. "fatos, hipóteses, lacunas
  e pendências" do documento original) é registrada como decisão
  consciente de manter a implementação atual;
- a expressão "criação simulada de um projeto" em `CLAUDE.md` é corrigida,
  caso continue presente.

**Critérios de aceite:**
- persistência, importação/exportação e testes automatizados não aparecem
  mais como capacidades fora do Release 0;
- o objetivo e a natureza do documento deixam claro que ele representa a
  baseline funcional, não mais o protótipo pré-desenvolvimento;
- critérios comportamentais ainda válidos (posição atual, motivo, pular,
  consequência, pendência, mapa) permanecem;
- nenhuma divergência conhecida entre a especificação reconciliada e o
  produto fica sem decisão registrada.

**Tipo:** documentação e decisão de produto.

**Evidências:**
- `docs/core/RELEASE_0_SPEC.md`: cabeçalho, §2 e §9 não descrevem mais o
  documento como protótipo pré-desenvolvimento; persistência real,
  importação/exportação e testes automatizados removidos de "Fora do
  Release 0"; §6 sem linguagem de regras simuladas; §8 sem teste com
  usuários externos como critério de conclusão da baseline; §4.7 registra
  a estrutura atual do Resumo e a diferenciação entre a tela de Resumo e
  a exportação JSON como decisões conscientes; numeração §4.1–§4.9
  preservada, sem impacto na referência de
  `app/src/lib/catalog/discovery.ts`;
- `CLAUDE.md`: "criação simulada de um projeto" corrigido para "criação
  de um projeto";
- `docs/core/README.md`: descrição de `RELEASE_0_SPEC.md` atualizada para
  refletir seu papel como especificação reconciliada da baseline;
- uma divergência adicional (exportação legível de "Project Brief") foi
  identificada durante a implementação e resolvida como decisão de
  produto: não pertence à baseline funcional atual, registrada em §4.7 do
  documento reconciliado;
- commit `a3991913e35874c2ea92c803fd6d1cf9a9e35e9f`.

---

### C4-02 — Implementar a interface mínima de "Pular etapa"

**Status:** ✅ concluído (commit `39fdc06` — `feat(discovery): add skip and resume activity flow`).

**Resultado esperado:**
- ação disponível somente quando `allowsSkip === true`;
- consequência apresentada antes da confirmação;
- possibilidade de cancelar sem alterar o projeto;
- confirmação utilizando a operação existente de `skipActivity`;
- pendência criada e visível;
- próxima ação recalculada;
- atividade pulada continua acessível pelos caminhos já previstos.

**Critérios de aceite:**
- botão e confirmação funcionais;
- consequência utiliza informação real já fornecida pelo catálogo
  (`pendingItemDetail`);
- cancelar não altera estado;
- confirmar cria a pendência;
- Agora e Registros refletem a pendência;
- a atividade pulada não volta como recomendação da Trilha A;
- teste Playwright dedicado passa;
- QA manual concluída;
- `hydra-verify full` passa.

**Áreas esperadas:** rota `now/` (`+page.server.ts`, `+page.svelte`),
novo componente de confirmação, teste Playwright dedicado.

**Dependência:** C4-01 concluído.

**Áreas protegidas — não autorizadas previamente:**
```
domain/
catalog/
orientation-engine/
server/application/
```
A expectativa é consumir a implementação já existente (`skipActivity`,
testado desde C2-06/C2-10). Se durante o planejamento ou a implementação
surgir necessidade real de alterar essas áreas, isso deve ser reportado e
tecnicamente justificado antes de qualquer mudança — não presumir
autorização.

**Tipo:** código e testes.

**Evidências:**
- `app/src/routes/projects/[projectId]/now/+page.server.ts`: `load` passa a
  aceitar `?activity=<id>` para retomada, validado exclusivamente contra
  `view.openPendingItems` (pendência aberta do próprio projeto — nenhum
  identificador arbitrário abre atividade futura ou não pulada); nova
  action `skip` delega integralmente a `getProjectUseCases().skipActivity`
  (nenhuma validação de domínio duplicada na rota) e redireciona (303) para
  a rota canônica de Agora, sem preservar o parâmetro de retomada;
- `app/src/routes/projects/[projectId]/now/+page.svelte`: botão "Pular
  etapa" condicionado a `allowsSkip === true && !isResuming`; link "Retomar
  etapa" em cada pendência aberta; resposta a uma atividade retomada
  navega (client-side, `goto`) para a URL canônica sem `?activity` após
  sucesso, preservando o comportamento normal (sem retomada) inalterado;
- `app/src/lib/components/SkipActivityConfirm.svelte` (novo): modal de
  confirmação com `<dialog>` nativo, sem biblioteca externa — informa que
  a etapa não será concluída, exibe `pendingItemDetail`, avisa da criação
  da pendência; cancelar fecha sem requisição; confirmação duplicada
  bloqueada enquanto a submissão está em andamento; erro mantém o modal
  aberto com mensagem; sucesso fecha o modal antes de aplicar o redirect;
- `app/e2e/skip-activity.journey.ts` (novo): teste Playwright dedicado
  cobrindo botão condicional, conteúdo do modal, `Escape` (fecha o modal
  sem confirmar o skip, sem criar pendência e sem mudar a URL — comprovado
  em Chromium real via Playwright; a ferramenta de QA manual usada durante
  a revisão não conseguiu simular corretamente esse fechamento, mas não há
  defeito pendente relacionado), cancelamento pelo botão, confirmação
  (pendência criada, próxima ação avança, pendência em Agora e Registros),
  retomada pela pendência, resposta da atividade retomada (pendência
  resolvida, URL volta a `/projects/<projectId>/now` sem `activity`,
  recomendação canônica exibida) e ausência do botão em atividade não
  pulável (Resumo);
- `app/e2e/records-view.journey.ts`: apenas o comentário de cabeçalho
  atualizado, deixando de afirmar que a interface de pular não existe;
  lógica do teste inalterada;
- nenhuma alteração em `domain/`, `catalog/`, `orientation-engine/` ou
  `server/application/` — implementação consumiu exclusivamente
  `skipActivity`/`answerActivity` já existentes;
- `hydra-verify --mode full --item C4-02`: PASS, 6/6 etapas;
- QA manual aprovada (fluxo completo de pular, cancelar, confirmar,
  retomar e responder, percorrido no navegador contra um build standalone
  com banco temporário isolado);
- commit `39fdc06008ae510faf468b9e8baf13ef256f0837`.

---

### C4-03 — Executar checkpoint de dogfooding do Release 0

**Status:** ✅ concluído (25/07/2026 — checkpoint conduzido por Matheus com
projeto real; item de uso real, sem commit de código associado).

**Resultado esperado:** Matheus utiliza o Hydra com um projeto real e
percorre o checkpoint delimitado da jornada.

**Escopo mínimo:**
- criar ou cadastrar um projeto real;
- percorrer as atividades disponíveis;
- confirmar o Resumo;
- consultar Mapa e Registros;
- exportar e importar;
- exercitar "Pular etapa" após C4-02;
- verificar criação e visualização da pendência;
- comunicar ao ChatGPT ou ao Claude Code bloqueios ou incoerências
  relevantes.

**Critérios de aceite:**
- checkpoint percorrido pelo menos uma vez;
- problemas relevantes relatados e analisados;
- cada achado acionável classificado como corrigir, incluir no backlog,
  adiar, aceitar ou descartar;
- não exige conclusão do projeto real;
- não exige issue, formulário ou arquivo próprio de log;
- "nenhum problema relevante encontrado" é um resultado válido.

**Evidência:**
- confirmação de Matheus de que o checkpoint foi realizado;
- decisões, correções ou itens de backlog gerados pelos achados, quando
  existirem.

**Tipo:** uso real.

**Evidências (checkpoint realizado):**
- projeto real utilizado: "Level Me Up — Refatoração e evolução da
  baseline";
- capacidades percorridas: criação e preenchimento da Descoberta;
  salvamento e continuidade da jornada; confirmação do Resumo; Mapa;
  Registros; "Pular etapa"; criação e exibição da pendência; retomada e
  resolução da atividade pulada; exportação JSON; proteção esperada contra
  colisão de ID na reimportação; persistência validada reabrindo a URL
  direta do projeto após fechar e reabrir a aba;
- Mapa: aprovado — fase Descoberta concluída (sete atividades), Definição
  do produto disponível, "Definir usuário principal" como próxima
  atividade recomendada;
- Registros: aprovado — respostas do projeto real preservadas, nenhuma
  pendência aberta, "Público afetado" corretamente listado como pendência
  resolvida no histórico;
- achados classificados:
  1. mensagem de colisão na importação não orienta o próximo passo —
     dificuldade de UX, candidata a backlog Should;
  2. "Importar como cópia" — funcionalidade nova fora do Release 0, sem
     inclusão automática no Ciclo 4;
  3. ausência de listagem de projetos existentes e de navegação de
     retorno à área de projetos — defeito funcional da baseline
     (`docs/core/RELEASE_0_SPEC.md` §4.1: "área de projetos recentes",
     "abrir projeto existente") e bloqueador de C4-04; tratado como item
     corretivo **C4-03A** (abaixo), com inclusão no Ciclo 4 já autorizada
     e implementação pendente de planejamento e aprovação separados;
- nenhum outro problema relevante encontrado;
- nenhuma alteração de código realizada durante o checkpoint.

---

### C4-03A — Permitir localizar e reabrir projetos existentes

**Status:** ✅ concluído (commit `f66c06a` — `feat(projects): list and reopen existing projects`).

**Origem:** ausência de listagem de projetos existentes e de ação para
reabrir um projeto já criado, contrariando `docs/core/RELEASE_0_SPEC.md`
§4.1 — "Conteúdo obrigatório" exige "área de projetos recentes";
"Ações" exige "abrir projeto existente". Nenhum dos dois está
implementado hoje (a página inicial só oferece criar e importar; o
cabeçalho do projeto só navega entre Agora, Mapa, Registros, Resumo e
Exportar). Classificado como defeito funcional da baseline e bloqueador
de C4-04.

**Resultado esperado (mínimo funcional):**
- exibir na página inicial os projetos persistidos;
- permitir abrir um projeto existente a partir dessa lista;
- oferecer, dentro do workspace de um projeto, um caminho claro de
  retorno à área de projetos;
- preservar integralmente os dados e o projeto atual;
- manter o estado vazio já previsto em §4.1 quando não houver projetos.

**Fora do pacote (explicitamente excluído nesta versão):**
- exclusão ou arquivamento de projeto;
- busca;
- paginação;
- filtros;
- exibição detalhada de status na lista;
- renomeação pela lista;
- redesenho amplo da página inicial.

**Dependência:** C4-03 concluído (achado consolidado).

**Bloqueia:** C4-04 — a ausência desta capacidade é um bloqueador
registrado do gate do Ciclo 4.

**Áreas prováveis (a confirmar em planejamento):** `server/persistence/`
(novo método de listagem no `ProjectRepository`) e `server/application/`
(novo caso de uso) — ambas exigem autorização explícita antes de qualquer
alteração. Rotas (`app/src/routes/+page.server.ts`, `+page.svelte`,
`+layout.svelte` do workspace do projeto) não são áreas protegidas.

**Tipo:** código e testes.

**Evidências:**
- `app/src/lib/server/persistence/project-repository.ts` /
  `sqlite-project-repository.ts`: `ProjectRepository` ganhou
  `listRecent(): Promise<Project[]>`, implementado como uma única leitura
  (`SELECT id, name, created_at FROM project ORDER BY created_at DESC, id
  DESC`, reaproveitando `mapProjectRow`) — nenhuma escrita, nenhuma
  migration, nenhuma mudança de schema; `insert`/`findById`/`save`
  inalterados;
- `app/src/lib/server/application/types.ts` /
  `project-use-cases.ts`: DTO `ProjectListItem` (`projectId`,
  `projectName`, `createdAt`) e caso de uso `listRecentProjects()`, que
  mapeia `Project` → `ProjectListItem` sem calcular status, fase,
  progresso ou próxima ação;
- `app/src/routes/+page.server.ts` / `+page.svelte`: página inicial
  ganhou a seção "Seus projetos" (não "recentes" — ordenação é por
  criação), cada projeto abre por link em `/projects/<id>/now`,
  `projectName: null` aparece como "Projeto sem nome", banco vazio mostra
  mensagem curta preservando o CTA "Criar novo projeto"; `create`/`import`
  inalterados;
- `app/src/routes/projects/[projectId]/+layout.svelte`: link "Projetos"
  na navegação do workspace, apontando para `/`; Agora/Mapa/Registros/
  Resumo/Exportar inalterados;
- `docs/06-architecture/contracts.md`: `listRecent`, `ProjectListItem` e
  `listRecentProjects` documentados; frase antiga sobre "não adicionar
  método de listagem" recontextualizada como específica da checagem de
  colisão de importação; contrato de `importProject`/`import_id_collision`
  preservado sem alteração;
- testes novos: 5 no repositório SQLite (banco vazio, ordenação por
  `createdAt DESC`, desempate por `id DESC`, formato leve sem
  `activityProgress`/`answers`/`pendingItems`, ausência de escrita), 3 no
  caso de uso (DTO correto, projeto sem nome, nenhuma escrita disparada),
  e o teste Playwright dedicado `app/e2e/project-list.journey.ts` (estado
  vazio, criação aparece na lista, dois projetos em ordem determinística,
  abertura pela lista, link "Projetos" retorna, reload preserva a lista,
  criação e importação sem regressão, acesso direto por URL preservado);
- `hydra-verify --mode full --item C4-03A`: PASS, 6/6 etapas (check,
  test:unit, playwright journey, test:e2e, build, git diff --check); QA
  manual aprovada (servidor standalone com banco temporário isolado, sem
  erros de console, sem overflow horizontal em ~1280px/~390px);
- o bloqueador de listagem/reabertura de projetos, registrado no
  checkpoint de dogfooding (C4-03), está resolvido;
- commit `f66c06a996dba492044b21ef95916f9f3afc2f85`.

Fora do escopo desta entrega, deliberadamente não implementados: importação
como cópia, melhoria da mensagem de colisão de importação, exclusão,
arquivamento, busca, filtros, paginação, e a correção do parser de Status
multilinha em `hydra-state.mjs` — todos permanecem registrados como achados
ou limitações separadas, sem virar escopo automático deste item.

---

### C4-04 — Validar a baseline completa do Release 0

**Status:** ✅ concluído (25/07/2026 — verificação técnica e QA manual;
item de verificação, sem commit de código).

**Resultado esperado:** confirmar que a especificação reconciliada, a
jornada existente e a interface de "Pular etapa" funcionam juntas sem
regressão crítica.

**Critérios de aceite:**
- `hydra-verify full` com resultado PASS;
- QA da jornada normal;
- QA da jornada com atividade pulada;
- Mapa, Registros, Resumo, pendências, exportação e importação coerentes;
- nenhuma divergência crítica conhecida entre produto e especificação
  reconciliada;
- nenhum bloqueador crítico encontrado no dogfooding permanece sem
  decisão.

**Dependências:** C4-01, C4-02, C4-03, C4-03A — todas concluídas.

**Tipo:** verificação e QA.

**Evidências:**
- `hydra-verify --mode full --item C4-04`: PASS, 6/6 etapas (check,
  test:unit, playwright journey, test:e2e, build, git diff --check), na
  primeira execução — nenhuma repetição necessária;
- QA manual da jornada normal, conduzida em dois servidores standalone
  com bancos temporários isolados (A e B): criação de projeto, Descoberta
  completa (todas as sete atividades), confirmação do Resumo, avanço
  correto para "Definir usuário principal", Mapa e Registros coerentes,
  exportação em JSON válido, importação bem-sucedida em banco vazio
  (servidor B), reimportação do mesmo arquivo produzindo a colisão
  esperada (`import_id_collision`) sem sobrescrever o projeto existente,
  listagem do projeto importado na página inicial, abertura pela lista,
  link "Projetos" retornando à página inicial, persistência confirmada
  após reload;
- QA manual da jornada com atividade pulada, em projeto isolado: botão
  "Pular etapa" disponível apenas em atividade elegível, consequência
  apresentada no modal, cancelamento sem alteração do projeto,
  confirmação criando a pendência, pendência visível em Agora e
  Registros, próxima ação avançada, atividade pulada não retornando como
  recomendação principal, "Retomar etapa" abrindo a atividade correta,
  resposta resolvendo a pendência, URL retornando à forma canônica
  (sem `?activity`), recomendação normal restaurada, Mapa e Registros
  refletindo o estado final (atividade "Concluída", pendência
  "Resolvida");
- coerência visual e operacional verificada em ~1280px e ~390px (Home e
  workspace): sem overflow horizontal, sem erro de console, nenhuma
  escrita nem alteração em banco ou processo pré-existente — todo banco
  usado foi temporário e removido ao final;
- comparação explícita com `docs/core/RELEASE_0_SPEC.md`: requisitos de
  §4.1 (projetos recentes/abrir existente), §4.9 (workspace principal),
  §5 (comportamento de pular) e §8 (critérios de aceitação do Release 0)
  confirmados nas superfícies exercitadas; nenhuma divergência crítica
  nova encontrada;
- divergências já conhecidas, sem mudança de status: (1) mensagem de
  colisão de importação sem orientação de próximo passo — decidida como
  dificuldade de UX aceita para a baseline atual, adiada como candidata a
  Should de ciclo futuro, não iniciada neste ciclo; (2) "importar como
  cópia" — permanece funcionalidade nova fora do Release 0;
- nenhum bloqueador crítico do dogfooding permanece sem decisão.

## Should

- corrigir bloqueadores ou incoerências concretas encontradas no
  checkpoint de dogfooding (C4-03);
- revisar somente os riscos realmente afetados pelos achados;
- verificar coerência visual da jornada completa, sem iniciar redesign
  amplo.

Itens Should só entram no gate de conclusão se forem efetivamente
iniciados neste ciclo.

## Could

- pequenos ajustes de UX encontrados no dogfooding;
- melhorias de baixo risco que não ampliem o escopo funcional;
- automação simples para facilitar o uso próprio, somente se surgir
  necessidade concreta.

## Fora do ciclo

- testes com usuários externos;
- deploy ou disponibilização por URL;
- Release 1;
- autenticação;
- colaboração;
- múltiplos usuários;
- implementação do Workflow v2 (registro técnico em
  `docs/08-delivery/workflow-v2-design.md`, sem implementação);
- funcionalidades não previstas na baseline reconciliada do Release 0.

## Gate de conclusão do Ciclo 4

Antes de considerar o Ciclo 4 entregue:

- C4-01 concluído e especificação reconciliada;
- C4-02 concluído, com teste dedicado passando;
- C4-03 percorrido pelo menos uma vez, sem exigência de log;
- achados acionáveis do checkpoint classificados (corrigir/backlog/
  adiar/aceitar/descartar);
- C4-04 concluído com `hydra-verify full` PASS;
- jornada normal e jornada com atividade pulada aprovadas por QA;
- nenhuma mudança nas áreas protegidas (`domain/`, `catalog/`,
  `orientation-engine/`, `server/application/`) sem justificativa técnica
  e autorização explícita registradas antes da alteração;
- nenhum bloqueador crítico do dogfooding sem decisão;
- Should e Could só entram no gate quando efetivamente iniciados.

**Resultado do Gate de conclusão do Ciclo 4 — avaliado em 25/07/2026:
✅ APROVADO.**

- C4-01 concluído e especificação reconciliada — ✅;
- C4-02 concluído, com teste dedicado passando — ✅;
- C4-03 percorrido pelo menos uma vez, sem exigência de log — ✅;
- achados acionáveis do checkpoint classificados — ✅ (defeito de
  listagem/reabertura → corrigido em C4-03A; dificuldade de UX na
  mensagem de colisão → aceita/adiada como Should futuro; "importar como
  cópia" → funcionalidade nova fora do Release 0);
- C4-04 concluído com `hydra-verify full` PASS — ✅ (6/6 etapas);
- jornada normal e jornada com atividade pulada aprovadas por QA — ✅;
- nenhuma mudança nas áreas protegidas (`domain/`, `catalog/`,
  `orientation-engine/`, `server/application/`) sem justificativa técnica
  e autorização explícita — ✅ (todas as mudanças do ciclo, incluindo
  C4-03A, foram autorizadas explicitamente antes da alteração);
- nenhum bloqueador crítico do dogfooding sem decisão — ✅;
- Should e Could só entram no gate quando efetivamente iniciados — ✅
  nenhum item Should/Could foi iniciado neste ciclo (a correção da
  mensagem de colisão, cogitada como Should, não chegou a ser iniciada).

**Ciclo 4 concluído.**
