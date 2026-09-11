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

// workItemId (ETAPA 6 do rework, "Primeiro loop operacional") — vínculo
// opcional com o WorkItem que este impedimento está bloqueando. null é o
// caso normal e continua totalmente válido: Impediment sempre pôde existir
// no nível do projeto, sem relação com nenhum item de trabalho, e essa
// possibilidade não muda aqui (ver HYDRA_PRODUCT_REWORK.md §36). Cardinalidade
// é 1 Impediment → no máximo 1 WorkItem — o inverso (múltiplos impedimentos
// bloqueando o mesmo WorkItem) é permitido pelo schema, mesmo que a interface
// desta rodada só crie um de cada vez.
export interface Impediment {
	id: string;
	projectId: string;
	text: string;
	tipo: ImpedimentType;
	nextAction: string | null;
	status: 'aberto' | 'resolvido';
	workItemId: string | null;
	createdAt: string;
	updatedAt: string;
	resolvedAt: string | null;
}

// WorkItem — ETAPA 6 do rework ("Primeiro loop operacional", D035,
// docs/core/HYDRA_PRODUCT_REWORK.md §35/§36). Camada de execução, distinta de
// Deliverable (camada de priorização/escopo, ainda não introduzida nesta
// etapa — ver D035): unidade executável mínima capaz de provar o loop
// WorkItem → Trabalho → mudança de estado → Impediment → Acompanhamento →
// ação → estado atualizado. Não reaproveita ScopeItem.executionStatus (D025):
// esse campo é compatibilidade histórica, não o modelo canônico (D035).
//
// "Bloqueado" nunca é um status nem uma coluna própria — é sempre condição
// derivada de existir um Impediment com status 'aberto' e workItemId
// apontando para este item (ver hasOpenImpediment em transitions.ts). Um
// WorkItem com impedimento ativo não pode transicionar para 'concluido'
// (moveWorkItem recusa a transição — ver transitions.ts).
//
// Nasce direto em Trabalho nesta etapa — promoção de PlanningItem para
// WorkItem fica fora deste corte (D035 permanece válida para o futuro).
// Nenhum metadado além do estritamente necessário para mover trabalho
// (responsável, prazo, prioridade, estimativa ficam para etapas futuras).
export type WorkItemStatus = 'a_fazer' | 'em_andamento' | 'concluido';

// deliverableId (ETAPA 9 do rework, "Estruturação e Planejamento
// reworkados", segundo microcorte, D043/D044) — vínculo opcional com a
// Deliverable de origem. Cardinalidade: 1 Deliverable → 0..N WorkItem,
// WorkItem → 0..1 Deliverable (contrato já congelado em D043). null é
// estado normal e permanece totalmente legítimo — WorkItem sempre pôde
// (e continua podendo) existir sem nenhuma entrega. Associação é
// mutável e explícita (setWorkItemDeliverable em transitions.ts), nunca
// inferida por título, ScopeItem, PlanningItem, posição, bucket ou
// Milestone. Remover a Deliverable NÃO remove o WorkItem: o vínculo é
// posto a null (removeDeliverable em transitions.ts), o WorkItem
// sobrevive desassociado. Associar/desassociar/trocar nunca altera
// status, Dependency, Impediment, Milestone ou timestamps de outros
// objetos — só este campo (e updatedAt do próprio WorkItem) muda.
export interface WorkItem {
	id: string;
	projectId: string;
	title: string;
	status: WorkItemStatus;
	deliverableId: string | null;
	createdAt: string;
	updatedAt: string;
}

// Dependency — ETAPA 8 do rework ("Dependency + Milestone + Roadmap/Timeline",
// docs/core/HYDRA_PRODUCT_REWORK.md §38), primeiro microcorte. Relação de
// precedência/prontidão planejada entre dois WorkItem do mesmo projeto: "A
// depende da conclusão de B; enquanto B não estiver concluído, A está
// aguardando B". NÃO significa "A é tecnicamente proibido de ser concluído
// enquanto B não concluir" — Dependency nunca é bloqueio operacional. O único
// mecanismo de bloqueio real continua sendo Impediment (D036): moveWorkItem
// não ganha nenhuma recusa nova por causa de Dependency.
//
// Vive na camada de execução (WorkItem), não na de escopo/priorização —
// D035 já registra WorkItem como a unidade que teria "Dependency/
// AcceptanceCriterion/Responsible próprios", e a cadeia conceitual do §12
// coloca Dependency abaixo de WorkItem. Não é dependência externa: uma
// espera externa que já bloqueia é um Impediment com tipo
// `dependencia_externa`, e continua sendo — o vínculo Impediment →
// Dependency previsto no §13.4 fica explicitamente DEFER neste corte, não
// reconciliado.
//
// Sem status próprio, por design (mesmo espírito de "bloqueado nunca é
// persistido", D036): "aguardando" vs "pronto" é sempre derivado do status
// do predecessor (`dependsOnWorkItemId` concluído ou não), nunca gravado.
// Imutável depois de criada — só existe adicionar e remover (mesmo molde de
// Evidence, sem `updatedAt`). Nenhum metadado de scheduling (tipo de
// precedência, lag, datas, responsável) nesta rodada.
export interface Dependency {
	id: string;
	projectId: string;
	// O WorkItem que depende (o que aguarda).
	workItemId: string;
	// O WorkItem que precisa ser concluído antes (o predecessor).
	dependsOnWorkItemId: string;
	createdAt: string;
}

// Milestone — ETAPA 8 do rework ("Dependency + Milestone + Roadmap/Timeline",
// docs/core/HYDRA_PRODUCT_REWORK.md §38), segundo microcorte. Checkpoint de
// progresso DECLARADO no nível do projeto: um ponto verificável que a equipe
// reconhece como "chegamos aqui". Um marco não é executado — é alcançado;
// ninguém trabalha "no marco", trabalha nos itens que o tornam verdadeiro.
//
// Distinto de WorkItem (unidade executável que se move no board), de
// Dependency (precedência entre dois trabalhos) e de ScopeItem (o que entra
// no escopo).
//
// `plannedDate` (ETAPA 8 do rework, terceiro microcorte de Milestone) é "o
// dia em que a equipe planeja alcançar este marco": INTENÇÃO declarada pelo
// usuário, opcional, e nada além disso. Nasce junto do seu primeiro leitor
// real (a Linha do tempo em Acompanhamento) — sem leitor, seria campo morto,
// e foi por isso que o corte anterior deliberadamente não o criou.
//
// Não é prazo (compromisso com consequência), não é duração, não é baseline,
// não é atraso e não é scheduling: nenhum outro objeto lê esta data para
// decidir nada, não existe início/fim, não existe propagação e não existe
// comparação automática com reachedAt (variação é §42). Também é distinta de
// createdAt/updatedAt (fatos de sistema, escritos pelo Clock) e de reachedAt
// (fato consumado, instante gravado pelo Clock).
//
// Representação: data CIVIL estrita `YYYY-MM-DD`, nunca timestamp — a
// semântica é dia, não instante, e um instante seria deslocado de um dia por
// qualquer formatação com timezone. Validada por isCivilDate (transitions.ts)
// no domínio e na desserialização, nunca por Date.parse, que aceitaria
// timestamp completo. Nunca deve passar por `new Date(...)` em round-trip ou
// formatação.
//
// Completamente ortogonal ao lifecycle abaixo: definir, reagendar ou limpar a
// data não muda `status`, não muda `reachedAt`, não alcança nem reabre o
// marco, não altera WorkItem e não afeta Dependency. Um marco alcançado com
// plannedDate futura OU passada é estado legítimo, exibido como fato
// declarado — o Hydra não corrige nem interpreta essa combinação.
//
// `status` declarado é a ÚNICA autoridade sobre aberto/alcancado: nenhum
// caminho do domínio o deriva de trabalho relacionado (ver
// MilestoneWorkItem abaixo). Vocabulário deliberadamente distinto de
// WorkItem — marco é "alcançado", item de trabalho é "concluído".
//
// Invariante fechada do lifecycle, garantida por reachMilestone/
// reopenMilestone (que alteram o par atomicamente), reforçada na
// desserialização e por CONSTRAINT nomeada no schema:
//   aberto    => reachedAt === null
//   alcancado => reachedAt !== null
//
// Sem `description`, sem `order` (ordenação é Roadmap, §38) e sem rename/
// remoção nesta rodada — mesma superfície mínima que WorkItem tem hoje.
export type MilestoneStatus = 'aberto' | 'alcancado';

export interface Milestone {
	id: string;
	projectId: string;
	title: string;
	status: MilestoneStatus;
	reachedAt: string | null;
	// Data civil YYYY-MM-DD, ou null quando o marco não tem data planejada
	// (caso normal e permanentemente válido). Ver comentário acima.
	plannedDate: string | null;
	createdAt: string;
	updatedAt: string;
}

// MilestoneWorkItem — relação N:N opcional entre Milestone e WorkItem do
// mesmo projeto. Significa "trabalho relacionado/contribuinte para este
// marco", e NUNCA "conjunto exaustivo de condições necessárias":
//
// - marco pode existir sem nenhum WorkItem associado;
// - WorkItem pode existir sem nenhum marco;
// - o usuário associa apenas os trabalhos que considerar relevantes;
// - WorkItem aberto NÃO impede reachMilestone;
// - WorkItem concluído NÃO alcança o marco automaticamente.
//
// Portanto um marco explicitamente alcançado pode legitimamente coexistir
// com trabalho relacionado ainda aberto. A contagem derivada na view é
// CONTEXTO ("3 de 5 trabalhos relacionados concluídos"), nunca percentual,
// progresso ou status do marco.
//
// Imutável depois de criada — só existe associar e desassociar (mesmo molde
// de Dependency/Evidence, sem `updatedAt`). Par duplicado é inválido.
export interface MilestoneWorkItem {
	id: string;
	projectId: string;
	milestoneId: string;
	workItemId: string;
	createdAt: string;
}

// Risk — ETAPA 10 do rework ("Risk como objeto vivo",
// docs/core/HYDRA_PRODUCT_REWORK.md §40), primeiro microcorte (D049).
// Objeto em nível de projeto, sem vínculo obrigatório com WorkItem,
// Deliverable, Milestone, Impediment, Issue ou pessoa/responsável — essa
// associação fica deliberadamente para uma fatia futura.
//
// Substitui, como fonte de escrita, os três campos de texto livre
// legados (`riscos_identificados`, `resposta_inicial_riscos` em
// `riscos_projeto`; `riscos_atualizados` em `atualizar_riscos`), que
// passam a READ-LEGACY (ver domain/legacy-answers.ts).
//
// `status` é declarado, nunca inferido: nenhum caminho do domínio deriva
// `encerrado` de nenhum outro objeto. `encerrado` significa apenas "não
// está mais sendo acompanhado como risco ativo" — não significa que o
// risco ocorreu, foi mitigado, foi aceito ou virou impedimento.
//
// Invariante fechada do lifecycle, garantida por closeRisk/reopenRisk
// (que alteram o par atomicamente) e reforçada na desserialização:
//   aberto    => closedAt === null
//   encerrado => closedAt !== null
//
// Sem probabilidade, impacto, severidade, score, resposta estruturada,
// owner ou delete nesta primeira fatia — editar a declaração e
// encerrar/reabrir cobrem a necessidade inicial.
//
// reviewedAt (ETAPA 10 do rework, segundo microcorte) — instante da última
// revisão confirmada, `null` até a primeira. Fato individual do Risk, sem
// histórico, sem contagem, sem nota, sem usuário/responsável da revisão, e
// sem qualquer noção de periodicidade/prazo/atraso: é só "quando alguém
// olhou para este risco por último". editRiskStatement, closeRisk e
// reopenRisk já provam reconsideração real e também o atualizam — reviewRisk
// (abaixo) existe para o caso em que a revisão não muda mais nada. Nunca
// decide lifecycle nem promove o Risk a "Precisa de você"/Atenções.
export type RiskStatus = 'aberto' | 'encerrado';

export interface Risk {
	id: string;
	projectId: string;
	// Declaração textual obrigatória do risco.
	statement: string;
	status: RiskStatus;
	closedAt: string | null;
	reviewedAt: string | null;
	createdAt: string;
	updatedAt: string;
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

// Resultado desejado — Descoberta, "Resultado desejado" (Stage 4C do rework,
// ver docs/core/HYDRA_PRODUCT_REWORK.md §32). Objeto vivo real: substitui o
// texto livre antes capturado em `mudanca`/`beneficiario`/`percepcao`
// (Answers da atividade `resultado`) como fonte canônica. Mesmo espírito de
// AffectedGroup (coleção ligada à atividade, participa da conclusão — ao
// contrário de CauseHypothesis), com ordenação própria (mesmo molde de
// TreatmentStep.order: 0-based contígua, swap adjacente em moveDesiredOutcome).
//
// `change` é o único dado obrigatório (a mudança esperada); `target` é um
// alvo quantitativo opcional, sempre texto livre curto (nunca number+unit:
// decisão explícita — o Hydra não deve obrigar o usuário a inventar um KPI,
// ver HYDRA_PRODUCT_REWORK.md §32). `beneficiario`/`percepcao` do modelo
// antigo não têm equivalente aqui — AffectedGroup já representa quem é
// afetado; duplicar esse conceito dentro de DesiredOutcome não foi
// autorizado (ver domain/legacy-answers.ts, READ-LEGACY dos três campos).
export interface DesiredOutcome {
	id: string;
	projectId: string;
	change: string;
	target: string | null;
	order: number;
	createdAt: string;
	updatedAt: string;
}

// Deliverable — ETAPA 9 do rework ("Do escopo ao trabalho — corredor de
// entrega", Design Gate S9), primeiro microcorte. Camada de
// priorização/escopo, distinta de ScopeItem e de WorkItem: é o que este
// projeto DECIDIU entregar, com recorte (bucket) e prioridade relativa
// próprios. D035 já registrava Deliverable como a camada que faltava entre
// escopo e execução; aqui ela nasce como objeto vivo canônico.
//
// Deliberadamente ausentes neste corte (não são "ainda não implementados"
// por esquecimento — são fora do contrato): description, status, progress,
// responsible, acceptance criteria, datas e qualquer relação com WorkItem.
// Concluir trabalho nunca conclui uma entrega, e nenhum agregado/percentual
// é derivado daqui. O contrato futuro já congelado é 1 Deliverable → 0..N
// WorkItem e WorkItem → 0..1 Deliverable, ainda NÃO implementado.
//
// bucket/effort usam tipos PRÓPRIOS, mesmo que os literais coincidam hoje
// com ScopeBucket/ScopeEffort: são vocabulários de objetos diferentes e
// devem poder divergir sem arrastar o outro.
export type DeliverableBucket = 'agora' | 'depois' | 'fora';
export type DeliverableEffort = 'pequeno' | 'medio' | 'grande';

export interface Deliverable {
	id: string;
	projectId: string;
	title: string;
	bucket: DeliverableBucket;
	// null = "esforço ainda não estimado" (estado normal e permanentemente
	// válido, inclusive em 'agora' — ao contrário de ScopeItem, nada aqui
	// exige effort para confirmar coisa alguma).
	effort: DeliverableEffort | null;
	// Só definido para bucket === 'agora', em sequência contígua começando em
	// 0 (mesma regra de ScopeItem.order). Fora de 'agora' é sempre null: a
	// ordem só é semanticamente válida no recorte atual.
	order: number | null;
	// PROVENIÊNCIA imutável, nunca canal de sincronização (CONFIRM-TO-CONVERT):
	// registra de qual ScopeItem esta entrega foi promovida por ação explícita
	// do usuário. null para entrega nativa. Único quando não-null.
	//
	// Não existe propagação em nenhuma direção: editar a Deliverable nunca
	// reescreve o ScopeItem, editar o ScopeItem nunca altera a Deliverable, e
	// remover o ScopeItem de origem NÃO remove nem altera a Deliverable —
	// proveniência órfã é estado VÁLIDO. Por isso a persistência
	// deliberadamente não cria FK operacional para scope_item.
	//
	// sourceSuggestionId e executionStatus do ScopeItem NÃO atravessam a
	// promoção: são semântica da camada de escopo (D025 / sugestões
	// estruturadas) e não têm equivalente aqui.
	sourceScopeItemId: string | null;
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
	deliverables: Deliverable[];
	impediments: Impediment[];
	workItems: WorkItem[];
	dependencies: Dependency[];
	milestones: Milestone[];
	milestoneWorkItems: MilestoneWorkItem[];
	risks: Risk[];
	affectedGroups: AffectedGroup[];
	externalActions: ExternalAction[];
	evidences: Evidence[];
	currentTreatment: CurrentTreatment;
	treatmentSteps: TreatmentStep[];
	causeExploration: CauseExploration;
	causeHypotheses: CauseHypothesis[];
	desiredOutcomes: DesiredOutcome[];
}
