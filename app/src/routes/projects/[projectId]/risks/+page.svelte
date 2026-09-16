<script lang="ts">
	import RiskManagement from '$lib/components/RiskManagement.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Riscos</title>
</svelte:head>

<section class="risks-page">
	<header>
		<p class="eyebrow">Execução</p>
		<h1>Riscos</h1>
		<p class="subtitle">
			Identifique, avalie, responda e acompanhe os riscos deste projeto até encerrá-los.
		</p>
	</header>

	{#if form?.message}
		<p role="alert">{form.message}</p>
	{/if}

	<RiskManagement risks={data.risks} />
</section>

<style>
	.risks-page {
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
</style>
