# Hydra — Orientation Engine (Conceptual, v0.1)

**Versão:** 0.1
**Status:** canônico

## 1. Natureza

O Motor de Orientação não guarda estado próprio: é uma função pura que recebe o estado do projeto (`ActivityProgress[]`, `Answer[]`, `PendingItem[]`, `Project.name`, `ScopeItem[]`, `ScopeVersion`) e o catálogo metodológico, e produz:

- status calculado de cada Fase (`STATE_MACHINE.md` §2);
- status calculado do Projeto (`STATE_MACHINE.md` §4);
- a próxima atividade recomendada, ou a condição de "limite do catálogo alcançado" (Trilha A);
- a lista de pendências abertas com suas atividades associadas (Trilha B);
- a avaliação de resolução de cada pendência aberta;
- a invalidação do Resumo da descoberta quando aplicável (`STATE_MACHINE.md` §3);
- a projeção de hipóteses (`Answer`s com `semanticRole: hypothesis`, combinada com `ScopeVersion.hypothesis` quando confirmada — §8);
- a projeção somente-leitura do escopo confirmado (`computeScopeProjection` — `DOMAIN_MODEL.md` §7A), consumida só pela tela do artefato confirmado;
- as sugestões estruturadas (`computeScopeSuggestions` — `DOMAIN_MODEL.md` §7B), já filtradas das que viraram `ScopeItem`;
- o reaproveitamento explícito de resposta anterior (`computeFieldSuggestions` — `DOMAIN_MODEL.md` §2, campo `suggestedSource`), resolvido sempre a partir das `Answer`s persistidas, já filtrado dos campos que já têm `Answer` própria.

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

Única fonte da "Próxima ação recomendada" em Agora. Nunca retorna uma atividade `pulada` ou `concluída`. Nesta versão as seis fases são `complete`, então a Trilha A percorre o catálogo inteiro — de "Origem do projeto" (Descoberta) até "Confirmar encerramento do projeto" (Validação e encerramento) — e só retorna "limite do catálogo alcançado" depois que a última atividade da última fase estiver `concluída` ou `pulada`.

## 4. Trilha B — pendências a resolver

```text
listar todas as PendingItem com status == aberta
cada uma aponta para sua ActivityDefinition (que pode estar em status pulada)
textos exibidos vêm de ActivityDefinition.pendingItemLabel/pendingItemDetail
"Resolver agora" apenas navega até essa atividade — não resolve nada diretamente
```

Trilha A e Trilha B nunca competem: a interface sempre tem no máximo uma recomendação principal (Trilha A) e, separadamente, uma lista de pendências (Trilha B).

## 5. Avaliação de pendências

Ao salvar/concluir qualquer atividade (transição para `concluída`, seja por `required_fields`, `explicit_confirmation` ou `scope_confirmation`), o motor reavalia todas as `PendingItem` abertas vinculadas àquela `ActivityDefinition`; a condição é sempre a mesma — a atividade atingir `concluída` — e, quando satisfeita, a pendência passa para `resolvida`. Na prática, isso nunca se aplica a "Escolha o próximo foco": `allowsSkip = false` significa que ela jamais gera `PendingItem`.

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

### 7A. Invalidação da versão de escopo ("Escolha o próximo foco")

Mecanismo irmão do Resumo (§7), mas disparado por edição na própria tela em vez de em outra atividade — ver `STATE_MACHINE.md` §3A para as regras completas. Diferença chave: a edição nunca é bloqueada (não existe "modo somente leitura" pós-confirmação) e mudança que repete o valor já existente não invalida.

### 7B. Sinal → sugestão (prova pequena)

`computeScopeSuggestions` (`Answer[]`, `ScopeItem[]`) é uma função pura adicional, específica desta prova — não parte do ciclo genérico de sequenciamento/pendências. Lê só o campo `sinais_situacao` (`selecao_multipla`) da atividade "Problema ou oportunidade" e aplica exatamente duas regras explícitas (`DOMAIN_MODEL.md` §7B), filtrando qualquer sugestão cujo id já exista como `ScopeItem.sourceSuggestionId`. Recalculada a cada leitura, nunca persistida.

## 8. Projeção de hipóteses

Hipóteses exibidas (ex.: Registros) combinam duas fontes, deduplicadas por texto:
1. toda `Answer` cujo `FieldDefinition.semanticRole == hypothesis` e valor não vazio, no momento da leitura;
2. `ScopeVersion.hypothesis`, apenas quando `ScopeVersion.confirmedAt` não é nulo.

Nenhuma entidade própria é consultada para isso — ambas as fontes são projetadas em tempo de leitura. A capacidade genérica (1) continua valendo para qualquer `Answer` com `semanticRole: hypothesis`, incluindo o campo opcional "hipótese" de "Problema ou oportunidade" — não foi criada compatibilidade especial para as duas atividades textuais removidas (§7A de `DOMAIN_MODEL.md`), pois nenhum projeto existente precisava ser preservado.

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
- "Escolha o próximo foco" só conclui quando `getScopeConfirmationIssues` retorna lista vazia, nunca por preenchimento de campo (não tem campos), e nunca pode ser pulada (`allowsSkip = false`).
- Editar qualquer `ScopeItem` ou `ScopeVersion.hypothesis` depois que "Escolha o próximo foco" estiver `concluída` sempre a volta para `em_andamento` e exige nova confirmação — mudança que repete o valor já existente é no-op.
- Hipóteses exibidas são sempre projeção de `Answer`s com `semanticRole: hypothesis` combinada com `ScopeVersion.hypothesis` (quando confirmada) — nunca uma entidade separada.
- `computeScopeSuggestions` nunca sugere um id já presente como `ScopeItem.sourceSuggestionId` — aceitar uma sugestão a remove da lista; excluir esse item a traz de volta.
- `computeFieldSuggestions` nunca sugere um campo que já tem `Answer` própria não vazia, e nunca sugere a partir de uma origem sem `Answer` ou com valor vazio; aceitar a sugestão copia o texto uma única vez para o campo — origem e destino permanecem `Answer`s independentes dali em diante.
- Trilha A nunca retorna uma atividade `pulada` ou `concluída`.
- Confirmar "pular" é uma operação de efeito único (uma transição de status, uma `PendingItem` criada) mesmo diante de cliques repetidos.

## 10. Escopo do catálogo usado pelo motor nesta versão

Cobre o sequenciamento das 37 atividades das seis fases, todas `catalogStatus: complete`: Descoberta (7), Definição do produto (5), Estruturação do projeto (6), Planejamento da entrega (7), Execução e acompanhamento (6), Validação e encerramento (6) — ver `DOMAIN_MODEL.md` §7 para o detalhe de cada uma. O motor em si (`orientation-engine/`) não tem nenhuma lógica específica de fase ou atividade — o comportamento descrito neste documento vale igualmente para qualquer catálogo, incluindo um futuro catálogo maior ou com fases `partial`/`unavailable`.
