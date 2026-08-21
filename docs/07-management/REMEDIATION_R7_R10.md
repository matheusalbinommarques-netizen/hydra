# Remediação R7–R10

> **Documento temporário.** Existe só durante R7–R10 — ver STOP no fim deste arquivo.

Propósito: reduzir o custo fixo dos microcortes do rework antes de retomar S8. A
remediação termina quando cortes pequenos voltarem a ser baratos, não quando o repo
estiver "limpo".

## R7 — Persistência bloqueante

Status: DONE
Commit: `716055c`

Resumo:
- `project_event.type`/`entity_type` deixaram de usar CHECK de enumeração extensível;
- bancos existentes são convertidos de forma compatível;
- decisão D038.

Não reabrir R7.

## R8 — Fontes de verdade

Status: DONE — `CLAUDE.md` (precedência por tipo de pergunta),
`docs/core/README.md` (mapa de autoridade), topo de `PROJECT_STATUS.md`,
banner HISTÓRICO em `RELEASE_0_SPEC.md`/`UX_DESIGN_SPEC.md`/
`TECHNICAL_BRIEF.md`/`ENGINEERING_REMEDIATION.md`, comentário em
`project-repository.ts:1`. Nenhuma mudança de comportamento executável.

Escopo:
- corrigir topo/data de `PROJECT_STATUS.md`;
- criar mapa curto de autoridade em `docs/core/README.md`;
- corrigir precedência das fontes em `CLAUDE.md`;
- marcar docs stale de `docs/core/` inequivocamente como HISTÓRICO / NÃO AUTORIDADE
  CORRENTE;
- corrigir referências perigosas que tratam doc stale como contrato vigente,
  especialmente `project-repository.ts:1`.

Objetivo: retirar autoridade de fontes enganosas, NÃO reorganizar ou "limpar toda a
documentação".

Não:
- mover documentos em massa;
- reescrever docs históricos para ficarem atuais;
- corrigir numeração de ETAPAs;
- puxar outros débitos;
- antecipar R9/R10.

## R9 — Toil mecânico

Status: NEXT / NOT STARTED

Escopo:
- `assembleProjectState`: 17 parâmetros posicionais → objeto nomeado;
- triagem semântica dos testes que mantêm listas literais de estrutura:
  - se só espelham TypeScript → derivar/remover;
  - se protegem contrato real → manter explícitos.

Não:
- refatorar `transitions.ts`;
- refatorar `ProjectView`;
- refatorar repository;
- atacar "God files";
- fazer vertical slice architecture.

Critério: adicionar deliberadamente uma propriedade a `ProjectState` não deve exigir
editar testes cuja única função seja espelhar manualmente `keyof ProjectState`. Erros
restantes devem corresponder a consumidores/contratos que realmente precisam decidir
algo.

## R10 — Processo mínimo

Status: NOT STARTED

Escopo:
- `CURRENT_WORK.json` como ponteiro operacional;
- sem decisão durável → commit basta;
- com decisão durável → registro curto no decision-log/ADR;
- CHANGELOG no boundary de release, não por microcorte;
- PROJECT_STATUS como snapshot curto;
- verificação proporcional ao risco, fast/focada por padrão e full quando risco/boundary
  justificar;
- remover de `CLAUDE.md`/skills somente regras comprovadamente mortas, duplicadas,
  contraditórias ou deslocadas.

Trava: R10 NÃO autoriza redesenhar processo. Não criar hooks, novos gates, níveis,
delivery guards, permissões ou nova mecânica.

Observação conhecida: a bateria de journeys demonstrou flakes sob execução longa; existe
retry já configurado para CI. Isso é evidência para avaliar proporcionalidade do
processo em R10, não trabalho antecipado para R8/R9.

## STOP

Ao terminar R10:
1. esta remediação acaba;
2. APAGAR `docs/07-management/REMEDIATION_R7_R10.md`;
3. atualizar `CURRENT_WORK.json` para `S8`, `not_started`, apontando para a fonte
   canônica apropriada da S8;
4. voltar para S8 → Dependency → gate → dogfood → STOP.

Não continuar limpando o repo porque o contexto está quente.

## Fora desta remediação

Continuam conscientemente fora:
- worktree órfão;
- Playwright/scaffold e2e vazio;
- numeração divergente das ETAPAs;
- hooks;
- reviewer/subagente obrigatório;
- refatoração dos God files;
- poda cosmética de docs/backlogs antigos;
- permissões de sessão mortas.

Só voltar a algum deles se surgir dor concreta futura.
