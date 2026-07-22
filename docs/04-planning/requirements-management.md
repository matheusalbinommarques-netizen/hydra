# Plano de Gerenciamento de Requisitos

## 1. Objetivo

Garantir que as funcionalidades permaneçam vinculadas às necessidades do usuário e que possam ser validadas de forma objetiva.

## 2. Hierarquia

```text
Release
└── Capacidade
    └── História de usuário
        ├── Tarefa técnica
        ├── Bug
        └── Spike
```

## 3. Conteúdo obrigatório de uma história

- título;
- problema ou necessidade;
- usuário beneficiado;
- comportamento esperado;
- valor esperado;
- critérios de aceitação;
- dependências;
- prioridade MoSCoW;
- esforço;
- release;
- capacidade;
- objetivo relacionado.

## 4. Rastreabilidade

```text
Problema
→ objetivo
→ capacidade
→ história
→ critério de aceitação
→ teste
→ entrega
```

## 5. Aprovação

Matheus, como Product Owner, aprova:

- entrada em Ready;
- critérios de aceitação;
- mudança relevante;
- aceite final da história.

## 6. Definition of Ready

Um item entra em Ready quando:

- a necessidade está clara;
- o usuário está identificado;
- o comportamento está descrito;
- os critérios de aceitação são verificáveis;
- a prioridade foi definida;
- a release foi definida;
- dependências relevantes foram identificadas;
- o tamanho é aceitável para o ciclo.

## 7. Mudanças

Mudanças surgidas antes do início:

- atualizam a história.

Mudanças após o início:

- são registradas;
- têm impacto analisado;
- podem gerar nova issue;
- não são incorporadas silenciosamente.

## 8. Validação

Um requisito só será aceito quando:

- seus critérios forem atendidos;
- o comportamento puder ser demonstrado;
- os testes aplicáveis passarem;
- não houver falha crítica conhecida.
