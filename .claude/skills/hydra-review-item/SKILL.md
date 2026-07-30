---
name: hydra-review-item
description: Revisa exclusivamente um item já implementado e documentado do Hydra (ex. C3-03) — código e documentação como um único pacote — faz stage seletivo, QA manual isolada e sela a entrega. Uso explícito apenas via /hydra-review-item.
disable-model-invocation: true
argument-hint: <item-id>
arguments:
  - item
allowed-tools: Read, Grep, Glob, Bash(node .claude/scripts/hydra-state.mjs:*), Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git restore --staged:*), Bash(node -e:*), Bash(node .claude/scripts/hydra-verify.mjs:*), Bash(node .claude/scripts/hydra-delivery-guard.mjs:*), mcp__Claude_Browser__preview_start, mcp__Claude_Browser__navigate, mcp__Claude_Browser__computer, mcp__Claude_Browser__read_page, mcp__Claude_Browser__get_page_text, mcp__Claude_Browser__read_console_messages, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__preview_stop
---

Revisa a implementação e a documentação já preparadas para o item `$item`
(ex.: `C3-02`). Se `$item` não for informado, pare e peça o identificador.
Este comando não implementa nem corrige código, e não reescreve
documentação — se encontrar um defeito, pare e reporte, sem corrigi-lo.
Código volta para `/hydra-implement-item $item continue`; documentação
volta para `/hydra-prepare-delivery $item`.

Código, testes e documentação de acompanhamento são revisados e staged
como um único pacote — não existe mais commit documental separado.

## 1. Estado, item e stage inicial

```
node .claude/scripts/hydra-state.mjs --item $item --format json
```

A partir da saída, confirme:

- `branch` é `main`;
- o item existe e pertence ao backlog vigente (o script já garante isso);
- as dependências do item (`cycle.dependencies`) estão satisfeitas;
- `item.status` pode aparecer como `"concluído"` quando isso vier da
  documentação não commitada preparada por `/hydra-prepare-delivery` para
  o mesmo pacote — não trate isso como bloqueio.

Não releia o backlog inteiro se o JSON já trouxer a informação necessária.

Confirme também que o stage inicial está vazio com
`git diff --cached --name-only` — a saída precisa ser vazia. Não use a
primeira coluna de `git status --short` para essa checagem: ela não
distingue stage vazio de arquivo `??` (não rastreado). Se já houver
qualquer conteúdo staged, pare: a revisão não pode assumir nem limpar um
stage preexistente.

## 2. Inspeção de status/diff e confirmação da documentação preparada

- `git status --short` para ver modificados e não rastreados;
- `git diff --stat` e `git diff --name-status` primeiro; `git diff`
  completo ou trechos pontuais só quando necessário;
- confirme que a documentação de entrega foi preparada: a árvore pendente
  deve conter, além do código, as atualizações esperadas de
  `/hydra-prepare-delivery` (backlog do ciclo, e conforme o caso
  `PROJECT_STATUS.md`, `CHANGELOG.md`, `TASKS.md`) — se faltar, pare e
  aponte para `/hydra-prepare-delivery $item` antes de revisar.

## 3. Confirmação de escopo único

Toda mudança pendente — staged (não deveria haver nenhuma depois da §1),
não staged e não rastreada — precisa pertencer a `$item`. Se existir
qualquer mudança tracked ou untracked que:

- pertença a outro item;
- seja artefato de build, banco ou arquivo temporário;
- não possa ser confirmada com segurança como parte de `$item`;

pare antes de qualquer stage e reporte o bloqueio. Não instrua deixar essa
mudança "apenas fora do stage" — a revisão só prossegue quando toda a
árvore pendente pertence ao mesmo pacote, porque `hydra-verify`,
`hydra-delivery-guard` e `/hydra-ship` exigem ausência total de sobras
(nenhum arquivo não rastreado, nenhuma mudança não staged) no momento do
seal e do commit.

## 4. Nível final e autorização

Decida o nível final (1, 2 ou 3) a partir do diff real, considerando o
nível preliminar de `/hydra-plan-item` e a reclassificação de
`/hydra-prepare-delivery`. Em dúvida, use o nível mais alto. Nível 3
exige autorização explícita já registrada no item ou em decisão associada
— se não houver, pare e reporte o bloqueio, não prossiga com o stage.

## 5. Stage seletivo de todo o pacote

`git add` de todo o pacote do item — código, testes e documentação de
acompanhamento juntos — conferindo contra a lista de arquivos esperados
na entrada do item no backlog, se houver uma. Nenhum arquivo de outro
item, nenhum artefato de build, banco ou diretório temporário (a §3 já
deveria ter bloqueado a revisão se algo assim existisse).

## 6. Confirmação de stage completo

- existe stage (`git diff --cached --name-only` não vazio);
- `git status --short` não mostra mudança não staged nem arquivo não
  rastreado;
- `git diff --cached --check` retorna limpo.

Se qualquer uma falhar, pare e reporte antes de prosseguir para a
verificação.

## 7. Verificação final (exatamente uma)

- nível 1: `node .claude/scripts/hydra-verify.mjs --mode fast --item $item`
- nível 2 ou 3: `node .claude/scripts/hydra-verify.mjs --mode full --item $item`

Não rode `fast` antes do `full` "só para conferir" — uma única verificação
final, no modo que o nível exige.

## 8. QA manual (somente nível 2 ou 3 com interface)

Nunca use `local-data/hydra-dev.sqlite` nem a porta de um servidor de
desenvolvimento que já esteja rodando (`npm run dev`) — se um já estiver
ativo, não o toque. Qualquer banco temporário fica sob o diretório
temporário do sistema operacional (`os.tmpdir()` do Node), nunca dentro
do repositório.

A QA usa o build que a verificação `full` da §7 acabou de gerar — não
rode `npm run build` nem qualquer build separado só para QA.

1. suba o build standalone via Node puro, nunca com a sintaxe de shell
   `VAR=valor comando` (só funciona em Bash/POSIX — quebra em PowerShell e
   `cmd`). Use `node -e` com `child_process.spawn`, passando `PORT`,
   `HOST`, `ORIGIN` e `DATABASE_PATH` pelo objeto `env` do processo filho:
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
   depois — ver §9);
2. valide pela rota real no navegador: fluxo principal, estados vazios,
   responsividade em ~1280px e ~390px (sem overflow horizontal), ausência
   de erros no console, e que nenhum controle fora do escopo do item ficou
   editável sem querer.

## 9. Limpeza do processo e diretório temporário de QA

Encerre só o processo e remova só o diretório temporário que **você**
criou na §8 — nunca um processo ou arquivo que já existia antes. Isso
normalmente pede confirmação de permissão (encerrar processo, apagar
diretório); é esperado responder a esse pedido, não pré-aprovar essa etapa
com um comando amplo em `allowed-tools`.

## 10. Selar a entrega

Só depois que a verificação final da §7 passar e a QA da §8 tiver sido
aprovada, quando aplicável:

```
node .claude/scripts/hydra-delivery-guard.mjs seal --item $item --level <nivel>
```

## 11. Confirmar o seal

```
node .claude/scripts/hydra-delivery-guard.mjs check
```

## 12. Falha depois do stage

Se a verificação (§7), a QA (§8) ou o seal (§10/§11) falhar depois que
algo já foi staged na §5:

1. `node .claude/scripts/hydra-delivery-guard.mjs clear`;
2. retire do stage somente os arquivos que esta própria revisão adicionou
   na §5, usando `git restore --staged -- <lista explícita>` — nunca um
   comando amplo;
3. preserve integralmente a working tree — não descarte nada;
4. reporte o defeito e indique o comando de retorno correto:
   - correção de código volta para `/hydra-implement-item $item continue`;
   - correção exclusivamente documental volta para
     `/hydra-prepare-delivery $item`.

## 13. O que este comando nunca faz

Não implementa nem corrige código. Não reescreve documentação — defeito
documental relevante volta para `/hydra-prepare-delivery` ou
`/hydra-implement-item $item continue`, conforme a origem. Não faz `git
commit` nem `git push` — isso pertence a `/hydra-ship`.

## 14. Relatório final

Apresente somente:

- nível final e justificativa;
- resultado da inspeção de escopo;
- resultado da QA manual, quando aplicável;
- arquivos staged;
- `git diff --cached --stat`;
- `git diff --cached --name-status`;
- resultado de `git diff --cached --check`;
- resultado da verificação final (`fast` ou `full`, conforme o nível);
- resultado do `seal` e do `check`;
- confirmação de ausência de sobras (nenhum banco real, processo
  preexistente ou arquivo fora do item alterado);
- problemas encontrados, com arquivo e localização.

Não reproduza o diff completo na resposta. Mostre trechos pontuais somente
quando necessários para explicar um problema.
