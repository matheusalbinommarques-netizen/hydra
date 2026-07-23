# Hydra — Contratos Implementáveis (Conceptual → TypeScript)

**Versão:** 0.4
**Status:** canônico
**Fonte:** `DOMAIN_MODEL.md`, `STATE_MACHINE.md`, `ORIENTATION_ENGINE.md`, `architecture-brief.md` §5

Este documento traduz o modelo conceitual em interfaces e assinaturas de
função TypeScript. Não é código de produção — não há projeto criado ainda
(`app/`), nenhuma dependência escolhida, nenhum corpo de função implementado.

## 1. `domain/` — tipos do catálogo

`FieldDefinition` e `ActivityDefinition` são uniões discriminadas que usam
propriedades `?: never` nos ramos onde um campo não se aplica — isso impede
de verdade combinações inválidas (não é só checagem de excesso de
propriedade em literais), por exemplo `options` fora de `selecao`,
`projectProperty` fora de `dataTarget: 'project_property'`, ou `fields`/
`pendingItemLabel`/`pendingItemDetail` numa atividade `explicit_confirmation`.

```typescript
interface FieldDefinitionBase {
  id: string;
  activityId: string;
  label: string;
  required: boolean;
  placeholder?: string;
  help?: string;
}

type AnswerFieldTypeVariant =
  | { type: 'texto_curto'; options?: never }
  | { type: 'texto_longo'; options?: never }
  | { type: 'selecao'; options: string[] };

type AnswerFieldDefinition = FieldDefinitionBase &
  AnswerFieldTypeVariant & {
    dataTarget: 'answer';
    semanticRole?: 'hypothesis';
    projectProperty?: never;
  };

type ProjectPropertyFieldDefinition = FieldDefinitionBase & {
  dataTarget: 'project_property';
  projectProperty: 'name'; // único caso nesta versão: "Nome provisório"
  type: 'texto_curto';
  semanticRole?: never;
};

export type FieldDefinition = AnswerFieldDefinition | ProjectPropertyFieldDefinition;

export type CompletionMode = 'required_fields' | 'explicit_confirmation';

interface ActivityDefinitionBase {
  id: string;
  phaseId: string;
  order: number;
  title: string;
  mainQuestion: string;
  why: string;
  example: string;
  completionCriteria: string;
}

type RequiredFieldsActivity = ActivityDefinitionBase & {
  completionMode: 'required_fields';
  allowsSkip: boolean;
  fields: FieldDefinition[];
  pendingItemLabel: string;
  pendingItemDetail: string;
};

type ExplicitConfirmationActivity = ActivityDefinitionBase & {
  completionMode: 'explicit_confirmation';
  allowsSkip: false;
  // sem campos e sem textos de pendência — uma atividade de confirmação
  // explícita nunca tem formulário nem pode ser pulada, então nunca gera
  // PendingItem, e não precisa de textos para isso.
  fields?: never;
  pendingItemLabel?: never;
  pendingItemDetail?: never;
};

export type ActivityDefinition = RequiredFieldsActivity | ExplicitConfirmationActivity;

export type CatalogStatus = 'complete' | 'partial' | 'unavailable';

export interface PhaseDefinition {
  id: string;
  order: number;
  label: string;
  catalogStatus: CatalogStatus;
  activities: ActivityDefinition[];
}

export interface Catalog {
  phases: PhaseDefinition[];
}
```

## 2. `domain/` — tipos do estado do projeto

Literais conferidos contra `STATE_MACHINE.md` — coincidem exatamente.
`PendingItem` é uma união discriminada por `status`: só a variante
`resolvida` tem `resolvedAt`, e a variante `aberta` o proíbe explicitamente
via `never` — impossível representar uma pendência aberta com data de
resolução, ou resolvida sem uma.

```typescript
export type ActivityStatus = 'não_iniciada' | 'em_andamento' | 'concluída' | 'pulada';

export interface Project {
  id: string;
  name: string | null;
  createdAt: string; // ISO 8601
}

export interface ActivityProgress {
  projectId: string;
  activityDefinitionId: string;
  status: ActivityStatus;
}

export interface Answer {
  projectId: string;
  activityDefinitionId: string;
  fieldDefinitionId: string; // deve referenciar um AnswerFieldDefinition
  value: string;
  createdAt: string;
  updatedAt: string;
}

interface PendingItemBase {
  id: string;
  projectId: string;
  activityDefinitionId: string;
  createdAt: string;
}

export type PendingItem =
  | (PendingItemBase & { status: 'aberta'; resolvedAt?: never })
  | (PendingItemBase & { status: 'resolvida'; resolvedAt: string });

export interface ProjectState {
  project: Project;
  activityProgress: ActivityProgress[];
  answers: Answer[];
  pendingItems: PendingItem[];
}
```

## 3. `domain/` — resultado compartilhado

```typescript
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

## 4. `domain/` — fábrica (pura)

```typescript
export declare function createInitialProjectState(
  catalog: Catalog,
  projectId: string,
  createdAt: string
): ProjectState;
// gera um Project (name = null) com um ActivityProgress em não_iniciada para
// cada ActivityDefinition do catálogo. projectId e createdAt vêm de fora —
// a função não gera ID nem lê o relógio, permanece pura. A porta de
// persistência (§9) não cria mais o estado inicial, só insere o que a
// fábrica produziu.
```

## 5. `domain/` — operações puras de transição (`STATE_MACHINE.md`)

```typescript
export type DomainTransitionError =
  | { kind: 'activity_not_found' }
  | { kind: 'wrong_completion_mode' }     // ex.: answerActivity numa atividade explicit_confirmation
  | { kind: 'activity_not_skippable' }    // ActivityDefinition.allowsSkip === false
  | { kind: 'unknown_field'; fieldDefinitionId: string } // values referencia um campo que não pertence à atividade
  | { kind: 'transition_not_allowed'; from: ActivityStatus }; // operação não permitida a partir do status atual

export declare function isActivityFieldsValid(
  activity: RequiredFieldsActivity,
  state: ProjectState
): boolean;
// campos com dataTarget='answer' são validados contra state.answers; o único
// campo com dataTarget='project_property' é validado contra state.project.name.
// Deixar um campo obrigatório vazio não é erro — só resulta em boolean false.

export type ProjectStateChange =
  | { kind: 'answer'; activityDefinitionId: string }
  | { kind: 'project_name' };

export declare function shouldInvalidateSummary(
  catalog: Catalog,
  state: ProjectState,
  change: ProjectStateChange
): boolean;
// deriva internamente, a partir do catalog, qual ActivityDefinition tem
// completionMode='explicit_confirmation' (o Resumo) e seu ActivityProgress em
// state. True somente quando o Resumo já está concluída E a mudança afeta
// uma atividade anterior na mesma fase, ou o nome do projeto. Só deve ser
// chamada por answerActivity/renameProject depois que eles já confirmaram
// que o valor novo difere de fato do valor anterior (ver nota abaixo) —
// uma gravação que repete o mesmo valor nunca invalida o Resumo.

export declare function answerActivity(
  catalog: Catalog,
  state: ProjectState,
  activityDefinitionId: string,
  values: Record<string, string>, // fieldDefinitionId -> valor
  occurredAt: string
): Result<ProjectState, DomainTransitionError>;
// só válido para completionMode = 'required_fields'; caso contrário,
// wrong_completion_mode. Um values com chave que não é FieldDefinition da
// atividade produz unknown_field.
//
// Separa o destino de cada valor por dataTarget: campos 'answer' viram/
// atualizam um Answer (createdAt=occurredAt se novo, updatedAt=occurredAt
// sempre); o campo 'project_property' (nome do projeto) atualiza
// state.project.name diretamente — nunca os dois para o mesmo campo.
//
// Compara cada valor novo contra o valor já armazenado (Answer.value ou
// Project.name); só quando pelo menos um valor realmente muda é que
// shouldInvalidateSummary chega a ser avaliada.
//
// Recalcula o status da atividade (regras de edição de STATE_MACHINE.md §1):
// concluída permanece concluída (se continuar válida) ou passa a
// em_andamento (se perder um campo obrigatório) — nunca pulada; pulada
// permanece pulada (preenchimento parcial) ou passa a concluída
// (preenchimento completo, resolvendo a pendência vinculada com
// resolvedAt=occurredAt). Não existe transição concluída → pulada nesta
// função.

export declare function confirmSummary(
  catalog: Catalog,
  state: ProjectState
): Result<ProjectState, DomainTransitionError>;
// só válido para a atividade com completionMode = 'explicit_confirmation'
// (Resumo); se o catálogo não tiver uma, activity_not_found. Válido a partir
// de não_iniciada ou em_andamento; se o Resumo já estiver concluída,
// transition_not_allowed. Marca a atividade como concluída. Não aceita
// values — operação deliberadamente separada de answerActivity. Sem
// timestamps a produzir (ActivityProgress não tem campo de tempo).

export declare function skipActivity(
  catalog: Catalog,
  state: ProjectState,
  activityDefinitionId: string,
  newPendingItemId: string,
  occurredAt: string
): Result<ProjectState, DomainTransitionError>;
// só válido quando ActivityDefinition.allowsSkip === true; caso contrário,
// activity_not_skippable (o que já exclui estruturalmente qualquer atividade
// explicit_confirmation). Válido a partir de não_iniciada ou em_andamento;
// se o status atual já for concluída ou pulada, transition_not_allowed.
//
// Cria um PendingItem novo (id=newPendingItemId, status='aberta',
// createdAt=occurredAt) SOMENTE se nenhum PendingItem já existir para o par
// (projectId, activityDefinitionId) em state.pendingItems — em qualquer
// status, aberta ou resolvida. Essa checagem cobre todo o ciclo de vida: uma
// atividade nunca acumula uma segunda pendência mesmo que a primeira já
// tenha sido resolvida.

export declare function renameProject(
  catalog: Catalog,
  state: ProjectState,
  name: string
): Result<ProjectState, DomainTransitionError>;
// atualiza Project.name. Só avalia shouldInvalidateSummary com
// { kind: 'project_name' } quando name difere do state.project.name atual
// — renomear para o mesmo nome não invalida o Resumo. Nesta versão não
// produz nenhum DomainTransitionError na prática, mas mantém o tipo Result
// por consistência com as demais transições.
```

## 6. `domain/` — serialização JSON (exportação/importação do Walking Skeleton)

Já previstas em `TECHNICAL_BRIEF.md` §6 e §14. O JSON exportado é versionado;
a importação valida forma, versão, referências contra o catálogo, e as
invariantes completas do agregado — não só que os IDs referenciados existem,
mas que o conjunto de dados é consistente como um todo. A checagem de
colisão de ID **não** entra aqui — depende de consultar persistência
(impuro) e fica na camada de aplicação (§10), usando
`ProjectRepository.findById`, sem adicionar um método de listagem à porta.

```typescript
export interface ExportedProjectState {
  version: 1;
  state: ProjectState;
}

export type ProjectStateParseError =
  | { kind: 'invalid_json' }
  | { kind: 'unsupported_version'; found: number }
  | { kind: 'invalid_shape'; details: string }
  | { kind: 'invalid_reference'; details: string }   // ex.: fieldDefinitionId/activityDefinitionId inexistente no catálogo
  | { kind: 'invariant_violation'; details: string }; // ver lista abaixo

export declare function serializeProjectState(state: ProjectState): string;
// serializa como ExportedProjectState (com version: 1).

export declare function deserializeProjectState(
  json: string,
  catalog: Catalog
): Result<ProjectState, ProjectStateParseError>;
// trata a entrada como não confiável (TECHNICAL_BRIEF.md §11) — nunca lança
// exceção, sempre retorna Result. Valida, nesta ordem: JSON sintaticamente
// válido; version === 1; forma de ExportedProjectState/ProjectState; e as
// invariantes do agregado:
//
// - existe exatamente uma ActivityProgress por ActivityDefinition do
//   catálogo (nem faltando, nem duplicada, nem para uma atividade
//   inexistente);
// - toda Answer referencia um FieldDefinition que pertence à mesma
//   ActivityDefinition indicada, e cujo dataTarget é 'answer' (nunca
//   'project_property' — DOMAIN_MODEL.md §6);
// - no máximo um PendingItem por par (activityDefinitionId), em qualquer
//   status, em todo o conjunto;
// - todo PendingItem referencia uma ActivityDefinition com
//   allowsSkip === true;
// - nenhuma ActivityProgress de uma atividade explicit_confirmation tem
//   status 'pulada'.
```

## 7. `catalog/` — nota

`catalog/` importa os tipos de `domain/` (§1) e exporta uma constante
`catalog: Catalog` com os dados literais já descritos em `DOMAIN_MODEL.md`
§7. Nenhum tipo novo — só a instância de dados, escrita quando o projeto for
criado. Por ser estático e sem estado de projeto, `routes/` pode importar
`catalog/` diretamente para renderização (títulos, perguntas, exemplos) —
essa é a única fonte de dados que `routes/` pode acessar fora do DTO
retornado pela camada de aplicação (§10).

## 8. `orientation-engine/` — tipos e funções puras (`ORIENTATION_ENGINE.md`)

Literais de `PhaseStatus`/`ProjectStatus` conferidos contra
`STATE_MACHINE.md` — coincidem exatamente.

```typescript
export type PhaseStatus = 'não_iniciada' | 'em_andamento' | 'concluída_com_pendências' | 'concluída';
export type ProjectStatus = 'rascunho' | 'em_andamento' | 'concluído';

export type NextActivityResult =
  | { kind: 'recommendation'; activityDefinitionId: string }
  | { kind: 'catalog_limit_reached' };

export interface PendingItemView {
  id: string;
  activityDefinitionId: string;
  label: string;   // de ActivityDefinition.pendingItemLabel
  detail: string;  // de ActivityDefinition.pendingItemDetail
}

export interface HypothesisView {
  text: string;
}

export interface OrientationSnapshot {
  projectStatus: ProjectStatus;
  phaseStatuses: Record<string, PhaseStatus>; // por PhaseDefinition.id
  nextActivity: NextActivityResult;           // Trilha A
  openPendingItems: PendingItemView[];        // Trilha B
  hypotheses: HypothesisView[];
}

export declare function computePhaseStatus(
  phase: PhaseDefinition,
  activityProgress: ActivityProgress[],
  pendingItems: PendingItem[]
): PhaseStatus;

export declare function computeProjectStatus(
  project: Project,
  catalog: Catalog,
  activityProgress: ActivityProgress[]
): ProjectStatus;

export declare function computeNextActivity(
  catalog: Catalog,
  activityProgress: ActivityProgress[]
): NextActivityResult; // Trilha A — nunca retorna pulada/concluída

export declare function computeOpenPendingItems(
  catalog: Catalog,
  pendingItems: PendingItem[]
): PendingItemView[]; // Trilha B

export declare function computeHypotheses(
  catalog: Catalog,
  answers: Answer[]
): HypothesisView[]; // Answers cujo FieldDefinition.semanticRole === 'hypothesis'

export declare function computeSnapshot(
  catalog: Catalog,
  state: ProjectState
): OrientationSnapshot; // combina as funções acima
```

Nenhuma dessas funções acessa `server/persistence/` — recebem estado e
catálogo já carregados (`architecture-brief.md` §5).

## 9. `server/persistence/` — porta do repositório

```typescript
export interface ProjectRepository {
  insert(state: ProjectState): Promise<void>;
  findById(projectId: string): Promise<ProjectState | null>;
  save(state: ProjectState): Promise<void>;
  // save grava atomicamente o estado resultante de uma operação (o id já
  // está em state.project.id). A estratégia interna (reescrita completa,
  // diffs, transação) não é parte deste contrato — fica para a
  // implementação concreta (ORM/driver a decidir, architecture-brief.md §9).
}
```

## 10. `server/application/` — DTO, erros e casos de uso

`routes/` nunca recebe `ProjectState` bruto — só o DTO `ProjectView`, e pode
importar `catalog/` diretamente para renderização (§7).

```typescript
export interface ProjectView {
  projectId: string;
  projectName: string | null;
  projectStatus: ProjectStatus;
  phaseStatuses: Record<string, PhaseStatus>;
  activityStatuses: Record<string, ActivityStatus>; // por activityDefinitionId
  answers: Record<string, string>; // fieldDefinitionId -> valor
  nextActivity: NextActivityResult;
  openPendingItems: PendingItemView[];
  hypotheses: HypothesisView[];
}

export type UseCaseError =
  | { kind: 'project_not_found' }
  | { kind: 'invalid_import'; reason: ProjectStateParseError }
  | { kind: 'import_id_collision'; projectId: string }
  | DomainTransitionError;

export type UseCaseOutcome<T> = Result<T, UseCaseError>;

export interface AnswerActivityInput {
  projectId: string;
  activityDefinitionId: string;
  values: Record<string, string>;
}

export interface SkipActivityInput {
  projectId: string;
  activityDefinitionId: string;
}

export interface ConfirmSummaryInput {
  projectId: string;
}

export interface RenameProjectInput {
  projectId: string;
  name: string;
}

export interface ProjectUseCases {
  createProject(): Promise<UseCaseOutcome<ProjectView>>;
  loadProjectView(projectId: string): Promise<UseCaseOutcome<ProjectView>>;
  renameProject(input: RenameProjectInput): Promise<UseCaseOutcome<ProjectView>>;
  answerActivity(input: AnswerActivityInput): Promise<UseCaseOutcome<ProjectView>>;
  skipActivity(input: SkipActivityInput): Promise<UseCaseOutcome<ProjectView>>;
  confirmSummary(input: ConfirmSummaryInput): Promise<UseCaseOutcome<ProjectView>>;
  exportProject(projectId: string): Promise<UseCaseOutcome<string>>;   // JSON versionado
  importProject(json: string): Promise<UseCaseOutcome<ProjectView>>;
}
```

Cada caso de uso gera IDs/timestamps (impuro) e os passa às funções puras de
`domain/` (§4, §5). Fluxo típico: carregar via `findById` (ou criar via
`createInitialProjectState` + `insert`, em `createProject`) → chamar a
transição pura correspondente, tratando seu `Result` → se `ok`, persistir via
`save` → chamar `computeSnapshot` (§8) → montar `ProjectView` combinando o
snapshot com os dados brutos do estado resultante. `importProject`: chama
`deserializeProjectState` (pura); se `ok`, consulta `findById` com o id
resultante — se já existir, retorna `import_id_collision`; senão, `insert` e
monta o `ProjectView`.

## 11. O que este documento não decide

- validação de entrada em detalhe (biblioteca a escolher — `architecture-brief.md` §9);
- driver/ORM concreto por trás de `ProjectRepository`;
- serialização exata em SQLite (nomes de tabela/coluna, tipos SQL);
- runner de testes;
- dados literais do catálogo (permanecem em `DOMAIN_MODEL.md` §7 até a criação do projeto).
