<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Resultados e encerramento — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<h1>Resultados e encerramento</h1>
<p class="subtitle">
	O que foi alcançado, o que precisa continuar e o que foi aprendido nesta etapa de validação e
	encerramento.
</p>

{#if data.continuity.kind !== 'completed'}
	<section class="card continuity" aria-label="Continuidade">
		<div>
			<p class="eyebrow">Continuidade</p>
			<p class="continuity-message">{data.continuity.message}</p>
		</div>
		<a class="continuity-cta" href={data.continuity.href}>{data.continuity.ctaLabel} →</a>
	</section>
{:else}
	<section class="card continuity-done" aria-label="Continuidade">
		<p class="continuity-done-message">{data.continuity.message}</p>
	</section>
{/if}

<div class="layout">
	<nav class="index" aria-label="Índice de seções">
		<p class="eyebrow">Índice</p>
		<div class="index-list">
			{#each data.sections as section (section.id)}
				<a class="index-item" href="#secao-{section.id}">{section.title}</a>
			{/each}
		</div>
	</nav>

	<div class="content">
		{#each data.sections as section (section.id)}
			<section class="card section-card" id="secao-{section.id}" aria-labelledby="secao-{section.id}-heading">
				<h2 id="secao-{section.id}-heading">{section.title}</h2>
				{#each section.activities as activity, activityIndex (activity.id)}
					{#if activityIndex > 0}
						<div class="activity-divider" aria-hidden="true"></div>
					{/if}
					<div class="activity">
						<div class="activity-heading">
							<h3>{activity.title}</h3>
							<span class="activity-status">{activity.statusLabel}</span>
						</div>
						{#if activity.fields}
							{#each activity.fields as field (field.id)}
								<div class="field">
									<p class="field-label">{field.label}</p>
									{#if field.isEmpty}
										<p class="field-value field-empty">Ainda não registrado</p>
									{:else}
										<p class="field-value">{field.value}</p>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				{/each}
			</section>
		{/each}

		<p class="records-link">
			<a href={data.recordsHref}>Ver registros completos em Registros →</a>
		</p>
	</div>
</div>

<style>
	.subtitle {
		color: var(--hydra-muted);
		max-width: 44rem;
		line-height: 1.55;
		margin: 0 0 var(--space-5);
	}

	.card {
		border: 1px solid rgba(101, 104, 108, 0.25);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		padding: var(--space-5);
		margin-bottom: var(--space-4);
	}

	.eyebrow {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.continuity {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
	}

	.continuity-message {
		margin: 0;
		font-weight: 700;
		font-size: var(--font-size-body);
	}

	.continuity-cta {
		font-size: var(--font-size-meta);
		font-weight: 700;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--hydra-radius);
		background: var(--hydra-accent);
		color: var(--hydra-surface);
		text-decoration: none;
		white-space: nowrap;
	}

	.continuity-cta:hover {
		text-decoration: underline;
	}

	.continuity-done-message {
		margin: 0;
		font-weight: 700;
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	.layout {
		display: grid;
		grid-template-columns: 240px 1fr;
		gap: var(--space-6);
		align-items: start;
	}

	.index {
		position: sticky;
		top: var(--space-5);
	}

	.index-list {
		display: flex;
		flex-direction: column;
	}

	.index-item {
		display: block;
		padding: var(--space-3) 0;
		border-bottom: 1px solid rgba(101, 104, 108, 0.2);
		text-decoration: none;
		color: var(--hydra-text);
		font-size: var(--font-size-meta);
		font-weight: 600;
	}

	.index-item:hover {
		color: var(--hydra-editorial-accent);
	}

	.index-item:last-child {
		border-bottom: none;
	}

	.content {
		min-width: 0;
	}

	.section-card h2 {
		margin: 0 0 var(--space-4);
		font-size: var(--font-size-subtitle);
	}

	.activity-divider {
		border-top: 1px solid rgba(101, 104, 108, 0.15);
		margin: var(--space-4) 0;
	}

	.activity-heading {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin-bottom: var(--space-2);
	}

	.activity-heading h3 {
		margin: 0;
		font-size: var(--font-size-caption);
		font-weight: 700;
	}

	.activity-status {
		font-size: var(--font-size-caption);
		font-weight: 700;
		color: var(--hydra-muted);
	}

	.field {
		margin-top: var(--space-3);
	}

	.field-label {
		margin: 0;
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	.field-value {
		margin: var(--space-1) 0 0;
		overflow-wrap: break-word;
		white-space: pre-wrap;
		line-height: 1.55;
	}

	.field-empty {
		font-style: italic;
		color: var(--hydra-muted);
	}

	.records-link {
		margin: var(--space-2) 0 0;
		font-size: var(--font-size-caption);
		font-weight: 700;
	}

	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.index {
			position: static;
		}

		.index-item {
			padding: var(--space-3) var(--space-4);
			min-height: 44px;
		}

		.continuity {
			flex-direction: column;
			align-items: stretch;
			text-align: left;
		}

		.continuity-cta {
			text-align: center;
			min-height: 44px;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
