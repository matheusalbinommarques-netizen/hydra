---
name: hydra-sync-delivery
description: Atualiza a documentação de acompanhamento do Hydra (backlog do ciclo, PROJECT_STATUS.md, CHANGELOG.md, TASKS.md) para refletir um item já commitado. Uso explícito apenas via /hydra-sync-delivery.
disable-model-invocation: true
context: fork
argument-hint: <item-id> <commit-hash>
arguments:
  - item
  - commit
allowed-tools: Read, Grep, Glob, Edit, Bash(node .claude/scripts/hydra-state.mjs:*), Bash(git show:*), Bash(git merge-base:*), Bash(git branch --contains:*)
---

Sincroniza a documentação de acompanhamento com o item `$item` (ex.: `C3-02`),
já entregue no commit `$commit` (ex.: `784dd34`). Se qualquer um dos dois
argumentos faltar, pare e peça o que falta — não adivinhe item nem hash.

Este comando só documenta. Não toca em nenhum arquivo de código, não faz
`git add`, `git commit` ou `git push` — quem publica é `/hydra-ship`.

## 1. Verificações — pare se qualquer uma falhar

- `$commit` precisa existir: `git show --stat --oneline $commit`;
- `$commit` precisa estar em `main`: `git merge-base --is-ancestor $commit main`;
- `$commit` precisa estar em `origin/main`: `git merge-base --is-ancestor $commit
  origin/main`;
- `$item` precisa existir no backlog vigente:
  ```
  node .claude/scripts/hydra-state.mjs --item $item --format json
  ```
  (o script já localiza o ciclo vigente sozinho — não repita essa lógica
  na mão.)

## 2. Ler as evidências sem carregar o diff inteiro

Comece só com visão geral, nunca com o diff completo de cara:

```
git show --stat --oneline $commit
git show --name-status --format=fuller $commit
```

Isso já mostra quais arquivos mudaram, o tipo de mudança (A/M/D) e o autor/
data completos. Leia o conteúdo de um arquivo específico (`Read`, ou
`git show $commit -- <arquivo>` se precisar do diff pontual daquele arquivo) só
quando precisar confirmar um detalhe que a lista de arquivos não responde —
nunca rode `git show $commit` sem `--stat`/`--name-status` como primeiro passo,
isso despeja o diff inteiro à toa. Não presuma nada que não esteja
confirmado desta forma; se o item pedia algo que o commit não mostra ter
sido feito, reporte a lacuna em vez de documentar como concluído.

## 3. Atualizar somente os documentos aplicáveis

- **backlog do ciclo vigente** (o mesmo arquivo que
  `hydra-state.mjs` reportou em `cycle.file`): marque a entrada de `$item` com
  `**Status:** ✅ concluído (commit \`$commit\`)` e liste evidências objetivas
  extraídas do commit (arquivos, testes, rotas) — no mesmo formato já usado
  pelos itens anteriores do mesmo backlog;
- **`PROJECT_STATUS.md`**: reflita `$item` como concluído no resumo de
  progresso do ciclo vigente, preservando o texto histórico já existente
  (adicione/ajuste, não reescreva seções inteiras sem necessidade);
- **`CHANGELOG.md`**: registre o comportamento entregue por `$item` na seção
  apropriada já existente (`[Unreleased]` se essa for a convenção em uso;
  não crie uma versão nova só por este item);
- **`TASKS.md`**: só edite se já existir uma linha de tarefa correspondente
  a `$item` — não crie uma nova entrada apenas para espelhar o backlog.

## 4. O que este comando nunca faz

Não marca `$item` como iniciado nem conclui outro item além de `$item`, mesmo que
pareça relacionado. Não altera `docs/08-delivery/cycle-02-backlog.md` (ou
qualquer backlog de ciclo já encerrado). Não toca `domain/`, `catalog/`,
`orientation-engine/` ou qualquer arquivo em `app/`. Não declara o gate do
ciclo como atendido — isso é uma decisão separada, não uma consequência
automática de sincronizar um item.

## 5. Relatório final

Apresente somente:

- documentos alterados;
- resumo objetivo da atualização em cada documento;
- `git diff --stat`;
- `git diff --name-status`;
- resultado de `git diff --check`;
- `git status --short`;
- lacunas ou divergências encontradas.

Não reproduza o diff completo na resposta. Mostre trechos pontuais somente
quando necessários para justificar uma divergência. Pare para revisão; stage,
commit e push permanecem em etapas separadas.
