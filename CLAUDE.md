# Hydra — Instruções para o Claude Code

## Produto

Hydra é uma plataforma guiada de gerenciamento de projetos de software.

O produto deve ajudar o usuário a entender onde está, qual é a próxima ação,
por que ela importa, como concluí-la e o que vem depois.

O Release 0 valida essa experiência para profissionais individuais e equipes
pequenas. Não transformar o Hydra em curso, formulário genérico ou sistema
corporativo de portfólio.

## Princípios de produto

- Execução antes de ensino: orientar durante o trabalho, sem parecer um curso.
- Orientar sem aprisionar: recomendar, explicar e alertar sem bloquear escolhas.
- Complexidade progressiva: mostrar primeiro o necessário.
- Uma ação principal: destacar a próxima ação sem ocultar alternativas e jornada.
- Explicabilidade: toda recomendação deve ter motivo compreensível.
- Quando aplicável, preservar a rastreabilidade:
  problema → objetivo → capacidade → requisito → entrega → resultado.

## Fontes de verdade

Consulte somente os documentos necessários ao item atual. Não leia todos os
documentos canônicos por padrão.

Fontes disponíveis:

- `docs/core/PRODUCT_SPEC.md`: visão duradoura do produto;
- `docs/core/RELEASE_0_SPEC.md`: escopo e critérios do Release 0;
- `docs/core/UX_DESIGN_SPEC.md`: experiência e comportamento da interface;
- `docs/core/TECHNICAL_BRIEF.md`: stack e decisões técnicas;
- `docs/core/HYDRA_PRODUCT_REWORK.md`: semântica e decisões canônicas do
  rework de produto em andamento;
- `docs/core/CURRENT_WORK.json`: ponteiro operacional — qual é o
  Stage/corte atual, sem interpretar histórico;
- `PROJECT_STATUS.md`: estado operacional e próxima decisão relevante;
- backlog do ciclo vigente: critérios e limites do item;
- documentação completa em `docs/`: histórico e aprofundamento.

Precedência:

1. decisão explícita mais recente do usuário;
2. documentos em `docs/core/`;
3. backlog vigente e `PROJECT_STATUS.md`;
4. documentação complementar;
5. inferência técnica.

Não resolver conflitos silenciosamente. Pare e apresente o conflito.

## Regras permanentes

- Trabalhar em um item do backlog por vez, mas sem pausa para aprovação de
  plano antes de implementar — planejar e implementar na mesma passagem
  (exceto Nível 3, que exige autorização registrada antes de editar).
- Não ampliar escopo nem implementar itens vizinhos.
- Se uma tarefa em andamento exigir tocar um diretório ou tipo de arquivo
  que estava explicitamente listado como fora de escopo, pare e pergunte
  antes de agir, mesmo que a mudança pareça pequena ou claramente correta.
- Não alterar stack ou arquitetura sem decisão registrada.
- Não adicionar dependência sem explicar necessidade, alternativa e impacto.
- Pare e peça aprovação antes de alterar arquitetura, dependências, schema, migrations, dados persistidos ou escopo.
- Preferir soluções simples, locais e consistentes com o código vizinho.
- Não criar abstrações sem necessidade comprovada.
- Preservar comportamento e áreas protegidas definidos pelo item.
- Manter regras de domínio separadas da interface.
- Não armazenar chaves, tokens ou segredos no repositório.
- Não ocultar erros, limitações ou testes falhando.
- Não executar commit, push, merge, instalação global ou exclusão destrutiva
  sem autorização explícita.
- Commit e stage exigem autorização explícita e específica do usuário,
  distinta de qualquer aprovação anterior sobre o conteúdo da entrega.
  Aprovação técnica do diff, dos critérios de aceite ou da documentação,
  pedido para preparar a entrega, pedido para mostrar um comando de
  commit, ou aprovação genérica sem referência a commit não autorizam
  stage nem commit — nesses casos, pare antes do stage e do commit e peça
  autorização.
  Uma autorização explícita já fornecida pelo usuário (ex.: "pode
  commitar", "commite agora", "faça o commit com a mensagem X", "pode
  fazer stage e commit", uma instrução direta para executar `git commit`,
  ou o fornecimento de um comando de commit acompanhado da instrução para
  executá-lo) é suficiente e não deve ser reconfirmada — faça stage
  somente dos arquivos especificamente aprovados, execute o commit, e não
  pergunte novamente "Posso commitar agora?". Se o pacote autorizado não
  estiver claro, pare e peça esclarecimento.
  Commit e push continuam sendo autorizações distintas. Faça push somente
  quando o usuário autorizar explicitamente o push, ou quando a mesma
  instrução autorizar explicitamente "commit e push"; nesse caso, não
  peça uma nova confirmação — execute o push depois de conferir que o
  commit e a árvore estão corretos.
- Não declarar uma entrega concluída apenas porque a tela renderiza.

## Fluxo operacional

Três skills cobrem o ciclo inteiro de um item:

- `/hydra-resume`: retomar o estado (branch, ciclo, itens, gate);
- `/hydra-work <item>` (ou `... <item> continue` para retomar depois de um
  defeito, ou depois de aprovação humana pós-dogfood): planeja e implementa
  o menor corte coerente até o ponto dogfoodável, então para e devolve o
  controle ao humano — sem parar antes disso, exceto Nível 3 antes de
  editar ou defeito real. Só depois de aprovação explícita, numa passagem
  seguinte, faz hardening, verificação final, documenta e sela o item;
- `/hydra-ship "<mensagem>"`: publica o stage selado — código e
  documentação de acompanhamento em um único commit.

`/hydra-verify <fast|full>` continua disponível fora do fluxo fixo, para
conferir a suíte isoladamente quando fizer sentido.

Não existe etapa de sincronização documental depois do commit. Não repetir
manualmente leituras ou verificações que um script já realizou.

### Níveis de cerimônia

- **Nível 1** — documentação, testes, scripts/skills/tooling interno, sem
  arquivo de produção em `app/` nem mudança de comportamento do produto:
  verificação `fast`, sem QA visual;
- **Nível 2** — mudança normal de produto (rotas, componentes,
  apresentação, casos de uso, comportamento comum), fora das áreas
  sensíveis do Nível 3: verificação `fast` basta; QA manual rápida quando
  houver interface visivelmente afetada;
- **Nível 3** — mudança sensível (`domain/`, `catalog/`,
  `orientation-engine/`, `server/persistence/`, schema/migrations,
  contratos arquiteturais, dependências, arquitetura, segurança,
  transformação/migração de dados, comportamento transversal): exige
  autorização explícita registrada no item ou decisão associada antes de
  editar; verificação `full` e QA manual quando aplicável, no boundary
  pós-dogfood (seal/delivery) — o rótulo Nível 3 sozinho não exige `full`
  antes do dogfood, só quando houver risco concreto que o justifique.

`/hydra-work` classifica o nível a partir do que o item pede e do diff
real, e pede autorização assim que detectar Nível 3 — não é preciso
decidir o nível antes. Em dúvida, use o nível mais alto. `full` roda no
boundary pós-dogfood (seal/delivery), inclusive antes de `/hydra-ship`
quando várias entregas Nível 1/2 forem publicadas juntas, como checagem
final de lote. O stage só é publicável depois de selado por
`hydra-delivery-guard.mjs` dentro de `/hydra-work`.

### Documentação de acompanhamento

Mínimo necessário para retomar contexto entre sessões — não um registro
histórico completo:

- backlog do ciclo: status do item e evidência objetiva em uma linha;
- `CHANGELOG.md`: uma linha por item em `[Unreleased]`, o efeito
  observável — sem parágrafo, sem lista de subcasos;
- `PROJECT_STATUS.md`: só a linha de "próxima decisão" quando ela mudar;
- `docs/07-management/decision-log.md`: só para decisões Nível 3
  (arquitetura, schema, dependências, contratos) — não para itens comuns;
- roadmap: só quando o item completa objetivamente uma etapa numerada.

## Economia de contexto

- Leia apenas arquivos diretamente relacionados ao item.
- Prefira busca pontual, `--stat`, `--name-status` e `--check`.
- Não reproduza documentos, diffs ou logs completos na resposta.
- Abra logs completos somente quando o resumo não explicar uma falha.
- Resuma resultados com caminhos de arquivos e achados verificáveis.
- Ao mudar de item, encerre a sessão atual e comece uma nova.
- Se o contexto acumular exploração irrelevante, produza um handoff curto e pare.

## Referências visuais

- `design/references/` e `design/explorations/` são referências exploratórias.
- Somente `design/approved/` representa direção visual aprovada.
- Em conflito com especificação funcional, a especificação prevalece até nova
  decisão explícita.
