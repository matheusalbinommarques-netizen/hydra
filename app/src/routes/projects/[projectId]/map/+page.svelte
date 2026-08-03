<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { PhaseStatus } from '$lib/orientation-engine';
	import type { PhaseActivityView } from '$lib/phase-activities';
	import { ROUTE_DIAGNOSTIC_QUESTIONS } from '$lib/route-diagnostic-questions';

	let { data, form } = $props();
	let projectId = $derived(page.params.projectId);

	// Recolhido por padrão — a Jornada volta a ser a ação principal da tela;
	// o diagnóstico e o ponto de partida continuam com a mesma mecânica de
	// sempre, só menos proeminentes (ver Jornada — Hydra, Claude Design).
	let diagnosticOpen = $state(false);
	function toggleDiagnostic() {
		diagnosticOpen = !diagnosticOpen;
	}

	const phaseStatusLabel: Record<PhaseStatus, string> = {
		não_iniciada: 'Não iniciada',
		em_andamento: 'Em andamento',
		concluída_com_pendências: 'Concluída com pendências',
		concluída: 'Concluída'
	};

	// Rótulo de apresentação da atividade — não é um novo status de domínio,
	// só a prioridade de exibição definida no artefato aprovado sobre os
	// quatro estados reais de ActivityStatus + isCurrent já existentes.
	type DisplayStatus = 'concluída' | 'atual' | 'pendente' | 'pulada';

	function displayStatus(activity: PhaseActivityView): DisplayStatus {
		if (activity.isCurrent || activity.status === 'em_andamento') return 'atual';
		if (activity.status === 'concluída') return 'concluída';
		if (activity.status === 'pulada') return 'pulada';
		return 'pendente';
	}

	const displayStatusLabel: Record<DisplayStatus, string> = {
		concluída: 'Concluída',
		atual: 'Atual',
		pendente: 'Pendente',
		pulada: 'Pulada'
	};

	const displayStatusIcon: Record<DisplayStatus, string> = {
		concluída: '●',
		atual: '◐',
		pendente: '○',
		pulada: '↷'
	};

	const LEGEND_ITEMS: DisplayStatus[] = ['concluída', 'atual', 'pendente', 'pulada'];
</script>

{#snippet legend()}
	<p class="legend-title">Legenda</p>
	{#each LEGEND_ITEMS as item (item)}
		<div class="legend-row" class:is-warning={item === 'pulada'}>
			<span class="legend-icon">{displayStatusIcon[item]}</span>
			{displayStatusLabel[item]}
		</div>
	{/each}
{/snippet}

<svelte:head>
	<title>Jornada — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<div class="intro-row">
	<div>
		<h1>Jornada</h1>
		<p class="subtitle">
			Esta tela mostra o caminho completo do projeto: onde você está, o que já foi percorrido e o que ainda vem a
			seguir.
		</p>
	</div>
	<a class="cta button-secondary" href="/projects/{projectId}/now">Continuar em Agora</a>
</div>

<section class="diagnostic-band" aria-labelledby="diagnostic-heading">
	<button
		type="button"
		class="diagnostic-header"
		aria-expanded={diagnosticOpen}
		aria-controls="diagnostic-body"
		onclick={toggleDiagnostic}
	>
		<span>
			<span id="diagnostic-heading" class="diagnostic-title">Diagnóstico e ponto de partida</span>
			<span class="diagnostic-caption">Perguntas de diagnóstico e escolha da fase inicial da jornada</span>
		</span>
		<span class="diagnostic-chevron" aria-hidden="true">{diagnosticOpen ? '−' : '+'}</span>
	</button>

	{#if diagnosticOpen}
		<div id="diagnostic-body" class="diagnostic-body">
			<div class="diagnostic-subblock">
				<h2>Diagnóstico da rota</h2>
				<p class="diagnostic-note">
					Responda às cinco perguntas abaixo para calcular uma recomendação de ponto de partida. As respostas não
					são salvas — só a fase que você aplicar ao final.
				</p>
				<form method="POST" action="?/diagnoseRouteStart" use:enhance>
					<ol class="diagnostic-questions">
						{#each ROUTE_DIAGNOSTIC_QUESTIONS as question (question.phaseId)}
							<li>
								<p class="question">{question.question}</p>
								<div class="answer-choices" role="radiogroup" aria-label={question.question}>
									<label>
										<input
											type="radio"
											name={question.phaseId}
											value="sim"
											checked={form?.diagnostic?.answers?.[question.phaseId] === true}
											required
										/>
										Sim
									</label>
									<label>
										<input
											type="radio"
											name={question.phaseId}
											value="nao"
											checked={form?.diagnostic?.answers?.[question.phaseId] === false}
											required
										/>
										Não
									</label>
								</div>
							</li>
						{/each}
					</ol>
					<button type="submit">Calcular recomendação</button>
				</form>
				{#if form?.diagnosticMessage}
					<p role="alert">{form.diagnosticMessage}</p>
				{/if}
				{#if form?.diagnostic}
					<div class="recommendation" role="status">
						<p class="recommendation-phase">
							Fase recomendada: <strong>{form.diagnostic.recommendation.phaseLabel}</strong>
						</p>
						<p class="recommendation-justification">{form.diagnostic.recommendation.justification}</p>
						<form method="POST" action="?/setRouteStart" use:enhance>
							<input type="hidden" name="phaseId" value={form.diagnostic.recommendation.phaseId} />
							<button type="submit" class="button-secondary">Aplicar recomendação</button>
						</form>
					</div>
				{/if}
			</div>

			<div class="diagnostic-subblock">
				<h2>Onde este projeto realmente começa?</h2>
				<p class="diagnostic-note">
					O Mapa abaixo continua mostrando o percurso completo — esta escolha só muda a partir de onde a próxima
					ação é recomendada.
				</p>
				<form method="POST" action="?/setRouteStart" use:enhance class="route-start-form">
					<select name="phaseId">
						<option value="" selected={data.routeStartPhaseId === null}>Percurso completo</option>
						{#each data.routeStartPhaseOptions as option (option.id)}
							<option value={option.id} selected={data.routeStartPhaseId === option.id}>{option.label}</option>
						{/each}
					</select>
					<button type="submit">Salvar</button>
				</form>
				{#if form?.message}
					<p role="alert">{form.message}</p>
				{/if}
			</div>
		</div>
	{/if}
</section>

<section class="legend-compact" aria-label="Legenda">
	{#each LEGEND_ITEMS as item (item)}
		<span class="legend-compact-item" class:is-warning={item === 'pulada'}>
			<span class="legend-icon">{displayStatusIcon[item]}</span>
			{displayStatusLabel[item]}
		</span>
	{/each}
</section>

<div class="composition">
	<div class="phases-column">
		{#each data.phases as phase (phase.id)}
			<section class="phase" class:current={phase.isCurrent}>
				<header>
					<div class="phase-header-left">
						<span class="phase-number">{phase.order}</span>
						<h2>{phase.label}</h2>
					</div>
					<span class="phase-status">{phaseStatusLabel[phase.phaseStatus]}</span>
				</header>

				{#if phase.catalogStatus === 'unavailable'}
					<p class="empty">Ainda não disponível nesta versão.</p>
				{:else}
					{#if phase.catalogStatus === 'partial'}
						<p class="partial-note">Catálogo parcial — mais atividades serão adicionadas futuramente.</p>
					{/if}
					<ul>
						{#each phase.activities as activity (activity.id)}
							{@const status = displayStatus(activity)}
							<li class:is-current={status === 'atual'} class:is-warning={status === 'pulada'}>
								<div class="activity-main-row">
									<span class="status-icon" aria-hidden="true">{displayStatusIcon[status]}</span>
									<span class="title">{activity.title}</span>
									<span class="status-label">{displayStatusLabel[status]}</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	</div>

	<aside class="legend-column" aria-label="Legenda">
		<div class="legend-card">
			{@render legend()}
		</div>
	</aside>
</div>

<style>
	.intro-row {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		margin-bottom: var(--space-5);
	}

	.subtitle {
		margin: 0;
		color: var(--hydra-muted);
		max-width: 38rem;
		font-size: var(--font-size-meta);
	}

	.cta {
		flex-shrink: 0;
		white-space: nowrap;
		text-decoration: none;
	}

	.diagnostic-band {
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface);
		margin-bottom: var(--space-6);
		overflow: hidden;
	}

	.diagnostic-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		background: transparent;
		border: none;
		padding: var(--space-4) var(--space-5);
		cursor: pointer;
		text-align: left;
		font: inherit;
		font-weight: 400;
		color: var(--hydra-text);
		min-height: 2.75rem;
	}

	.diagnostic-title {
		display: block;
		font-weight: 700;
		font-size: var(--font-size-meta);
	}

	.diagnostic-caption {
		display: block;
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
		margin-top: 0.2rem;
	}

	.diagnostic-chevron {
		font-size: 0.9rem;
		color: var(--hydra-muted);
		flex-shrink: 0;
	}

	.diagnostic-body {
		padding: 0 var(--space-5) var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		border-top: 1px solid var(--hydra-border);
	}

	.diagnostic-subblock {
		padding-top: var(--space-5);
	}

	.diagnostic-subblock h2 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-meta);
	}

	.diagnostic-note {
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		margin: 0 0 var(--space-4);
	}

	.diagnostic-questions {
		list-style: none;
		margin: 0 0 var(--space-4);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.diagnostic-questions .question {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
	}

	.answer-choices {
		display: flex;
		gap: var(--space-4);
		font-size: var(--font-size-meta);
		flex-wrap: wrap;
	}

	.recommendation {
		margin-top: var(--space-4);
		padding-top: var(--space-3);
		border-top: 1px solid var(--hydra-border);
	}

	.recommendation-phase {
		margin: 0 0 0.35rem;
	}

	.recommendation-justification {
		color: var(--hydra-muted);
		font-size: var(--font-size-meta);
		margin: 0 0 var(--space-3);
	}

	.route-start-form {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		flex-wrap: wrap;
	}

	.legend-compact {
		display: none;
		flex-wrap: wrap;
		gap: 0.5rem var(--space-5);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-5);
		font-size: var(--font-size-meta);
	}

	.legend-compact-item {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.legend-compact-item.is-warning {
		color: var(--hydra-warning);
	}

	.composition {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(14rem, 1fr);
		gap: var(--space-6);
		align-items: start;
	}

	.phases-column {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}

	.legend-column {
		position: sticky;
		top: var(--space-5);
	}

	.legend-card {
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface);
		padding: var(--space-5);
	}

	.legend-title {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-caption);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--hydra-muted);
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: var(--font-size-meta);
		margin-bottom: var(--space-3);
	}

	.legend-row.is-warning {
		color: var(--hydra-warning);
	}

	.legend-icon {
		font-size: 1rem;
		width: 1.1rem;
		text-align: center;
	}

	.phase {
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		padding: var(--space-5) var(--space-5);
		background: var(--hydra-surface);
	}

	.phase.current {
		border: 2px solid var(--hydra-text);
		background: var(--hydra-surface-raised);
		box-shadow: var(--hydra-shadow-raised);
	}

	.phase header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.phase-header-left {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.phase-number {
		font-family: 'Source Serif 4', Georgia, serif;
		font-weight: 700;
		font-size: 1.1rem;
	}

	.phase h2 {
		margin: 0;
		font-size: var(--font-size-subtitle);
	}

	.phase-status {
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
		flex-shrink: 0;
	}

	.phase.current .phase-status {
		font-weight: 700;
		color: var(--hydra-text);
	}

	.empty,
	.partial-note {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: var(--space-3) 0 0;
	}

	ul {
		list-style: none;
		margin: var(--space-4) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	li {
		border-radius: 6px;
		padding: 0.15rem var(--space-3);
	}

	li.is-current {
		background: rgba(21, 25, 24, 0.06);
		padding: 0.55rem var(--space-3);
	}

	.activity-main-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		font-size: 0.92rem;
	}

	.status-icon {
		font-size: 1rem;
		width: 1.2rem;
		text-align: center;
		flex-shrink: 0;
	}

	li.is-current .status-icon {
		color: var(--hydra-text);
	}

	li.is-warning .status-icon,
	li.is-warning .status-label {
		color: var(--hydra-warning);
	}

	.title {
		flex: 1 1 auto;
		min-width: 0;
		overflow-wrap: break-word;
	}

	li.is-current .title {
		font-weight: 700;
	}

	li.is-warning .title {
		color: var(--hydra-warning);
	}

	.status-label {
		color: var(--hydra-muted);
		font-size: 0.78rem;
		flex-shrink: 0;
	}

	li.is-current .status-label {
		color: var(--hydra-muted);
		font-weight: 700;
	}

	@media (max-width: 860px) {
		.intro-row {
			align-items: flex-start;
		}

		.legend-compact {
			display: flex;
		}

		.composition {
			display: block;
		}

		.legend-column {
			display: none;
		}

		.phase-header-left {
			flex: 1 1 100%;
			flex-wrap: wrap;
		}

		.phase header {
			flex-wrap: wrap;
			align-items: flex-start;
		}

		.phase-status {
			margin-top: 0.35rem;
		}

		.activity-main-row {
			flex-wrap: wrap;
		}

		.title {
			flex-basis: 100%;
		}

		.status-label {
			margin-left: 1.85rem;
		}
	}
</style>
