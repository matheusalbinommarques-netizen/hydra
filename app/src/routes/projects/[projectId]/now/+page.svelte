<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import ActivityForm from '$lib/components/ActivityForm.svelte';
	import ComoETratadoHoje from '$lib/components/ComoETratadoHoje.svelte';
	import EntenderCausas from '$lib/components/EntenderCausas.svelte';
	import EntenderSituacao from '$lib/components/EntenderSituacao.svelte';
	import MapaDeImpacto from '$lib/components/MapaDeImpacto.svelte';
	import ResultadoDesejado from '$lib/components/ResultadoDesejado.svelte';
	import SkipActivityConfirm from '$lib/components/SkipActivityConfirm.svelte';
	import type { PhaseProgressGroupKey } from '$lib/phase-progress';

	let { data, form } = $props();
	let view = $derived(data.view);
	// Layout de duas colunas só quando a atividade atual pertence a
	// Descoberta, Definição do produto ou Estruturação — as demais fases
	// continuam sem Bancada, revisadas só quando Acompanhamento/Colheita
	// chegarem lá. A coluna lateral genérica (Progresso da fase) aparece em
	// todas as fases, exceto "Entender a situação" — ver workspace-layout
	// abaixo.
	let isBancadaPhase = $derived(
		data.activity?.phaseId === 'descoberta' ||
			data.activity?.phaseId === 'definicao' ||
			data.activity?.phaseId === 'estruturacao'
	);

	// "Entender a situação" e "Quem é afetado" trazem seu próprio shell (topbar
	// de progresso e, quando aplicável, painel lateral próprio) — sem o
	// Progresso da fase/Bancada genéricos ao lado, a coluna principal ocupa a
	// largura toda (mesmo espírito de .dark-activity em +layout.svelte).
	const OWN_SHELL_ACTIVITY_IDS = new Set(['problema', 'publico', 'estado_atual', 'entender_causas', 'resultado']);
	let hasOwnShell = $derived(OWN_SHELL_ACTIVITY_IDS.has(data.activity?.id ?? ''));

	let openImpedimentsCount = $derived(view.impediments.filter((i) => i.status === 'aberto').length);

	// S9 (reconciliação de dependências legadas) — "Mapear dependências" torna
	// perceptível o estado canônico de Dependency sem projeção nova: cada
	// Dependency aparece exatamente uma vez em WorkItemView.dependsOn (a
	// aresta é vista a partir de quem depende, ver D039) — somar essas
	// listas é o total real de dependências do projeto, sem precisar de
	// ProjectView.dependencies (nunca criada, D039: sem consumidor próprio).
	let dependencyCount = $derived(view.workItems.reduce((total, item) => total + item.dependsOn.length, 0));

	// S9 (reconciliação de marcos legados) — "Definir marcos" torna perceptível
	// o estado canônico de Milestone sem projeção nova: `view.milestones` já
	// existe (Trabalho). Contagem simples de marcos alcançados, nunca
	// percentual/progresso (mesmo cuidado de MilestoneView.relatedConcluded).
	let reachedMilestoneCount = $derived(view.milestones.filter((m) => m.status === 'alcancado').length);

	// S10 (D049, reconciliação de risco legado) — mesmo cuidado de
	// reachedMilestoneCount acima: contagem simples, nunca percentual/progresso.
	let openRiskCount = $derived(view.risks.filter((r) => r.status === 'aberto').length);

	// S11 (ETAPA 11 do rework, "Decision e Change", §41) — mesmo cuidado de
	// openRiskCount acima: contagem simples, nunca percentual/progresso.
	let pendingDecisionCount = $derived(view.decisions.filter((d) => d.status === 'pendente').length);
	let changeCount = $derived(view.changes.length);

	// S9 — `partes_trabalho` é READ-LEGACY (§13.2): "Priorizar entregas" só
	// apresenta o legado somente leitura agora, direto de `data.planningItems`
	// (sem estado local nem reordenação — ver mainContent abaixo).

	// Mesmo vocabulário de ícone já usado pelo Mapa (Concluída/Atual ~
	// em_andamento/Pendente/Pulada) — coerência de linguagem visual entre as
	// duas telas que compartilham a mesma projeção (phase-activities.ts).
	const PHASE_PROGRESS_GROUP_LABEL: Record<PhaseProgressGroupKey, string> = {
		concluidas: 'Concluídas',
		atual: 'Atual',
		pendentes: 'Pendentes',
		puladas: 'Puladas'
	};
	const PHASE_PROGRESS_GROUP_ICON: Record<PhaseProgressGroupKey, string> = {
		concluidas: '●',
		atual: '◐',
		pendentes: '○',
		puladas: '↷'
	};
	let phaseProgressPercent = $derived(
		data.phaseProgress && data.phaseProgress.totalActivities > 0
			? Math.round((data.phaseProgress.resolvedActivities / data.phaseProgress.totalActivities) * 100)
			: 0
	);
</script>

<svelte:head>
	<title>Agora — {view.projectName ?? 'Hydra'}</title>
</svelte:head>

{#snippet mainContent()}
	<h1>Agora</h1>

	{#if view.openPendingItems.length > 0}
		<section class="pendencias" aria-label="Pendências">
			<h2>Pendências</h2>
			<ul>
				{#each view.openPendingItems as item (item.id)}
					<li>
						<strong>{item.label}</strong>
						<p>{item.detail}</p>
						<a href="/projects/{view.projectId}/now?activity={item.activityDefinitionId}">
							Retomar etapa
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if openImpedimentsCount > 0}
		<p class="impediments-indicator">
			{openImpedimentsCount}
			{openImpedimentsCount === 1 ? 'impedimento aberto' : 'impedimentos abertos'} —
			<a href="/projects/{view.projectId}/tracking">ver em Acompanhamento</a>
		</p>
	{/if}

	{#if data.journeyContext && !hasOwnShell}
		<section class="journey-context" aria-label="Onde estamos">
			<p class="journey-label">Onde estamos</p>
			{#if data.journeyContext.kind === 'in_progress'}
				<p class="journey-phase">{data.journeyContext.phaseLabel}</p>
				<p class="journey-position">Fase {data.journeyContext.position} de {data.journeyContext.total}</p>
			{:else}
				<p class="journey-phase">Jornada concluída</p>
				<p class="journey-position">{data.journeyContext.total} de {data.journeyContext.total} fases percorridas</p>
			{/if}
		</section>
	{/if}

	{#if data.activity?.id === 'decompor_trabalho'}
		<section class="next-action">
			<p class="eyebrow">Planejamento</p>
			<h2>{data.activity.title}</h2>
			<p>
				Decompor o trabalho acontece em WorkItem, com identidade e progresso próprios — crie em <a
					href="/projects/{view.projectId}/deliverables">Entregas</a
				>, dentro de uma entrega, ou direto em <a href="/projects/{view.projectId}/work">Trabalho</a
				>.
			</p>
			{#if (data.planningItems ?? []).length > 0}
				<p>As partes registradas aqui antes dessa mudança continuam preservadas, somente leitura:</p>
				<ol class="legacy-planning-list">
					{#each data.planningItems ?? [] as item (item.id)}
						<li>{item.text}</li>
					{/each}
				</ol>
			{/if}

			{#if view.workItems.length > 0}
				<p>Existe(m) {view.workItems.length} item(ns) de trabalho neste projeto.</p>
				<form method="POST" action="?/confirmDecomposition" use:enhance>
					<button type="submit">Confirmar decomposição</button>
				</form>
			{:else}
				<p>Ainda não há nenhum WorkItem neste projeto — crie ao menos um para poder confirmar.</p>
			{/if}

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'priorizar_entregas'}
		<section class="next-action">
			<p class="eyebrow">Planejamento</p>
			<h2>{data.activity.title}</h2>
			<p>
				Priorizar entregas acontece em <a href="/projects/{view.projectId}/deliverables">Entregas</a
				>, pela ordem entre Agora/Depois/Fora.
			</p>
			{#if (data.planningItems ?? []).length > 0}
				<p>A ordem definida aqui antes dessa mudança continua preservada, somente leitura:</p>
				<ol class="legacy-planning-list">
					{#each data.planningItems ?? [] as item (item.id)}
						<li>{item.text}</li>
					{/each}
				</ol>
			{/if}

			{#if view.deliverables.length > 0}
				<p>Existe(m) {view.deliverables.length} entrega(s) neste projeto.</p>
				<form method="POST" action="?/confirmPlanningPriority" use:enhance>
					<button type="submit">Confirmar prioridade</button>
				</form>
			{:else}
				<p>Ainda não há nenhuma entrega (Deliverable) neste projeto — crie e ordene em Entregas para poder confirmar.</p>
			{/if}

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'mapear_dependencias'}
		<section class="next-action">
			<p class="eyebrow">Planejamento</p>
			<h2>{data.activity.title}</h2>
			<p>
				As dependências reais são geridas em <a href="/projects/{view.projectId}/work">Trabalho</a>, como
				relações entre itens de trabalho.
			</p>
			{#if data.dependenciasTrabalho}
				<p>O texto registrado aqui antes dessa mudança continua preservado, somente leitura:</p>
				<p class="legacy-dependencias-text">{data.dependenciasTrabalho}</p>
			{/if}

			<p>
				{#if dependencyCount === 0}
					Não há nenhuma dependência declarada neste projeto.
				{:else}
					{dependencyCount} {dependencyCount === 1 ? 'dependência declarada' : 'dependências declaradas'} neste
					projeto.
				{/if}
			</p>

			<form method="POST" action="?/confirmDependencyMapping" use:enhance>
				<button type="submit">Confirmar revisão das dependências</button>
			</form>

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'definir_marcos'}
		<section class="next-action">
			<p class="eyebrow">Planejamento</p>
			<h2>{data.activity.title}</h2>
			<p>
				Os marcos reais são geridos em <a href="/projects/{view.projectId}/work">Trabalho</a>, como marcos
				declarados da entrega.
			</p>
			{#if data.marcosPrincipais}
				<p>O texto registrado aqui antes dessa mudança continua preservado, somente leitura:</p>
				<p class="legacy-dependencias-text">{data.marcosPrincipais}</p>
			{/if}

			<p>
				{#if view.milestones.length === 0}
					Não há nenhum marco declarado neste projeto.
				{:else}
					{view.milestones.length} {view.milestones.length === 1 ? 'marco declarado' : 'marcos declarados'} neste
					projeto, {reachedMilestoneCount} {reachedMilestoneCount === 1 ? 'alcançado' : 'alcançados'}.
				{/if}
			</p>

			<form method="POST" action="?/confirmMilestoneReview" use:enhance>
				<button type="submit">Confirmar revisão dos marcos</button>
			</form>

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'riscos_projeto'}
		<section class="next-action">
			<p class="eyebrow">Estruturação</p>
			<h2>{data.activity.title}</h2>
			<p>
				Os riscos reais são geridos em <a href="/projects/{view.projectId}/tracking">Acompanhamento</a>, como
				riscos do projeto.
			</p>
			{#if data.riscosIdentificados}
				<p>O texto registrado aqui antes dessa mudança continua preservado, somente leitura:</p>
				<p class="legacy-dependencias-text">{data.riscosIdentificados}</p>
			{/if}
			{#if data.respostaInicialRiscos}
				<p class="legacy-dependencias-text">{data.respostaInicialRiscos}</p>
			{/if}

			<p>
				{#if openRiskCount === 0}
					Não há nenhum risco aberto neste projeto.
				{:else}
					{openRiskCount} {openRiskCount === 1 ? 'risco aberto' : 'riscos abertos'} neste projeto.
				{/if}
			</p>

			<form method="POST" action="?/confirmRiskIdentification" use:enhance>
				<button type="submit">Confirmar revisão dos riscos</button>
			</form>

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'atualizar_riscos'}
		<section class="next-action">
			<p class="eyebrow">Execução</p>
			<h2>{data.activity.title}</h2>
			<p>
				Os riscos reais são geridos em <a href="/projects/{view.projectId}/tracking">Acompanhamento</a>, como
				riscos do projeto.
			</p>
			{#if data.riscosAtualizados}
				<p>O texto registrado aqui antes dessa mudança continua preservado, somente leitura:</p>
				<p class="legacy-dependencias-text">{data.riscosAtualizados}</p>
			{/if}

			<p>
				{#if openRiskCount === 0}
					Não há nenhum risco aberto neste projeto.
				{:else}
					{openRiskCount} {openRiskCount === 1 ? 'risco aberto' : 'riscos abertos'} neste projeto.
				{/if}
			</p>

			<form method="POST" action="?/confirmRiskUpdate" use:enhance>
				<button type="submit">Confirmar revisão dos riscos</button>
			</form>

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'decisoes_mudancas'}
		<section class="next-action">
			<p class="eyebrow">Execução</p>
			<h2>{data.activity.title}</h2>
			<p>
				Decisões e mudanças reais são geridas em <a href="/projects/{view.projectId}/tracking">Acompanhamento</a
				>, como Decisões e Mudanças.
			</p>
			{#if data.decisoesMudancasRecentes}
				<p>O texto registrado aqui antes dessa mudança continua preservado, somente leitura:</p>
				<p class="legacy-dependencias-text">{data.decisoesMudancasRecentes}</p>
			{/if}

			<p>
				{#if pendingDecisionCount === 0}
					Não há nenhuma decisão pendente neste projeto.
				{:else}
					{pendingDecisionCount} {pendingDecisionCount === 1 ? 'decisão pendente' : 'decisões pendentes'} neste
					projeto.
				{/if}
			</p>
			<p>
				{#if changeCount === 0}
					Não há nenhuma mudança registrada neste projeto.
				{:else}
					{changeCount} {changeCount === 1 ? 'mudança registrada' : 'mudanças registradas'} neste projeto.
				{/if}
			</p>

			<form method="POST" action="?/confirmDecisionsAndChangesReview" use:enhance>
				<button type="submit">Confirmar revisão de decisões e mudanças</button>
			</form>

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.activity.allowsSkip}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if data.activity?.id === 'problema' && data.activity.completionMode === 'required_fields'}
		<EntenderSituacao
			activity={data.activity}
			values={form?.values ?? view.answers}
			originAnswer={view.answers['origem']}
			reviewOrigin={data.reviewOrigin ?? undefined}
			phaseProgress={data.phaseProgress}
			projectName={view.projectName}
		/>
	{:else if data.activity?.id === 'publico' && data.activity.completionMode === 'explicit_confirmation'}
		<MapaDeImpacto
			activity={data.activity}
			affectedGroups={view.affectedGroups}
			affectedGroupConfirmationIssues={view.affectedGroupConfirmationIssues}
			externalActions={view.externalActions}
			evidences={view.evidences}
			reviewOrigin={data.reviewOrigin ?? undefined}
			phaseProgress={data.phaseProgress}
			projectName={view.projectName}
			projectId={view.projectId}
			situacaoSynthesis={view.answers['situacao']}
		/>
	{:else if data.activity?.id === 'estado_atual' && data.activity.completionMode === 'explicit_confirmation'}
		<ComoETratadoHoje
			activity={data.activity}
			currentTreatment={view.currentTreatment}
			treatmentSteps={view.treatmentSteps}
			treatmentConfirmationIssues={view.treatmentConfirmationIssues}
			affectedGroups={view.affectedGroups}
			reviewOrigin={data.reviewOrigin ?? undefined}
			phaseProgress={data.phaseProgress}
			projectName={view.projectName}
			projectId={view.projectId}
			situacaoSynthesis={view.answers['situacao']}
		/>
	{:else if data.activity?.id === 'entender_causas' && data.activity.completionMode === 'explicit_confirmation'}
		<EntenderCausas
			activity={data.activity}
			causeExploration={view.causeExploration}
			causeHypotheses={view.causeHypotheses}
			evidences={view.evidences}
			currentTreatment={view.currentTreatment}
			treatmentSteps={view.treatmentSteps}
			reviewOrigin={data.reviewOrigin ?? undefined}
			phaseProgress={data.phaseProgress}
			projectName={view.projectName}
			projectId={view.projectId}
			situacaoSynthesis={view.answers['situacao']}
		/>
	{:else if data.activity?.id === 'resultado' && data.activity.completionMode === 'explicit_confirmation'}
		<ResultadoDesejado
			activity={data.activity}
			desiredOutcomes={view.desiredOutcomes}
			desiredOutcomeConfirmationIssues={view.desiredOutcomeConfirmationIssues}
			reviewOrigin={data.reviewOrigin ?? undefined}
			phaseProgress={data.phaseProgress}
			projectName={view.projectName}
			projectId={view.projectId}
		/>
	{:else if data.activity?.completionMode === 'scope_confirmation'}
		<section class="next-action">
			<p class="eyebrow">Próxima ação recomendada</p>
			<h2>{data.activity.title}</h2>
			<p class="main-question">{data.activity.mainQuestion}</p>
			<p><a href="/projects/{view.projectId}/next-version">Ir para Escolha o próximo foco →</a></p>
		</section>
	{:else if data.activity && data.activity.completionMode === 'required_fields'}
		<section class="next-action">
			<p class="eyebrow">
				{#if data.reviewOrigin === 'summary'}
					Editando a partir do Resumo da descoberta
				{:else if data.reviewOrigin === 'records'}
					Revisando a partir de Registros
				{:else if data.isResuming}
					Retomando etapa pulada
				{:else if data.stepKind === 'optional'}
					Mais contexto (opcional)
				{:else}
					Próxima ação recomendada
				{/if}
			</p>
			<h2>{data.activity.title}</h2>
			<p class="main-question">{data.activity.mainQuestion}</p>
			<p class="why"><strong>Por que isso importa:</strong> {data.activity.why}</p>
			<p class="example"><strong>Exemplo:</strong> {data.activity.example}</p>

			<form
				method="POST"
				action="?/answer"
				use:enhance={() => {
					const wasResuming = data.isResuming;
					return async ({ result, update }) => {
						if (wasResuming && result.type === 'success') {
							// Sai do parâmetro de retomada só quando a resposta teve sucesso —
							// em erro, o usuário permanece na atividade retomada (update()
							// aplica o form.message/values normalmente, sem navegar).
							await goto(`/projects/${view.projectId}/now`, { invalidateAll: true });
							return;
						}
						// Edição a partir de Resumo/Registros: em sucesso a própria
						// action redireciona (303) para a origem (/summary ou
						// /records) — update() já segue esse redirect. Progressão
						// campo a campo: em sucesso a própria action redireciona (303)
						// para o próximo campo/etapa/atividade — update() também já
						// segue esses redirects normalmente. Em erro, permanece nesta
						// tela normalmente em ambos os casos.
						await update();
					};
				}}
			>
				<input type="hidden" name="activityDefinitionId" value={data.activity.id} />
				{#if data.reviewOrigin}
					<input type="hidden" name="returnTo" value={data.reviewOrigin} />
				{/if}
				{#if data.stepKind !== 'full'}
					<input type="hidden" name="_stepKind" value={data.stepKind} />
					<input type="hidden" name="_stepFieldIds" value={data.activity.fields.map((f) => f.id).join(',')} />
				{/if}
				<ActivityForm
					activity={data.activity}
					values={form?.values ?? view.answers}
					fieldSuggestions={view.fieldSuggestions}
				/>
				<button type="submit"
					>{data.reviewOrigin === 'summary'
						? 'Salvar e voltar ao Resumo'
						: data.reviewOrigin === 'records'
							? 'Salvar e voltar a Registros'
							: 'Salvar e continuar'}</button
				>
			</form>

			{#if form?.message}
				<p role="alert">{form.message}</p>
			{/if}

			{#if data.stepKind === 'optional'}
				<p class="skip-optional">
					<a href="/projects/{view.projectId}/now">Avançar sem preencher →</a>
				</p>
			{/if}

			{#if data.activity.allowsSkip && !data.isResuming && !data.reviewOrigin}
				<SkipActivityConfirm activity={data.activity} />
			{/if}
		</section>
	{:else if view.nextActivity.kind === 'catalog_limit_reached'}
		<section class="next-action">
			<h2>Você concluiu todas as atividades disponíveis</h2>
			<p>
				Você percorreu a jornada guiada completa, da Descoberta ao encerramento do projeto. Pendências
				abertas, se houver, continuam visíveis aqui e no Mapa — revise e retome quando quiser.
			</p>
		</section>
	{/if}
{/snippet}

<div class="workspace-layout" class:full-width={hasOwnShell}>
	<div class="workspace-main">
		{@render mainContent()}
	</div>
	{#if !hasOwnShell}
	<aside class="workspace-sidebar" aria-label="Progresso e contexto">
		{#if data.phaseProgress}
			<section class="sidebar-card" aria-label="Progresso da fase">
				<p class="sidebar-card-eyebrow">Progresso da fase</p>
				<p class="phase-progress-label">{data.phaseProgress.phaseLabel}</p>
				<p class="phase-progress-resolved">
					{data.phaseProgress.resolvedActivities} de {data.phaseProgress.totalActivities} atividades resolvidas
				</p>
				<div class="phase-progress-bar" role="presentation">
					<div class="phase-progress-bar-fill" style="width: {phaseProgressPercent}%"></div>
				</div>
				{#each data.phaseProgress.groups as group (group.key)}
					{#if group.activities.length > 0}
						<div class="phase-progress-group">
							<p class="phase-progress-group-label">{PHASE_PROGRESS_GROUP_LABEL[group.key]}</p>
							<ul>
								{#each group.activities as activity (activity.id)}
									<li class="phase-progress-group-item" class:is-current={group.key === 'atual'}>
										<span class="phase-progress-icon" aria-hidden="true">{PHASE_PROGRESS_GROUP_ICON[group.key]}</span>
										<span>{activity.title}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/each}
			</section>
		{/if}

		{#if isBancadaPhase}
			<section class="sidebar-card bancada-panel" aria-label="O que já sabemos até aqui">
				<p class="sidebar-card-eyebrow">O que já sabemos</p>
				{#if data.bancadaOverview.blocks.length > 0}
					<div class="panel-blocks">
						{#each data.bancadaOverview.blocks as block (block.activityId)}
							<section class="panel-block">
								<h3>{block.heading}</h3>
								<p>{block.value}</p>
								{#if block.chips && block.chips.length > 0}
									<ul class="chip-list">
										{#each block.chips as chip (chip)}
											<li class="chip">{chip}</li>
										{/each}
									</ul>
								{/if}
							</section>
						{/each}
					</div>
				{:else}
					<p class="panel-empty">Ainda não há respostas suficientes para mostrar aqui.</p>
				{/if}
			</section>
		{/if}
	</aside>
	{/if}
</div>

<style>
	.pendencias {
		border: 1px solid var(--hydra-warning);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		background: var(--hydra-surface);
		margin-bottom: 1.5rem;
	}

	.pendencias h2 {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		color: var(--hydra-warning);
	}

	.pendencias ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pendencias li p {
		margin: 0.15rem 0 0;
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.pendencias li a {
		font-size: 0.85rem;
		font-weight: 600;
	}

	.impediments-indicator {
		margin: 0 0 1.5rem;
		font-size: 0.9rem;
		color: var(--hydra-muted);
	}

	.journey-context {
		margin: 0 0 1rem;
	}

	.journey-label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.journey-phase {
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.journey-position {
		margin: 0.1rem 0 0;
		font-size: 0.8rem;
		color: var(--hydra-muted);
	}

	.next-action {
		border: 1px solid var(--hydra-accent);
		border-radius: 12px;
		padding: 1.5rem;
		background: var(--hydra-surface-raised);
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-accent);
	}

	.main-question {
		font-size: 1.1rem;
	}

	.why,
	.example {
		color: var(--hydra-muted);
		font-size: 0.9rem;
	}

	.legacy-planning-list {
		margin: 0.75rem 0 0;
		padding-left: 1.5rem;
		color: var(--hydra-muted);
		font-size: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.legacy-dependencias-text {
		margin: 0.75rem 0 0;
		color: var(--hydra-muted);
		font-size: 0.9rem;
		white-space: pre-wrap;
	}

	form {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.skip-optional {
		margin: 0.75rem 0 0;
		font-size: 0.9rem;
	}

	.workspace-layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
		gap: 2rem;
		align-items: start;
	}

	/* "Entender a situação" traz seu próprio painel lateral ("Documento do
	   projeto", dentro de EntenderSituacao.svelte) — sem o Progresso da
	   fase/Bancada genéricos ao lado, a coluna principal ocupa a largura
	   toda. */
	.workspace-layout.full-width {
		grid-template-columns: 1fr;
	}

	.workspace-sidebar {
		position: sticky;
		top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.sidebar-card {
		border: 1px solid var(--hydra-border);
		border-radius: 12px;
		padding: 1.25rem;
		background: var(--hydra-surface);
	}

	.sidebar-card-eyebrow {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.phase-progress-label {
		margin: -0.5rem 0 0.4rem;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.phase-progress-resolved {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.phase-progress-bar {
		height: 6px;
		border-radius: 999px;
		background: var(--hydra-bg);
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.phase-progress-bar-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--hydra-accent);
	}

	.phase-progress-group {
		margin-bottom: 1.1rem;
	}

	.phase-progress-group:last-child {
		margin-bottom: 0;
	}

	.phase-progress-group-label {
		margin: 0 0 0.5rem;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--hydra-muted);
	}

	.phase-progress-group ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.phase-progress-group-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.phase-progress-group-item.is-current {
		font-weight: 700;
		color: var(--hydra-text);
	}

	.phase-progress-icon {
		flex-shrink: 0;
		line-height: 1.4;
	}

	.panel-blocks {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel-block {
		border-bottom: 1px solid var(--hydra-border);
		padding-bottom: 1rem;
	}

	.panel-block:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.panel-block h3 {
		margin: 0 0 0.35rem;
		font-size: 0.85rem;
	}

	.panel-block p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.panel-empty {
		margin: 0;
		font-size: 0.85rem;
		color: var(--hydra-muted);
	}

	.chip-list {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.chip {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--hydra-border);
		background: var(--hydra-surface-raised);
		color: var(--hydra-muted);
	}

	@media (max-width: 860px) {
		.workspace-layout {
			grid-template-columns: 1fr;
		}

		.workspace-sidebar {
			position: static;
		}

		.next-action form button[type='submit'] {
			width: 100%;
		}
	}
</style>
