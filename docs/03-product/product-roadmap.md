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

### 3. Diagnóstico e rota recomendada (próxima etapa)

Resultado: adaptar a jornada ao estado e ao contexto real de cada projeto,
em vez de aplicar sempre a mesma sequência fixa de atividades.

Capacidades:

- estado atual do projeto;
- estruturas já existentes;
- problemas já identificados;
- características do projeto;
- percurso recomendado;
- percurso completo, sempre disponível como alternativa.

Esta etapa provavelmente exige mudança estrutural — decisão de
arquitetura e escopo a ser registrada antes de iniciar a implementação.

### 4. Entregas e backlog estruturados

Resultado: transformar planejamento em trabalho executável e rastreável.

### 5. Execução e acompanhamento

Resultado: acompanhar trabalho real sem competir em profundidade com
Jira, Trello ou Linear.

### 6. Resultados, adaptação e encerramento

Resultado: medir, adaptar, aceitar e encerrar com evidências.

### 7. Tailoring metodológico e modelos

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
