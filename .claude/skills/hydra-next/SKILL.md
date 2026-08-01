---
name: hydra-next
description: Propõe a menor fatia funcional da próxima etapa ainda não concluída do roadmap do Hydra, sem editar nada. Uso explícito apenas via /hydra-next.
disable-model-invocation: true
allowed-tools: Bash(node .claude/scripts/hydra-state.mjs:*), Read, Grep, Glob
---

Sem argumentos. Propõe a próxima etapa candidata do roadmap para revisão
de Matheus — nunca decide sozinho, nunca implementa.

## 1. Obter os fatos

```
node .claude/scripts/hydra-state.mjs --format json
```

Reaproveite `changelogUnreleased` do próprio JSON — não releia
`CHANGELOG.md` inteiro por conta própria. O script não cobre o roadmap nem
`PROJECT_STATUS.md`; leia os dois diretamente:

- `docs/03-product/product-roadmap.md`;
- `PROJECT_STATUS.md`.

Se o script sair com código diferente de zero, pare e mostre o erro —
não tente adivinhar o estado.

## 2. Identificar a etapa candidata

Leia a seção "## Sequência de evolução" do roadmap, em ordem. A etapa
candidata é a primeira sem marca de conclusão no título (ex.: "—
concluído"). Cruze com `PROJECT_STATUS.md` e `changelogUnreleased`: se
qualquer uma dessas fontes já descrever essa etapa como entregue, trate
isso como sinal a confirmar no código (§3), não como conclusão definitiva.

Leia só a seção dessa etapa. Não leia nem planeje etapas posteriores.

Se a etapa candidata for "7. Convergência da experiência e das telas" e
`PROJECT_STATUS.md` indicar essa etapa como em andamento, siga
exclusivamente o §2A a partir daqui — não execute §3, §4 nem o formato de
saída do §5 para esta etapa.

## 2A. Modo etapa 7 — telas e superfícies

Enquanto a etapa 7 estiver em andamento, este comando trabalha somente
dentro da estrutura operacional já publicada na própria seção "### 7.
Convergência da experiência e das telas" do roadmap — nunca procurando
microfatias oportunistas fora dela.

### Leitura obrigatória

- `PROJECT_STATUS.md`;
- a seção 7 completa de `docs/03-product/product-roadmap.md` (objetivo,
  regras de interpretação, inventário operacional, critério de tela
  convergida, sequência 7.0–7.7).

### Identificar

- a subetapa atual (dentro de "Sequência da etapa 7");
- seu resultado esperado e seu gate, conforme descritos na subetapa;
- a ordem interna que essa subetapa define (ex.: ordem de telas em
  7.2–7.6).

Selecione o próximo trabalho somente dentro dessa subetapa. Não procure
outra microfatia fora da sequência, exceto diante de bloqueio explícito,
divergência documental ou impossibilidade técnica demonstrada.

### Parar e relatar divergência quando

- `PROJECT_STATUS.md` apontar uma subetapa diferente da indicada pelo
  roadmap;
- a situação de uma tela não permitir determinar o próximo alvo;
- uma referência visual esperada estiver ausente;
- a superfície atual não puder ser confirmada sem ampliar o escopo.

### Tratamento por subetapa

- **7.0 — Estruturar a convergência**: se ainda não concluída, priorize a
  organização documental e das referências. Se já concluída, não volte a
  ela sem divergência concreta.
- **7.1 — Fundação visual e shell**: não é uma tela individual. Identifique
  o primeiro resultado ainda não atendido do gate de 7.1, considerando de
  forma focada tokens e estilos globais, tipografia, espaçamento,
  largura, shell global, shell do workspace, navegação, cabeçalhos,
  cards, botões, campos, estados compartilhados e a linguagem
  papel/tinta/grafite. Não tente redesenhar todas as telas de uma vez.
  Proponha uma fatia coerente e compartilhada que reduza retrabalho nas
  telas posteriores — não escolha um detalhe isolado só porque é pequeno;
  a fatia precisa produzir avanço material no gate de 7.1.
- **7.2 a 7.6 — Telas e superfícies ordenadas**: use a ordem registrada na
  respectiva subetapa; localize a primeira tela que não esteja
  `convergida`, `adiada` nem `não aplicável`; use a imagem individual
  indicada no inventário; compare apenas essa referência com a superfície
  atual correspondente; distinga diferença visual/estrutural, capacidade
  funcional já existente, capacidade de domínio inexistente e conteúdo
  meramente ilustrativo do mockup; não crie automaticamente nova rota,
  campo, entidade ou regra de domínio só porque aparece na imagem;
  proponha uma fatia suficientemente completa para aproximar
  materialmente a tela do critério de convergência. Quando a situação for
  `não auditada`, a primeira ação pode ser uma auditoria focada da
  superfície para decidir entre convergir, combinar com outra superfície,
  criar, preservar, adiar ou declarar não aplicável — não invente essa
  decisão antes de ler o código relevante.
- **7.7 — Revisão final**: use os critérios e o gate registrados no
  roadmap para selecionar divergências restantes, sem reabrir
  funcionalidades já aprovadas sem evidência concreta.

### Uso das imagens

Para uma tela com referência individual: abra somente a imagem indicada
no inventário; não reanalise a montagem completa sem necessidade; não use
imagens de outras telas como requisitos; trate a imagem como alvo
verificável, não pixel-perfect; não transforme textos, nomes, números ou
dados fictícios do mockup em requisitos.

Para Documento do projeto e Exportar, que não possuem imagem individual:
use somente as referências complementares indicadas no roadmap, deixe
explícita a ausência de referência individual e não invente um mockup.

### Tamanho da fatia

A próxima fatia deve ter um resultado observável, aproximar
materialmente o gate atual, ter escopo limitado, evitar misturar várias
telas, evitar alterações de domínio sem necessidade, e ser implementável
e revisável em uma entrega. Indique se, após a entrega, o alvo continua
`em convergência`, pode ser considerado `convergida`, ou exige uma
decisão antes de prosseguir.

### Inspeção focada

Não leia o repositório inteiro. Comece pelos documentos canônicos; abra
apenas a imagem do alvo; inspecione somente a rota, componentes e estilos
diretamente relacionados; amplie a leitura apenas diante de dependência
concreta. Não execute testes, build ou smoke durante a escolha da próxima
fatia.

### Formato obrigatório da resposta no modo etapa 7

Use este formato em vez do §5 enquanto estiver no modo etapa 7:

```
# Estado atual
Etapa, subetapa, resultado e gate relevantes.

# Próximo alvo
Tela, superfície compartilhada ou decisão; situação atual no roadmap;
referência visual usada; superfície AS-IS correspondente.

# Evidência
O que foi confirmado nos documentos; o que foi confirmado no código;
principal diferença observada.

# Próxima fatia proposta
Resultado concreto; escopo; arquivos ou áreas provavelmente envolvidos;
áreas protegidas; critério de aceite; validação proporcional recomendada.

# Efeito esperado no roadmap
Se a entrega poderá avançar o gate da subetapa, manter a tela
`em convergência`, marcar a tela como `convergida`, ou exigir uma decisão
documental.

# Bloqueios ou incertezas
Somente divergências reais.
```

Fora da etapa 7, ou quando a etapa 7 não estiver em andamento, ignore o
§2A inteiro e siga normalmente a partir do §3.

## 3. Confirmar contra o código antes de declarar pendente

Antes de tratar a etapa candidata como pendente, inspecione apenas a
infraestrutura diretamente relacionada a ela — rotas, componentes e
projeções que a própria seção do roadmap descreve, ou que a etapa
anterior já deixou como padrão reconhecível. Não faça auditoria geral do
repositório.

- Só prossiga para a §4 quando todas as fontes — roadmap,
  `PROJECT_STATUS.md`, `changelogUnreleased` e o código inspecionado —
  forem compatíveis com a etapa ainda pendente.
- Qualquer indício de que a etapa já foi entregue no código, enquanto o
  roadmap a marca como pendente, é divergência: **pare aqui**, relate o
  que cada fonte diz e qual arquivo motivou a checagem.
- Uma etapa marcada como concluída no roadmap/status/changelog mas sem
  sustentação encontrada no código também é divergência: **pare aqui**
  pelo mesmo motivo.
- Em nenhum desses casos decida sozinho qual fonte está certa nem avance
  silenciosamente para a etapa seguinte — isso é decisão de Matheus.
- Se não for possível delimitar com segurança quais arquivos checar a
  partir do que a seção do roadmap descreve, pare e apresente a dúvida em
  vez de ampliar a exploração.

Antes de propor qualquer campo, entidade, schema, persistência ou
mecanismo novo:

- verifique explicitamente se já existe uma capacidade equivalente no
  domínio, catálogo, aplicação, projeções ou rotas já entregues;
- quando existir algo relacionado, explique objetivamente por que não é
  suficiente antes de propor estrutura nova;
- antes de usar qualquer campo ou estado existente como sinal de decisão,
  confirme sua semântica no código e nos testes diretamente relacionados —
  não infira aplicabilidade, contexto do projeto ou comportamento do
  usuário apenas pelo nome de um campo;
- prefira composição e reutilização da infraestrutura existente;
- se a semântica não puder ser confirmada com uma investigação delimitada,
  apresente a dúvida e pare em vez de ampliar a solução.

## 4. Propor a menor fatia

Só depois de confirmada como pendente: proponha somente a menor fatia
funcional dessa etapa — nunca a etapa inteira como especificada no
roadmap, nunca mais de duas alternativas quando houver mais de uma opção
razoável.

## 5. Formato obrigatório da resposta

```
# Próxima etapa
Nome e resultado descritos no roadmap.

# Estado atual relacionado
Somente fatos confirmados no código e nos documentos atuais.

# Infraestrutura reutilizável
Projeções, rotas, componentes, contratos e testes já existentes.

# Menor fatia funcional
Um único resultado observável para o usuário.

# Escopo
Comportamentos e arquivos provavelmente afetados.

# Fora do escopo
Limites explícitos para evitar expansão.

# Limitações e dependências
Conflitos, capacidades ausentes e restrições atuais.

# Nível provável
Nível 1, 2 ou 3, com justificativa curta baseada nas regras existentes.

# Testes e QA
Verificações automatizadas e jornadas manuais necessárias.

# Critérios objetivos de aceite
Comportamentos diretamente observáveis e verificáveis.

# Decisões pendentes
Somente decisões que exigem aprovação de Matheus.
```

Em cada seção, diferencie fato (confirmado em código ou documento),
inferência (sua leitura do que falta) e decisão pendente (só Matheus
resolve) — não misture os três sem identificação. Respostas compactas:
cite o trecho relevante, não o arquivo inteiro.

## 6. O que este comando nunca faz

Não cria, edita nem apaga nenhum arquivo do projeto — incluindo roadmap,
`PROJECT_STATUS.md`, `CHANGELOG.md` e backlog. Não cria ciclo, item de
backlog nem identificador. Não roda testes. Não faz stage, commit ou
push. Não lê nem planeja etapas posteriores à candidata. Não compara mais
de duas alternativas. Não repete a história do produto já registrada em
`CHANGELOG.md`/decision-log. O plano apresentado nunca é considerado
aprovado automaticamente — implementação exige decisão explícita de
Matheus e, quando houver item formal, passa por `/hydra-plan-item`.
