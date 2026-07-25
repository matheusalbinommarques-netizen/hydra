---
name: hydra-review-item
description: Revisa exclusivamente um item já implementado do Hydra (ex. C3-03) — diff, QA manual isolada e stage seletivo — sem commit ou push. Uso explícito apenas via /hydra-review-item.
disable-model-invocation: true
argument-hint: <item-id>
arguments:
  - item
allowed-tools: Read, Grep, Glob, Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(npm run build:*), Bash(node -e:*), Bash(node .claude/scripts/hydra-verify.mjs:*), mcp__Claude_Browser__preview_start, mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_page, mcp__Claude_Browser__get_page_text, mcp__Claude_Browser__read_console_messages, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__preview_stop
---

Revisa a implementação já feita para o item `$item` (ex.: `C3-02`). Se `$item` não
for informado, pare e peça o identificador. Este comando não implementa nada
novo — se encontrar um defeito que exija mudar código, pare e reporte o
defeito em vez de corrigi-lo; a correção volta para
`/hydra-implement-item $item`.

## 1. Escopo

Revise só o que pertence a `$item`. Ignore mudanças não relacionadas que
porventura estejam na árvore de trabalho — reporte-as sem tocá-las.

## 2. Inspeção do diff

- `git status --short` para ver modificados e não rastreados;
- `git diff` para os arquivos rastreados; leia o conteúdo completo dos
  arquivos novos não rastreados;
- confirme que nada fora do escopo do item foi tocado (ex.: `domain/`,
  `catalog/`, `orientation-engine/`, schema/migrations, ou arquivos de
  outro item já commitado, como jornadas E2E canônicas existentes).

## 3. QA manual (somente quando o item tiver interface)

Nunca use `local-data/hydra-dev.sqlite` nem a porta de um servidor de
desenvolvimento que já esteja rodando (`npm run dev`) — se um já estiver
ativo, não o toque. Qualquer banco temporário fica sob o diretório temporário
do sistema operacional (`os.tmpdir()` do Node), nunca dentro do repositório.

1. `npm run build` em `app/`;
2. suba o build standalone via Node puro, nunca com a sintaxe de shell
   `VAR=valor comando` (só funciona em Bash/POSIX — quebra em PowerShell e
   `cmd`). Use `node -e` com `child_process.spawn`, passando `PORT`,
   `HOST`, `ORIGIN` e `DATABASE_PATH` pelo objeto `env` do processo filho —
   isso funciona igual nos três shells porque a variável nunca passa pela
   sintaxe do shell, só pela API do Node:
   ```js
   node -e "
   const { spawn } = require('node:child_process');
   const port = 4600; // escolha uma porta livre
   const child = spawn('node', ['build/index.js'], {
     cwd: 'app',
     env: {
       ...process.env,
       PORT: String(port),
       HOST: '127.0.0.1',
       ORIGIN: 'http://127.0.0.1:' + port,
       DATABASE_PATH: require('node:path').join(require('node:os').tmpdir(), 'hydra-review-' + Date.now(), 'hydra.sqlite')
     },
     stdio: 'inherit'
   });
   "
   ```
   (ajuste a porta e mantenha o processo rodando enquanto faz a QA; encerre-o
   depois — ver §5);
3. valide pela rota real no navegador: fluxo principal, estados vazios,
   responsividade em ~1280px e ~390px (sem overflow horizontal), ausência
   de erros no console, e que nenhum controle fora do escopo do item ficou
   editável sem querer.

## 4. Stage seletivo

`git add` somente os arquivos que pertencem a `$item` (confira contra a lista
de arquivos esperados na entrada do item no backlog, se houver uma).
Nenhum arquivo de outro item, nenhum artefato de build, banco ou
diretório temporário.

## 5. Limpeza

Encerre só o processo e remova só o diretório temporário que **você**
criou nesta revisão — nunca um processo ou arquivo que já existia antes.
Isso normalmente pede confirmação de permissão (encerrar processo, apagar
diretório); é esperado responder a esse pedido, não pré-aprovar essa etapa
com um comando amplo em `allowed-tools`.

## 6. Bateria final de validações

```
node .claude/scripts/hydra-verify.mjs --mode full --item $item
```

Depois:

```
git diff --cached --check
```

## 7. Relatório final

Apresente: resultado da QA manual (com URL e banco temporário usados);
`git diff --cached --stat`; `git diff --cached` completo; `git status
--short`; confirmação de que nenhum banco real ou processo pré-existente
foi alterado; resultado de `hydra-verify.mjs --mode full`; problemas
encontrados (mesmo que não corrigidos). Não rode `git commit` nem
`git push` — isso é `/hydra-ship`.
