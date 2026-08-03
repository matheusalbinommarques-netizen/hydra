<script lang="ts">
	import { enhance } from '$app/forms';
	import { computeRouteStartRecommendation } from '$lib/orientation-engine';
	import { ROUTE_DIAGNOSTIC_FALLBACK, ROUTE_DIAGNOSTIC_QUESTIONS } from '$lib/route-diagnostic-questions';

	let { data, form } = $props();

	const STEP_META = [
		{ n: 1, title: 'Ponto de partida', subtitle: 'O que já está estruturado?' },
		{ n: 2, title: 'Rota recomendada', subtitle: 'Onde começar faz mais sentido?' },
		{ n: 3, title: 'Nome provisório', subtitle: 'Como vamos chamar?' },
		{ n: 4, title: 'Revisão', subtitle: 'Confirmar e criar' }
	];

	const HEADER_SUBTITLE: Record<number, string> = {
		1: 'Vamos entender o que já está estruturado.',
		2: 'Aceite a recomendação ou escolha outra fase.',
		3: 'Como você quer chamar este projeto por enquanto?',
		4: 'Confira antes de criar.'
	};

	// Descrição curta por fase, derivada do mesmo conteúdo do diagnóstico
	// (structureLabel) — não duplica id nem rótulo de fase, que vêm de
	// data.phases (catálogo real, ver +page.server.ts).
	const PHASE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
		ROUTE_DIAGNOSTIC_QUESTIONS.map((q) => [q.phaseId, q.structureLabel.charAt(0).toUpperCase() + q.structureLabel.slice(1) + '.'])
	);
	PHASE_DESCRIPTIONS[ROUTE_DIAGNOSTIC_FALLBACK.phaseId] = 'Validar resultados e encerrar o projeto.';

	let step = $state(1);
	let answers = $state<Record<string, boolean | null>>(
		Object.fromEntries(ROUTE_DIAGNOSTIC_QUESTIONS.map((q) => [q.phaseId, null]))
	);
	let manualPhaseId = $state<string | null>(null);
	let projectName = $state('');
	let showValidation = $state(false);

	let allAnswered = $derived(ROUTE_DIAGNOSTIC_QUESTIONS.every((q) => typeof answers[q.phaseId] === 'boolean'));

	let recommendation = $derived(
		allAnswered
			? computeRouteStartRecommendation(
					ROUTE_DIAGNOSTIC_QUESTIONS.map((q) => ({
						phaseId: q.phaseId,
						phaseLabel: q.phaseLabel,
						structureLabel: q.structureLabel,
						answer: answers[q.phaseId] as boolean
					})),
					ROUTE_DIAGNOSTIC_FALLBACK
				)
			: null
	);

	let selectedPhaseId = $derived(manualPhaseId ?? recommendation?.phaseId ?? null);
	let isManualChoice = $derived(!!(manualPhaseId && recommendation && manualPhaseId !== recommendation.phaseId));
	let reviewName = $derived(projectName.trim() ? projectName.trim() : 'Projeto sem nome');
	let reviewPhaseLabel = $derived(data.phases.find((phase) => phase.id === selectedPhaseId)?.label ?? '');

	function setAnswer(phaseId: string, value: boolean) {
		answers = { ...answers, [phaseId]: value };
		showValidation = false;
	}

	function goStep(n: number) {
		if (n < step) step = n;
	}

	function next() {
		if (step === 1 && !allAnswered) {
			showValidation = true;
			return;
		}
		step = Math.min(4, step + 1);
		showValidation = false;
	}

	function back() {
		step = Math.max(1, step - 1);
	}
</script>

<svelte:head>
	<title>Nova iniciativa — Hydra</title>
</svelte:head>

<div class="wizard-page">
	<header class="wizard-header">
		<div class="identity">
			<a class="wordmark-link" href="/">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
					<path d="M6 2v9c0 3 2.5 5 6 5s6-2 6-5V2M12 16v6" />
				</svg>
				<span class="wordmark-text">Hydra</span>
			</a>
			<span class="identity-divider" aria-hidden="true"></span>
			<nav class="breadcrumb" aria-label="Localização">
				<a href="/projects">Projetos</a>
				<span class="breadcrumb-sep" aria-hidden="true">/</span>
				<span aria-current="page">Nova iniciativa</span>
			</nav>
		</div>
		<a class="close-link" href="/projects" aria-label="Cancelar e voltar para Projetos">×</a>
	</header>

	<main class="wizard-main">
		<div class="mobile-progress">
			<p class="mobile-step-label">PASSO {step} DE 4</p>
			<p class="mobile-step-title">{STEP_META[step - 1].title}</p>
			<div class="progress-track">
				<div class="progress-fill" style:width="{(step / 4) * 100}%"></div>
			</div>
		</div>

		<form method="POST" action="?/confirm" use:enhance class="wizard-form">
			<div class="wizard-card">
				<aside class="step-rail" aria-label="Etapas da criação">
					{#each STEP_META as s (s.n)}
						{@const isActive = s.n === step}
						{@const isDone = s.n < step}
						<button
							type="button"
							class="step-item"
							class:active={isActive}
							class:done={isDone}
							disabled={!isDone}
							onclick={() => goStep(s.n)}
						>
							<span class="step-circle">{isDone ? '✓' : s.n}</span>
							<span class="step-text">
								<span class="step-title">{s.title}</span>
								<span class="step-subtitle">{s.subtitle}</span>
							</span>
						</button>
					{/each}
				</aside>

				<div class="wizard-content">
					<div class="content-head">
						<h1>Nova iniciativa</h1>
						<p class="content-subtitle">{HEADER_SUBTITLE[step]}</p>
					</div>

					<div class="content-body">
						{#if step === 1}
							<p class="step-intro">
								Suas respostas serão usadas apenas para recomendar o melhor ponto de partida. Somente a fase
								escolhida será registrada no projeto.
							</p>
							{#if showValidation}
								<p class="validation-banner" role="alert">Responda todas as perguntas para continuar.</p>
							{/if}
							<ol class="question-list">
								{#each ROUTE_DIAGNOSTIC_QUESTIONS as q (q.phaseId)}
									{@const val = answers[q.phaseId]}
									{@const showError = showValidation && val === null}
									<li class="question-row" class:error={showError}>
										<div class="question-text">
											{q.question}
											{#if showError}<div class="question-error">Obrigatório</div>{/if}
										</div>
										<div class="answer-buttons" role="radiogroup" aria-label={q.question}>
											<button
												type="button"
												class="answer-btn"
												class:selected={val === true}
												aria-pressed={val === true}
												onclick={() => setAnswer(q.phaseId, true)}
											>
												Sim
											</button>
											<button
												type="button"
												class="answer-btn"
												class:selected={val === false}
												aria-pressed={val === false}
												onclick={() => setAnswer(q.phaseId, false)}
											>
												Não
											</button>
										</div>
									</li>
								{/each}
							</ol>
						{/if}

						{#if step === 2}
							<p class="step-intro">
								O Hydra procurou a primeira parte do trabalho que ainda não está estruturada. Aceite a
								recomendação ou escolha outra fase manualmente.
							</p>
							<ul class="phase-list">
								{#each data.phases as p (p.id)}
									{@const isRecommended = recommendation?.phaseId === p.id}
									{@const isSelected = p.id === selectedPhaseId}
									<li class="phase-row" class:selected={isSelected} class:recommended={isRecommended}>
										<button type="button" class="phase-row-btn" onclick={() => (manualPhaseId = p.id)}>
											<span class="phase-radio" aria-hidden="true"></span>
											<span class="phase-body">
												<span class="phase-heading">
													<span class="phase-label">{p.label}</span>
													{#if isRecommended}<span class="phase-tag">Recomendado</span>{/if}
												</span>
												<span class="phase-desc">{PHASE_DESCRIPTIONS[p.id] ?? ''}</span>
												{#if isRecommended && recommendation}
													<span class="phase-justification">{recommendation.justification}</span>
												{/if}
											</span>
										</button>
									</li>
								{/each}
							</ul>
						{/if}

						{#if step === 3}
							<div class="name-field">
								<div class="name-label-row">
									<span class="name-label">Nome provisório do projeto</span>
									<span class="optional-pill">opcional</span>
								</div>
								<input
									type="text"
									class="name-input"
									bind:value={projectName}
									placeholder="Ex.: Consolidação diária automatizada"
								/>
								<p class="name-help">O nome poderá ser alterado a qualquer momento depois da criação.</p>
							</div>
						{/if}

						{#if step === 4}
							<div class="review-box">
								<div class="review-row">
									<span class="review-key">Nome provisório</span>
									<span class="review-value">{reviewName}</span>
								</div>
								<div class="review-row">
									<span class="review-key">Fase inicial</span>
									<span class="review-value-group">
										<span class="review-value">{reviewPhaseLabel}</span>
										<span class="review-tag" class:manual={isManualChoice}>
											{isManualChoice ? 'Escolha manual' : 'Recomendada'}
										</span>
									</span>
								</div>
							</div>
							{#if form?.message}
								<div class="confirm-error" role="alert">
									<p>Não foi possível criar o projeto agora. Seus dados foram mantidos — tente novamente.</p>
									<p class="confirm-error-detail">{form.message}</p>
								</div>
							{:else}
								<p class="not-created-note">Nada será criado até a confirmação final.</p>
							{/if}
						{/if}
					</div>

					<div class="wizard-footer">
						{#if step === 1}
							<a class="back-link" href="/projects">Cancelar</a>
						{:else}
							<button type="button" class="back-btn" onclick={back}>← Voltar</button>
						{/if}

						{#if step < 4}
							<button type="button" class="next-btn" onclick={next}>Continuar →</button>
						{:else}
							<button type="submit" class="next-btn">Confirmar e criar →</button>
						{/if}
					</div>
				</div>
			</div>

			<input type="hidden" name="name" value={projectName} />
			<input type="hidden" name="phaseId" value={selectedPhaseId ?? ''} />
		</form>
	</main>
</div>

<style>
	/* Tokens locais extraídos do artefato aprovado (Claude Design —
	   "Nova Iniciativa - Wizard.dc.html"). Mesmo padrão de routes/+page.svelte
	   (Home) e routes/projects/+page.svelte (Biblioteca): escopados a esta
	   rota, sem tocar app.css nem outras telas ainda não convergidas. */
	.wizard-page {
		--wz-bg: #f7f3ec;
		--wz-surface: #ffffff;
		--wz-border: #e7e1d3;
		--wz-border-soft: #efeae0;
		--wz-input-border: #d8d0c0;
		--wz-text: #2a2520;
		--wz-muted: #6b655c;
		--wz-muted-light: #9a9285;
		--wz-accent: #bb4534;
		--wz-accent-hover: #a03a2b;
		--wz-error-text: #9c3a2c;
		--wz-error-bg: #fcf3ef;
		--wz-error-border: #e9c9be;
		--wz-success-text: #2a6b45;
		--wz-success-bg: #eff6f0;
		--wz-success-border: #c9e2cf;
		--wz-dark: #2a2520;
		--wz-dark-strong: #211d19;
		--wz-radius-lg: 1rem;
		--wz-radius: 0.5rem;

		min-height: 100vh;
		background: var(--wz-bg);
		color: var(--wz-text);
		font-family: 'Inter', 'Manrope', -apple-system, sans-serif;
	}

	.wizard-header {
		height: 4rem;
		background: var(--wz-surface);
		border-bottom: 1px solid var(--wz-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 2.5rem;
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.wordmark-link {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: inherit;
		text-decoration: none;
		flex-shrink: 0;
	}

	.wordmark-text {
		font-family: 'Source Serif 4', Georgia, serif;
		font-weight: 700;
		font-size: 1.1875rem;
	}

	.identity-divider {
		width: 1px;
		height: 1.125rem;
		background: var(--wz-border-soft);
		flex-shrink: 0;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		white-space: nowrap;
	}

	.breadcrumb a {
		color: var(--wz-muted-light);
		text-decoration: none;
	}

	.breadcrumb a:hover {
		color: var(--wz-muted);
		text-decoration: underline;
	}

	.breadcrumb-sep {
		color: #c9c1b2;
	}

	.breadcrumb [aria-current='page'] {
		color: var(--wz-text);
		font-weight: 600;
	}

	.close-link {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 1px solid var(--wz-border);
		background: #fbf8f2;
		color: var(--wz-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.125rem;
		line-height: 1;
		text-decoration: none;
		flex-shrink: 0;
	}

	.close-link:hover {
		color: var(--wz-text);
	}

	.wizard-main {
		max-width: 65rem;
		margin: 2.25rem auto 4rem;
		padding: 0 1.5rem;
	}

	.mobile-progress {
		display: none;
	}

	.wizard-card {
		display: flex;
		background: var(--wz-surface);
		border: 1px solid var(--wz-border);
		border-radius: var(--wz-radius-lg);
		box-shadow:
			0 1px 2px rgba(30, 20, 10, 0.04),
			0 8px 24px rgba(30, 20, 10, 0.05);
		overflow: hidden;
		min-height: 40rem;
	}

	.step-rail {
		width: 16.75rem;
		flex-shrink: 0;
		background: #fbf8f2;
		border-right: 1px solid var(--wz-border);
		padding: 2.25rem 1.75rem;
		display: flex;
		flex-direction: column;
		gap: 1.625rem;
	}

	.step-item {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		text-align: left;
		cursor: default;
	}

	.step-item.done {
		cursor: pointer;
	}

	.step-circle {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8125rem;
		font-weight: 700;
		border: 1px solid var(--wz-input-border);
		color: var(--wz-muted-light);
	}

	.step-item.active .step-circle {
		background: var(--wz-accent);
		border-color: var(--wz-accent);
		color: #ffffff;
	}

	.step-item.done .step-circle {
		background: var(--wz-dark);
		border-color: var(--wz-dark);
		color: #ffffff;
	}

	.step-title {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--wz-muted-light);
	}

	.step-item.active .step-title,
	.step-item.done .step-title {
		color: var(--wz-text);
	}

	.step-subtitle {
		display: block;
		font-size: 0.75rem;
		color: var(--wz-muted-light);
		margin-top: 0.125rem;
	}

	.wizard-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.content-head {
		padding: 2.5rem 2.75rem 1.25rem;
	}

	.content-head h1 {
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 1.625rem;
		font-weight: 600;
		margin: 0;
	}

	.content-subtitle {
		font-size: 0.875rem;
		color: var(--wz-muted);
		margin: 0.375rem 0 0;
	}

	.content-body {
		flex: 1;
		padding: 0 2.75rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.step-intro {
		font-size: 0.8125rem;
		color: var(--wz-muted);
		line-height: 1.55;
		max-width: 37.5rem;
		margin: 0;
	}

	.validation-banner {
		font-size: 0.8125rem;
		color: var(--wz-error-text);
		background: var(--wz-error-bg);
		border: 1px solid var(--wz-error-border);
		border-radius: var(--wz-radius);
		padding: 0.625rem 0.875rem;
		margin: 0;
	}

	.question-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--wz-border);
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.question-row {
		padding: 1.125rem 1.25rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem 1rem;
		border-bottom: 1px solid var(--wz-border-soft);
		border-left: 3px solid transparent;
	}

	.question-row:last-child {
		border-bottom: none;
	}

	.question-row.error {
		border-left-color: #c0392e;
	}

	.question-text {
		font-size: 0.875rem;
		color: var(--wz-text);
		flex: 1 1 13.75rem;
		line-height: 1.4;
	}

	.question-error {
		font-size: 0.75rem;
		color: var(--wz-error-text);
		margin-top: 0.25rem;
		font-weight: 600;
	}

	.answer-buttons {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.answer-btn {
		padding: 0.625rem 1.125rem;
		min-height: 2.75rem;
		border-radius: var(--wz-radius);
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid var(--wz-input-border);
		background: var(--wz-surface);
		color: var(--wz-muted);
	}

	.answer-btn.selected {
		background: var(--wz-dark);
		border-color: var(--wz-dark);
		color: #ffffff;
	}

	.phase-list {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--wz-border);
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.phase-row {
		border-bottom: 1px solid var(--wz-border-soft);
	}

	.phase-row:last-child {
		border-bottom: none;
	}

	.phase-row-btn {
		width: 100%;
		display: flex;
		gap: 0.875rem;
		align-items: flex-start;
		padding: 1rem 1.25rem;
		background: var(--wz-surface);
		border: none;
		border-left: 3px solid transparent;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.phase-row.selected .phase-row-btn {
		background: #fbf8f2;
	}

	.phase-row.recommended .phase-row-btn {
		border-left-color: var(--wz-accent);
	}

	.phase-radio {
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 50%;
		margin-top: 0.125rem;
		flex-shrink: 0;
		border: 2px solid var(--wz-input-border);
	}

	.phase-row.selected .phase-radio {
		border-color: var(--wz-dark);
		background: radial-gradient(var(--wz-dark) 0 0.3125rem, transparent 0.375rem);
	}

	.phase-body {
		flex: 1;
		min-width: 0;
	}

	.phase-heading {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.phase-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--wz-text);
	}

	.phase-tag {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: #ffffff;
		background: var(--wz-accent);
		padding: 0.1875rem 0.5rem;
		border-radius: 999px;
	}

	.phase-desc {
		display: block;
		font-size: 0.75rem;
		color: var(--wz-muted-light);
		margin-top: 0.1875rem;
	}

	.phase-justification {
		display: block;
		font-size: 0.75rem;
		color: var(--wz-muted);
		margin-top: 0.5rem;
		line-height: 1.5;
		max-width: 32.5rem;
	}

	.name-field {
		max-width: 32.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.name-label-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.name-label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--wz-text);
	}

	.optional-pill {
		font-size: 0.6875rem;
		color: var(--wz-muted-light);
		border: 1px solid var(--wz-border);
		border-radius: 999px;
		padding: 0.125rem 0.5rem;
	}

	.name-input {
		height: 3rem;
		border: 1px solid var(--wz-input-border);
		border-radius: 0.625rem;
		padding: 0 1rem;
		font-size: 0.9375rem;
		color: var(--wz-text);
		font-family: inherit;
		outline: none;
	}

	.name-input:focus-visible {
		outline: 2px solid var(--wz-accent);
		outline-offset: 1px;
	}

	.name-help {
		font-size: 0.75rem;
		color: var(--wz-muted-light);
		margin: 0.125rem 0 0;
	}

	.review-box {
		border: 1px solid var(--wz-border);
		border-radius: 0.75rem;
		overflow: hidden;
		max-width: 37.5rem;
	}

	.review-row {
		padding: 1rem 1.25rem;
		display: flex;
		justify-content: space-between;
		gap: 0.25rem;
		border-bottom: 1px solid var(--wz-border-soft);
	}

	.review-row:last-child {
		border-bottom: none;
	}

	.review-key {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--wz-muted-light);
	}

	.review-value {
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--wz-text);
	}

	.review-value-group {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.review-tag {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--wz-accent);
		background: var(--wz-error-bg);
		padding: 0.1875rem 0.5rem;
		border-radius: 999px;
	}

	.review-tag.manual {
		color: var(--wz-muted);
		background: var(--wz-border-soft);
	}

	.confirm-error {
		font-size: 0.8125rem;
		color: var(--wz-error-text);
		background: var(--wz-error-bg);
		border: 1px solid var(--wz-error-border);
		border-radius: 0.625rem;
		padding: 0.875rem 1rem;
		max-width: 37.5rem;
		margin: 0;
	}

	.confirm-error p {
		margin: 0;
	}

	.confirm-error-detail {
		margin-top: 0.375rem !important;
		font-weight: 600;
	}

	.not-created-note {
		font-size: 0.8125rem;
		color: var(--wz-muted);
		font-style: italic;
		margin: 0.25rem 0 0;
	}

	.wizard-footer {
		padding: 1.25rem 2.75rem;
		border-top: 1px solid var(--wz-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.625rem;
	}

	.back-link {
		background: none;
		border: none;
		color: var(--wz-accent);
		font-weight: 600;
		font-size: 0.875rem;
		text-decoration: none;
		padding: 0.75rem 0.25rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.back-btn {
		background: transparent;
		border: 1px solid var(--wz-input-border);
		color: var(--wz-text);
		font-weight: 600;
		font-size: 0.875rem;
		padding: 0.75rem 1.125rem;
		border-radius: var(--wz-radius);
		cursor: pointer;
	}

	.next-btn {
		background: var(--wz-dark-strong);
		color: #ffffff;
		border: none;
		font-weight: 600;
		font-size: 0.875rem;
		padding: 0.75rem 1.25rem;
		border-radius: var(--wz-radius);
		cursor: pointer;
	}

	.next-btn:hover {
		background: #000000;
	}

	@media (max-width: 860px) {
		.wizard-header {
			height: 3.5rem;
			padding: 0 1rem;
		}

		.breadcrumb {
			display: none;
		}

		.wordmark-text {
			font-size: 1rem;
		}

		.wizard-main {
			margin: 1.25rem auto 2.5rem;
			padding: 0 0.75rem;
		}

		.mobile-progress {
			display: block;
			background: var(--wz-surface);
			border: 1px solid var(--wz-border);
			border-radius: 0.75rem;
			padding: 0.875rem 1rem;
			margin-bottom: 1rem;
		}

		.mobile-step-label {
			font-size: 0.75rem;
			font-weight: 600;
			color: var(--wz-muted-light);
			letter-spacing: 0.03em;
			margin: 0;
		}

		.mobile-step-title {
			font-size: 0.9375rem;
			font-weight: 600;
			color: var(--wz-text);
			margin: 0.125rem 0 0;
		}

		.progress-track {
			height: 0.25rem;
			border-radius: 999px;
			background: var(--wz-border-soft);
			margin-top: 0.625rem;
			overflow: hidden;
		}

		.progress-fill {
			height: 100%;
			border-radius: 999px;
			background: var(--wz-accent);
		}

		.wizard-card {
			flex-direction: column;
			min-height: 0;
		}

		.step-rail {
			display: none;
		}

		.content-head {
			padding: 1.5rem 1.25rem 0.875rem;
		}

		.content-head h1 {
			font-size: 1.3125rem;
		}

		.content-body {
			padding: 0 1.25rem 1.25rem;
		}

		.question-row {
			flex-direction: column;
			align-items: stretch;
		}

		.answer-buttons {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}

		.review-row {
			flex-direction: column;
			gap: 0.25rem;
		}

		.wizard-footer {
			padding: 1rem 1.25rem;
			flex-direction: column-reverse;
			align-items: stretch;
		}

		.back-link,
		.back-btn,
		.next-btn {
			width: 100%;
			text-align: center;
		}
	}
</style>
