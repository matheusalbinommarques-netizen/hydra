---
name: hydra-verify
description: Roda a bateria determinística de verificação do Hydra (fast ou full) chamando hydra-verify.mjs. Uso explícito apenas via /hydra-verify.
disable-model-invocation: true
argument-hint: <item-id> <fast|full>
arguments:
  - item
  - mode
allowed-tools: Bash(node .claude/scripts/hydra-verify.mjs:*)
---

Roda a verificação para o item `$item` no modo `$mode`. Os dois argumentos
são obrigatórios. Se `$item` faltar, pare e peça o identificador. Se `$mode`
faltar ou não for exatamente `fast` ou `full`, pare e peça um dos dois — não
adivinhe, não aceite variação (`Fast`, `--full`, etc.).

## 1. Rodar

```
node .claude/scripts/hydra-verify.mjs --mode $mode --item $item
```

## 2. Reportar

Retorne só o que o script já resumiu: etapa por etapa PASS/FAIL, duração e
o resumo final. Não abra os arquivos de log completos por conta própria —
eles existem para quando alguém pedir explicitamente mais detalhe depois
de ver o resumo. Se o script indicar falha, ele já mostra a etapa, o
caminho do log e um trecho relevante do fim do log — reporte exatamente
isso, sem reprocessar.

## 3. O que este comando nunca faz

Não altera nenhum arquivo do projeto — a única escrita em disco é o log
temporário do próprio script, fora do repositório. Não faz stage, commit
ou push. Não decide o que fazer a seguir — só reporta PASS ou FAIL.
