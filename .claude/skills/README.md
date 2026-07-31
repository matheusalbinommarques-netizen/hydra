# Skills do Hydra

Oito comandos (`/hydra-*`) que cobrem a retomada do projeto, a escolha da
próxima fatia do roadmap e o ciclo de entrega de um item até o commit
publicado com código e documentação juntos. Cada `SKILL.md` tem o
detalhe do seu próprio passo — este arquivo é só o mapa, não repete o
conteúdo de cada um.

Responsabilidades comuns a várias skills viraram scripts em
`.claude/scripts/`, para não duplicar lógica nem gastar contexto repetindo
os mesmos comandos em prosa:

- `hydra-state.mjs` — localiza o ciclo vigente e reporta seu estado (usado
  por `hydra-resume`, `hydra-plan-item`, `hydra-implement-item`,
  `hydra-prepare-delivery`);
- `hydra-verify.mjs` — roda a bateria `fast`/`full` de check/testes/build
  e grava o recibo de verificação (`hydra-verification.json`) usado pelo
  seal (usado por `hydra-verify`, `hydra-implement-item`,
  `hydra-review-item`);
- `hydra-delivery-guard.mjs` — sela (`seal`), confirma (`check`) e limpa
  (`clear`) a evidência de que o stage revisado corresponde exatamente ao
  que foi verificado (usado por `hydra-review-item` e `hydra-ship`);
- `hydra-commit-lint.mjs` — valida a mensagem de commit (usado por
  `hydra-ship`).

## Comandos

| Comando | Argumento | Responsabilidade | Altera arquivos? | Faz stage? | Faz commit/push? |
|---|---|---|---|---|---|
| `/hydra-resume` | — | Resume o estado atual (branch, ciclo, itens, gate) | Não | Não | Não |
| `/hydra-next` | — | Propõe a menor fatia funcional da próxima etapa do roadmap ainda não concluída | Não | Não | Não |
| `/hydra-plan-item` | `<item-id>` | Produz o plano de implementação de um item, com nível preliminar | Não | Não | Não |
| `/hydra-implement-item` | `<item-id> [continue]` | Implementa o item (ou corrige defeito de revisão em modo `continue`) | Sim (código/testes) | Não | Não |
| `/hydra-prepare-delivery` | `[<item-id>]` | Prepara CHANGELOG/PROJECT_STATUS/roadmap a partir do diff e, quando há item formal, também sincroniza o backlog | Sim (só documentação) | Não | Não |
| `/hydra-review-item` | `<item-id>` | Revisa código + documentação como um pacote, QA manual isolada, stage seletivo, sela a entrega | Não (só o índice do Git) | Sim | Não |
| `/hydra-verify` | `<item-id> <fast\|full>` | Roda a bateria de verificação isoladamente | Não | Não | Não |
| `/hydra-ship` | `"<mensagem>"` | Comita o stage selado (código + documentação) e envia `main` | Não | Não | Sim |

## Sequência típica

```
/hydra-resume
/hydra-plan-item C5-01
/hydra-implement-item C5-01
/hydra-prepare-delivery C5-01
/hydra-review-item C5-01
/hydra-ship "feat(skip): add skip activity interface"
```

Um único commit por item, contendo código e documentação de
acompanhamento juntos — não existe mais etapa de sincronização documental
depois do commit.

Se `/hydra-review-item` encontrar um defeito:

- de código: `/hydra-implement-item <item> continue` (árvore pode estar
  suja, mas o stage precisa estar vazio antes de continuar);
- só de documentação: `/hydra-prepare-delivery <item>` novamente (a skill
  é idempotente, não duplica entradas).

`/hydra-verify` não aparece nessa sequência porque não é uma etapa fixa —
`hydra-implement-item` e `hydra-review-item` já chamam `hydra-verify.mjs`
internamente nos momentos certos. Rode `/hydra-verify <item> fast` ou
`/hydra-verify <item> full` separadamente sempre que quiser confirmar o
estado da suíte sem passar pelo fluxo completo.

## Níveis de cerimônia

- **Nível 1** — documentação, testes, scripts/skills/tooling interno, sem
  arquivo em `app/` nem mudança de comportamento do produto: verificação
  final `fast`, sem QA visual;
- **Nível 2** — mudança normal de produto, fora das áreas sensíveis do
  Nível 3: verificação final `full`, QA manual obrigatória quando houver
  interface;
- **Nível 3** — mudança sensível (`domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`, schema/migrations,
  contratos arquiteturais, dependências, arquitetura, segurança,
  transformação/migração de dados, comportamento transversal):
  verificação final `full`, QA manual quando aplicável, exige autorização
  explícita já registrada.

`plan-item` estima o nível preliminar, `prepare-delivery` reavalia com o
diff real, `review-item` decide o nível final. Em dúvida, use o mais alto.

## Convenções

- todas usam `disable-model-invocation: true` — só rodam quando chamadas
  explicitamente por `/comando`;
- nenhuma skill declara fork de contexto no frontmatter;
- um commit por item: código e documentação de acompanhamento juntos, sem
  commit documental posterior;
- nenhuma usa `git reset`, `git rebase`, `git cherry-pick`, `git branch -D`,
  force push, `git clean` ou remoção ampla de arquivos;
- só `hydra-ship` comita e envia — as demais explicitamente não;
- nenhuma tem `git commit`/`git push` pré-aprovado em `allowed-tools`,
  mesmo `hydra-ship`: essas ações sempre passam pela aprovação normal do
  usuário;
- `hydra-implement-item <item> continue` existe para corrigir defeito
  encontrado em `/hydra-review-item` sem descartar trabalho já feito.
