# Skills do Hydra

Sete comandos (`/hydra-*`) que cobrem o ciclo de entrega de um item do
backlog, do estado atual até a documentação sincronizada. Cada `SKILL.md`
tem o detalhe do seu próprio passo — este arquivo é só o mapa, não repete
o conteúdo de cada um.

Duas responsabilidades comuns a várias skills viraram scripts em
`.claude/scripts/`, para não duplicar lógica nem gastar contexto repetindo
os mesmos comandos em prosa:

- `hydra-state.mjs` — localiza o ciclo vigente e reporta seu estado (usado
  por `hydra-resume`, `hydra-plan-item`, `hydra-implement-item`,
  `hydra-sync-delivery`);
- `hydra-verify.mjs` — roda a bateria `fast`/`full` de check/testes/build
  (usado por `hydra-verify`, `hydra-implement-item`, `hydra-review-item`).

## Comandos

| Comando | Argumento | Responsabilidade | Altera arquivos? | Faz stage? | Faz commit/push? |
|---|---|---|---|---|---|
| `/hydra-resume` | — | Resume o estado atual (branch, ciclo, itens, gate) | Não | Não | Não |
| `/hydra-plan-item` | `<item-id>` | Produz o plano de implementação de um item | Não | Não | Não |
| `/hydra-implement-item` | `<item-id>` | Implementa exclusivamente um item | Sim (código/testes) | Não | Não |
| `/hydra-review-item` | `<item-id>` | Revisa diff, faz QA manual isolada, stage seletivo | Não (só o índice do Git) | Sim | Não |
| `/hydra-verify` | `<item-id> <fast\|full>` | Roda a bateria de verificação | Não | Não | Não |
| `/hydra-ship` | `"<mensagem>"` | Comita o stage já aprovado e envia `main` | Não | Não | Sim |
| `/hydra-sync-delivery` | `<item-id> <hash>` | Atualiza backlog/`PROJECT_STATUS.md`/`CHANGELOG.md`/`TASKS.md` | Sim (só documentação) | Não | Não |

## Sequência típica

```
/hydra-resume
/hydra-plan-item C3-03
/hydra-implement-item C3-03
/hydra-review-item C3-03
/hydra-ship "feat(skip): add skip activity interface"
/hydra-sync-delivery C3-03 <hash>
```

`/hydra-verify` não aparece nessa sequência porque não é uma etapa fixa —
`hydra-implement-item` e `hydra-review-item` já chamam `hydra-verify.mjs`
internamente nos momentos certos. Rode `/hydra-verify <item> fast` ou
`/hydra-verify <item> full` separadamente sempre que quiser confirmar o
estado da suíte sem passar pelo fluxo completo (por exemplo, depois de uma
mudança manual, ou só para checar antes de decidir o próximo passo).

## Convenções

- todas usam `disable-model-invocation: true` — só rodam quando chamadas
  explicitamente por `/comando`;
- `hydra-resume`, `hydra-plan-item` e `hydra-verify` usam `context: fork`
  (tarefas predominantemente de leitura/verificação); as outras quatro,
  não;
- nenhuma usa `git reset`, `git rebase`, `git cherry-pick`, `git branch -D`,
  force push, `git clean` ou remoção ampla de arquivos;
- só `hydra-ship` comita e envia — as demais explicitamente não;
- nenhuma tem `git commit`/`git push` pré-aprovado em `allowed-tools`,
  mesmo `hydra-ship`: essas ações sempre passam pela aprovação normal do
  usuário.
