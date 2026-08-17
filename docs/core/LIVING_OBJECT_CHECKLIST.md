# Checklist de living object

Memória curta da anatomia recorrente de uma capability de "objeto vivo" no
Hydra — evita redescobrir o plumbing mecânico a cada nova capability (R4,
`docs/core/ENGINEERING_REMEDIATION.md`).

Precedentes usados como base: `AffectedGroup`/`CurrentTreatment` (Stage 4A) e
`CauseHypothesis`/`CauseExploration` (Stage 4B). Cada novo objeto vivo é um
precedente adicional só depois de implementado — este documento não assume
que todo objeto futuro terá exatamente este shape.

## 1. Decisões semânticas — humano/Claude, nunca a ferramenta

Decida isto ANTES de tocar código. O verifier (seção 4) não pode e não deve
decidir nada disto:

- **nome do conceito** — evite colisão com nomes já usados em outro sentido
  (ex.: `CauseHypothesis` ≠ `Hypothesis` de `orientation-engine/hypotheses.ts`);
- **cardinalidade/profile** — 1:1 com o projeto (`project-header`, ex.:
  `CurrentTreatment`, `CauseExploration`) ou 1:N (`project-collection`, ex.:
  `AffectedGroup`, `CauseHypothesis`)? Só existem estes dois profiles porque
  são os únicos comprovados nos precedentes — não invente um terceiro sem um
  precedente real implementado antes;
- **campos e validação** — quais campos, opcionais vs obrigatórios, formato;
- **completion/confirmation semantics** — o objeto bloqueia a conclusão de
  uma atividade? Sob quais condições? (ex.: "entender as causas" nunca
  bloqueia — `getCauseHypothesesConfirmationIssues` é sempre `[]`);
- **compatibilidade/backfill** — o que um snapshot/DB antigo, sem este
  objeto, deve virar ao ser lido? (nunca inferido do conteúdo do snapshot —
  sempre um estado inicial fixo, igual ao de `createInitialProjectState`);
- **relacionamentos** — referencia outro objeto vivo (ex.: `evidenceIds`)? A
  referência é validada contra o quê, e o que acontece se for inválida?
- **UX** — como a interface apresenta e edita o objeto.

## 2. Superfícies mecânicas (verificáveis)

Comprovadamente repetidas nos precedentes, na mesma ordem, para os dois
profiles conhecidos:

| Superfície | Arquivo |
|---|---|
| Interface do objeto + campo em `ProjectState` | `app/src/lib/domain/state-types.ts` |
| Inicialização em `createInitialProjectState` | `app/src/lib/domain/factory.ts` |
| `CREATE TABLE`, `project_id … REFERENCES project(id)` | `app/src/lib/server/persistence/migrations/0001_init.sql` |
| `XRow` + `mapXRow` | `app/src/lib/server/persistence/mappers.ts` |
| import do mapper, `INSERT INTO`, `DELETE FROM` no replace, `SELECT … WHERE project_id` no load | `app/src/lib/server/persistence/sqlite-project-repository.ts` |
| `XView` + campo em `ProjectView` | `app/src/lib/server/application/types.ts` |
| mapeamento `state.x → view.x` | `app/src/lib/server/application/project-view.ts` |
| `parseX`/`parseXList` declarada e invocada em `deserializeProjectState` | `app/src/lib/domain/serialization.ts` |
| **Só para profile `project-header`:** backfill idempotente `ensureXRows`, chamado no construtor do repositório | `app/src/lib/server/persistence/sqlite-project-repository.ts` |

Verificado por checagem local nos dois precedentes; **não** se repetem de
forma mecanicamente verificável (dependem de decisão semântica sobre qual
atividade/erro/UX está envolvido) — aparecem em toda capability real, mas
como conteúdo escrito à mão, não como presença estrutural:

- `domain/test-support.ts` — branch de "completar minimamente" por atividade
  do catálogo (qual atividade, o que "mínimo" significa, é semântico);
- `server/error-messages.ts` — mensagem de erro em português por código de
  `UseCaseError` novo (o texto é conteúdo, não estrutura);
- `catalog/*.ts`, `domain/transitions.ts`, componentes `.svelte` — vocabulário,
  invariantes de transição e UX; necessários, mas não gerados nem
  verificáveis estruturalmente aqui.

## 3. Comando

```bash
node .claude/scripts/hydra-living-object-verifier.mjs \
  --object CauseHypothesis --state-key causeHypotheses \
  --table cause_hypothesis --profile project-collection
```

Profiles: `project-header` (1:1) ou `project-collection` (1:N) — escolha
explícita, nunca inferida pelo script. Rode manualmente depois de implementar
o plumbing mecânico de uma capability nova, antes do dogfood. **Não** faz
parte de `hydra-verify fast`/`full` nem do delivery guard nesta versão —
integração automática só se justificaria depois de uso real mostrar que
esquecer de rodar continua sendo um problema recorrente.

## 4. O que o verifier NÃO prova

- que a cardinalidade/profile escolhida faz sentido para o conceito;
- que qualquer invariante, completion/confirmation semantics ou migration/
  backfill semantics estão corretas;
- que UX ou relacionamento entre objetos está semanticamente correto;
- que o nome conceitual é bom;
- "arquitetura correta" de forma geral — só que, dadas as decisões explícitas
  passadas como flags, o plumbing mecânico esperado não está incompleto.
