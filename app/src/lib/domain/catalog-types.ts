// Tipos do catálogo metodológico — ver docs/06-architecture/contracts.md §1.

interface FieldDefinitionBase {
	id: string;
	activityId: string;
	label: string;
	required: boolean;
	placeholder?: string;
	help?: string;
}

type AnswerFieldTypeVariant =
	| { type: 'texto_curto'; options?: never }
	| { type: 'texto_longo'; options?: never }
	| { type: 'selecao'; options: string[] };

type AnswerFieldDefinition = FieldDefinitionBase &
	AnswerFieldTypeVariant & {
		dataTarget: 'answer';
		semanticRole?: 'hypothesis';
		projectProperty?: never;
	};

type ProjectPropertyFieldDefinition = FieldDefinitionBase & {
	dataTarget: 'project_property';
	projectProperty: 'name'; // único caso nesta versão: "Nome provisório"
	type: 'texto_curto';
	semanticRole?: never;
};

export type FieldDefinition = AnswerFieldDefinition | ProjectPropertyFieldDefinition;

// scope_confirmation é uma solução deliberadamente específica para a
// experiência "Monte a próxima versão" (ScopeItem/ScopeVersion), não uma
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

type ExplicitConfirmationActivity = ActivityDefinitionBase & {
	completionMode: 'explicit_confirmation';
	allowsSkip: false;
	// sem campos e sem textos de pendência — uma atividade de confirmação
	// explícita nunca tem formulário nem pode ser pulada, então nunca gera
	// PendingItem, e não precisa de textos para isso.
	fields?: never;
	pendingItemLabel?: never;
	pendingItemDetail?: never;
};

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
