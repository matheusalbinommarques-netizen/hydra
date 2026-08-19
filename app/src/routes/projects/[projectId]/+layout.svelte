<script lang="ts">
	import { setContext } from 'svelte';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { projectStatusLabel } from '$lib/project-status-label';
	import { EVIDENCE_OUTCOME_OPTIONS } from '$lib/catalog/external-action';
	import {
		EXTERNAL_ACTION_CAPTURE_CONTEXT_KEY,
		type ExternalActionCaptureContext
	} from '$lib/components/external-action-capture-context';
	import type { EvidenceOutcome } from '$lib/domain';

	let { data, children } = $props();
	let projectId = $derived(page.params.projectId);
	let pathname = $derived(page.url.pathname);

	// Validação Externa (ETAPA 3 do rework, correção de UX pós-dogfooding) —
	// faixa contextual "N ações em campo" visível em qualquer página interna
	// do projeto (não só /now, onde a ExternalAction nasce), sem duplicar a
	// lógica em cada rota: ProjectView já carrega externalActions/
	// affectedGroups por inteiro (ver server/application/project-view.ts),
	// então o shell só filtra e cruza os dois. A action do formulário de
	// captura aponta explicitamente para
	// `/projects/{id}/now?/completeExternalAction` — SvelteKit resolve
	// actions pela URL do <form>, não pela rota atualmente renderizada, então
	// isso funciona a partir de qualquer página sem precisar de uma action
	// própria por rota (ver now/+page.server.ts).
	let openExternalActions = $derived(
		data.view.externalActions
			.filter((action) => action.status === 'aberta')
			.map((action) => ({
				id: action.id,
				objective: action.objective,
				groupLabel: data.view.affectedGroups.find((group) => group.id === action.affectedGroupId)?.label ?? 'Grupo'
			}))
	);
	let singleOpenAction = $derived(openExternalActions.length === 1 ? openExternalActions[0] : undefined);
	let stripExpanded = $state(false);

	let captureActionId = $state<string | null>(null);
	let captureOutcome = $state<EvidenceOutcome | null>(null);
	let captureLearning = $state('');
	let captureAction = $derived(openExternalActions.find((action) => action.id === captureActionId));
	let cannotSaveEvidence = $derived(!captureOutcome || captureLearning.trim().length === 0);

	function openCapture(actionId: string) {
		captureActionId = actionId;
		captureOutcome = null;
		captureLearning = '';
		stripExpanded = false;
	}

	function closeCapture() {
		captureActionId = null;
	}

	// Única fonte de estado de captura (§10 da correção de UX): qualquer
	// descendente — hoje só MapaDeImpacto.svelte, a partir do próprio
	// AffectedGroup — chama este contexto em vez de reimplementar o drawer
	// ou o form action. "Registrar retorno" a partir do card, da faixa ou da
	// lista expandida sempre abrem o mesmo painel, sobre o mesmo
	// ExternalAction.id.
	setContext<ExternalActionCaptureContext>(EXTERNAL_ACTION_CAPTURE_CONTEXT_KEY, { open: openCapture });

	// "Entender a situação" e "Quem é afetado" (Claude Design) são as
	// atividades já convergidas para a identidade escura — o resto do shell
	// continua papel/tinta/grafite. Em vez de uma "ilha escura" isolada dentro
	// do card claro, aplicamos o tema escuro ao shell inteiro só quando uma
	// destas é a atividade atual: os mesmos tokens --hydra-* já usados por
	// todo o shell/página (header, nav, /now) são redefinidos num escopo
	// (.dark-activity), sem tocar o markup ou o CSS de nenhuma outra
	// atividade. Ao sair delas, o shell volta ao normal — nenhuma outra tela
	// foi redesenhada.
	const DARK_ACTIVITY_IDS = new Set(['problema', 'publico', 'estado_atual', 'entender_causas']);
	// Checkpoint da Descoberta (S4D) — Design Gate aprovado na mesma
	// identidade escura das atividades acima; diferente delas, não é uma
	// atividade dentro de /now, é sua própria rota (/summary), então entra por
	// pathname em vez de page.data.activity.id.
	let isCheckpointRoute = $derived(pathname === `/projects/${projectId}/summary`);
	let isDarkActivity = $derived(
		DARK_ACTIVITY_IDS.has((page.data as { activity?: { id?: string } })?.activity?.id ?? '') || isCheckpointRoute
	);

	// Ativo tanto na rota exata quanto em subrotas (ex.: /work/x),
	// com limite de segmento para não casar caminhos apenas parecidos
	// (ex.: /work-archive).
	function isCurrentRoute(target: string): boolean {
		return pathname === target || pathname.startsWith(`${target}/`);
	}

	// Lista única dos dez destinos reais do workspace — reaproveitada pelo
	// menu mobile e pelo rótulo "área atual" do cabeçalho compacto. A
	// navegação desktop abaixo continua com sua própria marcação (dois
	// grupos com pesos visuais diferentes) e não usa esta lista, para não
	// mudar nada do que já está aprovado nela.
	const NAV_ITEMS = [
		{ key: 'now', label: 'Agora' },
		{ key: 'tracking', label: 'Acompanhamento' },
		{ key: 'map', label: 'Mapa' },
		{ key: 'records', label: 'Registros' },
		{ key: 'work', label: 'Trabalho' },
		{ key: 'summary', label: 'Resumo' },
		{ key: 'document', label: 'Documento' },
		{ key: 'closure', label: 'Encerramento' },
		{ key: 'export', label: 'Exportar' },
		{ key: 'settings', label: 'Configurações' }
	] as const;

	let currentAreaLabel = $derived(
		NAV_ITEMS.find((item) => isCurrentRoute(`/projects/${projectId}/${item.key}`))?.label ?? ''
	);

	let mobileMenuOpen = $state(false);

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	// Fecha o menu mobile sempre que a rota muda — sem isto, navegar por um
	// link do próprio menu deixaria o painel aberto sobre a tela seguinte.
	$effect(() => {
		pathname;
		mobileMenuOpen = false;
	});
</script>

<div class="project-shell" class:dark-activity={isDarkActivity} class:hydra-dark-tokens={isDarkActivity}>
	<header class="project-header header-desktop">
		<div class="identity">
			<a class="projects-link" href="/projects">← Projetos</a>
			<span class="identity-divider" aria-hidden="true"></span>
			<a class="symbol-link" href="/">
				<img class="symbol" src="/brand/hydra-symbol-header-128.png" alt="" />
			</a>
			<div>
				<p class="eyebrow">{data.view.projectName ?? 'Projeto sem nome'}</p>
				<p class="status">Status: {projectStatusLabel[data.view.projectStatus]}</p>
			</div>
		</div>
		<nav>
			<div class="nav-primary" aria-label="Modos de trabalho">
				<a
					href="/projects/{projectId}/now"
					aria-current={isCurrentRoute(`/projects/${projectId}/now`) ? 'page' : undefined}
				>
					Agora
				</a>
				<a
					href="/projects/{projectId}/tracking"
					aria-current={isCurrentRoute(`/projects/${projectId}/tracking`) ? 'page' : undefined}
				>
					Acompanhamento
				</a>
			</div>
			<span class="nav-divider" aria-hidden="true"></span>
			<div class="nav-secondary" aria-label="Consulta">
				<a
					href="/projects/{projectId}/map"
					aria-current={isCurrentRoute(`/projects/${projectId}/map`) ? 'page' : undefined}
				>
					Mapa
				</a>
				<a
					href="/projects/{projectId}/records"
					aria-current={isCurrentRoute(`/projects/${projectId}/records`) ? 'page' : undefined}
				>
					Registros
				</a>
				<a
					href="/projects/{projectId}/work"
					aria-current={isCurrentRoute(`/projects/${projectId}/work`) ? 'page' : undefined}
				>
					Trabalho
				</a>
				<a
					href="/projects/{projectId}/summary"
					aria-current={isCurrentRoute(`/projects/${projectId}/summary`) ? 'page' : undefined}
				>
					Resumo
				</a>
				<a
					href="/projects/{projectId}/document"
					aria-current={isCurrentRoute(`/projects/${projectId}/document`) ? 'page' : undefined}
				>
					Documento
				</a>
				<a
					href="/projects/{projectId}/closure"
					aria-current={isCurrentRoute(`/projects/${projectId}/closure`) ? 'page' : undefined}
				>
					Encerramento
				</a>
				<a
					href="/projects/{projectId}/export"
					aria-current={isCurrentRoute(`/projects/${projectId}/export`) ? 'page' : undefined}
				>
					Exportar
				</a>
				<a
					href="/projects/{projectId}/settings"
					aria-current={isCurrentRoute(`/projects/${projectId}/settings`) ? 'page' : undefined}
				>
					Configurações
				</a>
			</div>
		</nav>
	</header>

	<header class="project-header header-mobile">
		<div class="mobile-header-top">
			<a class="projects-link" href="/projects">← Projetos</a>
			<span class="identity-divider" aria-hidden="true"></span>
			<a class="symbol-link" href="/">
				<img class="symbol" src="/brand/hydra-symbol-header-128.png" alt="" />
			</a>
		</div>
		<div class="mobile-header-identity">
			<p class="eyebrow">{data.view.projectName ?? 'Projeto sem nome'}</p>
			<p class="status">Status: {projectStatusLabel[data.view.projectStatus]}</p>
		</div>
		<div class="mobile-header-area">
			<span class="mobile-area-badge">{currentAreaLabel}</span>
			<button
				type="button"
				class="mobile-menu-toggle"
				aria-expanded={mobileMenuOpen}
				aria-controls="mobile-nav-menu"
				onclick={toggleMobileMenu}
			>
				{mobileMenuOpen ? 'Fechar' : 'Menu'}
			</button>
		</div>
		{#if mobileMenuOpen}
			<nav id="mobile-nav-menu" class="mobile-nav-menu" aria-label="Navegação do projeto">
				{#each NAV_ITEMS as item (item.key)}
					<a
						href="/projects/{projectId}/{item.key}"
						aria-current={isCurrentRoute(`/projects/${projectId}/${item.key}`) ? 'page' : undefined}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		{/if}
	</header>

	{#if openExternalActions.length > 0}
		<div class="external-actions-strip" aria-label="Ações em campo">
			{#if singleOpenAction}
				<div class="strip-row">
					<div class="strip-status">
						<span class="strip-dot" aria-hidden="true"></span>
						<span>Ação em campo — {singleOpenAction.groupLabel}</span>
					</div>
					<button type="button" class="strip-action" onclick={() => openCapture(singleOpenAction.id)}>
						Registrar retorno
					</button>
				</div>
			{:else}
				<div class="strip-row">
					<div class="strip-status">
						<span class="strip-dot" aria-hidden="true"></span>
						<span>
							{openExternalActions.length} ações em campo · {openExternalActions
								.map((action) => action.groupLabel)
								.join(' · ')}
						</span>
					</div>
					<button
						type="button"
						class="strip-toggle"
						aria-expanded={stripExpanded}
						aria-controls="strip-action-list"
						onclick={() => (stripExpanded = !stripExpanded)}
					>
						{stripExpanded ? 'Ocultar' : 'Ver ações'}
					</button>
				</div>
				{#if stripExpanded}
					<ul id="strip-action-list" class="strip-list">
						{#each openExternalActions as action (action.id)}
							<li class="strip-list-item">
								<span>{action.groupLabel}</span>
								<button type="button" class="strip-action strip-action-text" onclick={() => openCapture(action.id)}>
									Registrar retorno
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	{/if}

	{#if captureActionId && captureAction}
		<div class="capture-overlay" onclick={closeCapture} aria-hidden="true"></div>
		<div class="capture-drawer" role="dialog" aria-label="Retorno da validação">
			<div class="capture-header">
				<p class="capture-eyebrow">Retorno da validação</p>
				<p class="capture-group">{captureAction.groupLabel}</p>
				<p class="capture-objective">{captureAction.objective}</p>
			</div>
			<div class="capture-choices">
				{#each EVIDENCE_OUTCOME_OPTIONS as option (option.id)}
					<button
						type="button"
						class="capture-choice"
						class:selected={captureOutcome === option.id}
						aria-pressed={captureOutcome === option.id}
						onclick={() => (captureOutcome = option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			<form
				method="POST"
				action="/projects/{projectId}/now?/completeExternalAction"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'failure' || result.type === 'error') {
							await update();
							return;
						}
						await update();
						closeCapture();
					};
				}}
			>
				<input type="hidden" name="actionId" value={captureActionId} />
				<input type="hidden" name="outcome" value={captureOutcome ?? ''} />
				<label class="capture-label" for="capture-learning">O que você aprendeu?</label>
				<textarea
					id="capture-learning"
					name="learning"
					bind:value={captureLearning}
					placeholder="Uma frase curta já basta."
				></textarea>
				<div class="capture-actions">
					<button type="button" class="capture-close" onclick={closeCapture}>Fechar</button>
					<button type="submit" class="capture-save" disabled={cannotSaveEvidence}>Salvar evidência</button>
				</div>
			</form>
		</div>
	{/if}

	<main class="container">
		{@render children()}
	</main>
</div>

<style>
	/* Redefine só os tokens de cor já usados pelo shell/página (--hydra-*),
	   para a paleta escura aprovada no Claude Design ("Entender a
	   Situacao.dc.html") — mesmos valores usados na Home (D033). Nenhuma
	   regra nova de layout/espaçamento; header, nav e /now continuam com o
	   mesmo CSS, só lendo cores diferentes enquanto esta atividade é a atual.
	   Valores comprovadamente iguais à Home e a /projects/new passam a ler
	   de `--hydra-dark-*` (`.hydra-dark-tokens`, app.css, ETAPA 1); a borda
	   e o aviso desta tela têm valor próprio, aprovado neste mockup
	   especificamente, e continuam locais — não foram forçados a coincidir
	   com o valor levemente diferente usado pelas outras duas telas.
	   font-family: correção complementar da ETAPA 1 — esta tela herdava
	   Manrope do body (sem efeito visual até aqui, porque nem Manrope nem
	   'Inter' declarada tinham arquivo carregado); agora que Inter é
	   carregada de verdade (app.css), esta tela passa a usar a mesma fonte
	   real da Home e de /projects/new, em vez de continuar na única
	   divergência de fallback que restava entre as três. */
	.dark-activity {
		--hydra-bg: var(--hydra-dark-bg);
		--hydra-surface: var(--hydra-dark-surface);
		--hydra-surface-raised: var(--hydra-dark-surface-raised);
		--hydra-border: rgba(255, 255, 255, 0.1);
		--hydra-text: var(--hydra-dark-text);
		--hydra-muted: var(--hydra-dark-muted);
		--hydra-accent: var(--hydra-dark-accent);
		--hydra-warning: #f5b955;
		--hydra-shadow-raised: none;
		font-family: var(--hydra-dark-font);
	}

	.dark-activity {
		background: var(--hydra-bg);
		min-height: 100vh;
	}

	.project-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-5);
		border-bottom: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		box-shadow: var(--hydra-shadow-raised);
	}

	.identity {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.projects-link {
		font-size: var(--font-size-meta);
		font-weight: 600;
		color: var(--hydra-muted);
		text-decoration: none;
		white-space: nowrap;
	}

	.projects-link:hover {
		color: var(--hydra-text);
		text-decoration: underline;
	}

	.identity-divider {
		width: 1px;
		height: 1.75rem;
		background: var(--hydra-border);
		flex-shrink: 0;
	}

	.symbol-link {
		display: block;
		line-height: 0;
	}

	.symbol {
		height: 2rem;
		width: auto;
		display: block;
	}

	.eyebrow {
		margin: 0;
		font-weight: 700;
		font-size: var(--font-size-subtitle);
	}

	.status {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	nav {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	/* Destaque: os dois modos de trabalho (Agora/Acompanhamento) — estilo de aba,
	   mais peso visual, com o ativo marcado por fundo + sublinhado forte. */
	.nav-primary {
		display: flex;
		gap: var(--space-1);
	}

	.nav-primary a {
		font-weight: 700;
		text-decoration: none;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--hydra-radius) var(--hydra-radius) 0 0;
		border-bottom: 2px solid transparent;
		color: var(--hydra-muted);
	}

	.nav-primary a:hover {
		color: var(--hydra-text);
	}

	.nav-primary a[aria-current='page'] {
		color: var(--hydra-text);
		background: var(--hydra-surface-raised);
		border-bottom-color: var(--hydra-accent);
	}

	.nav-divider {
		width: 1px;
		height: 1.25rem;
		background: var(--hydra-border);
		flex-shrink: 0;
	}

	/* Utilitário: telas de consulta (Mapa/Registros/Resumo/Exportar) —
	   deliberadamente mais discreto, sem competir com Agora/Acompanhamento. */
	.nav-secondary {
		display: flex;
		gap: var(--space-3);
	}

	.nav-secondary a {
		font-size: var(--font-size-caption);
		font-weight: 500;
		color: var(--hydra-muted);
		text-decoration: none;
	}

	.nav-secondary a:hover {
		color: var(--hydra-text);
		text-decoration: underline;
	}

	.nav-secondary a[aria-current='page'] {
		color: var(--hydra-text);
		font-weight: 700;
		text-decoration: underline;
	}

	/* Cabeçalho compacto (mobile) — escondido acima do breakpoint; o
	   cabeçalho desktop acima faz o inverso. Os dois ficam sempre no
	   markup — só a mídia decide qual aparece — para não depender de JS
	   para detectar viewport. */
	.header-mobile {
		display: none;
	}

	.mobile-header-top {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.mobile-header-identity {
		margin-top: var(--space-3);
	}

	.mobile-header-area {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--hydra-border);
	}

	.mobile-area-badge {
		font-size: var(--font-size-caption);
		font-weight: 700;
		padding: var(--space-1) var(--space-3);
		border-radius: var(--hydra-radius-pill);
		background: var(--hydra-bg);
		color: var(--hydra-text);
	}

	.mobile-menu-toggle {
		font-size: var(--font-size-caption);
		padding: var(--space-2) var(--space-4);
		min-height: 2.5rem;
	}

	.mobile-nav-menu {
		display: flex;
		flex-direction: column;
		margin-top: var(--space-3);
		border-top: 1px solid var(--hydra-border);
	}

	.mobile-nav-menu a {
		padding: var(--space-3) var(--space-2);
		font-size: var(--font-size-body);
		font-weight: 500;
		color: var(--hydra-text);
		text-decoration: none;
		border-bottom: 1px solid var(--hydra-border);
		min-height: 2.75rem;
		display: flex;
		align-items: center;
	}

	.mobile-nav-menu a:last-child {
		border-bottom: none;
	}

	.mobile-nav-menu a[aria-current='page'] {
		font-weight: 700;
	}

	/* Faixa contextual de ações em campo (correção de UX pós-dogfooding) —
	   presença TEMPORÁRIA, nunca uma central/backlog: existe só enquanto há
	   ExternalAction aberta, some quando não há nenhuma. Full-bleed logo
	   abaixo da navegação, para não competir com o conteúdo principal nem
	   passar despercebida como os pills isolados anteriores. Indicador
	   estático (sem pulse contínuo, §13 da correção) — o teal já diferencia
	   visualmente sem parecer notificação piscando. */
	.external-actions-strip {
		background: rgba(45, 212, 196, 0.08);
		border-bottom: 1px solid rgba(45, 212, 196, 0.35);
		padding: var(--space-3) var(--space-5);
	}

	.strip-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
	}

	.strip-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--hydra-text);
		min-width: 0;
	}

	.strip-status span:last-child {
		overflow-wrap: break-word;
	}

	.strip-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: #2dd4c4;
		flex-shrink: 0;
	}

	.strip-action,
	.strip-toggle {
		background: none;
		border: 1px solid rgba(45, 212, 196, 0.45);
		border-radius: var(--hydra-radius-pill, 999px);
		color: var(--hydra-text);
		font-size: 0.78125rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		padding: 0.375rem 0.875rem;
		min-height: 2.25rem;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.strip-toggle {
		border: none;
		padding: 0;
		color: #5be9d8;
		text-decoration: underline;
		min-height: auto;
	}

	.strip-list {
		list-style: none;
		margin: var(--space-3) 0 0;
		padding-top: var(--space-3);
		border-top: 1px solid rgba(45, 212, 196, 0.3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.strip-list-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		font-size: 0.8125rem;
		color: var(--hydra-text);
		flex-wrap: wrap;
	}

	.strip-action-text {
		border: none;
		padding: 0;
		color: #5be9d8;
		text-decoration: underline;
		min-height: auto;
	}

	/* Drawer de retorno (correção de UX pós-dogfooding) — substitui a caixa
	   flutuante anterior por um painel de altura total com overlay,
	   consistente com o handoff aprovado: o retorno passa a ser uma
	   continuação clara de UMA ExternalAction específica (grupo + objetivo
	   visíveis de cara), não um formulário genérico. */
	.capture-overlay {
		position: fixed;
		inset: 0;
		background: rgba(5, 10, 16, 0.55);
		z-index: 49;
	}

	.capture-drawer {
		position: fixed;
		top: 0;
		right: 0;
		height: 100%;
		width: min(23.75rem, 100vw);
		background: var(--hydra-surface-raised);
		border-left: 1px solid var(--hydra-border);
		padding: var(--space-6) var(--space-5);
		box-shadow: -8px 0 32px rgba(0, 0, 0, 0.35);
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		overflow-y: auto;
		box-sizing: border-box;
	}

	.capture-header {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.capture-eyebrow {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-accent);
	}

	.capture-group {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--hydra-text);
	}

	.capture-objective {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--hydra-muted);
		line-height: 1.45;
	}

	.capture-choices {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.capture-choice {
		text-align: left;
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		padding: var(--space-3);
		font-size: 0.8125rem;
		font-family: inherit;
		color: var(--hydra-text);
		cursor: pointer;
		min-height: 2.75rem;
	}

	.capture-choice.selected {
		border-color: var(--hydra-accent);
		background: rgba(45, 212, 196, 0.12);
	}

	.capture-drawer form {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin: 0;
	}

	.capture-label {
		font-size: 0.75rem;
		color: var(--hydra-muted);
	}

	.capture-drawer textarea {
		width: 100%;
		box-sizing: border-box;
		font-family: inherit;
		font-size: 0.8125rem;
		color: var(--hydra-text);
		background: var(--hydra-surface);
		border: 1px solid var(--hydra-border);
		border-radius: var(--hydra-radius);
		padding: var(--space-3);
		min-height: 3.5rem;
		resize: vertical;
	}

	.capture-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: auto;
		padding-top: var(--space-3);
	}

	.capture-close {
		background: none;
		border: none;
		color: var(--hydra-muted);
		font-size: 0.8125rem;
		cursor: pointer;
		font-family: inherit;
		padding: 0;
	}

	.capture-save {
		background: var(--hydra-accent);
		color: var(--hydra-bg, #04211f);
		border: none;
		border-radius: var(--hydra-radius);
		padding: var(--space-2) var(--space-4);
		font-weight: 700;
		font-size: 0.8125rem;
		cursor: pointer;
		font-family: inherit;
	}

	.capture-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 860px) {
		.header-desktop {
			display: none;
		}

		.header-mobile {
			display: block;
			padding: var(--space-4);
		}

		.container {
			padding: var(--space-4);
		}

		.external-actions-strip {
			padding: var(--space-3) var(--space-4);
		}

		.strip-row {
			align-items: flex-start;
		}
	}
</style>
