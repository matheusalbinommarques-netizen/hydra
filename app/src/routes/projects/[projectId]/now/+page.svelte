<script lang="ts">
	import { enhance } from '$app/forms';
	import ActivityForm from '$lib/components/ActivityForm.svelte';

	let { data, form } = $props();
	let view = $derived(data.view);
</script>

<svelte:head>
	<title>Agora — {view.projectName ?? 'Hydra'}</title>
</svelte:head>

<h1>Agora</h1>

{#if view.openPendingItems.length > 0}
	<section class="pendencias" aria-label="Pendências">
		<h2>Pendências</h2>
		<ul>
			{#each view.openPendingItems as item (item.id)}
				<li>
					<strong>{item.label}</strong>
					<p>{item.detail}</p>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if view.nextActivity.kind === 'catalog_limit_reached'}
	<section class="next-action">
		<h2>Você concluiu todas as atividades disponíveis</h2>
		<p>
			O catálogo metodológico desta versão termina aqui. Novas fases serão adicionadas em versões
			futuras.
		</p>
	</section>
{:else if data.activity?.completionMode === 'explicit_confirmation'}
	<section class="next-action">
		<p class="eyebrow">Próxima ação recomendada</p>
		<h2>{data.activity.title}</h2>
		<p class="main-question">{data.activity.mainQuestion}</p>
		<p><a href="/projects/{view.projectId}/summary">Ir para o Resumo da descoberta →</a></p>
	</section>
{:else if data.activity}
	<section class="next-action">
		<p class="eyebrow">Próxima ação recomendada</p>
		<h2>{data.activity.title}</h2>
		<p class="main-question">{data.activity.mainQuestion}</p>
		<p class="why"><strong>Por que isso importa:</strong> {data.activity.why}</p>
		<p class="example"><strong>Exemplo:</strong> {data.activity.example}</p>

		<form method="POST" action="?/answer" use:enhance>
			<input type="hidden" name="activityDefinitionId" value={data.activity.id} />
			<ActivityForm activity={data.activity} values={form?.values ?? view.answers} />
			<button type="submit">Salvar e continuar</button>
		</form>

		{#if form?.message}
			<p role="alert">{form.message}</p>
		{/if}
	</section>
{/if}

<style>
	.pendencias {
		border: 1px solid var(--hydra-warning);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.pendencias h2 {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		color: var(--hydra-warning);
	}

	.pendencias ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pendencias li p {
		margin: 0.15rem 0 0;
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.next-action {
		border: 1px solid var(--hydra-accent);
		border-radius: 12px;
		padding: 1.5rem;
		background: var(--hydra-surface-raised);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-accent);
	}

	.main-question {
		font-size: 1.1rem;
	}

	.why,
	.example {
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	form {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
