---
name: hydra-implement-item
description: Implementa exclusivamente um item do backlog vigente do Hydra (ex. C3-03), sem stage, commit, push ou atualização documental. Uso explícito apenas via /hydra-implement-item.
disable-model-invocation: true
argument-hint: <item-id> [continue]
arguments:
  - item
  - mode
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(node .claude/scripts/hydra-state.mjs:*), Bash(node .claude/scripts/hydra-verify.mjs:*), Bash(git status:*), Bash(git diff:*), Bash(git diff --cached:*)
---

Implementa um único item do backlog do Hydra, identificado por `$item` (ex.:
`C3-03`). Se `$item` não for informado, pare e peça o identificador — não
adivinhe qual item implementar.

Uso:

```
/hydra-implement-item <item>
/hydra-implement-item <item> continue
```

`$mode` é opcional. Se informado, precisa ser exatamente `continue` — se
vier qualquer outro valor, pare e peça o identificador correto (não
adivinhe, não aceite variação).

Este comando cobre só a implementação. Stage e commit ficam para
`/hydra-review-item` e `/hydra-ship`; a documentação de acompanhamento fica
para `/hydra-prepare-delivery`. Não invoque essas skills por `/comando`
internamente — chame os scripts diretamente, como abaixo.

## 1. Modo normal (`$mode` ausente)

### Pré-condições — pare e reporte se qualquer uma falhar

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

## 2. Modo `continue`

Existe exclusivamente para corrigir um defeito de código encontrado em
`/hydra-review-item`, sem descartar o trabalho já feito.

### Pré-condições — pare e reporte se qualquer uma falhar

- o segundo argumento é exatamente `continue`;
- stage vazio, confirmado por `git diff --cached --name-only` — a saída
  precisa ser vazia. Não use a primeira coluna de `git status --short`
  para essa checagem: ela não distingue stage vazio de arquivo `??`
  (não rastreado). Se `git diff --cached --name-only` retornar qualquer
  linha, pare, isso pertence a uma revisão em andamento que não foi limpa
  corretamente;
- a árvore de trabalho pode estar suja, incluindo arquivos não rastreados
  (`??`) — isso é esperado neste modo, não é motivo de parada por si só;
  arquivos `??` não são staged e podem pertencer legitimamente ao item,
  desde que confirmados como parte do escopo na inspeção abaixo;
- `node .claude/scripts/hydra-state.mjs --item $item --format json` ainda
  precisa encontrar o item no backlog vigente; o item pode aparecer como
  `"concluído"` se isso vier de mudanças documentais do mesmo pacote ainda
  não commitadas (ex.: `/hydra-prepare-delivery` já rodou) — não trate isso
  como bloqueio.

### Inspeção obrigatória antes de editar

```
git status --short
git diff
git diff --cached
```

Confirme que toda mudança pendente pertence a `$item` (código da
implementação anterior, ou documentação já preparada por
`/hydra-prepare-delivery`). Pare e reporte, sem editar nada, se encontrar:

- mudança que evidentemente pertence a outro item;
- artefato inesperado (build, banco, arquivo temporário);
- qualquer escopo que não seja possível confirmar com segurança como parte
  de `$item`.

### Regras do modo `continue`

- preserve integralmente o trabalho já existente do item — não descarte
  nem reverta nada;
- não altere `CHANGELOG.md`, `PROJECT_STATUS.md`, `TASKS.md` ou o backlog
  neste modo, mesmo que já estejam parte do diff não commitado;
- corrija exclusivamente o defeito reportado pela revisão.

## 3. Leitura mínima necessária

Leia só o que o item exige: o que o script já trouxe (`acceite`,
`notasTecnicas`), `CLAUDE.md` (trate como regra vigente, não copie o
conteúdo), `docs/06-architecture/contracts.md` para os tipos/DTOs
envolvidos, e os arquivos de produção que o item vai tocar. Não releia o
repositório inteiro.

## 4. Implementação

- implemente exclusivamente o que a entrada do item descreve (modo normal)
  ou o defeito reportado (modo `continue`) — nada de itens vizinhos,
  refino visual fora de escopo, ou abstrações não pedidas;
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

## 5. Verificação final

Ao considerar a implementação (ou correção) pronta, rode a verificação
rápida final:

```
node .claude/scripts/hydra-verify.mjs --mode fast --item $item
```

Se falhar, volte à implementação — não prossiga para o relatório com uma
verificação falhando.

## 6. O que este comando nunca faz

Não roda `git add`, `git commit` ou `git push`. Não edita
`CHANGELOG.md`, `PROJECT_STATUS.md`, `TASKS.md` ou o backlog (nem em modo
`continue`). Não inicia nenhum outro item do backlog, mesmo que pareça
relacionado.

## 7. Relatório final

Apresente: item implementado; modo (`normal` ou `continue`); arquivos
criados/alterados; decisões de implementação relevantes; resultado de
`hydra-verify.mjs --mode fast`; riscos ou limitações. Pare aqui — a
preparação da documentação é `/hydra-prepare-delivery`, a revisão é
`/hydra-review-item`.
