# ADR-001 — Escolha da stack

**Status:** aceita
**Data:** 2026-07-22

## Contexto

O Hydra será desenvolvido individualmente, sem orçamento, com Claude Code como
par de implementação, e com necessidade de alta legibilidade e baixo custo de
manutenção. A persistência do Walking Skeleton já foi definida como SQLite
embutido, e a hospedagem-alvo pós Walking Skeleton é self-host simples em um
único VPS — ambos definidos nesta rodada de decisão, antes da escolha do
framework.

## Critérios

- curva de aprendizado;
- experiência anterior;
- simplicidade full stack;
- qualidade do ecossistema;
- testabilidade;
- documentação;
- baixo custo de implantação e operação, sem dependência obrigatória de serviços gerenciados pagos;
- facilidade de manutenção;
- adequação ao desenvolvimento assistido por Claude Code;
- possibilidade de integração futura com IA;
- compatibilidade direta com SQLite embutido no processo Node, mantendo aplicação e arquivo do banco no mesmo servidor;
- facilidade de self-host em VPS único, sem depender de convenções de um PaaS específico.

## Opções consideradas

### Opção A — SvelteKit + TypeScript

Rotas de arquivo, funções de servidor (`load`/`actions`) e componentes no
mesmo projeto — uma arquitetura de monólito modular é bem suportada por essa
estrutura, sem exigir processos separados. Qualquer driver Node compatível
com SQLite (ex.: `better-sqlite3`, citado apenas como exemplo — a escolha do
driver/ORM/query builder fica para a etapa de arquitetura) funciona dentro das
funções de servidor sem fricção. `adapter-node` gera um servidor Node
standalone, adequado a self-host em VPS único sem acoplamento a um PaaS.
Testabilidade adequada (funções de servidor isoláveis do componente visual).
Único candidato com familiaridade prévia do usuário já registrada em
`TECHNICAL_BRIEF.md` §9. Limitação: ecossistema menor que React.

### Opção B — Next.js (App Router) + TypeScript

Ecossistema mais amplo. Self-host via Node standalone, Docker ou build
standalone é oficialmente suportado pelo framework, não é uma solução
improvisada. A desvantagem real para o escopo atual é conceitual: a fronteira
entre Server/Client Components e Server Actions introduz uma superfície de
decisão adicional (o que roda onde, quando usar cada modelo) que o Hydra não
precisa neste estágio. Sem familiaridade prévia registrada.

### Opção C — Nuxt 3 (Vue) + TypeScript

Estrutura equivalente à Opção A (rotas de arquivo, camada de servidor via
Nitro no mesmo projeto, build standalone para self-host). Tecnicamente
comparável a SvelteKit nos critérios de arquitetura, mas sem a vantagem de
familiaridade prévia do usuário nem do histórico de uso com Claude Code.

### Opção D — Node/TypeScript minimalista (Fastify ou Hono) + camada de views simples

Máximo controle e menor acoplamento a convenções de framework, mas exige
montar manualmente roteamento, camada de views e convenções de projeto — mais
decisões estruturais a inventar antes de começar a construir as telas
guiadas. Para uma interface com várias atividades guiadas, mapa, resumo e
registros, tende a custar mais tempo de estruturação do que economiza em
simplicidade.

## Decisão

SvelteKit + TypeScript, executado em Node.js, com SQLite embutido como
mecanismo de persistência, orientado a self-host simples em um único VPS.

Esta decisão cobre apenas framework, linguagem, runtime, mecanismo de
persistência e orientação de hospedagem. Não inclui ainda: ORM, driver de
banco, biblioteca de validação, migrations, infraestrutura da VPS ou
arquitetura interna do código — essas decisões pertencem às próximas etapas
(arquitetura inicial e contratos implementáveis).

## Consequências positivas

- monólito modular bem suportado pela stack (UI, rotas de servidor e lógica
  no mesmo projeto, sem processos separados);
- self-host em VPS único viável via servidor Node standalone, sem
  dependência de convenções de um PaaS específico;
- familiaridade prévia do usuário reduz o custo de aprendizado durante a
  implementação;
- SQLite embutido no mesmo processo Node atende diretamente às restrições
  de baixo custo e simplicidade, sem infraestrutura adicional;
- testabilidade adequada para as regras do motor de orientação e da
  persistência.

## Consequências negativas

- ecossistema menor que React/Next.js — menos exemplos prontos para casos
  muito específicos;
- escolha de ORM, driver de banco, validação e migrations ainda em aberto,
  e precisa ser feita antes da implementação (etapa de arquitetura);
- infraestrutura da VPS (provisionamento, backups, TLS, processo de deploy)
  ainda não definida.

## Critérios de revisão

Reavaliar esta decisão se surgir necessidade de: concorrência de escrita
significativa sobre o banco, múltiplas instâncias da aplicação rodando ao
mesmo tempo, separação do banco em um serviço próprio (fora do processo
Node), escala horizontal além de um único VPS, ou se limitações práticas do
framework se mostrarem um obstáculo real durante o desenvolvimento do
Walking Skeleton.
