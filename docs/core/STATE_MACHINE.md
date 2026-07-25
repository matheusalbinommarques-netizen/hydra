# Hydra — State Machines (Conceptual)

**Versão:** 0.1
**Status:** canônico

## 1. Estado da Atividade (persistido em `ActivityProgress`)

Estados: `não_iniciada | em_andamento | concluída | pulada`

A transição para `concluída` depende do `completionMode` da `ActivityDefinition`:

```text
não_iniciada
   │ usuário abre/começa a atividade
   ▼
em_andamento
   │                                        │
   │ completionMode = required_fields:      │ usuário confirma "pular"
   │   todos os obrigatórios válidos        │ (só quando allowsSkip = true)
   │   + salvar                             │
   │ completionMode = explicit_confirmation:│
   │   usuário clica "Continuar"            │
   ▼                                        ▼
concluída ◄──────────────────────────── pulada
   preenchimento completo dos campos obrigatórios
```

Nesta versão, a única atividade com `completionMode: explicit_confirmation` é "Resumo da descoberta", que tem `allowsSkip: false` — logo seu `ActivityProgress` nunca assume `pulada`. Seu fluxo é sempre:

```text
não_iniciada → em_andamento → concluída
```

### Regras de edição (aplicam-se a atividades com `completionMode: required_fields`)

- Atividade `concluída`, ao ser editada:
  - se continuar válida (todos os campos obrigatórios preenchidos) → permanece `concluída`;
  - se perder um campo obrigatório (fica vazio) → muda para `em_andamento`.
- Atividade `pulada`, ao ser editada:
  - preenchimento parcial (nem todos os obrigatórios válidos) → permanece `pulada`, pendência continua aberta;
  - todos os campos obrigatórios válidos → muda para `concluída` e resolve a pendência associada.

Não existe estado `atual` persistido. A atividade **recomendada** é sempre calculada pelo Motor de Orientação (`ORIENTATION_ENGINE.md`); a atividade **em visualização** é estado de interface, não de domínio, e não influencia a recomendação.

## 2. Estado da Fase (sempre calculado, nunca persistido)

Estados: `não_iniciada | em_andamento | concluída_com_pendências | concluída`

O cálculo depende de `PhaseDefinition.catalogStatus`:

```text
SE catalogStatus == unavailable
    → não_iniciada  (sempre — a fase não pode progredir nesta versão,
                      qualquer que seja o estado de suas atividades,
                      pois não há nenhuma catalogada)

SENÃO SE catalogStatus == partial
    SE nenhuma atividade catalogada foi iniciada, pulada ou concluída
        → não_iniciada
    SENÃO
        → em_andamento
    (uma fase partial NUNCA atinge concluída nem concluída_com_pendências
     nesta versão — seu catálogo é incompleto por definição, então não há
     como afirmar que a fase terminou)

SENÃO (catalogStatus == complete) — regras normais:
    SE existe atividade não_iniciada OU em_andamento
        → em_andamento
    SENÃO SE existe atividade pulada OU pendência aberta referenciando
         atividade desta fase
        → concluída_com_pendências
    SENÃO
        → concluída
```

Invariantes:
- uma fase `complete` nunca está `concluída` nem `concluída_com_pendências` enquanto existir atividade `não_iniciada` ou `em_andamento` nela;
- uma fase `partial` ou `unavailable` nunca atinge `concluída` nem `concluída_com_pendências`, independentemente do estado de suas atividades;
- uma coleção vazia de atividades catalogadas (`unavailable`) nunca torna uma fase `concluída`.

Nesta versão, as seis fases do catálogo são `complete` (usam as regras normais) — a jornada guiada cobre da Descoberta ao encerramento do projeto de ponta a ponta. Os estados `partial` e `unavailable` continuam fazendo parte do modelo geral (ex.: para uma futura fase cujo catálogo ainda não esteja completo) e são exercitados por testes com fixtures fabricadas, mesmo sem nenhuma fase real nesse estado nesta versão.

Quando o Motor de Orientação esgota as atividades catalogadas de uma fase `partial` (comportamento do modelo geral, sem exemplo real nesta versão), isso não é interpretado como a fase ou o projeto estarem concluídos — ver `ORIENTATION_ENGINE.md` §3 para a condição explícita de "limite do catálogo alcançado", que nesta versão só é alcançada depois da última atividade da última fase (Confirmar encerramento do projeto).

## 3. Invalidação do Resumo da descoberta

"Resumo da descoberta" é uma confirmação dos dados das seis atividades anteriores da Descoberta (Origem, Contexto inicial, Problema ou oportunidade, Público afetado, Estado atual, Resultado desejado) e de `Project.name`.

Regra: se, depois de o Resumo estar `concluída`, qualquer `Answer` de uma dessas seis atividades — ou `Project.name` — for alterada, o motor:

1. transiciona o `ActivityProgress` do Resumo de volta para `em_andamento`;
2. exige nova confirmação explícita do usuário para voltar a `concluída`;
3. permite que o Resumo volte a ser a recomendação principal da Trilha A (`ORIENTATION_ENGINE.md` §4).

Esta é a única transição `concluída → em_andamento` prevista no modelo. Ela é sempre disparada externamente (por uma edição em outra atividade ou no nome do projeto) — nunca pelo próprio Resumo, que não tem campos e portanto não pode "perder" um campo obrigatório por si mesmo.

## 4. Estado do Projeto (calculado, nunca persistido)

```text
SE Project.name não definido (campo "Nome provisório" ainda não preenchido)
    → rascunho
SENÃO SE todas as fases estão concluídas
    → concluído
SENÃO
    → em_andamento
```

Nesta versão, com as seis fases `complete`, o estado `concluído` é **alcançável de ponta a ponta**: exige que toda atividade de toda fase esteja `concluída` (nenhuma `pulada` ou `em_andamento`) — mais rígido que `concluída_com_pendências`, que já é suficiente no nível de fase. A última atividade do catálogo, "Confirmar encerramento do projeto" (`allowsSkip: false`), é o gate final — sem ela, o projeto nunca atinge `concluído`.

## 5. Estado da Pendência

Estados: `aberta | resolvida`

```text
aberta ──(atividade vinculada atinge concluída)──► resolvida
```

Regras do Release 0:
- Criada apenas ao confirmar "Pular etapa" (uma pendência por confirmação, vinculada à atividade pulada — só possível quando `allowsSkip = true`).
- Campo obrigatório vazio ao tentar salvar produz **erro de validação de tela**, não pendência.
- Campo opcional vazio nunca produz pendência.
- "Resolver agora" apenas navega até a atividade — não resolve nada por si.
- A condição de resolução é sempre a mesma para toda pendência: a `ActivityDefinition` vinculada atinge `concluída`. Não há condições por campo nesta versão.
- Não existe resolução manual sem preenchimento.
- Não existe reabertura de pendência nesta versão (`resolvida` é terminal).
- Textos exibidos (label/detalhe) vêm de `ActivityDefinition.pendingItemLabel`/`pendingItemDetail` — nunca são persistidos por instância de pendência.
