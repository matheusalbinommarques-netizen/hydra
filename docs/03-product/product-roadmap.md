# Roadmap do produto Hydra

## Como usar este documento

- `docs/core/` descreve o comportamento atual do produto — o que existe
  hoje, tal como implementado.
- `CHANGELOG.md` registra o que foi entregue, entrega a entrega.
- `PROJECT_STATUS.md` registra onde o trabalho parou e qual é a próxima
  decisão pendente.
- Este roadmap registra a ordem planejada de evolução das capacidades do
  produto.

Ele não é backlog, não é cronograma e não é inventário de commits. Não
detalha requisitos, critérios de aceite nem tarefas — isso é papel do
backlog de cada ciclo, quando aberto. A sequência aqui descrita pode ser
revista após o dogfooding de cada etapa; nenhuma etapa futura está travada
antes de a etapa anterior ser validada em uso real.

## Referências visuais aprovadas

As quatro imagens em `design/approved/` são referências de direção, não
especificação literal a implementar tela por tela:

- `hydra-product-promise.png` — promessa conceitual do produto: o que o
  Hydra propõe ao usuário, em termos de experiência.
- `hydra-target-product-flow.png` — fluxo funcional futuro: como as partes
  do produto se conectam quando a visão estiver mais madura.
- `hydra-methodology-artifacts.png` — repertório metodológico e tailoring
  de longo prazo; não é backlog literal nem lista de artefatos a construir
  um a um.
- `hydra-target-screens.png` — inventário visual da experiência-alvo; não
  é especificação pixel a pixel.

`design/approved/screens/` contém as 16 imagens individuais recortadas
dessa montagem, uma por tela-alvo, usadas como referência de trabalho
pela etapa 7 (ver inventário operacional abaixo). São alvos verificáveis
de estrutura, hierarquia, continuidade, propósito e linguagem visual —
não são especificação pixel-perfect nem inspiração genérica.

Em conflito entre uma dessas referências e a especificação funcional
(`docs/core/`), a especificação prevalece até nova decisão explícita.

## Baseline atual

Disponível na baseline atual, somando o Release 0 validado e os incrementos
posteriores já publicados:

- Home e criação de projeto;
- atividade guiada (uma atividade por vez, com pergunta principal,
  motivo, exemplo e critério de conclusão);
- Agora/Bancada (Descoberta, Definição do produto e Estruturação, com
  documento crescente lateral);
- Mapa da jornada;
- Resumo da descoberta;
- Registros;
- Escolha do próximo foco (montagem de escopo Agora/Depois/Fora);
- Cockpit de impedimentos;
- documento crescente (painel "O que já sabemos") cobrindo Descoberta,
  Definição do produto e Estruturação;
- Documento do projeto (`/document`): visão consolidada somente leitura
  dos mesmos blocos, agrupada por fase, com edição restrita a Descoberta.

## Sequência de evolução

### 1. Documento do Projeto — concluído

Entregue: tela dedicada `/document`, consolidando os blocos já curados da
Bancada em seções por fase (Descoberta, Definição do produto e
Estruturação), com ação de edição disponível apenas para blocos de
Descoberta — mesma limitação de `/now?activity=...&from=summary` já
existente.

### 2. Revisão e confirmação — concluído

Resultado: permitir julgamento explícito do usuário antes de avançar de
fase, com base em sinais que o produto já é capaz de calcular.

Entregue: primeira versão em `/summary` reunindo checklist de completude,
pendências abertas de Descoberta, `criteriaScopeConflict` já existente e
confirmação explícita persistida por `ActivityProgress`.

Fora (mantido fora nesta versão):

- motor genérico de inconsistências;
- impactos inferidos sem regra explícita;
- IA.

### 3. Diagnóstico e rota recomendada — concluído

Resultado: adaptar a jornada ao estado e ao contexto real de cada projeto,
em vez de aplicar sempre a mesma sequência fixa de atividades.

Entregue, em duas fatias:

- ponto de partida explícito da rota em `/map` (`Project.routeStartPhaseId`,
  D023, `docs/07-management/decision-log.md`) — `/now` passa a calcular a
  próxima ação dentro da rota escolhida; percurso completo sempre
  disponível;
- diagnóstico de rota assistido por cinco respostas estruturadas do
  usuário (uma por fase, Descoberta a Execução), recomendando
  deterministicamente a primeira estrutura ainda ausente ou, se todas
  confirmadas, "Validação e encerramento" (D024,
  `docs/07-management/decision-log.md`); recomendação transitória,
  aplicada pelo mesmo mecanismo de D023, sempre substituível pelo seletor
  manual.

Fora (mantido fora nesta versão — permanecem para decisão futura, quando/se
necessários): classificação/tipos de projeto, aplicabilidade por
atividade, status "não aplicável", diagnóstico automático derivado do
estado persistido, IA.

### 4. Entregas e backlog estruturados — concluído

Resultado: transformar planejamento em trabalho executável e rastreável.

Entregue: itens de escopo do bucket "agora" passam a formar o primeiro
backlog executável, com acompanhamento de execução em três estados (`a
fazer`/`em andamento`/`concluído`, `ScopeItem.executionStatus`), editável
em `/next-version/confirmed` (superfície provisória, sem rota nova); o
status é independente da confirmação do escopo — alterá-lo não invalida
nem depende de uma nova confirmação, só exige que a versão já esteja
confirmada (D025, `docs/07-management/decision-log.md`). Sem entidade de
tarefa, subtarefas, responsáveis, prazos, dependências ou Kanban nesta
primeira versão.

### 5. Execução e acompanhamento — concluído

Resultado: acompanhar trabalho real sem competir em profundidade com
Jira, Trello ou Linear.

Entregue: superfície operacional dedicada "Entregas" (`/deliveries`),
acessível pela navegação do workspace, agrupando os itens confirmados em
"Agora" pelos três estados de execução já existentes
(`ScopeItem.executionStatus`, D025), com contagem por grupo e a mesma
ação de mudança de status já usada em `/next-version/confirmed`, que
continua funcionando sem alteração; nenhum campo, entidade ou schema
novo.

### 6. Resultados, adaptação e encerramento — concluído

Resultado: medir, adaptar, aceitar e encerrar com evidências.

Concluída por reconciliação: o resultado já é atendido pela fase
`validacao` do catálogo (`app/src/lib/catalog/closure.ts`) e pela
infraestrutura genérica existente — seis atividades (validar entregas e
critérios de aceitação, coletar feedback, resolver pendências finais,
registrar lições aprendidas, definir transição e próximos passos,
confirmar encerramento do projeto) acessíveis pela jornada normal, com
confirmação final obrigatória e não pulável; `computeProjectStatus`
resulta em `concluído`; evidências consultáveis em `/records`, estado das
atividades consultável em `/map`, mensagem final de conclusão em `/now`.
Nenhuma mudança de código foi necessária.

### 7. Convergência da experiência e das telas — em andamento

Durante esta etapa, este roadmap é também o backlog operacional da
convergência visual e de experiência. Ele define quais telas precisam ser
convergidas, em qual ordem, qual imagem individual representa cada uma,
qual superfície atual corresponde ao alvo, quando uma tela pode ser
considerada convergida e quando a etapa inteira pode ser encerrada.

#### 7 — Objetivo

Convergência significa equivalência substancial entre a superfície atual
e a referência aprovada em:

- estrutura da tela;
- hierarquia da informação;
- clareza da ação principal;
- continuidade da jornada;
- linguagem visual;
- estados relevantes;
- propósito da superfície;
- acessibilidade básica;
- preservação das mecânicas existentes.

Não significa reprodução pixel-perfect dos mockups.

#### Regras de interpretação

- cada mockup em `design/approved/screens/` é um alvo verificável de
  estrutura, hierarquia, continuidade, propósito e linguagem visual — não
  é inspiração genérica nem especificação pixel a pixel;
- não se cria capacidade de domínio apenas porque ela aparece ilustrada
  em um mockup;
- não se cria rota separada quando uma rota atual já comporta o estado
  ilustrado;
- nomes, métricas, datas, textos e projetos ilustrativos dos mockups não
  viram requisitos funcionais;
- capacidades atuais não são removidas apenas por não aparecerem em um
  mockup;
- telas podem ser combinadas, adiadas ou declaradas não aplicáveis,
  quando justificado;
- duplicações ou lacunas na numeração da montagem original
  (`hydra-target-screens.png`) não representam telas escondidas — a
  segunda tela numerada como 16 na montagem foi registrada como 17
  (`17-transicao-e-adocao.png`) apenas para manter nomes de arquivo
  únicos;
- Documento do projeto não possui painel individual nessa montagem; até
  existir uma imagem individual específica, usa como referência a
  montagem geral e a visão aprovada do produto
  (`hydra-target-screens.png`, `hydra-product-promise.png`).

#### Situações permitidas

Cada tela do inventário abaixo usa exatamente uma destas situações:

- `não auditada` — ainda não comparada com a referência;
- `em convergência` — comparação e ajustes em andamento ou parcialmente
  entregues;
- `convergida` — atende ao critério de tela convergida (ver abaixo);
- `combinada com outra superfície` — o alvo é atendido por uma superfície
  que também cobre outra tela do inventário;
- `adiada` — fora do escopo imediato da etapa 7, por decisão registrada;
- `não aplicável` — o alvo não corresponde a uma capacidade que o produto
  deva ter.

Uma tela não é declarada `convergida` apenas porque uma microfatia
relacionada já foi entregue — a fatia precisa atender integralmente ao
critério de convergência.

#### Inventário operacional

| Bloco | Tela-alvo | Referência visual | Superfície atual | Situação | Decisão |
| --- | --- | --- | --- | --- | --- |
| 7.2 | 1. Home — Seus projetos | `design/approved/screens/01-home-seus-projetos.png` | `/` | convergida | aprovada visualmente (desktop e mobile) contra o artefato individual do Claude Design; sem usuário/avatar, Configurações, progresso, data de atualização ou painel de tipos fictícios (diferenças intencionais aprovadas) |
| 7.2 | 2. Biblioteca de projetos | `design/approved/screens/02-biblioteca-de-projetos.png` | `/projects` | convergida | implementada como rota própria (busca, filtro por estado com contagem, lista completa); continuidade resolvida por navegação global explícita: símbolo/wordmark Hydra → Home (`/`), item "Projetos" → Biblioteca (`/projects`), `← Projetos` do workspace → Biblioteca |
| 7.2 | 3. Nova iniciativa | `design/approved/screens/03-nova-iniciativa.png` | `/projects/new` | convergida | virou superfície própria: wizard de 4 passos (ponto de partida, rota recomendada, nome provisório, revisão) reaproveitando o diagnóstico assistido e `routeStartPhaseId` já existentes; criação atômica via `createConfiguredProject`; tipos de iniciativa do mockup ficam fora do Release 0 (sem efeito ou persistência real); aprovada visualmente por Matheus (desktop e ~390px) contra o artefato individual do Claude Design |
| 7.2 | 4. Modelos de jornada | `design/approved/screens/04-modelos-de-jornada.png` | inexistente | adiada | horizonte posterior de Tailoring metodológico |
| 7.3 | 5. Agora | `design/approved/screens/06-agora.png` | `/projects/[projectId]/now` | em convergência | — |
| 7.3 | 6. Atividade guiada | `design/approved/screens/07-atividade-guiada.png` | estado da rota `/now` | em convergência | preservar rota compartilhada, salvo necessidade concreta |
| 7.3 | 7. Jornada | `design/approved/screens/08-jornada.png` | `/projects/[projectId]/map` | em convergência | — |
| 7.3 | 8. Documento do projeto | ausente na montagem; usar montagem geral e visão aprovada do produto | `/projects/[projectId]/document` | não auditada | convergir sem inventar uma imagem inexistente |
| 7.3 | 9. Revisão e confirmação | `design/approved/screens/10-revisao-e-confirmacao.png` | `/projects/[projectId]/summary` | não auditada | — |
| 7.4 | 10. Entregas | `design/approved/screens/11-entregas.png` | `/projects/[projectId]/deliveries` | não auditada | — |
| 7.4 | 11. Cockpit | `design/approved/screens/12-cockpit.png` | `/projects/[projectId]/cockpit` | não auditada | — |
| 7.4 | 12. Detalhe de item de atenção | `design/approved/screens/13-detalhe-item-atencao.png` | inexistente ou parcial, confirmar | não auditada | criar somente se sustentado pela mecânica existente |
| 7.4 | 13. Registros | `design/approved/screens/14-registros.png` | `/projects/[projectId]/records` | não auditada | — |
| 7.5 | 14. Resultados e benefícios | `design/approved/screens/16-resultados-e-beneficios.png` | respostas persistidas de encerramento | não auditada | decidir composição antes de criar rota |
| 7.5 | 15. Transição e adoção | `design/approved/screens/17-transicao-e-adocao.png` | respostas persistidas de encerramento | não auditada | decidir composição antes de criar rota |
| 7.5 | 16. Encerramento e aprendizado | `design/approved/screens/18-encerramento-e-aprendizado.png` | `/now`, `/map` e `/records` | não auditada | decidir se será superfície própria ou composição existente |
| 7.6 | 17. Configurações do projeto | `design/approved/screens/19-configuracoes-do-projeto.png` | inexistente ou parcial | não auditada | implementar somente capacidades sustentadas pelo domínio |
| 7.6 | 18. Exportar | ausente na montagem | `/projects/[projectId]/export` | não auditada | preservar capacidade e convergir visualmente |

#### Critério de tela convergida

Uma tela só recebe a situação `convergida` quando atender a todos os
pontos abaixo:

1. estrutura substancialmente equivalente à referência;
2. hierarquia da informação correta;
3. ação principal clara;
4. continuidade de entrada e saída preservada;
5. linguagem visual coerente com a identidade papel/tinta/grafite;
6. estados relevantes tratados (vazio, erro, carregando, concluído,
   quando aplicável);
7. acessibilidade básica preservada;
8. mecânicas funcionais preservadas.

#### Sequência da etapa 7

##### 7.0 — Estruturar a convergência

Resultado: roadmap operacional; imagens individuais aprovadas;
inventário; ordem; critérios; gates.

Gate: todas as telas inventariadas; referências associadas; sequência
definida; próxima subetapa clara.

Esta entrega conclui 7.0.

##### 7.1 — Fundação visual e shell — concluído

Resultado: definir e aplicar base compartilhada de tipografia,
espaçamento, largura, navegação, cabeçalhos, cards, botões, campos,
estados e linguagem papel/tinta/grafite. Não redesenhar todas as telas
dentro desta subetapa.

Gate: base compartilhada explícita; componentes e tokens atuais
auditados; divergências estruturais do shell resolvidas; telas
posteriores podem convergir sem repetir estilos localmente.

Esta entrega conclui 7.1: tokens de cor, espaçamento, tipografia, raio e
elevação definidos em `app.css`; shell do workspace (cabeçalho/navegação,
compartilhado por toda tela de projeto) e cabeçalho da Home usando essa
fundação; `UX_DESIGN_SPEC.md` reconciliado com a paleta papel/tinta/
grafite. Padrão visual de campo de formulário e de superfície agrupadora
(card) ficam para quando as telas que os usam forem convergidas em 7.2 e
seguintes, por decisão explícita de não manter 7.1 aberta por
refinamentos tratáveis durante a convergência das telas.

##### 7.2 — Entrada e organização global — concluído

Ordem: 1. Home; 2. Biblioteca; 3. Nova iniciativa; 4. decisão sobre
Modelos.

Gate: entrada e retomada coerentes; organização de projetos definida;
criação de iniciativa resolvida; Modelos explicitamente implementado ou
adiado.

Gate atendido: Home e Biblioteca de projetos `convergida`; Nova
iniciativa `convergida` como superfície própria (`/projects/new`); Modelos
de jornada `adiada` para o horizonte posterior de Tailoring metodológico.
As quatro telas do bloco 7.2 têm decisão explícita — subetapa concluída.

##### 7.3 — Jornada guiada

Ordem: 1. Agora; 2. Atividade guiada; 3. Jornada; 4. Documento; 5.
Revisão e confirmação.

Gate: usuário entende onde está; sabe a próxima ação; responde
atividades; acompanha a jornada; consulta o artefato crescente; revisa e
confirma decisões.

##### 7.4 — Execução e controle

Ordem: 1. Entregas; 2. Cockpit; 3. decisão sobre Detalhe de item; 4.
Registros.

Gate: trabalho real acompanhável; atenções e impedimentos claros;
histórico compreensível; sem competir em profundidade com Jira ou
Linear.

##### 7.5 — Resultados e encerramento

Ordem: 1. Resultados e benefícios; 2. Transição e adoção; 3. Encerramento
e aprendizado.

Antes de implementar, decidir se serão rotas próprias, seções de uma
experiência final, extensões do Documento do projeto, ou composição de
superfícies existentes.

Gate: resultados e benefícios visíveis; transição e próximos passos
claros; encerramento coerente e consultável.

##### 7.6 — Complementos

Inclui: Configurações do projeto; Exportar; estados vazios; erros
relevantes; projeto concluído; largura reduzida.

Gate: superfícies complementares coerentes; nenhuma configuração
fictícia; estados principais tratados; exportação preservada.

##### 7.7 — Revisão final

Resultado: comparação integral AS-IS × TO-BE; correções de consistência;
jornada ponta a ponta; aceite final da etapa.

Gate: todas as telas com decisão explícita; telas do escopo imediato
convergidas; telas adiadas justificadas; jornada principal funcional;
referências e produto comparados; roadmap, PROJECT_STATUS e código
coerentes.

#### Fatias preparatórias já entregues

Estas entregas ajudaram a etapa 7, mas não convergiram nenhuma tela
completa segundo o critério acima:

1. estado ativo da navegação;
2. bloco "Onde estamos" em Agora;
3. continuidade Mapa → Agora;
4. orientação por projeto na Home.

#### Roadmap como backlog

Durante a etapa 7, este roadmap é também o backlog operacional. O
`/hydra-next` deverá futuramente: localizar a subetapa atual; escolher a
primeira tela não convergida da ordem; comparar somente sua imagem
individual com a superfície atual; não procurar aleatoriamente outra
microfatia fora da sequência; parar em caso de bloqueio ou divergência.
Esta entrega não altera a skill.

## Horizonte posterior — Tailoring metodológico e modelos

Resultado: ativar profundidade e artefatos proporcionais a cada projeto.

- Não significa implementar dezenas de documentos independentes.
- Depende de sinais de contexto, aplicabilidade e profundidade variável —
  não de uma lista fixa de templates.
- É horizonte de longo prazo, não uma etapa imediatamente seguinte às
  demais.

## Exclusões atuais

Manter fora do produto por ora:

- IA;
- autenticação;
- colaboração;
- integrações externas;
- finanças avançadas;
- notificações;
- quadro genérico completo (estilo Kanban livre);
- implementação literal de todos os artefatos sugeridos pelas imagens de
  referência.

## Regra de avanço

1. Escolher apenas a próxima etapa da sequência acima — nunca mais de
   uma por vez.
2. Investigar a menor fatia funcional que entrega valor observável dessa
   etapa.
3. Implementar.
4. Validar por dogfooding, em uso real.
5. Atualizar este roadmap somente ao concluir a etapa ou ao decidir mudar
   sua direção.
6. Não detalhar etapas futuras como backlog antes de elas chegarem — a
   descrição de cada etapa neste documento permanece no nível de
   resultado, não de tarefa.
