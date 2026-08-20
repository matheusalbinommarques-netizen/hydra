// Event log incremental — ETAPA 7 do rework ("Event log incremental",
// docs/core/HYDRA_PRODUCT_REWORK.md §37). Histórico auxiliar de mudanças
// operacionais relevantes do loop WorkItem/Impediment (ETAPA 6) — nunca
// fonte de verdade: ProjectState continua sendo o único estado real (ver
// state-types.ts). Nunca reconstruído por replay, nunca um reducer.
//
// Taxonomia fechada por design: cada tipo é um evento nomeado, com payload
// próprio, em vez de um "Event" genérico com payload livre — evita virar
// framework de eventos antes de haver necessidade real. Qualquer novo tipo
// exige decisão explícita de corte, mesma regra que já vale para promover
// outros objetos vivos.

import type { ImpedimentType, WorkItemStatus } from './state-types';

export interface WorkItemCreatedEvent {
	id: string;
	projectId: string;
	type: 'work_item.created';
	entityType: 'work_item';
	entityId: string;
	payload: { title: string };
	createdAt: string;
}

export interface WorkItemStatusChangedEvent {
	id: string;
	projectId: string;
	type: 'work_item.status_changed';
	entityType: 'work_item';
	entityId: string;
	payload: { fromStatus: WorkItemStatus; toStatus: WorkItemStatus };
	createdAt: string;
}

export interface ImpedimentRegisteredEvent {
	id: string;
	projectId: string;
	type: 'impediment.registered';
	entityType: 'impediment';
	entityId: string;
	payload: { text: string; tipo: ImpedimentType };
	createdAt: string;
}

// Cobre tanto resolveImpediment quanto reopenImpediment — mesmo tipo,
// diferenciado só por fromStatus/toStatus, nunca dois tipos separados para
// o mesmo par de transições opostas (decisão registrada para a S7).
export interface ImpedimentStatusChangedEvent {
	id: string;
	projectId: string;
	type: 'impediment.status_changed';
	entityType: 'impediment';
	entityId: string;
	payload: { fromStatus: 'aberto' | 'resolvido'; toStatus: 'aberto' | 'resolvido' };
	createdAt: string;
}

export type ProjectEvent =
	| WorkItemCreatedEvent
	| WorkItemStatusChangedEvent
	| ImpedimentRegisteredEvent
	| ImpedimentStatusChangedEvent;

export type ProjectEventType = ProjectEvent['type'];
export type ProjectEventEntityType = ProjectEvent['entityType'];
