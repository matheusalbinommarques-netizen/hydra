# S6V — Convergência visual da fundação

**Status:** ✅ concluído — dogfood humano PASS. Biblioteca de projetos
(`app/src/routes/projects/+page.svelte`) e shell do workspace
(`app/src/routes/projects/[projectId]/+layout.svelte`) na identidade dark
aprovada; shell permanece dark em todas as rotas/activities; conteúdo
interno ainda não migrado contido visualmente (`.content-frame`) sem
nenhum rótulo de legado/migração exposto; superfícies já dark (checkpoint
`/summary`, atividades `problema`/`publico`/`estado_atual`/
`entender_causas`) seguem sem contenção. `npm run check` e
`npm run test:unit` PASS; QA manual em Agora, Acompanhamento, Mapa,
Trabalho, Documento, Encerramento e Resumo, desktop e mobile, sem
overflow horizontal e sem regressão funcional na Biblioteca/navegação.

**Origem:** interlúdio explícito entre S6 (Primeiro loop operacional) e S7
(Event Log), a pedido de Matheus, a partir do Design Gate "Convergência
Visual" aprovado e congelado via Claude Design MCP.

## Objetivo

Fazer o caminho Home → Biblioteca de projetos → workspace do projeto
parecer continuidade da mesma identidade do Hydra, sem alterar
funcionalidade, domínio ou navegação.

## Escopo

1. Biblioteca de projetos na identidade dark aprovada (reskin —
   preserva integralmente busca, filtros, contagens, lista, estados,
   próxima ação, criação e navegação).
2. Shell do workspace dark e persistente em todas as rotas/activities
   (header, identidade do projeto, navegação, estado ativo, faixa de
   ações em campo) — não reverte ao tema claro ao trocar de
   activity/rota.
3. Fundação/tokens compartilhados estritamente necessários para 1 e 2.
4. Contenção visual temporária para conteúdos internos ainda claros
   (cartão com borda/raio do shell dark ao redor do conteúdo legado
   intocado), conforme o Design Gate.

## Fora de escopo

- Redesenho individual de: Agora, Acompanhamento, Mapa, Registros,
  Trabalho, Resumo, Documento, Encerramento, Exportar, Configurações.
  Trabalho é usado apenas como superfície de demonstração da contenção,
  sem redesenho do seu conteúdo.
- Uniformização de todos os breakpoints internos.
- Refatoração de CSS local de telas que não precisam ser tocadas.
- Qualquer mudança de domínio, persistência, schema, use case ou
  comportamento funcional.
- Event Log e qualquer implementação de S7.

## Critérios de aceite

- Biblioteca preserva exatamente suas capacidades atuais (busca,
  filtros, contagens, lista, estados, próxima ação, criação, navegação)
  na identidade dark aprovada.
- Shell permanece dark ao navegar entre rotas/activities, sem flash
  claro/dark.
- Conteúdo interno ainda não migrado aparece contido visualmente, sem
  qualquer rótulo ou sinal ("legado", "migração" etc.) exposto ao
  usuário.
- Sem regressão funcional na Biblioteca ou na navegação do shell.
- Sem overflow horizontal; comportamento correto em desktop e mobile.

## Próximo Stage

S7 (Event Log) permanece `not_started` — não iniciado, não autorizado
neste corte.
