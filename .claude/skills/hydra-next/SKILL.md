---
name: hydra-next
description: Propõe a menor fatia funcional da próxima etapa ainda não concluída do roadmap do Hydra, sem editar nada. Uso explícito apenas via /hydra-next.
disable-model-invocation: true
allowed-tools: Bash(node .claude/scripts/hydra-state.mjs:*), Read, Grep, Glob
---

Sem argumentos. Propõe a próxima etapa candidata do roadmap para revisão
de Matheus — nunca decide sozinho, nunca implementa.

## 1. Obter os fatos

```
node .claude/scripts/hydra-state.mjs --format json
```

Reaproveite `changelogUnreleased` do próprio JSON — não releia
`CHANGELOG.md` inteiro por conta própria. O script não cobre o roadmap nem
`PROJECT_STATUS.md`; leia os dois diretamente:

- `docs/03-product/product-roadmap.md`;
- `PROJECT_STATUS.md`.

Se o script sair com código diferente de zero, pare e mostre o erro —
não tente adivinhar o estado.

## 2. Identificar a etapa candidata

Leia a seção "## Sequência de evolução" do roadmap, em ordem. A etapa
candidata é a primeira sem marca de conclusão no título (ex.: "—
concluído"). Cruze com `PROJECT_STATUS.md` e `changelogUnreleased`: se
qualquer uma dessas fontes já descrever essa etapa como entregue, trate
isso como sinal a confirmar no código (§3), não como conclusão definitiva.

Leia só a seção dessa etapa. Não leia nem planeje etapas posteriores.

## 3. Confirmar contra o código antes de declarar pendente

Antes de tratar a etapa candidata como pendente, inspecione apenas a
infraestrutura diretamente relacionada a ela — rotas, componentes e
projeções que a própria seção do roadmap descreve, ou que a etapa
anterior já deixou como padrão reconhecível. Não faça auditoria geral do
repositório.

- Só prossiga para a §4 quando todas as fontes — roadmap,
  `PROJECT_STATUS.md`, `changelogUnreleased` e o código inspecionado —
  forem compatíveis com a etapa ainda pendente.
- Qualquer indício de que a etapa já foi entregue no código, enquanto o
  roadmap a marca como pendente, é divergência: **pare aqui**, relate o
  que cada fonte diz e qual arquivo motivou a checagem.
- Uma etapa marcada como concluída no roadmap/status/changelog mas sem
  sustentação encontrada no código também é divergência: **pare aqui**
  pelo mesmo motivo.
- Em nenhum desses casos decida sozinho qual fonte está certa nem avance
  silenciosamente para a etapa seguinte — isso é decisão de Matheus.
- Se não for possível delimitar com segurança quais arquivos checar a
  partir do que a seção do roadmap descreve, pare e apresente a dúvida em
  vez de ampliar a exploração.

## 4. Propor a menor fatia

Só depois de confirmada como pendente: proponha somente a menor fatia
funcional dessa etapa — nunca a etapa inteira como especificada no
roadmap, nunca mais de duas alternativas quando houver mais de uma opção
razoável.

## 5. Formato obrigatório da resposta

```
# Próxima etapa
Nome e resultado descritos no roadmap.

# Estado atual relacionado
Somente fatos confirmados no código e nos documentos atuais.

# Infraestrutura reutilizável
Projeções, rotas, componentes, contratos e testes já existentes.

# Menor fatia funcional
Um único resultado observável para o usuário.

# Escopo
Comportamentos e arquivos provavelmente afetados.

# Fora do escopo
Limites explícitos para evitar expansão.

# Limitações e dependências
Conflitos, capacidades ausentes e restrições atuais.

# Nível provável
Nível 1, 2 ou 3, com justificativa curta baseada nas regras existentes.

# Testes e QA
Verificações automatizadas e jornadas manuais necessárias.

# Critérios objetivos de aceite
Comportamentos diretamente observáveis e verificáveis.

# Decisões pendentes
Somente decisões que exigem aprovação de Matheus.
```

Em cada seção, diferencie fato (confirmado em código ou documento),
inferência (sua leitura do que falta) e decisão pendente (só Matheus
resolve) — não misture os três sem identificação. Respostas compactas:
cite o trecho relevante, não o arquivo inteiro.

## 6. O que este comando nunca faz

Não cria, edita nem apaga nenhum arquivo do projeto — incluindo roadmap,
`PROJECT_STATUS.md`, `CHANGELOG.md` e backlog. Não cria ciclo, item de
backlog nem identificador. Não roda testes. Não faz stage, commit ou
push. Não lê nem planeja etapas posteriores à candidata. Não compara mais
de duas alternativas. Não repete a história do produto já registrada em
`CHANGELOG.md`/decision-log. O plano apresentado nunca é considerado
aprovado automaticamente — implementação exige decisão explícita de
Matheus e, quando houver item formal, passa por `/hydra-plan-item`.
