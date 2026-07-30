# Hydra — Tarefas

**Status atual:** Ciclo 4 concluído (docs/08-delivery/cycle-04-backlog.md) — C4-01, C4-02, C4-03, C4-03A e C4-04 concluídos; gate do Ciclo 4 aprovado em 25/07/2026. Vertical Cockpit/Impedimentos antecipada de Release 3 por decisão explícita (D022, `docs/07-management/decision-log.md`), implementada e validada.

**Atualizado em:** 29/07/2026

Este arquivo é a visão operacional do trabalho atual. A documentação completa permanece em `docs/`.

## Agora

Ciclo 4 concluído: C4-01, C4-02, C4-03, C4-03A e C4-04 concluídas
(commits `a399191`, `39fdc06`, `f66c06a`; C4-03 e C4-04 são itens de
uso real/verificação, sem commit de código). C4-03A corrigiu o defeito
bloqueador encontrado no checkpoint (ausência de listagem/reabertura de
projetos, `RELEASE_0_SPEC.md` §4.1). C4-04 confirmou `hydra-verify full`
PASS e QA aprovada nas duas jornadas, sem divergência crítica. Gate do
Ciclo 4 aprovado. Próxima decisão (não iniciada automaticamente): revisar
riscos/roadmap e decidir continuidade para Release 1.

Vertical Cockpit/Impedimentos (D022) concluída: entidade `Impediment`,
persistência e serialização, tela `/cockpit`, integração neutra ao `/now`,
testes unitários e jornada Playwright validados.

## Depois

- [ ] Revisar riscos e roadmap.
- [ ] Decidir continuidade para Release 1.

## Não fazer agora

- [ ] Não implementar IA no produto.
- [ ] Não implementar autenticação.
- [ ] Não implementar múltiplos usuários.
- [ ] Não implementar organizações ou permissões.
- [ ] Não criar integrações externas.
- [ ] Não criar microsserviços.
- [ ] Não iniciar desenvolvimento antes da aprovação das telas e da arquitetura.
- [ ] Não transformar o Release 0 em um gerenciador completo.

## Regra de atualização

Atualizar este arquivo quando:

- uma tarefa for concluída;
- uma nova tarefa se tornar necessária;
- uma decisão alterar a ordem do trabalho;
- um bloqueio impedir o próximo passo.

Não registrar aqui justificativas longas. Decisões relevantes devem ser registradas na documentação correspondente.
