# Workflow Hydra v2 — desenho técnico

Este documento registra o consenso técnico alcançado sobre a evolução do
fluxo de trabalho do Hydra e o estado real da sua implementação. É
registro de contexto, não item de produto — não recebe ID de ciclo. O
fluxo de entrega de item (§ "Workflow futuro de item") está implementado
por etapas: scripts determinísticos publicados
(`hydra-state.mjs`, `hydra-verify.mjs`, `hydra-commit-lint.mjs`,
`hydra-delivery-guard.mjs`), `/hydra-prepare-delivery` substituindo
`/hydra-sync-delivery`, commit único por item, três níveis de cerimônia e
recuperação segura de push em `/hydra-ship`. O fechamento de ciclo
(§ "Workflow futuro de fechamento de ciclo") continua não implementado —
nenhuma das skills dessa seção existe ainda. Os detalhes de implementação
do fechamento de ciclo — incluindo schemas finais dos artefatos,
`allowed-tools` e tratamento operacional completo de falhas — permanecem
sujeitos ao planejamento dos respectivos itens técnicos futuros.

## Problema que motivou o redesenho

O fechamento do Ciclo 3 revelou dois problemas concretos: redundância
documental (o mesmo fato precisando ser redigido em até quatro
documentos, com um caso real de ambiguidade encontrado e corrigido
durante a revisão cruzada) e dois commits separados por item entregue —
um de código (via `/hydra-review-item` + `/hydra-ship`) e outro de
sincronização documental (via `/hydra-sync-delivery` + `/hydra-ship`
novamente), pagando o checklist completo de verificação de `/hydra-ship`
duas vezes por item.

## Decisões consensuais

- `/hydra-review-item` continua sem permissão para corrigir código —
  defeito encontrado na revisão volta para `/hydra-implement-item`;
- correção documental durante revisão só é trivial se não mudar
  obrigação, permissão, bloqueio, prioridade, decisão ou qualquer campo
  estruturado (data, hash, versão, status, ID);
- ciclo e versão são conceitos independentes — fechar um ciclo não
  implica automaticamente criar uma versão no `CHANGELOG.md`;
- decisão de rodar `full` passa a considerar tanto o plano quanto o diff
  real — nunca só a previsão inicial;
- formato de commit `tipo(escopo): descrição` ou `tipo: descrição`,
  coerente com o padrão já usado em 26 dos 27 commits existentes até a
  data desta decisão, sem lista fechada de tipos ou escopos;
- caminhar para um commit único por item, contendo código e documentação
  juntos, em vez de dois commits separados;
- identificar entregas por trailers na mensagem do commit, não por
  registro manual de hash em documento;
- `/hydra-sync-delivery` é substituído por uma etapa anterior ao commit
  (`/hydra-prepare-delivery`), já que não pode mais depender de um commit
  já existente;
- fechamento de ciclo passa a ter fluxo próprio, separado entre produção
  documental e revisão — mesma lógica de separação autor/revisor já usada
  para itens;
- nenhuma migração retroativa de commits antigos para o novo padrão de
  trailers, e nenhuma reescrita de `main`.

## Workflow futuro de item

```
/hydra-resume
/hydra-plan-item <item>
/hydra-implement-item <item>
/hydra-prepare-delivery <item>
/hydra-review-item <item>
/hydra-ship "<mensagem>"
```

`prepare-delivery` lê o diff ainda não commitado e atualiza somente os
documentos de acompanhamento autorizados, sem aprovar e sem fazer stage —
substitui o atual `hydra-sync-delivery`, que dependia de um commit já
existente. `review-item` passa a revisar código e documentação como um
pacote único, com `full` sempre obrigatório, stage seletivo de tudo, e
geração da evidência do conteúdo aprovado (abaixo). `ship` cria um único
commit por item.

## Workflow futuro de fechamento de ciclo

```
/hydra-verify-cycle <ciclo>
/hydra-close-cycle <ciclo>
/hydra-review-cycle-close <ciclo>
/hydra-ship "<mensagem>"
```

Três etapas, não duas: `verify-cycle` é só mecânica (confirmar Musts,
localizar commits, checar presença em `origin/main`, rodar `full`,
registrar evidência) e não tem permissão de edição nenhuma; `close-cycle`
só produz o conteúdo documental a partir dessa evidência, sem fazer
stage; `review-cycle-close` compara os documentos entre si, confirma que
nenhum arquivo de aplicação foi tocado, corrige só prosa leve, e faz
stage seletivo. A separação existe para que a skill que gera a evidência
mecânica nunca tenha permissão de escrever documentação — reduz a
superfície de erro mesmo custando uma chamada a mais, o que é aceitável
dada a baixa frequência de fechamento de ciclo.

## Evidência de verificação

Vinculada ao conteúdo exato aprovado, não só ao `HEAD` — o mesmo `HEAD`
pode representar árvores de trabalho diferentes se houver edição depois
da verificação. Implementada em duas peças, não uma única evidência:

- `hydra-verify.mjs` grava um recibo (`hydra-verification.json`) com
  `head`, `tree` (via `git write-tree`), `mode` (`fast`/`full`) e
  `verifiedAt` somente quando a verificação termina em PASS, um item foi
  informado (`--item`), existe stage, não há mudanças não staged e não há
  arquivos não rastreados no momento em que a verificação termina — em
  qualquer outro caso (FAIL, sem `--item`, ou árvore com sobra/pendência)
  não há recibo utilizável;
- `hydra-delivery-guard.mjs seal --item <item> --level <nivel>`, chamado
  por `/hydra-review-item` ao final da revisão, confirma que o recibo
  corresponde ao `HEAD`/árvore staged atuais e ao item informado, exige
  `mode: "full"` para nível 2 ou 3, e grava o seal
  (`hydra-delivery-seal.json`) com `item`, `level`, `head`, `tree` e
  `sealedAt`;
- `hydra-delivery-guard.mjs check`, chamado por `/hydra-ship` antes do
  commit, recalcula `HEAD`/árvore e bloqueia se não corresponderem ao
  seal;
- `hydra-delivery-guard.mjs clear` apaga as duas evidências — chamado por
  `/hydra-review-item` em caso de falha depois do stage, e por
  `/hydra-ship` logo após um commit bem-sucedido.

## Identificação de commits

Trailers estruturados na mensagem, anexados automaticamente por
`/hydra-ship` (nunca digitados manualmente, para eliminar risco de erro):

```
Hydra-Item: C4-02
Hydra-Cycle: 4
```

Consultáveis nativamente via `git log --pretty='%(trailers:key=Hydra-Item,valueonly=true)'`,
sem precisar de regex contra o corpo da mensagem.

## Caminho da evidência

`git rev-parse --git-path hydra-verification.json` e
`git rev-parse --git-path hydra-delivery-seal.json` — resolvem
corretamente tanto o caso comum quanto worktrees, sem concatenação manual
de caminho. Os dois arquivos ficam fora da árvore de trabalho e do
índice: não participam de `git write-tree`, não podem ser commitados ou
enviados por push por engano. Cada um é validado por forma (campos e
tipos esperados) e por conteúdo (`head`/`tree`/`item` batendo com o
estado atual) no momento da leitura — sem depender de prazo de validade.

## Recuperação de falha de push

O seal é apagado assim que o commit é criado com sucesso
(`hydra-delivery-guard.mjs clear`, chamado por `/hydra-ship`) — nesse
ponto a garantia de "conteúdo aprovado" já foi cumprida, e o que resta é
só publicar. Se o `commit` falhar, o seal é preservado e a tentativa pode
ser repetida sem nova revisão. Se o `commit` for bem-sucedido mas o
`push` falhar, `/hydra-ship` reconhece esse estado (sem seal, stage
limpo, `HEAD` à frente de `origin/main` pelo commit recém-criado cujo
assunto e trailers batem com o pedido) e repete somente o `push`, sem
exigir nova revisão nem criar outro commit.

## Estado de implementação

1. validação de mensagem em `/hydra-ship` — implementada no Ciclo 3;
2. `/hydra-prepare-delivery` — implementada;
3. evidência via `git write-tree` + `hydra-verification.json` +
   `hydra-delivery-seal.json`, resolvidos por `git rev-parse --git-path`
   — implementada;
4. trailers automáticos `Hydra-Item`/`Hydra-Cycle` — implementada;
5. commit único por item — implementada;
6. `/hydra-verify-cycle`, `/hydra-close-cycle`, `/hydra-review-cycle-close`
   — não implementadas; fechamento de ciclo continua manual.

## Não será feito retroativamente

- reescrita da `main`;
- migração de commits antigos para o padrão de trailers;
- alteração retroativa do commit `3fc5005` (mensagem `"sss"`, registrado
  como lição aprendida no fechamento do Ciclo 3).
