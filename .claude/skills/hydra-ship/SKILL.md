---
name: hydra-ship
description: Faz commit do stage já aprovado e envia main para origin, com todas as verificações de segurança do Hydra. Uso explícito apenas via /hydra-ship "mensagem".
disable-model-invocation: true
argument-hint: "<commit message>"
allowed-tools: Read, Bash(git status:*), Bash(git branch --show-current), Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*)
---

Comita o que já está staged e publica em `main`. A mensagem de commit é
`$ARGUMENTS`. Se estiver vazia, pare e peça a mensagem — não invente uma.

## 1. Validação da mensagem — pare e peça uma mensagem nova se qualquer regra falhar

### Assunto

O assunto é somente a primeira linha de `$ARGUMENTS`, após remover espaços
nas extremidades. Linhas seguintes são corpo opcional e não entram em
nenhuma das validações abaixo.

O assunto precisa estar integralmente em uma destas formas:
```
tipo: descrição
tipo(escopo): descrição
```
Tipos e escopos permanecem livres, sem lista fechada.

- `tipo` não pode ser vazio nem conter espaço, `:`, `(` ou `)`;
- quando existir, `escopo` não pode ser vazio nem conter `:`, `(`, `)` ou
  quebra de linha;
- o `:` que separa o prefixo (`tipo` ou `tipo(escopo)`) da `descrição` é o
  primeiro `:` estrutural — o que vem imediatamente depois de `tipo` (sem
  parênteses) ou imediatamente depois do `)` de fechamento do escopo. Não
  use "o primeiro `:` da mensagem" sem antes validar essa estrutura — a
  `descrição` pode conter outros `:` livremente depois desse ponto (ex.:
  `fix(api): update scheduled time from 10:00 to 10:30` é válida: prefixo
  `fix(api)`, `:` estrutural logo depois, descrição
  `update scheduled time from 10:00 to 10:30`).

### Descrição

Depois de remover espaços nas extremidades da `descrição`:

- tokenize por um ou mais espaços; uma palavra só conta se tiver ao menos
  uma letra ou dígito (tokens só de pontuação não contam);
- precisa haver ao menos 3 palavras nesse sentido;
- precisa haver ao menos 15 caracteres não-espaço no total;
- rejeitar se **todas** as palavras contadas acima, comparadas em
  minúsculas e por igualdade exata (não substring), pertencerem a este
  conjunto: `wip`, `fix`, `update`, `changes`, `test`, `temp`, `todo`,
  `misc`, `stuff`, `asdf`. Ex.: `update misc changes` falha (as três
  palavras são genéricas); `update pending item status` passa
  (`pending`/`item`/`status` não são genéricas, mesmo com `update`
  presente).

### Repetição degenerada

1. normalizar a `descrição` para minúsculas;
2. remover todo caractere que não seja letra ou dígito (espaços,
   pontuação, hífen, etc.);
3. se o que sobrar tiver pelo menos 1 caractere e todos forem idênticos,
   rejeitar (ex.: `a a a a a a a a a a a a a a a` e
   `a-a-a-a-a-a-a-a-a-a-a-a-a-a-a` — os dois viram `aaa...a` e são
   rejeitados).

Não é objetivo desta regra detectar padrões de baixa entropia além de
repetição de um único caractere (ex.: `asdasdasd` não precisa ser pego
aqui).

### Parar

Se qualquer regra acima falhar: pare antes de qualquer `commit` ou `push`;
explique objetivamente qual regra falhou; peça uma mensagem nova; não
corrija nem complete a mensagem recebida.

Este comando não decide o que deve ser staged — isso já foi feito por
`/hydra-review-item`. `git add`, `git commit` e `git push` não estão
pré-aprovados nas ferramentas desta skill: cada execução deles passa pela
aprovação normal do usuário, mesmo sendo o propósito do comando.

## 2. Verificações — pare imediatamente se qualquer uma falhar

1. `git branch --show-current` deve ser `main`. Se não for, pare — não
   troque de branch, não crie branch nova.
2. `git status --short` deve mostrar arquivos staged. Se não houver
   nenhum, pare.
3. Nenhuma linha de `git status --short` pode ter mudança não staged
   (segunda coluna) nem arquivo não rastreado (`??`). Se houver, pare e
   reporte — o stage precisa estar exatamente como `/hydra-review-item`
   deixou, sem sobra.
4. `git diff --cached --stat` e `git diff --cached --name-status`
   completos, mais `git diff --cached --check` (deve retornar limpo).
5. Apresente a lista de arquivos staged e confirme visualmente que faz
   sentido para a mensagem de commit recebida — nenhum arquivo
   inesperado.

## 3. Commit

Só depois que a validação de mensagem e as cinco verificações acima
passarem, rode:

```
git commit -m "$ARGUMENTS"
```

Nunca use `git reset`, `git rebase`, `git cherry-pick`, `git branch -D`,
`--force`/`--force-with-lease`, nem crie merge commit. Se o commit falhar
por qualquer motivo (hook, etc.), pare e reporte — não tente contornar.

## 4. Push

```
git push origin main
```

Envie exclusivamente `main`. Nunca `--force`.

## 5. Confirmação final

`git rev-parse HEAD` e `git rev-parse origin/main` devem ser idênticos após
o push. `git status --short` deve voltar vazio.

## 6. Relatório final

Apresente: hash do commit; arquivos incluídos; resultado do push;
`git status --short`; `git log --oneline -5`; confirmação de que HEAD e
`origin/main` coincidem.
