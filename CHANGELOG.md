# Changelog

## [Unreleased]

### Adicionado

- Tela Mapa da jornada (`/projects/[projectId]/map`): mostra as seis fases
  do catálogo em ordem, com status de cada fase e atividade, e destaque da
  atividade recomendada como próximo passo;
- Tela Registros (`/projects/[projectId]/records`): mostra as respostas
  registradas, agrupadas por fase e atividade, e o histórico de pendências
  (abertas e resolvidas, com datas), somente leitura;
- Interface de "Pular etapa" em Agora (`/projects/[projectId]/now`): botão
  condicionado a atividades que permitem pular, modal de confirmação
  acessível (`<dialog>` nativo) informando a consequência e a criação de
  pendência, e retomada segura da atividade pulada a partir da pendência
  aberta (`?activity=<id>`, validada contra o próprio projeto), com
  resolução automática da pendência ao responder e retorno à recomendação
  canônica;
- Listagem de projetos na página inicial (`/`): mostra os projetos
  persistidos, mais recentes primeiro, cada um com link para reabrir em
  `/projects/[projectId]/now`; estado vazio quando não há projetos; link
  "Projetos" no cabeçalho do workspace para retornar à página inicial.

## [0.3.0] — 24/07/2026

### Adicionado

- Walking Skeleton funcional do Release 0, executável de ponta a ponta no
  navegador (Ciclo 2, itens Must C2-01 a C2-12);
- domínio (`domain/`): tipos, fábrica e transições puras, serialização JSON
  versionada;
- catálogo completo do Release 0 (`catalog/`): oito atividades (sete da
  Descoberta + "Definir usuário principal");
- motor de orientação (`orientation-engine/`): status de fase, próxima
  atividade recomendada, pendências e hipóteses;
- persistência em SQLite (`server/persistence/`, via `better-sqlite3`);
- camada de aplicação (`server/application/`) com os oito casos de uso do
  Walking Skeleton;
- rotas mínimas (Home, Agora, Resumo, Exportar/Importar);
- exportação e importação de projeto em JSON versionado, com validação de
  invariantes e rejeição de colisão de identificador;
- teste de jornada ponta a ponta (Playwright) cobrindo as oito atividades
  reais, o Resumo, `catalog_limit_reached`, exportação e importação em
  bancos SQLite isolados.

### Verificado

- typecheck (`tsc --noEmit` via `svelte-check`): 0 erros, 0 avisos;
- Vitest (unitário + integração): 137/137;
- teste de jornada Playwright: aprovado, em execuções consecutivas sem
  resíduo de processos ou arquivos temporários;
- suíte Playwright padrão: aprovada;
- build de produção (`adapter-node`): aprovado;
- persistência validada manualmente após reinício do processo do servidor.

### Pendente

- Tela Mapa mínima (C2-13);
- Tela Registros mínima (C2-14);
- "Pular etapa" na interface (C2-15).

## [0.1.0] — 22/07/2026

### Adicionado

- baseline de descoberta, iniciação, produto e planejamento;
- definição do público e da proposta de valor;
- escopo do MVP;
- Story Map e roadmap;
- estratégia de entrega em ciclos de duas semanas;
- plano de requisitos e rastreabilidade;
- plano de qualidade e Definition of Done;
- especificação preliminar do Release 0;
- riscos, premissas e decisões iniciais;
- templates de issues, review e retrospectiva.

### Pendente

- protótipo navegável;
- teste de usabilidade;
- modelo conceitual de dados;
- comparação formal de stacks;
- ADR de escolha da stack;
- Walking Skeleton funcional.

## [0.2.0] — 22/07/2026

### Adicionado

- protótipo navegável do Release 0;
- Home com estados vazio, único projeto e múltiplos projetos;
- atividades guiadas;
- modal de confirmação ao pular;
- criação e resolução de pendências;
- Resumo da descoberta;
- Workspace com Agora, Mapa e Registros;
- documentação das decisões visuais finais.

### Alterado

- unificação da jornada macro em seis fases;
- separação entre fases e atividades;
- sincronização conceitual dos estados entre as telas;
- simplificação da navegação e terminologia.

### Aprovado

- identidade visual navy, prata e ciano;
- experiência do Release 0 como referência para implementação.