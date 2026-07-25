---
name: hydra-ship
description: Faz commit do stage já aprovado e envia main para origin, com todas as verificações de segurança do Hydra. Uso explícito apenas via /hydra-ship "mensagem".
disable-model-invocation: true
argument-hint: "<commit message>"
allowed-tools: Read, Bash(git status:*), Bash(git branch --show-current), Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*)
---

Comita o que já está staged e publica em `main`. A mensagem de commit é
`$ARGUMENTS`. Se estiver vazia, pare e peça a mensagem — não invente uma.

Este comando não decide o que deve ser staged — isso já foi feito por
`/hydra-review-item`. `git add`, `git commit` e `git push` não estão
pré-aprovados nas ferramentas desta skill: cada execução deles passa pela
aprovação normal do usuário, mesmo sendo o propósito do comando.

## 1. Verificações — pare imediatamente se qualquer uma falhar

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

## 2. Commit

Só depois que as cinco verificações acima passarem, rode:

```
git commit -m "$ARGUMENTS"
```

Nunca use `git reset`, `git rebase`, `git cherry-pick`, `git branch -D`,
`--force`/`--force-with-lease`, nem crie merge commit. Se o commit falhar
por qualquer motivo (hook, etc.), pare e reporte — não tente contornar.

## 3. Push

```
git push origin main
```

Envie exclusivamente `main`. Nunca `--force`.

## 4. Confirmação final

`git rev-parse HEAD` e `git rev-parse origin/main` devem ser idênticos após
o push. `git status --short` deve voltar vazio.

## 5. Relatório final

Apresente: hash do commit; arquivos incluídos; resultado do push;
`git status --short`; `git log --oneline -5`; confirmação de que HEAD e
`origin/main` coincidem.
