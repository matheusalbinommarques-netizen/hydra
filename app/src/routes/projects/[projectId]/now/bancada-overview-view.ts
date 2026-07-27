// Projeção pura de leitura para o painel lateral "documento crescendo" da
// Bancada (/now) — cobre Descoberta e Definição do produto, no mesmo
// espírito de summary/discovery-summary-view.ts: cruza catalog/ (estático)
// com os campos já expostos por ProjectView (answers). Não lê nem grava
// persistência, não gera prosa nova: seleciona uma Answer canônica por
// atividade e a exibe tal como o usuário escreveu, nunca fundindo campos.

import { decodeMultiSelectValue } from '$lib/domain';
import type { Catalog } from '$lib/domain';

export interface BancadaOverviewBlock {
	activityId: string;
	heading: string;
	value: string;
	chips?: string[];
}

export interface BancadaOverviewView {
	blocks: BancadaOverviewBlock[];
}

const BANCADA_PHASE_IDS = ['descoberta', 'definicao'];

// Um campo "manchete" por atividade — mesma curadoria de
// discovery-summary-view.ts (problema/publico/estado_atual/resultado),
// estendida às atividades de Definição do produto e às duas primeiras da
// Descoberta (origem/contexto), que a visão do Resumo não expõe hoje mas que
// aqui precisam aparecer desde o início — senão o painel fica vazio durante
// as duas primeiras atividades da jornada, contradizendo o efeito de
// "documento crescendo". Decisão de conteúdo, não regra mecânica — revisável
// depois do dogfooding sem migrar dado nenhum.
const BLOCK_SPECS: Record<string, { heading: string; valueFieldId: string; chipsFieldId?: string }> = {
	origem: { heading: 'Origem do projeto', valueFieldId: 'origem' },
	contexto: { heading: 'Contexto inicial', valueFieldId: 'breve_descricao' },
	problema: { heading: 'Problema', valueFieldId: 'situacao', chipsFieldId: 'sinais_situacao' },
	publico: { heading: 'Público afetado', valueFieldId: 'publico_detail' },
	estado_atual: { heading: 'Estado atual', valueFieldId: 'estado_atual_detail' },
	resultado: { heading: 'Resultado desejado', valueFieldId: 'mudanca' },
	usuario_principal: { heading: 'Usuário principal', valueFieldId: 'usuario_principal' },
	visao_produto: { heading: 'Visão do produto', valueFieldId: 'necessidade_central' },
	criterios_sucesso_produto: { heading: 'Critérios de sucesso do produto', valueFieldId: 'sinais_sucesso' }
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

export function buildBancadaOverviewView(catalog: Catalog, answers: Record<string, string>): BancadaOverviewView {
	const blocks: BancadaOverviewBlock[] = [];

	const phasesInOrder = [...catalog.phases]
		.filter((phase) => BANCADA_PHASE_IDS.includes(phase.id))
		.sort((a, b) => a.order - b.order);

	for (const phase of phasesInOrder) {
		const activitiesInOrder = [...phase.activities].sort((a, b) => a.order - b.order);
		for (const activity of activitiesInOrder) {
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
