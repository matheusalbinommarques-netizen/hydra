<script lang="ts">
	import { applyAction, enhance } from '$app/forms';

	// Estrutural, não RequiredFieldsActivity: required_fields sempre satisfaz
	// esta forma, e explicit_confirmation com allowsSkip true (C5-01,
	// "Priorizar entregas") também — pendingItemLabel/pendingItemDetail só
	// existem exatamente quando a atividade pode ser pulada (ver
	// catalog-types.ts), então nunca há ambiguidade sobre quando este
	// componente pode ser usado.
	let {
		activity
	}: { activity: { id: string; title: string; pendingItemDetail: string } } = $props();

	let dialogEl: HTMLDialogElement;
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	function openModal() {
		errorMessage = null;
		dialogEl.showModal();
	}

	function closeModal() {
		dialogEl.close();
	}
</script>

<div class="skip-activity">
	<button type="button" class="button-secondary" onclick={openModal}>Pular etapa</button>

	<dialog bind:this={dialogEl} aria-labelledby="skip-confirm-title" class="skip-confirm">
		<h2 id="skip-confirm-title">Pular "{activity.title}"?</h2>
		<p>Esta etapa não será concluída agora.</p>
		<p>{activity.pendingItemDetail}</p>
		<p>
			Uma pendência será criada e ficará visível em Agora e em Registros até você retomar e
			responder esta etapa.
		</p>

		{#if errorMessage}
			<p role="alert">{errorMessage}</p>
		{/if}

		<div class="actions">
			<button type="button" class="button-secondary" onclick={closeModal} disabled={submitting}>
				Cancelar
			</button>
			<form
				method="POST"
				action="?/skip"
				use:enhance={() => {
					submitting = true;
					errorMessage = null;
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'failure') {
							errorMessage =
								(result.data as { message?: string } | undefined)?.message ??
								'Não foi possível pular esta etapa.';
							return;
						}
						// O redirect de sucesso reaproveita a mesma rota (now/), então o
						// próprio elemento <dialog> pode continuar montado entre uma
						// atividade e outra — fechar explicitamente evita um modal aberto
						// bloqueando a próxima recomendação.
						closeModal();
						await applyAction(result);
					};
				}}
			>
				<input type="hidden" name="activityDefinitionId" value={activity.id} />
				<button type="submit" disabled={submitting}>
					{submitting ? 'Pulando…' : 'Confirmar'}
				</button>
			</form>
		</div>
	</dialog>
</div>

<style>
	.skip-activity {
		margin-top: 1rem;
	}

	.skip-confirm {
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 28rem;
		background: var(--hydra-surface-raised);
		color: var(--hydra-text);
	}

	.skip-confirm::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.skip-confirm h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
	}

	.skip-confirm p {
		margin: 0 0 0.75rem;
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.actions {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.actions form {
		display: contents;
	}
</style>
