// Chave de contexto Svelte compartilhada entre o shell do projeto
// (`[projectId]/+layout.svelte`, dono do painel/drawer de retorno) e
// qualquer componente descendente que precise abrir o retorno de uma
// ExternalAction específica (ex.: MapaDeImpacto.svelte, a partir do próprio
// AffectedGroup) — correção de UX pós-dogfooding da ETAPA 3
// (docs/core/HYDRA_PRODUCT_REWORK.md §33): "Registrar retorno" a partir do
// card, da faixa contextual ou da lista expandida sempre abre o MESMO
// drawer, operando sobre o mesmo ExternalAction.id — nunca uma segunda
// implementação de captura.
export const EXTERNAL_ACTION_CAPTURE_CONTEXT_KEY = 'hydra-external-action-capture';

export interface ExternalActionCaptureContext {
	open: (actionId: string) => void;
}
