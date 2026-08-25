# S8 — Dependency + Milestone + Timeline

**Status:** ✅ concluído — fechado por D042
(`docs/07-management/decision-log.md`) depois de auditoria de fechamento
READ-ONLY. A etapa entregou a camada de precedência, checkpoints e
temporalidade planejada inicial sobre o modelo operacional de `WorkItem`;
o restante de §38 foi reclassificado como DEFER fora da S8, cada um com a
condição semântica que o reabre.

**Origem:** `docs/core/HYDRA_PRODUCT_REWORK.md` §38, sequência canônica do
rework — segue S7 ("Event log incremental", D037).

## Objetivo

Dar ao trabalho já executável (`WorkItem`, ETAPA 6) três estruturas que ele
não tinha: **ordem** (o que vem antes do quê), **checkpoint** (o que
significa ter chegado a algum lugar) e **tempo planejado** (quando a equipe
pretende chegar lá) — sem transformar nenhuma das três em bloqueio,
inferência de progresso ou scheduling.

## Resultado macro

O usuário consegue hoje, ponta a ponta:

- declarar precedência entre dois `WorkItem` do mesmo projeto;
- entender prontidão (`pronto` / `aguardando` / `pendente`) sem que a
  precedência jamais impeça a conclusão;
- ver o impacto downstream de um bloqueio real: quando um predecessor está
  bloqueado por `Impediment` aberto, Acompanhamento nomeia o item
  bloqueado, o impedimento que o bloqueia e quais itens ficam aguardando
  por causa disso;
- declarar marcos, alcançá-los e reabri-los explicitamente;
- relacionar trabalho a marco sem que isso infira o estado do marco em
  nenhuma direção;
- planejar o dia de um marco como intenção declarada;
- acompanhar os marcos datados em ordem cronológica determinística.

`Dependency`, `Milestone` e `Milestone.plannedDate` coexistem sem se
colapsar — precedência ≠ bloqueio ≠ marco —, cada um com fonte de verdade
única em `ProjectState` e consequência visível em superfície já existente.

## Microcortes entregues

| # | Corte | Referência |
|---|---|---|
| 1 | `Dependency` — relação dirigida `WorkItem → WorkItem`, precedência/prontidão planejada, grafo acíclico, sem hard block | **D039** |
| 2 | `Milestone` — checkpoint declarado com lifecycle reversível e relação N:N opcional com `WorkItem`, sem inferir completion | **D040** |
| 3 | Impacto downstream de dependência bloqueada em Acompanhamento | commit `15d86b1` |
| 4 | `Milestone.plannedDate` (data civil opcional) + primeira "Linha do tempo" cronológica | **D041** |

O detalhamento técnico completo de cada corte — invariantes, constraints,
estratégia de legado, divergências aceitas e achados de dogfood — vive nas
decisões acima e não é replicado aqui.

## Evidência de que a camada funciona ponta a ponta

- Precedência é fato estruturado próprio (`ProjectState.dependencies`),
  não texto: ciclo, auto-referência e par duplicado são recusados no
  domínio e na desserialização, não só na interface.
- Prontidão é sempre derivada na montagem da view, nunca persistida; um
  item concluído deixa de "aguardar" um predecessor aberto sem que a
  precedência não satisfeita desapareça.
- Bloqueio real em predecessor produz consequência explicável a jusante:
  o item bloqueado e os itens que o aguardam aparecem juntos, com o
  impedimento nomeado, em Acompanhamento — origem única, sem duplicar o
  mesmo fato operacional em superfícies concorrentes.
- Estado do marco é sempre declarado: trabalho relacionado aberto não
  impede alcançar, concluir todos os relacionados não alcança, e a
  contagem de relacionados é contexto, nunca percentual ou barra.
- `plannedDate` é ortogonal ao lifecycle: definir, reagendar e limpar não
  mudam `status` nem `reachedAt`, e alcançar/reabrir preservam a data.
- A "Linha do tempo" só existe quando há pelo menos um marco datado, com
  ordenação determinística em três níveis — sem seção vazia, sem
  placeholder de feature futura, sem depender da ordem incidental da
  projeção.
- Bancos anteriores a cada corte abrem normalmente; nenhuma data, marco ou
  dependência é sintetizada a partir de texto legado.

## DEFERs finais

Reclassificados para fora da S8 por D042. Nenhuma arquitetura futura foi
decidida junto — apenas a condição que torna o assunto relevante de novo.

| DEFER | Condição semântica que reabre |
|---|---|
| Roadmap (ordenação/recortes, §38) | existir `Deliverable` canônico com ordenação/priorização próprias; `ScopeItem` não deve ser promovido implicitamente (D035) |
| Sinal "marco próximo com trabalho aberto" | existir política explícita de proximidade **e** uma noção de completude de marco que não dependa de associação deliberadamente não exaustiva |
| Sinal "item sem responsável" | `Responsible` existir como fato canônico |
| `ImpedimentType.dependencia_externa` ↔ `Dependency` (§13.4) | uma espera externa passar a ser fato próprio, e não só classificação de causa de `Impediment` — hoje os dois fatos são distintos e o caso relevante já é representável |
| Escrita legada de `dependencias_trabalho` / `marcos_principais` / `data_alvo_entrega` | rework de Planejamento (§39), dono da superfície; hoje seguem READ-LEGACY, sem autoridade em projeção de execução e sem dual-write canônico |
| Event types de `Dependency` / `Milestone` | histórico demonstrar valor real de uso; a taxonomia fechada de `ProjectEvent` (D037) só se estende por decisão explícita |

## Próximo Stage

S9 ("Estruturação e Planejamento reworkados",
`docs/core/HYDRA_PRODUCT_REWORK.md` §39) — **não iniciado e não
autorizado**. É a etapa semanticamente dona da maior parte dos DEFERs
acima. `docs/core/CURRENT_WORK.json` aponta para `S9` com status
`not_started`: o ponteiro registra qual é o próximo corte, não que ele
começou.
