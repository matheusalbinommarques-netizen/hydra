# Hydra — Release 0 Specification

> **HISTÓRICO / NÃO AUTORIDADE CORRENTE.** §9 afirma que não há "novas
> entidades de domínio além das já existentes (`Project`,
> `ActivityProgress`, `Answer`, `PendingItem`)" — o domínio atual
> (`app/src/lib/domain/state-types.ts`) já inclui `ScopeItem`,
> `ScopeVersion`, `Impediment`, `WorkItem`, `AffectedGroup`,
> `ExternalAction`, `Evidence`, `CurrentTreatment`, `TreatmentStep`,
> `CauseExploration`, `CauseHypothesis`, `DesiredOutcome`, entre outras. A
> baseline descrita aqui é anterior ao rework de produto. Para o estado
> vigente, ver `docs/core/HYDRA_PRODUCT_REWORK.md` e
> `docs/core/README.md`.

**Versão:** 0.2
**Status:** canônico para design  
**Objetivo:** especificar a baseline funcional do Release 0 — a experiência guiada já validada e incorporada ao produto real, agora cobrindo a jornada linear completa, da Descoberta ao encerramento do projeto (fases 1 a 6 do catálogo).

## 1. Resultado a validar

Uma pessoa deve conseguir navegar pelo fluxo e explicar:

1. onde está;
2. o que precisa fazer;
3. por que precisa fazer;
4. o que vem depois;
5. como voltar e editar;
6. como pular uma etapa;
7. qual pendência foi criada.

## 2. Natureza do Release 0

O Release 0 é a baseline funcional do produto, já implementada e em uso.

Continua não exigindo:

- autenticação;
- integração externa;
- IA;
- colaboração ou múltiplos usuários;
- ciclos recorrentes, instâncias repetidas de atividade ou histórico de atualizações (a fase Execução e acompanhamento representa o retrato atual, editável pelo Mapa — ver `docs/core/DOMAIN_MODEL.md` §7 e `docs/core/STATE_MACHINE.md`).

Já inclui, como parte da baseline entregue: persistência real,
importação e exportação funcionais, catálogo metodológico completo das
seis fases (Descoberta, Definição do produto, Estruturação do projeto,
Planejamento da entrega, Execução e acompanhamento, Validação e
encerramento), e suíte de testes automatizados (ver §9).

## 3. Fluxo principal

```text
Tela inicial
→ criar projeto
→ informar origem
→ registrar contexto
→ descrever problema ou oportunidade
→ identificar público afetado
→ registrar estado atual
→ definir resultado desejado
→ revisar resumo
→ receber próxima ação
→ acessar workspace
```

## 4. Telas do Release 0

### 4.1 Tela inicial / projetos

#### Objetivo

Apresentar o Hydra e permitir iniciar ou continuar um projeto.

#### Conteúdo obrigatório

- marca Hydra;
- mensagem curta de valor;
- botão principal `Criar novo projeto`;
- área de projetos recentes;
- estado vazio quando nenhum projeto existir;
- acesso opcional a `Como funciona`.

#### Mensagem sugerida

> Estruture seu projeto de software passo a passo.

Texto de apoio:

> O Hydra ajuda você a entender o que definir agora, por que isso importa e o que fazer depois.

#### Ações

- criar novo projeto;
- abrir projeto existente;
- visualizar explicação breve.

#### Estado vazio

- ilustração ou composição visual discreta;
- uma frase curta;
- CTA claro.

---

### 4.2 Criação do projeto — entrada híbrida

#### Objetivo

Obter o mínimo necessário para iniciar a jornada sem apresentar um formulário pesado.

#### Etapa 1 — Origem

Pergunta:

> O que deu origem a este projeto?

Opções:

- um problema;
- uma oportunidade;
- uma solicitação;
- uma ideia de produto;
- uma solução já iniciada;
- outro.

#### Etapa 2 — Contexto

Campos obrigatórios:

- nome provisório;
- breve descrição;
- trabalho individual ou em equipe;
- nível de experiência;
- estágio atual.

#### Comportamentos

- progresso visível;
- voltar;
- avançar;
- pular somente quando permitido;
- orientação curta ao lado ou abaixo da atividade.

---

### 4.3 Atividade guiada — problema ou oportunidade

#### Objetivo

Ajudar o usuário a compreender a necessidade antes de definir funcionalidades.

#### Pergunta principal

> Qual situação precisa mudar?

#### Campos obrigatórios

- situação que precisa mudar;
- sinais que representam melhor a situação (seleção múltipla — excesso de etapas, informação duplicada, retrabalho, falta de clareza, decisões dispersas, acompanhamento insuficiente, outro).

#### Campos opcionais

- descrição do sinal "Outro" (só aparece quando "Outro" é selecionado acima; não alimenta regra nenhuma nesta versão; sempre visível, fora do agrupamento abaixo);
- evidências, consequências de não agir, hipótese, solução imaginada e observações — agrupados numa seção expansível ("Adicionar mais contexto"), recolhida por padrão e aberta automaticamente quando algum desses campos já tiver resposta salva (`domain/catalog-types.ts`, `optionalGroup`).

#### Orientação contextual

Deve conter:

- por que essa atividade importa;
- exemplo de resposta;
- critério de conclusão;
- aprofundamento opcional.

#### Exemplo

> Hoje as solicitações internas chegam por e-mail e mensagens, sem prioridade ou histórico centralizado.

#### Critério de conclusão

O usuário descreveu:

- o que acontece;
- por que a situação é problemática.

Quem é afetado e como a situação é tratada hoje são aprofundados nas atividades seguintes (Público afetado e Estado atual).

#### Ações

- salvar e continuar;
- voltar;
- pular;
- ver exemplo;
- entender melhor.

---

### 4.4 Atividade guiada — público afetado

#### Objetivo

Aprofundar quem sente esta situação, com mais detalhe do que o levantamento inicial em Problema ou oportunidade.

#### Pergunta principal

> Quem é afetado por esta situação, em detalhe?

#### Campos obrigatórios

- público afetado em detalhe.

#### Orientação contextual

Deve conter:

- por que essa atividade importa;
- exemplo de resposta;
- critério de conclusão.

#### Exemplo

> Agentes de atendimento e clientes que abrem e acompanham solicitações.

#### Critério de conclusão

O público afetado foi descrito com clareza.

#### Ações

- salvar e continuar;
- voltar;
- pular;
- ver exemplo;
- entender melhor.

---

### 4.5 Atividade guiada — estado atual

#### Objetivo

Aprofundar como a situação é tratada hoje, para dimensionar o esforço da mudança necessária.

#### Pergunta principal

> Como a situação é tratada hoje, em detalhe?

#### Campos obrigatórios

- estado atual em detalhe.

#### Orientação contextual

Deve conter:

- por que essa atividade importa;
- exemplo de resposta;
- critério de conclusão.

#### Exemplo

> Cada atendente mantém sua própria planilha, sem padrão entre times.

#### Critério de conclusão

O estado atual foi descrito com detalhe suficiente para orientar a próxima atividade.

#### Ações

- salvar e continuar;
- voltar;
- pular;
- ver exemplo;
- entender melhor.

---

### 4.6 Atividade guiada — resultado desejado

#### Objetivo

Definir a mudança esperada sem exigir métricas sofisticadas.

#### Pergunta principal

> O que deverá estar diferente quando este projeto tiver sucesso?

#### Campos obrigatórios

- mudança esperada;
- principal beneficiário;
- forma de perceber melhoria.

#### Exemplo

> As solicitações estarão centralizadas, priorizadas e poderão ser acompanhadas do início ao fim.

#### Validação

Evitar aceitar apenas uma lista de funcionalidades como resultado.

#### Alerta possível

> Você descreveu uma solução, mas ainda não explicou qual resultado ela deve produzir.

---

### 4.7 Resumo da descoberta

#### Objetivo

Permitir que o usuário revise o que foi entendido antes de avançar.

#### Blocos

- identificação do projeto;
- origem;
- situação;
- público afetado;
- estado atual;
- resultado desejado;
- fatos;
- hipóteses;
- lacunas;
- pendências.

#### Ações

- editar cada bloco;
- continuar;
- acessar o mapa da jornada.

#### Nota de implementação

A implementação atual abre com uma visão geral compacta — problema, sinais
identificados (como chips), público afetado, estado atual e resultado
desejado — cada bloco com uma ação "Editar X" própria, seguida de uma
conferência compacta (problema/público/estado atual/resultado definidos) e
do botão de confirmação. As respostas completas de todas as seis atividades
da Descoberta (pergunta e resposta, em vez dos blocos temáticos
"fatos/hipóteses/lacunas" descritos acima) ficam em "Ver todas as respostas
da descoberta", recolhida por padrão e aberta automaticamente quando alguma
atividade da Descoberta ainda não está concluída. Isso é mantido como
evolução consciente do desenho inicial, não como pendência — a revisão
continua escaneável e editável, atendendo ao requisito de clareza desta
seção.

"Editar X" reabre a atividade concluída correspondente (via
`now/+page.server.ts`, restrito às atividades da própria Descoberta — ver
`domain/catalog-types.ts`/`?activity=…&from=summary`), reaproveitando
integralmente o formulário, a validação e a persistência já existentes;
salvar volta ao Resumo em vez de avançar a jornada, e invalida a confirmação
anterior do Resumo do mesmo jeito que qualquer outra edição das seis
atividades (ver `STATE_MACHINE.md` §3).

A tela de Resumo é a visualização legível vigente da descoberta. A
exportação JSON atende à portabilidade dos dados e não representa um
Project Brief compartilhável. Uma eventual exportação em formato humano
será especificada separadamente caso seja priorizada no futuro.

#### Requisito de clareza

O resumo não deve parecer um documento jurídico. Deve ser escaneável e editável.

---

### 4.8 Próxima ação recomendada

#### Objetivo

Demonstrar o principal diferencial do Hydra.

#### Conteúdo obrigatório

- uma ação principal;
- motivo;
- instrução curta;
- exemplo;
- critério de conclusão;
- próxima etapa provável;
- alternativas;
- acesso ao mapa completo.

#### Exemplo de ação

> Defina o usuário principal do produto.

#### Exemplo de motivo

> Você já descreveu o problema, mas ainda precisamos entender para quem a solução será desenvolvida. Isso ajudará a priorizar requisitos e critérios de aceitação.

#### Ações

- começar agora;
- ver alternativas;
- entender melhor;
- pular;
- ver mapa completo.

---

### 4.9 Workspace principal

#### Objetivo

Mostrar como a jornada guiada continuará após o onboarding.

#### Regiões permanentes

1. navegação ou mapa da jornada;
2. contexto do projeto;
3. área principal de trabalho;
4. orientação contextual;
5. próxima ação;
6. pendências;
7. progresso.

#### Conteúdo mínimo

- nome do projeto;
- etapa atual;
- progresso;
- ação principal;
- resumo curto;
- pendências;
- mapa das próximas etapas;
- acesso às respostas já registradas.

## 5. Comportamento de pular

Ao selecionar `Pular`:

1. apresentar consequência em linguagem simples;
2. permitir cancelar;
3. permitir continuar;
4. criar pendência;
5. mostrar a pendência no resumo e workspace;
6. recalcular a próxima ação.

### Exemplo

> Você pode continuar sem definir o público afetado. Essa informação ficará pendente e algumas recomendações poderão ser menos precisas.

Ações:

- voltar e preencher;
- pular mesmo assim.

## 6. Motor de orientação v0.1

Regras conceituais:

```text
SE projeto não possui identificação
    recomendar identificar projeto
SENÃO SE origem não foi definida
    recomendar definir origem
SENÃO SE situação não foi descrita
    recomendar descrever problema ou oportunidade
SENÃO SE público afetado não foi definido
    recomendar identificar público
SENÃO SE estado atual não foi descrito
    recomendar registrar estado atual
SENÃO SE resultado não foi definido
    recomendar definir resultado desejado
SENÃO
    recomendar criar visão inicial do produto
```

As regras estão implementadas no motor de orientação real
(`orientation-engine/`).

## 7. Estados necessários

Cada tela importante deve prever:

- inicial;
- preenchida;
- incompleta;
- com erro;
- pulada;
- com pendência;
- revisada;
- concluída.

## 8. Critérios de aceitação do Release 0

- fluxo completo navegável;
- posição atual visível;
- ação atual compreensível;
- motivo apresentado;
- retorno e edição possíveis;
- pular disponível onde previsto;
- consequência apresentada;
- pendência criada;
- mapa da jornada acessível;
- resumo final consistente;
- workspace representado;
- identidade visual consistente.

## 9. Fora do Release 0

- autenticação;
- colaboração ou múltiplos usuários;
- deploy de produção;
- acessibilidade completa;
- design mobile completo;
- IA;
- integrações externas;
- ciclos recorrentes ou instâncias repetidas de atividade;
- histórico de atualizações (a fase Execução e acompanhamento é um retrato atual, editável, sem histórico);
- gestão financeira avançada;
- notificações;
- novas entidades de domínio além das já existentes (`Project`, `ActivityProgress`, `Answer`, `PendingItem`).
