// Tipos do catálogo metodológico — ver docs/06-architecture/contracts.md §1.

interface FieldDefinitionBase {
	id: string;
	activityId: string;
	label: string;
	required: boolean;
	placeholder?: string;
	help?: string;
}

// id/label separados só existe para selecao_multipla — selecao (única
// escolha) mantém a convenção antiga de options: string[] onde a própria
// string já é o valor armazenado, porque em todo campo selecao existente id
// e label coincidem. selecao_multipla precisa de ids estáveis e curtos
// (usados por Answer.value, ver domain/multi-select.ts, e por regras do
// orientation-engine) distintos do rótulo exibido.
export interface SelectOption {
	id: string;
	label: string;
}

type AnswerFieldTypeVariant =
	| { type: 'texto_curto'; options?: never }
	| { type: 'texto_longo'; options?: never }
	| { type: 'selecao'; options: string[] }
	| { type: 'selecao_multipla'; options: SelectOption[] }
	// PlanningItem[] estruturado (id/text, ordem = posição no array) — ver
	// domain/planning-items.ts. Valor estruturado de Answer para o
	// experimento C5-01 ("Decompor o trabalho"/"Priorizar entregas"), não uma
	// infraestrutura genérica de listas — não reaproveitar para outro campo
	// sem reavaliar essa decisão.
	| { type: 'lista_partes'; options?: never };

type AnswerFieldDefinition = FieldDefinitionBase &
	AnswerFieldTypeVariant & {
		dataTarget: 'answer';
		semanticRole?: 'hypothesis';
		projectProperty?: never;
		// Campo só aparece na interface quando o campo `fieldId` (irmão da
		// mesma atividade, sempre selecao_multipla) tem `optionId` marcado —
		// mecanismo genérico mínimo para "Outro" abrir um campo de texto,
		// sem acoplar ActivityForm a nenhuma atividade específica. Puramente
		// de exibição: não afeta validação nem obrigatoriedade.
		revealWhen?: { fieldId: string; optionId: string };
		// Oferece o texto de outra Answer já respondida como ponto de partida
		// editável — nunca cópia silenciosa, nunca vínculo persistente (ver
		// orientation-engine/field-suggestions.ts). Só é considerada enquanto
		// este campo não tiver Answer própria; aceitar copia o valor uma única
		// vez, e o campo continua sendo uma Answer independente dali em diante.
		// `activityId`/`fieldId` devem apontar para outro AnswerFieldDefinition
		// de tipo texto (validado em catalog/validate.ts). `actionLabel`/
		// `helpText` são texto de produto — vivem no catálogo, não derivados
		// automaticamente do título da atividade de origem, porque o texto da
		// ação varia por par (ex.: "Usar o problema como ponto de partida" não
		// é só o título de "Problema ou oportunidade").
		suggestedSource?: { activityId: string; fieldId: string; actionLabel: string; helpText: string };
		// Agrupa campos opcionais dentro de uma seção expansível (`<details>`),
		// para reduzir quantas caixas de texto grandes aparecem simultaneamente
		// numa atividade. Mecanismo genérico mínimo, no mesmo espírito de
		// `revealWhen`: todo campo com o mesmo `optionalGroup.id`, na mesma
		// atividade, é renderizado dentro de um único `<details>` na posição do
		// primeiro campo do grupo, com `optionalGroup.label` como `<summary>`.
		// Puramente de exibição — não afeta validação, obrigatoriedade nem
		// submissão (os campos continuam no mesmo `<form>` da atividade).
		optionalGroup?: { id: string; label: string };
	};

type ProjectPropertyFieldDefinition = FieldDefinitionBase & {
	dataTarget: 'project_property';
	projectProperty: 'name'; // único caso nesta versão: "Nome provisório"
	type: 'texto_curto';
	semanticRole?: never;
};

export type FieldDefinition = AnswerFieldDefinition | ProjectPropertyFieldDefinition;

// scope_confirmation é uma solução deliberadamente específica para a
// experiência "Escolha o próximo foco" (ScopeItem/ScopeVersion), não uma
// infraestrutura genérica de "Plays". Se uma segunda experiência
// especializada precisar de outro completion mode com o mesmo formato
// (confirmação explícita de um agregado próprio, fora de Answer), o conceito
// deve ser generalizado nesse momento — não acumular valores do tipo
// "risk_confirmation", "pulse_confirmation" etc.
export type CompletionMode = 'required_fields' | 'explicit_confirmation' | 'scope_confirmation';

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

export type RequiredFieldsActivity = ActivityDefinitionBase & {
	completionMode: 'required_fields';
	allowsSkip: boolean;
	fields: FieldDefinition[];
	pendingItemLabel: string;
	pendingItemDetail: string;
};

// Discriminada por allowsSkip (não só um boolean solto): quando true (C5-01,
// "Priorizar entregas"), pendingItemLabel/pendingItemDetail são obrigatórios
// — sem isso, skipActivity criaria um PendingItem sem texto para exibir.
// Quando false ("Resumo da descoberta", comportamento original preservado),
// os dois ficam ausentes, porque nunca há PendingItem para esta atividade.
// Nunca tem campos — conclui por ação explícita, não por formulário. Ver
// catalog/validate.ts para a checagem estrutural em tempo de execução (o
// catálogo é um valor, não passa pelo compilador sozinho).
type ExplicitConfirmationActivity = ActivityDefinitionBase &
	(
		| {
				completionMode: 'explicit_confirmation';
				allowsSkip: true;
				fields?: never;
				pendingItemLabel: string;
				pendingItemDetail: string;
		  }
		| {
				completionMode: 'explicit_confirmation';
				allowsSkip: false;
				fields?: never;
				pendingItemLabel?: never;
				pendingItemDetail?: never;
		  }
	);

// Confirmação deriva de ScopeVersion.confirmedAt (ver domain/state-types.ts),
// nunca de Answer — mesmo raciocínio de "sem campos/pendência" acima.
type ScopeConfirmationActivity = ActivityDefinitionBase & {
	completionMode: 'scope_confirmation';
	allowsSkip: false;
	fields?: never;
	pendingItemLabel?: never;
	pendingItemDetail?: never;
};

export type ActivityDefinition = RequiredFieldsActivity | ExplicitConfirmationActivity | ScopeConfirmationActivity;

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
