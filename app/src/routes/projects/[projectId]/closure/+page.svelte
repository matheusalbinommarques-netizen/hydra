<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	// dd/mm/aaaa a partir do ISO (data UTC) — sem depender de fuso/locale do
	// ambiente, para SSR e hidratação coincidirem.
	function formatDate(iso: string): string {
		const [year, month, day] = iso.slice(0, 10).split('-');
		return `${day}/${month}/${year}`;
	}
</script>

<svelte:head>
	<title>Resultados e encerramento — {data.view.projectName ?? 'Hydra'}</title>
</svelte:head>

<h1>Resultados e encerramento</h1>
<p class="subtitle">
	O que foi alcançado, o que precisa continuar e o que foi aprendido nesta etapa de validação e
	encerramento.
</p>

<section class="card closure-card" aria-label="Encerramento do projeto" data-testid="closure-card">
	{#if data.closure.closedAt}
		<p class="eyebrow">Encerramento</p>
		<h2 class="closure-title" data-testid="closure-closed">Projeto encerrado</h2>
		<p class="closure-meta">Encerrado em {formatDate(data.closure.closedAt)}. Encerrar não significa que os resultados foram alcançados — a avaliação de cada resultado desejado está abaixo e pode ser revista.</p>
		{#if data.closure.note}
			<div class="field">
				<p class="field-label">Nota de encerramento</p>
				<p class="field-value" data-testid="closure-note">{data.closure.note}</p>
			</div>
		{/if}
	{:else}
		<p class="eyebrow">Encerramento</p>
		<h2 class="closure-title">Encerrar projeto</h2>
		{#if data.closure.ready}
			<p class="closure-meta">
				{data.outcomes.length === 0
					? 'Nenhum resultado desejado foi registrado; o projeto pode ser encerrado.'
					: 'Todos os resultados desejados têm avaliação. O projeto pode ser encerrado, seja qual for o estado de cada um.'}
			</p>
			<form method="POST" action="?/closeProject" use:enhance class="close-form">
				<label>
					<span class="field-label">Nota de encerramento (opcional)</span>
					<textarea name="note" rows="3"></textarea>
				</label>
				<label class="close-confirm">
					<input type="checkbox" name="confirm" required />
					<span>Confirmo o encerramento formal deste projeto.</span>
				</label>
				{#if form?.closeMessage}
					<p role="alert" class="assess-error">{form.closeMessage}</p>
				{/if}
				<button type="submit" class="assess-submit" data-testid="close-project">Encerrar projeto</button>
			</form>
		{:else}
			<p class="closure-meta" data-testid="closure-blocked">
				Ainda não é possível encerrar: {data.unassessedCount === 1
					? '1 resultado desejado está sem avaliação'
					: `${data.unassessedCount} resultados desejados estão sem avaliação`}. Avalie cada um abaixo — qualquer estado serve, inclusive "Ainda não verificável".
			</p>
		{/if}
	{/if}
</section>

{#if data.closure.closedAt}
	<!-- projeto encerrado: as atividades legadas de encerramento não orientam mais -->
{:else if data.continuity.kind !== 'completed'}
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
			<a class="index-item" href="#secao-resultados-desejados">Resultados desejados</a>
			{#each data.sections as section (section.id)}
				<a class="index-item" href="#secao-{section.id}">{section.title}</a>
			{/each}
		</div>
	</nav>

	<div class="content">
		<section class="card section-card" id="secao-resultados-desejados" aria-labelledby="secao-resultados-desejados-heading">
			<h2 id="secao-resultados-desejados-heading">Resultados desejados</h2>
			<p class="outcomes-intro">
				Avalie cada resultado desejado da descoberta. Esta é a avaliação registrada de cada resultado;
				o texto das atividades abaixo é apenas o registro livre da etapa.
			</p>
			{#if data.outcomes.length === 0}
				<p class="field-empty">Nenhum resultado desejado registrado na descoberta.</p>
			{:else}
				{#each data.outcomes as outcome, outcomeIndex (outcome.id)}
					{#if outcomeIndex > 0}
						<div class="activity-divider" aria-hidden="true"></div>
					{/if}
					<article class="outcome" data-testid="closure-outcome" aria-label={outcome.change}>
						<p class="outcome-change">{outcome.change}</p>
						{#if outcome.target}
							<p class="outcome-target">Alvo: {outcome.target}</p>
						{/if}
						<p class="outcome-state">
							<span class="state-badge state-{outcome.stateKey}" data-state={outcome.stateKey}
								>{outcome.stateLabel}</span
							>
							{#if outcome.stateKey === 'unassessed'}
								<span class="state-hint">Ainda não avaliado</span>
							{:else if outcome.assessedAt}
								<span class="state-hint">Avaliado em {formatDate(outcome.assessedAt)}</span>
							{/if}
						</p>
						{#if outcome.rationale}
							<p class="outcome-rationale">{outcome.rationale}</p>
						{/if}
						<form method="POST" action="?/assessDesiredOutcome" use:enhance class="assess-form">
							<input type="hidden" name="outcomeId" value={outcome.id} />
							<label>
								<span class="field-label">Estado</span>
								<select name="state" required>
									{#if outcome.stateKey === 'unassessed'}
										<option value="" selected disabled>Escolha um estado</option>
									{/if}
									{#each data.outcomeStateOptions as option (option.value)}
										<option value={option.value} selected={outcome.stateKey === option.value}
											>{option.label}</option
										>
									{/each}
								</select>
							</label>
							<label>
								<span class="field-label">Racional</span>
								<textarea name="rationale" rows="3" required>{outcome.rationale ?? ''}</textarea>
							</label>
							{#if form?.message && form.outcomeId === outcome.id}
								<p role="alert" class="assess-error">{form.message}</p>
							{/if}
							<button type="submit" class="assess-submit">
								{outcome.stateKey === 'unassessed' ? 'Registrar avaliação' : 'Atualizar avaliação'}
							</button>
						</form>
					</article>
				{/each}
			{/if}
		</section>

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

		{#if data.legacyClosureSummary}
			<section class="card section-card" aria-label="Registro legado do resumo de encerramento">
				<h2>Registro legado</h2>
				<div class="field">
					<p class="field-label">Resumo do encerramento (atividade anterior)</p>
					<p class="field-value" data-testid="closure-legacy-summary">{data.legacyClosureSummary}</p>
				</div>
			</section>
		{/if}

		<p class="records-link">
			<a href={data.recordsHref}>Ver registros completos em Registros →</a>
		</p>
	</div>
</div>

<style>
	.closure-title {
		margin: 0 0 var(--space-2);
	}

	.closure-meta {
		color: var(--hydra-muted);
		line-height: 1.55;
		margin: 0 0 var(--space-4);
	}

	.close-form {
		display: grid;
		gap: var(--space-3);
		max-width: 40rem;
	}

	.close-form textarea {
		width: 100%;
		font: inherit;
		box-sizing: border-box;
	}

	.close-confirm {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

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

	.outcomes-intro {
		margin: 0 0 var(--space-4);
		color: var(--hydra-muted);
		line-height: 1.55;
	}

	.outcome-change {
		margin: 0;
		font-weight: 700;
		overflow-wrap: break-word;
	}

	.outcome-target {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	.outcome-state {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin: var(--space-3) 0 0;
	}

	/* Tratamento neutro (sem verde/vermelho, sem linguagem celebratória).
	   `Sem avaliação` (tracejado, itálico) e `Ainda não verificável` (sólido,
	   com preenchimento) precisam ser inequivocamente distintos. */
	.state-badge {
		display: inline-block;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--hydra-radius-pill);
		border: 1px solid var(--hydra-border);
		font-size: var(--font-size-caption);
		font-weight: 700;
	}

	.state-unassessed {
		border-style: dashed;
		font-style: italic;
		font-weight: 600;
		color: var(--hydra-muted);
		background: transparent;
	}

	.state-ainda_nao_verificavel {
		background: var(--hydra-surface);
		color: var(--hydra-text);
	}

	.state-hint {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.outcome-rationale {
		margin: var(--space-3) 0 0;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		line-height: 1.55;
	}

	.assess-form {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-4);
		max-width: 36rem;
	}

	.assess-form label {
		display: grid;
		gap: var(--space-1);
	}

	.assess-form select,
	.assess-form textarea {
		font: inherit;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		background: var(--hydra-surface-raised);
		color: var(--hydra-text);
		width: 100%;
		box-sizing: border-box;
	}

	.assess-submit {
		justify-self: start;
		font: inherit;
		font-weight: 700;
		padding: var(--space-3) var(--space-5);
		border-radius: var(--hydra-radius);
		border: 1px solid var(--hydra-accent);
		background: var(--hydra-surface-raised);
		color: var(--hydra-text);
		cursor: pointer;
		min-height: 44px;
	}

	.assess-error {
		margin: 0;
		color: var(--hydra-warning);
		font-size: var(--font-size-meta);
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
