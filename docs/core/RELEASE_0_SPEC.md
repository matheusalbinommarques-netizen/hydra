# Hydra — Release 0 Specification

**Versão:** 0.1  
**Status:** canônico para design  
**Objetivo:** validar a experiência guiada antes do desenvolvimento funcional.

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

O Release 0 é um protótipo navegável.

Não exige:

- backend;
- banco de dados;
- autenticação;
- integração;
- IA;
- regras completas;
- persistência real;
- arquitetura final.

Pode utilizar dados simulados.

## 3. Fluxo principal

```text
Tela inicial
→ criar projeto
→ informar origem
→ registrar contexto
→ descrever problema ou oportunidade
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
- salvar rascunho simulado;
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

- situação;
- pessoa ou grupo afetado;
- forma atual de lidar com a situação;
- principal dificuldade.

#### Campos opcionais

- evidências;
- consequências de não agir;
- hipótese;
- solução imaginada;
- observações.

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
- quem é afetado;
- por que a situação é problemática.

#### Ações

- salvar e continuar;
- voltar;
- pular;
- ver exemplo;
- entender melhor.

---

### 4.4 Atividade guiada — resultado desejado

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

### 4.5 Resumo da descoberta

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
- exportar visualmente um Project Brief simulado;
- acessar o mapa da jornada.

#### Requisito de clareza

O resumo não deve parecer um documento jurídico. Deve ser escaneável e editável.

---

### 4.6 Próxima ação recomendada

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

### 4.7 Workspace principal

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

As regras poderão ser simuladas no protótipo.

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
- identidade visual consistente;
- teste preparado para até dois usuários.

## 9. Fora do Release 0

- lógica de negócio completa;
- persistência real;
- importação e exportação funcionais;
- testes automatizados;
- autenticação;
- colaboração;
- deploy de produção;
- acessibilidade completa;
- design mobile completo;
- IA.
