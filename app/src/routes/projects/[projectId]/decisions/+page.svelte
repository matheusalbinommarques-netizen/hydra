<script lang="ts">
	import DecisionManagement from '$lib/components/DecisionManagement.svelte';
	import ChangeManagement from '$lib/components/ChangeManagement.svelte';

	let { data, form } = $props();

	// Mudanças é região secundária do workspace de Decisões, fechada por
	// padrão (D066, Design Gate "Execução como workspace completo") — Change
	// continua um objeto distinto de Decision, nunca fundido nem promovido a
	// abertura automática.
	let showChanges = $state(false);
</script>

<svelte:head>
	<title>Decisões</title>
</svelte:head>

<section class="decisions-page">
	<header>
		<p class="eyebrow">Execução</p>
		<h1>Decisões</h1>
		<p class="subtitle">Registre, edite e acompanhe as decisões deste projeto até tomá-las.</p>
	</header>

	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	<DecisionManagement decisions={data.decisions} workItemOptions={data.workItemOptions} />

	<section class="changes-region">
		<button
			type="button"
			class="changes-toggle"
			aria-expanded={showChanges}
			aria-controls="changes-panel"
			onclick={() => (showChanges = !showChanges)}
		>
			Mudanças ({data.changes.length})
		</button>
		{#if showChanges}
			<div id="changes-panel">
				<ChangeManagement changes={data.changes} />
			</div>
		{/if}
	</section>
</section>

<style>
	.decisions-page {
		max-width: 52rem;
	}

	header {
		margin-bottom: var(--space-5);
	}

	.eyebrow {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	h1 {
		margin: 0 0 var(--space-2);
	}

	.subtitle {
		color: var(--hydra-muted);
		max-width: 42rem;
		line-height: 1.55;
		margin: 0;
	}

	.changes-region {
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		padding: var(--space-4) var(--space-5);
	}

	.changes-toggle {
		background: none;
		border: none;
		padding: 0;
		font-size: var(--font-size-subtitle);
		font-weight: 700;
		cursor: pointer;
		color: var(--hydra-text);
	}

	#changes-panel {
		margin-top: var(--space-4);
	}

	#changes-panel :global(.card) {
		border: none;
		padding: 0;
		margin-bottom: 0;
	}
</style>
