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

	// Validação Externa (ETAPA 3 do rework, correção de UX pós-dogfooding) +
	// Ações externas maduras (ETAPA 14, §44, D070/D072/D073) — faixa
	// contextual "N ações em campo" visível em qualquer página interna do
	// projeto (não só /now ou /decisions, onde cada kind nasce), sem duplicar
	// a lógica em cada rota: ProjectView já carrega externalActions/
	// affectedGroups/decisions por inteiro (ver
	// server/application/project-view.ts), então o shell só filtra e cruza os
	// três. Cada `kind` deriva seu próprio rótulo — `approval` não tem
	// objective/groupLabel (a ExternalAction não carrega esse texto, D073: só
	// a Decision é fonte), então o rótulo vem de `Decision.subject`. As
	// actions dos formulários de captura apontam explicitamente para a rota
	// que as define (`/projects/{id}/now?/completeExternalAction`,
	// `/projects/{id}/decisions?/completeApprovalExternalAction`,
	// `/projects/{id}/decisions?/reconcileApprovalExternalAction`) —
	// SvelteKit resolve actions pela URL do <form>, não pela rota atualmente
	// renderizada, então isso funciona a partir de qualquer página sem
	// precisar de uma action própria por rota.
	type OpenExternalAction =
		| { id: string; kind: 'validate_affected_group'; label: string; objective: string }
		| {
				id: string;
				kind: 'approval';
				label: string;
				decisionStatus: 'pendente' | 'tomada';
				decisionOutcome: string | null;
		  };

	let openExternalActions = $derived<OpenExternalAction[]>(
		data.view.externalActions
			.filter((action) => action.status === 'aberta')
			.map((action) => {
				if (action.kind === 'approval') {
					const decision = data.view.decisions.find((item) => item.id === action.decisionId);
					return {
						id: action.id,
						kind: 'approval',
						label: decision?.subject ?? 'Decisão',
						decisionStatus: decision?.status ?? 'pendente',
						decisionOutcome: decision?.outcome ?? null
					};
				}
				return {
					id: action.id,
					kind: 'validate_affected_group',
					label: data.view.affectedGroups.find((group) => group.id === action.affectedGroupId)?.label ?? 'Grupo',
					objective: action.objective
				};
			})
	);
	let singleOpenAction = $derived(openExternalActions.length === 1 ? openExternalActions[0] : undefined);
	let stripExpanded = $state(false);

	let captureActionId = $state<string | null>(null);
	let captureOutcome = $state<EvidenceOutcome | null>(null);
	let captureLearning = $state('');
	let captureApprovalOutcome = $state('');
	let captureAction = $derived(openExternalActions.find((action) => action.id === captureActionId));
	let cannotSaveEvidence = $derived(!captureOutcome || captureLearning.trim().length === 0);
	let cannotSaveApprovalOutcome = $derived(captureApprovalOutcome.trim().length === 0);

	function openCapture(actionId: string) {
		captureActionId = actionId;
		captureOutcome = null;
		captureLearning = '';
		captureApprovalOutcome = '';
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
	// atividades já convergidas para a identidade escura. O shell (header,
	// nav, faixa de ações em campo) é dark sempre agora (S6V, Design Gate
	// "Convergência Visual") — este predicate não decide mais isso. Ele
	// continua decidindo só o CONTEÚDO: quando a atividade atual já foi
	// migrada para a identidade escura, o conteúdo renderiza direto dentro
	// do shell; quando ainda não foi, o conteúdo (com seu CSS/tema local
	// intocado) é contido num cartão com o raio/borda do shell (S6V), sem
	// nenhum aviso de "legado" exposto ao usuário.
	const DARK_ACTIVITY_IDS = new Set(['problema', 'publico', 'estado_atual', 'entender_causas']);
	// Checkpoint da Descoberta (S4D) — Design Gate aprovado na mesma
	// identidade escura das atividades acima; diferente delas, não é uma
	// atividade dentro de /now, é sua própria rota (/summary), então entra por
	// pathname em vez de page.data.activity.id.
	let isCheckpointRoute = $derived(pathname === `/projects/${projectId}/summary`);
	// Entregas (ETAPA 9 do rework, Design Gate S9) — nasce já na identidade
	// escura, mesmo caso de /summary acima.
	let isDeliverablesRoute = $derived(pathname === `/projects/${projectId}/deliverables`);
	let isContentMigrated = $derived(
		DARK_ACTIVITY_IDS.has((page.data as { activity?: { id?: string } })?.activity?.id ?? '') ||
			isCheckpointRoute ||
			isDeliverablesRoute
	);

	// Ativo tanto na rota exata quanto em subrotas (ex.: /work/x),
	// com limite de segmento para não casar caminhos apenas parecidos
	// (ex.: /work-archive).
	function isCurrentRoute(target: string): boolean {
		return pathname === target || pathname.startsWith(`${target}/`);
	}

	// Corredor operacional (D066, decision-log.md) — os sete destinos primários
	// do produto, nesta ordem fixa; navegação primária tanto em desktop quanto
	// em mobile. `/work` mantém a rota real, só o rótulo de produto vira
	// "Quadro" (D066: "Quadro = apresentação madura da capacidade atual de
	// Trabalho"). Cronograma (ETAPA 12 do rework, §42, sexto microcorte;
	// reachability resolvida na ETAPA 13, §43, absorção de Acompanhamento) —
	// sempre visível, mesmo antes da readiness: a própria rota mostra a Linha
	// do tempo de baixa fidelidade nesse caso, nunca redireciona para fora.
	const PRIMARY_NAV_ITEMS = [
		{ key: 'now', label: 'Agora' },
		{ key: 'work', label: 'Quadro' },
		{ key: 'cronograma', label: 'Cronograma' },
		{ key: 'deliverables', label: 'Entregas' },
		{ key: 'risks', label: 'Riscos' },
		{ key: 'attentions', label: 'Atenções' },
		{ key: 'decisions', label: 'Decisões' }
	] as const;

	// Destinos auxiliares (D066) — subordinados visualmente ao corredor,
	// sem competir com ele; continuam alcançáveis em toda rota.
	const SECONDARY_NAV_ITEMS = [
		{ key: 'map', label: 'Mapa' },
		{ key: 'records', label: 'Registros' },
		{ key: 'summary', label: 'Resumo' },
		{ key: 'document', label: 'Documento' },
		{ key: 'closure', label: 'Encerramento' },
		{ key: 'export', label: 'Exportar' },
		{ key: 'settings', label: 'Configurações' }
	] as const;

	// União só para lookup (rótulo da área atual, menu mobile) — a ordem e o
	// agrupamento visual real vêm sempre de PRIMARY_NAV_ITEMS/SECONDARY_NAV_ITEMS.
	const NAV_ITEMS = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS] as const;

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

<div class="project-shell hydra-dark-tokens">
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
				{#if data.view.currentPhase}
					<p class="phase">Fase: {data.view.currentPhase.phaseLabel}</p>
				{/if}
			</div>
		</div>
		<nav>
			<div class="nav-primary" aria-label="Corredor operacional">
				{#each PRIMARY_NAV_ITEMS as item (item.key)}
					<a
						href="/projects/{projectId}/{item.key}"
						aria-current={isCurrentRoute(`/projects/${projectId}/${item.key}`) ? 'page' : undefined}
					>
						{item.label}
					</a>
				{/each}
			</div>
			<span class="nav-divider" aria-hidden="true"></span>
			<div class="nav-secondary" aria-label="Destinos auxiliares">
				{#each SECONDARY_NAV_ITEMS as item (item.key)}
					<a
						href="/projects/{projectId}/{item.key}"
						aria-current={isCurrentRoute(`/projects/${projectId}/${item.key}`) ? 'page' : undefined}
					>
						{item.label}
					</a>
				{/each}
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
			{#if data.view.currentPhase}
				<p class="phase">Fase: {data.view.currentPhase.phaseLabel}</p>
			{/if}
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
				<div class="mobile-nav-group mobile-nav-primary" aria-label="Corredor operacional">
					{#each PRIMARY_NAV_ITEMS as item (item.key)}
						<a
							href="/projects/{projectId}/{item.key}"
							aria-current={isCurrentRoute(`/projects/${projectId}/${item.key}`) ? 'page' : undefined}
						>
							{item.label}
						</a>
					{/each}
				</div>
				<div class="mobile-nav-group mobile-nav-secondary" aria-label="Destinos auxiliares">
					{#each SECONDARY_NAV_ITEMS as item (item.key)}
						<a
							href="/projects/{projectId}/{item.key}"
							aria-current={isCurrentRoute(`/projects/${projectId}/${item.key}`) ? 'page' : undefined}
						>
							{item.label}
						</a>
					{/each}
				</div>
			</nav>
		{/if}
	</header>

	{#if openExternalActions.length > 0}
		<div class="external-actions-strip" aria-label="Ações em campo">
			{#if singleOpenAction}
				<div class="strip-row">
					<div class="strip-status">
						<span class="strip-dot" aria-hidden="true"></span>
						<span>Ação em campo — {singleOpenAction.label}</span>
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
								.map((action) => action.label)
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
								<span>{action.label}</span>
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
		{#if captureAction.kind === 'validate_affected_group'}
			<div class="capture-drawer" role="dialog" aria-label="Retorno da validação">
				<div class="capture-header">
					<p class="capture-eyebrow">Retorno da validação</p>
					<p class="capture-group">{captureAction.label}</p>
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
		{:else if captureAction.decisionStatus === 'pendente'}
			<div class="capture-drawer" role="dialog" aria-label="Retorno da aprovação">
				<div class="capture-header">
					<p class="capture-eyebrow">Retorno da aprovação</p>
					<p class="capture-group">{captureAction.label}</p>
				</div>
				<form
					method="POST"
					action="/projects/{projectId}/decisions?/completeApprovalExternalAction"
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
					<label class="capture-label" for="capture-approval-outcome">Resultado da decisão</label>
					<textarea
						id="capture-approval-outcome"
						name="outcome"
						bind:value={captureApprovalOutcome}
						placeholder="O que foi decidido?"
					></textarea>
					<div class="capture-actions">
						<button type="button" class="capture-close" onclick={closeCapture}>Fechar</button>
						<button type="submit" class="capture-save" disabled={cannotSaveApprovalOutcome}>Registrar decisão</button>
					</div>
				</form>
			</div>
		{:else}
			<div class="capture-drawer" role="dialog" aria-label="Retorno da aprovação">
				<div class="capture-header">
					<p class="capture-eyebrow">Retorno da aprovação</p>
					<p class="capture-group">{captureAction.label}</p>
					<p class="capture-objective">
						Esta decisão já foi tomada: {captureAction.decisionOutcome}
					</p>
				</div>
				<form
					method="POST"
					action="/projects/{projectId}/decisions?/reconcileApprovalExternalAction"
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
					<div class="capture-actions">
						<button type="button" class="capture-close" onclick={closeCapture}>Fechar</button>
						<button type="submit" class="capture-save">Reconciliar</button>
					</div>
				</form>
			</div>
		{/if}
	{/if}

	<main class="container">
		{#if isContentMigrated}
			{@render children()}
		{:else}
			<div class="content-frame">
				{@render children()}
			</div>
		{/if}
	</main>
</div>

<style>
	/* Redefine só os tokens de cor já usados pelo shell/página (--hydra-*),
	   para a paleta escura aprovada no Claude Design. Nenhuma regra nova de
	   layout/espaçamento; header, nav e faixa de ações em campo continuam
	   com o mesmo CSS, só lendo cores diferentes. Valores comprovadamente
	   iguais à Home e a /projects/new passam a ler de `--hydra-dark-*`
	   (`.hydra-dark-tokens`, app.css, ETAPA 1).
	   S6V (Design Gate "Convergência Visual"): o shell inteiro é dark
	   sempre agora, não só quando a atividade atual já foi migrada —
	   isso passou a ser decidido só para o CONTEÚDO (.content-frame
	   abaixo), via `isContentMigrated`. */
	.project-shell {
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

	.project-shell {
		background: var(--hydra-bg);
		min-height: 100vh;
	}

	/* Contenção visual temporária (S6V) para conteúdo interno ainda não
	   migrado para a identidade escura: o CSS/tema local da tela (ex.:
	   Trabalho, papel/tinta/grafite) fica intocado, só passa a viver dentro
	   de um cartão com o mesmo raio/borda do shell dark — para não colidir
	   direto com o fundo dark. Puramente visual: nenhum rótulo, selo ou
	   aviso é exposto ao usuário. Some sozinha quando a tela migrar (basta
	   `isContentMigrated` passar a valer true para ela). */
	.content-frame {
		border-radius: 16px;
		border: 1px solid var(--hydra-dark-border);
		overflow: hidden;
	}

	/* `--hydra-*` são os MESMOS nomes de token usados pelo CSS local de telas
	   ainda não migradas (ex.: work/+page.svelte lê var(--hydra-surface)).
	   Sem este reset, o valor dark redefinido em `.project-shell` vazaria por
	   herança de custom property para dentro do cartão contido e recolori-
	   ria essas telas — exatamente o que o invariante "CSS/tema local
	   intocado" proíbe. Os valores abaixo são os mesmos de `:root` em
	   app.css (paleta papel/tinta/grafite), só re-declarados aqui para
	   interromper a herança dark na borda do cartão.
	   `background`/`color`: correção pós-dogfood — resetar só as
	   variáveis não bastava. Muitas telas legadas não pintam o próprio
	   fundo (esperavam herdar o canvas claro que `.project-shell` pintava
	   antes do S6V); sem pintar aqui, o cartão ficava transparente e texto
	   escuro (herdado de `--hydra-text` já resetado) caía direto sobre o
	   canvas navy do shell — praticamente ilegível em Agora, Acompanhamento,
	   Mapa, Documento e Encerramento. Pintar o canvas/superfície claros
	   aqui é a fronteira certa: nenhuma tela precisou ser tocada. */
	.content-frame {
		--hydra-bg: #e8e9e3;
		--hydra-surface: #f8f8f8;
		--hydra-surface-raised: #ffffff;
		--hydra-border: #65686c;
		--hydra-text: #151918;
		--hydra-muted: #65686c;
		--hydra-accent: #151918;
		--hydra-warning: #8b3227;
		--hydra-shadow-raised: 0 1px 2px rgba(21, 25, 24, 0.08);
		background: var(--hydra-bg);
		color: var(--hydra-text);
		font-family:
			'Manrope',
			system-ui,
			-apple-system,
			sans-serif;
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
		/* Sem `color` explícito, este texto herdava a cor computada em
		   `body` (tinta clara #151918, do :root de app.css) em vez de ler
		   `--hydra-text` no escopo do próprio shell — porque herança de CSS
		   propaga o valor JÁ COMPUTADO no ancestral, não a variável. Como
		   `body` fica fora de `.project-shell`, o override dark nunca
		   alcançava esta regra, e o nome do projeto ficava quase preto sobre
		   o navy (defeito 2, dogfood pós-S6V). */
		color: var(--hydra-text);
	}

	.status {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	/* Fase (D066) — semântica factual, distinta de Status (ProjectStatus);
	   mesmo peso visual discreto de .status, para não competir com ele. */
	.phase {
		margin: var(--space-1) 0 0;
		font-size: var(--font-size-meta);
		color: var(--hydra-muted);
	}

	nav {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		row-gap: var(--space-2);
		gap: var(--space-4);
	}

	/* Corredor operacional (D066) — os sete destinos primários do produto,
	   estilo de aba, com o ativo marcado por fundo + sublinhado forte. */
	.nav-primary {
		display: flex;
		flex-wrap: wrap;
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

	/* Destinos auxiliares (D066) — deliberadamente mais discretos, sem
	   competir visualmente com o corredor operacional. */
	.nav-secondary {
		display: flex;
		flex-wrap: wrap;
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

	.mobile-nav-group {
		display: flex;
		flex-direction: column;
	}

	/* Corredor operacional em peso maior; auxiliares (D066) deliberadamente
	   mais discretos, separados por uma segunda borda de grupo. */
	.mobile-nav-secondary {
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

	.mobile-nav-primary a {
		font-weight: 700;
	}

	.mobile-nav-secondary a {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.mobile-nav-group:last-child a:last-child {
		border-bottom: none;
	}

	.mobile-nav-menu a[aria-current='page'] {
		font-weight: 700;
		color: var(--hydra-text);
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
