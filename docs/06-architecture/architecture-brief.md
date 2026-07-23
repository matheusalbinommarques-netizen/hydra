# Architecture Brief

**Status:** aceita — stack definida em ADR-001; arquitetura interna definida nesta versão

## 1. Contexto

- aplicação web;
- usuário individual;
- sem IA;
- sem integrações externas;
- sem orçamento;
- desenvolvimento assistido pelo Claude Code;
- execução local inicialmente, com self-host em VPS único como hospedagem-alvo (ADR-001);
- persistência simples no Walking Skeleton, com SQLite embutido no processo Node (ADR-001).

## 2. Prioridades

1. simplicidade;
2. legibilidade;
3. facilidade de manutenção;
4. baixo custo;
5. velocidade de desenvolvimento;
6. testabilidade;
7. possibilidade de expansão;
8. segurança básica.

## 3. Restrições

- monólito modular;
- um repositório;
- um mecanismo de persistência;
- nada de microsserviços;
- nada de arquitetura distribuída;
- regras metodológicas separadas da UI;
- textos de orientação separados dos componentes;
- dados estruturados e semanticamente identificados, sem componentes ou serviços de IA no Release 0;
- nenhuma funcionalidade crítica como caixa-preta.

## 4. Stack

Decidida em `ADR-001` (`docs/06-architecture/adr/ADR-001-stack-choice.md`):

- SvelteKit + TypeScript;
- executado em Node.js;
- SQLite embutido no processo Node;
- self-host em VPS único.

ORM, driver de banco, biblioteca de validação e migrations permanecem em aberto (ver §9).

## 5. Estrutura de módulos

Localização do projeto no monorepo: pasta `app/` dedicada — mantém `docs/`, `design/` e `prototype/` limpos na raiz.

A estrutura interna de `app/src/` reflete a separação de responsabilidades de `TECHNICAL_BRIEF.md` §4 e o conteúdo já registrado em `DOMAIN_MODEL.md`, `STATE_MACHINE.md` e `ORIENTATION_ENGINE.md`:

```text
app/
  src/
    lib/
      domain/               tipos das entidades e do catálogo (Project,
                             ActivityProgress, Answer, PendingItem,
                             PhaseDefinition, ActivityDefinition,
                             FieldDefinition) e as funções puras de transição e
                             invariantes de `STATE_MACHINE.md` (transições de
                             status de atividade, regras de edição, gatilho de
                             invalidação do Resumo). Não acessa persistência
                             nem o catálogo concreto.

      catalog/               dados: instâncias concretas do catálogo
                             metodológico (as 7 atividades da Descoberta +
                             "Definir usuário principal", com títulos,
                             perguntas, exemplos, critérios de conclusão,
                             textos de pendência). Estático, sem estado de
                             projeto.

      orientation-engine/    funções puras de projeção e recomendação de
                             `ORIENTATION_ENGINE.md`: status de fase/projeto,
                             Trilha A, Trilha B, "limite do catálogo
                             alcançado", projeção de hipóteses. Recebe estado
                             + catálogo como entrada; nunca acessa nem grava
                             persistência.

      server/
        persistence/         porta (interface) de um único repositório
                             orientado ao agregado Project: carrega o estado
                             do projeto e salva atomicamente o estado
                             resultante de uma operação. A estratégia interna
                             (reescrita completa, diffs, transações) ainda não
                             foi decidida — só o contrato "carregar" /
                             "salvar atomicamente" está fixado aqui. Fronteira
                             server-only explícita via convenção `$lib/server`
                             do SvelteKit.

        application/          casos de uso (ex.: responder atividade, pular
                             atividade, confirmar resumo): carrega o estado
                             via persistence/, aplica as funções puras de
                             transição de domain/, persiste atomicamente o
                             estado resultante via persistence/, e só então
                             solicita ao orientation-engine/ as projeções
                             (status, Trilha A/B) para montar a resposta. É a
                             única camada que conhece catalog/, persistence/,
                             domain/ e orientation-engine/ ao mesmo tempo.

    routes/                  interface (SvelteKit): Home, Agora, Mapa,
                             Resumo, Registros. `+page.server.ts` e `actions`
                             chamam apenas `server/application/` — nunca
                             catalog/, persistence/, domain/ ou
                             orientation-engine/ diretamente.
```

**Fluxo de leitura** (qualquer tela): `routes/` chama o caso de uso de leitura em `server/application/` → este chama `persistence.load(projectId)` (estado) + `catalog` (conteúdo estático) → passa isso ao `orientation-engine` (status calculado, Trilha A/B) → monta o resultado pronto para o componente.

**Fluxo de escrita** (responder, pular, confirmar resumo): `routes/` recebe a ação → chama o caso de uso correspondente em `server/application/` → este carrega o estado via `persistence`, aplica a transição pura de `domain/`, persiste atomicamente o estado resultante via `persistence`, e então chama `orientation-engine` para recalcular as projeções (Trilha A/B, status) → devolve o resultado para `routes/`.

O Motor de Orientação (`orientation-engine/`) nunca acessa nem grava persistência — é `server/application/` quem aplica e persiste as transições, e só depois solicita as projeções ao motor.

Direção de dependência: `domain/` e `orientation-engine/` nunca importam `persistence/`, `application/` ou `routes/`. `persistence/` não conhece regras de domínio além do que precisa serializar. `application/` é a única camada que integra tudo. `routes/` só conhece `application/`. É essa direção que permite adiar a escolha de ORM/driver sem reescrever domínio ou motor depois.

## 6. Persistência inicial

- SQLite embutido no processo Node (`ADR-001`) — mantém aplicação e arquivo do banco no mesmo servidor;
- acessado exclusivamente através da porta definida em `server/persistence/` (§5) — nenhum outro módulo fala com o banco diretamente;
- a porta carrega o estado do projeto e salva atomicamente o estado resultante de uma operação; a estratégia interna ainda não foi decidida;
- driver/ORM concreto ainda não escolhido (§9);
- exportação e importação JSON no Walking Skeleton (já previstas em `TECHNICAL_BRIEF.md` §6 e §14) operam sobre o mesmo estado exposto pela porta, não sobre o banco diretamente.

## 7. Testes

Categorias mapeadas para a estrutura de módulos (§5):

- **unitários** — transições e invariantes de `domain/`, e projeções/recomendação de `orientation-engine/`;
- **integração** — `server/persistence/` e `server/application/` (casos de uso completos, carregar/salvar/exportar/importar);
- **jornada** — `routes/` ponta a ponta (criar projeto, responder atividades, pular, revisar resumo, receber próxima ação);
- **manuais** — clareza visual, navegação, estados, mensagens, acessibilidade básica.

Runner de testes específico ainda não escolhido (§9).

## 8. Autenticação

Adiada. O Walking Skeleton poderá operar sem contas, desde que isso não comprometa a arquitetura descrita em §5.

## 9. Decisões pendentes

- ORM ou driver de banco para SQLite;
- biblioteca de validação de formulários/dados;
- runner de testes (unitário e de jornada);
- estratégia de migração de schema;
- infraestrutura da VPS (provisionamento, backups, TLS, processo de deploy).

Resolvidos nesta versão: framework/linguagem/runtime e banco embutido (`ADR-001`); localização da aplicação no repositório (`app/`); estrutura interna de módulos, incluindo a camada de aplicação e a fronteira server-only (§5).
