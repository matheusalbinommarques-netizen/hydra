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

export interface ProjectState {
	project: Project;
	activityProgress: ActivityProgress[];
	answers: Answer[];
	pendingItems: PendingItem[];
	scopeItems: ScopeItem[];
	scopeVersion: ScopeVersion;
	impediments: Impediment[];
	affectedGroups: AffectedGroup[];
}
