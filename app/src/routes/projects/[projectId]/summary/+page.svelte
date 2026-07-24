<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Resumo da descoberta</title>
</svelte:head>

<h1>Resumo da descoberta</h1>
<p>Revise o que entendemos até aqui antes de avançar.</p>

<div class="blocks">
	{#each data.blocks as block (block.title)}
		<section class="block">
			<h2>{block.title}</h2>
			{#if block.fields.length > 0}
				<dl>
					{#each block.fields as field (field.label)}
						<dt>{field.label}</dt>
						<dd>{field.value}</dd>
					{/each}
				</dl>
			{:else}
				<p class="empty">Ainda não respondida.</p>
			{/if}
		</section>
	{/each}
</div>

<form method="POST" action="?/confirm" use:enhance>
	<button type="submit">Confirmar resumo</button>
</form>

{#if form?.message}
	<p role="alert">{form.message}</p>
{/if}

<style>
	.blocks {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin: 1.5rem 0 2rem;
	}

	.block {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
	}

	.block h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	dl {
		margin: 0;
	}

	dt {
		font-size: 0.8rem;
		color: var(--hydra-muted);
		margin-top: 0.5rem;
	}

	dd {
		margin: 0.15rem 0 0;
	}

	.empty {
		color: var(--hydra-muted);
		margin: 0;
	}
</style>
