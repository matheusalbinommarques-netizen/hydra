# Hydra Engineering Remediation

Status: ACTIVE
Decision: B — manter a arquitetura atual e executar correções cirúrgicas
antes de retomar normalmente o roadmap de produto.

## Why

- Stage 4B expôs custo excessivo de desenvolvimento/hardening antes do
  dogfood.
- Auditoria completa (6 tracks + contra-análise adversarial) não
  encontrou justificativa para rewrite, nova backbone ou troca de
  arquitetura.
- Encontrou problemas concretos e comprovados em: control plane/verdade
  operacional, localização de testes E2E, protocolo de
  desenvolvimento/time-to-dogfood, plumbing mecânico de living objects,
  persistência e reliability de runtime/frontend.
- Objetivo: reduzir time-to-dogfood, rework e change amplification sem
  criar arquitetura preventiva.

## Product baseline

- Stage 4B possui implementação no repo (commit `b0a52f7`).
- O roadmap de produto está temporariamente pausado enquanto os cortes
  de remediação abaixo são concluídos.
- `docs/core/HYDRA_PRODUCT_REWORK.md` continua sendo a autoridade
  semântica do produto.

## Operating invariants

- um corte por vez;
- não reabrir auditoria sem evidência que refute premissa central;
- focused verifier durante implementação;
- full somente em boundary de risco/delivery apropriado;
- não misturar próximo corte por oportunismo;
- preservar arquitetura saudável identificada pela auditoria;
- não fazer rewrite, microservices, generic graph/reference framework,
  CQRS/event sourcing ou abandonar SQLite;
- future risks continuam JIT quando seus gatilhos reais chegarem.

## Remediation cuts

### R1 — Operational truth / control plane — P0

GOAL: uma sessão nova identifica deterministicamente o trabalho atual e
o delivery tooling consegue verificar/selar esse trabalho.

RESULT:
- `CURRENT_WORK.json` como ponteiro operacional;
- `hydra-state` usa o pointer quando presente;
- pointer inválido falha explicitamente (sem fallback silencioso);
- fallback legado por Cycle preservado quando o pointer não existe;
- IDs de Cycle (`Cx-y`), Stage (`Sx`) e Remediation (`Rx`) aceitos por
  `hydra-state`/`hydra-verify`/`hydra-delivery-guard`;
- `HYDRA_PRODUCT_REWORK.md` corretamente indexado como fonte de verdade;
- este arquivo persistido e indexado como source of truth do programa.

STATUS: DONE — commit `5cc653a` (control plane) + commit desta entrega
(persistência do plano e formato `Rx`).

### R2 — E2E localization / change amplification — P0

GOAL: uma mudança semanticamente local não quebra feature journeys que
não testam aquela mudança.

SCOPE:
- GOLDEN journeys continuam ponta-a-ponta;
- FEATURE journeys ganham semantic state setup;
- eliminar counts/ordem duplicados comprovados;
- eliminar selectors ornamentais comprovadamente frágeis;
- centralizar lifecycle repetido de journeys.

PROOF: adicionar/mover activity sintética não exige editar feature
journeys não relacionadas; pelo menos uma feature journey começa perto
do estado semântico que testa.

STATUS: DONE — GOLDEN (walking-skeleton) sem magic counts (deriva do
catálogo real / condições de parada); lifecycle de servidor/DB
centralizado em `e2e/helpers/journey-server.ts` (13 journeys migradas);
semantic setup em `e2e/helpers/db-fixtures.ts` recria o lastro que cada
transição de domínio exige, não só `activity_progress.status`; selector
ornamental (`.cet-step-card`/`.cet-node-row` como contrato) substituído
por `role="list"`/`role="listitem"` em `ComoETratadoHoje.svelte`. Proof
sintética de activity executada e revertida duas vezes (íntegra).

### R3 — Development protocol / time-to-dogfood — P0

GOAL: contexto mínimo → implementação → focused verification → runtime
→ DOGFOOD → STOP.

Após aprovação humana: hardening → affected verification → full
delivery gate → delivery.

Regras aprovadas:
- full não é default antes de dogfood;
- falha isolada primeiro recebe falsificador localizado;
- rerun amplo precisa trazer informação nova;
- subagente só quando investigação for isolável;
- contexto ativo é preservado; contexto passivo é descartado/compactado;
- sem threshold rígido de tokens.

STATUS: DONE — protocolo vive em `.claude/skills/hydra-work/SKILL.md`
(§3.5 introduz o ponto de parada dogfood/STOP antes de hardening/full,
com exceção só por risco concreto; §4.1 formaliza falsificador localizado
e motivo informacional para full rerun; §8 formaliza contexto
ativo/passivo sem threshold e subagente não-default). Contradição mínima
corrigida em `CLAUDE.md` (seção "Fluxo operacional"/"Níveis de
cerimônia"): Nível 3 não implica mais `full` automático antes do
dogfood, só no boundary pós-dogfood (seal/delivery) ou por risco
concreto. Nenhum script alterado — `hydra-delivery-guard.mjs` já exigia
`full` só no seal (boundary pós-dogfood), compatível com a regra.

### R4 — Living-object mechanical assistance — P1

GOAL: máquina cuida do plumbing previsível; humano/Claude decide
semântica.

Permitido avaliar: template / scaffold / structural verifier /
combinação mínima.

Explicitamente proibido: `LivingObjectFramework`, CRUD genérico,
generic object model, geração automática de
invariantes/cardinalidade/completion/UX.

### R5 — Persistence reliability — P1

GOAL: eliminar classes comprovadas de fragilidade de upgrade/persistência.

SCOPE:
- teste comportamental de upgrade de DB suportado;
- inicialização idempotente;
- índices `project_id` comprovadamente ausentes.

OUT: reescrever `save()`; delta persistence; trocar SQLite; framework
genérico de migrations.

### R6 — Runtime/frontend reliability cleanup — P1

GOAL: corrigir somente gaps já comprovados:
- storage failure → erro compreensível;
- async form failure → não silenciosa;
- duplicate submit → protegido onde confirmado;
- feedback async/a11y consistente nas superfícies tocadas.

Sem UX sweep nem framework de retry.

## Future JIT gates

- WorkItem em escala → medir persistence/read-model;
- Dependency/Milestone → desenhar relação N:N quando chegar;
- Decision/Change → boundary para primeira operação genuinamente
  multiobjeto;
- integrations/AI → idempotência/trust/atomicidade;
- network/public → auth/authz.

## Definition of remediation complete

A remediação acaba quando R1–R6 estiverem concluídos e o proof final
mostrar:

- trabalho atual descoberto deterministicamente;
- delivery guard funciona com trabalho real;
- feature journeys localizadas;
- semantic setup disponível;
- plumbing mecânico não exige redescoberta completa;
- upgrade suportado permanece válido;
- feature normal chega ao dogfood sem full obrigatório;
- full permanece boundary amplo de risco/delivery;
- nenhuma sessão precisa carregar histórico bruto para saber o que
  fazer.

Depois disso o roadmap de produto volta a ser o trabalho normal.
