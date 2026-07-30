---
name: hydra-prepare-delivery
description: Prepara a documentação de acompanhamento (backlog, PROJECT_STATUS.md, CHANGELOG.md) de um item do Hydra já implementado mas ainda não commitado, sem aprovar, sem stage e sem commit. Uso explícito apenas via /hydra-prepare-delivery.
disable-model-invocation: true
argument-hint: <item-id>
arguments:
  - item
allowed-tools: Read, Grep, Glob, Edit, Bash(node .claude/scripts/hydra-state.mjs:*), Bash(git status:*), Bash(git diff:*), Bash(git diff --check)
---

Prepara a documentação de acompanhamento do item `$item` (ex.: `C5-01`),
já implementado mas ainda não commitado. Se `$item` não for informado,
pare e peça o identificador — não adivinhe.

Este comando não aprova nada, não faz stage, não comita e não corrige
código. É a etapa que roda entre `/hydra-implement-item` e
`/hydra-review-item`.

## 1. Pré-condições — pare e reporte se qualquer uma falhar

```
node .claude/scripts/hydra-state.mjs --item $item --format json
```

- `branch` é `main`;
- o item existe e pertence ao backlog vigente (o script já garante isso);
- a árvore contém implementação não commitada relacionada a `$item` —
  confirme com `git status --short` e `git diff --stat`; se a árvore
  estiver limpa, pare, não há o que preparar;
- stage vazio, confirmado por `git diff --cached --name-only` — a saída
  precisa ser vazia. Não use a primeira coluna de `git status --short`
  para essa checagem: ela não distingue stage vazio de arquivo `??` (não
  rastreado). Se `git diff --cached --name-only` retornar qualquer linha,
  pare, isso pertence a uma revisão em andamento;
- arquivos não rastreados (`??`) não são staged e podem pertencer
  legitimamente ao item, desde que confirmados como parte do escopo;
- nenhuma mudança na árvore (staged, não staged ou não rastreada)
  evidentemente pertence a outro item — se houver, pare e reporte em vez
  de documentar em cima de escopo misto;
- dependências do item (seção `cycle.dependencies` do JSON) satisfeitas.

Aceite que `item.status` já apareça como `"concluído"` no JSON se isso for
consequência de uma execução anterior desta mesma skill ainda não
commitada — isso não é bloqueio, é o caso idempotente (§6).

## 2. Leitura do diff real, sem carregar tudo de uma vez

```
git status --short
git diff --stat
git diff --name-status
```

Abra o conteúdo de um arquivo ou trecho específico do diff só quando
precisar confirmar um detalhe que a lista não responde. Não carregue o
diff inteiro sem necessidade.

## 3. Reclassificação de nível

A partir do diff real, determine o nível recomendado:

- **Nível 1** — só documentação, testes, scripts/skills/tooling interno,
  sem arquivo de produção em `app/` nem mudança de comportamento;
- **Nível 2** — mudança normal de produto, fora das áreas sensíveis do
  Nível 3;
- **Nível 3** — qualquer arquivo em `domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`, schema/migrations,
  contratos arquiteturais, dependências, arquitetura, segurança,
  transformação/migração de dados, ou comportamento transversal.

Compare com o nível preliminar de `/hydra-plan-item`, se disponível, e
sinalize explicitamente quando o nível real for maior. Nível 3 exige que
uma autorização explícita já exista (no item do backlog ou em decisão
associada) — não invente nem presuma essa aprovação; se não existir, pare
e reporte o bloqueio em vez de prosseguir com a documentação.

## 4. Atualizações — somente os documentos autorizados

1. **Backlog do ciclo vigente** (o arquivo em `cycle.file` do JSON):
   marque a entrada de `$item` com `**Status:** ✅ concluído` e liste
   evidências objetivas e concisas (arquivos, testes, rotas) — sem
   registrar hash de commit manualmente; a identificação futura é pelo
   trailer `Hydra-Item` do commit que `/hydra-ship` vai criar.
2. **`PROJECT_STATUS.md`**: atualize somente o resumo/progresso necessário
   para refletir `$item`, preservando o histórico relevante já existente —
   não reproduza o backlog inteiro.
3. **`CHANGELOG.md`**: registre o comportamento entregue por `$item` em
   `[Unreleased]`, descrevendo o efeito observável — não uma lista interna
   de arquivos. Não crie uma versão nova.

## 5. O que este comando nunca faz

Não toca `domain/`, `catalog/`, `orientation-engine/` ou qualquer arquivo
em `app/`. Não corrige nem reescreve código. Não faz `git add`, `git
commit` ou `git push`. Não aprova nível 3 sem autorização já registrada.
Não substitui `/hydra-review-item`.

## 6. Idempotência

Se esta skill for executada de novo para o mesmo item (por exemplo, depois
de uma correção via `/hydra-implement-item $item continue`), atualize os
registros já preparados em vez de duplicá-los — mesma entrada no backlog,
mesmo bloco de `PROJECT_STATUS.md`, mesma linha de `[Unreleased]` no
`CHANGELOG.md`.

## 7. Relatório final compacto

Apresente:

- documentos alterados;
- nível recomendado e justificativa em uma frase;
- divergência em relação ao nível preliminar de `/hydra-plan-item`, se
  houver;
- resumo de cada atualização (uma ou duas frases por documento);
- `git diff --stat`;
- `git diff --name-status`;
- resultado de `git diff --check`;
- divergências ou bloqueios encontrados.

Não reproduza o diff completo na resposta. Pare aqui — a revisão é
`/hydra-review-item`.
