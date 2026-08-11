// Síntese determinística de "Entender a situação" (Claude Design,
// "Entender a Situacao.dc.html", buildSynthesis()) — função pura, sem IA,
// usada pelo cliente para montar o texto que preenche o campo `situacao`
// (ver catalog/discovery.ts) a partir das seleções estruturadas. Mantida
// separada da interface (Svelte) para poder ser testada isoladamente.
//
// Fragmentos curtos (WHAT_FRAGMENTS/WHERE_FRAGMENTS) são deliberadamente
// separados dos rótulos exibidos nos chips (catalog/discovery.ts) — os
// rótulos são frases completas ("Está demorando demais"), mas a síntese
// precisa de um fragmento nominal para compor uma frase natural ("Há um
// problema relacionado a demora..."). Mesma separação label/short do
// artefato original do Claude Design.

import { isOpportunityOrigin } from './discovery';

const WHAT_FRAGMENTS_PROBLEM: Record<string, string> = {
	prob_demora: 'demora',
	prob_custo: 'custo alto',
	prob_erros: 'erros frequentes',
	prob_retrabalho: 'retrabalho',
	prob_insatisfacao: 'insatisfação das pessoas',
	prob_manual: 'processos manuais',
	prob_visibilidade: 'falta de visibilidade',
	prob_quebrado: 'algo que não funciona como deveria',
	prob_risco: 'um risco relevante'
};

const WHAT_FRAGMENTS_OPPORTUNITY: Record<string, string> = {
	opor_tempo: 'economia de tempo',
	opor_custo: 'redução de custos',
	opor_experiencia: 'melhoria da experiência',
	opor_automacao: 'automação',
	opor_necessidade: 'uma necessidade ainda não atendida',
	opor_negocio: 'uma nova possibilidade de negócio',
	opor_simplicidade: 'mais simplicidade',
	opor_confiabilidade: 'mais confiabilidade',
	opor_criacao: 'algo que hoje não existe'
};

// Já inclui a preposição correta (no/na/nos) — a síntese junta estes
// fragmentos diretamente, sem prefixo adicional.
const WHERE_FRAGMENTS: Record<string, string> = {
	area_clientes: 'nos clientes ou usuários',
	area_produto: 'no produto ou serviço',
	area_processo: 'no processo',
	area_operacao: 'na operação',
	area_equipe: 'na equipe',
	area_tecnologia: 'na tecnologia',
	area_financeiro: 'no financeiro',
	area_mercado: 'no mercado'
};

const WEIGHT_CLAUSES: Record<string, string> = {
	'É crítico': 'é crítico hoje',
	'Tem impacto relevante': 'tem impacto relevante hoje',
	'É um incômodo': 'é um incômodo, mas não bloqueia',
	'É mais uma oportunidade do que um problema': 'é mais uma oportunidade do que um problema',
	'Ainda não sabemos': 'ainda não está claro o quanto isso pesa'
};

function joinNatural(items: string[]): string {
	if (items.length === 0) return '';
	if (items.length === 1) return items[0];
	return items.slice(0, -1).join(', ') + ' e ' + items[items.length - 1];
}

export interface SituationSynthesisInput {
	originLabel: string | undefined;
	whatIds: string[];
	whatOtherText: string;
	whereIds: string[];
	whereOtherText: string;
	weightLabel: string | null;
}

export function buildSituationSynthesis(input: SituationSynthesisInput): string {
	const opportunity = isOpportunityOrigin(input.originLabel);
	const whatFragments = opportunity ? WHAT_FRAGMENTS_OPPORTUNITY : WHAT_FRAGMENTS_PROBLEM;
	const outroWhatId = opportunity ? 'opor_outro' : 'prob_outro';

	const whatList = input.whatIds
		.map((id) => (id === outroWhatId ? input.whatOtherText.trim() || null : (whatFragments[id] ?? null)))
		.filter((v): v is string => !!v);

	const whereList = input.whereIds
		.map((id) => (id === 'area_outra' ? input.whereOtherText.trim() || null : (WHERE_FRAGMENTS[id] ?? null)))
		.filter((v): v is string => !!v);

	if (whatList.length === 0) return '';

	const subject = opportunity ? 'uma oportunidade' : 'um problema';
	let text = 'Há ' + subject + ' relacionado a ' + joinNatural(whatList);
	if (whereList.length > 0) text += ', percebido principalmente ' + joinNatural(whereList);
	const clause = input.weightLabel ? WEIGHT_CLAUSES[input.weightLabel] : undefined;
	if (clause) text += ', e ' + clause;
	text += '.';
	return text;
}
