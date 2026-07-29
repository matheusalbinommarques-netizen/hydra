---
name: hydra-implement-item
description: Implementa exclusivamente um item do backlog vigente do Hydra (ex. C3-03), sem stage, commit, push ou atualização documental. Uso explícito apenas via /hydra-implement-item.
disable-model-invocation: true
argument-hint: <item-id>
arguments:
  - item
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(node .claude/scripts/hydra-state.mjs:*), Bash(node .claude/scripts/hydra-verify.mjs:*)
---

Implementa um único item do backlog do Hydra, identificado por `$item` (ex.:
`C3-03`). Se `$item` não for informado, pare e peça o identificador — não
adivinhe qual item implementar.

Este comando cobre só a implementação. Stage, commit, push e atualização de
`CHANGELOG.md`/`PROJECT_STATUS.md`/`TASKS.md`/backlog ficam para
`/hydra-review-item` e `/hydra-sync-delivery`. Não invoque essas skills por
`/comando` internamente — chame os scripts diretamente, como abaixo.

## 1. Pré-condições — pare e reporte se qualquer uma falhar

```
node .claude/scripts/hydra-state.mjs --item $item --format json
```

O script já reporta branch, HEAD, `origin/main`, árvore e o item. A partir
da saída, confirme:

- `branch` é `main`;
- `clean` é `true` (árvore limpa) — se não for, pare, não implemente em
  cima de mudanças de outra tarefa;
- o item existe (se o script sair com código diferente de zero por item
  não encontrado, pare);
- `item.status` não é `"concluído"` — se já estiver, pare, já está feito;
- as dependências do item (seção `cycle.dependencies` do JSON) estão
  satisfeitas — se `$item` depender de outro item ainda não concluído, pare e
  reporte o bloqueio;
- a decomposição técnica do item (`item.notasTecnicas`) não pede alteração
  em `domain/`, `catalog/`, `orientation-engine/`, schema ou migrations
  sem que o texto do item autorize isso explicitamente — se pedir, pare e
  reporte a incompatibilidade em vez de implementar.

## 2. Leitura mínima necessária

Leia só o que o item exige: o que o script já trouxe (`acceite`,
`notasTecnicas`), `CLAUDE.md` (trate como regra vigente, não copie o
conteúdo), `docs/06-architecture/contracts.md` para os tipos/DTOs
envolvidos, e os arquivos de produção que o item vai tocar. Não releia o
repositório inteiro.

## 3. Implementação

- implemente exclusivamente o que a entrada do item descreve — nada de
  itens vizinhos, refino visual fora de escopo, ou abstrações não pedidas;
- preserve as áreas que o backlog marca como protegidas para este ciclo
  (tipicamente `domain/`, `catalog/`, `orientation-engine/`, schema/
  migrations, e qualquer arquivo de outro item já concluído, como testes
  de jornada canônicos existentes);
- siga os padrões já estabelecidos no código vizinho (DTOs discriminados,
  projeções puras, fronteira `ProjectView` nunca expondo `ProjectState`
  bruto) em vez de inventar convenções novas;
- rode verificações rápidas durante o trabalho quando fizer sentido, sem
  esperar terminar tudo para descobrir um erro:
  ```
  node .claude/scripts/hydra-verify.mjs --mode fast --item $item
  ```

## 4. Verificação final

Ao considerar a implementação pronta, rode a verificação rápida final:

```
node .claude/scripts/hydra-verify.mjs --mode fast --item $item
```

Se falhar, volte à implementação — não prossiga para o relatório com uma
verificação falhando.

## 5. O que este comando nunca faz

Não roda `git add`, `git commit` ou `git push`. Não edita
`CHANGELOG.md`, `PROJECT_STATUS.md`, `TASKS.md` ou o backlog. Não inicia
nenhum outro item do backlog, mesmo que pareça relacionado.

## 6. Relatório final

Apresente: item implementado; arquivos criados/alterados; decisões de
implementação relevantes; resultado de `hydra-verify.mjs --mode fast`;
riscos ou limitações. Pare aqui — a revisão é `/hydra-review-item`.
