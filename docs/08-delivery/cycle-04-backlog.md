# Backlog do Ciclo 4

**Meta:** concluir a baseline funcional do Release 0, implementando a
experiência de "Pular etapa", reconciliando a especificação com o produto
funcional atual e validando internamente a jornada completa com um
projeto real de Matheus.

## Origem

O Ciclo 3 encerrou com C3-01 e C3-02 concluídos e C3-03 ("Pular etapa" na
interface) adiada como Could não iniciada. A auditoria formal do Release 0
feita na abertura deste ciclo identificou C3-03 como a única lacuna
funcional real da baseline, e `docs/core/RELEASE_0_SPEC.md` como
desatualizado — ainda descreve o protótipo clicável pré-desenvolvimento,
não o produto funcional atual. Este ciclo fecha as duas coisas e valida o
resultado com uso real, sem depender de teste com usuários externos
(`docs/07-management/decision-log.md`, D021).

## Must

### C4-01 — Reconciliar a especificação do Release 0

**Resultado esperado:**
- `docs/core/RELEASE_0_SPEC.md` passa a representar o produto funcional
  atual;
- premissas exclusivas do protótipo pré-desenvolvimento deixam de ser
  tratadas como escopo vigente;
- comportamentos válidos permanecem preservados;
- a divergência do Resumo (estrutura atual vs. "fatos, hipóteses, lacunas
  e pendências" do documento original) é registrada como decisão
  consciente de manter a implementação atual;
- a expressão "criação simulada de um projeto" em `CLAUDE.md` é corrigida,
  caso continue presente.

**Critérios de aceite:**
- persistência, importação/exportação e testes automatizados não aparecem
  mais como capacidades fora do Release 0;
- o objetivo e a natureza do documento deixam claro que ele representa a
  baseline funcional, não mais o protótipo pré-desenvolvimento;
- critérios comportamentais ainda válidos (posição atual, motivo, pular,
  consequência, pendência, mapa) permanecem;
- nenhuma divergência conhecida entre a especificação reconciliada e o
  produto fica sem decisão registrada.

**Tipo:** documentação e decisão de produto.

---

### C4-02 — Implementar a interface mínima de "Pular etapa"

**Resultado esperado:**
- ação disponível somente quando `allowsSkip === true`;
- consequência apresentada antes da confirmação;
- possibilidade de cancelar sem alterar o projeto;
- confirmação utilizando a operação existente de `skipActivity`;
- pendência criada e visível;
- próxima ação recalculada;
- atividade pulada continua acessível pelos caminhos já previstos.

**Critérios de aceite:**
- botão e confirmação funcionais;
- consequência utiliza informação real já fornecida pelo catálogo
  (`pendingItemDetail`);
- cancelar não altera estado;
- confirmar cria a pendência;
- Agora e Registros refletem a pendência;
- a atividade pulada não volta como recomendação da Trilha A;
- teste Playwright dedicado passa;
- QA manual concluída;
- `hydra-verify full` passa.

**Áreas esperadas:** rota `now/` (`+page.server.ts`, `+page.svelte`),
novo componente de confirmação, teste Playwright dedicado.

**Dependência:** C4-01 concluído.

**Áreas protegidas — não autorizadas previamente:**
```
domain/
catalog/
orientation-engine/
server/application/
```
A expectativa é consumir a implementação já existente (`skipActivity`,
testado desde C2-06/C2-10). Se durante o planejamento ou a implementação
surgir necessidade real de alterar essas áreas, isso deve ser reportado e
tecnicamente justificado antes de qualquer mudança — não presumir
autorização.

**Tipo:** código e testes.

---

### C4-03 — Executar checkpoint de dogfooding do Release 0

**Resultado esperado:** Matheus utiliza o Hydra com um projeto real e
percorre o checkpoint delimitado da jornada.

**Escopo mínimo:**
- criar ou cadastrar um projeto real;
- percorrer as atividades disponíveis;
- confirmar o Resumo;
- consultar Mapa e Registros;
- exportar e importar;
- exercitar "Pular etapa" após C4-02;
- verificar criação e visualização da pendência;
- comunicar ao ChatGPT ou ao Claude Code bloqueios ou incoerências
  relevantes.

**Critérios de aceite:**
- checkpoint percorrido pelo menos uma vez;
- problemas relevantes relatados e analisados;
- cada achado acionável classificado como corrigir, incluir no backlog,
  adiar, aceitar ou descartar;
- não exige conclusão do projeto real;
- não exige issue, formulário ou arquivo próprio de log;
- "nenhum problema relevante encontrado" é um resultado válido.

**Evidência:**
- confirmação de Matheus de que o checkpoint foi realizado;
- decisões, correções ou itens de backlog gerados pelos achados, quando
  existirem.

**Tipo:** uso real.

---

### C4-04 — Validar a baseline completa do Release 0

**Resultado esperado:** confirmar que a especificação reconciliada, a
jornada existente e a interface de "Pular etapa" funcionam juntas sem
regressão crítica.

**Critérios de aceite:**
- `hydra-verify full` com resultado PASS;
- QA da jornada normal;
- QA da jornada com atividade pulada;
- Mapa, Registros, Resumo, pendências, exportação e importação coerentes;
- nenhuma divergência crítica conhecida entre produto e especificação
  reconciliada;
- nenhum bloqueador crítico encontrado no dogfooding permanece sem
  decisão.

**Dependências:** C4-01, C4-02, C4-03.

**Tipo:** verificação e QA.

## Should

- corrigir bloqueadores ou incoerências concretas encontradas no
  checkpoint de dogfooding (C4-03);
- revisar somente os riscos realmente afetados pelos achados;
- verificar coerência visual da jornada completa, sem iniciar redesign
  amplo.

Itens Should só entram no gate de conclusão se forem efetivamente
iniciados neste ciclo.

## Could

- pequenos ajustes de UX encontrados no dogfooding;
- melhorias de baixo risco que não ampliem o escopo funcional;
- automação simples para facilitar o uso próprio, somente se surgir
  necessidade concreta.

## Fora do ciclo

- testes com usuários externos;
- deploy ou disponibilização por URL;
- Release 1;
- autenticação;
- colaboração;
- múltiplos usuários;
- implementação do Workflow v2 (registro técnico em
  `docs/08-delivery/workflow-v2-design.md`, sem implementação);
- funcionalidades não previstas na baseline reconciliada do Release 0.

## Gate de conclusão do Ciclo 4

Antes de considerar o Ciclo 4 entregue:

- C4-01 concluído e especificação reconciliada;
- C4-02 concluído, com teste dedicado passando;
- C4-03 percorrido pelo menos uma vez, sem exigência de log;
- achados acionáveis do checkpoint classificados (corrigir/backlog/
  adiar/aceitar/descartar);
- C4-04 concluído com `hydra-verify full` PASS;
- jornada normal e jornada com atividade pulada aprovadas por QA;
- nenhuma mudança nas áreas protegidas (`domain/`, `catalog/`,
  `orientation-engine/`, `server/application/`) sem justificativa técnica
  e autorização explícita registradas antes da alteração;
- nenhum bloqueador crítico do dogfooding sem decisão;
- Should e Could só entram no gate quando efetivamente iniciados.

Gate ainda não avaliado — nenhum item foi iniciado.
