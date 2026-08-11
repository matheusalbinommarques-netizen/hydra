<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ProjectListItem } from '$lib/server/application/types';

	let { data, form } = $props();

	function ctaLabel(project: ProjectListItem): string {
		if (project.nextAction.kind === 'completed') return 'Ver projeto';
		return project.projectStatus === 'rascunho' ? 'Começar projeto' : 'Continuar projeto';
	}

	function nextActionText(project: ProjectListItem): string {
		return project.nextAction.kind === 'activity' ? project.nextAction.label : 'Jornada concluída';
	}

	// Texto de apoio da próxima ação — sempre ActivityDefinition.why (dado
	// real já existente no catálogo), nunca texto inventado para a tela.
	function nextActionWhy(project: ProjectListItem): string | null {
		return project.nextAction.kind === 'activity' ? project.nextAction.why : null;
	}

	function phaseProgressText(project: ProjectListItem): string | null {
		if (!project.currentPhase) return null;
		const { phaseLabel, completedActivities, totalActivities } = project.currentPhase;
		return `${phaseLabel} · ${completedActivities} de ${totalActivities} concluídas`;
	}

	// Só 'bloqueado'/'parado' têm texto — 'avancando' é silencioso (só a cor
	// do indicador já comunica), e undefined (nunca trabalhado) também não
	// tem texto, para não inventar um quarto sinal.
	function movementLabel(project: ProjectListItem): string | null {
		switch (project.movementSignal) {
			case 'bloqueado':
				return 'Bloqueado';
			case 'parado':
				return 'Parado';
			default:
				return null;
		}
	}

	function signalDotColor(project: ProjectListItem): string {
		switch (project.movementSignal) {
			case 'bloqueado':
				return 'var(--hp-signal-blocked)';
			case 'parado':
				return 'var(--hp-signal-stalled)';
			case 'avancando':
				return 'var(--hp-signal-advancing)';
			default:
				return 'var(--hp-signal-none)';
		}
	}

	// "Continue de onde parou": entre os projetos não concluídos, o de
	// movimentação real mais recente (lastMovementAt já vem do use case,
	// calculado a partir dos timestamps reais de ProjectState — nunca
	// persistido). createdAt NUNCA entra nesta escolha: um projeto com
	// movimentação real sempre vence um projeto só criado; entre projetos
	// sem nenhuma movimentação real, mantém o primeiro encontrado na ordem
	// já recebida.
	function pickFeaturedProject(projects: ProjectListItem[]): ProjectListItem | undefined {
		let featured: ProjectListItem | undefined;
		for (const project of projects) {
			if (project.projectStatus === 'concluído') continue;
			if (!featured) {
				featured = project;
				continue;
			}
			if (!project.lastMovementAt) continue;
			if (!featured.lastMovementAt || Date.parse(project.lastMovementAt) > Date.parse(featured.lastMovementAt)) {
				featured = project;
			}
		}
		return featured;
	}

	// Prioriza quem precisa de atenção na lista (bloqueado > parado >
	// avançando > nunca trabalhado) — mesma regra do artefato aprovado;
	// nenhum sinal novo é criado, só a ordem de exibição dos já calculados.
	const SIGNAL_SORT_RANK: Record<string, number> = { bloqueado: 0, parado: 1, avancando: 2 };
	function signalSortRank(project: ProjectListItem): number {
		return project.movementSignal ? (SIGNAL_SORT_RANK[project.movementSignal] ?? 3) : 3;
	}

	let featuredProject = $derived(pickFeaturedProject(data.projects));
	// Filtro do destaque ocorre antes do limite da lista.
	let otherProjects = $derived(
		data.projects
			.filter((project) => project.projectId !== featuredProject?.projectId)
			.slice()
			.sort((a, b) => signalSortRank(a) - signalSortRank(b))
			.slice(0, 5)
	);

	interface PhaseStep {
		id: string;
		label: string;
		done: boolean;
		current: boolean;
	}

	function buildPhaseSteps(project: ProjectListItem, phases: { id: string; label: string }[]): PhaseStep[] {
		if (!project.currentPhase) return [];
		const currentIndex = phases.findIndex((phase) => phase.id === project.currentPhase!.phaseId);
		if (currentIndex === -1) return [];
		return phases.map((phase, index) => ({
			id: phase.id,
			label: phase.label,
			done: index < currentIndex,
			current: index === currentIndex
		}));
	}

	let featuredSteps = $derived(featuredProject ? buildPhaseSteps(featuredProject, data.catalogPhases) : []);

	// Importar: um único botão real ("Importar"), sem disclosure visível —
	// aciona o input de arquivo escondido; selecionar um arquivo já
	// submete o formulário real (?/import), sem mudar o comportamento já
	// existente.
	let importInputEl: HTMLInputElement | undefined = $state();
	function triggerImport() {
		importInputEl?.click();
	}
	function submitImport(event: Event) {
		(event.currentTarget as HTMLInputElement).form?.requestSubmit();
	}
</script>

<svelte:head>
	<title>Hydra</title>
</svelte:head>

<div class="home-shell">
	<aside class="hp-sidebar">
		<div class="hp-sidebar-inner">
			<a class="hp-logo" href="/" aria-label="Hydra — Home">
				<img class="hp-logo-lockup" src="/brand/hydra-horizontal-lockup-compact.png" alt="" />
				<img class="hp-logo-icon" src="/brand/hydra-app-icon-512.png" alt="" />
			</a>
			<nav class="hp-nav" aria-label="Navegação global">
				<span class="hp-nav-item hp-nav-active" aria-current="page">
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z"
							stroke="var(--hp-accent)"
							stroke-width="1.7"
						/>
					</svg>
					<span class="hp-nav-label">Home</span>
				</span>
				<a class="hp-nav-item" href="/projects">
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
							stroke="var(--hp-muted)"
							stroke-width="1.7"
						/>
					</svg>
					<span class="hp-nav-label">Projetos</span>
				</a>
				<!-- Configurações globais não existem hoje (só configurações por
				     projeto, no shell interno) — item mantido na navegação para
				     preservar a estrutura aprovada, sem link nem capacidade
				     inventada. -->
				<span class="hp-nav-item hp-nav-inert" aria-disabled="true">
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<circle cx="12" cy="12" r="3" stroke="var(--hp-muted)" stroke-width="1.7" />
						<path
							d="M19 12a7 7 0 0 0-.2-1.6l2-1.5-1.5-2.6-2.3.8a7 7 0 0 0-2.7-1.6L14 3h-4l-.3 2.5a7 7 0 0 0-2.7 1.6l-2.3-.8-1.5 2.6 2 1.5A7 7 0 0 0 5 12c0 .5.1 1.1.2 1.6l-2 1.5 1.5 2.6 2.3-.8a7 7 0 0 0 2.7 1.6L10 21h4l.3-2.5a7 7 0 0 0 2.7-1.6l2.3.8 1.5-2.6-2-1.5c.1-.5.2-1.1.2-1.6Z"
							stroke="var(--hp-muted)"
							stroke-width="1.3"
						/>
					</svg>
					<span class="hp-nav-label">Configurações</span>
				</span>
			</nav>
		</div>
	</aside>

	<div class="hp-main">
		<!-- Busca, notificações e perfil: nenhuma capacidade real hoje (sem
		     busca, sem notificações, sem autenticação/multiusuário) —
		     mantidos como decoração estática, sem comportamento, por decisão
		     explícita registrada nesta rodada. -->
		<div class="hp-topbar">
			<div class="hp-search" aria-hidden="true">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none">
					<circle cx="11" cy="11" r="7" stroke="var(--hp-muted)" stroke-width="1.8" />
					<path d="M20 20l-3.5-3.5" stroke="var(--hp-muted)" stroke-width="1.8" stroke-linecap="round" />
				</svg>
				<span class="hp-search-placeholder">Buscar projetos, entregas, pessoas…</span>
				<span class="hp-kbd">⌘K</span>
			</div>
			<div class="hp-topbar-right" aria-hidden="true">
				<span class="hp-bell">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
						<path d="M6 8a6 6 0 1 1 12 0c0 3 1 4.5 2 6H4c1-1.5 2-3 2-6Z" stroke="var(--hp-muted-strong)" stroke-width="1.7" />
						<path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="var(--hp-muted-strong)" stroke-width="1.7" />
					</svg>
				</span>
				<span class="hp-avatar-round"></span>
			</div>
		</div>

		<main class="hp-content">
			{#if form?.message}
				<p class="hp-alert" role="alert">{form.message}</p>
			{/if}

			{#if data.projects.length === 0}
				<section class="hp-empty">
					<span class="hp-empty-icon" aria-hidden="true">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
							<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="var(--hp-accent)" stroke-width="1.7" />
							<path d="M12 12v4M10 14h4" stroke="var(--hp-accent)" stroke-width="1.7" stroke-linecap="round" />
						</svg>
					</span>
					<h1>Você ainda não tem projetos</h1>
					<p>Crie seu primeiro projeto para organizar a jornada, as entregas e sempre saber qual é o próximo passo.</p>
					<div class="hp-empty-actions">
						<a class="hp-btn-primary" href="/projects/new">Criar projeto <span aria-hidden="true">→</span></a>
						<button type="button" class="hp-btn-secondary" onclick={triggerImport}>Importar</button>
					</div>
				</section>
			{:else}
				{#if featuredProject}
					<section class="hp-resume" aria-label="Projeto em destaque">
						<div class="hp-resume-head">
							<span class="hp-eyebrow">Continue de onde parou</span>
							<div class="hp-resume-head-actions">
								<a class="hp-btn-ghost" href="/projects/new">Criar projeto</a>
								<button type="button" class="hp-btn-ghost" onclick={triggerImport}>Importar</button>
							</div>
						</div>

						<div class="hp-resume-body">
							<div class="hp-resume-left">
								<div class="hp-resume-title-row">
									<span class="hp-avatar-sq" aria-hidden="true"></span>
									<div class="hp-resume-title-text">
										<h2>{featuredProject.projectName ?? 'Projeto sem nome'}</h2>
										{#if phaseProgressText(featuredProject)}
											<p class="hp-phase-line">{phaseProgressText(featuredProject)}</p>
										{/if}
									</div>
								</div>

								{#if featuredSteps.length > 0}
									<ol class="hp-stepper">
										{#each featuredSteps as step (step.id)}
											<li class="hp-step" class:hp-step-done={step.done} class:hp-step-current={step.current}>
												<span class="hp-step-circle">
													{#if step.done}
														<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
															<path d="M5 13l4 4L19 7" stroke="var(--hp-bg)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
														</svg>
													{:else if step.current}
														<span class="hp-step-dot"></span>
													{/if}
												</span>
												<span class="hp-step-label">{step.label}</span>
											</li>
										{/each}
									</ol>
								{/if}
							</div>

							<div class="hp-resume-right">
								<span class="hp-eyebrow">Próxima ação</span>
								<p class="hp-next-title">{nextActionText(featuredProject)}</p>
								{#if nextActionWhy(featuredProject)}
									<p class="hp-next-detail">{nextActionWhy(featuredProject)}</p>
								{/if}
								<a class="hp-btn-primary" href="/projects/{featuredProject.projectId}/now">
									{ctaLabel(featuredProject)} <span aria-hidden="true">→</span>
								</a>
							</div>
						</div>
					</section>
				{/if}

				{#if !featuredProject || otherProjects.length > 0}
					<section class="hp-list-section">
						<div class="hp-list-head">
							<span class="hp-eyebrow">Meus projetos</span>
							<a class="hp-list-all" href="/projects">
								Todos os projetos
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</a>
						</div>

						<div class="hp-list-box">
							{#each otherProjects as project (project.projectId)}
								<a
									class="hp-row"
									href="/projects/{project.projectId}/now"
									aria-label="{ctaLabel(project)} — {project.projectName ?? 'Projeto sem nome'}"
								>
									<span
										class="hp-row-dot"
										style="background:{signalDotColor(project)}"
										title={movementLabel(project) ?? 'Avançando'}
										aria-hidden="true"
									></span>
									<span class="hp-row-name-wrap">
										<span class="col-name">{project.projectName ?? 'Projeto sem nome'}</span>
										{#if movementLabel(project)}
											<span class="hp-row-signal" style="color:{signalDotColor(project)}">{movementLabel(project)}</span>
										{/if}
									</span>
									{#if phaseProgressText(project)}
										<span class="hp-row-phase">{phaseProgressText(project)}</span>
									{/if}
									<span class="hp-row-next"><span class="hp-row-next-label">Próxima ação:</span> {nextActionText(project)}</span>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="hp-row-chevron">
										<path d="M9 6l6 6-6 6" stroke="var(--hp-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
									</svg>
								</a>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		</main>
	</div>

	<form method="POST" action="?/import" enctype="multipart/form-data" use:enhance class="hp-hidden-import-form">
		<input
			bind:this={importInputEl}
			onchange={submitImport}
			aria-label="Arquivo do projeto (.json)"
			name="file"
			type="file"
			accept=".json,application/json"
		/>
	</form>
</div>

<style>
	/* Identidade nova, aprovada no Claude Design (Home.dc.html) — direção
	   global do produto, aplicada tela a tela a partir daqui (C6-01).
	   Tokens escopados a `.home-shell`: enquanto as demais telas não forem
	   migradas, elas continuam na identidade papel/tinta/grafite de
	   app.css, sem alteração. */
	.home-shell {
		--hp-bg: #0a1420;
		--hp-surface: #101f2f;
		--hp-surface-alt: #0e1a27;
		--hp-border: rgba(255, 255, 255, 0.08);
		--hp-border-soft: rgba(255, 255, 255, 0.07);
		--hp-text: #e9f2f6;
		--hp-text-strong: #f5fafb;
		--hp-muted: #6f8ba0;
		--hp-muted-strong: #8fa4b8;
		--hp-accent: #5be9d8;
		--hp-accent-strong: #2dd4c4;
		--hp-accent-tint: rgba(45, 212, 196, 0.1);
		--hp-signal-blocked: #f97066;
		--hp-signal-stalled: #f5b955;
		--hp-signal-advancing: #2dd4c4;
		--hp-signal-none: rgba(255, 255, 255, 0.18);
		--hp-radius: 10px;
		--hp-radius-lg: 16px;

		min-height: 100vh;
		display: flex;
		background: var(--hp-bg);
		color: var(--hp-text);
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			sans-serif;
	}

	.hp-sidebar {
		width: 220px;
		flex-shrink: 0;
		border-right: 1px solid var(--hp-border-soft);
		background: var(--hp-bg);
		position: sticky;
		top: 0;
		height: 100vh;
	}

	.hp-sidebar-inner {
		padding: 1.375rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.625rem;
		height: 100%;
	}

	.hp-logo {
		display: flex;
		align-items: center;
		gap: 0.5625rem;
		padding: 0.25rem 0.5rem 0.125rem;
		color: inherit;
		text-decoration: none;
	}

	.hp-logo-lockup {
		display: block;
		height: 48px;
		width: auto;
	}

	.hp-logo-icon {
		display: none;
	}

	.hp-nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.hp-nav-item {
		display: flex;
		align-items: center;
		gap: 0.6875rem;
		padding: 0.5625rem 0.75rem;
		border-radius: 9px;
		position: relative;
		color: var(--hp-muted-strong);
		text-decoration: none;
	}

	.hp-nav-active {
		color: var(--hp-accent);
		background: var(--hp-accent-tint);
	}

	.hp-nav-active::before {
		content: '';
		position: absolute;
		left: -16px;
		top: 6px;
		bottom: 6px;
		width: 3px;
		border-radius: 2px;
		background: var(--hp-accent-strong);
	}

	.hp-nav-inert {
		opacity: 0.55;
		cursor: default;
	}

	.hp-nav-label {
		font-size: 0.84375rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.hp-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.hp-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		padding: 1rem 2rem;
		border-bottom: 1px solid var(--hp-border-soft);
		flex-wrap: wrap;
	}

	.hp-search {
		flex: 1;
		min-width: 200px;
		max-width: 32.5rem;
		display: flex;
		align-items: center;
		gap: 0.5625rem;
		background: var(--hp-surface);
		border: 1px solid var(--hp-border);
		border-radius: var(--hp-radius);
		padding: 0.5625rem 0.8125rem;
	}

	.hp-search-placeholder {
		flex: 1;
		min-width: 0;
		font-size: 0.84375rem;
		color: var(--hp-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hp-kbd {
		font-size: 0.6875rem;
		color: var(--hp-muted);
		background: rgba(255, 255, 255, 0.06);
		border-radius: 5px;
		padding: 0.125rem 0.375rem;
		flex-shrink: 0;
	}

	.hp-topbar-right {
		display: flex;
		align-items: center;
		gap: 1.125rem;
		flex-shrink: 0;
	}

	.hp-avatar-round {
		width: 1.875rem;
		height: 1.875rem;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--hp-accent-strong), #0891b2);
		display: block;
	}

	.hp-content {
		flex: 1;
		padding: 2rem 2.5rem 3rem;
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
		box-sizing: border-box;
	}

	.hp-alert {
		margin: 0 0 1rem;
		color: var(--hp-signal-blocked);
	}

	.hp-eyebrow {
		font-size: 0.71875rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		color: var(--hp-muted);
		text-transform: uppercase;
	}

	/* Estado vazio */
	.hp-empty {
		border: 1px solid var(--hp-border);
		background: var(--hp-surface);
		border-radius: var(--hp-radius-lg);
		padding: 3rem 3.5rem;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.875rem;
	}

	.hp-empty-icon {
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		background: var(--hp-accent-tint);
		border: 1px solid rgba(45, 212, 196, 0.3);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.hp-empty h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
		color: var(--hp-text-strong);
	}

	.hp-empty p {
		font-size: 0.875rem;
		color: var(--hp-muted-strong);
		margin: 0;
		max-width: 26rem;
		line-height: 1.5;
	}

	.hp-empty-actions {
		display: flex;
		gap: 0.625rem;
		margin-top: 0.375rem;
		flex-wrap: wrap;
	}

	.hp-btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		border: none;
		border-radius: var(--hp-radius);
		padding: 0.75rem 1.25rem;
		background: linear-gradient(135deg, var(--hp-accent-strong), #0891b2);
		color: #04211f;
		font-size: 0.875rem;
		font-weight: 700;
		font-family: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.hp-btn-secondary {
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: var(--hp-radius);
		padding: 0.75rem 1.25rem;
		background: none;
		color: #c7d7e2;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
	}

	.hp-btn-ghost {
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 8px;
		padding: 0.4375rem 0.8125rem;
		background: none;
		color: var(--hp-muted-strong);
		font-size: 0.78125rem;
		font-weight: 600;
		font-family: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	/* Continue de onde parou */
	.hp-resume {
		border: 1px solid rgba(45, 212, 196, 0.22);
		background: var(--hp-surface-alt);
		border-radius: var(--hp-radius-lg);
		padding: 1.625rem 1.75rem;
	}

	.hp-resume-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.625rem;
		flex-wrap: wrap;
		margin-bottom: 1.375rem;
	}

	.hp-resume-head-actions {
		display: flex;
		gap: 0.5rem;
	}

	.hp-resume-body {
		display: flex;
		gap: 2.25rem;
		align-items: flex-start;
	}

	.hp-resume-left {
		flex: 1.4;
		min-width: 0;
	}

	.hp-resume-title-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.875rem;
	}

	.hp-avatar-sq {
		width: 2.375rem;
		height: 2.375rem;
		border-radius: 10px;
		background: linear-gradient(135deg, var(--hp-accent-strong), #0891b2);
		flex-shrink: 0;
	}

	.hp-resume-title-text {
		min-width: 0;
	}

	.hp-resume-title-text h2 {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--hp-text-strong);
		margin: 0;
		line-height: 1.2;
	}

	.hp-phase-line {
		font-size: 0.8125rem;
		color: var(--hp-accent);
		font-weight: 600;
		margin: 0.1875rem 0 0;
	}

	.hp-stepper {
		display: flex;
		gap: 0.25rem;
		margin: 0.375rem 0 0;
		padding: 0;
		list-style: none;
	}

	.hp-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		position: relative;
		flex: 1;
		min-width: 0;
	}

	.hp-step:not(:first-child)::before {
		content: '';
		position: absolute;
		top: 0.75rem;
		right: 50%;
		width: 100%;
		height: 1px;
		background: rgba(255, 255, 255, 0.1);
		z-index: 0;
	}

	.hp-step-done:not(:first-child)::before,
	.hp-step-current:not(:first-child)::before {
		background: rgba(45, 212, 196, 0.4);
	}

	.hp-step-circle {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1;
		flex-shrink: 0;
		background: var(--hp-bg);
		border: 1.5px solid rgba(255, 255, 255, 0.18);
	}

	.hp-step-done .hp-step-circle {
		background: var(--hp-accent-strong);
		border-color: var(--hp-accent-strong);
	}

	.hp-step-current .hp-step-circle {
		border: 2px solid var(--hp-accent-strong);
	}

	.hp-step-dot {
		width: 0.4375rem;
		height: 0.4375rem;
		border-radius: 50%;
		background: var(--hp-accent-strong);
	}

	.hp-step-label {
		font-size: 0.625rem;
		color: var(--hp-muted);
		font-weight: 500;
		text-align: center;
		line-height: 1.25;
		padding: 0 0.125rem;
		box-sizing: border-box;
	}

	.hp-step-current .hp-step-label {
		color: var(--hp-accent);
		font-weight: 700;
	}

	.hp-step-done .hp-step-label {
		color: var(--hp-muted-strong);
	}

	.hp-resume-right {
		flex: 1;
		max-width: 21.25rem;
		border-left: 1px solid var(--hp-border-soft);
		padding-left: 1.75rem;
	}

	.hp-next-title {
		font-size: 1rem;
		font-weight: 700;
		color: var(--hp-text-strong);
		line-height: 1.35;
		margin: 0.5rem 0 0.5rem;
	}

	.hp-next-detail {
		font-size: 0.8125rem;
		color: var(--hp-muted-strong);
		line-height: 1.5;
		margin: 0 0 1.25rem;
	}

	/* Lista de projetos */
	.hp-list-section {
		margin-top: 1.375rem;
	}

	.hp-list-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.625rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	.hp-list-all {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.78125rem;
		color: var(--hp-muted-strong);
		text-decoration: none;
	}

	.hp-list-all:hover {
		color: var(--hp-text);
	}

	.hp-list-box {
		border: 1px solid var(--hp-border);
		border-radius: 14px;
		overflow: hidden;
		background: var(--hp-surface);
	}

	.hp-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.875rem 1.25rem;
		border-bottom: 1px solid var(--hp-border-soft);
		color: inherit;
		text-decoration: none;
	}

	.hp-row:last-child {
		border-bottom: none;
	}

	.hp-row:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.hp-row-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.hp-row-name-wrap {
		width: 10.625rem;
		flex-shrink: 0;
		min-width: 0;
	}

	.col-name {
		display: block;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--hp-text-strong);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hp-row-signal {
		font-size: 0.6875rem;
		font-weight: 600;
	}

	.hp-row-phase {
		width: 12.5rem;
		flex-shrink: 0;
		font-size: 0.8125rem;
		color: var(--hp-muted-strong);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.hp-row-next {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		color: var(--hp-muted-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hp-row-next-label {
		color: var(--hp-muted);
	}

	.hp-row-chevron {
		flex-shrink: 0;
	}

	.hp-hidden-import-form {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@media (max-width: 45rem) {
		.home-shell {
			flex-direction: column;
		}

		.hp-sidebar {
			width: 100%;
			height: auto;
			position: static;
			border-right: none;
			border-bottom: 1px solid var(--hp-border-soft);
		}

		.hp-sidebar-inner {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
			padding: 0.75rem 1rem;
			gap: 0.5rem;
		}

		.hp-logo-lockup {
			display: none;
		}

		.hp-logo-icon {
			display: block;
			height: 28px;
			width: auto;
		}

		.hp-nav {
			flex-direction: row;
			gap: 0.25rem;
		}

		.hp-nav-active::before {
			left: 6px;
			right: 6px;
			top: auto;
			bottom: 0;
			width: auto;
			height: 2px;
		}

		.hp-nav-label {
			font-size: 0.71875rem;
		}

		.hp-topbar {
			padding: 0.75rem 1rem;
		}

		.hp-kbd {
			display: none;
		}

		.hp-content {
			padding: 1.25rem 1rem 2.5rem;
		}

		.hp-empty {
			padding: 2rem 1.25rem;
			align-items: center;
			text-align: center;
		}

		.hp-empty-actions {
			justify-content: center;
			width: 100%;
		}

		.hp-empty-actions .hp-btn-primary,
		.hp-empty-actions .hp-btn-secondary {
			flex: 1;
			justify-content: center;
			text-align: center;
		}

		.hp-resume {
			padding: 1.25rem;
		}

		.hp-resume-body {
			flex-direction: column;
			gap: 1.5rem;
		}

		.hp-resume-right {
			border-left: none;
			border-top: 1px solid var(--hp-border-soft);
			padding-left: 0;
			padding-top: 1.125rem;
			max-width: none;
		}

		.hp-stepper {
			flex-wrap: wrap;
			row-gap: 1rem;
		}

		.hp-step {
			flex: 0 0 30%;
		}

		.hp-step:nth-child(3n + 1)::before {
			display: none;
		}

		.hp-row {
			flex-wrap: wrap;
			row-gap: 0.375rem;
		}

		.hp-row-name-wrap,
		.hp-row-phase {
			width: auto;
		}

		.hp-row-next {
			white-space: normal;
			flex-basis: 100%;
		}
	}
</style>
