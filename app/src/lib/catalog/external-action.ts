// Vocabulário e preparo determinístico da primeira ExternalAction ("Validar
// com essas pessoas", ETAPA 3 do rework — docs/core/HYDRA_PRODUCT_REWORK.md
// §33, handoff final aprovado do Claude Design "Validação Externa - Direção
// Refinada.dc.html"). Mesmo espírito de catalog/affected-group.ts: funções
// puras, sem IA, compartilhadas entre a camada de aplicação (que persiste a
// preparação no momento de "Pronto para conversar") e a interface (que
// pré-visualiza a mesma preparação antes de persistir — nunca duas fontes
// divergentes do mesmo texto).

import type { AffectedGroupFrequency, AffectedGroupImpact, EvidenceOutcome } from '$lib/domain';
import { affectedGroupFrequencyLabel, affectedGroupImpactLabel } from './affected-group';

export interface ExternalActionPreparationInput {
	groupLabel: string;
	impact: AffectedGroupImpact | null;
	frequency: AffectedGroupFrequency | null;
}

export interface ExternalActionPreparation {
	objective: string;
	questions: string[];
	informationToTake: string[];
	expectedResult: string;
}

// Perguntas fixas — deliberadamente genéricas (não é um suggestion engine,
// ver HYDRA_PRODUCT_REWORK.md §8: "não construa engine genérica"). A
// variação por AffectedGroup fica em objective/informationToTake, que já
// refletem o que o Hydra sabe do grupo, sem repetir a pergunta.
const VALIDATE_AFFECTED_GROUP_QUESTIONS: readonly string[] = [
	'Quando isso costuma acontecer?',
	'O que você faz quando acontece?',
	'Qual parte causa mais dificuldade?',
	'O que acontece depois?',
	'Tem algum exemplo recente?'
];

const EXPECTED_RESULT = 'Tente voltar sabendo se isso realmente acontece dessa forma e o que acontece quando acontece.';

/**
 * Preparação determinística para validar um AffectedGroup fora do Hydra —
 * usada tanto pela pré-visualização (antes de "Pronto para conversar") quanto
 * pela persistência real da ExternalAction, para as duas nunca divergirem.
 * "Leve com você" deriva só do que o Hydra já sabe do grupo (label + impacto
 * + frequência, quando classificados) — nunca pede ao usuário para
 * redigitar.
 */
export function buildExternalActionPreparation(input: ExternalActionPreparationInput): ExternalActionPreparation {
	const informationToTake = [input.groupLabel];
	if (input.impact) informationToTake.push(`Impacto: ${affectedGroupImpactLabel(input.impact)}`);
	if (input.frequency) informationToTake.push(`Frequência: ${affectedGroupFrequencyLabel(input.frequency)}`);

	return {
		objective: `Confirmar como essa situação aparece para ${input.groupLabel}.`,
		questions: [...VALIDATE_AFFECTED_GROUP_QUESTIONS],
		informationToTake,
		expectedResult: EXPECTED_RESULT
	};
}

export const EVIDENCE_OUTCOME_OPTIONS: readonly { id: EvidenceOutcome; label: string }[] = [
	{ id: 'confirmed', label: 'Confirmou' },
	{ id: 'partially_confirmed', label: 'Confirmou parcialmente' },
	{ id: 'contradicted', label: 'Contradisse' },
	{ id: 'new_discovery', label: 'Descobri algo novo' }
];

const EVIDENCE_OUTCOME_LABEL: Record<EvidenceOutcome, string> = Object.fromEntries(
	EVIDENCE_OUTCOME_OPTIONS.map((option) => [option.id, option.label])
) as Record<EvidenceOutcome, string>;

export function evidenceOutcomeLabel(outcome: EvidenceOutcome): string {
	return EVIDENCE_OUTCOME_LABEL[outcome];
}

/**
 * Texto discreto de contagem para projeções somente-leitura (Mapa de
 * Impacto, Resumo) — "1 evidência" / "2 evidências". Nunca "validado": uma
 * evidência pode confirmar, contradizer ou trazer algo novo (ver
 * state-types.ts, EvidenceOutcome).
 */
export function evidenceCountLabel(count: number): string {
	return count === 1 ? '1 evidência' : `${count} evidências`;
}

export interface AffectedGroupEvidenceSummaryInput {
	label: string;
	count: number;
}

/**
 * Síntese determinística para o Resumo da descoberta e o Documento do
 * projeto — uma frase curta por grupo com evidência, nunca a preparação
 * inteira nem o roteiro da conversa (ver HYDRA_PRODUCT_REWORK.md §33,
 * "Resumo da descoberta"/"Documento do projeto": mostrar a informação que
 * agrega entendimento, não despejar tudo). Grupos sem evidência não entram —
 * "" quando nenhum grupo tem evidência.
 */
export function summarizeAffectedGroupEvidences(groups: readonly AffectedGroupEvidenceSummaryInput[]): string {
	const withEvidence = groups.filter((group) => group.count > 0);
	if (withEvidence.length === 0) return '';
	const parts = withEvidence.map((group) => `${group.label} (${evidenceCountLabel(group.count)})`);
	return `Evidências: ${parts.join(', ')}.`;
}
