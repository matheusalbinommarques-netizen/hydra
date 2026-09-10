// Projeção pura de leitura para a Tela Registros — cruza catalog/ (estático)
// com os campos já expostos por ProjectView (respostas, histórico de
// pendências resolvidas e status de atividade). Não lê nem grava
// persistência, não conhece ProjectState bruto.
//
// Pendências abertas não fazem parte deste contrato: já pertencem a
// Acompanhamento (síntese de atenções, tracking-view.ts) e a Agora (ponto de
// resolução) — mostrá-las aqui duplicaria o mesmo dado sob outro nome
// (auditoria de sustentação semântica das categorias do mockup, etapa 7.4).

import { decodeMultiSelectValue, decodePlanningItems } from '$lib/domain';
import type { ActivityDefinition, ActivityStatus, Catalog, ImpedimentType, ProjectEvent, WorkItemStatus } from '$lib/domain';

export interface RecordsPendingItemInput {
	id: string;
	activityDefinitionId: string;
	label: string;
	detail: string;
	status: 'aberta' | 'resolvida';
	createdAt: string;
	resolvedAt?: string;
}

// Event log incremental (ETAPA 7 do rework, "Event log incremental") —
// menor entrada suficiente para nomear o WorkItem em work_item.status_changed
// (o evento em si só carrega fromStatus/toStatus, nunca o título — ver
// domain/events.ts). title é lido do estado atual (WorkItem não tem
// operação de renomear nesta versão, então é sempre o mesmo título de quando
// o evento aconteceu).
export interface RecordsWorkItemInput {
	id: string;
	title: string;
}

// Mesmo espírito de RecordsWorkItemInput acima — Impediment.text é imutável
// depois de criado (sem operação de editar o texto nesta versão), então o
// estado atual sempre corresponde ao texto de quando o evento aconteceu.
export interface RecordsImpedimentInput {
	id: string;
	text: string;
}

export interface RecordsViewInput {
	projectId: string;
	answers: Record<string, string>;
	pendingItemHistory: RecordsPendingItemInput[];
	activityStatuses: Record<string, ActivityStatus>;
	// Opcionais (default []): testes/chamadores anteriores à S7 continuam
	// válidos sem tocar no event log, mesmo espírito aditivo já usado em
	// ProjectState (workItems/causeHypotheses ausentes viram coleção vazia).
	events?: ProjectEvent[];
	workItems?: RecordsWorkItemInput[];
	impediments?: RecordsImpedimentInput[];
	// entityId(s) da query string (Design Gate S7 — estado filtrado) — só os
	// ids usados para FILTRAR, não os que aparecem nos eventos resultantes
	// (podem divergir: "Ver mudanças relacionadas" filtra por WorkItem +
	// Impediment, mas o chip nomeia o WorkItem mesmo quando só eventos do
	// Impediment aparecem na lista). Ausente/vazio = sem filtro.
	filterEntityIds?: string[];
}

export interface RecordsAnswerFieldView {
	id: string;
	label: string;
	value: string;
}

export interface RecordsActivityAnswersView {
	activityId: string;
	title: string;
	fields: RecordsAnswerFieldView[];
	// Destino completo de edição, ou null quando não há um real. A
	// apresentação só decide se renderiza o link — não monta rota, não conhece
	// a regra de editabilidade. Ver buildEditHref() para a regra e a
	// justificativa do parâmetro `from`.
	editHref: string | null;
}

export interface RecordsPhaseAnswersView {
	phaseId: string;
	phaseLabel: string;
	answerCount: number;
	activities: RecordsActivityAnswersView[];
}

export interface RecordsResolvedPendingItemView {
	id: string;
	activityTitle: string;
	label: string;
	detail: string;
}

// Event log incremental (ETAPA 7 do rework) — texto já em linguagem humana,
// nunca o nome interno do evento (ver instrução do corte): a apresentação só
// renderiza `text`, não decide vocabulário nem consulta type/payload.
export interface RecordsEventView {
	id: string;
	text: string;
	createdAt: string;
}

// Design Gate S7 — "Atividade recente" é uma unidade só (lista + empty state
// + chip de filtro), nunca três campos soltos que a apresentação precisaria
// recombinar: emptyText já vem na copy certa ("neste projeto" vs. nomeando o
// objeto filtrado), filter já vem resolvido (label real do WorkItem/
// Impediment, nunca id técnico) ou null quando não há filtro.
export interface RecordsRecentActivityView {
	events: RecordsEventView[];
	emptyText: string;
	filter: { label: string } | null;
}

export interface RecordsView {
	phases: RecordsPhaseAnswersView[];
	resolvedPendingItems: RecordsResolvedPendingItemView[];
	recentActivity: RecordsRecentActivityView;
}

const EDITABLE_PHASE_ID = 'descoberta';
// S9 (reconciliação da decomposição legada) retirou "Decompor o trabalho"
// desta exceção: `partes_trabalho` é READ-LEGACY (§13.2) — continua
// legível aqui, mas não é mais editável a partir de Registros. Nenhuma
// exceção nominal permanece fora da Descoberta hoje; o próximo caso real
// decide se vale reintroduzir o mecanismo.
const EDITABLE_ACTIVITY_IDS_OUTSIDE_PHASE = new Set<string>([]);

// S9 — "Decompor o trabalho" deixou de ser `required_fields` (virou
// `explicit_confirmation` contra WorkItem, ver domain/transitions.ts), então
// o loop genérico abaixo (que só olha `completionMode === 'required_fields'`)
// não a alcança mais. O Answer legado (`partes_trabalho`) continua
// READ-LEGACY e precisa seguir visível aqui — por isso este caso é montado à
// parte, nunca editável (editHref sempre null).
const DECOMPOR_TRABALHO_ACTIVITY_ID = 'decompor_trabalho';
const PARTES_TRABALHO_FIELD_ID = 'partes_trabalho';
const PARTES_TRABALHO_FIELD_LABEL = 'Partes do trabalho';

// S9 (reconciliação de dependências legadas) — "Mapear dependências" segue o
// mesmo padrão de DECOMPOR_TRABALHO acima: virou explicit_confirmation
// (confirmDependencyMapping, ver domain/transitions.ts), então o loop
// genérico não a alcança mais. `dependencias_trabalho` é texto livre simples
// (nunca uma coleção codificada), então não precisa de decode.
const MAPEAR_DEPENDENCIAS_ACTIVITY_ID = 'mapear_dependencias';
const DEPENDENCIAS_TRABALHO_FIELD_ID = 'dependencias_trabalho';
const DEPENDENCIAS_TRABALHO_FIELD_LABEL = 'Dependências do trabalho';

// S9 (reconciliação de marcos legados) — "Definir marcos" segue o mesmo
// padrão de MAPEAR_DEPENDENCIAS acima: virou explicit_confirmation
// (confirmMilestoneReview, ver domain/transitions.ts), então o loop genérico
// não a alcança mais. `marcos_principais` é texto livre simples (nunca uma
// coleção codificada), então não precisa de decode.
const DEFINIR_MARCOS_ACTIVITY_ID = 'definir_marcos';
const MARCOS_PRINCIPAIS_FIELD_ID = 'marcos_principais';
const MARCOS_PRINCIPAIS_FIELD_LABEL = 'Marcos principais';

// S10 (D049, reconciliação de risco legado) — "Identificar riscos do
// projeto"/"Atualizar riscos" seguem o mesmo padrão de DEFINIR_MARCOS acima:
// viraram explicit_confirmation (confirmRiskIdentification/
// confirmRiskUpdate, ver domain/transitions.ts), então o loop genérico não
// as alcança mais. `riscos_identificados`/`resposta_inicial_riscos`/
// `riscos_atualizados` são texto livre simples. Duas atividades distintas,
// a primeira com dois campos (o segundo sempre foi opcional).
const RISCOS_PROJETO_ACTIVITY_ID = 'riscos_projeto';
const RISCOS_IDENTIFICADOS_FIELD_ID = 'riscos_identificados';
const RISCOS_IDENTIFICADOS_FIELD_LABEL = 'Riscos identificados';
const RESPOSTA_INICIAL_RISCOS_FIELD_ID = 'resposta_inicial_riscos';
const RESPOSTA_INICIAL_RISCOS_FIELD_LABEL = 'Resposta inicial aos riscos';
const ATUALIZAR_RISCOS_ACTIVITY_ID = 'atualizar_riscos';
const RISCOS_ATUALIZADOS_FIELD_ID = 'riscos_atualizados';
const RISCOS_ATUALIZADOS_FIELD_LABEL = 'Riscos atualizados';

function findActivityDefinition(catalog: Catalog, activityDefinitionId: string): ActivityDefinition | undefined {
	for (const phase of catalog.phases) {
		const found = phase.activities.find((activity) => activity.id === activityDefinitionId);
		if (found) return found;
	}
	return undefined;
}

// Único mecanismo de edição pós-conclusão que existe hoje é
// now/+page.server.ts (findDescobertaConcluidaActivity), restrito a
// atividades required_fields já concluídas da própria Descoberta — mesma
// restrição que document-view.ts já aplica (EDITABLE_PHASE_ID). Não amplia
// para outras fases: fora da Descoberta não existe destino real.
//
// `from=records` é reconhecido por now/+page.server.ts (ReviewOrigin =
// 'summary' | 'records') como origem de revisão própria de Registros — texto,
// botão e retorno pós-salvamento específicos de Registros, distintos dos de
// `from=summary` (usado pelo Resumo). Não é o mesmo mecanismo do Documento
// (que usa `from=summary`, sem retorno próprio): Registros tem sua própria
// origem, com seu próprio destino de retorno.
function buildEditHref(
	projectId: string,
	phaseId: string,
	activityId: string,
	activityStatuses: Record<string, ActivityStatus>
): string | null {
	if (phaseId !== EDITABLE_PHASE_ID && !EDITABLE_ACTIVITY_IDS_OUTSIDE_PHASE.has(activityId)) return null;
	if (activityStatuses[activityId] !== 'concluída') return null;
	return `/projects/${projectId}/now?activity=${activityId}&from=records`;
}

const WORK_ITEM_STATUS_LABEL: Record<WorkItemStatus, string> = {
	a_fazer: 'A fazer',
	em_andamento: 'Em andamento',
	concluido: 'Concluído'
};

const IMPEDIMENT_TIPO_LABEL: Record<ImpedimentType, string> = {
	dependencia_externa: 'Dependência externa',
	decisao_pendente: 'Decisão pendente',
	falta_de_recurso: 'Falta de recurso',
	bloqueio_tecnico: 'Bloqueio técnico',
	outro: 'Outro'
};

// Texto humano por tipo de evento — única fonte de tradução type→texto,
// nunca duplicada na apresentação (ver RecordsEventView acima). workItemTitleById
// só é consultado para work_item.status_changed (o único tipo cujo payload
// não carrega o título — ver domain/events.ts).
function buildEventText(event: ProjectEvent, workItemTitleById: Map<string, string>): string {
	switch (event.type) {
		case 'work_item.created':
			return `Item de trabalho criado: "${event.payload.title}"`;
		case 'work_item.status_changed': {
			const title = workItemTitleById.get(event.entityId) ?? 'Item de trabalho';
			return `"${title}" movido de ${WORK_ITEM_STATUS_LABEL[event.payload.fromStatus]} para ${WORK_ITEM_STATUS_LABEL[event.payload.toStatus]}`;
		}
		case 'impediment.registered':
			return `Impedimento registrado (${IMPEDIMENT_TIPO_LABEL[event.payload.tipo]}): "${event.payload.text}"`;
		case 'impediment.status_changed':
			return event.payload.toStatus === 'resolvido' ? 'Impedimento marcado como resolvido' : 'Impedimento reaberto';
	}
}

// Design Gate S7 — o chip do estado filtrado nomeia o objeto observado, não
// os ids técnicos da URL: WorkItem tem prioridade sobre Impediment quando o
// filtro cobre os dois (caso de "Ver mudanças relacionadas" em /tracking —
// o chip nomeia o WorkItem mesmo que os eventos exibidos sejam só do
// Impediment vinculado, ver Design Gate "Estado filtrado"). Sem rótulo
// resolvível (id não corresponde a nenhum WorkItem/Impediment conhecido),
// cai num rótulo genérico em vez de expor o id bruto.
function buildFilterLabel(
	filterEntityIds: string[],
	workItemTitleById: Map<string, string>,
	impedimentTextById: Map<string, string>
): string {
	for (const entityId of filterEntityIds) {
		const workItemTitle = workItemTitleById.get(entityId);
		if (workItemTitle) return workItemTitle;
	}
	for (const entityId of filterEntityIds) {
		const impedimentText = impedimentTextById.get(entityId);
		if (impedimentText) return impedimentText;
	}
	return 'item selecionado';
}

function buildRecentActivityView(
	events: ProjectEvent[],
	workItems: RecordsWorkItemInput[],
	impediments: RecordsImpedimentInput[],
	filterEntityIds: string[]
): RecordsRecentActivityView {
	const workItemTitleById = new Map(workItems.map((item) => [item.id, item.title]));
	const impedimentTextById = new Map(impediments.map((item) => [item.id, item.text]));

	const eventViews = events.map((event) => ({
		id: event.id,
		text: buildEventText(event, workItemTitleById),
		createdAt: event.createdAt
	}));

	if (filterEntityIds.length === 0) {
		return { events: eventViews, emptyText: 'Nenhuma mudança neste projeto ainda.', filter: null };
	}

	const label = buildFilterLabel(filterEntityIds, workItemTitleById, impedimentTextById);
	return {
		events: eventViews,
		emptyText: `Nenhuma mudança registrada para "${label}" ainda.`,
		filter: { label }
	};
}

export function buildRecordsView(catalog: Catalog, input: RecordsViewInput): RecordsView {
	const phases: RecordsPhaseAnswersView[] = [];

	for (const phase of catalog.phases) {
		const activities: RecordsActivityAnswersView[] = [];

		const decomporTrabalho = phase.activities.find((activity) => activity.id === DECOMPOR_TRABALHO_ACTIVITY_ID);
		if (decomporTrabalho && input.answers[PARTES_TRABALHO_FIELD_ID]) {
			const items = decodePlanningItems(input.answers[PARTES_TRABALHO_FIELD_ID]);
			if (items.length > 0) {
				activities.push({
					activityId: DECOMPOR_TRABALHO_ACTIVITY_ID,
					title: decomporTrabalho.title,
					fields: [
						{
							id: PARTES_TRABALHO_FIELD_ID,
							label: PARTES_TRABALHO_FIELD_LABEL,
							value: items.map((item, index) => `${index + 1}. ${item.text}`).join('; ')
						}
					],
					editHref: null
				});
			}
		}

		const mapearDependencias = phase.activities.find((activity) => activity.id === MAPEAR_DEPENDENCIAS_ACTIVITY_ID);
		if (mapearDependencias && input.answers[DEPENDENCIAS_TRABALHO_FIELD_ID]) {
			activities.push({
				activityId: MAPEAR_DEPENDENCIAS_ACTIVITY_ID,
				title: mapearDependencias.title,
				fields: [
					{
						id: DEPENDENCIAS_TRABALHO_FIELD_ID,
						label: DEPENDENCIAS_TRABALHO_FIELD_LABEL,
						value: input.answers[DEPENDENCIAS_TRABALHO_FIELD_ID]
					}
				],
				editHref: null
			});
		}

		const definirMarcos = phase.activities.find((activity) => activity.id === DEFINIR_MARCOS_ACTIVITY_ID);
		if (definirMarcos && input.answers[MARCOS_PRINCIPAIS_FIELD_ID]) {
			activities.push({
				activityId: DEFINIR_MARCOS_ACTIVITY_ID,
				title: definirMarcos.title,
				fields: [
					{
						id: MARCOS_PRINCIPAIS_FIELD_ID,
						label: MARCOS_PRINCIPAIS_FIELD_LABEL,
						value: input.answers[MARCOS_PRINCIPAIS_FIELD_ID]
					}
				],
				editHref: null
			});
		}

		const riscosProjeto = phase.activities.find((activity) => activity.id === RISCOS_PROJETO_ACTIVITY_ID);
		if (riscosProjeto) {
			const fields: RecordsAnswerFieldView[] = [];
			if (input.answers[RISCOS_IDENTIFICADOS_FIELD_ID]) {
				fields.push({
					id: RISCOS_IDENTIFICADOS_FIELD_ID,
					label: RISCOS_IDENTIFICADOS_FIELD_LABEL,
					value: input.answers[RISCOS_IDENTIFICADOS_FIELD_ID]
				});
			}
			if (input.answers[RESPOSTA_INICIAL_RISCOS_FIELD_ID]) {
				fields.push({
					id: RESPOSTA_INICIAL_RISCOS_FIELD_ID,
					label: RESPOSTA_INICIAL_RISCOS_FIELD_LABEL,
					value: input.answers[RESPOSTA_INICIAL_RISCOS_FIELD_ID]
				});
			}
			if (fields.length > 0) {
				activities.push({ activityId: RISCOS_PROJETO_ACTIVITY_ID, title: riscosProjeto.title, fields, editHref: null });
			}
		}

		const atualizarRiscos = phase.activities.find((activity) => activity.id === ATUALIZAR_RISCOS_ACTIVITY_ID);
		if (atualizarRiscos && input.answers[RISCOS_ATUALIZADOS_FIELD_ID]) {
			activities.push({
				activityId: ATUALIZAR_RISCOS_ACTIVITY_ID,
				title: atualizarRiscos.title,
				fields: [
					{
						id: RISCOS_ATUALIZADOS_FIELD_ID,
						label: RISCOS_ATUALIZADOS_FIELD_LABEL,
						value: input.answers[RISCOS_ATUALIZADOS_FIELD_ID]
					}
				],
				editHref: null
			});
		}

		for (const activity of phase.activities) {
			if (activity.completionMode !== 'required_fields') continue;

			const fields: RecordsAnswerFieldView[] = activity.fields
				.filter((field) => field.dataTarget === 'answer' && input.answers[field.id])
				.map((field) => {
					if (field.dataTarget === 'answer' && field.type === 'selecao_multipla') {
						const selectedIds = decodeMultiSelectValue(input.answers[field.id]) ?? [];
						const labelById = new Map(field.options.map((option) => [option.id, option.label]));
						return {
							id: field.id,
							label: field.label,
							value: selectedIds.map((id) => labelById.get(id) ?? id).join(', ')
						};
					}
					if (field.dataTarget === 'answer' && field.type === 'lista_partes') {
						// PlanningItem[] (C5-01) — conteúdo humano, nunca a
						// serialização interna: lista numerada na ordem atual (que é a
						// própria prioridade, se já reordenada em "Priorizar entregas").
						const items = decodePlanningItems(input.answers[field.id]);
						return {
							id: field.id,
							label: field.label,
							value: items.map((item, index) => `${index + 1}. ${item.text}`).join('; ')
						};
					}
					return { id: field.id, label: field.label, value: input.answers[field.id] };
				});

			if (fields.length > 0) {
				activities.push({
					activityId: activity.id,
					title: activity.title,
					fields,
					editHref: buildEditHref(input.projectId, phase.id, activity.id, input.activityStatuses)
				});
			}
		}

		if (activities.length > 0) {
			const answerCount = activities.reduce((total, activity) => total + activity.fields.length, 0);
			phases.push({ phaseId: phase.id, phaseLabel: phase.label, answerCount, activities });
		}
	}

	const resolvedPendingItems: RecordsResolvedPendingItemView[] = input.pendingItemHistory
		.filter((item) => item.status === 'resolvida')
		.map((item) => {
			const activity = findActivityDefinition(catalog, item.activityDefinitionId);
			return {
				id: item.id,
				activityTitle: activity?.title ?? item.activityDefinitionId,
				label: item.label,
				detail: item.detail
			};
		});

	return {
		phases,
		resolvedPendingItems,
		recentActivity: buildRecentActivityView(
			input.events ?? [],
			input.workItems ?? [],
			input.impediments ?? [],
			input.filterEntityIds ?? []
		)
	};
}
