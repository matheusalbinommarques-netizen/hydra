// Tipos do estado do projeto — ver docs/06-architecture/contracts.md §2.

export type ActivityStatus = 'não_iniciada' | 'em_andamento' | 'concluída' | 'pulada';

export interface Project {
	id: string;
	name: string | null;
	createdAt: string; // ISO 8601
	// Fase do catálogo em que o projeto realmente começa (D023,
	// docs/07-management/decision-log.md) — null/ausente = percurso completo,
	// comportamento idêntico ao anterior a esta decisão. Opcional para que
	// estados antigos (já persistidos ou exportados antes de D023) continuem
	// válidos com a mesma semântica de null, sem exigir backfill.
	routeStartPhaseId?: string | null;
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

// Escopo da "Escolha o próximo foco" (scope_confirmation) — ver
// docs/core/DOMAIN_MODEL.md §7. bucket é escolhido no ato de adicionar o
// item (nunca nasce implícito); effort começa null até o usuário classificar
// e só é exigido/destacado para bucket === 'agora' (fora de agora, um valor
// já definido permanece armazenado — não é limpo ao mover o item, só deixa
// de ser obrigatório); order só é definido para bucket === 'agora', numa
// sequência contígua começando em 0. Não existe mais um eixo de "valor":
// removido deliberadamente por não alimentar nenhuma regra determinística —
// bucket comunica momento, order comunica prioridade dentro de agora, effort
// comunica viabilidade aproximada.
export type ScopeBucket = 'agora' | 'depois' | 'fora';
export type ScopeEffort = 'pequeno' | 'medio' | 'grande';

// Acompanhamento de execução do primeiro backlog executável (etapa 4 do
// roadmap, D025, docs/07-management/decision-log.md) — relevante somente
// para itens em bucket 'agora' e somente após a versão de escopo estar
// confirmada. Independente de ScopeVersion.confirmedAt: alterar o status
// não confirma nem invalida a confirmação. Ausente em itens antigos
// (pré-D025) e tratado como 'a_fazer' pela serialização.
export type ScopeExecutionStatus = 'a_fazer' | 'em_andamento' | 'concluido';

export interface ScopeItem {
	id: string;
	projectId: string;
	text: string;
	bucket: ScopeBucket;
	effort: ScopeEffort | null;
	order: number | null;
	// Rastreia a sugestão estruturada (sinal → sugestão, ver
	// orientation-engine/scope-suggestions.ts) que originou este item, só
	// quando o usuário aceitou explicitamente ("Usar sugestão") — null para
	// todo item adicionado manualmente. Usado exclusivamente para ocultar a
	// sugestão já aceita e deixá-la reaparecer se o item for excluído;
	// editar o texto do item não afeta esta referência.
	sourceSuggestionId: string | null;
	executionStatus?: ScopeExecutionStatus;
	createdAt: string;
	updatedAt: string;
}

// 1:1 com Project, sempre presente desde a criação (mesmo padrão de Project
// em si) — evita branch de "existe ainda?" espalhado pelo código.
export interface ScopeVersion {
	projectId: string;
	hypothesis: string;
	confirmedAt: string | null;
}

// Acompanhamento — vertical 2, fatia "Impedimentos". Coleção
// independente do catálogo metodológico: não referencia nenhuma
// ActivityDefinition, não nasce de uma atividade guiada, não gera
// PendingItem — é manipulada diretamente na tela própria (/tracking). Mesmo
// molde de ScopeItem (id
// próprio, projectId, texto livre, createdAt/updatedAt), mas sem
// bucket/order/effort/sourceSuggestionId: não se aplicam aqui (não há
// "momento" agora/depois/fora, nem estimativa de tamanho, nem sugestão
// estruturada de origem para um impedimento nesta versão). Nenhum cálculo
// de "há quanto tempo está aberto" nem alerta derivado nesta rodada —
// createdAt/updatedAt/resolvedAt só guardam os timestamps; decisão de
// como (e se) usá-los para um sinal fica para uma rodada futura.
export type ImpedimentType =
	| 'dependencia_externa'
	| 'decisao_pendente'
	| 'falta_de_recurso'
	| 'bloqueio_tecnico'
	| 'outro';

export interface Impediment {
	id: string;
	projectId: string;
	text: string;
	tipo: ImpedimentType;
	nextAction: string | null;
	status: 'aberto' | 'resolvido';
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
}

// Mapa de Impacto — Descoberta, "Quem é afetado" (ETAPA 2 do rework, ver
// docs/core/HYDRA_PRODUCT_REWORK.md §32). Objeto vivo real: substitui o
// texto livre antes capturado em `publico_detail` (Answer da atividade
// `publico`) como fonte canônica do público afetado. Mesmo molde de
// ScopeItem/Impediment (id próprio, projectId, createdAt/updatedAt), mas
// ligado à atividade `publico` — ao contrário de Impediment, participa do
// catálogo (completion da atividade deriva do estado dos grupos, ver
// domain/transitions.ts, confirmAffectedGroups).
//
// impact/frequency ausente (null) e "desconhecido" (valor explícito) são
// estados distintos e nunca devem ser confundidos: null = "por classificar"
// (o usuário ainda não respondeu); 'desconhecido' = o usuário respondeu
// explicitamente "Ainda não sabemos". Só null bloqueia a conclusão do mapa —
// 'desconhecido' conta como resposta válida (ver
// getAffectedGroupConfirmationIssues).
export type AffectedGroupImpact = 'alto' | 'medio' | 'baixo' | 'desconhecido';
export type AffectedGroupFrequency = 'constante' | 'frequente' | 'as_vezes' | 'raro' | 'desconhecido';

export interface AffectedGroup {
	id: string;
	projectId: string;
	label: string;
	impact: AffectedGroupImpact | null;
	frequency: AffectedGroupFrequency | null;
	createdAt: string;
	updatedAt: string;
}

// ExternalAction / Evidence — ETAPA 3 do rework ("Evidence + primeira
// External Action", docs/core/HYDRA_PRODUCT_REWORK.md §33). Primeiro corte
// suporta só um tipo de ação: validar um AffectedGroup fora do Hydra.
// Lifecycle mínimo (aberta/concluída, mesmo vocabulário de status de
// Impediment) — sem scheduled/overdue/cancelled/paused/assigned/blocked
// nesta rodada.
//
// A preparação (objective/questions/informationToTake/expectedResult) é
// capturada no momento em que o usuário confirma "Pronto para conversar" e
// nunca recalculada depois — o projeto vivo pode mudar (o AffectedGroup pode
// ser reclassificado), mas o que o Hydra preparou para ESTA ação permanece
// identificável (ver catalog/external-action.ts, buildExternalActionPreparation).
// Independente do catálogo/jornada guiada: não gera ActivityProgress nem
// PendingItem, não bloqueia nenhuma atividade.
export type ExternalActionKind = 'validate_affected_group';
export type ExternalActionStatus = 'aberta' | 'concluida';

export interface ExternalAction {
	id: string;
	projectId: string;
	kind: ExternalActionKind;
	affectedGroupId: string;
	status: ExternalActionStatus;
	objective: string;
	questions: string[];
	informationToTake: string[];
	expectedResult: string;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
}

// Quatro outcomes fixos (ver catalog/external-action.ts,
// EVIDENCE_OUTCOME_OPTIONS). "Tem evidência" nunca significa "está
// validado": uma evidência pode confirmar, contradizer ou trazer algo novo —
// por isso não existe `AffectedGroup.validationStatus`.
export type EvidenceOutcome = 'confirmed' | 'partially_confirmed' | 'contradicted' | 'new_discovery';

export interface Evidence {
	id: string;
	projectId: string;
	externalActionId: string;
	affectedGroupId: string;
	kind: 'conversation';
	outcome: EvidenceOutcome;
	learning: string;
	createdAt: string;
}

// Tratamento atual — Descoberta, "Como é tratado hoje" (Stage 4A do rework,
// ver docs/core/HYDRA_PRODUCT_REWORK.md §34). Objeto vivo real: substitui o
// texto livre antes capturado em `estado_atual_detail` (Answer da atividade
// `estado_atual`) como fonte canônica do tratamento atual. Mesmo espírito de
// AffectedGroup (ligado a uma atividade específica do catálogo, participa da
// conclusão), mas com dois formatos mutuamente exclusivos: uma cadeia
// ordenada de TreatmentStep, ou `noTreatment: true` ("hoje não existe um
// tratamento definido"). CurrentTreatment é 1:1 com o projeto (mesmo molde
// de ScopeVersion) — o cabeçalho que guarda esse flag; TreatmentStep é a
// coleção ordenada (mesmo molde de ScopeItem, com `order` próprio).
//
// Invariante canônica (validada em domain/serialization.ts e reforçada pelas
// próprias transições abaixo, nunca só na interface): o estado persistido
// nunca tem `noTreatment: true` e `treatmentSteps` não vazio ao mesmo tempo.
// addTreatmentStep sempre desliga noTreatment (adicionar um passo real é a
// prova de que existe tratamento); setTreatmentNoTreatment(true) sempre
// remove os passos existentes — sem estado "esquecido" implícito.
export interface CurrentTreatment {
	projectId: string;
	noTreatment: boolean;
	updatedAt: string;
}

// Taxonomia fixa de fricção (ver docs/core/HYDRA_PRODUCT_REWORK.md §34) —
// descreve COMO o tratamento atual funciona, nunca por que o problema
// existe (isso é causa, fora deste corte) e nunca carrega peso/severidade/
// score: é só um rótulo, sem cálculo algum sobre ele.
export type TreatmentFriction = 'espera' | 'retrabalho' | 'improviso' | 'trava';

export interface TreatmentStep {
	id: string;
	projectId: string;
	// Posição na cadeia, 0-based e contígua (mesma regra de ScopeItem.order
	// para "agora") — reordenação (moveTreatmentStep) troca só o `order` de
	// dois passos adjacentes, nunca reescreve a lista inteira.
	order: number;
	// Único dado obrigatório do passo — "o que acontece naquele momento".
	whatHappens: string;
	// Quem atua — contexto opcional, múltiplos atores permitidos. Texto
	// livre curto (rótulo), nunca um vínculo a AffectedGroup: Actor ≠
	// AffectedGroup semanticamente (ver HYDRA_PRODUCT_REWORK.md §34) — o
	// catálogo de sugestões pode usar AffectedGroup como fonte de rótulos,
	// mas o dado persistido aqui é sempre texto solto, sem id nem FK.
	actors: string[];
	// Meio ou ferramenta — contexto opcional, um único valor (texto livre
	// curto, ou uma das sugestões).
	medium: string | null;
	frictions: TreatmentFriction[];
	createdAt: string;
	updatedAt: string;
}

// Hipóteses de causa — Descoberta, "Entender as causas" (Stage 4B do rework,
// Claude Design, "Entender as Causas - 1A Refinada.dc.html"). Objeto vivo
// real, mesmo espírito de AffectedGroup: coleção ligada a uma atividade do
// catálogo (completion deriva do estado estruturado), mas — ao contrário de
// AffectedGroup/CurrentTreatment — a conclusão nunca é bloqueada por estado
// incompleto (ver getCauseHypothesesConfirmationIssues em transitions.ts):
// "ainda não sabemos o que está por trás disso" é um resultado legítimo, não
// uma resposta pendente. Nome deliberadamente `CauseHypothesis`, não
// `Hypothesis` — esse nome já é usado por orientation-engine/hypotheses.ts
// para hipóteses de escopo/solução (campo `hipotese_opt`), um conceito
// diferente; reaproveitar o nome causaria ambiguidade.
//
// `origin` — proveniência/contexto de onde a hipótese surgiu (rótulo do
// "cartão de contexto" usado como ponto de partida, ex.: "Fricção
// observada", ou "Sugestão do Hydra" quando aceita a partir de uma sugestão
// condicional), nunca evidência causal — é só texto de apoio, sem relação
// com Evidence.evidenceIds abaixo.
//
// `evidenceIds` — relação opcional com Evidence já existente (ETAPA 3 do
// rework), nunca um novo tipo de evidência: array de ids (mesmo padrão de
// TreatmentStep.actors/frictions, JSON em TEXT na persistência), validado em
// domain/serialization.ts contra as Evidence reais do projeto. Uma mesma
// Evidence pode ser relacionada a mais de uma hipótese (checkbox
// independente por hipótese no Design Gate, não seleção exclusiva).
//
// `expectedIfTrue`/`whatWeakensIt` — aprofundamento opcional, sempre
// null até o usuário preencher; nunca aparecem como requisito de conclusão.
export interface CauseExploration {
	projectId: string;
	// Estado explícito "ainda não sabemos o que está por trás disso" — nunca
	// alcançável (ver markCauseExplorationUnknown em transitions.ts) enquanto
	// existir qualquer CauseHypothesis, mesma regra já aplicada pela
	// interface no Design Gate (o link só aparece com zero hipóteses): evita
	// a ambiguidade de o que fazer com hipóteses existentes ao ligar este
	// estado, sem precisar de uma transição destrutiva.
	stillUnknown: boolean;
	updatedAt: string;
}

export interface CauseHypothesis {
	id: string;
	projectId: string;
	title: string;
	origin: string | null;
	expectedIfTrue: string | null;
	whatWeakensIt: string | null;
	evidenceIds: string[];
	createdAt: string;
	updatedAt: string;
}

export interface ProjectState {
	project: Project;
	activityProgress: ActivityProgress[];
	answers: Answer[];
	pendingItems: PendingItem[];
	scopeItems: ScopeItem[];
	scopeVersion: ScopeVersion;
	impediments: Impediment[];
	affectedGroups: AffectedGroup[];
	externalActions: ExternalAction[];
	evidences: Evidence[];
	currentTreatment: CurrentTreatment;
	treatmentSteps: TreatmentStep[];
	causeExploration: CauseExploration;
	causeHypotheses: CauseHypothesis[];
}
