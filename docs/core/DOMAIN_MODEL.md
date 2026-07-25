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
- `completionMode: required_fields | explicit_confirmation`
- `allowsSkip: boolean`
- `pendingItemLabel`, `pendingItemDetail` (texto exibido quando esta atividade gera uma pendência por skip — usado em vez de persistir texto por instância)
- `fields: FieldDefinition[]` (ordenados)

`completionMode`:
- `required_fields` — a atividade conclui quando todos os campos obrigatórios estão válidos e o usuário salva. Modo padrão de todas as atividades com formulário.
- `explicit_confirmation` — a atividade conclui por uma ação explícita do usuário (ex.: clicar "Continuar"), independente de campos. Único uso nesta versão: "Resumo da descoberta" (que não tem campos próprios e não permite pular — `allowsSkip = false`).

### FieldDefinition
- `id`
- `activityId`
- `label`
- `required: boolean`
- `type` (texto curto | texto longo | seleção)
- `options` (quando seleção)
- `placeholder` / `help`
- `dataTarget: project_property | answer` (default `answer`)
- `projectProperty` (presente somente quando `dataTarget = project_property`; nome da propriedade de `Project` atualizada por este campo)
- `semanticRole` (opcional; ex.: `hypothesis` — marca campos cujo conteúdo deve ser exibido como hipótese)

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

## 4. Contexto — nota de modelagem

Não existe uma entidade `Context` persistida separadamente do Projeto. `Project` guarda apenas identidade e metadados. Quando a interface ou o motor precisarem de um `ProjectContext` (modo de trabalho, nível de experiência, estágio atual), ele é **derivado por projeção** a partir das `Answer` da atividade "Contexto inicial" — nunca duplicado como estado próprio.

## 5. Hipóteses — projeção, não entidade

Não existe `Hypothesis` persistida nesta versão. Hipóteses exibidas (ex.: em Registros) são **derivadas** em tempo de leitura: toda `Answer` cujo `FieldDefinition.semanticRole == hypothesis` e valor não vazio é apresentada como uma hipótese. Nesta versão do catálogo, o único campo com esse papel é o campo opcional "hipótese" da atividade "Problema ou oportunidade".

## 6. Relações

```text
PhaseDefinition 1───N ActivityDefinition
ActivityDefinition 1───N FieldDefinition

Project 1───N ActivityProgress   (uma por ActivityDefinition do catálogo)
Project 1───N Answer             (uma por FieldDefinition com dataTarget=answer respondido)
Project 1───N PendingItem

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
3. **Problema ou oportunidade** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: situação que precisa mudar, principal dificuldade. Opcionais: evidências, consequências de não agir, hipótese (`semanticRole: hypothesis`), solução imaginada, observações.
4. **Público afetado** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: público afetado em detalhe.
5. **Estado atual** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: estado atual em detalhe.
6. **Resultado desejado** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: mudança esperada, beneficiário, percepção de melhoria.
7. **Resumo da descoberta** — `completionMode: explicit_confirmation`, `allowsSkip: false`. Sem campos próprios; conclui quando o usuário revisa e clica "Continuar". Sujeito à regra de invalidação — ver `STATE_MACHINE.md` §3.

### Fase 2 — Definição do produto (`catalogStatus: partial`)
1. **Definir usuário principal** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: descrição do usuário principal.
2. **Definir visão do produto** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: tipo de produto, necessidade central, benefício central (`dataTarget: answer`). Opcional: diferencial.
3. **Definir funcionalidades essenciais** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: funcionalidades essenciais, valor entregue (`dataTarget: answer`). Opcional: fora do escopo inicial.

Demais atividades desta fase não estão catalogadas nesta versão.

### Fases 3 a 6 (`catalogStatus: unavailable`)
- Estruturação do projeto
- Planejamento da entrega
- Execução e acompanhamento
- Validação e encerramento

Nenhuma `ActivityDefinition` catalogada. Ver `STATE_MACHINE.md` §2 para o efeito disso no status de fase e projeto.
