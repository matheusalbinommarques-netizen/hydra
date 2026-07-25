# Lições Aprendidas

As lições serão registradas ao final de cada ciclo e consolidadas por tema.

## Categorias

- produto;
- experiência;
- metodologia;
- desenvolvimento;
- ferramentas;
- planejamento;
- estimativas;
- testes;
- comunicação;
- uso de IA como apoio.

## Estrutura

```text
Situação
→ decisão ou ação
→ resultado
→ aprendizado
→ recomendação futura
```

## Ciclo 3

### Mensagem de commit sem conteúdo (`3fc5005`)

- **Situação:** em 23/07/2026, um commit alterando `PROJECT_STATUS.md` e
  `TASKS.md` foi publicado em `main` com a mensagem `"sss"`.
- **Decisão ou ação:** manter o commit como está no histórico — não
  reescrever `main` só por causa da mensagem.
- **Resultado:** a mensagem não descreve a mudança nem segue o padrão
  `tipo(escopo): descrição` já usado em 26 dos 27 commits existentes até
  então.
- **Aprendizado:** disciplina de mensagem só é confiável quando aplicada
  mecanicamente — seguir um padrão por hábito não impede uma exceção.
- **Recomendação futura:** `/hydra-ship` passa a validar a mensagem antes
  de aceitar o commit (aplicado no fechamento do Ciclo 3).

### Mesmo fato redigido em quatro documentos

- **Situação:** ao fechar o Ciclo 3, o status de C3-03 (não iniciada)
  precisou ser escrito em `CHANGELOG.md`, `PROJECT_STATUS.md`, `TASKS.md`
  e `docs/08-delivery/cycle-03-backlog.md`; uma das quatro redações
  soava como cancelamento, o que só apareceu numa revisão cruzada
  posterior.
- **Decisão ou ação:** corrigir a redação ambígua antes de qualquer
  stage ou commit.
- **Resultado:** a inconsistência foi detectada e corrigida a tempo, mas
  exigiu uma etapa de revisão manual dedicada só para reconciliar os
  quatro documentos.
- **Aprendizado:** repetir o mesmo fato em vários documentos aumenta o
  custo de coordenação e o risco de divergência de redação, mesmo sem
  nenhum documento estar tecnicamente errado.
- **Recomendação futura:** reduzir a duplicação estrutural entre os
  documentos de acompanhamento — backlog do ciclo como fonte única do
  detalhe, `PROJECT_STATUS.md` como ponteiro operacional e
  `CHANGELOG.md` restrito às mudanças efetivamente entregues.
