// Projeção pura de leitura para o painel lateral "documento crescendo" da
// Bancada (/now) — cobre Descoberta e Definição do produto, no mesmo
// espírito de summary/discovery-summary-view.ts: cruza catalog/ (estático)
// com os campos já expostos por ProjectView (answers). Não lê nem grava
// persistência, não gera prosa nova: seleciona uma Answer canônica por
// atividade e a exibe tal como o usuário escreveu, nunca fundindo campos.

import { decodeMultiSelectValue } from '$lib/domain';
import type { Catalog } from '$lib/domain';
import { summarizeAffectedGroups } from '$lib/catalog/affected-group';
import type { AffectedGroupSummaryInput } from '$lib/catalog/affected-group';
import { summarizeAffectedGroupEvidences } from '$lib/catalog/external-action';
import { summarizeCurrentTreatment, treatmentStepCountLabel } from '$lib/catalog/current-treatment';
import type { TreatmentStepSynthesisInput } from '$lib/catalog/current-treatment';

export interface BancadaOverviewBlock {
	activityId: string;
	heading: string;
	value: string;
	chips?: string[];
}

export interface BancadaOverviewView {
	blocks: BancadaOverviewBlock[];
}

const BANCADA_PHASE_IDS = ['descoberta', 'definicao', 'estruturacao'];

// Um campo "manchete" por atividade — mesma curadoria de
// discovery-summary-view.ts (problema/publico/estado_atual/resultado),
// estendida às atividades de Definição do produto e à primeira da Descoberta
// (origem), que a visão do Resumo não expõe hoje mas que aqui precisa
// aparecer desde o início — senão o painel fica vazio na primeira atividade
// da jornada, contradizendo o efeito de "documento crescendo". Decisão de
// conteúdo, não regra mecânica — revisável depois do dogfooding sem migrar
// dado nenhum.
//
// Estruturação (seis atividades) segue a mesma curadoria: quando uma
// atividade tem mais de um campo obrigatório (objetivo_entregaveis,
// restricoes_premissas), o campo escolhido é o que mais de perto responde
// à mainQuestion da atividade — mesmo critério já usado em "resultado"
// (mudanca, não beneficiario/percepcao).
// `publico`/`estado_atual` não entram aqui — deixaram de ser Answer-driven
// (ETAPA 2 e Stage 4A do rework, ver catalog/discovery.ts) e ganham
// tratamento próprio em buildBancadaOverviewView a partir de
// AffectedGroup/CurrentTreatment, não deste mapa genérico de
// heading/valueFieldId.
const BLOCK_SPECS: Record<string, { heading: string; valueFieldId: string; chipsFieldId?: string }> = {
	origem: { heading: 'Origem do projeto', valueFieldId: 'origem' },
	problema: { heading: 'Situação', valueFieldId: 'situacao', chipsFieldId: 'situacao_o_que' },
	resultado: { heading: 'Resultado desejado', valueFieldId: 'mudanca' },
	usuario_principal: { heading: 'Usuário principal', valueFieldId: 'usuario_principal' },
	visao_produto: { heading: 'Visão do produto', valueFieldId: 'necessidade_central' },
	criterios_sucesso_produto: { heading: 'Critérios de sucesso do produto', valueFieldId: 'sinais_sucesso' },
	objetivo_entregaveis: { heading: 'Objetivo do projeto', valueFieldId: 'objetivo_projeto' },
	partes_interessadas: { heading: 'Partes interessadas', valueFieldId: 'partes_interessadas' },
	papeis_responsabilidades: { heading: 'Papéis e responsabilidades', valueFieldId: 'papeis_responsaveis' },
	restricoes_premissas: { heading: 'Restrições do projeto', valueFieldId: 'restricoes_projeto' },
	riscos_projeto: { heading: 'Riscos identificados', valueFieldId: 'riscos_identificados' },
	comunicacao_governanca: { heading: 'Comunicação do projeto', valueFieldId: 'forma_comunicacao' }
};

function decodeMultiSelectLabels(catalog: Catalog, activityId: string, fieldId: string, encodedValue: string): string[] {
	for (const phase of catalog.phases) {
		const activity = phase.activities.find((a) => a.id === activityId);
		if (!activity || activity.completionMode !== 'required_fields') continue;
		const field = activity.fields.find((f) => f.id === fieldId);
		if (!field || field.dataTarget !== 'answer' || field.type !== 'selecao_multipla') continue;
		const selectedIds = decodeMultiSelectValue(encodedValue) ?? [];
		const labelById = new Map(field.options.map((option) => [option.id, option.label]));
		return selectedIds.map((id) => labelById.get(id) ?? id);
	}
	return [];
}

export function buildBancadaOverviewView(
	catalog: Catalog,
	answers: Record<string, string>,
	affectedGroups: AffectedGroupSummaryInput[] = [],
	evidences: readonly { affectedGroupId: string }[] = [],
	currentTreatment: { noTreatment: boolean } = { noTreatment: false },
	treatmentSteps: TreatmentStepSynthesisInput[] = []
): BancadaOverviewView {
	const blocks: BancadaOverviewBlock[] = [];

	const phasesInOrder = [...catalog.phases]
		.filter((phase) => BANCADA_PHASE_IDS.includes(phase.id))
		.sort((a, b) => a.order - b.order);

	for (const phase of phasesInOrder) {
		const activitiesInOrder = [...phase.activities].sort((a, b) => a.order - b.order);
		for (const activity of activitiesInOrder) {
			if (activity.id === 'publico') {
				if (affectedGroups.length > 0) {
					const evidenceCounts = new Map<string, number>();
					for (const evidence of evidences) {
						evidenceCounts.set(evidence.affectedGroupId, (evidenceCounts.get(evidence.affectedGroupId) ?? 0) + 1);
					}
					const evidenceSummary = summarizeAffectedGroupEvidences(
						affectedGroups.map((group) => ({ label: group.label, count: evidenceCounts.get(group.id) ?? 0 }))
					);
					blocks.push({
						activityId: 'publico',
						heading: 'Quem é afetado',
						value: evidenceSummary
							? `${summarizeAffectedGroups(affectedGroups)} ${evidenceSummary}`
							: summarizeAffectedGroups(affectedGroups),
						chips: affectedGroups.map((group) => group.label)
					});
				}
				continue;
			}

			if (activity.id === 'estado_atual') {
				if (currentTreatment.noTreatment || treatmentSteps.length > 0) {
					blocks.push({
						activityId: 'estado_atual',
						heading: 'Como é tratado hoje',
						value: `${treatmentStepCountLabel(currentTreatment.noTreatment, treatmentSteps.length)}. ${summarizeCurrentTreatment(currentTreatment.noTreatment, treatmentSteps)}`.trim()
					});
				}
				continue;
			}

			const spec = BLOCK_SPECS[activity.id];
			if (!spec) continue;

			const value = answers[spec.valueFieldId];
			if (!value) continue;

			const chips =
				spec.chipsFieldId && answers[spec.chipsFieldId]
					? decodeMultiSelectLabels(catalog, activity.id, spec.chipsFieldId, answers[spec.chipsFieldId])
					: undefined;

			blocks.push({ activityId: activity.id, heading: spec.heading, value, chips });
		}
	}

	return { blocks };
}
