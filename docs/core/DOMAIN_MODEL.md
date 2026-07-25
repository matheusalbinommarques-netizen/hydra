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

### Fase 2 — Definição do produto (`catalogStatus: complete`)
1. **Definir usuário principal** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatório: descrição do usuário principal.
2. **Definir visão do produto** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: tipo de produto, necessidade central, benefício central (`dataTarget: answer`). Opcional: diferencial.
3. **Definir funcionalidades essenciais** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: funcionalidades essenciais, valor entregue (`dataTarget: answer`). Opcional: fora do escopo inicial.
4. **Priorizar primeira versão** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: o que entra na primeira versão, o que fica para depois, hipótese a validar (`semanticRole: hypothesis`).
5. **Definir critérios de sucesso do produto** — `completionMode: required_fields`, `allowsSkip: true`. Obrigatórios: sinais de sucesso, evidências ou indicadores, condição mínima de validação.

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
