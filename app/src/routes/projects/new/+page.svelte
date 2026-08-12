<script lang="ts">
	import { enhance } from '$app/forms';
	import { ORIGIN_OPTIONS } from '$lib/catalog/discovery';

	let { form } = $props();

	const ORIGIN_DESCRIPTIONS: Record<string, string> = {
		'Existe um problema': 'Algo não está funcionando como deveria.',
		'Existe uma oportunidade': 'Há algo que podemos aproveitar ou fazer melhor.',
		'Quero melhorar algo': 'Já existe, mas poderia funcionar muito melhor.',
		'Quero criar algo novo': 'Existe uma ideia que quero transformar em algo real.',
		'Recebi uma solicitação': 'Alguém pediu ou precisa que isso aconteça.',
		'Existe uma obrigação': 'Uma regra, prazo, contrato ou necessidade tornou isso necessário.',
		'Ainda não sei direito': 'Tenho uma situação em mãos, mas ainda preciso entendê-la.'
	};

	// svelte-ignore state_referenced_locally -- seed intencional a partir do
	// último submit com erro (nome preservado para nova tentativa).
	let projectName = $state(form?.name ?? '');
	let originKey = $state<string | null>(null);
	let originPulse = $state(false);
	let pulseTimer: ReturnType<typeof setTimeout> | undefined;

	function selectOrigin(label: string) {
		originKey = label;
		originPulse = true;
		clearTimeout(pulseTimer);
		pulseTimer = setTimeout(() => (originPulse = false), 1400);
	}

	let nameFilled = $derived(projectName.trim().length > 0);
	let canSubmit = $derived(nameFilled && !!originKey);
</script>

<svelte:head>
	<title>Nova iniciativa — Hydra</title>
</svelte:head>

<div class="np-page hydra-dark-tokens">
	<header class="np-header">
		<a class="np-wordmark" href="/">
			<img class="np-wordmark-icon" src="/brand/hydra-app-icon-512.png" width="24" height="24" alt="" />
			<span class="np-wordmark-text">HYDRA</span>
		</a>
		<nav class="np-breadcrumb" aria-label="Localização">
			<a href="/projects">Projetos</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">Nova iniciativa</span>
		</nav>
		<a class="np-close" href="/projects" aria-label="Cancelar e voltar para Projetos">×</a>
	</header>

	<main class="np-main">
		<form method="POST" action="?/confirm" use:enhance class="np-layout">
			<div class="np-content">
				<p class="np-eyebrow">Novo projeto</p>
				<h1 class="np-title">Vamos começar.</h1>
				<p class="np-subtitle">Você só precisa nos dizer de onde este projeto está partindo.</p>

				<div class="np-field">
					<label class="np-field-label" for="np-name">Nome do projeto</label>
					<input
						id="np-name"
						name="name"
						type="text"
						class="np-name-input"
						bind:value={projectName}
						placeholder="Ex.: Renovação do sistema de atendimento"
					/>
				</div>

				<div class="np-origins-block">
					<h2 class="np-origins-title">O que trouxe este projeto até aqui?</h2>
					<p class="np-origins-help">Escolha a opção que mais se aproxima. Você poderá refinar isso depois.</p>

					<div class="np-origins-grid">
						{#each ORIGIN_OPTIONS as label (label)}
							<button
								type="button"
								class="np-origin-card"
								class:selected={originKey === label}
								onclick={() => selectOrigin(label)}
							>
								<span class="np-origin-label">{label}</span>
								<span class="np-origin-desc">{ORIGIN_DESCRIPTIONS[label]}</span>
							</button>
						{/each}
					</div>
					<input type="hidden" name="origin" value={originKey ?? ''} />
				</div>

				<div class="np-submit-row">
					<button type="submit" class="np-submit-btn" disabled={!canSubmit}>
						Criar projeto e começar <span aria-hidden="true">→</span>
					</button>
					<p class="np-submit-note">Isso leva você direto para a primeira atividade da Descoberta.</p>
				</div>

				{#if form?.message}
					<p class="np-error" role="alert">{form.message}</p>
				{/if}
			</div>

			<aside class="np-doc-panel">
				<div class="np-doc-header">
					<span class="np-doc-eyebrow">Documento do projeto</span>
					<span class="np-doc-phase">Descoberta</span>
				</div>

				<div class="np-doc-item">
					<span class="np-doc-item-label">Nome do projeto</span>
					<span class="np-doc-item-value" class:empty={!nameFilled}>
						{nameFilled ? projectName : 'Ainda não preenchido'}
					</span>
				</div>

				<div class="np-doc-item" class:pulse={originPulse}>
					<span class="np-doc-item-label">Origem do projeto</span>
					<span class="np-doc-item-value" class:empty={!originKey}>
						{originKey ?? 'Ainda não preenchido'}
					</span>
				</div>

				<div class="np-doc-next" class:dim={!originKey}>
					<span class="np-doc-next-icon" aria-hidden="true">→</span>
					<div>
						<p class="np-doc-next-label">Primeira atividade</p>
						<p class="np-doc-next-value">Entender a situação</p>
					</div>
				</div>
			</aside>
		</form>
	</main>
</div>

<style>
	/* Tokens locais escopados a esta rota — direção visual aprovada no Claude
	   Design ("Redesenho da tela /new"): tema escuro, acento teal, mesma
	   linguagem já usada na Home (D033). Outras telas ainda não convergidas
	   continuam na identidade papel/tinta/grafite, sem alteração. Valores
	   comprovadamente iguais à Home e a Entender a situação passam a ler de
	   `--hydra-dark-*` (`.hydra-dark-tokens`, app.css, ETAPA 1); os que são
	   específicos desta tela (superfície de item, estados de borda/texto
	   desabilitado) continuam locais. */
	.np-page {
		--np-bg: var(--hydra-dark-bg);
		--np-surface: var(--hydra-dark-surface);
		--np-panel: var(--hydra-dark-surface-raised);
		--np-item-bg: #0e1c2b;
		--np-border: var(--hydra-dark-border);
		--np-border-strong: rgba(255, 255, 255, 0.14);
		--np-text: var(--hydra-dark-text-soft);
		--np-text-strong: var(--hydra-dark-text);
		--np-muted: var(--hydra-dark-muted);
		--np-faint: #5f7c90;
		--np-disabled: #4d6577;
		--np-accent: var(--hydra-dark-accent);
		--np-accent-light: var(--hydra-dark-accent-light);
		--np-accent-tint: var(--hydra-dark-accent-tint);
		--np-accent-tint-strong: var(--hydra-dark-accent-tint-strong);
		--np-accent-border: var(--hydra-dark-accent-border);
		--np-accent-border-strong: var(--hydra-dark-accent-border-strong);
		--np-error: var(--hydra-dark-danger);

		min-height: 100vh;
		background: var(--np-bg);
		color: var(--np-text);
		font-family: var(--hydra-dark-font);
	}

	.np-header {
		height: 4rem;
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0 2.5rem;
		border-bottom: 1px solid var(--np-border);
	}

	.np-wordmark {
		display: flex;
		align-items: center;
		gap: 0.5625rem;
		color: inherit;
		text-decoration: none;
		flex-shrink: 0;
	}

	.np-wordmark-icon {
		display: block;
	}

	.np-wordmark-text {
		font-size: 0.9375rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		color: var(--np-text-strong);
	}

	.np-breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--np-faint);
		flex: 1;
	}

	.np-breadcrumb a {
		color: var(--np-faint);
		text-decoration: none;
	}

	.np-breadcrumb a:hover {
		color: var(--np-muted);
	}

	.np-breadcrumb [aria-current='page'] {
		color: var(--np-text);
		font-weight: 600;
	}

	.np-close {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		border: 1px solid var(--np-border);
		color: var(--np-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.125rem;
		line-height: 1;
		text-decoration: none;
		flex-shrink: 0;
	}

	.np-close:hover {
		color: var(--np-text);
		border-color: var(--np-border-strong);
	}

	.np-main {
		max-width: 68rem;
		margin: 0 auto;
		padding: 3.25rem 1.5rem 4rem;
	}

	.np-layout {
		display: flex;
		gap: 0;
		align-items: flex-start;
		background: var(--np-surface);
		border: 1px solid var(--np-border);
		border-radius: 1rem;
		overflow: hidden;
	}

	.np-content {
		flex: 1.5;
		min-width: 0;
		padding: 3rem 3rem 2.5rem;
	}

	.np-eyebrow {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--np-accent);
	}

	.np-title {
		font-family: 'Source Serif 4', Georgia, serif;
		font-size: 2rem;
		font-weight: 600;
		line-height: 1.15;
		margin: 0 0 0.75rem;
		color: var(--np-text-strong);
	}

	.np-subtitle {
		font-size: 0.9375rem;
		color: var(--np-muted);
		margin: 0 0 2rem;
		line-height: 1.5;
	}

	.np-field {
		margin-bottom: 2.25rem;
	}

	.np-field-label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--np-muted);
		margin-bottom: 0.625rem;
	}

	.np-name-input {
		width: 100%;
		box-sizing: border-box;
		background: var(--np-item-bg);
		border: 1px solid var(--np-border-strong);
		border-radius: var(--hydra-dark-radius);
		padding: 1rem 1.125rem;
		color: var(--np-text-strong);
		font-size: 1.125rem;
		font-weight: 600;
		font-family: inherit;
		outline: none;
	}

	.np-name-input:focus-visible {
		outline: 2px solid var(--np-accent);
		outline-offset: 1px;
	}

	.np-origins-block {
		border-top: 1px solid var(--np-border);
		padding-top: 2rem;
	}

	.np-origins-title {
		font-size: 1.1875rem;
		font-weight: 700;
		color: var(--np-text-strong);
		margin: 0 0 0.375rem;
	}

	.np-origins-help {
		font-size: 0.84375rem;
		color: var(--np-faint);
		margin: 0 0 1.25rem;
	}

	.np-origins-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.625rem;
	}

	.np-origin-card {
		text-align: left;
		border-radius: 0.75rem;
		padding: 1rem;
		cursor: pointer;
		font-family: inherit;
		transition: all 0.15s;
		background: var(--np-item-bg);
		border: 1px solid var(--np-border-strong);
		color: var(--np-text);
	}

	.np-origin-card.selected {
		background: var(--np-accent-tint-strong);
		border-color: var(--np-accent-border-strong);
		color: #eafffb;
	}

	.np-origin-label {
		display: block;
		font-size: 0.90625rem;
		font-weight: 700;
		margin-bottom: 0.375rem;
	}

	.np-origin-desc {
		display: block;
		font-size: 0.75rem;
		color: var(--np-muted);
		line-height: 1.4;
	}

	.np-origin-card.selected .np-origin-desc {
		color: #bdf3ea;
	}

	.np-submit-row {
		margin-top: 2rem;
	}

	.np-submit-btn {
		background: linear-gradient(135deg, #22d3c5, #0891b2);
		color: #04211f;
		border: none;
		border-radius: var(--hydra-dark-radius);
		font-weight: 700;
		font-size: 0.875rem;
		font-family: inherit;
		padding: 0.75rem 1.25rem;
		cursor: pointer;
	}

	.np-submit-btn:disabled {
		background: rgba(255, 255, 255, 0.06);
		color: var(--np-disabled);
		cursor: default;
	}

	.np-submit-note {
		font-size: 0.75rem;
		color: var(--np-faint);
		margin: 0.875rem 0 0;
	}

	.np-error {
		margin: 1rem 0 0;
		font-size: 0.8125rem;
		color: var(--np-error);
	}

	.np-doc-panel {
		width: 25rem;
		flex-shrink: 0;
		border-left: 1px solid var(--np-border);
		background: var(--np-panel);
		padding: 2rem 1.75rem;
		align-self: stretch;
	}

	.np-doc-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.25rem;
	}

	.np-doc-eyebrow {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--np-faint);
	}

	.np-doc-phase {
		font-size: 0.6875rem;
		color: var(--np-accent);
		background: var(--np-accent-tint);
		border: 1px solid var(--np-accent-border);
		border-radius: 999px;
		padding: 0.1875rem 0.625rem;
	}

	.np-doc-item {
		border-radius: 0.5rem;
		padding: 0.6875rem 0.75rem;
		margin-bottom: 0.5rem;
		background: var(--np-item-bg);
		border: 1px solid var(--np-border);
		transition: all 0.3s ease;
	}

	.np-doc-item.pulse {
		background: var(--np-accent-tint);
		border-color: var(--np-accent-border-strong);
	}

	.np-doc-item-label {
		display: block;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--np-faint);
		margin-bottom: 0.3125rem;
	}

	.np-doc-item-value {
		display: block;
		font-size: 0.84375rem;
		font-weight: 600;
		color: var(--np-text);
	}

	.np-doc-item-value.empty {
		font-style: italic;
		color: var(--np-disabled);
		font-weight: 500;
	}

	.np-doc-next {
		border: 1px solid var(--np-border);
		background: rgba(255, 255, 255, 0.02);
		border-radius: 0.875rem;
		padding: 1rem 1.125rem;
		margin-top: 1.375rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		transition: opacity 0.2s;
	}

	.np-doc-next.dim {
		opacity: 0.5;
	}

	.np-doc-next-icon {
		width: 1.875rem;
		height: 1.875rem;
		border-radius: 50%;
		background: var(--np-accent-tint-strong);
		border: 1px solid var(--np-accent-border-strong);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: var(--np-accent-light);
		font-size: 0.875rem;
	}

	.np-doc-next-label {
		margin: 0 0 0.125rem;
		font-size: 0.6875rem;
		color: var(--np-faint);
	}

	.np-doc-next-value {
		margin: 0;
		font-size: 0.84375rem;
		font-weight: 600;
		color: var(--np-text-strong);
	}

	@media (max-width: 860px) {
		.np-header {
			padding: 0 1.25rem;
		}

		.np-breadcrumb {
			display: none;
		}

		.np-main {
			padding: 1.5rem 1rem 3rem;
		}

		.np-layout {
			flex-direction: column;
		}

		.np-content {
			padding: 1.75rem 1.5rem;
		}

		.np-origins-grid {
			grid-template-columns: 1fr;
		}

		.np-doc-panel {
			width: 100%;
			border-left: none;
			border-top: 1px solid var(--np-border);
		}
	}
</style>
