<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import ActivityForm from '$lib/components/ActivityForm.svelte';
	import EntenderSituacao from '$lib/components/EntenderSituacao.svelte';
	import MapaDeImpacto from '$lib/components/MapaDeImpacto.svelte';
	import PlanningItemsEditor from '$lib/components/PlanningItemsEditor.svelte';
	import SkipActivityConfirm from '$lib/components/SkipActivityConfirm.svelte';
	import { encodePlanningItems } from '$lib/domain';
	import type { PlanningItem } from '$lib/domain';
	import type { PhaseProgressGroupKey } from '$lib/phase-progress';

	let { data, form } = $props();
	let view = $derived(data.view);
	// Layout de duas colunas só quando a atividade atual pertence a
	// Descoberta, Definição do produto ou Estruturação — as demais fases
	// continuam sem Bancada, revisadas só quando Acompanhamento/Colheita
	// chegarem lá. A coluna lateral genérica (Progresso da fase) aparece em
	// todas as fases, exceto "Entender a situação" — ver workspace-layout
	// abaixo.
	let isBancadaPhase = $derived(
		data.activity?.phaseId === 'descoberta' ||
			data.activity?.phaseId === 'definicao' ||
			data.activity?.phaseId === 'estruturacao'
	);

	// "Entender a situação" e "Quem é afetado" trazem seu próprio shell (topbar
	// de progresso e, quando aplicável, painel lateral próprio) — sem o
	// Progresso da fase/Bancada genéricos ao lado, a coluna principal ocupa a
	// largura toda (mesmo espírito de .dark-activity em +layout.svelte).
	const OWN_SHELL_ACTIVITY_IDS = new Set(['problema', 'publico']);
	let hasOwnShell = $derived(OWN_SHELL_ACTIVITY_IDS.has(data.activity?.id ?? ''));

	// "Revisão recomendada" (Resumo) é só um card pequeno com um link de
	// saída — sem isto, sobra muito espaço vazio na coluna principal ao lado
	// do painel lateral, que a essa altura da jornada já está densa. Ajuste
	// só deste caso específico, sem alterar o layout geral de duas colunas.
	// Identidade por id, não por completionMode: "Priorizar entregas" (C5-01)
	// também é explicit_confirmation, mas tem sua própria apresentação (ver
	// branch dedicada abaixo), não o link de saída do Resumo.
	let isReviewRecommendation = $derived(data.activity?.id === 'resumo');
	let openImpedimentsCount = $derived(view.impediments.filter((i) => i.status === 'aberto').length);

	// C5-01 — "Priorizar entregas": estado local da MESMA coleção que
	// "Decompor o trabalho" produziu. Cada ↑/↓ atualiza este estado e submete
	// o form escondido abaixo, que reaproveita a action genérica `?/answer`
	// gravando na Answer de "Decompor o trabalho" — nunca uma representação
	// textual própria da prioridade.
	// svelte-ignore state_referenced_locally -- seed intencional de montagem.
	let priorityItems = $state<PlanningItem[]>(data.planningItems ?? []);
	let priorityReorderForm = $state<HTMLFormElement | undefined>();

	// A navegação entre atividades dentro de Agora é client-side (AJAX, via
	// use:enhance) — o componente da página não remonta, então o seed acima
	// não é suficiente sozinho: sem isto, priorityItems ficaria preso ao
	// valor do primeiro carregamento (ex.: `[]`, se a página abriu em
	// "Decompor o trabalho") e nunca refletiria os itens reais ao chegar em
	// "Priorizar entregas" por essa navegação — só um recarregamento
	// completo da página "corrigia" o sintoma, mascarando o bug. Resincroniza
	// só quando a atividade atual É "Priorizar entregas": o efeito também
	// re-executa depois do próprio autosave de reordenação (data.planningItems
	// muda), o que é inofensivo — o servidor já confirma o mesmo conteúdo.
	$effect(() => {
		if (data.activity?.id === 'priorizar_entregas') {
			priorityItems = data.planningItems ?? [];
		}
	});

	// Mesmo vocabulário de ícone já usado pelo Mapa (Concluída/Atual ~
	// em_andamento/Pendente/Pulada) — coerência de linguagem visual entre as
	// duas telas que compartilham a mesma projeção (phase-activities.ts).
	const PHASE_PROGRESS_GROUP_LABEL: Record<PhaseProgressGroupKey, string> = {
		concluidas: 'Concluídas',
		atual: 'Atual',
		pendentes: 'Pendentes',
		puladas: 'Puladas'
	};
	const PHASE_PROGRESS_GROUP_ICON: Record<PhaseProgressGroupKey, string> = {
		concluidas: '●',
		atual: '◐',
		pendentes: '○',
		puladas: '↷'
	};
	let phaseProgressPercent = $derived(
		data.phaseProgress && data.phaseProgress.totalActivities > 0
			? Math.round((data.phaseProgress.resolvedActivities / data.phaseProgress.totalActivities) * 100)
			: 0
	);
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
			<a href="/projects/{view.projectId}/tracking">ver em Acompanhamento</a>
		</p>
	{/if}

	{#if data.journeyContext && !hasOwnShell}
		<section class="journey-context" aria-label="Onde estamos">
			<p class="journey-label">Onde estamos</p>
			{#if data.journeyContext.kind === 'in_progress'}
				<p class="journey-phase">{data.journeyContext.phaseLabel}</p>
				<p class="journey-position">Fase {data.journeyContext.position} de {data.journeyContext.total}</p>
			{:else}
				<p class="journey-phase">Jornada concluída</p>
				<p class="journey-position">{data.journeyContext.total} de {data.journeyContext.total} fases percorridas</p>
			{/if}
		</section>
	{/if}

	{#if data.activity?.id === 'resumo'}
		<section class="next-action">
			<p class="eyebrow">Revisão recomendada</p>
			<h2>{data.activity.title}</h2>
			<p class="main-question">{data.activity.mainQuestion}</p>
			<p><a href="/projects/{view.projectId}/summary">Ir para o Resumo da descoberta →</a></p>
		</section>
	{:else if data.activity?.id === 'priorizar_entregas'}
		<section class="next-action">
			{#if priorityItems.length === 0}
				<p class="eyebrow">Priorizar entregas</p>
				<h2>{data.activity.title}</h2>
				<p>Nenhuma parte foi definida.</p>
				<p>
					<a href="/projects/{view.projectId}/now?activity=decompor_trabalho"
						>Voltar para decompor o trabalho →</a
					>
				</p>
			{:else}
				<p class="eyebrow">Atividade atual · dados já no projeto</p>
				<h2>{data.activity.title}</h2>
				<p class="main-question">{data.activity.mainQuestion}</p>

				<!-- Reaproveita a action genérica `?/answer`, gravando na Answer de
				     "Decompor o trabalho" mesmo estando em "Priorizar entregas" — a
				     coleção é a mesma, nunca uma cópia. -->
				<form
					method="POST"
					action="?/answer"
					bind:this={priorityReorderForm}
					use:enhance={() => async ({ update }) => update({ reset: false })}
				>
					<input type="hidden" name="activityDefinitionId" value="decompor_trabalho" />
					<input type="hidden" name="partes_trabalho" value={encodePlanningItems(priorityItems)} />
				</form>

				<PlanningItemsEditor
					items={priorityItems}
					mode="operate"
					onchange={async (items) => {
						priorityItems = items;
						// tick() é necessário aqui: requestSubmit() lê o DOM
						// imediatamente, mas o <input type="hidden"> acima só reflete
						// priorityItems depois que o Svelte aplica a atualização — sem
						// aguardar, o form submeteria a ordem ANTERIOR (bug real,
						// encontrado ao reproduzir manualmente antes desta correção).
						await tick();
						priorityReorderForm?.requestSubmit();
					}}
				/>

				<form method="POST" action="?/confirmPlanningPriority" use:enhance>
					<button type="submit">Confirmar prioridade</button>
				</form>

				{#if form?.message}
					<p role="alert">{form.message}</p>
				{/if}
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'problema' && data.activity.completionMode === 'required_fields'}
		<EntenderSituacao
			activity={data.activity}
			values={form?.values ?? view.answers}
			originAnswer={view.answers['origem']}
			reviewOrigin={data.reviewOrigin ?? undefined}
			phaseProgress={data.phaseProgress}
			projectName={view.projectName}
		/>
	{:else if data.activity?.id === 'publico' && data.activity.completionMode === 'explicit_confirmation'}
		<MapaDeImpacto
			activity={data.activity}
			affectedGroups={view.affectedGroups}
			affectedGroupConfirmationIssues={view.affectedGroupConfirmationIssues}
			externalActions={view.externalActions}
			evidences={view.evidences}
			reviewOrigin={data.reviewOrigin ?? undefined}
			phaseProgress={data.phaseProgress}
			projectName={view.projectName}
			projectId={view.projectId}
			situacaoSynthesis={view.answers['situacao']}
		/>
	{:else if data.activity?.completionMode === 'scope_confirmation'}
		<section class="next-action">
			<p class="eyebrow">Próxima ação recomendada</p>
			<h2>{data.activity.title}</h2>
			<p class="main-question">{data.activity.mainQuestion}</p>
			<p><a href="/projects/{view.projectId}/next-version">Ir para Escolha o próximo foco →</a></p>
		</section>
	{:else if data.activity && data.activity.completionMode === 'required_fields'}
		<section class="next-action">
			<p class="eyebrow">
				{#if data.reviewOrigin === 'summary'}
					Editando a partir do Resumo da descoberta
				{:else if data.reviewOrigin === 'records'}
					Revisando a partir de Registros
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
						// Edição a partir de Resumo/Registros: em sucesso a própria
						// action redireciona (303) para a origem (/summary ou
						// /records) — update() já segue esse redirect. Progressão
						// campo a campo: em sucesso a própria action redireciona (303)
						// para o próximo campo/etapa/atividade — update() também já
						// segue esses redirects normalmente. Em erro, permanece nesta
						// tela normalmente em ambos os casos.
						await update();
					};
				}}
			>
				<input type="hidden" name="activityDefinitionId" value={data.activity.id} />
				{#if data.reviewOrigin}
					<input type="hidden" name="returnTo" value={data.reviewOrigin} />
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
				<button type="submit"
					>{data.reviewOrigin === 'summary'
						? 'Salvar e voltar ao Resumo'
						: data.reviewOrigin === 'records'
							? 'Salvar e voltar a Registros'
							: 'Salvar e continuar'}</button
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

			{#if data.activity.allowsSkip && !data.isResuming && !data.reviewOrigin}
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

<div class="workspace-layout" class:full-width={hasOwnShell}>
	<div class="workspace-main" class:center-single-card={isReviewRecommendation}>
		{@render mainContent()}
	</div>
	{#if !hasOwnShell}
	<aside class="workspace-sidebar" aria-label="Progresso e contexto">
		{#if data.phaseProgress}
			<section class="sidebar-card" aria-label="Progresso da fase">
				<p class="sidebar-card-eyebrow">Progresso da fase</p>
				<p class="phase-progress-label">{data.phaseProgress.phaseLabel}</p>
				<p class="phase-progress-resolved">
					{data.phaseProgress.resolvedActivities} de {data.phaseProgress.totalActivities} atividades resolvidas
				</p>
				<div class="phase-progress-bar" role="presentation">
					<div class="phase-progress-bar-fill" style="width: {phaseProgressPercent}%"></div>
				</div>
				{#each data.phaseProgress.groups as group (group.key)}
					{#if group.activities.length > 0}
						<div class="phase-progress-group">
							<p class="phase-progress-group-label">{PHASE_PROGRESS_GROUP_LABEL[group.key]}</p>
							<ul>
								{#each group.activities as activity (activity.id)}
									<li class="phase-progress-group-item" class:is-current={group.key === 'atual'}>
										<span class="phase-progress-icon" aria-hidden="true">{PHASE_PROGRESS_GROUP_ICON[group.key]}</span>
										<span>{activity.title}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/each}
			</section>
		{/if}

		{#if isBancadaPhase}
			<section class="sidebar-card bancada-panel" aria-label="O que já sabemos até aqui">
				<p class="sidebar-card-eyebrow">O que já sabemos</p>
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
			</section>
		{/if}
	</aside>
	{/if}
</div>

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

	.journey-context {
		margin: 0 0 1rem;
	}

	.journey-label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.journey-phase {
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.journey-position {
		margin: 0.1rem 0 0;
		font-size: 0.8rem;
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

	.workspace-layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
		gap: 2rem;
		align-items: start;
	}

	/* "Entender a situação" traz seu próprio painel lateral ("Documento do
	   projeto", dentro de EntenderSituacao.svelte) — sem o Progresso da
	   fase/Bancada genéricos ao lado, a coluna principal ocupa a largura
	   toda. */
	.workspace-layout.full-width {
		grid-template-columns: 1fr;
	}

	/* Só o caso "Revisão recomendada" (explicit_confirmation) — estica a
	   coluna principal até a altura do painel lateral (a mais alta das duas
	   nesse ponto da jornada) e centraliza o card pequeno no espaço sobrando,
	   sem tocar no h1/pendências acima dele nem no restante do layout. */
	.workspace-main.center-single-card {
		display: flex;
		flex-direction: column;
		align-self: stretch;
	}

	.center-single-card .next-action {
		margin-top: auto;
		margin-bottom: auto;
		padding: 2.5rem;
	}

	.workspace-sidebar {
		position: sticky;
		top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.sidebar-card {
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		padding: 1.25rem;
		background: var(--hydra-surface);
	}

	.sidebar-card-eyebrow {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.phase-progress-label {
		margin: -0.5rem 0 0.4rem;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.phase-progress-resolved {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.phase-progress-bar {
		height: 6px;
		border-radius: 999px;
		background: var(--hydra-bg);
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.phase-progress-bar-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--hydra-accent);
	}

	.phase-progress-group {
		margin-bottom: 1.1rem;
	}

	.phase-progress-group:last-child {
		margin-bottom: 0;
	}

	.phase-progress-group-label {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.phase-progress-group ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.phase-progress-group-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.phase-progress-group-item.is-current {
		font-weight: 700;
		color: var(--hydra-text);
	}

	.phase-progress-icon {
		flex-shrink: 0;
		line-height: 1.4;
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
		.workspace-layout {
			grid-template-columns: 1fr;
		}

		.workspace-sidebar {
			position: static;
		}

		.next-action form button[type='submit'] {
			width: 100%;
		}
	}
</style>
