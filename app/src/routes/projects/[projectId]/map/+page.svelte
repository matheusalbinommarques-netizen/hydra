<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { ActivityStatus } from '$lib/domain';
	import type { PhaseStatus } from '$lib/orientation-engine';
	import { ROUTE_DIAGNOSTIC_QUESTIONS } from '$lib/route-diagnostic-questions';

	let { data, form } = $props();
	let projectId = $derived(page.params.projectId);

	const activityStatusLabel: Record<ActivityStatus, string> = {
		não_iniciada: 'Não iniciada',
		em_andamento: 'Em andamento',
		concluída: 'Concluída',
		pulada: 'Pulada'
	};

	const activityStatusIcon: Record<ActivityStatus, string> = {
		não_iniciada: '○',
		em_andamento: '◐',
		concluída: '●',
		pulada: '↷'
	};

	const phaseStatusLabel: Record<PhaseStatus, string> = {
		não_iniciada: 'Não iniciada',
		em_andamento: 'Em andamento',
		concluída_com_pendências: 'Concluída com pendências',
		concluída: 'Concluída'
	};
</script>

<svelte:head>
	<title>Mapa da jornada</title>
</svelte:head>

<h1>Mapa da jornada</h1>
<p class="subtitle">Onde você está, o que já foi feito e o que vem a seguir.</p>

<section class="route-diagnostic" aria-labelledby="route-diagnostic-heading">
	<h2 id="route-diagnostic-heading">Diagnóstico da rota</h2>
	<p class="route-diagnostic-note">
		Responda às cinco perguntas abaixo para calcular uma recomendação de ponto de partida. As respostas não são
		salvas — só a fase que você aplicar ao final.
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
			<p class="recommendation-phase">Fase recomendada: <strong>{form.diagnostic.recommendation.phaseLabel}</strong></p>
			<p class="recommendation-justification">{form.diagnostic.recommendation.justification}</p>
			<form method="POST" action="?/setRouteStart" use:enhance>
				<input type="hidden" name="phaseId" value={form.diagnostic.recommendation.phaseId} />
				<button type="submit">Aplicar recomendação</button>
			</form>
		</div>
	{/if}
</section>

<section class="route-start" aria-labelledby="route-start-heading">
	<h2 id="route-start-heading">Onde este projeto realmente começa?</h2>
	<p class="route-start-note">
		O Mapa abaixo continua mostrando o percurso completo — esta escolha só muda a partir de onde a próxima ação é
		recomendada.
	</p>
	<form method="POST" action="?/setRouteStart" use:enhance>
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
</section>

<div class="phases">
	{#each data.phases as phase (phase.id)}
		<section class="phase" class:current={phase.isCurrent}>
			<header>
				<h2>{phase.label}</h2>
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
						<li class:current={activity.isCurrent}>
							<span class="status-icon" aria-hidden="true">{activityStatusIcon[activity.status]}</span>
							<span class="title">{activity.title}</span>
							<span class="status-label">{activityStatusLabel[activity.status]}</span>
							{#if activity.isCurrent}
								<span class="current-badge">Próxima atividade recomendada</span>
								<a class="continue-link" href="/projects/{projectId}/now">Continuar em Agora</a>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

<style>
	.subtitle {
		color: var(--hydra-muted);
		margin-bottom: 1.5rem;
	}

	.route-diagnostic,
	.route-start {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.route-diagnostic h2 {
		margin: 0;
		font-size: 1rem;
	}

	.route-diagnostic-note {
		color: var(--hydra-muted);
		font-size: 0.85rem;
		margin: 0.4rem 0 0.85rem;
	}

	.diagnostic-questions {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.diagnostic-questions .question {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
	}

	.answer-choices {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
	}

	.recommendation {
		margin-top: 1rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--hydra-border);
	}

	.recommendation-phase {
		margin: 0 0 0.35rem;
	}

	.recommendation-justification {
		color: var(--hydra-muted);
		font-size: 0.85rem;
		margin: 0 0 0.75rem;
	}

	.route-start h2 {
		margin: 0;
		font-size: 1rem;
	}

	.route-start-note {
		color: var(--hydra-muted);
		font-size: 0.85rem;
		margin: 0.4rem 0 0.85rem;
	}

	.route-start form {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}

	.phases {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.phase {
		border: 1px solid var(--hydra-border);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
	}

	.phase.current {
		border-color: var(--hydra-accent);
	}

	.phase header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.phase h2 {
		margin: 0;
		font-size: 1rem;
	}

	.phase-status {
		font-size: 0.8rem;
		color: var(--hydra-muted);
	}

	.empty,
	.partial-note {
		color: var(--hydra-muted);
		font-size: 0.9rem;
		margin: 0.75rem 0 0;
	}

	ul {
		list-style: none;
		margin: 0.75rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.9rem;
	}

	li.current {
		font-weight: 600;
	}

	.status-icon {
		font-size: 1rem;
		width: 1.2rem;
		text-align: center;
	}

	.title {
		flex: 1;
	}

	.status-label {
		color: var(--hydra-muted);
		font-size: 0.8rem;
	}

	.current-badge {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--hydra-accent);
	}

	.continue-link {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--hydra-muted);
		text-decoration: underline;
	}

	.continue-link:hover {
		color: var(--hydra-text);
	}
</style>
