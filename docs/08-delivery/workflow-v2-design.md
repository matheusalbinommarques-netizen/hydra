# Workflow Hydra v2 — desenho técnico não implementado

Este documento registra o consenso técnico já alcançado sobre uma futura
evolução do fluxo de trabalho do Hydra. É registro de contexto, não item
de produto — nenhuma parte deste desenho foi implementada, e nenhuma
skill existente foi alterada além do que já está em produção
(validação de mensagem em `/hydra-ship`, adicionada no fechamento do
Ciclo 3). Não recebe ID de ciclo. Os detalhes de implementação —
incluindo schemas finais dos artefatos, `allowed-tools`, scripts
auxiliares e tratamento operacional completo de falhas — permanecem
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
da verificação. `/hydra-review-item` gera o hash da árvore staged com
`git write-tree` ao final da revisão, e `/hydra-ship` recalcula esse hash
antes de commitar, bloqueando se não corresponder ao aprovado.

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

`git rev-parse --git-path hydra/approved-delivery.json` — resolve
corretamente tanto o caso comum quanto worktrees, sem concatenação manual
de caminho. Fica fora da árvore de trabalho e do índice: não participa de
`git write-tree`, não pode ser commitado ou enviado por push por engano.
Conteúdo mínimo: branch, `HEAD` base, item, ciclo, árvore staged,
timestamp e resultado. Invalidado por comparação de conteúdo (branch,
`HEAD`, árvore, item) no momento da leitura — sem depender de prazo de
validade.

## Recuperação de falha de push

A evidência é apagada assim que o commit é criado com sucesso — nesse
ponto a garantia de "conteúdo aprovado" já foi cumprida, e o que resta é
só publicar. Se o `commit` falhar, a evidência é preservada e a tentativa
pode ser repetida sem nova revisão. Se o `commit` for bem-sucedido mas o
`push` falhar, `/hydra-ship` deve reconhecer esse estado (stage limpo,
`HEAD` à frente de `origin/main` pelo commit recém-criado) e repetir
somente o `push`, sem exigir nova revisão nem criar outro commit.

## Ordem incremental de implementação

1. validação de mensagem em `/hydra-ship` — já implementada no Ciclo 3;
2. `/hydra-prepare-delivery`;
3. evidência via `git write-tree` + armazenamento em
   `git rev-parse --git-path`;
4. trailers automáticos `Hydra-Item`/`Hydra-Cycle`;
5. commit único por item;
6. `/hydra-verify-cycle`, `/hydra-close-cycle`, `/hydra-review-cycle-close`.

## Não será feito retroativamente

- reescrita da `main`;
- migração de commits antigos para o padrão de trailers;
- alteração retroativa do commit `3fc5005` (mensagem `"sss"`, registrado
  como lição aprendida no fechamento do Ciclo 3).
