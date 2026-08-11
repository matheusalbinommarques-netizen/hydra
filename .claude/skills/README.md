# Skills do Hydra

Três comandos (`/hydra-*`) cobrem a retomada do projeto e o ciclo de
entrega de um item até o commit publicado com código e documentação
juntos. Cada `SKILL.md` tem o detalhe do seu próprio passo — este arquivo
é só o mapa, não repete o conteúdo de cada um.

Responsabilidades comuns viraram scripts em `.claude/scripts/`, para não
duplicar lógica nem gastar contexto repetindo os mesmos comandos em prosa:

- `hydra-state.mjs` — localiza o ciclo vigente e reporta seu estado (usado
  por `hydra-resume` e `hydra-work`);
- `hydra-verify.mjs` — roda a bateria `fast`/`full` de check/testes/build
  e grava o recibo de verificação (`hydra-verification.json`) usado pelo
  seal (usado por `hydra-verify` e `hydra-work`);
- `hydra-delivery-guard.mjs` — sela (`seal`), confirma (`check`) e limpa
  (`clear`) a evidência de que o stage corresponde exatamente ao que foi
  verificado (usado por `hydra-work` e `hydra-ship`);
- `hydra-commit-lint.mjs` — valida a mensagem de commit (usado por
  `hydra-ship`).

## Comandos

| Comando | Argumento | Responsabilidade | Altera arquivos? | Faz stage? | Faz commit/push? |
|---|---|---|---|---|---|
| `/hydra-resume` | — | Resume o estado atual (branch, ciclo, itens, gate) | Não | Não | Não |
| `/hydra-work` | `<item-id> [continue]` | Planeja, implementa, verifica, documenta e sela o item numa passagem | Sim (código + documentação) | Sim | Não |
| `/hydra-verify` | `<item-id> <fast\|full>` | Roda a bateria de verificação isoladamente | Não | Não | Não |
| `/hydra-ship` | `"<mensagem>"` | Comita o stage selado (código + documentação) e envia `main` | Não | Não | Sim |

## Sequência típica

```
/hydra-resume
/hydra-work C5-01
/hydra-ship "feat(skip): add skip activity interface"
```

Um único commit por item, contendo código e documentação de acompanhamento
juntos. Se algo falhar durante `/hydra-work` (verificação, QA ou selo),
corrija e continue dentro da mesma skill — use
`/hydra-work <item> continue` para retomar preservando o trabalho já
feito, sem descartar nada.

`/hydra-verify` não aparece na sequência porque não é uma etapa fixa —
`hydra-work` já chama `hydra-verify.mjs` internamente nos momentos certos.
Rode `/hydra-verify <item> fast` ou `/hydra-verify <item> full`
separadamente sempre que quiser confirmar o estado da suíte sem passar
pelo fluxo completo.

## Níveis de cerimônia

- **Nível 1** — documentação, testes, scripts/skills/tooling interno, sem
  arquivo em `app/` nem mudança de comportamento do produto: verificação
  `fast`, sem QA visual;
- **Nível 2** — mudança normal de produto, fora das áreas sensíveis do
  Nível 3: verificação `fast` basta; QA manual rápida só quando houver
  interface visivelmente afetada;
- **Nível 3** — mudança sensível (`domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`, schema/migrations,
  contratos arquiteturais, dependências, arquitetura, segurança,
  transformação/migração de dados, comportamento transversal):
  verificação `full`, QA manual quando aplicável, exige autorização
  explícita já registrada antes de editar.

`hydra-work` classifica o nível a partir do item e do diff real — Nível 3
sempre pausa para autorização antes de continuar. Em dúvida, use o nível
mais alto. `full` também roda antes de `/hydra-ship` quando várias
entregas Nível 1/2 forem publicadas juntas, como checagem de lote.

## Convenções

- todas usam `disable-model-invocation: true` — só rodam quando chamadas
  explicitamente por `/comando`;
- nenhuma skill declara fork de contexto no frontmatter;
- um commit por item: código e documentação de acompanhamento juntos;
- nenhuma usa `git reset`, `git rebase`, `git cherry-pick`, `git branch -D`,
  force push, `git clean` ou remoção ampla de arquivos;
- só `hydra-ship` comita e envia — as demais explicitamente não;
- nenhuma tem `git commit`/`git push` pré-aprovado em `allowed-tools`,
  mesmo `hydra-ship`: essas ações sempre passam pela aprovação normal do
  usuário;
- `hydra-work <item> continue` existe para corrigir um defeito encontrado
  durante a própria verificação/QA/selo, sem descartar trabalho já feito.
