# Hydra — Orientation Engine (Conceptual, v0.1)

**Versão:** 0.1
**Status:** canônico

## 1. Natureza

O Motor de Orientação não guarda estado próprio: é uma função pura que recebe o estado do projeto (`ActivityProgress[]`, `Answer[]`, `PendingItem[]`, `Project.name`) e o catálogo metodológico, e produz:

- status calculado de cada Fase (`STATE_MACHINE.md` §2);
- status calculado do Projeto (`STATE_MACHINE.md` §4);
- a próxima atividade recomendada, ou a condição de "limite do catálogo alcançado" (Trilha A);
- a lista de pendências abertas com suas atividades associadas (Trilha B);
- a avaliação de resolução de cada pendência aberta;
- a invalidação do Resumo da descoberta quando aplicável (`STATE_MACHINE.md` §3);
- a projeção de hipóteses (`Answer`s com `semanticRole: hypothesis`).

Nada disso é persistido — é recalculado a cada leitura, garantindo que Home, Agora, Mapa, Resumo e Registros nunca divirjam entre si.

## 2. Sequenciamento

Não existe mapa fixo de "próxima atividade" por atividade. O sequenciamento é sempre resultado de percorrer o catálogo (`PhaseDefinition` → `ActivityDefinition`, em ordem) e aplicar a Trilha A.

Ciclo em qualquer alteração de estado:
```text
atualizar estado (responder, pular, editar, confirmar resumo)
   → executar Motor de Orientação
   → recalcular status de fase/projeto
   → reavaliar invalidação do Resumo, se aplicável
   → recalcular próxima recomendação (Trilha A) e pendências (Trilha B)
```

## 3. Trilha A — próxima atividade metodológica

```text
percorrer PhaseDefinition[] em ordem, e dentro de cada uma, ActivityDefinition[] em ordem
retornar a primeira ActivityDefinition cujo ActivityProgress.status == não_iniciada OU == em_andamento

SE nenhuma atividade elegível for encontrada porque o percurso chegou ao
fim do catálogo de uma fase com catalogStatus == partial (ex.: toda a
Descoberta concluída e "Definir usuário principal" também concluída)
    → retornar a condição explícita "limite do catálogo alcançado"
      (nunca interpretar isso como projeto ou fase concluídos)
```

Única fonte da "Próxima ação recomendada" em Agora. Nunca retorna uma atividade `pulada` ou `concluída`. Como as fases 3–6 são `unavailable` (catálogo vazio), a Trilha A nunca as alcança nesta versão — o percurso termina em "Definir usuário principal", e a partir daí retorna sempre "limite do catálogo alcançado".

## 4. Trilha B — pendências a resolver

```text
listar todas as PendingItem com status == aberta
cada uma aponta para sua ActivityDefinition (que pode estar em status pulada)
textos exibidos vêm de ActivityDefinition.pendingItemLabel/pendingItemDetail
"Resolver agora" apenas navega até essa atividade — não resolve nada diretamente
```

Trilha A e Trilha B nunca competem: a interface sempre tem no máximo uma recomendação principal (Trilha A) e, separadamente, uma lista de pendências (Trilha B).

## 5. Avaliação de pendências

Ao salvar/concluir qualquer atividade (transição para `concluída`, seja por `required_fields` ou por `explicit_confirmation`), o motor reavalia todas as `PendingItem` abertas vinculadas àquela `ActivityDefinition`; a condição é sempre a mesma — a atividade atingir `concluída` — e, quando satisfeita, a pendência passa para `resolvida`.

## 6. Consequência ao pular

Ao confirmar "Pular etapa" (disponível apenas quando `ActivityDefinition.allowsSkip == true`), o motor:
1. transiciona a `ActivityProgress` da atividade para `pulada`;
2. cria exatamente uma `PendingItem` vinculada a ela (nenhuma duplicata se já existir uma aberta para a mesma atividade);
3. recalcula a Trilha A (que passa a apontar para a próxima atividade `não_iniciada`/`em_andamento`, nunca a que acabou de ser pulada).

## 7. Invalidação do Resumo da descoberta

Depois que "Resumo da descoberta" atinge `concluída`, o motor observa toda alteração subsequente em `Answer`s das seis atividades anteriores da Descoberta e em `Project.name`. Se qualquer uma mudar:

1. o `ActivityProgress` do Resumo volta para `em_andamento`;
2. a Trilha A volta a poder recomendar o Resumo como próxima ação principal, seguindo a ordem normal do catálogo;
3. o Resumo só volta a `concluída` mediante nova confirmação explícita do usuário — nunca automaticamente.

## 8. Projeção de hipóteses

Hipóteses exibidas (ex.: Registros) = todas as `Answer` cujo `FieldDefinition.semanticRole == hypothesis` e valor não vazio, no momento da leitura. Nenhuma entidade própria é consultada para isso.

## 9. Invariantes do motor (para testes automatizados)

- No máximo uma recomendação principal (Trilha A) por projeto a qualquer momento.
- A atividade em visualização na interface nunca altera a recomendação.
- Campo opcional vazio nunca cria pendência.
- Uma fase `complete` nunca é `concluída` ou `concluída_com_pendências` com atividade `não_iniciada` ou `em_andamento` dentro dela.
- Uma fase `partial` ou `unavailable` nunca é `concluída` nem `concluída_com_pendências`, independentemente do estado de suas atividades.
- Esgotar o catálogo de uma fase `partial` produz a condição explícita "limite do catálogo alcançado" — nunca é interpretado como fase ou projeto concluído.
- A condição de resolução de toda pendência é sempre a mesma: a atividade vinculada atingir `concluída`.
- Nenhuma tela persiste contagens, fase atual ou recomendação — todas leem do motor a cada renderização.
- Uma `Answer` só referencia um `FieldDefinition` pertencente à mesma `ActivityDefinition` e com `dataTarget = answer`.
- `Project.name` possui uma única fonte canônica — nunca duplicado em `Answer`.
- "Resumo da descoberta" só conclui por confirmação explícita, nunca por preenchimento de campo (não tem campos), e nunca pode ser pulado (`allowsSkip = false`).
- Editar qualquer resposta das seis atividades anteriores da Descoberta, ou `Project.name`, depois que o Resumo estiver `concluída`, sempre o volta para `em_andamento` e exige nova confirmação.
- Hipóteses exibidas são sempre projeção de `Answer`s com `semanticRole: hypothesis` — nunca uma entidade separada.
- Trilha A nunca retorna uma atividade `pulada` ou `concluída`.
- Confirmar "pular" é uma operação de efeito único (uma transição de status, uma `PendingItem` criada) mesmo diante de cliques repetidos.

## 10. Escopo do catálogo usado pelo motor nesta versão

Cobre o sequenciamento das 7 atividades da fase Descoberta (`catalogStatus: complete`) + a primeira atividade da fase Definição do produto (`catalogStatus: partial`, "Definir usuário principal"). As fases 3–6 (`catalogStatus: unavailable`) não são alcançadas pelo motor nesta versão.
