<script lang="ts">
	import type { ActivityStatus } from '$lib/domain';
	import type { PhaseStatus } from '$lib/orientation-engine';

	let { data } = $props();

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
</style>
