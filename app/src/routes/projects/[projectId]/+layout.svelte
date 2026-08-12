<script lang="ts">
	import { page } from '$app/state';
	import { projectStatusLabel } from '$lib/project-status-label';

	let { data, children } = $props();
	let projectId = $derived(page.params.projectId);
	let pathname = $derived(page.url.pathname);

	// "Entender a situação" (Claude Design) é a única atividade já convergida
	// para a identidade escura — o resto do shell continua papel/tinta/
	// grafite. Em vez de uma "ilha escura" isolada dentro do card claro,
	// aplicamos o tema escuro ao shell inteiro só quando esta é a atividade
	// atual: os mesmos tokens --hydra-* já usados por todo o shell/página
	// (header, nav, /now) são redefinidos num escopo (.dark-activity), sem
	// tocar o markup ou o CSS de nenhuma outra atividade. Ao sair desta
	// atividade, o shell volta ao normal — nenhuma outra tela foi redesenhada.
	let isDarkActivity = $derived((page.data as { activity?: { id?: string } })?.activity?.id === 'problema');

	// Ativo tanto na rota exata quanto em subrotas (ex.: /deliveries/x),
	// com limite de segmento para não casar caminhos apenas parecidos
	// (ex.: /deliveries-archive).
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
		{ key: 'deliveries', label: 'Entregas' },
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
					href="/projects/{projectId}/deliveries"
					aria-current={isCurrentRoute(`/projects/${projectId}/deliveries`) ? 'page' : undefined}
				>
					Entregas
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
	}
</style>
