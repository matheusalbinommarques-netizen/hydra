<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import ActivityForm from '$lib/components/ActivityForm.svelte';
	import SkipActivityConfirm from '$lib/components/SkipActivityConfirm.svelte';

	let { data, form } = $props();
	let view = $derived(data.view);
	// Layout de duas colunas só quando a atividade atual pertence a
	// Descoberta ou Definição do produto — as demais fases continuam de
	// coluna única, revisadas só quando o Cockpit/Colheita chegarem lá.
	let isBancadaPhase = $derived(
		data.activity?.phaseId === 'descoberta' || data.activity?.phaseId === 'definicao'
	);

	// "Revisão recomendada" (Resumo) é só um card pequeno com um link de
	// saída — sem isto, sobra muito espaço vazio na coluna principal ao lado
	// do painel lateral, que a essa altura da jornada já está denso. Ajuste
	// só deste caso específico, sem alterar o layout geral de duas colunas.
	let isReviewRecommendation = $derived(data.activity?.completionMode === 'explicit_confirmation');
	let openImpedimentsCount = $derived(view.impediments.filter((i) => i.status === 'aberto').length);
</script>

<svelte:head>
	<title>Agora — {view.projectName ?? 'Hydra'}</title>
</svelte:head>

{#snippet mainContent()}
	<h1>Agora</h1>

	{#if view.openPendingItems.length > 0}
		<section class="pendencias" aria-label="Pendências">
			<h2>Pendências</h2>
			<ul>
				{#each view.openPendingItems as item (item.id)}
					<li>
						<strong>{item.label}</strong>
						<p>{item.detail}</p>
						<a href="/projects/{view.projectId}/now?activity={item.activityDefinitionId}">
							Retomar etapa
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if openImpedimentsCount > 0}
		<p class="impediments-indicator">
			{openImpedimentsCount}
			{openImpedimentsCount === 1 ? 'impedimento aberto' : 'impedimentos abertos'} —
			<a href="/projects/{view.projectId}/cockpit">ver no Cockpit</a>
		</p>
	{/if}

	{#if data.activity?.completionMode === 'explicit_confirmation'}
		<section class="next-action">
			<p class="eyebrow">Revisão recomendada</p>
			<h2>{data.activity.title}</h2>
			<p class="main-question">{data.activity.mainQuestion}</p>
			<p><a href="/projects/{view.projectId}/summary">Ir para o Resumo da descoberta →</a></p>
		</section>
	{:else if data.activity?.completionMode === 'scope_confirmation'}
		<section class="next-action">
			<p class="eyebrow">Próxima ação recomendada</p>
			<h2>{data.activity.title}</h2>
			<p class="main-question">{data.activity.mainQuestion}</p>
			<p><a href="/projects/{view.projectId}/next-version">Ir para Escolha o próximo foco →</a></p>
		</section>
	{:else if data.activity}
		<section class="next-action">
			<p class="eyebrow">
				{#if data.isEditingFromSummary}
					Editando a partir do Resumo da descoberta
				{:else if data.isResuming}
					Retomando etapa pulada
				{:else if data.stepKind === 'optional'}
					Mais contexto (opcional)
				{:else}
					Próxima ação recomendada
				{/if}
			</p>
			<h2>{data.activity.title}</h2>
			<p class="main-question">{data.activity.mainQuestion}</p>
			<p class="why"><strong>Por que isso importa:</strong> {data.activity.why}</p>
			<p class="example"><strong>Exemplo:</strong> {data.activity.example}</p>

			<form
				method="POST"
				action="?/answer"
				use:enhance={() => {
					const wasResuming = data.isResuming;
					return async ({ result, update }) => {
						if (wasResuming && result.type === 'success') {
							// Sai do parâmetro de retomada só quando a resposta teve sucesso —
							// em erro, o usuário permanece na atividade retomada (update()
							// aplica o form.message/values normalmente, sem navegar).
							await goto(`/projects/${view.projectId}/now`, { invalidateAll: true });
							return;
						}
						// Edição a partir do Resumo: em sucesso a própria action
						// redireciona (303) para /summary — update() já segue esse
						// redirect. Progressão campo a campo: em sucesso a própria
						// action redireciona (303) para o próximo campo/etapa/atividade
						// — update() também já segue esses redirects normalmente. Em
						// erro, permanece nesta tela normalmente em ambos os casos.
						await update();
					};
				}}
			>
				<input type="hidden" name="activityDefinitionId" value={data.activity.id} />
				{#if data.isEditingFromSummary}
					<input type="hidden" name="returnTo" value="summary" />
				{/if}
				{#if data.stepKind !== 'full'}
					<input type="hidden" name="_stepKind" value={data.stepKind} />
					<input type="hidden" name="_stepFieldIds" value={data.activity.fields.map((f) => f.id).join(',')} />
				{/if}
				<ActivityForm
					activity={data.activity}
					values={form?.values ?? view.answers}
					fieldSuggestions={view.fieldSuggestions}
				/>
				<button type="submit">{data.isEditingFromSummary ? 'Salvar e voltar ao Resumo' : 'Salvar e continuar'}</button
				>
			</form>

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.stepKind === 'optional'}
				<p class="skip-optional">
					<a href="/projects/{view.projectId}/now">Avançar sem preencher →</a>
				</p>
			{/if}

			{#if data.activity.allowsSkip && !data.isResuming && !data.isEditingFromSummary}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if view.nextActivity.kind === 'catalog_limit_reached'}
		<section class="next-action">
			<h2>Você concluiu todas as atividades disponíveis</h2>
			<p>
				Você percorreu a jornada guiada completa, da Descoberta ao encerramento do projeto. Pendências
				abertas, se houver, continuam visíveis aqui e no Mapa — revise e retome quando quiser.
			</p>
		</section>
	{/if}
{/snippet}

{#if isBancadaPhase}
	<div class="bancada-layout">
		<div class="bancada-main" class:center-single-card={isReviewRecommendation}>
			{@render mainContent()}
		</div>
		<aside class="bancada-panel" aria-label="O que já sabemos até aqui">
			<h2>O que já sabemos</h2>
			{#if data.bancadaOverview.blocks.length > 0}
				<div class="panel-blocks">
					{#each data.bancadaOverview.blocks as block (block.activityId)}
						<section class="panel-block">
							<h3>{block.heading}</h3>
							<p>{block.value}</p>
							{#if block.chips && block.chips.length > 0}
								<ul class="chip-list">
									{#each block.chips as chip (chip)}
										<li class="chip">{chip}</li>
									{/each}
								</ul>
							{/if}
						</section>
					{/each}
				</div>
			{:else}
				<p class="panel-empty">Ainda não há respostas suficientes para mostrar aqui.</p>
			{/if}
		</aside>
	</div>
{:else}
	{@render mainContent()}
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

	.pendencias li a {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.impediments-indicator {
		margin: 0 0 1.5rem;
		font-size: 0.9rem;
		color: var(--hydra-muted);
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

	.skip-optional {
		margin: 0.75rem 0 0;
		font-size: 0.9rem;
	}

	.bancada-layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
		gap: 2rem;
		align-items: start;
	}

	/* Só o caso "Revisão recomendada" (explicit_confirmation) — estica a
	   coluna principal até a altura do painel lateral (a mais alta das duas
	   nesse ponto da jornada) e centraliza o card pequeno no espaço sobrando,
	   sem tocar no h1/pendências acima dele nem no restante do layout. */
	.bancada-main.center-single-card {
		display: flex;
		flex-direction: column;
		align-self: stretch;
	}

	.center-single-card .next-action {
		margin-top: auto;
		margin-bottom: auto;
		padding: 2.5rem;
	}

	.bancada-panel {
		position: sticky;
		top: 1.5rem;
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		padding: 1.25rem;
		background: var(--hydra-surface);
	}

	.bancada-panel h2 {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.panel-blocks {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel-block {
		border-bottom: 1px solid var(--hydra-border);
		padding-bottom: 1rem;
	}

	.panel-block:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.panel-block h3 {
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
	}

	.panel-block p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.panel-empty {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.chip-list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		color: var(--hydra-muted);
	}

	@media (max-width: 860px) {
		.bancada-layout {
			grid-template-columns: 1fr;
		}

		.bancada-panel {
			position: static;
		}
	}
</style>
