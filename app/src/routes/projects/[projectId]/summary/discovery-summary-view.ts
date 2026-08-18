// Projeção pura de leitura para o Checkpoint da Descoberta (S4D, ver
// docs/core/HYDRA_PRODUCT_REWORK.md §34 "4D — Checkpoint" e o Design Gate
// aprovado "Checkpoint da Descoberta") — deriva as cinco seções (Situação,
// Quem é afetado, Como é tratado hoje, Causas & evidências, Resultado
// desejado) a partir dos mesmos objetos vivos já usados por
// now/bancada-overview-view.ts, sem nova fonte de verdade nem síntese
// fundida numa frase única: cada seção lista os itens individualmente, como
// o Design Gate especifica. Não lê nem grava persistência, não introduz
// regra de conclusão nova — status por seção deriva de ActivityStatus (já
// computado por ProjectView) e "ponto de atenção" deriva de PendingItem (já
// existente), nunca de uma regra nova de divergência.

import type {
	ActivityStatus,
	AffectedGroupFrequency,
	AffectedGroupImpact,
	TreatmentFriction
} from '$lib/domain';
import type { Catalog } from '$lib/domain';
import type { PendingItemView } from '$lib/orientation-engine';
import { affectedGroupFrequencyLabel, affectedGroupImpactLabel } from '$lib/catalog/affected-group';
import { treatmentFrictionLabel } from '$lib/catalog/current-treatment';

export type CheckpointSectionKey = 'situacao' | 'afetados' | 'estado' | 'causas' | 'resultado';
export type CheckpointSectionStatus = 'completa' | 'pendente' | 'opcional';

export interface CheckpointListItem {
	label: string;
	badge?: string;
	note?: string;
}

export interface CheckpointSection {
	key: CheckpointSectionKey;
	activityId: string;
	eyebrow: string;
	title: string;
	required: boolean;
	status: CheckpointSectionStatus;
	flagText: string | null;
	// Situação
	situacaoText?: string;
	// Quem é afetado
	afetadosSummary?: string;
	afetadosGroups?: CheckpointListItem[];
	// Como é tratado hoje
	estadoNoTreatment?: boolean;
	estadoSteps?: CheckpointListItem[];
	// Causas & evidências
	causasStillUnknown?: boolean;
	causasHypotheses?: CheckpointListItem[];
	// Resultado desejado
	resultadoOutcomes?: CheckpointListItem[];
}

export interface DiscoveryCheckpointView {
	sections: CheckpointSection[];
	requiredDoneCount: number;
	requiredTotal: number;
	ctaDisabled: boolean;
	missingRequiredTitles: string[];
}

interface CheckpointAffectedGroupInput {
	label: string;
	impact: AffectedGroupImpact | null;
	frequency: AffectedGroupFrequency | null;
}

interface CheckpointTreatmentStepInput {
	whatHappens: string;
	actors: readonly string[];
	medium: string | null;
	frictions: readonly TreatmentFriction[];
}

interface CheckpointCauseHypothesisInput {
	title: string;
	evidenceCount: number;
}

interface CheckpointDesiredOutcomeInput {
	change: string;
	target: string | null;
}

const REQUIRED_SECTION_KEYS: readonly CheckpointSectionKey[] = ['situacao', 'afetados', 'estado', 'resultado'];

const SECTION_META: Record<
	CheckpointSectionKey,
	{ activityId: string; eyebrow: string; title: string; required: boolean }
> = {
	situacao: { activityId: 'problema', eyebrow: 'Situação', title: 'O problema entendido', required: true },
	afetados: { activityId: 'publico', eyebrow: 'Afetados', title: 'Quem é afetado', required: true },
	estado: { activityId: 'estado_atual', eyebrow: 'Estado atual', title: 'Como é tratado hoje', required: true },
	causas: {
		activityId: 'entender_causas',
		eyebrow: 'Causas & evidências',
		title: 'Causas prováveis e evidências',
		required: false
	},
	resultado: {
		activityId: 'resultado',
		eyebrow: 'Resultado desejado',
		title: 'O que o projeto deve produzir',
		required: true
	}
};

function joinWithAnd(items: readonly string[]): string {
	if (items.length <= 1) return items.join('');
	if (items.length === 2) return items.join(' e ');
	return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

function treatmentStepNote(step: CheckpointTreatmentStepInput): string | undefined {
	const parts: string[] = [];
	if (step.actors.length > 0) parts.push(joinWithAnd(step.actors));
	if (step.medium) parts.push(step.medium);
	if (step.frictions.length > 0) {
		parts.push(`Fricção: ${joinWithAnd(step.frictions.map((f) => treatmentFrictionLabel(f).toLowerCase()))}`);
	}
	return parts.length > 0 ? parts.join(' · ') : undefined;
}

function causeHypothesisNote(evidenceCount: number): string {
	if (evidenceCount === 0) return 'Nenhuma evidência relacionada';
	return evidenceCount === 1 ? '1 evidência relacionada' : `${evidenceCount} evidências relacionadas`;
}

export function buildDiscoveryCheckpointView(
	activityStatuses: Record<string, ActivityStatus>,
	openPendingItems: readonly PendingItemView[],
	situacaoText: string | null,
	affectedGroups: readonly CheckpointAffectedGroupInput[],
	currentTreatment: { noTreatment: boolean },
	treatmentSteps: readonly CheckpointTreatmentStepInput[],
	causeExploration: { stillUnknown: boolean },
	causeHypotheses: readonly CheckpointCauseHypothesisInput[],
	desiredOutcomes: readonly CheckpointDesiredOutcomeInput[]
): DiscoveryCheckpointView {
	const flagByActivity = new Map(
		openPendingItems.map((item) => [item.activityDefinitionId, item.detail ?? item.label])
	);

	function statusOf(activityId: string, required: boolean): CheckpointSectionStatus {
		if (activityStatuses[activityId] === 'concluída') return 'completa';
		return required ? 'pendente' : 'opcional';
	}

	const sections: CheckpointSection[] = [
		{
			...SECTION_META.situacao,
			key: 'situacao',
			status: statusOf(SECTION_META.situacao.activityId, SECTION_META.situacao.required),
			flagText: flagByActivity.get(SECTION_META.situacao.activityId) ?? null,
			situacaoText: situacaoText ?? undefined
		},
		{
			...SECTION_META.afetados,
			key: 'afetados',
			status: statusOf(SECTION_META.afetados.activityId, SECTION_META.afetados.required),
			flagText: flagByActivity.get(SECTION_META.afetados.activityId) ?? null,
			afetadosSummary: affectedGroups.length === 1 ? '1 grupo mapeado' : `${affectedGroups.length} grupos mapeados`,
			afetadosGroups: affectedGroups.map((group) => ({
				label: group.label,
				badge: group.impact ? affectedGroupImpactLabel(group.impact) : 'Por classificar',
				note: group.frequency ? `Frequência: ${affectedGroupFrequencyLabel(group.frequency)}` : undefined
			}))
		},
		{
			...SECTION_META.estado,
			key: 'estado',
			status: statusOf(SECTION_META.estado.activityId, SECTION_META.estado.required),
			flagText: flagByActivity.get(SECTION_META.estado.activityId) ?? null,
			estadoNoTreatment: currentTreatment.noTreatment,
			estadoSteps: treatmentSteps.map((step) => ({ label: step.whatHappens, note: treatmentStepNote(step) }))
		},
		{
			...SECTION_META.causas,
			key: 'causas',
			status: statusOf(SECTION_META.causas.activityId, SECTION_META.causas.required),
			flagText: flagByActivity.get(SECTION_META.causas.activityId) ?? null,
			causasStillUnknown: causeExploration.stillUnknown,
			causasHypotheses: causeHypotheses.map((hypothesis) => ({
				label: hypothesis.title,
				note: causeHypothesisNote(hypothesis.evidenceCount)
			}))
		},
		{
			...SECTION_META.resultado,
			key: 'resultado',
			status: statusOf(SECTION_META.resultado.activityId, SECTION_META.resultado.required),
			flagText: flagByActivity.get(SECTION_META.resultado.activityId) ?? null,
			resultadoOutcomes: desiredOutcomes.map((outcome) => ({
				label: outcome.change,
				note: outcome.target ? `Meta: ${outcome.target}` : undefined
			}))
		}
	];

	const requiredSections = sections.filter((section) => REQUIRED_SECTION_KEYS.includes(section.key));
	const requiredDoneCount = requiredSections.filter((section) => section.status === 'completa').length;
	const requiredTotal = requiredSections.length;

	return {
		sections,
		requiredDoneCount,
		requiredTotal,
		ctaDisabled: requiredDoneCount < requiredTotal,
		missingRequiredTitles: requiredSections
			.filter((section) => section.status !== 'completa')
			.map((section) => section.title)
	};
}

// Filtra as pendências abertas do projeto para as que pertencem às
// atividades da fase Descoberta — sem entidade nova, só cruza
// openPendingItems (já computado por ProjectView) com o catálogo estático.
export function filterDiscoveryOpenPendingItems(
	catalog: Catalog,
	openPendingItems: PendingItemView[]
): PendingItemView[] {
	const descoberta = catalog.phases.find((phase) => phase.id === 'descoberta');
	const discoveryActivityIds = new Set((descoberta?.activities ?? []).map((activity) => activity.id));
	return openPendingItems.filter((item) => discoveryActivityIds.has(item.activityDefinitionId));
}
