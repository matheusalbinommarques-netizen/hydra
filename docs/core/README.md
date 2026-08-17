# Documentos canônicos

Estes arquivos concentram o contexto operacional do Hydra:

- `PRODUCT_SPEC.md`: o que é o produto;
- `RELEASE_0_SPEC.md`: especificação reconciliada da baseline funcional do Release 0;
- `UX_DESIGN_SPEC.md`: como a experiência deve funcionar e parecer;
- `TECHNICAL_BRIEF.md`: restrições e critérios técnicos;
- `HYDRA_PRODUCT_REWORK.md`: semântica e decisões canônicas do rework de produto em andamento;
- `ENGINEERING_REMEDIATION.md`: source of truth **temporária** do programa de correção de engenharia (control plane, testes, protocolo, persistência, reliability) — não substitui `HYDRA_PRODUCT_REWORK.md` como fonte semântica de produto;
- `CURRENT_WORK.json`: ponteiro operacional transitório — qual é o Cycle/Stage/corte de remediação atual (consumido por `hydra-state.mjs`/`hydra-delivery-guard.mjs`, não é histórico nem especificação).

A documentação completa em `docs/01-*` a `docs/09-*` preserva a baseline formal, justificativas, riscos, decisões e histórico.

Em caso de conflito, não alterar silenciosamente. Registrar e decidir.
