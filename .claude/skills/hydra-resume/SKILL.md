---
name: hydra-resume
description: Resume o estado atual do Hydra (branch, ciclo vigente, itens, gate, próxima decisão) chamando hydra-state.mjs. Uso explícito apenas via /hydra-resume.
disable-model-invocation: true
allowed-tools: Bash(node .claude/scripts/hydra-state.mjs:*), Read, Grep, Glob
---

Sem argumentos. Resume o estado do projeto para retomar o trabalho.

## 1. Obter os fatos

```
node .claude/scripts/hydra-state.mjs --format json
```

O script já localiza o ciclo vigente, extrai itens/status/gate/próxima
decisão e a seção `Unreleased` do `CHANGELOG.md` — não releia
`PROJECT_STATUS.md`, o backlog ou o `CHANGELOG.md` inteiros por conta
própria só para confirmar algo que o JSON já respondeu. Leia um documento
completo apenas se o script sinalizar uma divergência (`consistentWithProjectStatus:
false`) ou se faltar um dado que você precise e o script não tenha
extraído.

Se o script sair com código diferente de zero, pare e mostre a mensagem de
erro (`stderr`) — não tente adivinhar o estado.

## 2. Resumo a apresentar

- branch atual;
- HEAD e `origin/main` (e se coincidem ou não);
- estado da árvore (limpa ou não — sem julgar se isso é problema, é só um
  fato);
- ciclo vigente e sua meta, em uma frase;
- cada item do ciclo com prioridade e status;
- gate de conclusão (curto — só se está atendido ou o que falta, não o
  texto inteiro);
- próxima decisão relevante;
- qualquer divergência factual encontrada (ex.: `PROJECT_STATUS.md`
  menciona outro número de ciclo, HEAD ≠ `origin/main`).

## 3. O que este comando nunca faz

Não edita nada. Não roda testes. Não faz stage, commit ou push. Não
recomenda qual item começar a seguir — isso é uma decisão do usuário (ou de
`/hydra-plan-item` depois que o usuário escolher).
