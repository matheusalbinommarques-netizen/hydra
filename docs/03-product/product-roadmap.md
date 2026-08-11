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
- Acompanhamento de impedimentos;
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

### 7. Convergência da experiência e das telas — concluído

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
| 7.3 | 5. Agora | `design/approved/screens/06-agora.png` | `/projects/[projectId]/now` | convergida | painel "Progresso da fase" (contagem de resolvidas, agrupamento concluídas/atual/pendentes/puladas) reaproveitando `buildPhaseActivities`/`buildPhaseProgress`, compartilhados com o Mapa; layout de duas colunas passa a valer em todas as fases (Bancada some do lado abaixo, só quando aplicável); navegação mobile do shell (menu com os 8 destinos) resolvida como parte desta entrega, por afetar todas as rotas; aprovada funcional e visualmente por Matheus |
| 7.3 | 6. Atividade guiada | `design/approved/screens/07-atividade-guiada.png` | estado da rota `/now` | combinada com outra superfície | Combinada com Agora: a atividade atual permanece apresentada e respondida em `/projects/[projectId]/now`, com pergunta, explicação, exemplo, campos, salvamento e opção de pular, sem rota própria. |
| 7.3 | 7. Jornada | `design/approved/screens/08-jornada.png` | `/projects/[projectId]/map` | convergida | implementada a partir do componente final aprovado no Claude Design ("Jornada — Hydra"); a Jornada passa a ser o conteúdo dominante de `/map` (rota e destino do shell continuam chamados Mapa); fases numeradas pela posição real do catálogo, fase e atividade atuais com destaque visual; atividades usam só os quatro estados reais (Concluída/Atual/Pendente/Pulada), com legenda coerente; único CTA "Continuar em Agora"; Diagnóstico da rota e "Onde este projeto começa" preservados dentro do bloco recolhível "Diagnóstico e ponto de partida" (inicia fechado, sem alterar formulários, ações ou mensagens); nenhuma mecânica, estado ou regra de domínio alterada; aprovada em desktop e mobile |
| 7.3 | 8. Documento do projeto | ausente na montagem; usada a montagem geral e a visão aprovada do produto, mais o componente final aprovado no Claude Design | `/projects/[projectId]/document` | convergida | passa a funcionar como artefato documental contínuo e crescente: uma única superfície documental (não mais cartões independentes), fases como seções numeradas, atividades como subseções separadas por divisores discretos, respostas em fluxo documental sem truncamento, tags reais preservadas como metadados; ações "Editar" discretas com destinos já existentes preservados; único CTA "Continuar em Agora"; estado vazio convergido; nenhuma edição inline, nova rota, consulta, entidade ou regra de domínio criada — reaproveita integralmente `document-view.ts`; aprovada em desktop e mobile |
| 7.3 | 9. Revisão e confirmação | `design/approved/screens/10-revisao-e-confirmacao.png` | `/projects/[projectId]/summary` | convergida | permanece exclusiva da Descoberta no Release 0 (sem generalização por fase, sem novo `completionMode`); passa a funcionar como checkpoint formal em uma única superfície, com contexto explícito "Fase 1 — Descoberta"; decisões principais (Problema, Público afetado, Estado atual, Resultado desejado) reunidas no "Resumo da fase" numa grade explícita (marcador/conteúdo/ação) com eixo de alinhamento consistente entre marcador, título, resposta, tags e link "Editar"; respostas completas continuam recolhíveis; "Pontos de atenção" usa somente `criteriaScopeConflict` e `discoveryOpenPendingItems`, com estado vazio explícito quando nenhum sinal existe; "Conferência" usa somente o checklist real já existente; links `Editar` preservam destino e rótulo acessível; "Voltar para edição" leva a `/now`; ação principal "Confirmar e avançar" usa a action `?/confirm` já existente, sem etapa nova; destino do shell continua chamado "Resumo"; aprovada em desktop e mobile por Matheus contra o artefato individual do Claude Design |
| 7.4 | 10. Entregas | `design/approved/screens/11-entregas.png` | `/projects/[projectId]/deliveries` | convergida | referência de `11-entregas.png` tratada como não vinculante no conteúdo funcional (sprints/tempo de ciclo/erros de produção sem sustentação no domínio) — usada só como linguagem visual/composição, validada via proposta própria no Claude Design (desktop e mobile); estrutura de três grupos (A fazer/Em andamento/Concluído) mantida; card como elemento delimitado principal, coluna como superfície agrupadora discreta, bordas suavizadas; nenhuma mudança de domínio, projeção ou action |
| 7.4 | 11. Acompanhamento (ex-Cockpit) | `design/approved/screens/12-cockpit.png` | `/projects/[projectId]/tracking` | convergida | referência tratada como não vinculante na maior parte dos tiles (riscos ativos, mudanças em análise, decisões pendentes, marcos do projeto, pessoas envolvidas não têm sustentação no domínio) — usada só como hierarquia e composição; convergência consolida, com dados já existentes, situação atual (fase/atividade/progresso), síntese de Entregas e atenções reais (impedimentos e pendências abertas), preservando integralmente a gestão de impedimentos; rota migrada de `/cockpit` para `/tracking`, sem redirect (D026, `docs/07-management/decision-log.md`) |
| 7.4 | 12. Detalhe de item de atenção | `design/approved/screens/13-detalhe-item-atencao.png` | Acompanhamento (`/tracking`, impedimentos) e Agora (`/now`, pendências) | combinada com outra superfície | decisão documental (D027, `docs/07-management/decision-log.md`): sem rota dedicada — impedimentos já têm gestão completa em Acompanhamento, pendências já encaminham para Agora; campos do mockup (responsável, evidência, estado de validação, beneficiário) não têm sustentação no domínio atual |
| 7.4 | 13. Registros | `design/approved/screens/14-registros.png` | `/projects/[projectId]/records` | convergida | classificada como superfície própria reduzida (D028, `docs/07-management/decision-log.md`) — a redução é nos tipos de conteúdo, não nas fases: índice determinístico das fases com resposta, respostas de todas as fases por fase/atividade/campo, pendências resolvidas como histórico exclusivo; pendências abertas removidas (já cobertas por Acompanhamento e Agora); as seis categorias ilustrativas do mockup (Escopo confirmado, Em construção, Hipóteses, Lacunas, Ambiguidade, Entrega) não têm sustentação no domínio e não viraram requisitos; revisão de atividade concluída da Descoberta a partir de Registros usa origem própria (`from=records`), com retorno correto a Registros, preservando integralmente a origem equivalente do Resumo (`from=summary`) |
| 7.5 | 14. Resultados e benefícios | `design/approved/screens/16-resultados-e-beneficios.png` | `/projects/[projectId]/closure` | combinada com outra superfície | implementada como a primeira seção da superfície própria "Resultados e encerramento" (D029, `docs/07-management/decision-log.md`), usando `validar_entregas_criterios` e `coletar_feedback`; tabela Antes/Meta/Atual e métricas quantitativas do mockup sem sustentação no domínio, não implementadas |
| 7.5 | 15. Transição e adoção | `design/approved/screens/17-transicao-e-adocao.png` | `/projects/[projectId]/closure` | combinada com outra superfície | implementada como a segunda seção da mesma superfície própria (D029, `docs/07-management/decision-log.md`), usando `transicao_proximos_passos`; checklist de adoção com status, datas e "Marcar como iniciada" do mockup sem sustentação no domínio, não implementados |
| 7.5 | 16. Encerramento e aprendizado | `design/approved/screens/18-encerramento-e-aprendizado.png` | `/projects/[projectId]/closure` | convergida | superfície própria resultante do bloco — "Resultados e encerramento" (D029, `docs/07-management/decision-log.md`) —, com três seções (Resultados e benefícios, Transição e adoção, Encerramento e aprendizado como terceira seção), usando `resolver_pendencias_finais`, `licoes_aprendidas` e `confirmar_encerramento`; continuidade contextual para Agora (etapa atual ou etapas anteriores, conforme a próxima ação real) e mensagem de conclusão da etapa sem novo status formal de projeto; contadores estruturados e subdivisão de lições do mockup sem sustentação no domínio, não implementados; estado "Indisponível" não implementado por não haver, na arquitetura atual, um ponto de falha isolado e real para uma rota que só recombina dados já carregados pelo layout do workspace |
| 7.6 | 17. Configurações do projeto | `design/approved/screens/19-configuracoes-do-projeto.png` | `/projects/[projectId]/settings` | convergida | composição aprovada e implementada (D030, `docs/07-management/decision-log.md`): superfície própria reduzida `/projects/[projectId]/settings` ("Configurações"), última posição da navegação do workspace, depois de Exportar; escopo entregue — nome do projeto editável, renomeação via `renameProject` já existente, data de criação somente leitura, "Salvar alterações", "Cancelar" (sem chamada ao servidor) e link secundário para Exportar; nenhuma expansão de domínio ou persistência foi necessária; descrição, responsável, estado editável, classificação e tipo, regras de orientação, duplicar/arquivar/excluir permanecem adiados ou não aplicáveis ao Release 0, por falta de sustentação no domínio atual |
| 7.6 | 18. Exportar | ausente na montagem | `/projects/[projectId]/export` | convergida | composição aprovada e implementada (D031, `docs/07-management/decision-log.md`): superfície própria em `/projects/[projectId]/export` ("Exportar projeto"), mesma posição já usada no shell e no link de Configurações, com explicação breve do conteúdo exportado e ação principal única "Baixar exportação"; download efetivo movido para um endpoint próprio `/projects/[projectId]/export/download`, coexistindo com a página na mesma rota por negociação de conteúdo do SvelteKit; `+server.ts` legado em `/export` (`GET`) preservado sem alteração de contrato, para compatibilidade com requisições não HTML; construção da resposta compartilhada entre os dois endpoints por um helper local único, sem duplicar a regra de nome de arquivo, headers ou conteúdo; nenhuma mudança no use case `exportProject` nem no formato/conteúdo do JSON; nome real do arquivo exibido na página, calculado pela mesma regra do endpoint; sem importação, escolha de formato, opções avançadas, histórico, agendamento, compartilhamento ou métricas; sem estado visual próprio de "Projeto não encontrado" nesta fatia — tratamento de erro permanece no layout pai e no `+server.ts` já existentes |

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

Concluída. Agora `convergida`; Atividade guiada `combinada com outra
superfície` (Agora), sem rota própria de execução; Jornada `convergida`
— `/projects/[projectId]/map` passa a apresentar a Jornada do artefato
aprovado como conteúdo dominante, preservando integralmente Diagnóstico
da rota e ponto de partida (agora recolhidos) e a mecânica de
fases/atividades já existente. Documento do projeto `convergida` —
`/projects/[projectId]/document` passa a funcionar como artefato
documental contínuo e crescente, a partir do componente final aprovado no
Claude Design: superfície documental única (fases como seções, atividades
como subseções, respostas em fluxo documental, tags como metadados),
ações "Editar" discretas com destinos preservados, único CTA "Continuar
em Agora", estado vazio convergido; nenhuma edição inline, nova rota,
consulta, entidade ou regra de domínio criada. Revisão e confirmação
`convergida` — `/projects/[projectId]/summary` permanece exclusiva da
Descoberta no Release 0 (sem generalização por fase, sem novo
`completionMode`), agora como checkpoint formal em uma única superfície,
com contexto explícito "Fase 1 — Descoberta"; decisões principais no
"Resumo da fase" com alinhamento consistente entre marcador, título,
resposta, tags e ação "Editar" (grade explícita marcador/conteúdo/ação);
respostas completas continuam recolhíveis; "Pontos de atenção" usa
somente `criteriaScopeConflict` e `discoveryOpenPendingItems`, com estado
vazio quando nenhum sinal existe; "Conferência" usa somente o checklist
real; "Voltar para edição" leva a `/now`; ação principal "Confirmar e
avançar" usa a action `?/confirm` já existente; destino do shell continua
chamado "Resumo"; aprovada em desktop e mobile.

Gate atendido: usuário entende onde está (bloco "Onde estamos" em Agora e
no Mapa); sabe a próxima ação (Agora); responde atividades (Agora,
combinando Atividade guiada); acompanha a jornada (Mapa); consulta o
artefato crescente (Documento do projeto); revisa e confirma as decisões
da Descoberta (Revisão e confirmação). Todos os cinco alvos da ordem
1–5 têm decisão explícita — **subetapa 7.3 concluída.**

##### 7.4 — Execução e controle

Ordem: 1. Entregas; 2. Acompanhamento; 3. decisão sobre Detalhe de item; 4.
Registros.

Gate: trabalho real acompanhável; atenções e impedimentos claros;
histórico compreensível; sem competir em profundidade com Jira ou
Linear.

Entregas `convergida` — primeiro alvo da ordem, concluído.
Acompanhamento (`/tracking`) `convergida` — segundo alvo da ordem,
concluído: nome "Cockpit" abandonado definitivamente (título
"Acompanhamento do projeto", slug `tracking`), rota migrada de `/cockpit`
sem redirect (D026, `docs/07-management/decision-log.md`); superfície
consolida situação atual, síntese de Entregas e atenções reais
(impedimentos e pendências abertas) com dados já existentes, preservando
integralmente a gestão de impedimentos. Decisão sobre Detalhe de item de
atenção concluída — terceiro alvo da ordem: classificada como `combinada
com outra superfície` (D027, `docs/07-management/decision-log.md`), sem
rota dedicada; impedimentos permanecem geridos em Acompanhamento,
pendências em Agora; decisão exclusivamente documental, sem mudança de
domínio, rota ou superfície. Registros (`/records`) `convergida` — quarto
e último alvo da ordem, concluído: classificada como superfície própria
reduzida (D028, `docs/07-management/decision-log.md`) — a redução ocorre
nos tipos de conteúdo, não nas fases; índice determinístico das fases com
resposta, respostas de todas as fases por fase/atividade/campo, e
pendências resolvidas como histórico exclusivo; pendências abertas
removidas desta superfície, já cobertas por Acompanhamento e por Agora;
as seis categorias ilustrativas do mockup (Escopo confirmado, Em
construção, Hipóteses, Lacunas, Ambiguidade, Entrega) não têm sustentação
no domínio e não viraram requisitos; revisão de atividade concluída da
Descoberta a partir de Registros usa origem própria (`from=records`), com
retorno correto a Registros ao salvar; a origem equivalente já existente
a partir do Resumo (`from=summary`) permanece integralmente preservada.

Gate atendido: trabalho real acompanhável (Entregas, Acompanhamento);
atenções e impedimentos claros (Acompanhamento, Agora); histórico
compreensível (Registros); sem competir em profundidade com Jira ou
Linear — nenhuma das quatro posições da ordem introduziu gestão de
tarefas, dependências, métricas ou dashboards. Com os quatro alvos da
ordem 1–4 decididos (Entregas, Acompanhamento, decisão sobre Detalhe de
item, Registros), **subetapa 7.4 concluída.**

##### 7.5 — Resultados e encerramento

Ordem: 1. Resultados e benefícios; 2. Transição e adoção; 3. Encerramento
e aprendizado.

Composição aprovada (D029, `docs/07-management/decision-log.md`): as três
posições da ordem convergem como uma única superfície própria,
`/projects/[projectId]/closure` ("Resultados e encerramento"), com três
seções internas na mesma ordem — não três rotas distintas. Resultados e
benefícios e Transição e adoção são `combinada com outra superfície` (a
própria superfície resultante); Encerramento e aprendizado converge como
a superfície própria. Sustentação exclusiva nas seis atividades já
existentes da fase `validacao` (`app/src/lib/catalog/closure.ts`); sem
campo, entidade, contador, checklist, percentual, data ou responsável
novo; Documento do projeto não foi estendido nesta subetapa.

Implementada: navegação "Encerramento" adicionada ao shell do workspace,
entre Documento e Exportar; cada seção mostra as atividades reais
correspondentes com estado (Ainda não iniciada/Em andamento/Concluída/
Atividade pulada) e respostas já registradas, com "Ainda não registrado"
para campo vazio; bloco de continuidade contextual — aponta para a
própria etapa de encerramento quando ela é a próxima ação real, ou para
etapas anteriores quando ainda não concluídas; ao ficarem todas as seis
atividades em estado terminal, o bloco de continuidade dá lugar a uma
mensagem de conclusão da etapa, sem novo status formal de projeto; link
secundário para Registros. Estado "Indisponível" não implementado — sem
sustentação: nenhuma rota do workspace, incluindo esta, tem hoje um ponto
de falha isolado e independente do carregamento já resolvido pelo layout
do projeto; tratado como não vinculante nesta fatia, no mesmo espírito já
aplicado a métricas/checklists/contadores dos mockups de referência.

Gate: resultados e benefícios visíveis; transição e próximos passos
claros; encerramento coerente e consultável.

Gate atendido: resultados e benefícios visíveis (seção "Resultados e
benefícios", `validar_entregas_criterios`/`coletar_feedback`); transição e
próximos passos claros (seção "Transição e adoção",
`transicao_proximos_passos`); encerramento coerente e consultável (seção
"Encerramento e aprendizado", continuidade contextual e mensagem de
conclusão da etapa). Com os três alvos da ordem decididos e implementados,
**subetapa 7.5 concluída** — próxima subetapa é 7.6 (Complementos:
Configurações do projeto, Exportar, estados vazios, erros relevantes,
projeto concluído, largura reduzida), ainda não iniciada.

##### 7.6 — Complementos — concluído

Inclui: Configurações do projeto; Exportar; estados vazios; erros
relevantes; projeto concluído; largura reduzida.

Gate: superfícies complementares coerentes; nenhuma configuração
fictícia; estados principais tratados; exportação preservada.

Gate atendido: Configurações e Exportar `convergida`; estados vazios,
erros relevantes, projeto concluído e largura reduzida (~390px)
avaliados nas duas superfícies, sem defeito encontrado e sem código
adicional necessário — ver avaliação abaixo.

Configurações do projeto (item 17) está `convergida` (D030,
`docs/07-management/decision-log.md`): superfície própria reduzida,
`/projects/[projectId]/settings`, limitada a renomear o projeto
(`renameProject`), exibir a data de criação e um link para Exportar —
implementada, testada e validada. Exportar (item 18) está `convergida`
(D031, `docs/07-management/decision-log.md`): superfície própria em
`/projects/[projectId]/export`, download movido para
`/projects/[projectId]/export/download`, handler legado em `/export`
preservado para requisições não HTML, use case e formato de exportação
preservados sem alteração — implementada, testada e validada.

O restante do gate da subetapa — estados vazios, erros relevantes,
projeto concluído e largura reduzida nas duas superfícies — foi avaliado
formalmente, sem alteração de código:

- estados vazios: Configurações já suporta nome de projeto vazio como
  estado real e alcançável pela interface (criação de projeto sem nome
  provisório), campo e formulário permanecem operáveis; Exportar não tem
  estado vazio aplicável — conteúdo exportado e nome do arquivo são
  sempre estruturalmente presentes (nome do arquivo deriva só do
  `projectId`, nunca do nome do projeto);
- erros relevantes: nome vazio em Configurações produz mensagem
  acessível (`role="alert"`, "Informe um nome para o projeto."), sem
  persistir e sem quebrar o formulário; projeto inexistente em Exportar
  já cai no 404 compartilhado do layout do workspace
  (`+layout.server.ts`), sem necessidade de `+error.svelte` dedicado;
- projeto concluído: verificado com fixture controlada (todas as
  atividades do catálogo marcadas `concluída`, projeto com nome
  preenchido, status `concluído` confirmado em `/now`) — Configurações
  continua acessível e renomear continua funcionando; Exportar continua
  acessível e o download continua funcionando; nenhum bloqueio ou aviso
  fictício de "projeto concluído" aparece em nenhuma das duas
  superfícies;
- largura reduzida (~390px): verificado nas duas superfícies — sem
  rolagem horizontal, campo e botões com alvo de toque adequado
  (~308×48–50px), mensagem de erro de Configurações renderizada sem
  corte, nome de arquivo de Exportar imune a nome de projeto longo (não
  depende dele) e sem estourar a largura da tela.

Nenhum defeito real foi encontrado nesta avaliação e nenhum código
adicional foi necessário. Com os dois itens do inventário convergidos e
o restante do gate aprovado, **a subetapa 7.6 está concluída** — próxima
subetapa é 7.7 (Revisão final).

##### 7.7 — Revisão final — concluído

Resultado: comparação integral AS-IS × TO-BE; correções de consistência;
jornada ponta a ponta; aceite final da etapa.

Gate: todas as telas com decisão explícita; telas do escopo imediato
convergidas; telas adiadas justificadas; jornada principal funcional;
referências e produto comparados; roadmap, PROJECT_STATUS e código
coerentes.

Auditoria realizada em 06/08/2026: as 18 superfícies do inventário
operacional foram verificadas uma a uma contra sua decisão registrada —
13 `convergida`, 4 `combinada com outra superfície` (Atividade guiada,
Detalhe de item de atenção, Resultados e benefícios, Transição e adoção)
e 1 `adiada` com justificativa (Modelos de jornada, horizonte de
Tailoring metodológico); nenhuma divergência funcional ou visual
relevante foi encontrada. As mudanças de código ocorridas nas rotas de
Home, Biblioteca, Agora e Acompanhamento após suas respectivas
convergências foram conferidas e correspondem integralmente a decisões
já registradas (D023–D031) — não representam drift. A navegação do
workspace foi conferida como coerente entre a marcação desktop e o menu
mobile, com os dez destinos reais presentes nas duas formas; nenhuma
referência residual a `/cockpit` permanece no código de produto.

Evidência funcional usada como selo: `hydra-verify full` PASS 5/5,
458/458 testes unitários, 18/18 jornadas ponta a ponta, um único build,
aproximadamente 84 segundos, commit `0a7e529` — sem necessidade de nova
execução, por não ter havido mudança funcional nesta auditoria.

Único achado, de impacto trivial: comentário desatualizado em
`app/src/routes/projects/[projectId]/+layout.svelte` referindo-se a
"oito destinos reais do workspace", quando `NAV_ITEMS` já continha dez
(Encerramento e Configurações adicionados nas subetapas 7.5/7.6 sem
atualizar o comentário) — corrigido para "dez" nesta entrega, sem
alteração de `NAV_ITEMS`, rotas, markup ou comportamento.

Gate atendido: **subetapa 7.7 concluída.**

Com as sete subetapas (7.0–7.7) concluídas, **a etapa 7 — Convergência da
experiência e das telas — está concluída.**

#### Fatias preparatórias já entregues

Estas entregas ajudaram a etapa 7, mas não convergiram nenhuma tela
completa segundo o critério acima:

1. estado ativo da navegação;
2. bloco "Onde estamos" em Agora;
3. continuidade Mapa → Agora;
4. orientação por projeto na Home.

#### Roadmap como backlog (histórico, etapa 7 já concluída)

Durante a etapa 7, este roadmap funcionou também como backlog
operacional, com apoio da skill `/hydra-next` (removida em 10/08/2026 —
ver `CLAUDE.md`, "Fluxo operacional"). Com a etapa 7 concluída e a
direção de trabalho seguinte passando a ser dada diretamente por Matheus
durante o uso do produto, este roadmap não planeja mais próximos passos
com antecedência — ver "Próxima decisão relevante" em
`PROJECT_STATUS.md`.

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
