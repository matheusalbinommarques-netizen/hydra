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

### C6-02 e C6-03 — cortados (10/08/2026)

C6-02 ("Mapear grupos afetados") e C6-03 ("Entender estado atual") foram
planejados com apoio do ChatGPT antes de qualquer implementação e foram
cortados a pedido explícito de Matheus: a partir de 10/08/2026, a direção
do trabalho seguinte deixa de ser pré-planejada em lote — passa a ser
dada diretamente por Matheus, ao vivo, usando o produto. Nenhum código
foi escrito para C6-02/C6-03. Se esse mesmo objetivo (grupos afetados
estruturados, ramificação por estado atual) voltar a ser priorizado, será
replanejado do zero, sem reaproveitar as hipóteses/critérios de aceite
descritos aqui antes do corte — consulte o histórico do Git se precisar
do texto original.

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

## Gate de conclusão do Ciclo 6

Com C6-02 e C6-03 cortados (ver seção acima), o Ciclo 6 encerra-se com
apenas C6-01 entregue. Gate atendido:

- `hydra-verify fast` final de C6-01: PASS (ver evidências de C6-01
  acima); nenhuma mudança em área protegida sem autorização; nenhuma
  regressão;
- Home usa somente sinais sustentados por dados reais — nenhum sinal
  inventado, em particular nenhuma forma de "aguardando alguém".

`Organizar quem participa` e `Identificar riscos do projeto`, antes
registrados como "próximo bloco candidato" em D032
(`docs/07-management/decision-log.md`), deixam de ser um plano em
espera — a próxima direção real será dada por Matheus ao vivo, sem
backlog pré-planejado (ver `PROJECT_STATUS.md`, "Próxima decisão
relevante").
