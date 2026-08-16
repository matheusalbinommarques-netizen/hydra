# HYDRA — Product Rework Specification

**Status:** CANÔNICO — congelado após revisão adversarial  
**Versão:** 1.0  
**Data:** 2026-08-11  
**Objetivo:** orientar o rework do Hydra sem transformar o produto em uma coleção de formulários, dashboards genéricos ou um clone simplificado de Jira/ClickUp/Notion.

---

## 0. Como usar este documento

Este arquivo é uma **constituição de produto e arquitetura**, não um backlog detalhado e não uma autorização para implementar tudo de uma vez.

Ao trabalhar no rework:

1. Leia este documento antes de propor mudanças estruturais.
2. Trate as decisões marcadas como **canônicas** como restrições de produto.
3. Não implemente etapas futuras “porque já está no arquivo”.
4. Trabalhe em **cortes verticais pequenos**, com autorização explícita para cada corte.
5. Reaproveite mecanismos existentes quando eles servirem à direção nova.
6. Não faça big-bang rewrite.
7. Não preserve comportamento antigo apenas porque ele existe no catálogo.
8. Não remova comportamento transversal silenciosamente como efeito colateral.
9. Quando código e documento entrarem em conflito, primeiro identifique o conflito e pare para decisão.
10. Este documento deve ser atualizado quando uma decisão de produto realmente mudar — não para registrar cada detalhe operacional.

---

# 1. Resumo executivo

O Hydra não deve ser um lugar onde o usuário “preenche um projeto”.

O projeto acontece no mundo real: reuniões, entrevistas, negociação, trabalho técnico, aprovações, testes, entregas, conversas, decisões, mudanças e validações.

O Hydra deve ser o sistema que:

- entende progressivamente o projeto;
- pergunta apenas o que ainda precisa saber;
- transforma decisões em objetos estruturados e reutilizáveis;
- monta automaticamente ferramentas e visualizações úteis;
- permite trabalhar visualmente sobre os objetos do projeto;
- prepara o usuário para ações que acontecerão fora do Hydra;
- recebe de volta apenas o resultado relevante dessas ações;
- recalcula projeções e sinais;
- mostra o que merece atenção;
- explica por quê;
- conduz à próxima ação útil.

A cadeia central do produto é:

> **entender → decidir → preparar → agir → observar → adaptar → entregar → validar → aprender**

A unidade central do produto deixa de ser a **tela** e, progressivamente, deixa de ser também a **Activity**.

A unidade central passa a ser o **modelo vivo do projeto**.

Kanban, Roadmap, Timeline, Gantt, mapas, dashboards, registros e documentos são projeções ou ferramentas sobre esse modelo.

---

# 2. O que o Hydra é

Hydra é um sistema guiado de gerenciamento de projetos que tenta oferecer **profundidade progressiva**.

Profundidade progressiva significa:

> mostrar a complexidade certa, no momento certo, já configurada para o contexto do projeto.

O usuário não deveria precisar saber antecipadamente se precisa de:

- Kanban;
- Gantt;
- matriz de riscos;
- RACI;
- EAP;
- roadmap;
- baseline;
- EVM;
- business case;
- termo de abertura;
- fluxo adaptativo, preditivo ou híbrido.

O Hydra aprende o contexto e habilita capacidades quando os dados e a situação justificam.

---

# 3. O que o Hydra não é

Hydra **não é**:

- um formulário de PMBOK;
- um simulador de “atividade concluída”;
- um curso de gerenciamento de projetos disfarçado;
- um Jira simplificado;
- um ClickUp com menos features;
- um Notion com templates prontos;
- um gerador de documentos;
- um dashboard com métricas decorativas;
- um Gantt visual sem modelo real de scheduling;
- um sistema que pede ao usuário o status que ele já consegue inferir;
- um sistema que exige escolher “Scrum / Cascata / Híbrido” antes de entender o projeto;
- um sistema de customização ilimitada;
- um produto que tenta armazenar todo o trabalho técnico executado fora dele.

O Hydra mantém o **modelo gerencial do projeto**, não precisa substituir ferramentas especializadas onde o trabalho técnico ocorre.

---

# 4. Leis de produto

Estas leis devem orientar toda decisão futura.

## L1 — Pergunte somente o necessário

Se o Hydra já sabe, deriva ou pode sugerir uma informação com confiança aceitável, não peça para o usuário redigitar.

## L2 — Texto livre é exceção

O happy path prioriza:

- escolher;
- classificar;
- ordenar;
- aceitar/rejeitar;
- conectar;
- organizar;
- confirmar;
- atualizar objetos existentes.

Texto livre deve ser reservado a:

- “Outro”;
- correção;
- complemento;
- contexto que realmente não pode ser estruturado.

## L3 — Uma entrada, muitas consequências

Uma mudança em um objeto deve refletir em todas as projeções relevantes sem exigir atualização manual duplicada.

Exemplo futuro:

> alterar prazo de uma entrega  
> → Timeline muda  
> → marco pode mudar  
> → sinal pode surgir  
> → status report pode refletir a mudança  
> → próxima ação pode mudar.

## L4 — O objeto é a fonte; a view é uma projeção

Kanban, timeline, documento, mapa e dashboard não devem possuir versões independentes do mesmo dado.

## L5 — Nenhuma visualização deve fingir precisão

Não mostrar:

- “83% de capacidade” sem base confiável;
- “12% atrasado” sem baseline;
- caminho crítico sem precedências/durações válidas;
- health score arbitrário;
- previsão financeira sem dados suficientes.

“Não sabemos ainda” é um estado legítimo.

## L6 — Toda atenção deve ser acionável

Aviso sem explicação ou sem ação é decoração.

Um sinal deve responder:

1. O que aconteceu?
2. Por que isso importa?
3. O que foi afetado?
4. Com base em quê sabemos disso?
5. O que o usuário pode fazer?

## L7 — Ferramentas aparecem por prontidão, não por fase

Não desbloquear Gantt apenas porque o projeto chegou ao Planejamento.

Desbloquear quando houver dados suficientes para o Gantt dizer algo verdadeiro.

## L8 — Projeto real acima do fluxo do Hydra

Se o próximo passo precisa acontecer fora do produto, o Hydra deve ajudar o usuário a realizá-lo.

Exemplos:

- entrevista;
- reunião;
- validação;
- aprovação;
- conversa com patrocinador;
- revisão com fornecedor;
- aceite.

## L9 — Execução é workspace, não questionário

A Execução não deve permanecer como seis formulários sequenciais.

Ela deve virar um espaço operacional com intervenções guiadas quando necessário.

## L10 — Artefatos são consequência, não obrigação

O usuário trabalha sobre o projeto.

O Hydra materializa:

- registros vivos;
- documentos;
- checkpoints;
- snapshots formais.

O usuário não deve preencher documentos tradicionais seção por seção se os dados já existem.

## L11 — Tailoring é invisível sempre que possível

O Hydra adapta capacidades ao contexto do projeto sem obrigar o usuário a estudar metodologias.

## L12 — Generalize comportamento, não aparência

Duas telas com cards parecidos não justificam uma abstração universal.

Generalizar somente quando houver comportamento realmente compartilhado.

## L13 — Primeiro uso específico, padrão depois

Em regra:

- primeiro uso: implementação específica;
- segundo uso: observar;
- terceiro uso — ou segundo claramente transversal: considerar primitiva genérica.

## L14 — IA potencializa modelo confiável; não substitui modelo

IA entra depois que o Hydra possui dados estruturados e regras determinísticas suficientes.

Não salvar silenciosamente no estado do projeto algo inferido por LLM como se fosse fato.

## L15 — Rework não é “deixar tudo dark”

O sucesso do rework não é visual.

A nova identidade é importante, mas o rework só é conceitualmente provado quando objetos, projeções, sinais e ações externas formarem um loop útil.

---

# 5. Aprendizados do benchmarking

O benchmarking considerou, entre outras, Jira/Jira Product Discovery, Asana, ClickUp, monday.com, Linear, Notion, Smartsheet, Microsoft Planner, Basecamp, Wrike e Motion.

## 5.1 O que aprender

### Jira

Aprendizado:

> o mesmo objeto precisa aparecer em várias projeções.

Não copiar:

> excesso de configuração e administração do próprio sistema.

### Jira Product Discovery

Aprendizado:

> descoberta pode conectar problema/oportunidade, evidência, priorização, roadmap e entrega.

Especialmente relevante:

> evidência deve poder sustentar ou contradizer entendimento.

### Asana

Aprendizado:

> execução, portfolio e visão de alto nível precisam reagir ao mesmo trabalho real.

### ClickUp

Aprendizado:

> dashboard pode ser command center e permitir ação.

Alerta:

> quantidade de views e flexibilidade viram complexidade.

### monday.com

Aprendizado:

> visualização do trabalho tem valor real.

Alerta:

> visual sem direção e significado não basta.

### Linear

Aprendizado:

> produto opinativo, rápido e limpo pode ser vantagem.

Especialmente útil:

> dependência e saúde precisam aparecer de forma clara, não escondidas em relatórios.

### Notion

Aprendizado:

> bases conectadas e múltiplas projeções são poderosas.

Não copiar:

> entregar peças e pedir que o usuário construa o sistema.

Hydra deve montar o sistema.

### Smartsheet / Planner

Aprendizado:

> Gantt sério exige modelo sério: datas, dependências, baseline, propagação e, quando aplicável, caminho crítico.

### Basecamp

Aprendizado:

> progresso não precisa significar percentual.

Hill Charts e check-ins reforçam:

- incerteza importa;
- movimento importa;
- perguntas curtas podem substituir relatórios de status.

### Wrike

Aprendizado:

> gerenciamento também envolve pessoas fora da ferramenta.

Requests, aprovações e ações externas são parte do trabalho real.

### Motion

Aprendizado:

> auto-scheduling já existe no mercado.

Conclusão:

> “automação” sozinha também não diferencia o Hydra.

---

# 6. Posição competitiva desejada

O Hydra não deve competir pelo maior número de features.

A posição desejada é:

> **Muito poder disponível com pouco esforço de operação, liberado progressivamente conforme o projeto ganha estrutura.**

A promessa prática é:

> “Você não precisa montar um sistema de gerenciamento de projetos. Comece o projeto. O Hydra vai montando o sistema adequado conforme você trabalha.”

E também:

> “O Hydra não vai pedir status que já consegue enxergar.”

---

# 7. Princípios adotados pelo Hydra

Estes princípios foram formados a partir de repertório de mercado (gestão de projetos, produto, métodos ágeis, benchmarking de ferramentas) e adaptados às decisões de produto do Hydra. Eles não substituem, nem dependem estruturalmente de nenhuma publicação específica — a política de uso de fontes está em `docs/00-governance/source-basis.md`.

## Descoberta não deve saltar para a solução

A Descoberta deve aprofundar progressivamente o entendimento da situação antes de orientar respostas. Contexto, pessoas afetadas, funcionamento atual, causas, resultado desejado e evidências devem reduzir incerteza antes que o Hydra conduza o usuário para decisões de solução.

O nível de detalhe dos artefatos e informações varia conforme contexto, risco, valor, regulação e necessidades das partes envolvidas.

## Contexto orienta a abordagem

Nem todo projeto precisa dos mesmos processos, ferramentas, artefatos ou nível de formalidade. O Hydra seleciona capacidades conforme o contexto, otimizando fluxo e tornando o trabalho visível, sem exigir que o usuário escolha um rótulo metodológico antecipadamente (ver Leis L7 e L11, e Tailoring Engine, seção 22).

## Risco é contínuo

Risco não deve existir apenas como atividade inicial. Riscos precisam poder ser identificados, avaliados, respondidos, monitorados, revisados e surgir ao longo do ciclo. A intensidade do gerenciamento de risco se adequa ao projeto.

## Mudança relevante precisa de rastro

Mudança relevante precisa de identificação, rastreabilidade, impacto, histórico, aprovação quando aplicável e verificação. O Hydra preserva o estado atual e, progressivamente, registra como mudanças relevantes aconteceram.

## Entrega não é adoção

Entrega não é igual a adoção ou valor realizado. Encerramento deve considerar transição, uso, aceitação, resultado e sustentação.

## EVM exige base confiável

EVM só faz sentido quando houver baseline, escopo estruturado, cronograma confiável, custo e progresso mensurável. Não ativar precisão falsa.

---

# 8. Estado atual confirmado pelo audit do repositório

A auditoria arquitetural de 2026-08-11 encontrou os fatos abaixo.

## 8.1 Padrões bons já existentes

O Hydra já possui:

- `ProjectView` e vários view-builders;
- recomputação de projeções na leitura;
- `ScopeItem` como objeto com identidade, persistência e lifecycle;
- `Impediment` como objeto independente do catálogo;
- `CompletionMode` como union discriminada;
- atividades customizadas que já escapam do formulário genérico;
- padrão previsível de extensão schema → mapper → repository → view → tests;
- boa cobertura unitária em domínio/orientation/persistence/views.

Isso significa que o rework **não exige reescrever o produto do zero**.

## 8.2 Limites atuais importantes

Hoje NÃO existem como objetos reais de domínio:

- Risk;
- Decision;
- Change;
- Dependency;
- Milestone;
- Participant/Stakeholder;
- AcceptanceCriterion;
- Deliverable canônico;
- Hypothesis canônica.

`PlanningItem` é um valor estruturado dentro de Answer.

`ScopeItem` é um objeto de domínio mais maduro.

Eles representam conceitos parcialmente sobrepostos e **não devem continuar evoluindo em paralelo sem decisão consciente**.

## 8.3 Histórico

O Hydra hoje mantém essencialmente estado atual.

Não existe audit trail/event log completo com:

- valor anterior;
- valor novo;
- motivo;
- origem;
- ator.

Persistência atual sobrescreve o estado-filho do projeto em save.

## 8.4 Orientation Engine

A maior parte é genérica.

Existem exceções hardcoded.

`scope-suggestions.ts` ainda referencia `sinais_situacao`, que deixou de existir no catálogo após o redesign de Entender a Situação.

Resultado atual:

> regras desse módulo ficam dormentes/órfãs.

Não corrigir por mapeamento semântico improvisado.

## 8.5 Acompanhamento

Hoje é principalmente projeção/agrupamento de:

- progresso;
- entregas/ScopeItems;
- impedimentos;
- pending items.

Ainda não existe infraestrutura suficiente para radar de:

- dependências;
- marcos;
- decisões;
- riscos;

porque os próprios objetos ainda não existem.

## 8.6 Planejamento visual

Hoje:

- não existe Dependency;
- não existe Milestone;
- não existem datas planejadas suficientes;
- não existe motor de scheduling.

Portanto:

> não implementar Gantt real antes de criar o modelo que o sustenta.

## 8.7 Design system

A nova identidade existe em três superfícies principais, mas com tokens/CSS locais paralelos.

Há aproximadamente três sistemas visuais dark sobrepostos:

- Home (`--hp-*`);
- `/projects/new` (`--np-*`);
- `.dark-activity` redefinindo `--hydra-*`.

Antes de migrar muitas novas telas, consolidar a fundação visual.

## 8.8 Testes

Existem quatro jornadas e2e conhecidas ainda referenciando comportamento antigo removido de `contexto`.

Antes do primeiro corte estrutural:

> corrigir essas jornadas e recuperar `hydra-verify full PASS`.

---

# 9. Decisões canônicas já tomadas

## 9.1 `/projects/new`

Captura:

- nome;
- origem.

Origem atual:

- Existe um problema
- Existe uma oportunidade
- Quero melhorar algo
- Quero criar algo novo
- Recebi uma solicitação
- Existe uma obrigação
- Ainda não sei direito

`/projects/new` não deve usar o diagnóstico antigo de rota.

O diagnóstico pode continuar existindo em outras superfícies que ainda dependem dele.

## 9.2 `contexto`

A antiga atividade `contexto` está **INCORPORADA**.

Não deve voltar como tela.

Elementos úteis foram redistribuídos.

## 9.3 `origem`

Origem é capturada em `/projects/new`.

Não deve aparecer novamente como atividade para o usuário.

## 9.4 Entender a Situação

Primeira atividade efetiva de Descoberta.

Mantém internamente o id histórico `problema` enquanto isso evitar quebra transversal desnecessária.

UX:

1. o que acontece;
2. onde aparece;
3. peso;
4. síntese;
5. confirmação.

Sem textarea obrigatório.

Síntese determinística persistida em `situacao`.

## 9.5 `scope-suggestions.ts`

Não reescrever agora.

Não inventar equivalência entre a nova taxonomia e os sinais antigos.

Reancorar ou remover apenas quando o mecanismo de sugestões for redesenhado conscientemente.

---

# 10. Arquitetura conceitual alvo

O Hydra deve evoluir para sete categorias de capacidade.

## 10.1 Objeto vivo

Representa algo real do projeto e possui identidade/lifecycle suficiente para sobreviver a uma atividade.

Exemplos futuros:

- AffectedGroup;
- Participant/Stakeholder;
- Evidence;
- DesiredOutcome;
- Deliverable;
- WorkItem;
- Dependency;
- Milestone;
- Risk;
- Issue;
- Decision;
- Change;
- AcceptanceCriterion.

## 10.2 Projeção

Forma derivada de olhar para os objetos.

Exemplos:

- Documento;
- Resumo;
- Kanban;
- Roadmap;
- Timeline;
- Gantt;
- mapa de dependências;
- mapa de impacto;
- dashboard.

Uma projeção não deve possuir sua própria cópia independente dos fatos.

## 10.3 Intervenção guiada

Momento em que o Hydra realmente precisa de uma decisão.

Pode:

- criar objeto;
- alterar objeto;
- confirmar interpretação;
- coletar resultado externo;
- resolver incerteza.

## 10.4 Surface

Espaço visual onde o usuário trabalha sobre o projeto.

Exemplos:

- Impact Map;
- Kanban;
- Timeline;
- Dependency Map;
- Risk workspace.

## 10.5 Signal

Interpretação derivada do estado.

Não é necessariamente persistido.

## 10.6 External Action

Trabalho preparado pelo Hydra, realizado fora dele e posteriormente registrado de forma mínima.

## 10.7 Artifact

Representação comunicável do projeto.

Pode ser viva ou snapshot formal.

---

# 11. Activity deixa de ser sinônimo de formulário

Hoje Activity ainda é fortemente associada a:

> fields → answer → completion.

Isso deve evoluir sem big bang.

Uma Activity futura pode orquestrar:

- uma pergunta guiada;
- manipulação de objetos;
- abertura de uma surface;
- confirmação;
- ação externa;
- checkpoint.

## 11.1 Não sobrecarregar `CompletionMode`

`CompletionMode` e “tipo de experiência” são dimensões diferentes.

Conceitualmente:

```text
interactionKind
- guided
- surface
- external_action
- checkpoint

completionMode
- required_state
- explicit_confirmation
- external_result
- derived
```

Os nomes acima são ilustrativos, não autorização de implementação.

A decisão importante é:

> **não usar CompletionMode para representar ao mesmo tempo interação e conclusão.**

## 11.2 Execução

Execução deve ser tratada como workspace persistente.

Activities podem continuar existindo como intervenções contextuais, mas não como estrada obrigatória.

---

# 12. Modelo vivo do projeto

Conceitualmente:

```text
Situation
   │
   ├── Evidence
   ├── AffectedGroup
   ├── Participant/Stakeholder
   ├── Hypothesis
   └── DesiredOutcome
            │
            ▼
       Deliverable
            │
            ▼
         WorkItem
          │    │
          │    ├── Dependency
          │    ├── AcceptanceCriterion
          │    └── Responsible
          │
          ▼
       Milestone
          │
          ├── Risk
          ├── Issue
          ├── Decision
          └── Change
```

Isto é conceitual.

Não criar uma entidade genérica universal nem banco de grafos apenas para imitar o diagrama.

Os tipos devem continuar explícitos e simples.

---

# 13. Regras de promoção de dados e modelo canônico

O repositório atual possui vários conceitos que já aparecem como `Answer` de texto livre, mas que a visão nova pretende transformar em objetos vivos.

A criação de uma entidade nova **não autoriza manter duas fontes de verdade permanentes para o mesmo conceito**.

## 13.1 Modelo canônico de trabalho

O repositório atual possui:

### `PlanningItem`

- estruturado;
- id próprio no JSON;
- vive dentro de Answer;
- usado por decompor/priorizar;
- não é entidade persistida própria.

### `ScopeItem`

- identidade real;
- tabela própria;
- CRUD;
- lifecycle;
- aparece em várias superfícies.

Não decidir automaticamente que um deve absorver o outro.

Antes de adicionar a qualquer um deles:

- datas planejadas;
- duração;
- responsáveis;
- dependências;
- marcos;
- scheduling;

é obrigatório decidir qual será o modelo canônico de:

- Deliverable;
- WorkItem;

e como os conceitos históricos serão adaptados/migrados.

### Restrição

Não enriquecer `PlanningItem` e `ScopeItem` em paralelo como dois modelos concorrentes.

## 13.2 Regra geral — `Answer` legado → objeto vivo

Sempre que um objeto de domínio novo substituir ou estruturar melhor um dado que hoje é capturado por `Answer`, o corte correspondente deve decidir explicitamente:

1. qual passa a ser a fonte de verdade;
2. o destino do `Answer` legado;
3. como projetos existentes serão lidos;
4. se haverá migração, adapter de leitura ou confirmação manual;
5. quando a escrita no campo antigo deixa de acontecer.

### Estratégias permitidas

Conforme o caso:

- **PROMOTE/MIGRATE** — converter deterministicamente para o objeto novo;
- **READ-LEGACY** — manter o Answer antigo apenas para leitura/compatibilidade;
- **CONFIRM-TO-CONVERT** — mostrar o legado ao usuário e estruturar somente após confirmação;
- **DEPRECATE** — deixar o dado antigo dormente/órfão quando compatibilidade real não justificar migração.

### Regras

- não fazer dual-write permanente;
- não usar free text legado como segunda fonte de verdade;
- não interpretar texto livre automaticamente como fato estruturado sem confiança suficiente;
- não apagar silenciosamente dado antigo que ainda precisa ser exportado/lido;
- documentar a estratégia no gate do corte.

Este padrão já é previsível para:

| Conceito futuro | Captura atual que precisa ser reconciliada |
|---|---|
| AffectedGroup | `publico_detail` |
| Participant/Stakeholder | `partes_interessadas`, `interesse_influencia` |
| Dependency | `dependencias_trabalho` |
| Milestone | `marcos_principais` |
| Risk | `riscos_identificados`, `resposta_inicial_riscos`, `riscos_atualizados` |
| Decision / Change | `decisoes_mudancas_recentes` e demais campos equivalentes existentes no catálogo |
| AcceptanceCriterion | `criterios_aceitacao_entrega` |
| DesiredOutcome | campos atuais da atividade `resultado` |

A tabela acima registra **sobreposição semântica**, não autoriza migração automática.

## 13.3 `AffectedGroup` não é automaticamente `Participant/Stakeholder`

Uma pessoa/grupo afetado pode não participar da governança do projeto.

Da mesma forma, um patrocinador, fornecedor ou aprovador pode participar do projeto sem ser parte do público afetado.

Portanto:

- não criar duplicatas desnecessárias quando a mesma pessoa/grupo ocupar os dois papéis;
- permitir relação/reuso de identidade quando fizer sentido;
- não forçar os dois conceitos a serem a mesma entidade apenas porque ambos representam pessoas/grupos.

A decisão de modelagem concreta deve ser tomada quando `Participant/Stakeholder` for promovido a objeto vivo.

## 13.4 Sobreposição com `ImpedimentType`

Hoje `ImpedimentType` já inclui classificações como:

- `decisao_pendente`;
- `dependencia_externa`.

Quando `Decision` e `Dependency` existirem como objetos reais, os cortes correspondentes devem reconciliar essa relação.

Essas tags **não precisam ser removidas automaticamente**: elas podem continuar representando a causa/classificação do impedimento.

Mas o Hydra não deve terminar com dois fatos concorrentes sem relação explícita.

Exemplo futuro aceitável:

> Impediment = “API não liberada”  
> tipo = `dependencia_externa`  
> relacionado à Dependency X.

A mesma regra vale para `decisao_pendente` + `Decision`.


# 14. Histórico incremental

O Hydra precisa aprender “como chegamos aqui”, mas não deve virar event-sourced neste rework.

Direção:

> estado atual continua sendo a fonte operacional; um event log auxiliar registra mudanças relevantes.

Evento conceitual:

```text
eventType
entityType
entityId
before?
after?
occurredAt
source
actor?
reason?
```

O modelo exato deve ser definido no corte autorizado.

## Objetivos

Permitir futuramente:

- O que mudou desde a última reunião?
- Quando isso mudou?
- Por que este sinal apareceu?
- O que levou este marco a ficar em risco?
- Quem tomou esta decisão?
- Qual era o valor anterior?

## Não fazer

- replay para reconstruir ProjectState;
- CQRS/event sourcing completo;
- event bus complexo sem necessidade.

---

# 15. Contrato de sinais

Um Signal deve ser derivado, explicável e acionável.

## 15.1 Precedente existente — `movementSignal`

A Home já possui `movementSignal` (`bloqueado` / `parado` / `avancando`) como sinal estreito de movimento do projeto.

Ele deve ser tratado como **precursor**, não como um segundo sistema de saúde concorrente.

Quando o Signal genérico começar a existir, o corte correspondente deve decidir explicitamente se:

- `movementSignal` continua como resumo derivado especializado da Home; ou
- passa a ser derivado/agregado a partir dos sinais operacionais novos.

Não criar dois mecanismos independentes que possam contradizer um ao outro.

Estrutura conceitual:

```text
Signal
- id
- kind
- severity
- title
- explanation
- affectedEntityRefs[]
- evidenceRefs[]
- confidence
- suggestedActions[]
```

Nem todos os campos precisam existir na primeira implementação.

## Exemplos futuros

- item bloqueado há X dias;
- dependência violada;
- marco próximo com trabalho crítico aberto;
- entrega sem responsável;
- decisão pendente bloqueando trabalho;
- risco materializado;
- entrega concluída sem aceite;
- trabalho parado;
- mudança relevante sem replanejamento.

## Regras

- sem health score arbitrário;
- sem semáforo sem explicação;
- sem signal sem ação quando ação for possível;
- sinal não deve persistir duplicação do fato se pode ser recalculado.

---

# 16. Acompanhamento / Radar

Acompanhamento deve evoluir para ser o coração operacional do projeto.

Não é uma coleção de métricas.

Estrutura desejada, conforme os dados existirem:

## Precisa de você

Sinais prioritários e acionáveis.

## Onde estamos

Fase/estado/marco atual.

## Entregas

Resumo operacional.

## Linha do tempo

Somente quando houver dados temporais.

## Atenções

Riscos, impedimentos, dependências, decisões.

## Próxima ação

Ação recomendada com explicação.

Cada bloco deve levar a uma surface ou intervenção.

---

# 17. Surface readiness

Uma surface só aparece quando há dados suficientes.

| Surface | Prontidão mínima |
|---|---|
| Situation Map | situação estruturada |
| Impact Map | grupos afetados |
| Current State Canvas | fluxo/solução atual estruturado |
| Evidence Map | evidências relacionadas |
| Risk workspace | pelo menos um risco |
| Roadmap | entregas + ordenação/prioridade |
| Kanban | itens executáveis |
| Dependency Map | relações de dependência |
| Timeline | datas/marcos |
| Gantt | datas + duração + dependências suficientes |
| Capacity | responsáveis + capacidade/esforço |
| Radar | objetos suficientes para sinais |
| EVM | baseline + custo + progresso confiável |

## Regra

Não criar abas vazias apenas porque uma feature existe.

---

# 18. Gantt e scheduling

Gantt é desejado, mas não é uma prioridade inicial de UI.

Antes do Gantt, o domínio precisa suportar de forma confiável:

- datas;
- duração;
- dependências;
- milestones;
- precedência;
- propagação de datas.

Depois:

- folga;
- caminho crítico;
- baseline;
- replanejamento.

Ordem desejada:

> Roadmap → Timeline → Scheduling → Gantt completo.

Não fazer um “Gantt decorativo”.

---

# 19. External Action

External Action é um conceito importante do Hydra novo.

Exemplos:

- entrevistar usuário;
- confirmar aprovador;
- realizar kickoff;
- conversar com fornecedor;
- validar protótipo;
- coletar aceite;
- apresentar decisão;
- revisar risco.

Estrutura conceitual:

```text
ExternalAction
- objective
- people
- preparation
- questions/checklist
- expectedResult
- relatedEntities
- resultStatus
- capturedEvidence
```

Primeira versão não precisa de integração com Gmail/Calendar/Slack.

Pode funcionar com:

- preparar;
- copiar;
- imprimir/exportar;
- registrar resultado.

---

# 20. Evidence

Evidence deve se tornar objeto de primeira classe quando o corte correspondente for autorizado.

Pode representar:

- entrevista;
- métrica;
- reclamação;
- observação;
- teste;
- documento;
- feedback;
- incidente.

Evidence pode:

- confirmar;
- enfraquecer;
- contradizer;
- contextualizar;

uma hipótese, situação, necessidade ou decisão.

A evidência deve ajudar o Hydra a diferenciar:

> “achamos isso”

de

> “temos base para dizer isso”.

---

# 21. Artefato vivo versus snapshot formal

## Artefato vivo

Projeção do estado atual.

Exemplos:

- Risk Register;
- Stakeholder Register;
- Documento do projeto;
- Roadmap.

Alterou o projeto → artefato vivo muda.

## Snapshot formal

Versão congelada em um momento.

Exemplos:

- Termo de Abertura aprovado;
- baseline;
- plano aprovado;
- review de marco;
- encerramento.

Deve preservar:

- versão;
- data;
- estado relevante;
- aprovação quando aplicável.

Não exigir snapshot para todo projeto.

Tailoring decide.

---

# 22. Tailoring Engine

O usuário não deve escolher metodologia cedo.

O Hydra aprende gradualmente.

Sinais de contexto:

## Incerteza

- solução conhecida?
- requisitos mudarão?

## Feedback

- é possível validar cedo?

## Prazo

- data rígida ou negociável?

## Controle

- orçamento formal?
- compliance?
- contrato?

## Equipe

- solo/equipe?
- capacidade compartilhada?

## Dependências

- fornecedores?
- aprovações?
- outras equipes?

## Criticidade

- impacto da falha?

O Tailoring Engine escolhe **capacidades**, não rótulos metodológicos.

Exemplo:

> alta incerteza + feedback frequente  
> → backlog, ciclos curtos, validação, roadmap.

Outro:

> dependências + datas rígidas + contrato  
> → cronograma, marcos, baseline, mudança controlada.

---

# 23. Checkpoints

Poucos e significativos.

## Checkpoint 1 — Descoberta

Produz visão consolidada de:

- situação;
- afetados;
- estado atual;
- causas/hipóteses;
- evidências;
- resultados desejados.

## Checkpoint 2 — Direção

Produz:

- público/foco;
- direção escolhida;
- valor esperado;
- critérios de sucesso;
- primeiro recorte.

## Checkpoint 3 — Estruturação

Pode materializar, conforme necessidade:

- Termo de Abertura;
- stakeholders;
- riscos iniciais;
- governança.

## Checkpoint 4 — Planejamento

Produz plano executável conforme contexto.

## Reviews de marco/release

Snapshots quando fizer sentido.

## Encerramento

Produz:

- aceite;
- transição;
- pendências;
- lições;
- resultados;
- próximos passos.

---

# 24. Auditoria do catálogo antigo

O catálogo é inventário de necessidades possíveis.

Não é mapa de telas.

Categorias possíveis:

1. `GUIDED` — intervenção guiada.
2. `SURFACE` — ferramenta visual.
3. `LIVE_OBJECT` — objeto que continua vivo.
4. `EXTERNAL_ACTION` — trabalho fora do Hydra.
5. `DERIVED` — Hydra calcula/materializa.
6. `INCORPORATED` — absorvido por outra experiência.
7. `CHECKPOINT` — revisão/confirmacão consolidada.
8. `WORKSPACE_BEHAVIOR` — comportamento contínuo, não atividade sequencial.
9. `CONDITIONAL` — só aparece por contexto.

---

# 25. Classificação inicial do catálogo

Esta classificação orienta o rework, mas deve ser validada corte a corte.

## Descoberta

| Antigo | Destino |
|---|---|
| Origem do projeto | INCORPORATED em `/projects/new` |
| Contexto inicial | INCORPORATED — já removido |
| Problema/oportunidade | GUIDED — `Entender a Situação` |
| Público afetado | GUIDED + LIVE_OBJECT + SURFACE |
| Estado atual | SURFACE + GUIDED |
| Resultado desejado | GUIDED + LIVE_OBJECT |
| Resumo da descoberta | CHECKPOINT + DERIVED |
| Causas/evidências | nova intervenção: GUIDED + LIVE_OBJECT + EXTERNAL_ACTION |

## Definição do produto

| Antigo | Destino |
|---|---|
| Definir usuário principal | GUIDED sobre grupos já existentes |
| Definir visão do produto | DERIVED + GUIDED para direção |
| Critérios de sucesso | LIVE_OBJECT + GUIDED |
| Escolha o próximo foco | SURFACE de priorização/roadmap |

Checkpoint sugerido:

> Direção do produto.

## Estruturação

| Antigo | Destino |
|---|---|
| Objetivo e entregáveis | GUIDED + LIVE_OBJECT |
| Partes interessadas | LIVE_OBJECT, reutilizando pessoas/grupos |
| Papéis e responsabilidades | SURFACE |
| Restrições e premissas | LIVE_OBJECT |
| Riscos do projeto | LIVE_OBJECT + SURFACE + CONDITIONAL suggestions |
| Comunicação e governança | GUIDED/CONDITIONAL, derivando o máximo possível |

Checkpoint:

> Projeto estruturado/autorizado.

## Planejamento

| Antigo | Destino |
|---|---|
| Decompor o trabalho | SURFACE |
| Priorizar entregas | SURFACE |
| Mapear dependências | SURFACE + LIVE_OBJECT |
| Estimar esforço e capacidade | SURFACE + LIVE_OBJECT |
| Definir marcos | SURFACE + LIVE_OBJECT |
| Critérios de aceitação | LIVE_OBJECT vinculado às entregas |
| Consolidar plano de entrega | CHECKPOINT + DERIVED |

## Execução e acompanhamento

| Antigo | Destino |
|---|---|
| Definir foco atual | DERIVED / Agora |
| Registrar andamento | WORKSPACE_BEHAVIOR / check-in |
| Identificar e tratar impedimentos | LIVE_OBJECT + SURFACE |
| Registrar decisões e mudanças | LIVE_OBJECT |
| Atualizar riscos | WORKSPACE_BEHAVIOR sobre Risk |
| Definir próxima ação | DERIVED pelo motor |

A Execução deixa de ser uma sequência obrigatória.

## Validação e encerramento

| Antigo | Destino |
|---|---|
| Validar entregas e critérios | SURFACE + LIVE_OBJECT |
| Coletar feedback | EXTERNAL_ACTION + Evidence |
| Resolver pendências finais | LIVE_OBJECT |
| Registrar lições aprendidas | GUIDED/retrospective |
| Definir transição e próximos passos | GUIDED + EXTERNAL_ACTION |
| Confirmar encerramento | CHECKPOINT |

Adicionar ao desenho:

> verificar se o resultado desejado foi alcançado, não apenas se a entrega terminou.

---

# 26. Primitivas de interação desejadas

Evitar inventar um paradigma diferente em cada tela.

Primitivas principais:

1. escolher cards/chips;
2. classificar;
3. ordenar;
4. aceitar/rejeitar sugestão;
5. montar objetos;
6. conectar objetos;
7. organizar espacialmente;
8. revisar síntese;
9. registrar resultado externo;
10. resolver sinal.

O “Documento do projeto” ao vivo pode continuar sendo uma projeção forte durante atividades onde isso agrega valor.

---

# 27. Fundação visual

Antes de migrar muitas telas:

1. consolidar tokens dark;
2. consolidar tipografia;
3. consolidar shell;
4. estabelecer primitivas aprovadas:
   - button;
   - card;
   - chip;
   - selection;
   - panel;
   - surface container;
   - status;
   - progress;
   - empty/loading/error states.

Não criar design system abstrato gigantesco.

Extrair o mínimo comprovado pelas três superfícies já aprovadas:

- Home;
- `/projects/new`;
- Entender a Situação.

Migrar o restante incrementalmente.

---

# 28. Critérios de qualidade do rework

Toda feature deve responder:

## Q1

O usuário digitou algo que o Hydra já sabia?

Se sim, revisar.

## Q2

A interação criou/alterou algo real do projeto?

Se deveria e não criou, revisar.

## Q3

Outras superfícies relevantes reagiram?

Se deveriam e não reagiram, revisar.

## Q4

O sinal explica o motivo?

Se não, revisar.

## Q5

O sinal leva a uma ação?

Se poderia e não leva, revisar.

## Q6

Existe precisão artificial?

Se sim, remover.

## Q7

A feature ajuda a fazer o projeto real ou apenas preencher o Hydra?

Se a segunda opção dominar, provavelmente está errada.

## Q8

Estamos criando nova abstração porque há padrão real ou porque parece elegante?

Evitar abstração prematura.

---

# 29. Estratégia de implementação

Não implementar fase inteira antes de provar o loop novo.

A estratégia é:

> baseline → fundações mínimas → cortes verticais → dogfooding → expansão.

---

# 30. ETAPA 0 — Recuperar baseline confiável

## Objetivo

Garantir que mudanças estruturais futuras tenham rede de segurança.

## Escopo

Corrigir as jornadas e2e conhecidas ainda referenciando `contexto`/UX antiga:

- `bancada-field-by-field`;
- `problema-optional-group`;
- `skip-activity`;
- `walking-skeleton-journey`.

Atualizar para o comportamento aprovado atual.

## Gate

- `npm run check` PASS;
- unit tests PASS;
- `hydra-verify full` PASS;
- nenhum comportamento novo de produto;
- nada de refactor incidental.

## Parar depois do gate.

---

# 31. ETAPA 1 — Fundação visual mínima

## Objetivo

Evitar multiplicação de CSS/tokens locais durante o restante do rework.

## Escopo

Consolidar apenas o que já é comprovadamente comum entre:

- Home;
- `/projects/new`;
- Entender a Situação.

Não migrar automaticamente todas as telas.

## Gate

- as três superfícies aprovadas permanecem visualmente equivalentes;
- tokens centrais compartilhados;
- sem regressão visual funcional;
- shell preparado para migração incremental;
- `hydra-verify full` PASS quando aplicável.

---

# 32. ETAPA 2 — Primeiro corte vertical de Descoberta: AffectedGroup

## Objetivo

Provar:

> atividade → objeto vivo → surface → manipulação → projeção.

## Experiência

### Quem é afetado?

O usuário:

1. vê grupos sugeridos a partir da situação/origem;
2. seleciona/adiciona grupos;
3. define impacto;
4. define frequência;
5. confirma.

Texto livre apenas para “Outro”/ajuste.

## Domínio

Introduzir um objeto real equivalente a `AffectedGroup`.

Não armazenar o novo comportamento apenas como textarea/Answer se isso impedir o objeto de viver fora da Activity.

### Fonte de verdade

A partir deste corte, `AffectedGroup` deve ser a fonte estruturada canônica para o novo fluxo de `publico`.

O campo legado `publico_detail` **não deve continuar sendo dual-written** apenas para satisfazer o mecanismo antigo.

### Compatibilidade de `publico_detail`

Antes de implementar, escolher a menor estratégia compatível com o estado real dos dados:

- se houver conteúdo legado relevante, mantê-lo legível como legado e converter somente por confirmação ou transformação comprovadamente segura;
- se não houver necessidade real de compatibilidade, deprecar o campo conforme a regra da seção 13.2;
- não inferir automaticamente grupos estruturados a partir de texto livre como se fossem fatos confirmados.

### Conclusão da Activity `publico`

Manter o id histórico `publico` enquanto isso reduzir impacto transversal.

A conclusão deve passar a refletir o estado estruturado confirmado de `AffectedGroup`.

Não manter um `publico_detail` artificial só para satisfazer `required_fields`.

Para este primeiro corte, preferir a menor transição/use-case específica necessária a criar antecipadamente um framework genérico de `interactionKind`/completion.

A generalização de Activity continua sendo uma direção arquitetural, não pré-requisito para este corte.

## Surface

Criar um **Mapa de Impacto** simples e útil.

Não precisa ser uma visualização complexa.

Precisa permitir:

- ver grupos;
- impacto;
- frequência;
- selecionar/editar;
- refletir alterações no resumo/Documento.

## Projeções

Pelo menos:

- atividade;
- Mapa de Impacto;
- Resumo/Documento da Descoberta.

## Gate funcional

Mudança feita no objeto em qualquer ponto autorizado deve aparecer nas demais projeções após recomputação.

## Gate técnico

- destino de `publico_detail` decidido e testado;
- completion de `publico` baseada no estado estruturado, sem dual-write artificial;
- persistence;
- serialization/import-export;
- use-cases;
- view-builders;
- testes por camada;
- compatibilidade de projetos existentes conforme a estratégia escolhida;
- `hydra-verify full` PASS.

## Dogfooding

Pergunta principal:

> Isso parece trabalhar sobre o projeto ou preencher o Hydra?

---

# 33. ETAPA 3 — Evidence + primeira External Action

## Objetivo

Provar o loop:

> Hydra → ação real → Hydra.

## Exemplo

A partir de AffectedGroup:

> “Vale validar com este grupo.”

Hydra prepara:

- objetivo;
- perguntas;
- informação a levar;
- resultado esperado.

Usuário realiza a conversa fora.

Retorna:

- confirmou;
- confirmou parcialmente;
- contradisse;
- descobriu algo novo.

Isso cria Evidence.

## Gate

Evidence aparece ligada ao entendimento correspondente e altera projeções relevantes sem reentrada de texto desnecessária.

---

# 34. ETAPA 4 — Fechar Descoberta nova

Depois dos dois cortes anteriores:

## 4A — Como é tratado hoje

Substituir textarea por Current State Canvas / estrutura manipulável.

## 4B — Causas / hipóteses

Criar hipótese estruturada quando fizer sentido.

Distinguir:

- evidência;
- suspeita forte;
- hipótese;
- desconhecido.

## 4C — Resultado desejado

Criar DesiredOutcome vivo.

Permitir:

- selecionar mudanças esperadas;
- ordenar;
- alvo quantitativo opcional;
- não forçar KPI artificial.

## 4D — Checkpoint

Resumo da Descoberta derivado.

Sem questionário novo.

## Gate da Descoberta

O usuário deve terminar com:

- Situation;
- AffectedGroups;
- Current State;
- Hypotheses/Evidence quando aplicável;
- DesiredOutcomes;
- checkpoint coerente.

---

# 35. ETAPA 5 — Decidir o modelo canônico de trabalho

Antes de avançar scheduling/roadmap operacional:

## Auditar

- `PlanningItem`;
- `ScopeItem`;
- usos atuais;
- lifecycle;
- projeções;
- semântica.

## Decidir

Qual será a relação entre:

- Deliverable;
- WorkItem;
- ScopeItem histórico;
- PlanningItem histórico.

## Regras

- evitar duas entidades concorrentes para o mesmo conceito;
- preservar compatibilidade quando razoável;
- não fazer migração big bang;
- documentar a decisão.

## Gate

Somente decisão + menor fundação necessária.

Não adicionar Gantt ainda.

---

# 36. ETAPA 6 — Primeiro loop operacional

Objetivo:

> provar que o Hydra é útil durante execução antes de redesenhar todas as fases intermediárias.

Fluxo mínimo:

```text
Deliverable/WorkItem
→ Kanban
→ Impediment
→ Signal
→ Acompanhamento
→ ação
→ estado atualizado
```

## Aproveitar

`Impediment` existente.

## Criar apenas o necessário

Não adicionar Risk, Decision, Change, Dependency e Milestone todos juntos.

## Gate

O usuário deve conseguir:

1. ter trabalho executável;
2. mover estado;
3. bloquear;
4. ver Acompanhamento reagir;
5. entender por que aquilo merece atenção;
6. agir.

---

# 37. ETAPA 7 — Event log incremental

Introduzir no momento em que mudanças operacionais passarem a gerar valor real no histórico.

## Primeira versão

Registrar eventos relevantes de mudanças em objetos vivos.

## Usos iniciais

- atividade recente;
- “o que mudou?”;
- explicação de sinais;
- histórico de item.

## Não fazer

event sourcing.

---

# 38. ETAPA 8 — Dependency + Milestone + Roadmap/Timeline

Quando o modelo de trabalho estiver estável:

## Dependency

Objeto real.

A atividade/campo legado `mapear_dependencias` / `dependencias_trabalho` já captura a intenção em texto livre.

Aplicar a regra de promoção da seção 13.2: decidir migração/coexistência antes de tornar `Dependency` canônica.

Também reconciliar `ImpedimentType.dependencia_externa`: a tag pode continuar classificando o impedimento, mas deve poder se relacionar a uma `Dependency` real quando houver uma.

## Milestone

Objeto real.

A atividade/campo legado `definir_marcos` / `marcos_principais` já captura marcos em texto livre.

Aplicar a regra de promoção da seção 13.2.

## Roadmap

Ordenação/recortes.

## Timeline

Datas planejadas quando existirem.

## Primeiro conjunto de sinais

- dependência bloqueada;
- marco próximo com trabalho aberto;
- item sem responsável quando isso for relevante.

---

# 39. ETAPA 9 — Estruturação e Planejamento reworkados

Agora as intervenções passam a alimentar surfaces reais já existentes.

## Estruturação

- entregas;
- pessoas;
- responsabilidades;
- restrições;
- premissas;
- riscos;
- governança.

## Planejamento

- decomposição;
- priorização;
- dependências;
- capacidade;
- marcos;
- aceitação.

`criterios_aceitacao_entrega` é captura legada em texto livre do futuro `AcceptanceCriterion`; aplicar a regra de promoção da seção 13.2 quando essa entidade for introduzida.

Cada decisão deve provocar resultado visual quando possível.

---

# 40. ETAPA 10 — Risk como objeto vivo

Risk deve possuir lifecycle próprio.

O catálogo atual já captura risco em texto livre em mais de um momento, incluindo `riscos_identificados`, `resposta_inicial_riscos` e `riscos_atualizados`.

Essas capturas representam intenção de produto útil, mas não devem permanecer como uma segunda fonte concorrente quando `Risk` se tornar objeto canônico.

Aplicar a regra de promoção da seção 13.2.

Primeira versão deve permitir:

- identificar;
- avaliar;
- resposta;
- owner quando necessário;
- monitorar;
- materializar em Issue quando ocorrer, se o modelo escolhido fizer sentido.

Usar premortem/sugestões como mecânica opcional.

Não transformar risco em formulário fixo de fase.

---

# 41. ETAPA 11 — Decision e Change

Adicionar quando houver objetos suficientes para calcular impacto.

O catálogo atual já mistura decisões e mudanças em captura de texto livre (`decisoes_mudancas_recentes` e campos equivalentes existentes).

Ao promover os conceitos:

- decidir explicitamente como separar `Decision` de `Change`;
- aplicar a regra da seção 13.2;
- não manter o campo legado como segunda fonte de verdade.

Também reconciliar `ImpedimentType.decisao_pendente`: ele pode continuar classificando o impedimento, mas uma decisão pendente real deve poder ser relacionada a `Decision` quando o objeto existir.

## Decision

Registrar:

- decisão;
- opções;
- responsável;
- prazo;
- entidades afetadas;
- resultado.

## Change

Registrar mudança relevante e impacto.

Quando possível, mudanças devem nascer naturalmente de manipulações, não de formulário separado.

Exemplo:

> usuário altera marco.

Hydra detecta que é relevante e oferece:

> “Registrar como mudança?”

---

# 42. ETAPA 12 — Scheduling e Gantt

Somente quando houver:

- WorkItems/Deliverables estáveis;
- datas;
- durações;
- dependencies;
- milestones.

Implementar incrementalmente:

1. regras de precedência;
2. propagação;
3. folga;
4. caminho crítico;
5. baseline quando aplicável;
6. Gantt.

O Gantt é projeção do modelo, não editor isolado.

---

# 43. ETAPA 13 — Execução como workspace completo

Navegação operacional desejada:

- Agora;
- Quadro;
- Cronograma;
- Entregas;
- Riscos;
- Atenções;
- Decisões.

O fluxo guiado aparece quando existir decisão concreta.

“Registrar andamento” deixa de ser uma atividade obrigatória.

Check-ins curtos podem perguntar:

> O que mudou desde a última vez?

---

# 44. ETAPA 14 — Ações externas maduras

Expandir:

- entrevista;
- aprovação;
- kickoff;
- revisão;
- aceite;
- fornecedor;
- sponsor.

Somente depois considerar integrações com:

- calendar;
- email;
- Slack/Teams;
- GitHub/Jira;
- outras.

A funcionalidade central não deve depender delas.

---

# 45. ETAPA 15 — Artefatos e snapshots

Gerar artefatos a partir do modelo vivo.

## Possíveis artefatos

- Discovery Brief;
- Direction Brief;
- Termo de Abertura;
- Stakeholder Register;
- Risk Register;
- Plano do Projeto;
- Roadmap;
- Status/Review;
- Encerramento.

Tailoring decide quais aparecem.

---

# 46. ETAPA 16 — Validação, transição e encerramento

Fechar o ciclo:

- validar entrega;
- coletar feedback;
- verificar DesiredOutcome;
- tratar pendências;
- transferir responsabilidade;
- registrar lições;
- confirmar encerramento.

O Hydra deve distinguir:

> entrega concluída

de

> resultado alcançado.

---

# 47. ETAPA 17 — IA avançada

Somente com modelo confiável.

Possíveis usos:

- transformar nota de reunião em propostas de objetos;
- sugerir riscos;
- sugerir dependências;
- resumir eventos;
- explicar sinais;
- preparar agenda;
- gerar Decision Brief;
- sugerir tailoring;
- simular cenário.

Sempre com revisão humana proporcional ao impacto.

---

# 48. Ordem resumida

```text
GATE 0 — BASELINE CONFIÁVEL
        ↓
FUNDAÇÃO VISUAL MÍNIMA
        ↓
AFFECTED GROUP + IMPACT MAP
        ↓
EVIDENCE + EXTERNAL ACTION
        ↓
FECHAR DESCOBERTA
        ↓
DECIDIR MODELO CANÔNICO DE TRABALHO
        ↓
PRIMEIRO LOOP OPERACIONAL
        ↓
EVENT LOG INCREMENTAL
        ↓
DEPENDENCY + MILESTONE
        ↓
ROADMAP + TIMELINE
        ↓
ESTRUTURAÇÃO/PLANEJAMENTO SOBRE SURFACES
        ↓
RISK / DECISION / CHANGE
        ↓
SCHEDULING + GANTT
        ↓
EXECUÇÃO COMO WORKSPACE
        ↓
AÇÕES EXTERNAS MADURAS
        ↓
ARTEFATOS / SNAPSHOTS
        ↓
ENCERRAMENTO
        ↓
IA AVANÇADA
```

---

# 49. Coisas explicitamente proibidas no rework

Sem decisão nova, NÃO:

- reescrever o domínio inteiro;
- converter tudo para event sourcing;
- adicionar banco de grafos;
- implementar todas as entidades novas de uma vez;
- criar dashboard customizável genérico;
- criar 15 views porque concorrentes têm;
- implementar Gantt sem scheduling;
- criar health score arbitrário;
- exigir metodologia do usuário;
- transformar cada item do catálogo em nova tela;
- manter Activity antiga só por compatibilidade conceitual;
- duplicar objetos entre Answer e entidade sem estratégia;
- substituir regras determinísticas úteis por IA;
- migrar todas as telas dark de uma vez;
- alterar orientation-engine transversalmente como efeito colateral de uma activity;
- criar abstração genérica antes de haver comportamento repetido.

---

# 50. Gate padrão de qualquer corte

Um corte só pode ser considerado fechado quando:

## Produto

- resolve um problema real;
- respeita as leis deste documento;
- não adiciona burocracia desnecessária;
- apresenta consequência útil para o usuário.

## Domínio

- fonte de verdade clara;
- sem duplicação desnecessária;
- relações explícitas quando necessárias.

## Persistência

- salva;
- recarrega;
- exporta/importa quando aplicável.

## Projeções

- superfícies relevantes refletem o mesmo estado.

## Testes

- unitários;
- persistence;
- serialization;
- view;
- e2e relevante.

## Verificação

- `npm run check` PASS;
- testes PASS;
- `hydra-verify full` PASS quando a entrega afeta jornadas protegidas.

## Dogfooding

Pergunta obrigatória:

> “Eu estava gerenciando meu projeto ou preenchendo o Hydra?”

Se a resposta pender para a segunda opção, o corte não provou a direção.

---

# 51. Protocolo de trabalho com Claude Code

Para cada etapa:

## 1. Ler

- este arquivo;
- estado atual do repo;
- docs canônicas realmente relevantes.

## 2. Inspecionar

Confirmar que premissas ainda são verdadeiras.

## 3. Propor apenas o corte autorizado

- arquivos;
- mudança;
- riscos;
- testes.

## 4. Implementar

Sem expansão de escopo.

## 5. Verificar

Rodar gate correspondente.

## 6. Parar

Não iniciar a etapa seguinte automaticamente.

---

# 52. Próxima ação após aprovação deste documento

Antes de qualquer implementação:

> **Claude Code deve fazer uma revisão adversarial deste documento contra o repositório atual.**

Ele deve procurar apenas:

1. contradições com o código;
2. premissas falsas;
3. mudanças desnecessárias;
4. pontos onde já existe mecanismo reaproveitável melhor;
5. ordem tecnicamente ruim;
6. riscos de compatibilidade;
7. termos que colidem com conceitos existentes.

Ele NÃO deve:

- implementar;
- reescrever o documento;
- inventar um roadmap alternativo completo;
- expandir escopo.

Depois da revisão adversarial:

1. corrigir este documento se necessário;
2. congelar a versão;
3. executar **ETAPA 0**;
4. parar no gate;
5. seguir corte a corte.

---

# 53. Definição final de sucesso

O rework não está provado quando:

- todas as telas estão escuras;
- todas as activities estão redesenhadas;
- existem Gantt e Kanban;
- existe IA.

Ele está provado quando:

1. o usuário cria um projeto;
2. responde pouco;
3. o Hydra constrói objetos e surfaces;
4. o usuário trabalha sobre esses objetos;
5. outras projeções reagem;
6. o Hydra detecta algo relevante;
7. explica por quê;
8. oferece uma ferramenta/ação;
9. o usuário faz trabalho real;
10. volta com o resultado;
11. o Hydra atualiza o modelo;
12. a próxima ação melhora.

> **Hydra não é onde o usuário descreve o projeto.  
> Hydra é de onde ele gerencia o projeto que acontece no mundo real.**

---

# 54. Revisão adversarial incorporada

A revisão adversarial contra o repositório atual classificou este documento como:

> **APROVÁVEL COM AJUSTES PEQUENOS**

A versão 0.2 incorporou:

1. renomeação do conceito de negócio `Outcome` para `DesiredOutcome`, evitando colisão com `UseCaseOutcome<T>`;
2. regra geral para promoção de `Answer` legado a objeto vivo;
3. tratamento explícito de `publico_detail` no corte `AffectedGroup`;
4. registro dos precedentes de texto livre para Dependency, Milestone, Risk, Decision/Change e AcceptanceCriterion;
5. distinção entre `AffectedGroup` e `Participant/Stakeholder`, com possibilidade de reuso/relação sem duplicação;
6. reconciliação futura de `ImpedimentType.decisao_pendente` e `ImpedimentType.dependencia_externa`;
7. registro de `movementSignal` como precursor estreito do contrato futuro de Signal.

Nenhum desses ajustes alterou a ordem macro das etapas.

---

---

## Congelamento da versão 1.0

Esta versão foi congelada após revisão adversarial contra o repositório atual e verificação final pelo Claude Code.

**Veredito final:** APROVADO PARA CONGELAR.

A partir desta versão:

- mudanças de direção de produto devem ser explícitas;
- implementação deve ocorrer corte a corte;
- cada etapa deve parar no gate correspondente;
- o documento não autoriza execução automática das etapas seguintes;
- divergências reais entre documento e repositório devem ser sinalizadas antes de implementação.

# 55. Referências conceituais consultadas

Estas publicações e ferramentas foram consultadas como repertório de pesquisa durante a elaboração deste documento. A política de uso de fontes está em `docs/00-governance/source-basis.md`.

Elas são referências de leitura e comparação — não uma base normativa da qual o Hydra deriva, e nenhuma delas define isoladamente uma decisão de produto.

Publicações consultadas:

- PMBOK Guide — 8th Edition
- PMI Guide to Business Analysis
- Risk Management in Portfolios, Programs, and Projects: A Practice Guide
- Choose Your WoW! — Disciplined Agile
- Agile Practice Guide — 2nd Edition
- Practice Standard for Project Configuration Management
- Standard for Earned Value Management
- Managing Change in Organizations
- Standard for Program Management
- PMI Standard for AI in PPPM

Benchmarking complementar (produtos, não publicações):

- Jira
- Jira Product Discovery
- Asana
- ClickUp
- monday.com
- Linear
- Notion
- Smartsheet
- Microsoft Planner
- Basecamp
- Wrike
- Motion

A referência metodológica serve como repertório de pesquisa, não como especificação.

Ela **não deve ser traduzida 1:1 para telas, processos ou artefatos**.
