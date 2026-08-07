<script lang="ts">
	// Widget compartilhado de PlanningItem (C5-01) — dois modos sobre a mesma
	// coleção, nunca duas representações: "build" (Decompor o trabalho —
	// adicionar/renomear/remover, itens como elementos identificáveis, não
	// textarea) e "operate" (Priorizar entregas — nomes somente leitura,
	// reordenação só por ↑/↓, sem drag-and-drop). O componente nunca decide o
	// que persiste: só chama `onchange` com o array já transformado pelas
	// funções puras de domain/planning-items.ts; quem monta o formulário (ver
	// ActivityForm.svelte e now/+page.svelte) decide como isso vira Answer.
	import type { PlanningItem, PlanningItemMoveDirection } from '$lib/domain';
	import { addPlanningItem, commitPlanningItemText, generatePlanningItemId, movePlanningItem, removePlanningItem } from '$lib/domain';

	let {
		items,
		mode,
		onchange
	}: {
		items: PlanningItem[];
		mode: 'build' | 'operate';
		onchange: (items: PlanningItem[]) => void;
	} = $props();

	function handleAdd() {
		onchange(addPlanningItem(items, generatePlanningItemId(), ''));
	}

	function handleInput(id: string, text: string) {
		onchange(items.map((item) => (item.id === id ? { ...item, text } : item)));
	}

	function handleCommit(id: string, text: string) {
		onchange(commitPlanningItemText(items, id, text));
	}

	function handleRemove(id: string) {
		onchange(removePlanningItem(items, id));
	}

	function handleMove(id: string, direction: PlanningItemMoveDirection) {
		onchange(movePlanningItem(items, id, direction));
	}
</script>

<div class="planning-items" role="list" aria-label={mode === 'build' ? 'Partes do trabalho' : 'Ordem de prioridade'}>
	{#each items as item, index (item.id)}
		<div class="planning-item" role="listitem">
			{#if mode === 'build'}
				<span class="planning-item-mark" aria-hidden="true">◇</span>
				<input
					type="text"
					class="planning-item-input"
					value={item.text}
					placeholder="Nome da parte"
					aria-label="Nome da parte {index + 1}"
					oninput={(event) => handleInput(item.id, event.currentTarget.value)}
					onblur={(event) => handleCommit(item.id, event.currentTarget.value)}
				/>
				<button
					type="button"
					class="planning-item-remove"
					onclick={() => handleRemove(item.id)}
					aria-label={`Remover parte "${item.text || 'sem nome'}"`}
				>
					×
				</button>
			{:else}
				<span class="planning-item-mark" aria-hidden="true">{index + 1}</span>
				<span class="planning-item-text">{item.text}</span>
				<div class="planning-item-move">
					<button
						type="button"
						disabled={index === 0}
						onclick={() => handleMove(item.id, 'up')}
						aria-label={`Mover "${item.text}" para cima`}
					>
						↑
					</button>
					<button
						type="button"
						disabled={index === items.length - 1}
						onclick={() => handleMove(item.id, 'down')}
						aria-label={`Mover "${item.text}" para baixo`}
					>
						↓
					</button>
				</div>
			{/if}
		</div>
	{/each}
</div>

{#if mode === 'build'}
	<button type="button" class="planning-item-add" onclick={handleAdd}>
		<span aria-hidden="true">+</span>
		Adicionar parte
	</button>
{:else if items.length > 0}
	<p class="planning-item-hint">A ordem acima é a prioridade.</p>
{/if}

<style>
	.planning-items {
		display: flex;
		flex-direction: column;
	}

	.planning-item {
		display: grid;
		grid-template-columns: 1.75rem minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--hydra-border, #e6dfd0);
	}

	.planning-item-mark {
		font-family: monospace;
		font-size: 0.75rem;
		text-align: center;
		color: var(--hydra-muted, #65686c);
	}

	.planning-item-input {
		font: inherit;
		width: 100%;
		padding: 0.45rem 0.55rem;
		border-radius: 6px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--hydra-text, #151918);
	}

	.planning-item-input:hover {
		border-color: var(--hydra-border, #e6dfd0);
	}

	.planning-item-input:focus-visible {
		outline: 2px solid var(--hydra-accent, #151918);
		outline-offset: 1px;
		background: var(--hydra-surface, #fffdfa);
	}

	.planning-item-text {
		padding: 0.45rem 0.55rem;
		color: var(--hydra-text, #151918);
	}

	.planning-item-remove,
	.planning-item-move button {
		width: 2rem;
		height: 1.9rem;
		border: 1px solid var(--hydra-border, #e2dbcd);
		background: var(--hydra-surface, #fffdfa);
		border-radius: 4px;
		color: var(--hydra-muted, #65686c);
		font-size: 0.9rem;
		line-height: 1;
		cursor: pointer;
	}

	.planning-item-remove:hover {
		border-color: #b5493a;
		color: #b5493a;
	}

	.planning-item-move {
		display: flex;
		gap: 0.4rem;
	}

	.planning-item-move button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.planning-item-move button:not(:disabled):hover {
		border-color: var(--hydra-accent, #151918);
		color: var(--hydra-text, #151918);
	}

	.planning-item-add {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		margin-top: 0.75rem;
		padding: 0.65rem;
		border: 1px dashed var(--hydra-border, #d3cabb);
		background: transparent;
		border-radius: 4px;
		font: inherit;
		font-size: 0.9rem;
		color: var(--hydra-accent, #151918);
		cursor: pointer;
		text-align: left;
	}

	.planning-item-add:hover {
		border-color: var(--hydra-accent, #151918);
	}

	.planning-item-hint {
		margin: 0.9rem 0 0;
		font-size: 0.85rem;
		color: var(--hydra-muted, #65686c);
	}
</style>
