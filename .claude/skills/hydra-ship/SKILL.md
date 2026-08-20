---
name: hydra-ship
description: Faz commit do stage já selado e envia main para origin, com trailer Hydra-Item (e Hydra-Cycle quando o item for Cx-y) e todas as verificações de segurança do Hydra. Uso explícito apenas via /hydra-ship "mensagem".
disable-model-invocation: true
argument-hint: "<commit message>"
allowed-tools: Read, Bash(node .claude/scripts/hydra-commit-lint.mjs:*), Bash(node .claude/scripts/hydra-delivery-guard.mjs:*), Bash(node -e:*), Bash(git status:*), Bash(git branch --show-current), Bash(git diff:*), Bash(git log:*), Bash(git rev-parse:*), Bash(git rev-list:*)
---

Comita o que já está staged e selado, e publica em `main`. A mensagem de
commit é `$ARGUMENTS`. Se estiver vazia, pare e peça a mensagem — não
invente uma.

## 1. Validação da mensagem

Rejeite `$ARGUMENTS` sem rodar mais nada se qualquer linha, depois de
remover espaços nas extremidades dessa linha, começar exatamente com
`Hydra-Item:` ou `Hydra-Cycle:`. Os trailers são responsabilidade
exclusiva desta skill (§3) — uma mensagem recebida já contendo esses
trailers é sempre inválida, mesmo que os valores pareçam corretos.

```
node .claude/scripts/hydra-commit-lint.mjs --message "$ARGUMENTS"
```

Se o script sair com código diferente de zero, pare antes de qualquer
`commit` ou `push`, mostre a mensagem de erro exata que ele reportou, e
peça uma mensagem nova — não corrija nem complete a mensagem recebida.

Este comando não decide o que deve ser staged — isso já foi feito e selado
por `/hydra-work`. `git add`, `git commit` e `git push` não estão
pré-aprovados nas ferramentas desta skill: cada execução deles passa pela
aprovação normal do usuário, mesmo sendo o propósito do comando.

## 2. Verificações — pare imediatamente se qualquer uma falhar

1. `git branch --show-current` deve ser `main`. Se não for, pare — não
   troque de branch, não crie branch nova.
2. `git status --short` deve mostrar arquivos staged, sem nenhuma linha
   com mudança não staged (segunda coluna) nem arquivo não rastreado
   (`??`). Se não houver stage, ou houver sobra, pare.
3. `node .claude/scripts/hydra-delivery-guard.mjs check` deve passar — o
   stage precisa corresponder exatamente ao que foi selado por
   `/hydra-work`. Se falhar, pare e reporte; não tente selar você
   mesmo.
4. Leia o seal de forma pontual para obter `item` e `level`:
   ```
   node -e "console.log(require('node:fs').readFileSync(require('node:child_process').execSync('git rev-parse --git-path hydra-delivery-seal.json').toString().trim(), 'utf8'))"
   ```
   ou equivalente — não abra o arquivo por outro caminho manual.
5. Derive o ciclo somente quando o item for `Cx-y` (ex.: `C5-01` → ciclo
   `5`) a partir do prefixo antes do hífen. Itens `Sx`/`Sx[Letra]`
   (ex.: `S7`, `S6V`) e `Rx` (ex.: `R3`) não têm ciclo numérico — não
   derive nem invente um valor (nunca `null`, `0` ou o próprio item) para
   eles.
6. `git diff --cached --stat`, `git diff --cached --name-status` completos,
   mais `git diff --cached --check` (deve retornar limpo).
7. Apresente a lista de arquivos staged e confirme visualmente que faz
   sentido para a mensagem de commit recebida — nenhum arquivo
   inesperado.

## 3. Montar a mensagem final em arquivo temporário

Depois que a mensagem, o seal e as verificações da §2 passarem, monte a
mensagem final: `$ARGUMENTS` sem espaços/quebras excedentes no fim, uma
linha em branco, e o(s) trailer(s) derivados do seal (nunca digitados
pelo usuário). O formato do item decide deterministicamente se
`Hydra-Cycle` existe — a skill não pergunta ao usuário:

Item `Cx-y` (ex.: `C5-01`):

```
<mensagem recebida sem espaços/quebras excedentes no fim>

Hydra-Item: C5-01
Hydra-Cycle: 5
```

Item `Sx`/`Sx[Letra]` ou `Rx` (ex.: `S7`, `S6V`, `R3`) — sem
`Hydra-Cycle`:

```
<mensagem recebida sem espaços/quebras excedentes no fim>

Hydra-Item: S6V
```

Crie esse conteúdo em um arquivo temporário UTF-8 sob `os.tmpdir()` usando
`node -e`. O `node -e` só cria o arquivo e imprime o caminho — ele nunca
executa `git commit`, para não contornar a aprovação normal desse comando.
Não use nenhuma sintaxe de montagem de string específica de um shell
(document aqui-string do Bash, expansão de subcomando, ou equivalente em
PowerShell/`cmd`) — o conteúdo é montado inteiramente dentro do `node -e`,
que funciona igual nos três shells:

```
node -e "
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const subject = process.argv[1];
const item = process.argv[2];
const cycle = process.argv[3] === '' ? null : process.argv[3];
const trailers = cycle === null ? ('Hydra-Item: ' + item) : ('Hydra-Item: ' + item + '\nHydra-Cycle: ' + cycle);
const message = subject.replace(/\s+$/, '') + '\n\n' + trailers + '\n';
const file = path.join(os.tmpdir(), 'hydra-ship-' + Date.now() + '.txt');
fs.writeFileSync(file, message, 'utf8');
console.log(file);
" -- "$ARGUMENTS" "<item do seal>" "<ciclo derivado, ou string vazia se o item não tiver ciclo>"
```

(ajuste a passagem de argumentos ao `node -e` conforme o shell em uso,
mantendo a regra de nunca montar a mensagem por interpolação de shell.)

## 4. Commit

```
git commit -F "<caminho temporário da §3>"
```

`git commit` continua fora de `allowed-tools` pré-aprovados — passa pela
aprovação normal. Nunca use `git reset`, `git rebase`, `git
cherry-pick`, `git branch -D`, `--force`/`--force-with-lease`, nem crie
merge commit.

Depois do `commit`, em qualquer resultado, remova o arquivo temporário da
§3.

Se o `commit` falhar por qualquer motivo (hook, etc.): remova o arquivo
temporário, pare e reporte — não execute `hydra-delivery-guard.mjs clear`,
não tente contornar, não corrija nem repita automaticamente. O seal
permanece intacto, e a tentativa pode ser repetida sem nova revisão depois
que a causa for corrigida.

Se o `commit` passar: remova o arquivo temporário e execute:

```
node .claude/scripts/hydra-delivery-guard.mjs clear
```

Só depois disso avance para o push.

## 5. Push

```
git push origin main
```

Envie exclusivamente `main`. Nunca `--force`.

## 6. Recuperação de push

Quando não existir stage, a árvore estiver limpa, e `HEAD` estiver à
frente de `origin/main` por exatamente um commit (sem seal presente,
porque o `clear` da §4 já rodou):

- defina "assunto recebido" como a primeira linha de `$ARGUMENTS`, com
  espaços nas extremidades removidos;
- valide a mensagem recebida com `hydra-commit-lint.mjs` normalmente;
- confirme igualdade exata entre o assunto recebido e
  `git log -1 --format=%s`;
- confirme que o último commit contém um trailer `Hydra-Item` válido
  (`git log -1 --format=%B`); exija `Hydra-Cycle` também presente e
  válido somente quando o item for `Cx-y` — itens `Sx`/`Rx` não têm
  ciclo, e sua ausência não é motivo para recusar a recuperação;
- confirme, com `git rev-list`, que não há divergência nem commits
  adicionais entre `HEAD` e `origin/main` além desse único commit;
- não crie arquivo temporário — nenhum commit será feito nesta
  recuperação;
- repita somente `git push origin main` — não crie outro commit.

Pare, sem tentar recuperação, quando:

- branch não for `main`;
- não houver seal e a árvore não corresponder ao cenário de recuperação
  acima;
- o seal não corresponder ao stage (`check` falhou);
- a mensagem for inválida;
- houver sobras no stage ou na árvore;
- o repositório estiver atrás ou divergente de `origin/main`;
- a recuperação de push for ambígua por qualquer outro motivo.

## 7. Confirmação final

`git rev-parse HEAD` e `git rev-parse origin/main` devem ser idênticos após
o push. `git status --short` deve voltar vazio.

## 8. Relatório final

Apresente: hash do commit; item do trailer (e ciclo, quando aplicável);
arquivos incluídos; resultado do push; `git status --short`;
`git log --oneline -5`; confirmação de que `HEAD` e `origin/main`
coincidem.
