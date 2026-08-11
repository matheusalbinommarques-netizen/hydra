---
name: hydra-work
description: Implementa um item do backlog vigente do Hydra (ex. C3-03) de ponta a ponta — planeja, implementa, verifica, documenta e sela — deixando o pacote pronto para /hydra-ship. Uso explícito apenas via /hydra-work.
disable-model-invocation: true
argument-hint: <item-id> [continue]
arguments:
  - item
  - mode
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(node .claude/scripts/hydra-state.mjs:*), Bash(node .claude/scripts/hydra-verify.mjs:*), Bash(node .claude/scripts/hydra-delivery-guard.mjs:*), Bash(git status:*), Bash(git diff:*), Bash(git diff --cached:*), Bash(git add:*), Bash(git restore --staged:*), Bash(node -e:*), mcp__Claude_Browser__preview_start, mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_page, mcp__Claude_Browser__get_page_text, mcp__Claude_Browser__read_console_messages, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__preview_stop
---

Implementa um único item do backlog vigente, identificado por `$item` (ex.:
`C5-01`), do plano ao stage selado, numa única passagem — sem pausas
intermediárias, exceto quando este documento pedir explicitamente para
parar. Se `$item` não for informado, pare e peça o identificador.

Uso:

```
/hydra-work <item>
/hydra-work <item> continue
```

`$mode` é opcional. Se informado, precisa ser exatamente `continue` (para
retomar depois de corrigir um defeito sem descartar o trabalho já feito).
Qualquer outro valor: pare e peça o correto.

Este comando não comita nem publica — isso é `/hydra-ship`.

## 1. Fatos e pré-condições

```
node .claude/scripts/hydra-state.mjs --item $item --format json
```

Se o script sair com código diferente de zero, pare e mostre o erro. A
partir do JSON, confirme:

- `branch` é `main`;
- o item existe no backlog vigente e não está `"concluído"` (a menos que
  isso venha de uma execução anterior desta mesma skill ainda não
  commitada — caso idempotente, siga em frente);
- dependências do item (`cycle.dependencies`) estão satisfeitas — se não
  estiverem, pare e reporte o bloqueio;
- em modo normal (sem `continue`), a árvore está limpa (`clean: true`) —
  se não estiver, pare, não implemente em cima de mudança de outra tarefa;
- em modo `continue`, o stage precisa estar vazio
  (`git diff --cached --name-only` sem saída — não use a primeira coluna
  de `git status --short`, que não distingue stage vazio de arquivo `??`);
  a árvore pode estar suja, isso é esperado.

## 2. Plano curto (inline, não bloqueante)

Antes de editar, leia só o necessário para decompor este item (`acceite`,
`notasTecnicas` do JSON, contratos/rotas vizinhos que servem de padrão) e
apresente um plano curto: objetivo, arquivos prováveis, e se o item toca
alguma área sensível (`domain/`, `catalog/`, `orientation-engine/`,
`server/persistence/`, schema/migrations, contratos arquiteturais,
dependências).

- **Se não tocar área sensível** (Nível 1 ou 2): siga direto para a
  implementação (§3) na mesma resposta — não espere aprovação do plano.
- **Se tocar área sensível** (Nível 3): pare aqui e peça autorização
  explícita antes de editar qualquer coisa, a menos que essa autorização
  já esteja registrada no próprio item do backlog ou em decisão associada
  em `docs/07-management/decision-log.md`.

## 3. Implementação

- implemente exclusivamente o que a entrada do item descreve (modo normal)
  ou o defeito reportado (modo `continue`) — nada de itens vizinhos,
  refino fora de escopo ou abstrações não pedidas;
- preserve áreas protegidas do ciclo e os padrões já estabelecidos no
  código vizinho (DTOs discriminados, projeções puras, fronteira
  `ProjectView` nunca expondo `ProjectState` bruto);
- em modo `continue`, inspecione `git status --short`, `git diff` e
  `git diff --cached` antes de editar, confirme que toda mudança pendente
  pertence a `$item`, e preserve integralmente o trabalho já existente —
  corrija exclusivamente o defeito;
- rode `node .claude/scripts/hydra-verify.mjs --mode fast --item $item`
  quantas vezes fizer sentido durante o trabalho, sem esperar terminar
  tudo para descobrir um erro.

## 4. Nível final e verificação

Reavalie o nível a partir do diff real (`git diff --stat`,
`git diff --name-status`):

- **Nível 1** — só documentação/testes/tooling interno, sem `app/` nem
  mudança de comportamento;
- **Nível 2** — mudança normal de produto, fora de área sensível;
- **Nível 3** — qualquer arquivo em área sensível (ver §2). Se o plano não
  previa Nível 3 mas o diff real tocou uma dessas áreas, pare e peça
  autorização antes de prosseguir, mesmo que a mudança pareça pequena.

Verificação final, exatamente uma:

- Nível 1 ou 2: `node .claude/scripts/hydra-verify.mjs --mode fast --item $item`
- Nível 3: `node .claude/scripts/hydra-verify.mjs --mode full --item $item`

Se falhar, corrija e rode de novo — não prossiga com verificação falhando.

## 5. QA manual (só Nível 2/3 com interface visivelmente afetada)

Rápida, proporcional ao tamanho da mudança — não repita o fluxo inteiro do
produto por uma alteração pontual. Nunca use `local-data/hydra-dev.sqlite`
nem a porta de um servidor de desenvolvimento já rodando. Banco temporário
sempre sob `os.tmpdir()`, nunca dentro do repositório. Se o nível exigiu
`full`, reaproveite o build gerado — não rode `npm run build` separado.

Valide pela rota real: fluxo principal, ausência de erros no console, sem
overflow horizontal em ~1280px/~390px quando relevante. Encerre processo e
diretório temporário que você mesmo criou ao final.

## 6. Documentação — mínimo necessário

- **Backlog do ciclo vigente**: marque `$item` com
  `**Status:** ✅ concluído` e uma linha de evidência objetiva (arquivos,
  testes, rotas) — sem hash de commit manual, isso vem do trailer
  `Hydra-Item` que `/hydra-ship` cria.
- **`CHANGELOG.md`**: uma linha em `[Unreleased]` descrevendo o efeito
  observável — não uma lista de subcasos nem tour pelos detalhes internos.
- **`PROJECT_STATUS.md`**: só a linha de "próxima decisão", se ela mudou.
- **Roadmap** (`docs/03-product/product-roadmap.md`): só se este item
  completa objetivamente o resultado de uma etapa numerada — nesse caso
  marque a etapa concluída e aponte a próxima; nunca por causa de commit
  ou teste passando. Em dúvida real, não marque — reporte e pare para
  decisão de Matheus.
- **Decision-log**: só se este item é Nível 3 e envolve uma decisão de
  arquitetura/schema/dependência não registrada ainda.

Se esta skill for executada de novo para o mesmo item (ex.: depois de
`continue`), atualize os registros já preparados em vez de duplicá-los.

## 7. Stage e selo

`git add` de todo o pacote do item — código, testes e documentação juntos.
Confirme antes de selar:

- `git diff --cached --name-only` não vazio;
- `git status --short` sem mudança não staged nem arquivo não rastreado;
- `git diff --cached --check` limpo;
- nenhum arquivo de outro item, artefato de build, banco ou temporário.

Depois:

```
node .claude/scripts/hydra-delivery-guard.mjs seal --item $item --level <nivel>
node .claude/scripts/hydra-delivery-guard.mjs check
```

Se a verificação (§4), a QA (§5) ou o selo (§7) falhar depois de algo já
staged: `node .claude/scripts/hydra-delivery-guard.mjs clear`, retire do
stage só o que esta execução adicionou
(`git restore --staged -- <lista explícita>`, nunca um comando amplo),
preserve a working tree, corrija e repita a partir do ponto que falhou.

## 8. O que este comando nunca faz

Não roda `git commit` nem `git push` — isso é `/hydra-ship`. Não inicia
outro item do backlog. Não toca área sensível sem autorização já
registrada. Não reproduz diff completo na resposta.

## 9. Relatório final

Item; nível e justificativa; arquivos criados/alterados; documentos
tocados; resultado da verificação (`fast`/`full`); resultado de QA quando
aplicável; resultado do `seal`/`check`; riscos ou limitações.
