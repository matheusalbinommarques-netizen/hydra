# Hydra — Domain Model (Conceptual)

**Versão:** 0.1
**Status:** canônico
**Escopo:** fase Descoberta completa + primeira atividade da fase Definição do produto (`Definir usuário principal`). Demais fases não detalhadas nesta versão.

## 1. Princípio central: catálogo vs. estado

O domínio separa duas famílias de conceitos:

- **Catálogo metodológico** — fixo, igual para todo projeto: `PhaseDefinition`, `ActivityDefinition`, `FieldDefinition`.
- **Estado do projeto** — varia por instância de projeto: `Project`, `ActivityProgress`, `Answer`, `PendingItem`.

`Hypothesis` não é uma entidade persistida — ver §5.

### Terminologia

O domínio usa somente dois termos para os dois níveis de progresso: **Fase** e **Atividade**. "Etapa" pode aparecer como palavra informal na interface (ex.: "Pular etapa"), mas não existe uma entidade `Etapa` no modelo — sempre que "etapa" aparecer em textos de produto, ela se refere a uma Atividade.

## 2. Catálogo metodológico

### PhaseDefinition
- `id`
- `order`
- `label`
- `catalogStatus: complete | partial | unavailable`
- `activities: ActivityDefinition[]` (ordenadas; pode ser vazio quando `catalogStatus = unavailable`, ou parcial quando `partial`)

`catalogStatus` descreve o quanto o catálogo desta fase já foi detalhado nesta versão — não é um status de progresso do projeto, é uma propriedade do próprio catálogo (ver `STATE_MACHINE.md` §2 para o efeito no cálculo de status da fase):

- `complete` — todas as atividades da fase estão catalogadas; regras normais de conclusão se aplicam.
- `partial` — só algumas atividades da fase estão catalogadas; a fase nunca pode ser considerada concluída nesta versão.
- `unavailable` — nenhuma atividade da fase está catalogada; a fase permanece sempre `não_iniciada`.

### ActivityDefinition
- `id`
- `phaseId`
- `order` (dentro da fase)
- `title`
- `mainQuestion`
- `why`
- `example`
- `completionCriteria` (texto)
- `completionMode: required_fields | explicit_confirmation | scope_confirmation`
- `allowsSkip: boolean`
- `pendingItemLabel`, `pendingItemDetail` (texto exibido quando esta atividade gera uma pendência por skip — usado em vez de persistir texto por instância)
- `fields: FieldDefinition[]` (ordenados)

`completionMode`:
- `required_fields` — a atividade conclui quando todos os campos obrigatórios estão válidos e o usuário salva. Modo padrão de todas as atividades com formulário.
- `explicit_confirmation` — a atividade conclui por uma ação explícita do usuário (ex.: clicar "Continuar"), independente de campos. Único uso nesta versão: "Resumo da descoberta" (que não tem campos próprios e não permite pular — `allowsSkip = false`).
- `scope_confirmation` — a atividade conclui quando `ScopeVersion.confirmedAt` é definido, nunca por `Answer`. Único uso nesta versão: "Escolha o próximo foco" (sem campos próprios, `allowsSkip = false`). É uma solução deliberadamente específica para esta experiência (ver §7A) — não uma infraestrutura genérica de "Plays". Se uma segunda experiência especializada precisar de um completion mode com o mesmo formato, o conceito deve ser generalizado nesse momento, não acumulado como um novo valor solto.

### FieldDefinition
- `id`
- `activityId`
- `label`
- `required: boolean`
- `type` (texto curto | texto longo | seleção | seleção múltipla)
- `options` (quando seleção; `string[]` — a própria string já é o valor armazenado. Quando seleção múltipla: `{ id, label }[]` — precisa de id estável e curto, separado do rótulo exibido, porque o valor vira um array de ids em `Answer.value`, ver §3A "seleção múltipla")
- `placeholder` / `help`
- `dataTarget: project_property | answer` (default `answer`)
- `projectProperty` (presente somente quando `dataTarget = project_property`; nome da propriedade de `Project` atualizada por este campo)
- `semanticRole` (opcional; ex.: `hypothesis` — marca campos cujo conteúdo deve ser exibido como hipótese)
- `revealWhen` (opcional; `{ fieldId, optionId }` — este campo só aparece na interface quando o campo irmão `fieldId` (sempre `selecao_multipla`) tem `optionId` selecionado. Mecanismo genérico mínimo para opções tipo "Outro" abrirem um campo de texto; puramente de exibição, não afeta validação nem obrigatoriedade)
- `suggestedSource` (opcional; `{ activityId, fieldId, actionLabel, helpText }`, só em campos de texto — `texto_curto`/`texto_longo` — com `dataTarget: answer`). `actionLabel`/`helpText` são texto de produto próprio de cada par, não derivados automaticamente do título da atividade de origem. Reaproveitamento explícito de resposta anterior: enquanto este campo não tiver `Answer` própria e o campo de origem já tiver uma `Answer` não vazia, a interface oferece o texto de origem como ponto de partida editável, nunca como preenchimento ou vínculo silencioso. Respostas anteriores podem ser oferecidas como ponto de partida para decisões relacionadas, mas nunca são copiadas ou vinculadas silenciosamente — aceitar copia o valor uma única vez; a partir daí, origem e destino são `Answer`s independentes (editar uma não altera a outra). `catalog/validate.ts` garante que a referência aponta para outro campo de texto existente e não é autorreferente. Resolução em `orientation-engine/field-suggestions.ts`. Os pares configurados nesta versão vivem só no catálogo (`catalog/discovery.ts`, `catalog/product-definition.ts`), não duplicados aqui.
- `optionalGroup` (opcional; `{ id, label }`). Agrupa campos opcionais menos usados de uma atividade dentro de uma seção expansível (`<details>`) na interface, para reduzir quantas caixas de texto grandes aparecem simultaneamente — puramente de exibição, não afeta validação, obrigatoriedade nem submissão (os campos continuam no mesmo formulário da atividade, sempre enviados). A seção abre automaticamente quando algum campo do grupo já tem `Answer`; caso contrário começa recolhida. Todo campo com o mesmo `optionalGroup.id`, na mesma atividade, deve usar o mesmo `label` (`catalog/validate.ts` garante essa consistência). Nesta versão, o único uso é o grupo "Adicionar mais contexto" em "Problema ou oportunidade" (evidências, consequências, hipótese, solução imaginada, observações).

`dataTarget`:
- `answer` (padrão) — o valor do campo vira uma `Answer`.
- `project_property` — o valor do campo atualiza diretamente a propriedade de `Project` indicada em `projectProperty`; esse campo **nunca** gera uma `Answer`. Nesta versão, o único caso é o campo "Nome provisório" da atividade "Contexto inicial": `dataTarget: project_property`, `projectProperty: name`.

## 3. Estado do projeto

### Project
- `id`
- `name` (nulo até o campo "Nome provisório" ser preenchido — projeto em rascunho; fonte canônica única, nunca duplicado em `Answer`)
- `createdAt`

### ActivityProgress
- `projectId`
- `activityDefinitionId`
- `status: não_iniciada | em_andamento | concluída | pulada`

### Answer
- `projectId`
- `activityDefinitionId`
- `fieldDefinitionId` (deve pertencer a um `FieldDefinition` com `dataTarget = answer`)
- `value`
- `createdAt`
- `updatedAt`

### PendingItem
- `id`
- `projectId`
- `activityDefinitionId`
- `status: aberta | resolvida`
- `createdAt`
- `resolvedAt`

Sem `fieldDefinitionId`, sem `resolutionCondition`, sem `label`/`detail` persistidos — a condição de resolução é sempre a mesma (a atividade vinculada atingir `concluída`) e os textos exibidos vêm de `ActivityDefinition.pendingItemLabel`/`pendingItemDetail`.

### ScopeItem
- `id`
- `projectId`
- `text`
- `bucket: agora | depois | fora` (escolhido no ato de adicionar; nunca nasce implícito, sem estado "a classificar")
- `effort: pequeno | medio | grande | null` (nulo até o usuário classificar; exigido pela confirmação só quando `bucket = agora` — fora de `agora` o valor, se já definido, permanece armazenado e apenas deixa de ser obrigatório/destacado, não é limpo ao mover o item)
- `order: number | null` (só definido quando `bucket = agora`; sequência contígua começando em 0 — normalizada a cada inclusão, exclusão, movimentação ou reordenação)
- `sourceSuggestionId: string | null` (rastreia a sugestão estruturada — ver §7B — que originou este item, só quando aceita explicitamente via "Usar sugestão"; `null` para item manual. Usado exclusivamente para ocultar a sugestão já aceita e deixá-la reaparecer se o item for excluído; editar o texto do item não afeta esta referência)
- `createdAt`
- `updatedAt`

Não existe um eixo de "valor" (prioridade/importância) em `ScopeItem` — foi considerado e removido deliberadamente por não alimentar nenhuma regra determinística. A prioridade é comunicada só por `bucket` (momento) e `order` dentro de `agora` (ordem); `effort` comunica viabilidade aproximada.

### ScopeVersion
- `projectId` (1:1 com `Project` — sempre existe desde a criação do projeto, mesmo padrão de `Project` em si)
- `hypothesis` (string; vazia até preenchida)
- `confirmedAt: string | null` (nulo = rascunho; qualquer alteração em `ScopeItem` ou nesta hipótese limpa `confirmedAt`, reabrindo a atividade "Escolha o próximo foco" — mesmo comportamento de invalidação do Resumo da Descoberta, ver `STATE_MACHINE.md` §3A)

Suportam a experiência estruturada "Escolha o próximo foco" (§7A) — ver `docs/06-architecture/contracts.md` para as transições puras e a validação de confirmação.

## 4. Contexto — nota de modelagem

Não existe uma entidade `Context` persistida separadamente do Projeto. `Project` guarda apenas identidade e metadados. Quando a interface ou o motor precisarem de um `ProjectContext` (modo de trabalho, nível de experiência, estágio atual), ele é **derivado por projeção** a partir das `Answer` da atividade "Contexto inicial" — nunca duplicado como estado próprio.

## 5. Hipóteses — projeção, não entidade

Não existe `Hypothesis` persistida nesta versão. Hipóteses exibidas (ex.: em Registros) são **derivadas** em tempo de leitura, de duas fontes combinadas (deduplicadas por texto):

1. toda `Answer` cujo `FieldDefinition.semanticRole == hypothesis` e valor não vazio — nesta versão do catálogo, o único campo com esse papel é o campo opcional "hipótese" da atividade "Problema ou oportunidade";
2. `ScopeVersion.hypothesis`, apenas quando `ScopeVersion.confirmedAt` não é nulo (versão de escopo confirmada) — ver §7A.

## 6. Relações

```text
PhaseDefinition 1───N ActivityDefinition
ActivityDefinition 1───N FieldDefinition

Project 1───N ActivityProgress   (uma por ActivityDefinition do catálogo)
Project 1───N Answer             (uma por FieldDefinition com dataTarget=answer respondido)
Project 1───N PendingItem
Project 1───N ScopeItem
Project 1───1 ScopeVersion

ActivityProgress N───1 ActivityDefinition
Answer N───1 ActivityDefinition
Answer N───1 FieldDefinition       (dataTarget = answer)
PendingItem N───1 ActivityDefinition
```

Invariantes de integridade:
- uma `Answer` só referencia um `FieldDefinition` que pertença à mesma `ActivityDefinition` da `Answer`;
- não existe `Answer` para um `FieldDefinition` cujo `dataTarget` seja `project_property`.

## 7. Catálogo detalhado nesta versão

### Fase 1 — Descoberta (`catalogStatus: complete`)
1. **Origem do projeto** — `completionMode: required_fields`, `allowsSkip: true`. Campo: origem (seleção, obrigatório, `dataTarget: answer`).
2. **Contexto inicial** — `completionMode: required_fields`, `allowsSkip: true`. Campos obrigatórios: nome provisório (`dataTarget: project_property`, `projectProperty: name` — não gera `Answer`), breve descrição, modo de trabalho, nível de experiência, estágio atual (estes quatro `dataTarget: answer`).
3. **Problema ou oportunidade** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: situação que precisa mudar (texto curto); sinais que representam a situação (`selecao_multipla`, 7 opções incluindo "Outro" — ver §7B). Opcionais: descrição do sinal "Outro" (`revealWhen` — só aparece quando "Outro" é selecionado; não alimenta regra nenhuma), evidências, consequências de não agir, hipótese (`semanticRole: hypothesis`), solução imaginada, observações.
4. **Público afetado** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: público afetado em detalhe.
5. **Estado atual** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: estado atual em detalhe.
6. **Resultado desejado** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: mudança esperada, beneficiário, percepção de melhoria.
7. **Resumo da descoberta** — `completionMode: explicit_confirmation`, `allowsSkip: false`. Sem campos próprios; conclui quando o usuário revisa e clica "Continuar". Sujeito à regra de invalidação — ver `STATE_MACHINE.md` §3.

### Fase 2 — Definição do produto (`catalogStatus: complete`)
1. **Definir usuário principal** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: descrição do usuário principal.
2. **Definir visão do produto** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: tipo de produto, necessidade central, benefício central (`dataTarget: answer`). Opcional: diferencial.
3. **Escolha o próximo foco** — `completionMode: scope_confirmation`, `allowsSkip: false`. Sem campos próprios; conclui quando `ScopeVersion.confirmedAt` é definido. Ver §7A.
4. **Definir critérios de sucesso do produto** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: sinais de sucesso, evidências ou indicadores, condição mínima de validação.

### Fase 2A — "Escolha o próximo foco" em detalhe

Substitui as antigas atividades em texto livre "Definir funcionalidades essenciais" e "Priorizar primeira versão" por uma experiência estruturada, apoiada em `ScopeItem`/`ScopeVersion` (§3) em vez de `Answer`:

1. o usuário adiciona itens de escopo, escolhendo o bucket (`agora | depois | fora`) no próprio ato de adicionar — nunca um item nasce sem bucket;
2. itens em `agora` recebem tamanho (três níveis); fora de `agora`, tamanho não é exigido nem destacado;
3. itens em `agora` são ordenados (posição contígua, sem drag-and-drop — reordenação por ação explícita);
4. o usuário registra a hipótese que esse recorte deve validar;
5. a confirmação (`confirmScopeVersion`) exige: pelo menos um item no total; pelo menos um item em `agora`; todos os itens de `agora` com tamanho definido; hipótese não vazia — os motivos pendentes são uma lista tipada (`ScopeConfirmationIssue`) que, quando aplicável, aponta os ids exatos dos itens incompletos (`missing_effort.itemIds`), nunca uma mensagem livre e genérica;
6. a versão pode ser editada livremente depois de confirmada — qualquer alteração (item, bucket, tamanho, ordem, inclusão, exclusão, hipótese) limpa `confirmedAt` e reabre a atividade, espelhando a invalidação do Resumo da Descoberta (`STATE_MACHINE.md` §3A);
7. a projeção do artefato confirmado (agrupamento por bucket, leitura de tamanho, e um alerta simples quando muitos itens de tamanho médio/grande se acumulam em `agora`) é sempre calculada em tempo de leitura (`computeScopeProjection`), nunca persistida como texto duplicado — mesmo princípio de `buildMapView`/`buildRecordsView`.

Dados de projetos anteriores ao corte (que ainda referenciassem as duas atividades antigas, ou o campo `value` já removido) não são suportados — todos os projetos existentes até esta mudança eram dados de teste, sem necessidade de migração.

### Fase 2B — Sinal → sugestão → aceite (prova pequena)

Prova pontual de que uma escolha estruturada anterior pode gerar uma sugestão explicada para "Escolha o próximo foco", sem interpretação de texto livre nem motor genérico de regras:

1. a atividade "Problema ou oportunidade" tem um campo `selecao_multipla` (`sinais_situacao`, 7 opções — ver §7);
2. `computeScopeSuggestions` (orientation-engine) lê esse campo e aplica **exatamente duas regras explícitas e específicas** — não uma tabela configurável de sinal→sugestão:
   - `duplicated_information` → sugestão `reuse_existing_information` ("Reaproveitar informações já registradas"), motivo "Sugerido porque você indicou informação duplicada.";
   - `too_many_steps` → sugestão `combine_redundant_steps` ("Reduzir ou combinar etapas redundantes"), motivo "Sugerido porque você indicou excesso de etapas.";
3. na tela "Escolha o próximo foco", sugestões aparecem separadas dos itens reais; a única ação é "Usar sugestão", que pré-preenche o formulário de novo item (texto + `suggestionId`) sem escolher bucket — o usuário ainda precisa escolher Agora/Depois/Fora e confirmar a inclusão; nada entra silenciosamente no escopo;
4. ao aceitar, o `ScopeItem` criado guarda `sourceSuggestionId` igual ao id da sugestão; enquanto existir um `ScopeItem` com esse `sourceSuggestionId`, a sugestão correspondente fica oculta; se o item for excluído, a sugestão reaparece;
5. o usuário pode ignorar uma sugestão simplesmente não a usando — não há botão "Descartar" nem estado de descarte persistido nesta prova.

Se uma terceira regra ou uma segunda fonte de sinal surgir, isso é o sinal para reconsiderar o desenho (generalizar), não para acumular mais regras aqui silenciosamente.

### Fase 3 — Estruturação do projeto (`catalogStatus: complete`)
1. **Definir objetivo e entregáveis** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: objetivo do projeto, entregáveis principais.
2. **Identificar partes interessadas** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: partes interessadas. Opcional: interesse ou influência.
3. **Definir papéis e responsabilidades** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: papéis e responsáveis. Opcional: decisor principal.
4. **Registrar restrições e premissas** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: restrições, premissas.
5. **Identificar riscos do projeto** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: riscos identificados. Opcional: resposta inicial.
6. **Definir comunicação e governança** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: forma de comunicação. Opcional: forma de decisão.

### Fase 4 — Planejamento da entrega (`catalogStatus: complete`)
1. **Decompor o trabalho** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: partes do trabalho.
2. **Priorizar entregas** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: ordem de prioridade. Opcional: critério de priorização.
3. **Mapear dependências** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: dependências entre partes do trabalho (aceita "nenhuma").
4. **Estimar esforço e capacidade** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: estimativa de esforço, capacidade disponível.
5. **Definir marcos** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: marcos principais.
6. **Definir critérios de aceitação** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: critérios de aceitação da entrega.
7. **Consolidar plano de entrega** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: resumo do plano de entrega. Opcional: data-alvo. Não reproduz um quadro de gestão de tarefas — produz um plano inicial em texto estruturado.

### Fase 5 — Execução e acompanhamento (`catalogStatus: complete`)
Cada atividade representa o **retrato atual** da execução, não um histórico — editar uma resposta substitui a anterior. Não há ciclos recorrentes, instâncias repetidas nem histórico de atualizações nesta versão; o usuário revisita e edita essas respostas pelo Mapa.

1. **Definir foco atual da execução** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: foco atual.
2. **Registrar andamento** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: andamento atual.
3. **Identificar e tratar impedimentos** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: impedimentos atuais (aceita "nenhum"). Opcional: tratamento.
4. **Registrar decisões e mudanças** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: decisões ou mudanças recentes.
5. **Atualizar riscos** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: situação atual dos riscos.
6. **Definir próxima ação de acompanhamento** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: próxima ação.

### Fase 6 — Validação e encerramento (`catalogStatus: complete`)
1. **Validar entregas e critérios de aceitação** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: resultado da validação. Opcional: pendências da validação.
2. **Coletar feedback** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: feedback coletado.
3. **Resolver pendências finais** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: pendências finais e como foram resolvidas (aceita "nenhuma").
4. **Registrar lições aprendidas** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: lições aprendidas.
5. **Definir transição e próximos passos** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: forma de transição dos resultados. Opcional: próximos passos possíveis.
6. **Confirmar encerramento do projeto** — `completionMode: required_fields`, `allowsSkip: false` (única exceção além do Resumo da descoberta). Obrigatório: resumo do encerramento. Não usa `explicit_confirmation` — essa `completionMode` é suportada nesta versão do motor apenas para uma única atividade em todo o catálogo (`transitions.ts` localiza "a" atividade de confirmação explícita por `completionMode`, sem receber um id). `required_fields` com `allowsSkip: false` já exige uma decisão explícita (o campo obrigatório não pode ser pulado) sem exigir mudança em `domain/`.

Catálogo completo nesta versão: as seis fases têm `catalogStatus: complete`. Ver `STATE_MACHINE.md` §2 e §4 — com isso, o estado `concluído` do projeto passa a ser alcançável de ponta a ponta.

### Impedimentos: atividade e entidade são complementares, não concorrentes

A atividade `impedimentos_execucao` (Fase 5, acima) e a entidade operacional
`Impediment` (Acompanhamento, `/tracking`; antecipada de Release 3 por decisão
explícita — ver D022 em `docs/07-management/decision-log.md`) tratam de
impedimentos em níveis diferentes e não competem pelo mesmo dado.
`impedimentos_execucao` é um retrato pontual em texto livre, sem
histórico — editar substitui a resposta anterior, como as demais
atividades da Fase 5. `Impediment` é uma coleção independente do catálogo
metodológico (sem `activityDefinitionId`, sem `PendingItem` associado):
cada impedimento é um registro individual, classificado por tipo, com
próxima ação e ciclo aberto/resolvido/reaberto próprio. Nenhum dos dois
deriva ou sobrescreve o outro; a atividade é o registro periódico que
entra no documento de acompanhamento do projeto, Acompanhamento é o
acompanhamento operacional contínuo.
