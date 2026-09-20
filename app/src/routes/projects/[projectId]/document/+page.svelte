<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let projectId = $derived(data.view.projectId);
	let isSnapshot = $derived(data.mode === 'snapshot');

	const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
	function formatDate(iso: string): string {
		return dateFormatter.format(new Date(iso));
	}

	let captureDialog: HTMLDialogElement;
	let sheetDialog: HTMLDialogElement;
	let capturing = $state(false);
	let captureError = $state<string | null>(null);
	let captured = $state<number | null>(null);

	function openCapture() {
		captureError = null;
		captureDialog.showModal();
	}

	function closeSheet() {
		if (sheetDialog?.open) sheetDialog.close();
	}
</script>

<svelte:head>
	<title>Documento do projeto</title>
</svelte:head>

{#snippet versionsList()}
	<nav aria-label="Versões do Documento">
		<ul class="versions-list">
			<li>
				<a
					class="version-item"
					class:selected={!isSnapshot}
					href="/projects/{projectId}/document"
					aria-current={!isSnapshot ? 'page' : undefined}
					onclick={closeSheet}
				>
					<span class="version-name">Atual</span>
					<span class="version-meta">Documento vivo</span>
				</a>
			</li>
			{#each data.snapshots as snapshot (snapshot.id)}
				<li>
					<a
						class="version-item"
						class:selected={isSnapshot && data.snapshot?.version === snapshot.version}
						href="/projects/{projectId}/document?v={snapshot.version}"
						aria-current={isSnapshot && data.snapshot?.version === snapshot.version ? 'page' : undefined}
						onclick={closeSheet}
					>
						<span class="version-name">Snapshot v{snapshot.version}</span>
						<span class="version-meta">{formatDate(snapshot.capturedAt)}</span>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	{#if data.snapshots.length === 0}
		<p class="versions-empty">
			Capture uma versão deste Documento para preservar como ele está neste momento.
		</p>
	{/if}
{/snippet}

<h1>Documento do projeto</h1>
<div class="accent-bar" aria-hidden="true"></div>
<p class="subtitle">
	Uma visão consolidada do que você já definiu, da Descoberta à Estruturação.
</p>

<div class="toolbar">
	{#if !isSnapshot}
		<a class="cta button-secondary" href="/projects/{projectId}/now">Continuar em Agora</a>
		<button type="button" class="button-secondary" onclick={openCapture}>Capturar snapshot</button>
	{/if}
	<button type="button" class="button-secondary versions-trigger" onclick={() => sheetDialog.showModal()}>
		Versões ({data.snapshots.length})
	</button>
</div>

{#if captured !== null && !isSnapshot}
	<p class="capture-notice" role="status">Snapshot v{captured} capturado.</p>
{/if}

<div class="layout">
	<div class="reading">
		{#if isSnapshot && data.snapshot}
			<div class="snapshot-banner" role="region" aria-label="Snapshot em leitura">
				<p class="banner-title">
					<span class="badge badge-snapshot">Snapshot v{data.snapshot.version}</span>
					Capturado em {formatDate(data.snapshot.capturedAt)} · somente leitura
				</p>
				{#if data.currentAdvanced}
					<p class="banner-note">O Atual já avançou desde esta versão.</p>
				{/if}
				<a class="button-secondary back-link" href="/projects/{projectId}/document">Voltar para o Atual</a>
			</div>
		{:else}
			<p class="current-label"><span class="badge badge-current">Atual</span> Documento vivo — muda com o projeto</p>
		{/if}

		{#if data.sections.length === 0}
			<div class="empty-state">
				<p class="empty-title">Ainda não há conteúdo consolidado</p>
				<p class="empty-description">
					Este documento será formado automaticamente conforme você for respondendo às atividades da
					jornada, começando pela Descoberta.
				</p>
			</div>
		{:else}
			<article class="document" class:document-snapshot={isSnapshot}>
				{#each data.sections as section, sectionIndex (section.phaseId)}
					{#if sectionIndex > 0}
						<div class="phase-divider" aria-hidden="true"></div>
					{/if}
					<section aria-labelledby={`phase-${section.phaseId}`}>
						<h2 id={`phase-${section.phaseId}`}>
							<span class="phase-number">{sectionIndex + 1}</span> — {section.phaseLabel}
						</h2>
						{#each section.blocks as block, blockIndex (block.activityId)}
							{#if blockIndex > 0}
								<div class="block-divider" aria-hidden="true"></div>
							{/if}
							<div class="block">
								<div class="block-header">
									<h3>{block.heading}</h3>
									{#if block.editable}
										<a
											class="edit-link"
											aria-label={`Editar ${block.heading}`}
											href="/projects/{projectId}/now?activity={block.activityId}&from=summary"
										>
											Editar
										</a>
									{/if}
								</div>
								{#each block.value.split('\n\n') as paragraph, paragraphIndex (paragraphIndex)}
									<p class="value">{paragraph}</p>
								{/each}
								{#if block.chips && block.chips.length > 0}
									<ul class="chip-list">
										{#each block.chips as chip (chip)}
											<li class="chip">{chip}</li>
										{/each}
									</ul>
								{/if}
								{#if block.evidenceItems && block.evidenceItems.length > 0}
									<div class="evidence-block">
										<p class="evidence-heading">Evidências</p>
										<ul class="evidence-list">
											{#each block.evidenceItems as item, itemIndex (itemIndex)}
												<li class="evidence-item">
													<span class="evidence-group">{item.groupLabel}</span>
													<span class="evidence-outcome">{item.outcomeLabel}</span>
													<span class="evidence-learning">"{item.learning}"</span>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/each}
					</section>
				{/each}
			</article>
		{/if}
	</div>

	<aside class="versions-region" aria-label="Versões">
		<h2 class="versions-title">Versões</h2>
		{@render versionsList()}
	</aside>
</div>

<dialog bind:this={captureDialog} aria-labelledby="capture-title" class="confirm-dialog">
	<h2 id="capture-title">Capturar snapshot do Documento?</h2>
	<p>
		Isto preserva o Documento como ele está agora. O snapshot fica registrado como uma versão e não muda
		depois de criado.
	</p>
	{#if captureError}
		<p role="alert" class="dialog-error">{captureError}</p>
	{/if}
	<div class="dialog-actions">
		<button type="button" class="button-secondary" onclick={() => captureDialog.close()} disabled={capturing}>
			Cancelar
		</button>
		<form
			method="POST"
			action="?/captureSnapshot"
			use:enhance={() => {
				capturing = true;
				captureError = null;
				return async ({ result }) => {
					capturing = false;
					if (result.type === 'failure') {
						captureError =
							(result.data as { message?: string } | undefined)?.message ??
							'Não foi possível capturar o snapshot.';
						return;
					}
					if (result.type === 'success') {
						captured = (result.data as { capturedVersion?: number } | undefined)?.capturedVersion ?? null;
					}
					captureDialog.close();
					await invalidateAll();
					await applyAction(result);
				};
			}}
		>
			<button type="submit" disabled={capturing}>{capturing ? 'Capturando…' : 'Confirmar'}</button>
		</form>
	</div>
</dialog>

<dialog bind:this={sheetDialog} aria-labelledby="sheet-title" class="versions-sheet">
	<div class="sheet-header">
		<h2 id="sheet-title">Versões ({data.snapshots.length})</h2>
		<button type="button" class="button-secondary" onclick={closeSheet}>Fechar</button>
	</div>
	{@render versionsList()}
</dialog>

<style>
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}

	.toolbar .cta {
		margin-bottom: 0;
	}

	.versions-trigger {
		display: none;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 800px) 16rem;
		gap: var(--space-6);
		align-items: start;
	}

	.reading {
		min-width: 0;
	}

	.versions-region {
		position: sticky;
		top: var(--space-4);
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		background: var(--hydra-surface);
		padding: var(--space-4);
	}

	.versions-title {
		margin: 0 0 var(--space-3);
		font-size: 1rem;
	}

	.versions-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.version-item {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-height: 44px;
		justify-content: center;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--hydra-border);
		border-radius: 8px;
		text-decoration: none;
	}

	.version-item.selected {
		border-color: var(--hydra-editorial-accent);
		background: var(--hydra-surface-raised);
	}

	.version-name {
		font-weight: 700;
	}

	.version-meta {
		font-size: var(--font-size-caption);
		color: var(--hydra-muted);
	}

	.versions-empty {
		margin: var(--space-3) 0 0;
		font-size: 0.9rem;
		color: var(--hydra-muted);
		line-height: 1.5;
	}

	.badge {
		display: inline-block;
		padding: 0.1rem var(--space-3);
		border-radius: var(--hydra-radius-pill);
		font-size: var(--font-size-caption);
		font-weight: 700;
		border: 1px solid var(--hydra-border);
	}

	.badge-current {
		color: var(--hydra-editorial-accent);
		border-color: var(--hydra-editorial-accent);
	}

	.badge-snapshot {
		background: var(--hydra-text);
		color: var(--hydra-surface);
		border-color: var(--hydra-text);
	}

	.current-label {
		margin: 0 0 var(--space-3);
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.snapshot-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		max-width: 800px;
		margin-bottom: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border: 1px dashed var(--hydra-text);
		border-radius: 12px;
		background: var(--hydra-surface);
	}

	.banner-title,
	.banner-note {
		margin: 0;
	}

	.banner-note {
		flex-basis: 100%;
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.back-link {
		text-decoration: none;
	}

	.document-snapshot {
		border-style: dashed;
	}

	.capture-notice {
		margin: 0 0 var(--space-4);
		color: var(--hydra-editorial-accent);
		font-weight: 600;
	}

	.confirm-dialog,
	.versions-sheet {
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		padding: 1.5rem;
		max-width: 28rem;
		background: var(--hydra-surface-raised);
		color: var(--hydra-text);
	}

	.confirm-dialog::backdrop,
	.versions-sheet::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.confirm-dialog h2 {
		margin: 0 0 0.75rem;
		font-size: 1.05rem;
	}

	.confirm-dialog p {
		margin: 0 0 0.75rem;
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.dialog-error {
		color: var(--hydra-danger, #b3261e);
	}

	.dialog-actions {
		margin-top: 1rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.dialog-actions form {
		display: contents;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.sheet-header h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	@media (max-width: 860px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.versions-region {
			display: none;
		}

		.versions-trigger {
			display: inline-block;
		}

		.versions-sheet {
			position: fixed;
			inset: auto 0 0 0;
			margin: 0;
			width: 100%;
			max-width: none;
			max-height: 70vh;
			overflow: auto;
			border-radius: 12px 12px 0 0;
			box-sizing: border-box;
		}

		.snapshot-banner {
			max-width: none;
		}
	}

	.accent-bar {
		width: 40px;
		height: 3px;
		background: var(--hydra-editorial-accent);
		margin: 0 0 var(--space-4);
	}

	.subtitle {
		color: var(--hydra-muted);
		max-width: 42rem;
		line-height: 1.5;
		margin: 0 0 var(--space-5);
	}

	.cta {
		display: inline-block;
		margin-bottom: var(--space-6);
		text-decoration: none;
	}

	.empty-state {
		max-width: 800px;
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		background: var(--hydra-surface);
		padding: 3rem 2rem;
		text-align: center;
	}

	.empty-title {
		margin: 0 0 var(--space-2);
		font-weight: 700;
		font-size: 1.05rem;
	}

	.empty-description {
		margin: 0 auto;
		max-width: 32rem;
		font-size: 0.95rem;
		color: var(--hydra-muted);
		line-height: 1.55;
	}

	.document {
		max-width: 800px;
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		background: var(--hydra-surface-raised);
		box-shadow: var(--hydra-shadow-raised);
		padding: 2.5rem 3rem;
	}

	.phase-divider {
		border-top: 1px solid rgba(101, 104, 108, 0.35);
		margin: var(--space-6) 0;
	}

	.block-divider {
		border-top: 1px solid rgba(101, 104, 108, 0.2);
		margin: var(--space-5) 0;
	}

	h2 {
		margin: 0 0 var(--space-5);
	}

	.phase-number {
		color: var(--hydra-editorial-accent);
	}

	.block-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}

	.block-header h3 {
		flex: 1 1 auto;
		min-width: 12rem;
		margin: 0;
	}

	.edit-link {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-height: 44px;
		font-size: var(--font-size-meta);
		font-weight: 600;
		white-space: nowrap;
	}

	.value {
		margin: var(--space-2) 0 0;
		line-height: 1.65;
		overflow-wrap: break-word;
	}

	.chip-list {
		list-style: none;
		margin: var(--space-3) 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chip {
		font-size: var(--font-size-caption);
		padding: 0.2rem var(--space-3);
		border-radius: var(--hydra-radius-pill);
		border: 1px solid var(--hydra-border);
		color: var(--hydra-muted);
	}

	.evidence-block {
		margin: var(--space-4) 0 0;
		padding-top: var(--space-3);
		border-top: 1px solid var(--hydra-border);
	}

	.evidence-heading {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-caption);
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.evidence-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.evidence-item {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 0.5rem;
		font-size: var(--font-size-body);
		line-height: 1.55;
	}

	.evidence-group {
		font-weight: 700;
	}

	.evidence-outcome {
		color: var(--hydra-editorial-accent);
		font-weight: 600;
	}

	.evidence-learning {
		color: var(--hydra-muted);
		overflow-wrap: break-word;
	}

	@media (max-width: 860px) {
		.document {
			max-width: none;
			padding: var(--space-5) var(--space-4);
		}

		.empty-state {
			max-width: none;
			padding: var(--space-6) var(--space-4);
		}
	}
</style>
