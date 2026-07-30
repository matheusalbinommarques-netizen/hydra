---
name: hydra-plan-item
description: Produz o plano de implementação de um item do backlog vigente do Hydra (ex. C3-03), sem editar nada. Uso explícito apenas via /hydra-plan-item.
disable-model-invocation: true
argument-hint: <item-id>
arguments:
  - item
allowed-tools: Bash(node .claude/scripts/hydra-state.mjs:*), Read, Grep, Glob
---

Planeja a implementação do item `$item` (ex.: `C3-03`). Se `$item` não for
informado, pare e peça o identificador. Este comando não edita nenhum
arquivo — o plano é para `/hydra-implement-item $item` executar depois.

## 1. Obter os fatos e validar

```
node .claude/scripts/hydra-state.mjs --item $item --format json
```

Se o script sair com código diferente de zero (item inexistente, erro de
leitura), pare e mostre o erro. Se o item existir, confirme a partir do
JSON:

- pertence ao ciclo vigente (é o que o script já garante ao procurar só
  nesse backlog);
- não está com `status: "concluído"` — se já estiver, pare e informe, não
  há o que planejar;
- dependências listadas na seção de dependências do ciclo — se o item
  depender de outro que não esteja concluído, pare e reporte o bloqueio em
  vez de planejar em cima de uma pré-condição que falta.

## 2. Leitura mínima

Leia só o que for necessário para decompor este item específico: o trecho
do backlog já trazido pelo script (`acceite`, `notasTecnicas`), e os
arquivos de contrato/código diretamente relacionados ao que o item vai
tocar (ex.: `docs/06-architecture/contracts.md` para os tipos/DTOs
envolvidos, os arquivos de rota/aplicação vizinhos que servem de padrão).
Não releia o backlog inteiro nem documentos não relacionados.

## 3. Produzir o plano

Estruture a resposta com estas seções:

- **Objetivo** — o que este item entrega, em 1–2 frases;
- **Estado atual** — o que já existe hoje que é relevante (código, tipos,
  rotas vizinhas que servem de padrão);
- **Escopo** — o que entra e o que fica de fora deste item especificamente;
- **Critérios de aceite** — do próprio `acceite` do backlog, sem reescrever
  o sentido;
- **Dependências** — o que precisa estar pronto antes, e se já está;
- **Arquivos prováveis** — criados e alterados, com caminho;
- **Áreas protegidas** — o que este item explicitamente não deve tocar
  (normalmente `domain/`, `catalog/`, `orientation-engine/`, schema/
  migrations, e qualquer arquivo de outro item já commitado);
- **Testes** — que tipo (Vitest puro, Playwright dedicado, etc.) e o que
  cada um deve cobrir;
- **QA** — o que precisa de validação manual, se houver interface;
- **Riscos** — o que pode dar errado ou ficar ambíguo;
- **Ordem sugerida** — passos em sequência, não em paralelo;
- **Condições de parada** — sob quais condições `/hydra-implement-item`
  deveria parar em vez de prosseguir;
- **Nível de cerimônia preliminar** — 1, 2 ou 3, com justificativa em uma
  frase (detalhado na §5).

## 4. Mudança em áreas sensíveis

Diga explicitamente, sim ou não, se este item exige mudança em:
`domain/`, `catalog/`, `orientation-engine/`, `server/persistence/`,
schema/migrations, `docs/06-architecture/contracts.md`. Se a resposta for
sim para qualquer uma, isso deve estar destacado no início do plano, não
enterrado no meio — é o tipo de coisa que pode exigir aprovação explícita
antes de `/hydra-implement-item` prosseguir.

## 5. Nível de cerimônia preliminar

Classifique o item em um dos três níveis, com uma frase de justificativa:

- **Nível 1** — só documentação, testes, scripts/skills/tooling interno,
  sem arquivo de produção em `app/` nem mudança de comportamento do
  produto;
- **Nível 2** — mudança normal de produto (rotas, componentes,
  apresentação, casos de uso, comportamento comum), fora das áreas
  sensíveis do Nível 3;
- **Nível 3** — qualquer mudança em área sensível: `domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`, schema/migrations,
  contratos arquiteturais, dependências, arquitetura, segurança,
  transformação/migração de dados, comportamento transversal. Se a §4
  identificou mudança em qualquer área sensível, o nível preliminar é
  sempre 3.

Liste também, em uma ou duas frases, quais sinais no diff real poderiam
elevar esse nível durante `/hydra-prepare-delivery` ou
`/hydra-review-item` (ex.: o plano previa só UI, mas a implementação
acabou tocando um contrato compartilhado). Este nível é preliminar — o
nível final é decidido depois, com o diff real.

## 6. O que este comando nunca faz

Não cria, edita nem apaga nenhum arquivo do projeto. Não roda testes. Não
faz stage, commit ou push. Não despeja documentos inteiros na resposta —
cite o trecho relevante, não o arquivo completo.
