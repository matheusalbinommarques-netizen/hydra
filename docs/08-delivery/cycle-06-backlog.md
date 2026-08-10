# Backlog do Ciclo 6

**Meta:** provar que o Hydra consegue estender a experiência estruturada
para o início da jornada, partindo da Home, fazendo uma atividade
CONSTRUIR objetos estruturados reutilizáveis e permitindo que a atividade
seguinte se RAMIFIQUE a partir do estado real do projeto, sem redigitação
desnecessária.

## Origem

Decorre do dogfooding real do Ciclo 5 (C5-01) e da gramática de produto
registrada em D032 (`docs/07-management/decision-log.md`) — sete
princípios validados (construção estruturada, continuidade, ramificação,
profundidade seletiva, orientação a partir do contexto, explicabilidade,
regra central) e quatro protótipos avaliados no Claude Design, tratados
como referência de mecânica de interação, não de implementação literal.
Este backlog não repete a gramática — consulte D032 para o texto
completo.

O Ciclo 6 é a primeira fatia dessa direção: Home mais as duas primeiras
atividades da Descoberta com protótipo aprovado (`Quem é Afetado.dc.html`,
`Como é Tratado Hoje.dc.html`). Não é uma migração completa da jornada —
ver "Fora de escopo" abaixo.

## Must

### C6-01 — Home

**Status:** ✅ concluído.

**Hipótese:** aplicar a direção de Home já aprovada (etapa 7.2 do
roadmap, refinada por D032) usando somente dados reais já existentes,
sem inventar sinais nem capacidades.

**Evidências:**
- `server/application/types.ts` — `ProjectListItem` ganha `currentPhase`
  (fase atual, `completedActivities`/`totalActivities`, contando só
  `'concluída'`, nunca `'pulada'`), `movementSignal`
  (`'bloqueado' | 'parado' | 'avancando' | undefined`) e `lastMovementAt`,
  nenhum dos três persistido — projeção calculada a cada
  `listRecentProjects()`;
- `server/application/project-use-cases.ts` — sinal calculado a partir dos
  timestamps reais já existentes em `ProjectState` (`Answer.updatedAt`,
  `ScopeItem.updatedAt`, `Impediment.updatedAt`,
  `PendingItem.createdAt`/`resolvedAt`, `ScopeVersion.confirmedAt`);
  prioridade `bloqueado > parado > avancando`; sem nenhuma movimentação
  real, `Project.createdAt` entra só como fallback para medir inatividade
  (nunca gera `avancando`); cálculo mantido fora de
  `phase-progress.ts`/`buildPhaseProgress` para não inverter a direção de
  dependência entre `server/application/` e uma projeção de apresentação;
- `routes/+page.svelte` — bloco "Continue de onde parou" passa a
  selecionar, entre os projetos não concluídos, o de movimentação real
  mais recente (nunca por `createdAt`); lista abaixo filtra o destaque por
  `projectId` antes do `slice(0, 5)` (corrige duplicação que existia
  antes desta entrega); texto "Fase · N de M concluídas" substitui
  qualquer porcentagem/barra; nenhuma tela ou link de Configurações
  globais criado; nenhum sinal de "aguardando alguém";
- `docs/06-architecture/contracts.md` — assinatura de `ProjectListItem`
  atualizada (inclui também `projectStatus`/`nextAction`, que já
  estavam implementados mas não documentados);
- testes: `project-use-cases.spec.ts` — contagem de `completedActivities`
  ignorando `'pulada'`; `avancando` logo após movimento; `parado` aos 7
  dias exatos sem movimento; `bloqueado` com prioridade sobre `parado`
  mesmo com impedimento antigo; rascunho nunca trabalhado sem nenhum
  sinal antes de 7 dias; rascunho nunca trabalhado com 7+ dias de
  `createdAt` vira `parado` sem que `createdAt` entre em
  `lastMovementAt`;
- `hydra-verify --mode fast` final: PASS 3/3 (check, 507 testes
  unitários, `git diff --check`); QA manual em navegador (desktop e
  ~390px) contra dados reais de desenvolvimento, sem erros de console;
- convergência visual (D033, `docs/07-management/decision-log.md`):
  `routes/+page.svelte` reescrita para a nova identidade aprovada no
  Claude Design (`Home.dc.html`) — sidebar global (Home/Projetos/
  Configurações, esta última sem link), topbar decorativa estática (sem
  capacidade real), card "Continue de onde parou" com indicador de
  progresso em 6 fases e texto de apoio da próxima ação
  (`ActivityDefinition.why`, dado real), lista de projetos ordenada por
  urgência de sinal; `server/application/types.ts`/`project-use-cases.ts`
  ganham `nextAction.why`; `routes/+page.server.ts` passa `catalogPhases`
  para o indicador de progresso; `routes/+layout.svelte` adiciona a fonte
  Inter (aditivo, não afeta as demais telas); todo o "cérebro funcional"
  de C6-01 (sinais, prioridade, limiar de 7 dias, seleção do destaque,
  não duplicação) preservado sem alteração; `e2e/project-list.journey.ts`
  atualizado para a nova estrutura.

**Critérios de aceite:**
- bloco "Continue de onde parou" com o projeto em destaque;
- esse projeto não aparece duplicado imediatamente na lista abaixo;
- lista densa, uma linha por projeto;
- cada projeto mostra fase atual e quantidade de atividades concluídas
  naquela fase (ex.: "Descoberta · 3 de 5 concluídas", "Execução · 2 de 6
  concluídas") — nunca porcentagem nem barra de progresso como
  informação principal;
- sinais reais por projeto, só quando sustentados por dado existente:
  bloqueado (via impedimento aberto), parado há X dias (via timestamp já
  existente), avançando;
- "aguardando alguém" NÃO entra nesta fatia — depende de dados
  estruturados de participantes/aprovação que ainda não existem
  (D032, bloco futuro candidato);
- nenhuma tela, link ou capacidade de "Configurações globais" é criada —
  a navegação global Home/Projetos/Configurações prevista na direção
  visual futura não tem hoje uma configuração global real para sustentar;
  Configurações continua exclusiva do shell interno do projeto.

**Fora de escopo desta entrega:** Configurações globais; qualquer sinal
sem dado real que o sustente; redesenho da Biblioteca de projetos ou do
wizard de criação.

**Tipo:** interface, leitura de dados já existentes; sem mudança de
domínio esperada (a confirmar no planejamento do item).

### C6-02 — Mapear grupos afetados

**Hipótese:** `publico` deixa de ser texto livre e passa a criar uma
coleção estruturada de grupos afetados — objetos vivos do projeto,
reutilizáveis pela atividade seguinte sem redigitação.

**Critérios de aceite:**
- coleção de grupos com identidade estável (mesmo espírito de
  `PlanningItem`, C5-01);
- grupo escolhido de um conjunto padrão ou adicionado como customizado;
- severidade/intensidade e frequência por grupo;
- a mecânica segue o comportamento aprovado em
  `Quem é Afetado.dc.html` (seleção estruturada, aprofundamento por
  grupo, resultado como informação estruturada do projeto) sem copiar a
  implementação do protótipo literalmente;
- os objetos resultantes ficam preparados para reutilização por C6-03 e
  por trabalho futuro (D032), sem exigir que essa reutilização já exista
  nesta entrega além do necessário para C6-03.

**Fora de escopo desta entrega:** qualquer uso desses grupos fora de
C6-03; motor de sugestão; entidade própria fora de `Answer` (mesmo
padrão de custo/benefício já usado para `PlanningItem`, a confirmar no
planejamento do item).

**Tipo:** domínio, catálogo, interface, testes.

### C6-03 — Entender estado atual

**Hipótese:** `estado_atual` deixa de ser texto livre e passa a ser a
primeira atividade do produto com ramificação real — o caminho
subsequente muda de fato conforme a resposta inicial — reaproveitando os
grupos de C6-02 sem redigitação.

**Critérios de aceite:**
- pergunta inicial cria ramificação real: existe algo sendo feito/usado
  hoje vs. nada é feito hoje;
- cada caminho segue com perguntas pertinentes apenas àquela situação —
  a escolha inicial altera efetivamente o conjunto de perguntas
  seguintes, não apenas oculta campos de um mesmo formulário;
- informações irrelevantes ao caminho escolhido não são exigidas;
- grupos mapeados em C6-02 reaparecem aqui ("grupos já mapeados na etapa
  anterior") sem nenhuma redigitação de nome;
- captura de custo/responsável/detalhe só quando pertinente ao caminho
  escolhido;
- mecanismos de redução de fadiga (pular pergunta, pular item, limite de
  aprofundamento) preservados quando aplicáveis, no espírito do
  comportamento aprovado em `Como é Tratado Hoje.dc.html`, sem copiar a
  implementação do protótipo literalmente;
- a solução técnica interna para sustentar a ramificação é livre —
  nenhum motor genérico de branching é exigido nem deve ser construído
  antecipadamente para um bloco futuro.

**Fora de escopo desta entrega:** motor genérico de ramificação
reutilizável por outras atividades; síntese/checkpoint automático;
qualquer trabalho de `Organizar quem participa` ou `Identificar riscos
do projeto`.

**Tipo:** domínio, catálogo, interface, testes.

## Fora de escopo do Ciclo 6 (todas as entregas)

- `origem`, `contexto`, `problema` e as demais atividades ainda não
  redesenhadas permanecem exatamente como estão — a jornada continua
  mista ao final deste ciclo, não uma migração completa Home → Estado
  atual;
- nenhuma das 36 atividades do catálogo é alterada em massa;
- Execução não é redesenhada;
- síntese/checkpoint automático não é implementado;
- `Identificar riscos do projeto` não é implementado nem sua entidade de
  domínio é criada nesta rodada;
- nenhuma arquitetura é antecipada para o bloco futuro candidato (ver
  abaixo).

## Próximo bloco candidato (fora deste ciclo, sem compromisso de escopo ou número de ciclo)

Decorrente da direção registrada em D032, sem abrir Ciclo 7 nem comprometer
escopo:

- `Organizar quem participa` é o próximo candidato natural depois deste
  bloco — funde `Identificar partes interessadas`, `Definir papéis e
  responsabilidades` e parte de `Comunicação e governança`, reaproveitando
  os grupos de C6-02;
- `Identificar riscos do projeto` depende dos objetos produzidos por
  `Mapear grupos afetados`, `Entender estado atual` e `Organizar quem
  participa` e será o teste real da orientação contextual (regra 5 de
  D032) — inclusive detecção de ausência cruzando partes diferentes do
  projeto;
- o desenho de domínio de Riscos (registrado como entidade própria, não
  como JSON dentro de `Answer` — risco é um objeto vivo que pode ser
  atualizado, tratado e encerrado) e o mecanismo mínimo de persistir
  rejeição de sugestão (sem promovê-la a entidade, sem motor genérico)
  ainda serão decididos no planejamento específico desse trabalho, não
  neste backlog.

## Gate de conclusão do Ciclo 6

Antes de considerar o Ciclo 6 entregue, além das verificações técnicas
já padrão do fluxo (`hydra-verify full` PASS, nenhuma mudança em áreas
protegidas sem justificativa e autorização explícita registradas antes
da alteração, nenhuma regressão):

- Home usa somente sinais sustentados por dados reais — nenhum sinal
  inventado, em particular nenhuma forma de "aguardando alguém";
- os grupos criados em C6-02 reaparecem em C6-03 sem nenhuma
  redigitação;
- a decisão inicial de C6-03 (existe solução / não existe solução)
  altera efetivamente o caminho subsequente, cada caminho apresenta
  somente perguntas pertinentes à situação escolhida, e informações
  irrelevantes não são exigidas;
- dogfooding real confirma que, em C6-02 e C6-03, o usuário sente que
  está manipulando o projeto, e não preenchendo formulários
  desconectados — os caminhos de C6-03 são percebidos como experiências
  diferentes e coerentes, não como um mesmo formulário com campos
  escondidos.
